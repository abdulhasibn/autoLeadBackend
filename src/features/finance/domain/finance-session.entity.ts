import type { UserId } from '../../../domain/shared/user-id';
import type { FinanceSessionId } from './finance-session-id';

export interface FinanceSessionProps {
  readonly id: FinanceSessionId;
  readonly userId: UserId;
  /** The data key wrapped by a key derived from the client's session secret. */
  readonly wrappedKey: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
  readonly idleExpiresAt: Date;
  readonly expiresAt: Date;
}

/**
 * One unlock of the finance vault by one admin. Expires after a period of
 * inactivity or a fixed lifetime, whichever comes first.
 */
export class FinanceSession {
  private constructor(private props: FinanceSessionProps) {}

  static start(input: {
    id: FinanceSessionId;
    userId: UserId;
    wrappedKey: string;
    now: Date;
    idleMs: number;
    absoluteMs: number;
  }): FinanceSession {
    const expiresAt = new Date(input.now.getTime() + input.absoluteMs);
    return new FinanceSession({
      id: input.id,
      userId: input.userId,
      wrappedKey: input.wrappedKey,
      createdAt: input.now,
      lastUsedAt: input.now,
      idleExpiresAt: earlier(new Date(input.now.getTime() + input.idleMs), expiresAt),
      expiresAt,
    });
  }

  static reconstitute(props: FinanceSessionProps): FinanceSession {
    return new FinanceSession(props);
  }

  get id(): FinanceSessionId {
    return this.props.id;
  }
  get userId(): UserId {
    return this.props.userId;
  }
  get wrappedKey(): string {
    return this.props.wrappedKey;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get lastUsedAt(): Date {
    return this.props.lastUsedAt;
  }
  get idleExpiresAt(): Date {
    return this.props.idleExpiresAt;
  }
  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  belongsTo(userId: UserId): boolean {
    return this.props.userId === userId;
  }

  isExpired(now: Date): boolean {
    return (
      now.getTime() >= this.props.idleExpiresAt.getTime() ||
      now.getTime() >= this.props.expiresAt.getTime()
    );
  }

  /** Slides the idle expiry forward, never past the fixed lifetime. */
  touch(now: Date, idleMs: number): void {
    this.props = {
      ...this.props,
      lastUsedAt: now,
      idleExpiresAt: earlier(new Date(now.getTime() + idleMs), this.props.expiresAt),
    };
  }
}

function earlier(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}
