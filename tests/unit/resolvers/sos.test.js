import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphQLError } from 'graphql';

vi.mock('../../../src/models/SosEvent.js', () => ({
  default: {
    create: vi.fn(),
    find: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));
vi.mock('../../../src/models/Notification.js', () => ({
  default: { create: vi.fn().mockResolvedValue({}) },
}));
vi.mock('../../../src/models/User.js', () => ({
  default: { findById: vi.fn() },
}));

import { sosResolvers } from '../../../src/resolvers/sos.resolver.js';
import SosEvent from '../../../src/models/SosEvent.js';

const user = { _id: 'uid1', role: 'victim' };
const admin = { _id: 'admin1', role: 'admin' };
const ctx = (u = user) => ({ user: u });

const makeSos = (overrides = {}) => ({
  _id: 'sos1',
  triggeredBy: { _id: 'uid1' },
  emergencyNumber: '911',
  status: 'triggered',
  save: vi.fn().mockResolvedValue(true),
  populate: vi.fn().mockResolvedValue({ _id: 'sos1' }),
  ...overrides,
});

describe('sosResolvers.Query.sosHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(sosResolvers.Query.sosHistory(null, null, ctx(null))).rejects.toThrow(GraphQLError);
  });

  it('returns SOS history for authenticated user', async () => {
    const chainable = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      then: (r) => r([makeSos()]),
    };
    SosEvent.find.mockReturnValue(chainable);
    const result = await sosResolvers.Query.sosHistory(null, null, ctx());
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('sosResolvers.Mutation.triggerSOS', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(sosResolvers.Mutation.triggerSOS(null, {}, ctx(null))).rejects.toThrow(GraphQLError);
  });

  it('creates SOS event without location', async () => {
    const sos = makeSos();
    SosEvent.create.mockResolvedValue(sos);
    const result = await sosResolvers.Mutation.triggerSOS(null, {}, ctx());
    expect(result.sosEventId).toBe('sos1');
    expect(result.emergencyNumber).toBe('911');
    expect(sos.status).toBe('services_notified');
  });

  it('creates SOS event with location', async () => {
    const sos = makeSos();
    SosEvent.create.mockResolvedValue(sos);
    await sosResolvers.Mutation.triggerSOS(null, { latitude: 51.5, longitude: -0.1 }, ctx());
    expect(SosEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        location: { type: 'Point', coordinates: [-0.1, 51.5] },
      })
    );
  });
});

describe('sosResolvers.Mutation.resolveSOS', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws FORBIDDEN for non-admin', async () => {
    await expect(sosResolvers.Mutation.resolveSOS(null, { id: 's1' }, ctx())).rejects.toThrow(GraphQLError);
  });

  it('throws NOT_FOUND when SOS event missing', async () => {
    SosEvent.findByIdAndUpdate.mockReturnValue({
      populate: vi.fn().mockResolvedValue(null),
    });
    await expect(sosResolvers.Mutation.resolveSOS(null, { id: 's1' }, ctx(admin))).rejects.toThrow(GraphQLError);
  });

  it('resolves SOS event', async () => {
    const sos = makeSos({ status: 'resolved' });
    SosEvent.findByIdAndUpdate.mockReturnValue({
      populate: vi.fn().mockResolvedValue(sos),
    });
    const result = await sosResolvers.Mutation.resolveSOS(null, { id: 'sos1', notes: 'Resolved' }, ctx(admin));
    expect(result.status).toBe('resolved');
  });
});
