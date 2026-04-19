import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphQLError } from 'graphql';
import { mockQuery } from '../../helpers/chainable.js';

vi.mock('../../../src/models/Appointment.js', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock('../../../src/models/Availability.js', () => ({
  default: { findOne: vi.fn() },
}));
vi.mock('../../../src/models/Notification.js', () => ({
  default: { create: vi.fn().mockResolvedValue({}) },
}));
vi.mock('../../../src/models/User.js', () => ({
  default: { findById: vi.fn() },
}));
vi.mock('../../../src/utils/email.js', () => ({
  sendAppointmentEmail: vi.fn().mockResolvedValue({}),
}));

import { appointmentResolvers } from '../../../src/resolvers/appointment.resolver.js';
import Appointment from '../../../src/models/Appointment.js';
import Availability from '../../../src/models/Availability.js';
import Notification from '../../../src/models/Notification.js';

const victim = { _id: 'uid1', role: 'victim', isEmailVerified: true, email: 'v@test.com' };
const lawyer = { _id: 'prof1', role: 'lawyer' };
const ctx = (u = victim) => ({ user: u });

const fakeAvailability = {
  _id: 'av1',
  professional: 'prof1',
  isAcceptingClients: true,
  sessionDurationMinutes: 60,
};

const makeAppt = (overrides = {}) => ({
  _id: 'appt1',
  client: { _id: 'uid1', toString: () => 'uid1' },
  professional: { _id: 'prof1', toString: () => 'prof1' },
  professionalType: 'lawyer',
  startTime: new Date('2026-06-01T10:00:00Z'),
  endTime: new Date('2026-06-01T11:00:00Z'),
  durationMinutes: 60,
  status: 'pending',
  rescheduleHistory: [],
  save: vi.fn().mockResolvedValue(true),
  populate: vi.fn().mockResolvedThis ? vi.fn().mockReturnThis() : vi.fn().mockResolvedValue({}),
  then: undefined,
  ...overrides,
});

// Helper: make populate chain work as .populate(a).then(fn => ...)
const apptWithPopulate = (appt) => {
  appt.populate = vi.fn().mockReturnValue({
    then: (resolve) => resolve(appt),
    populate: vi.fn().mockReturnValue({ then: (r) => r(appt) }),
  });
  return appt;
};

describe('appointmentResolvers.Query.appointments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(appointmentResolvers.Query.appointments(null, {}, ctx(null))).rejects.toThrow(GraphQLError);
  });

  it('returns appointments for victim', async () => {
    Appointment.find.mockReturnValue(mockQuery([makeAppt()]));
    const result = await appointmentResolvers.Query.appointments(null, { view: 'upcoming' }, ctx());
    expect(Array.isArray(result)).toBe(true);
  });

  it('filters by status when provided', async () => {
    Appointment.find.mockReturnValue(mockQuery([]));
    await appointmentResolvers.Query.appointments(null, { status: 'confirmed' }, ctx());
    expect(Appointment.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'confirmed' }));
  });
});

describe('appointmentResolvers.Query.appointment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws NOT_FOUND when missing', async () => {
    Appointment.findById.mockReturnValue(mockQuery(null));
    await expect(appointmentResolvers.Query.appointment(null, { id: 'x' }, ctx())).rejects.toThrow(GraphQLError);
  });

  it('throws FORBIDDEN when user is not participant', async () => {
    const appt = makeAppt({
      client: { _id: 'other', toString: () => 'other' },
      professional: { _id: 'other2', toString: () => 'other2' },
    });
    Appointment.findById.mockReturnValue(mockQuery(appt));
    await expect(appointmentResolvers.Query.appointment(null, { id: 'a1' }, ctx())).rejects.toThrow(GraphQLError);
  });

  it('returns appointment for client', async () => {
    const appt = makeAppt();
    Appointment.findById.mockReturnValue(mockQuery(appt));
    const result = await appointmentResolvers.Query.appointment(null, { id: 'appt1' }, ctx());
    expect(result._id).toBe('appt1');
  });
});

