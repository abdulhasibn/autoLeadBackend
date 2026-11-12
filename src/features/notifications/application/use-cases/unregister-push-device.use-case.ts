import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { IPushDeviceRepository } from '../../domain/push.ports';
import type { NotificationInboxPolicy } from '../policies/notification-inbox.policy';

/** Forgets this device, e.g. on sign-out. Other devices keep working. */
export class UnregisterPushDeviceUseCase {
  constructor(
    private readonly policy: NotificationInboxPolicy,
    private readonly devices: IPushDeviceRepository,
  ) {}

  async execute(token: string, ctx: AuthenticatedContext): Promise<void> {
    this.policy.requireStaff(ctx);
    await this.devices.remove(ctx.userId, token);
  }
}
