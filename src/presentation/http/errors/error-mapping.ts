import type { ErrorDetailValue } from '../../../domain/errors/business-rule-violation.error';
export interface HttpErrorMapping {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, ErrorDetailValue>>;
}

export type ErrorMapper = (error: unknown) => HttpErrorMapping | null;
