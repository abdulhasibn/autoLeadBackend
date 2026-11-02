import type { FinanceSessionId } from './finance-session-id';
import type { FinanceSession } from './finance-session.entity';

/** Command-side persistence for finance unlock sessions. */
export interface IFinanceSessionRepository {
  findById(id: FinanceSessionId): Promise<FinanceSession | null>;
  /** Inserts or updates the session by id. */
  save(session: FinanceSession): Promise<void>;
  delete(id: FinanceSessionId): Promise<void>;
  deleteAll(): Promise<void>;
  deleteAllExcept(id: FinanceSessionId): Promise<void>;
  deleteExpired(now: Date): Promise<void>;
}
