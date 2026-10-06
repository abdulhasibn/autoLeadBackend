export interface CreateLeadCommand {
  /** Defaults to the actor's home showroom; only admins may name another. */
  readonly showroomId: string | null;
  readonly fullName: string;
  readonly phone: string;
  readonly email: string | null;
  readonly source: string;
  readonly vehicleId: string | null;
  readonly budget: number | null;
  readonly preferredVehicle: string | null;
  /** Catalog interest; only the narrowest id is needed, parents are filled in. */
  readonly preferredMakeId: string | null;
  readonly preferredModelId: string | null;
  readonly preferredVariantId: string | null;
  readonly purchaseTimeline: string | null;
  readonly financeRequired: boolean | null;
  readonly currentVehicle: string | null;
  readonly tradeInRequired: boolean | null;
  readonly notes: string | null;
}
