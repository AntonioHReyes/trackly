/**
 * Base class for all domain-layer errors. Distinguishes expected, meaningful
 * failures (invalid input, broken invariants, missing records) from
 * unexpected bugs — the CLI layer catches `DomainError` and prints a clean
 * message instead of a stack trace.
 */
export abstract class DomainError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** A value failed validation (e.g. negative rate, empty name). */
export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

/** An entity was looked up by id/slug and does not exist. */
export class NotFoundError extends DomainError {
  constructor(entity: string, identifier: string) {
    super(`${entity} not found: ${identifier}`);
  }
}

/** An operation would violate a uniqueness constraint (e.g. duplicate slug). */
export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

/** An operation is not allowed given the entity's current state. */
export class InvalidStateError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
