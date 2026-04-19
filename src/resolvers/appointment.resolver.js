import { GraphQLError } from 'graphql';
import Appointment from '../models/Appointment.js';
import Availability from '../models/Availability.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendAppointmentEmail } from '../utils/email.js';
import { requireAuth, requireRole } from '../middleware/context.js';

const notFound = () => { throw new GraphQLError('Appointment not found', { extensions: { code: 'NOT_FOUND' } }); };
const forbidden = () => { throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } }); };

export const appointmentResolvers = {
  Query: {
    appointments: async (_, { status, view = 'upcoming', page = 1, limit = 20 }, { user }) => {
      requireAuth(user);
      const filter = {};
      if (['victim'].includes(user.role)) filter.client = user._id;
      else filter.professional = user._id;
      if (status) filter.status = status;
      else if (view === 'upcoming') filter.status = { $in: ['pending', 'confirmed'] };
      else if (view === 'completed') filter.status = 'completed';

      return Appointment.find(filter)
        .populate('client').populate('professional').populate('cancelledBy')
        .sort({ startTime: view === 'upcoming' ? 1 : -1 })
        .skip((page - 1) * limit).limit(limit);
    },

    appointment: async (_, { id }, { user }) => {
      requireAuth(user);
      const appt = await Appointment.findById(id)
        .populate('client').populate('professional').populate('cancelledBy');
      if (!appt) notFound();
      const clientId = (appt.client._id ?? appt.client).toString();
      const professionalId = (appt.professional._id ?? appt.professional).toString();
      if (clientId !== user._id.toString() && professionalId !== user._id.toString() && user.role !== 'admin') forbidden();
      return appt;
    },
  },

  Mutation: {
    bookAppointment: async (_, { professionalId, professionalType, startTime, notes }, { user }) => {
      requireAuth(user);
      if (!user.isEmailVerified) throw new GraphQLError('Email not verified', { extensions: { code: 'FORBIDDEN' } });

      const availability = await Availability.findOne({ professional: professionalId });
      if (!availability?.isAcceptingClients) throw new GraphQLError('Professional not accepting appointments');

      const start = new Date(startTime);
      const durationMinutes = availability.sessionDurationMinutes;
      const end = new Date(start.getTime() + durationMinutes * 60000);

      const conflict = await Appointment.findOne({
        professional: professionalId,
        status: { $in: ['pending', 'confirmed'] },
        startTime: { $lt: end }, endTime: { $gt: start },
      });
      if (conflict) throw new GraphQLError('This time slot is already booked');

      const appt = await Appointment.create({
        client: user._id, professional: professionalId, professionalType,
        startTime: start, endTime: end, durationMinutes, notes,
      });

      await Notification.create({
        recipient: professionalId,
        type: 'appointment_confirmed',
        title: 'New Appointment Request',
        body: `New appointment request for ${start.toLocaleString()}`,
        data: { appointmentId: appt._id },
      });

      await sendAppointmentEmail(user.email, start).catch(() => {});

      return appt.populate('client').then((a) => a.populate('professional'));
    },

    confirmAppointment: async (_, { id }, { user }) => {
      requireRole(user, 'lawyer', 'therapist');
      const appt = await Appointment.findById(id);
      if (!appt) notFound();
      if (appt.professional.toString() !== user._id.toString()) forbidden();
      if (appt.status !== 'pending') throw new GraphQLError('Cannot confirm this appointment');
      appt.status = 'confirmed';
      await appt.save();
      await Notification.create({
        recipient: appt.client,
        type: 'appointment_confirmed',
        title: 'Appointment Confirmed',
        body: `Your appointment on ${appt.startTime.toLocaleString()} is confirmed.`,
        data: { appointmentId: appt._id },
      });
      return appt.populate('client').then((a) => a.populate('professional'));
    },

    cancelAppointment: async (_, { id, reason }, { user }) => {
      requireAuth(user);
      const appt = await Appointment.findById(id);
      if (!appt) notFound();
      const clientId = appt.client.toString();
      const professionalId = appt.professional.toString();
      if (clientId !== user._id.toString() && professionalId !== user._id.toString()) forbidden();
      if (['completed', 'cancelled'].includes(appt.status)) throw new GraphQLError('Cannot cancel');
      appt.status = 'cancelled';
      appt.cancellationReason = reason;
      appt.cancelledBy = user._id;
      await appt.save();
      const otherParty = clientId === user._id.toString() ? appt.professional : appt.client;
      await Notification.create({
        recipient: otherParty,
        type: 'appointment_cancelled',
        title: 'Appointment Cancelled',
        body: `An appointment on ${appt.startTime.toLocaleString()} was cancelled.`,
        data: { appointmentId: appt._id },
      });
      return appt.populate('client').then((a) => a.populate('professional'));
    },

    rescheduleAppointment: async (_, { id, newStartTime, reason }, { user }) => {
      requireAuth(user);
      const appt = await Appointment.findById(id);
      if (!appt) notFound();
      const clientId = appt.client.toString();
      const professionalId = appt.professional.toString();
      if (clientId !== user._id.toString() && professionalId !== user._id.toString()) forbidden();
      if (!['pending', 'confirmed'].includes(appt.status)) throw new GraphQLError('Cannot reschedule');

      const start = new Date(newStartTime);
      const end = new Date(start.getTime() + appt.durationMinutes * 60000);

      appt.rescheduleHistory.push({
        previousStartTime: appt.startTime,
        previousEndTime: appt.endTime,
        rescheduledBy: user._id,
        reason,
      });
      appt.startTime = start;
      appt.endTime = end;
      appt.status = 'pending';
      await appt.save();
      return appt.populate('client').then((a) => a.populate('professional'));
    },
  },

  Appointment: {
    id: (a) => a._id,
    client: (a) => a.client?._id ? a.client : User.findById(a.client),
    professional: (a) => a.professional?._id ? a.professional : User.findById(a.professional),
    cancelledBy: (a) => a.cancelledBy ? User.findById(a.cancelledBy) : null,
    rescheduleHistory: (a) => a.rescheduleHistory || [],
  },

  RescheduleRecord: {
    rescheduledBy: (r) => User.findById(r.rescheduledBy),
  },
};
