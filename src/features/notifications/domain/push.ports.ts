import type { UserId } from '../../../domain/shared/user-id';

export type PushPlatform = 'ios' | 'android';

export interface PushDeviceRegistration {
  readonly userId: UserId;
  readonly token: string;
  readonly platform: PushPlatform;
  readonly enabled: boolean;
}

export interface IPushDeviceRepository {
  /**
   * Saves a device for a user. A token belongs to one user at a time: signing
   * in as someone else on the same phone moves it, so it never receives the
   * previous user's pushes.
   */
  upsert(registration: PushDeviceRegistration): Promise<void>;
  /** Forgets a device, for the caller only. */
  remove(userId: UserId, token: string): Promise<void>;
  /** Enabled device tokens per user, for the users that have any. */
  findEnabledTokens(userIds: readonly UserId[]): Promise<ReadonlyMap<string, readonly string[]>>;
  /** Drops tokens the push service reported as no longer valid. */
  removeTokens(tokens: readonly string[]): Promise<void>;
}

/** A notification that is due and not yet pushed. */
export interface PendingPush {
  readonly id: string;
  readonly userId: UserId;
  readonly type: string;
  readonly title: string;
  readonly body: string | null;
  readonly entityType: string | null;
  readonly entityId: string | null;
}

export interface IPendingPushRepository {
  /** Atomically marks due notifications as pushed and returns them. */
  claim(limit: number): Promise<readonly PendingPush[]>;
}

export interface PushMessage {
  readonly to: string;
  readonly title: string;
  readonly body: string | null;
  readonly data: Readonly<Record<string, string | null>>;
}

export interface PushSendReport {
  /** Tokens the provider says will never work again. */
  readonly invalidTokens: readonly string[];
}

export interface IPushSender {
  send(messages: readonly PushMessage[]): Promise<PushSendReport>;
}
