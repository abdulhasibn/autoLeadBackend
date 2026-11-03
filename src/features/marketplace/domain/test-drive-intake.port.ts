import type { UserId } from '../../../domain/shared/user-id';
import { toUserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';

/** Public writes are attributed to this user (seeded by the marketplace migration). */
export const WEBSITE_SYSTEM_USER_ID: UserId = toUserId('0b5e0000-0000-4000-8000-000000000001');

export interface ShowroomLocation {
  readonly name: string;
  readonly address: string;
  readonly city: string;
  readonly phone: string;
  readonly openingHours: unknown;
  readonly googleMapsUrl: string | null;
}

export interface TestDriveIntakeInput {
  readonly vehicleId: string;
  readonly fullName: string;
  /** E.164. */
  readonly phone: string;
  /** Keyed hash of the caller's IP, for rate limiting only. */
  readonly ipHash: string;
}

export interface TestDriveIntakeResult {
  readonly leadId: string;
  /** `updated` when the visitor already had an active lead on this vehicle. */
  readonly outcome: 'created' | 'updated';
  readonly vehicleAvailable: boolean;
  /** Set when the new lead was linked to the vehicle. */
  readonly linkedVehicleId: VehicleId | null;
  readonly showroom: ShowroomLocation | null;
}

/**
 * Records a test-drive request in one transaction: rate limit, contact lookup
 * (never overwriting a stored name), dedupe against an active lead on the same
 * vehicle, and notifying the assignee or every admin.
 */
export interface ITestDriveIntake {
  submit(input: TestDriveIntakeInput): Promise<TestDriveIntakeResult>;
}

/** Flips a Listed vehicle `open` → `linked` once a lead works it (ADR-0011). */
export interface IVehicleLinkSync {
  syncLinkState(vehicleId: VehicleId, hasActiveLeads: boolean, actorId: UserId): Promise<void>;
}
