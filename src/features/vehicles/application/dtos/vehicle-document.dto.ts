import type { VehicleDocumentReadModel } from '../../domain/vehicle-document.queries';

export interface VehicleDocumentDto extends VehicleDocumentReadModel {
  readonly url: string;
  readonly urlExpiresAt: string;
}
