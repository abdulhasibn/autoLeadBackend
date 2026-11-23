import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { isAdmin } from '../../../../domain/shared/role';
import { Phone } from '../../../../domain/shared/phone.value-object';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import type { ILeadRepository } from '../../domain/lead.repository';

export interface ContactLookupDto {
  /** True when a live contact already owns this phone. */
  readonly exists: boolean;
  /** Who it is: admins only. A salesperson sees only their own leads, so they get `null`. */
  readonly contact: { readonly id: string; readonly fullName: string } | null;
}

/**
 * Who already owns this phone? Lets the new-lead form say "this number belongs
 * to <name>" before saving, since an existing contact is reused, never renamed.
 */
export class LookupContactByPhoneUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: Pick<ILeadRepository, 'findLiveContactByPhone'>,
  ) {}

  async execute(phoneRaw: string, ctx: AuthenticatedContext): Promise<ContactLookupDto> {
    this.policy.requireStaff(ctx);
    const contact = await this.repo.findLiveContactByPhone(Phone.createIndianMobile(phoneRaw));
    if (contact === null) {
      return { exists: false, contact: null };
    }
    // Names only for admins, so a salesperson can't enumerate other people's contacts.
    return {
      exists: true,
      contact: isAdmin(ctx) ? { id: contact.id, fullName: contact.fullName } : null,
    };
  }
}
