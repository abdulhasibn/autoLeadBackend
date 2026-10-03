export const RC_STATUSES = ['clear', 'hypothecation', 'under_transfer'] as const;
export const SERVICE_HISTORIES = ['full', 'partial', 'none', 'unknown'] as const;
export const LOAN_STATUSES = ['clear', 'active'] as const;

export type RcStatus = (typeof RC_STATUSES)[number];
export type ServiceHistory = (typeof SERVICE_HISTORIES)[number];
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export function parseRcStatus(input: string | null | undefined): RcStatus | null {
  return parseOptionalEnum(
    input,
    RC_STATUSES,
    'RC status must be clear, hypothecation, or under_transfer',
  );
}

export function parseServiceHistory(input: string | null | undefined): ServiceHistory | null {
  return parseOptionalEnum(
    input,
    SERVICE_HISTORIES,
    'Service history must be full, partial, none, or unknown',
  );
}

export function parseLoanStatus(input: string | null | undefined): LoanStatus | null {
  return parseOptionalEnum(input, LOAN_STATUSES, 'Loan status must be clear or active');
}

export function normalizeColour(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error('Colour cannot be empty');
  }
  return trimmed;
}

export function normalizeOptionalText(input: string | null): string | null {
  if (input === null) {
    return null;
  }
  const trimmed = input.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseOptionalEnum<T extends string>(
  input: string | null | undefined,
  allowed: readonly T[],
  message: string,
): T | null {
  if (input === null || input === undefined) {
    return null;
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!allowed.includes(trimmed as T)) {
    throw new Error(message);
  }
  return trimmed as T;
}
