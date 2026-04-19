import { GraphQLError } from 'graphql';
import Review from '../models/Review.js';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/context.js';

export const reviewResolvers = {
  Query: {
    reviews: async (_, { professionalId, page = 1, limit = 20 }, { user }) => {
      requireAuth(user);
      return Review.find({ professional: professionalId })
        .populate('reviewer').populate('professional')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
    },
  },

  Mutation: {
    createReview: async (_, { professionalId, appointmentId, rating, comment, isAnonymous = true }, { user }) => {
      requireRole(user, 'victim');
      const appt = await Appointment.findById(appointmentId);
      if (!appt || appt.client.toString() !== user._id.toString()) {
        throw new GraphQLError('Invalid appointment');
      }
      if (appt.status !== 'completed') throw new GraphQLError('Can only review completed appointments');
      const existing = await Review.findOne({ reviewer: user._id, professional: professionalId });
      if (existing) throw new GraphQLError('Already reviewed this professional');
      return Review.create({ reviewer: user._id, professional: professionalId, appointment: appointmentId, rating, comment, isAnonymous });
    },
  },

  Review: {
    id: (r) => r._id,
    reviewer: (r) => {
      if (r.isAnonymous) return null;
      return r.reviewer?._id ? r.reviewer : User.findById(r.reviewer);
    },
    professional: (r) => r.professional?._id ? r.professional : User.findById(r.professional),
  },
};
