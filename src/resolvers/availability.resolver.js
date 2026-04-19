import { GraphQLError } from 'graphql';
import Availability from '../models/Availability.js';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/context.js';

export const availabilityResolvers = {
  Query: {
    availability: async (_, { professionalId }, { user }) => {
      requireAuth(user);
      return Availability.findOne({ professional: professionalId }).populate('professional');
    },

    availableSlots: async (_, { professionalId, date }, { user }) => {
      requireAuth(user);
      const availability = await Availability.findOne({ professional: professionalId });
      if (!availability || !availability.isAcceptingClients) return [];

      const requestedDate = new Date(date);
      const dayOfWeek = requestedDate.getDay();
      const dayIntervals = availability.weeklyIntervals.filter((i) => i.dayOfWeek === dayOfWeek);
      if (!dayIntervals.length) return [];

      const isAbsent = availability.absences.some(
        (a) => requestedDate >= new Date(a.startDate) && requestedDate <= new Date(a.endDate)
      );
      if (isAbsent) return [];

      const dayStart = new Date(requestedDate); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(requestedDate); dayEnd.setHours(23, 59, 59, 999);

      const booked = await Appointment.find({
        professional: professionalId,
        status: { $in: ['pending', 'confirmed'] },
        startTime: { $gte: dayStart, $lte: dayEnd },
      }).select('startTime endTime');

      const slots = [];
      const duration = availability.sessionDurationMinutes;

      for (const interval of dayIntervals) {
        const [sh, sm] = interval.startTime.split(':').map(Number);
        const [eh, em] = interval.endTime.split(':').map(Number);
        const slotBase = new Date(dayStart);
        let slotStart = new Date(slotBase.setHours(sh, sm, 0, 0));
        const intervalEnd = new Date(dayStart); intervalEnd.setHours(eh, em, 0, 0);

        while (new Date(slotStart.getTime() + duration * 60000) <= intervalEnd) {
          const slotEnd = new Date(slotStart.getTime() + duration * 60000);
          const isBooked = booked.some((b) => slotStart < new Date(b.endTime) && slotEnd > new Date(b.startTime));
          if (!isBooked && slotStart > new Date()) slots.push({ startTime: new Date(slotStart), endTime: new Date(slotEnd) });
          slotStart = new Date(slotEnd);
        }
      }
      return slots;
    },
  },

  Mutation: {
    upsertAvailability: async (_, args, { user }) => {
      requireRole(user, 'lawyer', 'therapist');
      const { weeklyIntervals, timezone, sessionDurationMinutes, isAcceptingClients } = args;
      const updates = { weeklyIntervals };
      if (timezone !== undefined) updates.timezone = timezone;
      if (sessionDurationMinutes !== undefined) updates.sessionDurationMinutes = sessionDurationMinutes;
      if (isAcceptingClients !== undefined) updates.isAcceptingClients = isAcceptingClients;
      return Availability.findOneAndUpdate(
        { professional: user._id },
        updates,
        { new: true, upsert: true, runValidators: true }
      ).populate('professional');
    },

    scheduleAbsence: async (_, { startDate, endDate, reason }, { user }) => {
      requireRole(user, 'lawyer', 'therapist');
      const availability = await Availability.findOne({ professional: user._id });
      if (!availability) throw new GraphQLError('Set up availability first', { extensions: { code: 'NOT_FOUND' } });
      availability.absences.push({ startDate, endDate, reason });
      await availability.save();
      return availability.populate('professional');
    },
  },

  Availability: {
    id: (a) => a._id,
    professional: (a) => a.professional?._id ? a.professional : User.findById(a.professional),
  },
};
