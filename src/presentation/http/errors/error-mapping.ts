export interface HttpErrorMapping {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, string | number>>;
}

export type ErrorMapper = (error: unknown) => HttpErrorMapping | null;
