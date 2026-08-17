import { describe, expect, it } from "vitest";
import { compareFacts, extractFacts } from "./facts";

describe("extractFacts", () => {
  it("pulls out money, times, dates, days and quantities without double counting", () => {
    const facts = extractFacts(
      "You were 40 minutes late on Friday the 21st. You owe me $75 for the trip. Pickup is 5pm on the 28th.",
      ["Mia"],
    );

    expect(facts.money).toEqual(["$75"]);
    expect(facts.times).toEqual(["17:00"]);
    expect(facts.dates).toEqual(["21", "28"]);
    expect(facts.words).toEqual(["friday"]);
    // 5 came from "5pm" and must not reappear as a bare quantity.
    expect(facts.quantities).toEqual(["40"]);
    expect(facts.names).toEqual([]);
  });

  it("normalises times to 24 hour and money to symbol plus amount", () => {
    expect(extractFacts("at 5:30pm").times).toEqual(["17:30"]);
    expect(extractFacts("at 09:15").times).toEqual(["09:15"]);
    expect(extractFacts("at 12am").times).toEqual(["00:00"]);
    expect(extractFacts("75 dollars").money).toEqual(["$75"]);
    expect(extractFacts("£75.50 owed").money).toEqual(["£75.5"]);
  });

  it("finds the children's names case-insensitively", () => {
    expect(extractFacts("mia was waiting", ["Mia", "Theo"]).names).toEqual(["mia"]);
  });
});

describe("compareFacts", () => {
  const names = ["Mia"];
  const original =
    "You ALWAYS do this. You were 40 minutes late AGAIN on Friday the 21st and Mia was standing outside in the rain. You owe me $75 for the school trip. Pickup is 5pm on the 28th, do not be late.";

  it("accepts a rewrite that keeps every fact", () => {
    const suggestion =
      "You were 40 minutes late on Friday the 21st and Mia was waiting outside in the rain. Please send the $75 for the school trip. Pickup is 5pm on the 28th — please be on time.";

    expect(compareFacts(original, suggestion, names)).toEqual({
      ok: true,
      missing: [],
      invented: [],
    });
  });

  it("rejects a rewrite that drops the amount", () => {
    const suggestion =
      "You were 40 minutes late on Friday the 21st and Mia was waiting. Please send the money for the school trip. Pickup is 5pm on the 28th.";

    const result = compareFacts(original, suggestion, names);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("amount $75");
  });

  it("rejects a rewrite that changes the time", () => {
    const suggestion =
      "You were 40 minutes late on Friday the 21st and Mia was waiting outside in the rain. Please send the $75 for the school trip. Pickup is 6pm on the 28th.";

    const result = compareFacts(original, suggestion, names);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("time 17:00");
    expect(result.invented).toContain("time 18:00");
  });

  it("rejects a rewrite that invents a fact", () => {
    const suggestion =
      "You were 40 minutes late on Friday the 21st and Mia was waiting outside in the rain. Please send the $75 for the school trip by the 25th. Pickup is 5pm on the 28th.";

    const result = compareFacts(original, suggestion, names);
    expect(result.ok).toBe(false);
    expect(result.invented).toContain("date 25");
  });

  it("rejects a rewrite that drops a child's name", () => {
    const suggestion =
      "You were 40 minutes late on Friday the 21st and she was waiting outside in the rain. Please send the $75 for the school trip. Pickup is 5pm on the 28th.";

    const result = compareFacts(original, suggestion, names);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("name mia");
  });

  it("ignores tone-only changes", () => {
    const result = compareFacts(
      "You never listen and you are impossible.",
      "I would like us to find a way to agree on this.",
      names,
    );
    expect(result.ok).toBe(true);
  });
});
