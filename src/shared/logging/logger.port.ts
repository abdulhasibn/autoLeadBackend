/**
 * The only logging type Presentation/Application code may depend on.
 */
export interface LogContext {
  readonly [key: string]: unknown;
}

export interface Logger {
  info(context: LogContext, message: string): void;
  info(message: string): void;
  warn(context: LogContext, message: string): void;
  warn(message: string): void;
  error(context: LogContext, message: string): void;
  error(message: string): void;
  child(bindings: LogContext): Logger;
}
