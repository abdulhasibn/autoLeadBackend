import { describe, expect, it } from 'vitest';

import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { toContactId } from '../domain/contact-id';
import { InvalidLeadStatusTransitionError } from '../domain/errors/invalid-lead-status-transition.error';
import { Lead } from '../domain/lead.entity';
import { toLeadId } from '../domain/lead-id';
import { LeadSource } from '../domain/lead-source.value-object';
import { LeadStatus } from '../domain/lead-status.value-object';

const NOW = new Date('2026-10-03T00:00:00.000Z');

function makeLead(): Lead {
  return Lead.create({
    id: toLeadId('77777777-7777-4777-8777-777777777777'),
    showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
    contactId: toContactId('66666666-6666-4666-8666-666666666666'),
    vehicleId: null,
    source: LeadSource.create('phone'),
    budget: null,
    preferredVehicle: null,
    purchaseTimeline: null,
    financeRequired: null,
    currentVehicle: null,
    tradeInRequired: null,
    notes: '  walk-in  ',
    createdBy: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe('Lead entity', () => {
  it('starts as new and writes history', () => {
    const lead = makeLead();
    expect(lead.status.value).toBe('new');
    expect(lead.hasStatusChanged).toBe(true);
    expect(lead.notes).toBe('walk-in');
  });

  it('associates a vehicle', () => {
    const lead = makeLead();
    lead.associateVehicle(toVehicleId('33333333-3333-4333-8333-333333333333'), NOW);
    expect(lead.vehicleId).toBe('33333333-3333-4333-8333-333333333333');
  });

  it('rejects an invalid status jump', () => {
    const lead = makeLead();
    expect(() => lead.changeStatus(LeadStatus.create('interested'), NOW)).toThrow(
      InvalidLeadStatusTransitionError,
    );
  });

  it('refuses a vehicle on a closed lead', () => {
    const lead = makeLead();
    lead.changeStatus(LeadStatus.create('lost'), NOW);
    expect(() =>
      lead.associateVehicle(toVehicleId('33333333-3333-4333-8333-333333333333'), NOW),
    ).toThrow('closed lead');
  });
});
