import { describe, expect, it } from 'vitest';

import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import { toLeadId } from '../../../domain/shared/lead-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { type VehicleId, toVehicleId } from '../../../domain/shared/vehicle-id';
import { toContactId } from '../domain/contact-id';
import { InvalidLeadStatusTransitionError } from '../domain/errors/invalid-lead-status-transition.error';
import { Lead } from '../domain/lead.entity';
import { LeadSource } from '../domain/lead-source.value-object';
import { LeadStatus } from '../domain/lead-status.value-object';

const NOW = new Date('2026-10-03T00:00:00.000Z');
const VEHICLE_ID = toVehicleId('33333333-3333-4333-8333-333333333333');

function makeLead(vehicleId: VehicleId | null = null): Lead {
  return Lead.create({
    id: toLeadId('77777777-7777-4777-8777-777777777777'),
    showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
    contactId: toContactId('66666666-6666-4666-8666-666666666666'),
    vehicleId,
    assignedTo: null,
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
    const lead = makeLead(VEHICLE_ID);
    expect(() => lead.changeStatus(LeadStatus.create('converted'), NOW)).toThrow(
      InvalidLeadStatusTransitionError,
    );
  });

  it('requires a vehicle to book', () => {
    const lead = makeLead();
    expect(() => lead.changeStatus(LeadStatus.create('booking_confirmed'), NOW)).toThrow(
      expect.objectContaining({ code: 'LEAD_REQUIRES_VEHICLE' }),
    );
  });

  it('refuses vehicle_unavailable as a manual status', () => {
    const lead = makeLead(VEHICLE_ID);
    expect(() => lead.changeStatus(LeadStatus.create('vehicle_unavailable'), NOW)).toThrow(
      expect.objectContaining({ code: 'LEAD_STATUS_SYSTEM_MANAGED' }),
    );
  });

  it('marks the vehicle unavailable and releases it', () => {
    const lead = makeLead(VEHICLE_ID);
    lead.markVehicleUnavailable(NOW);
    expect(lead.status.value).toBe('vehicle_unavailable');
    expect(lead.vehicleId).toBeNull();
  });

  it('lets a vehicle_unavailable lead link a new vehicle and be revived', () => {
    const lead = makeLead(VEHICLE_ID);
    lead.markVehicleUnavailable(NOW);
    lead.associateVehicle(toVehicleId('44444444-4444-4444-8444-444444444444'), NOW);
    lead.changeStatus(LeadStatus.create('booking_confirmed'), NOW);
    expect(lead.status.value).toBe('booking_confirmed');
  });

  it('unlinks its vehicle without changing status', () => {
    const lead = makeLead(VEHICLE_ID);
    lead.unlinkVehicle(NOW);
    expect(lead.vehicleId).toBeNull();
    expect(lead.status.value).toBe('new');
  });

  it('refuses a vehicle on a closed lead', () => {
    const lead = makeLead();
    lead.changeStatus(LeadStatus.create('lost'), NOW);
    expect(() =>
      lead.associateVehicle(toVehicleId('33333333-3333-4333-8333-333333333333'), NOW),
    ).toThrow('closed lead');
  });

  it('starts unassigned without an assignee change', () => {
    const lead = makeLead();
    expect(lead.assignedTo).toBeNull();
    expect(lead.hasAssigneeChanged).toBe(false);
  });

  it('assigns, reassigns, and clears the assignee', () => {
    const lead = makeLead();
    const later = new Date('2026-10-04T00:00:00.000Z');
    lead.assign(toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), later);
    expect(lead.assignedTo).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    expect(lead.hasAssigneeChanged).toBe(true);
    expect(lead.updatedAt).toBe(later);
    lead.assign(null, later);
    expect(lead.assignedTo).toBeNull();
  });

  it('refuses to assign a closed lead with a typed business-rule error', () => {
    const lead = makeLead();
    lead.changeStatus(LeadStatus.create('lost'), NOW);
    expect(() => lead.assign(toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), NOW)).toThrow(
      BusinessRuleViolationError,
    );
  });

  describe('removeVehicle', () => {
    it('clears the vehicle of an open lead', () => {
      const lead = makeLead(VEHICLE_ID);
      lead.removeVehicle(NOW);
      expect(lead.vehicleId).toBeNull();
    });

    it('keeps a booked lead on its vehicle', () => {
      const lead = makeLead(VEHICLE_ID);
      lead.changeStatus(LeadStatus.create('booking_confirmed'), NOW);
      expect(() => lead.removeVehicle(NOW)).toThrow(
        expect.objectContaining({ code: 'LEAD_REQUIRES_VEHICLE' }),
      );
    });

    it('rejects a closed lead', () => {
      const lead = makeLead(VEHICLE_ID);
      lead.changeStatus(LeadStatus.create('lost'), NOW);
      expect(() => lead.removeVehicle(NOW)).toThrow(
        expect.objectContaining({ code: 'LEAD_CLOSED' }),
      );
    });
  });

  describe('updateDetails', () => {
    const details = {
      contactId: toContactId('55555555-5555-4555-8555-555555555555'),
      source: LeadSource.create('referral'),
      budget: 800000,
      purchaseTimeline: ' this month ',
      financeRequired: true,
      currentVehicle: null,
      tradeInRequired: false,
      notes: '   ',
    };

    it('replaces the editable fields', () => {
      const lead = makeLead();
      const later = new Date('2026-10-04T00:00:00.000Z');
      lead.updateDetails(details, later);
      expect(lead.contactId).toBe('55555555-5555-4555-8555-555555555555');
      expect(lead.source.value).toBe('referral');
      expect(lead.budget).toBe(800000);
      expect(lead.purchaseTimeline).toBe('this month');
      expect(lead.notes).toBeNull();
      expect(lead.updatedAt).toEqual(later);
    });

    it('rejects a closed lead', () => {
      const lead = makeLead();
      lead.changeStatus(LeadStatus.create('lost'), NOW);
      expect(() => lead.updateDetails(details, NOW)).toThrow(
        expect.objectContaining({ code: 'LEAD_CLOSED' }),
      );
    });
  });
});
