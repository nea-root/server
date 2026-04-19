import { GraphQLError } from 'graphql';
import Stripe from 'stripe';
import Payment from '../models/Payment.js';
import Subscription from '../models/Subscription.js';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/context.js';

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  USD: { basic: 'price_basic_usd', premium: 'price_premium_usd' },
  GBP: { basic: 'price_basic_gbp', premium: 'price_premium_gbp' },
  INR: { basic: 'price_basic_inr', premium: 'price_premium_inr' },
};

export const paymentResolvers = {
  Query: {
    paymentHistory: async (_, { page = 1, limit = 20 }, { user }) => {
      requireAuth(user);
      return Payment.find({ payer: user._id })
        .populate('payer')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
    },

    mySubscription: async (_, __, { user }) => {
      requireAuth(user);
      return Subscription.findOne({ user: user._id, status: 'active' }).populate('user');
    },
  },

  Mutation: {
    createAppointmentPaymentIntent: async (_, { appointmentId }, { user }) => {
      requireAuth(user);
      const appt = await Appointment.findById(appointmentId);
      if (!appt) throw new GraphQLError('Appointment not found', { extensions: { code: 'NOT_FOUND' } });
      if (appt.client.toString() !== user._id.toString()) throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } });

      const stripe = getStripe();
      const intent = await stripe.paymentIntents.create({
        amount: Math.round((appt.amountCharged || 0) * 100),
        currency: (appt.currency || 'usd').toLowerCase(),
        metadata: { appointmentId: appt._id.toString(), userId: user._id.toString() },
      });

      const payment = await Payment.create({
        payer: user._id,
        recipient: appt.professional,
        appointment: appt._id,
        type: 'appointment',
        amount: appt.amountCharged || 0,
        currency: appt.currency || 'USD',
        stripePaymentIntentId: intent.id,
      });

      return { clientSecret: intent.client_secret, paymentId: payment._id };
    },

    createSubscription: async (_, { plan, currency = 'USD', paymentMethodId }, { user }) => {
      requireRole(user, 'victim');
      const existing = await Subscription.findOne({ user: user._id, status: 'active' });
      if (existing) throw new GraphQLError('Already subscribed');

      const stripe = getStripe();
      const customer = await stripe.customers.create({
        email: user.email,
        payment_method: paymentMethodId,
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      const priceId = PRICES[currency]?.[plan];
      if (!priceId) throw new GraphQLError('Invalid plan or currency');

      const stripeSub = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        expand: ['latest_invoice.payment_intent'],
      });

      const subscription = await Subscription.create({
        user: user._id,
        plan,
        currency,
        stripeSubscriptionId: stripeSub.id,
        stripeCustomerId: customer.id,
        stripePriceId: priceId,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      });

      return {
        subscription: await subscription.populate('user'),
        clientSecret: stripeSub.latest_invoice?.payment_intent?.client_secret,
      };
    },

    cancelSubscription: async (_, __, { user }) => {
      requireAuth(user);
      const sub = await Subscription.findOne({ user: user._id, status: 'active' });
      if (!sub) throw new GraphQLError('No active subscription', { extensions: { code: 'NOT_FOUND' } });
      const stripe = getStripe();
      await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
      sub.cancelAtPeriodEnd = true;
      sub.cancelledAt = new Date();
      await sub.save();
      return { success: true, message: 'Subscription will cancel at period end' };
    },
  },

  Payment: {
    id: (p) => p._id,
    payer: (p) => p.payer?._id ? p.payer : User.findById(p.payer),
  },

  SubscriptionType: {
    id: (s) => s._id,
    user: (s) => s.user?._id ? s.user : User.findById(s.user),
    cancelAtPeriodEnd: (s) => s.cancelAtPeriodEnd ?? false,
    currency: (s) => s.currency || 'USD',
  },
};
