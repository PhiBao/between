import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { PackData } from "./build";

/**
 * The pack is rendered with pdf-lib rather than a headless browser: no binaries,
 * no font downloads, deterministic output, and it runs anywhere Node runs.
 *
 * Layout is deliberately plain. This document may end up in front of a mediator
 * or a solicitor, so it reads like a statement, not like an app screenshot.
 */

const PAGE = { width: 595.28, height: 841.89 }; // A4 in points
const MARGIN = 56;
const LINE = 14;

const INK = rgb(0.12, 0.14, 0.13);
const MUTED = rgb(0.42, 0.44, 0.42);
const RULE = rgb(0.85, 0.83, 0.8);

interface Cursor {
  page: PDFPage;
  y: number;
}

export async function renderPackPdf(pack: PackData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Between — record extract");
  doc.setSubject("Co-parenting record extract");
  doc.setCreator("Between");
  doc.setProducer("Between");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const cursor: Cursor = { page: doc.addPage([PAGE.width, PAGE.height]), y: PAGE.height - MARGIN };

  const write = (
    text: string,
    options: { font?: PDFFont; size?: number; color?: typeof INK; indent?: number; gap?: number } = {},
  ) => {
    const font = options.font ?? regular;
    const size = options.size ?? 10.5;
    const indent = options.indent ?? 0;
    const maxWidth = PAGE.width - MARGIN * 2 - indent;

    for (const line of wrap(text, font, size, maxWidth)) {
      ensureSpace(doc, cursor, LINE);
      cursor.page.drawText(line, {
        x: MARGIN + indent,
        y: cursor.y,
        size,
        font,
        color: options.color ?? INK,
      });
      cursor.y -= LINE;
    }
    if (options.gap) cursor.y -= options.gap;
  };

  const rule = () => {
    ensureSpace(doc, cursor, LINE);
    cursor.page.drawLine({
      start: { x: MARGIN, y: cursor.y + 6 },
      end: { x: PAGE.width - MARGIN, y: cursor.y + 6 },
      thickness: 0.75,
      color: RULE,
    });
    cursor.y -= 10;
  };

  // ---------------------------------------------------------------- header ---
  write("Between — record extract", { font: bold, size: 17 });
  write(
    `Generated ${formatFull(pack.generatedAt)} · covering ${formatFull(pack.rangeStart)} to ${formatFull(pack.rangeEnd)}`,
    { color: MUTED, size: 9.5, gap: 4 },
  );
  write(`Parents in this record: ${pack.parties.join(" and ")}`, { size: 10 });
  if (pack.childNames.length > 0) {
    write(`Children referred to: ${pack.childNames.join(", ")}`, { size: 10 });
  }
  write(
    `${pack.entries.length} message${pack.entries.length === 1 ? "" : "s"}, ${pack.agreements.length} agreement${pack.agreements.length === 1 ? "" : "s"}`,
    { size: 10, gap: 6 },
  );
  rule();

  // ------------------------------------------------------------- integrity ---
  write("Integrity check", { font: bold, size: 12, gap: 2 });
  if (pack.integrity.ok) {
    write(
      "Each message below is sealed to the one before it with a SHA-256 hash chain. This extract was checked when it was produced and the chain is unbroken.",
      { size: 9.5, color: MUTED },
    );
    write(`Head hash: ${pack.integrity.headHash}`, { size: 8.5, font: bold, gap: 2 });
    write(
      "Anyone can re-check this extract by entering the head hash on the /verify page of the application.",
      { size: 9.5, color: MUTED },
    );
  } else {
    write(
      `WARNING: this extract does not verify. ${pack.integrity.reason} (at message #${pack.integrity.brokenAtSeq}).`,
      { size: 10, font: bold },
    );
  }
  write(
    "What this does and does not show: it shows what was recorded in this application and that it has not been altered since. It is not legal advice and it does not prove who typed a message.",
    { size: 9, color: MUTED, gap: 6 },
  );
  rule();

  // ------------------------------------------------------------ agreements ---
  write("Agreements", { font: bold, size: 12, gap: 2 });

  if (pack.agreements.length === 0) {
    write("No agreements were tracked in this period.", { size: 10, color: MUTED, gap: 6 });
  } else {
    for (const agreement of pack.agreements) {
      write(agreement.text, { font: bold, size: 10.5 });
      write(
        `Status: ${agreement.status}${agreement.dueAt ? ` · due ${formatFull(new Date(agreement.dueAt))}` : ""}${agreement.overdue ? " · overdue" : ""}`,
        { size: 9.5, color: MUTED },
      );
      write(`Quoted from the message: “${agreement.sourceQuote}”`, {
        size: 9.5,
        font: italic,
        indent: 12,
      });
      for (const event of agreement.events) {
        write(
          `${event.action} by ${event.actorName} on ${formatFull(new Date(event.createdAt))}${event.detail ? ` (${event.detail})` : ""}`,
          { size: 9, color: MUTED, indent: 12 },
        );
      }
      cursor.y -= 6;
    }
  }
  rule();

  // --------------------------------------------------------------- entries ---
  write("Messages, in order", { font: bold, size: 12, gap: 2 });

  if (pack.entries.length === 0) {
    write("No messages in this period.", { size: 10, color: MUTED });
  } else {
    for (const entry of pack.entries) {
      const source =
        entry.kind === "logged_external"
          ? `logged by ${entry.authorName} from outside the app`
          : `sent by ${entry.authorName} through the app`;

      write(`#${entry.seq} · ${formatFull(new Date(entry.occurredAt))} · ${source}`, {
        font: bold,
        size: 9.5,
      });
      write(entry.body, { size: 10.5, indent: 12 });
      write(`hash ${entry.hash}`, { size: 7.5, color: MUTED, indent: 12, gap: 6 });
    }
  }

  stampPageNumbers(doc, regular);

  return doc.save();
}

function ensureSpace(doc: PDFDocument, cursor: Cursor, needed: number): void {
  if (cursor.y - needed < MARGIN) {
    cursor.page = doc.addPage([PAGE.width, PAGE.height]);
    cursor.y = PAGE.height - MARGIN;
  }
}

function stampPageNumbers(doc: PDFDocument, font: PDFFont): void {
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    page.drawText(`Page ${index + 1} of ${pages.length}`, {
      x: MARGIN,
      y: MARGIN / 2,
      size: 8,
      font,
      color: MUTED,
    });
  });
}

/** Greedy word wrap, with a hard break for anything longer than a line. */
export function wrap(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const output: string[] = [];

  for (const paragraph of text.split("\n")) {
    const sanitised = sanitise(paragraph);
    if (sanitised.trim().length === 0) {
      output.push("");
      continue;
    }

    let line = "";
    for (const word of sanitised.split(/\s+/)) {
      const candidate = line.length === 0 ? word : `${line} ${word}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line.length > 0) output.push(line);

      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
      } else {
        let chunk = "";
        for (const character of word) {
          if (font.widthOfTextAtSize(chunk + character, size) > maxWidth) {
            output.push(chunk);
            chunk = character;
          } else {
            chunk += character;
          }
        }
        line = chunk;
      }
    }
    if (line.length > 0) output.push(line);
  }

  return output;
}

/**
 * The standard PDF fonts are WinAnsi encoded, so characters people actually
 * type — curly quotes, dashes, emoji — would throw. They are folded to safe
 * equivalents rather than dropped silently where possible.
 */
export function sanitise(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, "?");
}

function formatFull(date: Date): string {
  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}
