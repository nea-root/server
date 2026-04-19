import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphQLError } from 'graphql';
import { mockQuery } from '../../helpers/chainable.js';

vi.mock('../../../src/models/Review.js', () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock('../../../src/models/Appointment.js', () => ({
  default: { findById: vi.fn() },
}));
vi.mock('../../../src/models/User.js', () => ({
  default: { findById: vi.fn() },
}));

import { reviewResolvers } from '../../../src/resolvers/review.resolver.js';
import Review from '../../../src/models/Review.js';
import Appointment from '../../../src/models/Appointment.js';

const victim = { _id: 'uid1', role: 'victim' };
const ctx = (u = victim) => ({ user: u });

const makeAppt = (overrides = {}) => ({
  _id: 'appt1',
  client: { toString: () => 'uid1' },
  status: 'completed',
  ...overrides,
});

describe('reviewResolvers.Query.reviews', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(
      reviewResolvers.Query.reviews(null, { professionalId: 'p1' }, ctx(null))
    ).rejects.toThrow(GraphQLError);
  });

  it('returns professional reviews', async () => {
    Review.find.mockReturnValue(mockQuery([{ _id: 'r1', rating: 5, isAnonymous: true }]));
    const result = await reviewResolvers.Query.reviews(null, { professionalId: 'p1' }, ctx());
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('reviewResolvers.Mutation.createReview', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws FORBIDDEN for non-victim', async () => {
    await expect(
      reviewResolvers.Mutation.createReview(
        null, { professionalId: 'p1', appointmentId: 'a1', rating: 5 }, ctx({ _id: 'x', role: 'lawyer' })
      )
    ).rejects.toThrow(GraphQLError);
  });

  it('throws for invalid appointment', async () => {
    Appointment.findById.mockResolvedValue(null);
    await expect(
      reviewResolvers.Mutation.createReview(
        null, { professionalId: 'p1', appointmentId: 'a1', rating: 5 }, ctx()
      )
    ).rejects.toThrow(GraphQLError);
  });

  it('throws when appointment belongs to different client', async () => {
    Appointment.findById.mockResolvedValue(makeAppt({ client: { toString: () => 'other' } }));
    await expect(
      reviewResolvers.Mutation.createReview(
        null, { professionalId: 'p1', appointmentId: 'a1', rating: 5 }, ctx()
      )
    ).rejects.toThrow(GraphQLError);
  });

  it('throws when appointment not completed', async () => {
    Appointment.findById.mockResolvedValue(makeAppt({ status: 'pending' }));
    await expect(
      reviewResolvers.Mutation.createReview(
        null, { professionalId: 'p1', appointmentId: 'a1', rating: 5 }, ctx()
      )
    ).rejects.toThrow(GraphQLError);
  });

  it('throws when already reviewed', async () => {
    Appointment.findById.mockResolvedValue(makeAppt());
    Review.findOne.mockResolvedValue({ _id: 'existing' });
    await expect(
      reviewResolvers.Mutation.createReview(
        null, { professionalId: 'p1', appointmentId: 'a1', rating: 5 }, ctx()
      )
    ).rejects.toThrow(GraphQLError);
  });

  it('creates review successfully', async () => {
    Appointment.findById.mockResolvedValue(makeAppt());
    Review.findOne.mockResolvedValue(null);
    Review.create.mockResolvedValue({ _id: 'r1', rating: 5 });
    const result = await reviewResolvers.Mutation.createReview(
      null, { professionalId: 'p1', appointmentId: 'a1', rating: 5, isAnonymous: true }, ctx()
    );
    expect(result._id).toBe('r1');
  });
});
