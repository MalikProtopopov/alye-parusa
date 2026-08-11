import { DomainError } from "../shared/domain-error";

/**
 * A normalized [from, to] window over the hero scroll timeline (0 = start of
 * the morph, 1 = night finale). Validates its invariants on construction so an
 * impossible chapter window can never reach the presentation layer.
 */
export class ScrollRange {
  private constructor(
    public readonly from: number,
    public readonly to: number,
  ) {}

  static of(from: number, to: number): ScrollRange {
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      throw new DomainError(`ScrollRange bounds must be finite, got [${from}, ${to}]`);
    }
    if (from < 0 || to > 1) {
      throw new DomainError(`ScrollRange must lie within [0, 1], got [${from}, ${to}]`);
    }
    if (from >= to) {
      throw new DomainError(`ScrollRange 'from' (${from}) must be < 'to' (${to})`);
    }
    return new ScrollRange(from, to);
  }

  get span(): number {
    return this.to - this.from;
  }

  contains(progress: number): boolean {
    return progress >= this.from && progress <= this.to;
  }

  /** Position of `progress` inside this window, clamped to [0, 1]. */
  progressWithin(progress: number): number {
    if (progress <= this.from) return 0;
    if (progress >= this.to) return 1;
    return (progress - this.from) / this.span;
  }
}