describe('appointmentResolvers.Mutation.bookAppointment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(
      appointmentResolvers.Mutation.bookAppointment(null, {}, ctx(null))
    ).rejects.toThrow(GraphQLError);
  });

  it('throws when professional not accepting clients', async () => {
    Availability.findOne.mockResolvedValue({ ...fakeAvailability, isAcceptingClients: false });
    await expect(
      appointmentResolvers.Mutation.bookAppointment(
        null, { professionalId: 'prof1', professionalType: 'lawyer', startTime: new Date() }, ctx()
      )
    ).rejects.toThrow(GraphQLError);
  });

  it('throws when time slot is already booked', async () => {
    Availability.findOne.mockResolvedValue(fakeAvailability);
    Appointment.findOne.mockResolvedValue(makeAppt()); // conflict
    await expect(
      appointmentResolvers.Mutation.bookAppointment(
        null, { professionalId: 'prof1', professionalType: 'lawyer', startTime: new Date() }, ctx()
      )
    ).rejects.toThrow(GraphQLError);
  });

  it('creates appointment when slot is free', async () => {
    Availability.findOne.mockResolvedValue(fakeAvailability);
    Appointment.findOne.mockResolvedValue(null);
    const appt = apptWithPopulate(makeAppt());
    Appointment.create.mockResolvedValue(appt);
    Notification.create.mockResolvedValue({});

    await appointmentResolvers.Mutation.bookAppointment(
      null,
      { professionalId: 'prof1', professionalType: 'lawyer', startTime: new Date('2027-06-01T10:00:00Z') },
      ctx()
    );
    expect(Appointment.create).toHaveBeenCalled();
  });
});

describe('appointmentResolvers.Mutation.confirmAppointment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws FORBIDDEN for non-professional', async () => {
    await expect(
      appointmentResolvers.Mutation.confirmAppointment(null, { id: 'a1' }, ctx(victim))
    ).rejects.toThrow(GraphQLError);
  });

  it('throws FORBIDDEN when not the professional on the appointment', async () => {
    const appt = makeAppt({ professional: { _id: 'other', toString: () => 'other' } });
    Appointment.findById.mockResolvedValue(appt);
    await expect(
      appointmentResolvers.Mutation.confirmAppointment(null, { id: 'a1' }, ctx(lawyer))
    ).rejects.toThrow(GraphQLError);
  });

  it('confirms appointment', async () => {
    const appt = apptWithPopulate(makeAppt({ professional: { _id: 'prof1', toString: () => 'prof1' } }));
    Appointment.findById.mockResolvedValue(appt);
    Notification.create.mockResolvedValue({});
    await appointmentResolvers.Mutation.confirmAppointment(null, { id: 'a1' }, ctx(lawyer));
    expect(appt.status).toBe('confirmed');
  });
});

describe('appointmentResolvers.Mutation.cancelAppointment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when appointment is already completed', async () => {
    const appt = makeAppt({ status: 'completed' });
    Appointment.findById.mockResolvedValue(appt);
    await expect(
      appointmentResolvers.Mutation.cancelAppointment(null, { id: 'a1' }, ctx())
    ).rejects.toThrow(GraphQLError);
  });

  it('cancels appointment and notifies other party', async () => {
    const appt = apptWithPopulate(makeAppt());
    Appointment.findById.mockResolvedValue(appt);
    Notification.create.mockResolvedValue({});
    await appointmentResolvers.Mutation.cancelAppointment(null, { id: 'a1', reason: 'No time' }, ctx());
    expect(appt.status).toBe('cancelled');
    expect(Notification.create).toHaveBeenCalled();
  });
});

describe('appointmentResolvers.Mutation.rescheduleAppointment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when appointment is completed', async () => {
    const appt = makeAppt({ status: 'completed' });
    Appointment.findById.mockResolvedValue(appt);
    await expect(
      appointmentResolvers.Mutation.rescheduleAppointment(
        null, { id: 'a1', newStartTime: new Date() }, ctx()
      )
    ).rejects.toThrow(GraphQLError);
  });

  it('reschedules and records history', async () => {
    const appt = apptWithPopulate(makeAppt());
    Appointment.findById.mockResolvedValue(appt);
    const newStart = new Date('2027-07-01T10:00:00Z');
    await appointmentResolvers.Mutation.rescheduleAppointment(
      null, { id: 'a1', newStartTime: newStart, reason: 'Conflict' }, ctx()
    );
    expect(appt.rescheduleHistory.length).toBe(1);
    expect(appt.status).toBe('pending');
  });
});
