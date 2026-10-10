import type { LeadReadModel } from '../../domain/lead.queries';
import type { Contact } from '../../domain/contact.entity';
import type { Lead } from '../../domain/lead.entity';

export type LeadDto = LeadReadModel;

export function toLeadDto(lead: Lead, contact: Contact): LeadDto {
  return {
    id: lead.id,
    showroomId: lead.showroomId,
    vehicleId: lead.vehicleId,
    linkedVehicle: null,
    assignedTo: lead.assignedTo,
    assignedToName: null,
    contactId: contact.id,
    contactFullName: contact.fullName,
    contactPhone: contact.phone.value,
    contactEmail: contact.email === null ? null : contact.email.value,
    source: lead.source.value,
    status: lead.status.value,
    budget: lead.budget,
    preferredVehicle: lead.preferredVehicle,
    preferredMakeId: lead.preferredCatalog.makeId,
    preferredMakeName: null,
    preferredModelId: lead.preferredCatalog.modelId,
    preferredModelName: null,
    preferredVariantId: lead.preferredCatalog.variantId,
    preferredVariantName: null,
    preferredColours: lead.preference.colours,
    preferredFuelTypes: lead.preference.fuelTypes,
    preferredTransmissions: lead.preference.transmissions,
    preferredBodyTypes: lead.preference.bodyTypes,
    preferredYearMin: lead.preference.yearMin,
    preferredYearMax: lead.preference.yearMax,
    preferredKmMax: lead.preference.kmMax,
    preferredMaxOwners: lead.preference.maxOwners,
    purchaseTimeline: lead.purchaseTimeline,
    financeRequired: lead.financeRequired,
    currentVehicle: lead.currentVehicle,
    tradeInRequired: lead.tradeInRequired,
    notes: lead.notes,
    nextFollowUp: null,
    createdBy: lead.createdBy,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}
