import { describe, expect, it } from 'vitest';

import { phoneSchema as leadPhone } from '../../features/leads/presentation/schemas/lead-fields.schemas';
import {
  optionalPhoneSchema as ownerAltPhone,
  phoneSchema as ownerPhone,
} from '../../features/owners/presentation/schemas/owner-fields.schemas';
import { phoneSchema as staffPhone } from '../../features/users/presentation/schemas/staff-fields.schemas';

describe('staff-entered phone schemas (leads, owners, staff)', () => {
  const cases = { lead: leadPhone, owner: ownerPhone, staff: staffPhone };

  for (const [name, schema] of Object.entries(cases)) {
    it(`${name}: accepts an Indian mobile`, () => {
      expect(schema.safeParse('+919876543210').success).toBe(true);
    });

    it(`${name}: rejects a non-mobile with the 10-digit message`, () => {
      const result = schema.safeParse('+911234567890');
      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.issues)).toContain('10-digit mobile');
    });
  }

  it('lead: normalises a plain 10-digit number', () => {
    expect(leadPhone.parse('98765 43210')).toBe('+919876543210');
  });

  it('owner altPhone: optional, but a given value must be an Indian mobile', () => {
    expect(ownerAltPhone.safeParse(null).success).toBe(true);
    expect(ownerAltPhone.parse('+919876543210')).toBe('+919876543210');
    expect(ownerAltPhone.safeParse('+14155550123').success).toBe(false);
  });
});
