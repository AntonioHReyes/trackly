/**
 * Which day a week begins on — affects `--this-week`/`--last-week` report
 * shortcuts (see SPEC.md). Lives in domain (not infra/config) so both the
 * application layer (date-range math) and infrastructure (config storage)
 * can depend on it without infra-on-application coupling.
 */
export type WeekStart = "monday" | "sunday";
