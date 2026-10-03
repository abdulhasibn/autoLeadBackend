import { describe, expect, it } from 'vitest';

import { LeadStatus } from '../domain/lead-status.value-object';

describe('LeadStatus', () => {
  it('allows the happy-path transition', () => {
    expect(LeadStatus.create('new').canTransitionTo(LeadStatus.create('contacted'))).toBe(true);
    expect(LeadStatus.create('contacted').canTransitionTo(LeadStatus.create('interested'))).toBe(
      true,
    );
  });

  it('blocks skipping a stage', () => {
    expect(LeadStatus.create('new').canTransitionTo(LeadStatus.create('interested'))).toBe(false);
  });

  it('treats sold as terminal', () => {
    expect(LeadStatus.create('sold').isTerminal()).toBe(true);
    expect(LeadStatus.create('sold').canTransitionTo(LeadStatus.create('lost'))).toBe(false);
  });
});
