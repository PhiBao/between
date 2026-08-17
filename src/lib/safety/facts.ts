/**
 * The fact-preservation guard.
 *
 * A de-escalated message is only useful if it still says the same thing. This
 * module extracts the facts that matter in co-parenting logistics — dates,
 * days, times, money, quantities and the children's names — and refuses any
 * suggestion that drops one or invents one.
 *
 * The model is never trusted to police itself here. If the check fails, the
 * suggestion is discarded and the user simply sees their own message.
 */

export interface FactSet {
  /** Money amounts, normalised to `<symbol><amount>`, e.g. `$75`. */
  money: string[];
  /** Clock times, normalised to 24-hour `HH:MM`. */
  times: string[];
  /** Calendar references: ISO dates, day/month numbers, ordinals. */
  dates: string[];
  /** Weekday and month words, lower-cased. */
  words: string[];
  /** Remaining bare quantities, e.g. `40` in "40 minutes late". */
  quantities: string[];
  /** Names supplied by the caller (children, usually) found in the text. */
  names: string[];
}

const MONEY_RE =
  /(?:[$£€]\s?\d+(?:[.,]\d{1,2})?)|(?:\b\d+(?:[.,]\d{1,2})?\s?(?:dollars?|pounds?|euros?|usd|gbp|eur)\b)/gi;

const TIME_RE =
  /\b(?:(?:[01]?\d|2[0-3]):[0-5]\d\s?(?:am|pm)?|(?:1[0-2]|0?[1-9])\s?(?:am|pm))\b/gi;

const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/g;
const NUMERIC_DATE_RE = /\b\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?\b/g;
const ORDINAL_RE = /\b(\d{1,2})(?:st|nd|rd|th)\b/gi;

const DAY_MONTH_WORDS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "jan",
  "feb",
  "mar",
  "apr",
  "jun",
  "jul",
  "aug",
  "sep",
  "sept",
  "oct",
  "nov",
  "dec",
  "tomorrow",
  "tonight",
  "weekend",
];

const QUANTITY_RE = /\b\d+(?:\.\d+)?\b/g;

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function normaliseMoney(raw: string): string {
  const symbolMatch = raw.match(/[$£€]/);
  const currencyWord = raw.match(/dollars?|pounds?|euros?|usd|gbp|eur/i);
  const amount = raw.replace(/[^\d.,]/g, "").replace(/,(\d{2})$/, ".$1").replace(/,/g, "");
  const numeric = Number.parseFloat(amount);
  const value = Number.isFinite(numeric) ? String(numeric) : amount;

  let symbol = symbolMatch?.[0] ?? "";
  if (!symbol && currencyWord) {
    const word = currencyWord[0].toLowerCase();
    symbol = word.startsWith("pound") || word === "gbp" ? "£" : word.startsWith("euro") || word === "eur" ? "€" : "$";
  }
  return `${symbol}${value}`;
}

function normaliseTime(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, "");
  const meridiem = cleaned.endsWith("am") ? "am" : cleaned.endsWith("pm") ? "pm" : null;
  const digits = cleaned.replace(/am|pm/g, "");
  const [hourPart, minutePart] = digits.includes(":") ? digits.split(":") : [digits, "00"];

  let hour = Number.parseInt(hourPart ?? "0", 10);
  const minute = Number.parseInt(minutePart ?? "0", 10);

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Extracts the facts from a message. Matched spans are blanked out as we go so
 * that, for example, the `5` in "5pm" is not also counted as a bare quantity.
 */
export function extractFacts(text: string, names: readonly string[] = []): FactSet {
  let working = text;

  const take = (regex: RegExp, transform: (raw: string) => string): string[] => {
    const found: string[] = [];
    working = working.replace(new RegExp(regex.source, regex.flags), (match) => {
      found.push(transform(match));
      return " ".repeat(match.length);
    });
    return found;
  };

  const money = take(MONEY_RE, normaliseMoney);
  const times = take(TIME_RE, normaliseTime);

  const dates: string[] = [
    ...take(ISO_DATE_RE, (raw) => raw),
    ...take(NUMERIC_DATE_RE, (raw) => raw.replace(/\./g, "/")),
    ...take(ORDINAL_RE, (raw) => raw.replace(/(st|nd|rd|th)$/i, "")),
  ];

  const lowered = working.toLowerCase();
  const words = DAY_MONTH_WORDS.filter((word) =>
    new RegExp(`\\b${word}\\b`).test(lowered),
  );

  const quantities = take(QUANTITY_RE, (raw) => String(Number.parseFloat(raw)));

  const loweredFull = text.toLowerCase();
  const foundNames = names
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .filter((name) => loweredFull.includes(name.toLowerCase()))
    .map((name) => name.toLowerCase());

  return {
    money: unique(money),
    times: unique(times),
    dates: unique(dates),
    words: unique(words),
    quantities: unique(quantities),
    names: unique(foundNames),
  };
}

export interface FactComparison {
  ok: boolean;
  /** Facts in the original that the suggestion lost. */
  missing: string[];
  /** Facts the suggestion introduced that were not in the original. */
  invented: string[];
}

const LABELS: Record<keyof FactSet, string> = {
  money: "amount",
  times: "time",
  dates: "date",
  words: "day",
  quantities: "number",
  names: "name",
};

/**
 * Compares the facts of an original message against a proposed rewrite.
 *
 * Losing a fact is a correctness failure ("you owe me $75" becoming "you owe
 * me money"). Inventing a fact is worse — it puts words in the sender's mouth
 * that could later be quoted against them. Both reject the suggestion.
 */
export function compareFacts(
  original: string,
  suggestion: string,
  names: readonly string[] = [],
): FactComparison {
  const before = extractFacts(original, names);
  const after = extractFacts(suggestion, names);

  const missing: string[] = [];
  const invented: string[] = [];

  for (const key of Object.keys(LABELS) as (keyof FactSet)[]) {
    const label = LABELS[key];
    for (const value of before[key]) {
      if (!after[key].includes(value)) missing.push(`${label} ${value}`);
    }
    for (const value of after[key]) {
      if (!before[key].includes(value)) invented.push(`${label} ${value}`);
    }
  }

  return { ok: missing.length === 0 && invented.length === 0, missing, invented };
}
