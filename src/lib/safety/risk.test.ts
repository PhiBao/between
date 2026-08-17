import { describe, expect, it } from "vitest";
import { mergeRisk, screenRisk } from "./risk";

describe("screenRisk", () => {
  it("lets an ordinary angry message through to be softened", () => {
    expect(
      screenRisk("You were late again and I am fed up with it. Pickup is 5pm."),
    ).toEqual({ level: "ok", blockRewrite: false });
  });

  it("flags threats of harm, however they are phrased", () => {
    const threats = [
      "I will make you regret this",
      "I'll hurt you if you do that again",
      "I know where you work",
      "Watch your back",
      "You're dead",
      "If you are late again I will make you regret it",
    ];

    for (const threat of threats) {
      expect(screenRisk(threat), threat).toEqual({
        level: "threat",
        blockRewrite: true,
      });
    }
  });

  it("flags self-harm and treats it as the higher priority", () => {
    expect(screenRisk("I don't want to live like this, I want to kill myself")).toEqual({
      level: "self_harm",
      blockRewrite: true,
    });
  });

  it("does not flag ordinary uses of strong words", () => {
    expect(screenRisk("The kids are killing me with the questions about school")).toEqual(
      { level: "ok", blockRewrite: false },
    );
    expect(screenRisk("Theo is dead set on football this term")).toEqual({
      level: "ok",
      blockRewrite: false,
    });
  });
});

describe("mergeRisk", () => {
  it("takes the most serious verdict from either source", () => {
    expect(mergeRisk("ok", "ok")).toBe("ok");
    expect(mergeRisk("ok", "threat")).toBe("threat");
    expect(mergeRisk("threat", "ok")).toBe("threat");
    expect(mergeRisk("threat", "self_harm")).toBe("self_harm");
    expect(mergeRisk("self_harm", "ok")).toBe("self_harm");
  });
});
