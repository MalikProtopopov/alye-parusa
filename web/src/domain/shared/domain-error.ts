/**
 * Raised when a domain invariant is violated. Lives in the innermost layer so
 * every other layer can catch a single, framework-agnostic error type.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
