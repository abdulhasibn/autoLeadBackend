export interface UpdateOwnerCommand {
  readonly ownerId: string;
  readonly fullName: string;
  readonly phone: string;
  readonly email: string | null;
  readonly address: string | null;
  readonly city: string | null;
  readonly preferredContactMethod: string | null;
  readonly altPhone: string | null;
  readonly idInfo: string | null;
  readonly notes: string | null;
}
