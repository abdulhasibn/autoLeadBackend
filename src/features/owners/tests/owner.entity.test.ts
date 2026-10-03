import { describe, expect, it } from 'vitest';

import { Phone } from '../../../domain/shared/phone.value-object';
import { toUserId } from '../../../domain/shared/user-id';
import { Owner, parsePreferredContactMethod } from '../domain/owner.entity';
import { toOwnerId } from '../domain/owner-id';

const CREATED_AT = new Date('2026-09-14T00:00:00.000Z');
const CREATED_BY = toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

function makeOwner(): Owner {
  return Owner.create({
    id: toOwnerId('22222222-2222-4222-8222-222222222222'),
    fullName: '  Priya Shah  ',
    phone: Phone.create('+919876543210'),
    email: ' priya@example.com ',
    address: '  12 MG Road  ',
    city: '  Bengaluru  ',
    preferredContactMethod: 'whatsapp',
    altPhone: Phone.create('+919876543211'),
    idInfo: '  AADHAAR-1  ',
    notes: '  walk-in  ',
    createdBy: CREATED_BY,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });
}

describe('Owner entity', () => {
  it('trims profile fields on create', () => {
    const owner = makeOwner();
    expect(owner.fullName).toBe('Priya Shah');
    expect(owner.email).toBe('priya@example.com');
    expect(owner.address).toBe('12 MG Road');
    expect(owner.city).toBe('Bengaluru');
    expect(owner.idInfo).toBe('AADHAAR-1');
    expect(owner.notes).toBe('walk-in');
    expect(owner.userId).toBeNull();
    expect(owner.preferredContactMethod).toBe('whatsapp');
  });

  it('rejects an empty full name', () => {
    expect(() =>
      Owner.create({
        id: toOwnerId('22222222-2222-4222-8222-222222222222'),
        fullName: '   ',
        phone: Phone.create('+919876543210'),
        email: null,
        address: null,
        city: null,
        preferredContactMethod: null,
        altPhone: null,
        idInfo: null,
        notes: null,
        createdBy: CREATED_BY,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      }),
    ).toThrow('Full name cannot be empty');
  });

  it('rejects an invalid preferred contact method', () => {
    expect(() => parsePreferredContactMethod('sms')).toThrow(
      'Preferred contact method must be phone, email, or whatsapp',
    );
  });

  it('updates the profile', () => {
    const owner = makeOwner();
    const at = new Date('2026-09-14T12:00:00.000Z');
    owner.updateProfile({
      fullName: 'Priya S.',
      phone: Phone.create('+919876543219'),
      email: null,
      address: null,
      city: 'Mumbai',
      preferredContactMethod: 'phone',
      altPhone: null,
      idInfo: null,
      notes: null,
      updatedAt: at,
    });
    expect(owner.fullName).toBe('Priya S.');
    expect(owner.phone.value).toBe('+919876543219');
    expect(owner.city).toBe('Mumbai');
    expect(owner.preferredContactMethod).toBe('phone');
    expect(owner.updatedAt).toEqual(at);
  });

  it('deactivates an owner', () => {
    const owner = makeOwner();
    const at = new Date('2026-09-14T12:00:00.000Z');
    owner.deactivate(at);
    expect(owner.isDeactivated).toBe(true);
    expect(owner.deletedAt).toEqual(at);
  });

  it('refuses profile updates after deactivation', () => {
    const owner = makeOwner();
    owner.deactivate(CREATED_AT);
    expect(() =>
      owner.updateProfile({
        fullName: 'Priya',
        phone: Phone.create('+919876543210'),
        email: null,
        address: null,
        city: null,
        preferredContactMethod: null,
        altPhone: null,
        idInfo: null,
        notes: null,
        updatedAt: CREATED_AT,
      }),
    ).toThrow('deactivated');
  });
});
