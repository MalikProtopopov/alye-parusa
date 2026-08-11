import { describe, expect, it } from "vitest";
import { DomainError, ScrollRange } from "@/domain";

describe("ScrollRange", () => {
  it("constructs a valid range and exposes its span", () => {
    const range = ScrollRange.of(0.2, 0.6);
    expect(range.from).toBe(0.2);
    expect(range.to).toBe(0.6);
    expect(range.span).toBeCloseTo(0.4);
  });

  it("rejects inverted bounds", () => {
    expect(() => ScrollRange.of(0.6, 0.2)).toThrow(DomainError);
  });

  it("rejects bounds outside [0, 1]", () => {
    expect(() => ScrollRange.of(-0.1, 0.5)).toThrow(DomainError);
    expect(() => ScrollRange.of(0.5, 1.2)).toThrow(DomainError);
  });

  it("clamps progressWithin to [0, 1]", () => {
    const range = ScrollRange.of(0.2, 0.4);
    expect(range.progressWithin(0.1)).toBe(0);
    expect(range.progressWithin(0.3)).toBeCloseTo(0.5);
    expect(range.progressWithin(0.9)).toBe(1);
  });

  it("detects membership", () => {
    const range = ScrollRange.of(0.2, 0.4);
    expect(range.contains(0.3)).toBe(true);
    expect(range.contains(0.5)).toBe(false);
  });
});
