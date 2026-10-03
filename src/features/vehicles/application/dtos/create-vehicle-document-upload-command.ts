export interface CreateVehicleDocumentUploadCommand {
  readonly vehicleId: string;
  readonly docType: string;
  readonly contentType: string;
}
