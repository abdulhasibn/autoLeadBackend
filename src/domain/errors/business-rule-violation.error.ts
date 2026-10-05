/**
 * A well-formed request that breaks a business rule (closed lead, ineligible
 * assignee, missing showroom). Mapped to HTTP 422 with the rule's own code.
 */
export class BusinessRuleViolationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Readonly<Record<string, string | number>>,
  ) {
    super(message);
    this.name = 'BusinessRuleViolationError';
  }
}
