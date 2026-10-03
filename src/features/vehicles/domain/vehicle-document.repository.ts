import type { DocumentId } from './document-id';
import type { VehicleDocument } from './vehicle-document.entity';

export interface IVehicleDocumentRepository {
  findById(id: DocumentId): Promise<VehicleDocument | null>;
  save(document: VehicleDocument): Promise<void>;
  delete(id: DocumentId): Promise<void>;
}
