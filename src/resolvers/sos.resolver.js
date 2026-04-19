import { GraphQLError } from 'graphql';
import SosEvent from '../models/SosEvent.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/context.js';

export const sosResolvers = {
  Query: {
    sosHistory: async (_, __, { user }) => {
      requireAuth(user);
      return SosEvent.find({ triggeredBy: user._id }).populate('triggeredBy').sort({ createdAt: -1 });
    },
  },

  Mutation: {
    triggerSOS: async (_, { latitude, longitude }, { user }) => {
      requireAuth(user);
      const sosEvent = await SosEvent.create({
        triggeredBy: user._id,
        location: latitude != null && longitude != null
          ? { type: 'Point', coordinates: [longitude, latitude] }
          : undefined,
        emergencyNumber: process.env.EMERGENCY_NUMBER || '911',
        status: 'triggered',
      });

      await Notification.create({
        recipient: user._id,
        type: 'sos_triggered',
        title: 'SOS Triggered',
        body: 'Emergency services have been notified. Help is on the way.',
        data: { sosEventId: sosEvent._id },
      });

      sosEvent.status = 'services_notified';
      await sosEvent.save();

      return {
        sosEventId: sosEvent._id,
        emergencyNumber: sosEvent.emergencyNumber,
        message: 'Emergency services notified',
      };
    },

    resolveSOS: async (_, { id, notes }, { user }) => {
      requireRole(user, 'admin');
      const sosEvent = await SosEvent.findByIdAndUpdate(
        id,
        { status: 'resolved', resolvedAt: new Date(), notes },
        { new: true }
      ).populate('triggeredBy');
      if (!sosEvent) throw new GraphQLError('SOS event not found', { extensions: { code: 'NOT_FOUND' } });
      return sosEvent;
    },
  },

  SosEvent: {
    id: (s) => s._id,
    triggeredBy: (s) => s.triggeredBy?._id ? s.triggeredBy : User.findById(s.triggeredBy),
  },
};
