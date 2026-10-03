import { Phone } from '../../../domain/shared/phone.value-object';
import type { UserId } from '../../../domain/shared/user-id';
import type { OwnerId } from './owner-id';

export const PREFERRED_CONTACT_METHODS = ['phone', 'email', 'whatsapp'] as const;

export type PreferredContactMethod = (typeof PREFERRED_CONTACT_METHODS)[number];

export interface OwnerCreateProps {
  readonly id: OwnerId;
  readonly fullName: string;
  readonly phone: Phone;
  readonly email: string | null;
  readonly address: string | null;
  readonly city: string | null;
  readonly preferredContactMethod: PreferredContactMethod | null;
  readonly altPhone: Phone | null;
  readonly idInfo: string | null;
  readonly notes: string | null;
  readonly createdBy: UserId | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface OwnerReconstituteProps extends OwnerCreateProps {
  readonly userId: UserId | null;
  readonly deletedAt: Date | null;
}

export interface OwnerProfileUpdate {
  readonly fullName: string;
  readonly phone: Phone;
  readonly email: string | null;
  readonly address: string | null;
  readonly city: string | null;
  readonly preferredContactMethod: PreferredContactMethod | null;
  readonly altPhone: Phone | null;
  readonly idInfo: string | null;
  readonly notes: string | null;
  readonly updatedAt: Date;
}

/**
 * Owner aggregate. Phone is the duplicate-detection key. Portal `userId`
 * linking is deferred — staff CRUD never sets it.
 */
export class Owner {
  private constructor(
    readonly id: OwnerId,
    readonly userId: UserId | null,
    private fullNameValue: string,
    private phoneValue: Phone,
    private emailValue: string | null,
    private addressValue: string | null,
    private cityValue: string | null,
    private preferredContactMethodValue: PreferredContactMethod | null,
    private altPhoneValue: Phone | null,
    private idInfoValue: string | null,
    private notesValue: string | null,
    readonly createdBy: UserId | null,
    readonly createdAt: Date,
    private updatedAtValue: Date,
    private deletedAtValue: Date | null,
  ) {}

  static create(props: OwnerCreateProps): Owner {
    return new Owner(
      props.id,
      null,
      normalizeFullName(props.fullName),
      props.phone,
      normalizeOptionalText(props.email),
      normalizeOptionalText(props.address),
      normalizeOptionalText(props.city),
      parsePreferredContactMethod(props.preferredContactMethod),
      props.altPhone,
      normalizeOptionalText(props.idInfo),
      normalizeOptionalText(props.notes),
      props.createdBy,
      props.createdAt,
      props.updatedAt,
      null,
    );
  }

  static reconstitute(props: OwnerReconstituteProps): Owner {
    return new Owner(
      props.id,
      props.userId,
      props.fullName,
      props.phone,
      props.email,
      props.address,
      props.city,
      parsePreferredContactMethod(props.preferredContactMethod),
      props.altPhone,
      props.idInfo,
      props.notes,
      props.createdBy,
      props.createdAt,
      props.updatedAt,
      props.deletedAt,
    );
  }

  get fullName(): string {
    return this.fullNameValue;
  }

  get phone(): Phone {
    return this.phoneValue;
  }

  get email(): string | null {
    return this.emailValue;
  }

  get address(): string | null {
    return this.addressValue;
  }

  get city(): string | null {
    return this.cityValue;
  }

  get preferredContactMethod(): PreferredContactMethod | null {
    return this.preferredContactMethodValue;
  }

  get altPhone(): Phone | null {
    return this.altPhoneValue;
  }

  get idInfo(): string | null {
    return this.idInfoValue;
  }

  get notes(): string | null {
    return this.notesValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get deletedAt(): Date | null {
    return this.deletedAtValue;
  }

  get isDeactivated(): boolean {
    return this.deletedAtValue !== null;
  }

  updateProfile(update: OwnerProfileUpdate): void {
    this.assertActive();
    this.fullNameValue = normalizeFullName(update.fullName);
    this.phoneValue = update.phone;
    this.emailValue = normalizeOptionalText(update.email);
    this.addressValue = normalizeOptionalText(update.address);
    this.cityValue = normalizeOptionalText(update.city);
    this.preferredContactMethodValue = parsePreferredContactMethod(update.preferredContactMethod);
    this.altPhoneValue = update.altPhone;
    this.idInfoValue = normalizeOptionalText(update.idInfo);
    this.notesValue = normalizeOptionalText(update.notes);
    this.updatedAtValue = update.updatedAt;
  }

  deactivate(at: Date): void {
    this.assertActive();
    this.deletedAtValue = at;
    this.updatedAtValue = at;
  }

  private assertActive(): void {
    if (this.deletedAtValue !== null) {
      throw new Error('Cannot modify a deactivated owner');
    }
  }
}

export function parsePreferredContactMethod(
  input: string | null | undefined,
): PreferredContactMethod | null {
  if (input === null || input === undefined) {
    return null;
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!PREFERRED_CONTACT_METHODS.includes(trimmed as PreferredContactMethod)) {
    throw new Error('Preferred contact method must be phone, email, or whatsapp');
  }
  return trimmed as PreferredContactMethod;
}

function normalizeFullName(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error('Full name cannot be empty');
  }
  return trimmed;
}

function normalizeOptionalText(input: string | null): string | null {
  if (input === null) {
    return null;
  }
  const trimmed = input.trim();
  return trimmed.length === 0 ? null : trimmed;
}
