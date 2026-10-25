import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '@qc/contracts';
import { auditActor } from './audit';

const entry = (over: Partial<AuditEntry> & Record<string, unknown> = {}) => ({
  id: '1',
  actorName: null,
  action: 'venue.update',
  entityType: 'venue',
  entityId: null,
  scopeType: 'national' as const,
  cityId: null,
  venueId: null,
  createdAt: '2027-02-10T05:00:00Z',
  ...over,
});

describe('auditActor', () => {
  it('names the person when the API gives a name', () => {
    expect(auditActor(entry({ actorName: 'Test Coordinator' }))).toEqual({
      kind: 'name',
      name: 'Test Coordinator',
    });
    expect(auditActor(entry({ actorName: '  Test Admin  ' }))).toEqual({
      kind: 'name',
      name: 'Test Admin',
    });
  });

  it('says a person has no name, never "System", when the contract gives only a null name', () => {
    // Every audit row has an actor today, so a null name is a person without one.
    expect(auditActor(entry({ actorName: null }))).toEqual({ kind: 'unnamed' });
    expect(auditActor(entry({ actorName: '   ' }))).toEqual({ kind: 'unnamed' });
  });

  it('shows the masked number when the API sends one and there is no name', () => {
    expect(auditActor(entry({ actorName: null, actorPhoneLast4: '4567' }))).toEqual({
      kind: 'phone',
      phone: '4567',
    });
    expect(auditActor(entry({ actorName: null, actorPhoneLast4: null }))).toEqual({
      kind: 'unnamed',
    });
  });

  it('prefers the name over the number', () => {
    expect(auditActor(entry({ actorName: 'Test Admin', actorPhoneLast4: '4567' }))).toEqual({
      kind: 'name',
      name: 'Test Admin',
    });
  });

  it('says "System" only for a row the API marks as system work', () => {
    expect(auditActor(entry({ actorName: null, actorKind: 'system' }))).toEqual({
      kind: 'system',
    });
    expect(auditActor(entry({ actorName: null, actorKind: 'person' }))).toEqual({
      kind: 'unnamed',
    });
  });
});
