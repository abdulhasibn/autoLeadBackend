import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import type { FinanceCipher } from '../../domain/finance-cipher.port';
import type { FinanceCrypto } from '../../domain/finance-crypto.port';
import { toFinanceSessionId, type FinanceSessionId } from '../../domain/finance-session-id';
import { FinanceSession } from '../../domain/finance-session.entity';
import type { IFinanceSessionRepository } from '../../domain/finance-session.repository';
import {
  CURRENT_KEY_VERSION,
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
} from '../../domain/finance.constants';
import { FinanceLockedError } from '../errors/finance-locked.error';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET = /^[A-Za-z0-9_-]{16,}$/;

export interface OpenedFinanceSession {
  readonly sessionId: FinanceSessionId;
  readonly cipher: FinanceCipher;
  readonly expiresAt: Date;
}

export interface StartedFinanceSession {
  readonly sessionToken: string;
  readonly expiresAt: Date;
}

interface ParsedToken {
  readonly sessionId: FinanceSessionId;
  readonly secret: string;
}

/**
 * Turns a session token (`<sessionId>.<secret>`) into a cipher for the
 * unlocked data key. It is the only way a use case gets a FinanceCipher, so a
 * locked finance can't be bypassed (ADR-0014).
 */
export class FinanceSessionService {
  constructor(
    private readonly sessions: IFinanceSessionRepository,
    private readonly crypto: FinanceCrypto,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  /** Creates a session for an unwrapped data key and returns its token. */
  async start(ctx: AuthenticatedContext, dataKey: Uint8Array): Promise<StartedFinanceSession> {
    const now = this.clock.now();
    await this.sessions.deleteExpired(now);

    const sessionId = toFinanceSessionId(this.ids.generate());
    const secret = this.crypto.newSessionSecret();
    const sessionKek = this.crypto.deriveSessionKek(secret, sessionId);
    const session = FinanceSession.start({
      id: sessionId,
      userId: ctx.userId,
      wrappedKey: this.crypto.wrapKey(sessionKek, dataKey, sessionAad(sessionId)),
      now,
      idleMs: SESSION_IDLE_MS,
      absoluteMs: SESSION_ABSOLUTE_MS,
    });
    sessionKek.fill(0);

    await this.sessions.save(session);
    return { sessionToken: `${sessionId}.${secret}`, expiresAt: session.expiresAt };
  }

  /**
   * Validates the token, slides the idle expiry and returns a cipher.
   * Throws FinanceLockedError when the session is missing, expired or not the caller's.
   */
  async open(ctx: AuthenticatedContext, token: string | null): Promise<OpenedFinanceSession> {
    const parsed = parseToken(token);
    if (parsed === null) {
      throw new FinanceLockedError();
    }

    const now = this.clock.now();
    const session = await this.sessions.findById(parsed.sessionId);
    if (session === null || !session.belongsTo(ctx.userId)) {
      throw new FinanceLockedError();
    }
    if (session.isExpired(now)) {
      await this.sessions.delete(session.id);
      throw new FinanceLockedError('Finance session has expired. Enter the finance key again.');
    }

    const dataKey = this.unwrap(session, parsed.secret);
    if (dataKey === null) {
      throw new FinanceLockedError();
    }

    session.touch(now, SESSION_IDLE_MS);
    await this.sessions.save(session);
    return {
      sessionId: session.id,
      cipher: this.crypto.cipherFor(dataKey, CURRENT_KEY_VERSION),
      expiresAt: session.idleExpiresAt,
    };
  }

  /** Returns when the session would lock, without extending it; null when not unlocked. */
  async peek(ctx: AuthenticatedContext, token: string | null): Promise<Date | null> {
    const parsed = parseToken(token);
    if (parsed === null) {
      return null;
    }
    const session = await this.sessions.findById(parsed.sessionId);
    if (session === null || !session.belongsTo(ctx.userId) || session.isExpired(this.clock.now())) {
      return null;
    }
    const dataKey = this.unwrap(session, parsed.secret);
    if (dataKey === null) {
      return null;
    }
    dataKey.fill(0);
    return session.idleExpiresAt;
  }

  /** Ends the caller's session if the token names one. Returns true when one was ended. */
  async end(ctx: AuthenticatedContext, token: string | null): Promise<boolean> {
    const parsed = parseToken(token);
    if (parsed === null) {
      return false;
    }
    const session = await this.sessions.findById(parsed.sessionId);
    if (session === null || !session.belongsTo(ctx.userId)) {
      return false;
    }
    await this.sessions.delete(session.id);
    return true;
  }

  private unwrap(session: FinanceSession, secret: string): Uint8Array | null {
    const sessionKek = this.crypto.deriveSessionKek(secret, session.id);
    const dataKey = this.crypto.unwrapKey(sessionKek, session.wrappedKey, sessionAad(session.id));
    sessionKek.fill(0);
    return dataKey;
  }
}

function parseToken(token: string | null): ParsedToken | null {
  if (token === null) {
    return null;
  }
  const separator = token.indexOf('.');
  if (separator < 0) {
    return null;
  }
  const sessionId = token.slice(0, separator);
  const secret = token.slice(separator + 1);
  if (!UUID.test(sessionId) || !SECRET.test(secret)) {
    return null;
  }
  return { sessionId: toFinanceSessionId(sessionId), secret };
}

function sessionAad(sessionId: FinanceSessionId): string {
  return `finance_sessions:${sessionId}`;
}
