export interface HttpErrorMapping {
  readonly status: number;
  readonly code: string;
  readonly message: string;
}

export type ErrorMapper = (error: unknown) => HttpErrorMapping | null;
