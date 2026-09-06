import { randomUUID } from "node:crypto";
import { Money } from "../value-objects/Money.js";
import { ValidationError } from "../errors/DomainError.js";

export interface WorkspaceProps {
  id: string;
  slug: string;
  name: string;
  defaultHourlyRate: number | null;
  currency: string;
  createdAt: Date;
}

/**
 * A client/context that isolates its projects, tags, and time entries from
 * every other workspace (see SPEC.md's "Data model" section). Holds the
 * currency and default hourly rate that projects fall back to when they
 * don't set their own.
 */
export class Workspace {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly defaultHourlyRate: number | null;
  readonly currency: string;
  readonly createdAt: Date;

  private constructor(props: WorkspaceProps) {
    this.id = props.id;
    this.slug = props.slug;
    this.name = props.name;
    this.defaultHourlyRate = props.defaultHourlyRate;
    this.currency = props.currency;
    this.createdAt = props.createdAt;
  }

  /** Creates a brand-new workspace, validating input and assigning an id. */
  static create(params: {
    slug: string;
    name: string;
    defaultHourlyRate?: number | null;
    currency: string;
  }): Workspace {
    const slug = Workspace.validateSlug(params.slug);
    const name = Workspace.validateName(params.name);
    const defaultHourlyRate = params.defaultHourlyRate ?? null;
    if (defaultHourlyRate !== null) {
      // Validate range via Money's own rules without keeping the Money
      // instance — the workspace stores a plain rate paired with currency.
      Money.fromDecimal(defaultHourlyRate, params.currency);
    }
    return new Workspace({
      id: randomUUID(),
      slug,
      name,
      defaultHourlyRate,
      currency: params.currency,
      createdAt: new Date(),
    });
  }

  /** Rehydrates a workspace from persisted data — skips id generation. */
  static reconstruct(props: WorkspaceProps): Workspace {
    return new Workspace(props);
  }

  /** Returns an equivalent workspace with its default hourly rate replaced. */
  withDefaultHourlyRate(defaultHourlyRate: number | null): Workspace {
    if (defaultHourlyRate !== null) {
      Money.fromDecimal(defaultHourlyRate, this.currency);
    }
    return new Workspace({ ...this, defaultHourlyRate });
  }

  /** Returns an equivalent workspace with its currency replaced. */
  withCurrency(currency: string): Workspace {
    // `Money.zero` validates and normalizes the ISO code (uppercase, 3 letters).
    const normalized = Money.zero(currency).currency;
    if (this.defaultHourlyRate !== null) {
      Money.fromDecimal(this.defaultHourlyRate, normalized);
    }
    return new Workspace({ ...this, currency: normalized });
  }

  /** The default rate as `Money`, or `null` if none is set. */
  resolveDefaultRate(): Money | null {
    return this.defaultHourlyRate === null
      ? null
      : Money.fromDecimal(this.defaultHourlyRate, this.currency);
  }

  private static validateSlug(slug: string): string {
    const trimmed = slug.trim();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(trimmed)) {
      throw new ValidationError(
        `Workspace slug must be lowercase alphanumeric with dashes, got "${slug}"`,
      );
    }
    return trimmed;
  }

  private static validateName(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new ValidationError("Workspace name cannot be empty");
    }
    return trimmed;
  }
}
