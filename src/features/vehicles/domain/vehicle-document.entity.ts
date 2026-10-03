import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { DocumentId } from './document-id';
import type { DocumentType } from './document-type.value-object';
import type { VehicleObjectPath } from './vehicle-object-path.value-object';

export interface VehicleDocumentProps {
  readonly id: DocumentId;
  readonly vehicleId: VehicleId;
  readonly storagePath: VehicleObjectPath;
  readonly docType: DocumentType;
  readonly uploadedBy: UserId;
  readonly uploadedAt: Date;
}

export class VehicleDocument {
  private constructor(
    readonly id: DocumentId,
    readonly vehicleId: VehicleId,
    readonly storagePath: VehicleObjectPath,
    readonly docType: DocumentType,
    readonly isSensitive: boolean,
    readonly uploadedBy: UserId,
    readonly uploadedAt: Date,
  ) {}

  static create(props: VehicleDocumentProps): VehicleDocument {
    return new VehicleDocument(
      props.id,
      props.vehicleId,
      props.storagePath,
      props.docType,
      true,
      props.uploadedBy,
      props.uploadedAt,
    );
  }

  static reconstitute(
    props: VehicleDocumentProps & { readonly isSensitive: boolean },
  ): VehicleDocument {
    return new VehicleDocument(
      props.id,
      props.vehicleId,
      props.storagePath,
      props.docType,
      props.isSensitive,
      props.uploadedBy,
      props.uploadedAt,
    );
  }
}
