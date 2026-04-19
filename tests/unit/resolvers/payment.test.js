import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphQLError } from 'graphql';
import { mockQuery } from '../../helpers/chainable.js';

vi.mock('../../../src/models/Payment.js', () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));
vi.mock('../../../src/models/Subscription.js', () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));
vi.mock('../../../src/models/Appointment.js', () => ({
  default: { findById: vi.fn() },
}));
vi.mock('../../../src/models/User.js', () => ({
  default: { findById: vi.fn() },
}));
const mockStripeInstance = {
  paymentIntents: {
    create: vi.fn().mockResolvedValue({ id: 'pi_test', client_secret: 'secret_test' }),
  },
  customers: {
    create: vi.fn().mockResolvedValue({ id: 'cus_test' }),
  },
  subscriptions: {
    create: vi.fn().mockResolvedValue({
      id: 'sub_test',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 2592000,
      latest_invoice: { payment_intent: { client_secret: 'sub_secret' } },
    }),
    update: vi.fn().mockResolvedValue({}),
  },
};

vi.mock('stripe', () => ({
  default: function MockStripe() { return mockStripeInstance; },
}));

import { paymentResolvers } from '../../../src/resolvers/payment.resolver.js';
import Payment from '../../../src/models/Payment.js';
import Subscription from '../../../src/models/Subscription.js';
import Appointment from '../../../src/models/Appointment.js';

const victim = { _id: 'uid1', role: 'victim', email: 'v@test.com' };
const ctx = (u = victim) => ({ user: u });

const makeAppt = (overrides = {}) => ({
  _id: 'appt1',
  client: { toString: () => 'uid1' },
  professional: { _id: 'prof1' },
  amountCharged: 100,
  currency: 'USD',
  status: 'confirmed',
  ...overrides,
});

describe('paymentResolvers.Query.paymentHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(paymentResolvers.Query.paymentHistory(null, {}, ctx(null))).rejects.toThrow(GraphQLError);
  });

  it('returns payment history', async () => {
    Payment.find.mockReturnValue(mockQuery([{ _id: 'p1', amount: 100 }]));
    const result = await paymentResolvers.Query.paymentHistory(null, {}, ctx());
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('paymentResolvers.Query.mySubscription', () => {
  it('throws when not authenticated', async () => {
    await expect(paymentResolvers.Query.mySubscription(null, {}, ctx(null))).rejects.toThrow(GraphQLError);
  });

  it('returns active subscription', async () => {
    const sub = { _id: 'sub1', plan: 'basic', status: 'active' };
    Subscription.findOne.mockReturnValue({ populate: vi.fn().mockResolvedValue(sub) });
    const result = await paymentResolvers.Query.mySubscription(null, {}, ctx());
    expect(result._id).toBe('sub1');
  });
});

describe('paymentResolvers.Mutation.createAppointmentPaymentIntent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(
      paymentResolvers.Mutation.createAppointmentPaymentIntent(null, { appointmentId: 'a1' }, ctx(null))
    ).rejects.toThrow(GraphQLError);
  });

  it('throws NOT_FOUND when appointment missing', async () => {
    Appointment.findById.mockResolvedValue(null);
    await expect(
      paymentResolvers.Mutation.createAppointmentPaymentIntent(null, { appointmentId: 'a1' }, ctx())
    ).rejects.toThrow(GraphQLError);
  });

  it('throws FORBIDDEN when appointment belongs to different user', async () => {
    Appointment.findById.mockResolvedValue(makeAppt({ client: { toString: () => 'other' } }));
    await expect(
      paymentResolvers.Mutation.createAppointmentPaymentIntent(null, { appointmentId: 'a1' }, ctx())
    ).rejects.toThrow(GraphQLError);
  });

  it('creates payment intent', async () => {
    Appointment.findById.mockResolvedValue(makeAppt());
    Payment.create.mockResolvedValue({ _id: 'pay1' });
    const result = await paymentResolvers.Mutation.createAppointmentPaymentIntent(
      null, { appointmentId: 'appt1' }, ctx()
    );
    expect(result.clientSecret).toBe('secret_test');
    expect(result.paymentId).toBe('pay1');
  });
});

describe('paymentResolvers.Mutation.createSubscription', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws FORBIDDEN for non-victim', async () => {
    await expect(
      paymentResolvers.Mutation.createSubscription(
        null, { plan: 'basic', currency: 'USD', paymentMethodId: 'pm_test' },
        ctx({ _id: 'x', role: 'lawyer', email: 'l@t.com' })
      )
    ).rejects.toThrow(GraphQLError);
  });

  it('throws when already subscribed', async () => {
    Subscription.findOne.mockResolvedValue({ _id: 'existing' });
    await expect(
      paymentResolvers.Mutation.createSubscription(
        null, { plan: 'basic', currency: 'USD', paymentMethodId: 'pm_test' }, ctx()
      )
    ).rejects.toThrow(GraphQLError);
  });

  it('throws for invalid plan/currency', async () => {
    Subscription.findOne.mockResolvedValue(null);
    await expect(
      paymentResolvers.Mutation.createSubscription(
        null, { plan: 'gold', currency: 'EUR', paymentMethodId: 'pm_test' }, ctx()
      )
    ).rejects.toThrow(GraphQLError);
  });

  it('creates subscription successfully', async () => {
    Subscription.findOne.mockResolvedValue(null);
    const sub = { _id: 'sub1', plan: 'basic', populate: vi.fn().mockResolvedValue({ _id: 'sub1', plan: 'basic' }) };
    Subscription.create.mockResolvedValue(sub);
    const result = await paymentResolvers.Mutation.createSubscription(
      null, { plan: 'basic', currency: 'USD', paymentMethodId: 'pm_test' }, ctx()
    );
    expect(result.subscription).toBeDefined();
  });
});

describe('paymentResolvers.Mutation.cancelSubscription', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when no active subscription', async () => {
    Subscription.findOne.mockResolvedValue(null);
    await expect(paymentResolvers.Mutation.cancelSubscription(null, {}, ctx())).rejects.toThrow(GraphQLError);
  });

  it('cancels subscription', async () => {
    const sub = { _id: 'sub1', stripeSubscriptionId: 'sub_test', cancelAtPeriodEnd: false, save: vi.fn().mockResolvedValue(true) };
    Subscription.findOne.mockResolvedValue(sub);
    const result = await paymentResolvers.Mutation.cancelSubscription(null, {}, ctx());
    expect(sub.cancelAtPeriodEnd).toBe(true);
    expect(result.success).toBe(true);
  });
});
