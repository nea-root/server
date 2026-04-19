import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphQLError } from 'graphql';
import { mockQuery } from '../../helpers/chainable.js';

vi.mock('../../../src/models/Profile.js', () => ({
  default: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
  },
}));
vi.mock('../../../src/models/User.js', () => ({
  default: {
    find: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findById: vi.fn(),
  },
}));

import { profileResolvers } from '../../../src/resolvers/profile.resolver.js';
import Profile from '../../../src/models/Profile.js';
import User from '../../../src/models/User.js';

const user = { _id: 'uid1', role: 'victim', isEmailVerified: true };
const mockProfile = { _id: 'pid1', user, bio: 'Hello', averageRating: 0, totalReviews: 0 };
const ctx = (u = user) => ({ user: u });

describe('profileResolvers.Query.myProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws UNAUTHENTICATED when not logged in', async () => {
    await expect(profileResolvers.Query.myProfile(null, null, ctx(null))).rejects.toThrow(GraphQLError);
  });

  it('throws NOT_FOUND when profile missing', async () => {
    Profile.findOne.mockReturnValue(mockQuery(null));
    await expect(profileResolvers.Query.myProfile(null, null, ctx())).rejects.toThrow(GraphQLError);
  });

  it('returns profile for authenticated user', async () => {
    Profile.findOne.mockReturnValue(mockQuery(mockProfile));
    const result = await profileResolvers.Query.myProfile(null, null, ctx());
    expect(result).toEqual(mockProfile);
  });
});

describe('profileResolvers.Query.profile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws NOT_FOUND for missing profile', async () => {
    Profile.findOne.mockReturnValue(mockQuery(null));
    await expect(profileResolvers.Query.profile(null, { userId: 'x' }, ctx())).rejects.toThrow(GraphQLError);
  });

  it('returns profile by userId', async () => {
    Profile.findOne.mockReturnValue(mockQuery(mockProfile));
    const result = await profileResolvers.Query.profile(null, { userId: 'uid1' }, ctx());
    expect(result).toEqual(mockProfile);
  });
});

describe('profileResolvers.Query.professionals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires authentication', async () => {
    await expect(profileResolvers.Query.professionals(null, {}, ctx(null))).rejects.toThrow(GraphQLError);
  });

  it('returns list of professionals', async () => {
    User.find.mockReturnValue({ select: vi.fn().mockResolvedValue([{ _id: 'p1' }]) });
    Profile.find.mockReturnValue(mockQuery([mockProfile]));
    const result = await profileResolvers.Query.professionals(null, {}, ctx());
    expect(Array.isArray(result)).toBe(true);
  });

  it('filters by role and country', async () => {
    User.find.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
    Profile.find.mockReturnValue(mockQuery([]));
    await profileResolvers.Query.professionals(null, { role: 'lawyer', country: 'US' }, ctx());
    expect(User.find).toHaveBeenCalledWith(expect.objectContaining({ role: 'lawyer', country: 'US' }));
  });
});

describe('profileResolvers.Mutation.updateProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(
      profileResolvers.Mutation.updateProfile(null, { input: {} }, ctx(null))
    ).rejects.toThrow(GraphQLError);
  });

  it('updates and returns the profile', async () => {
    const updated = { ...mockProfile, bio: 'Updated' };
    Profile.findOneAndUpdate.mockReturnValue(mockQuery(updated));
    const result = await profileResolvers.Mutation.updateProfile(null, { input: { bio: 'Updated' } }, ctx());
    expect(result.bio).toBe('Updated');
  });

  it('marks profile complete when bio and languages are provided', async () => {
    Profile.findOneAndUpdate.mockReturnValue(mockQuery({ ...mockProfile, bio: 'Hi', languages: ['en'] }));
    User.findByIdAndUpdate.mockResolvedValue({});
    await profileResolvers.Mutation.updateProfile(
      null, { input: { bio: 'Hi', languages: ['en'] } }, ctx()
    );
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      user._id, { isProfileComplete: true }
    );
  });
});
