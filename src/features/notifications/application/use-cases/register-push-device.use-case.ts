import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { IPushDeviceRepository, PushPlatform } from '../../domain/push.ports';
import type { NotificationInboxPolicy } from '../policies/notification-inbox.policy';

export interface RegisterPushDeviceInput {
  readonly token: string;
  readonly platform: PushPlatform;
  readonly enabled: boolean;
}

/** Saves this device's push token, or switches its pushes on or off. */
export class RegisterPushDeviceUseCase {
  constructor(
    private readonly policy: NotificationInboxPolicy,
    private readonly devices: IPushDeviceRepository,
  ) {}

  async execute(input: RegisterPushDeviceInput, ctx: AuthenticatedContext): Promise<void> {
    this.policy.requireStaff(ctx);
    await this.devices.upsert({ userId: ctx.userId, ...input });
  }
}
