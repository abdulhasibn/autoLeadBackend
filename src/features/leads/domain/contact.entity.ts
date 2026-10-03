import { Email } from '../../../domain/shared/email.value-object';
import { Phone } from '../../../domain/shared/phone.value-object';
import type { UserId } from '../../../domain/shared/user-id';
import type { ContactId } from './contact-id';

export interface ContactCreateProps {
  readonly id: ContactId;
  readonly fullName: string;
  readonly phone: Phone;
  readonly email: Email | null;
  readonly createdBy: UserId | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ContactReconstituteProps extends ContactCreateProps {
  readonly deletedAt: Date | null;
}

export class Contact {
  private constructor(
    readonly id: ContactId,
    private fullNameValue: string,
    readonly phone: Phone,
    private emailValue: Email | null,
    readonly createdBy: UserId | null,
    readonly createdAt: Date,
    private updatedAtValue: Date,
    private deletedAtValue: Date | null,
  ) {}

  static create(props: ContactCreateProps): Contact {
    return new Contact(
      props.id,
      normalizeFullName(props.fullName),
      props.phone,
      props.email,
      props.createdBy,
      props.createdAt,
      props.updatedAt,
      null,
    );
  }

  static reconstitute(props: ContactReconstituteProps): Contact {
    return new Contact(
      props.id,
      props.fullName,
      props.phone,
      props.email,
      props.createdBy,
      props.createdAt,
      props.updatedAt,
      props.deletedAt,
    );
  }

  get fullName(): string {
    return this.fullNameValue;
  }

  get email(): Email | null {
    return this.emailValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get deletedAt(): Date | null {
    return this.deletedAtValue;
  }

  refreshProfile(fullName: string, email: Email | null, at: Date): void {
    if (this.deletedAtValue !== null) {
      throw new Error('Cannot modify a deleted contact');
    }
    this.fullNameValue = normalizeFullName(fullName);
    this.emailValue = email;
    this.updatedAtValue = at;
  }
}

function normalizeFullName(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error('Full name cannot be empty');
  }
  return trimmed;
}
