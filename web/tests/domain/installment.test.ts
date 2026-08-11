import { describe, expect, it } from "vitest";
import { DomainError, calculateInstallment } from "@/domain";

describe("calculateInstallment", () => {
  it("mirrors the backend formula (fractions 0..1, no /100)", () => {
    // price 5 000 000 ₽, 30 % down, 24 months, 10 % annual markup
    const q = calculateInstallment({
      price: 5_000_000,
      downPaymentPct: 0.3,
      months: 24,
      markupPctAnnual: 0.1,
    });

    expect(q.downPayment).toBe(1_500_000);
    expect(q.financed).toBe(3_500_000);
    // markup = financed × 0.1 × 24 / 12 = financed × 0.2
    expect(q.markup).toBeCloseTo(700_000, 6);
    expect(q.monthlyPayment).toBeCloseTo((3_500_000 + 700_000) / 24, 6);
    expect(q.totalCost).toBeCloseTo(5_700_000, 6);
  });

  it("is interest-free at zero markup: monthly = financed/months, total = price", () => {
    const q = calculateInstallment({
      price: 4_200_000,
      downPaymentPct: 0.5,
      months: 12,
      markupPctAnnual: 0,
    });

    expect(q.markup).toBe(0);
    expect(q.monthlyPayment).toBeCloseTo(2_100_000 / 12, 6);
    expect(q.totalCost).toBe(4_200_000);
  });

  it("echoes its inputs into the quote (snapshot parity with POST /calc)", () => {
    const q = calculateInstallment({
      price: 1_000_000,
      downPaymentPct: 0.9,
      months: 6,
      markupPctAnnual: 0.05,
    });

    expect(q.price).toBe(1_000_000);
    expect(q.downPaymentPct).toBe(0.9);
    expect(q.months).toBe(6);
    expect(q.markupPctAnnual).toBe(0.05);
  });

  it("allows a 100% down payment (admin may configure max = 1)", () => {
    const q = calculateInstallment({
      price: 1_000_000,
      downPaymentPct: 1,
      months: 12,
      markupPctAnnual: 0.08,
    });

    expect(q.downPayment).toBe(1_000_000);
    expect(q.financed).toBe(0);
    expect(q.markup).toBe(0);
    expect(q.monthlyPayment).toBe(0);
    expect(q.totalCost).toBe(1_000_000);
  });

  it("rejects impossible inputs", () => {
    expect(() =>
      calculateInstallment({ price: 0, downPaymentPct: 0.3, months: 12, markupPctAnnual: 0 }),
    ).toThrow(DomainError);
    expect(() =>
      calculateInstallment({ price: 1, downPaymentPct: 1.2, months: 12, markupPctAnnual: 0 }),
    ).toThrow(DomainError);
    expect(() =>
      calculateInstallment({ price: 1, downPaymentPct: -0.1, months: 12, markupPctAnnual: 0 }),
    ).toThrow(DomainError);
    expect(() =>
      calculateInstallment({ price: 1, downPaymentPct: 0.3, months: 0, markupPctAnnual: 0 }),
    ).toThrow(DomainError);
    expect(() =>
      calculateInstallment({ price: 1, downPaymentPct: 0.3, months: 12, markupPctAnnual: -0.1 }),
    ).toThrow(DomainError);
  });
});
