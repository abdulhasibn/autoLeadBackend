/**
 * A well-formed request that breaks a business rule (closed lead, ineligible
 * assignee, missing showroom). Mapped to HTTP 422 with the rule's own code.
 */
/** Values an error's `details` may carry: scalars, or a list of ids. */
export type ErrorDetailValue = string | number | readonly string[];

export class BusinessRuleViolationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Readonly<Record<string, ErrorDetailValue>>,
  ) {
    super(message);
    this.name = 'BusinessRuleViolationError';
  }
}
