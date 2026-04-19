import { GraphQLError } from 'graphql';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import { requireAuth } from '../middleware/context.js';

export const profileResolvers = {
  Query: {
    myProfile: async (_, __, { user }) => {
      requireAuth(user);
      const profile = await Profile.findOne({ user: user._id }).populate('user');
      if (!profile) throw new GraphQLError('Profile not found', { extensions: { code: 'NOT_FOUND' } });
      return profile;
    },

    profile: async (_, { userId }, { user }) => {
      requireAuth(user);
      const profile = await Profile.findOne({ user: userId }).populate('user');
      if (!profile) throw new GraphQLError('Profile not found', { extensions: { code: 'NOT_FOUND' } });
      return profile;
    },

    professionals: async (_, { role, specialization, country, minRating, page = 1, limit = 20 }, { user }) => {
      requireAuth(user);
      const userFilter = { isActive: true, isDocumentVerified: true };
      if (role) userFilter.role = role;
      if (country) userFilter.country = country;

      const profileFilter = {};
      if (specialization) profileFilter.specializations = specialization;
      if (minRating) profileFilter.averageRating = { $gte: minRating };

      const users = await User.find(userFilter).select('_id');
      const userIds = users.map((u) => u._id);

      return Profile.find({ user: { $in: userIds }, ...profileFilter })
        .populate('user')
        .sort({ averageRating: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
    },
  },

  Mutation: {
    updateProfile: async (_, { input }, { user }) => {
      requireAuth(user);
      const profile = await Profile.findOneAndUpdate(
        { user: user._id },
        input,
        { new: true, runValidators: true }
      ).populate('user');
      if (input.bio && input.languages?.length) {
        await User.findByIdAndUpdate(user._id, { isProfileComplete: true });
      }
      return profile;
    },
  },

  Profile: {
    id: (p) => p._id,
    user: (p) => p.user?._id ? p.user : User.findById(p.user),
  },
};
