import type { OwnerReadModel } from '../../domain/owner.queries';
import type { Owner } from '../../domain/owner.entity';

export type OwnerDto = OwnerReadModel;

export function toOwnerDto(owner: Owner): OwnerDto {
  return {
    id: owner.id,
    userId: owner.userId,
    fullName: owner.fullName,
    phone: owner.phone.value,
    email: owner.email,
    address: owner.address,
    city: owner.city,
    preferredContactMethod: owner.preferredContactMethod,
    altPhone: owner.altPhone === null ? null : owner.altPhone.value,
    idInfo: owner.idInfo,
    notes: owner.notes,
    createdBy: owner.createdBy,
    createdAt: owner.createdAt.toISOString(),
    updatedAt: owner.updatedAt.toISOString(),
  };
}
