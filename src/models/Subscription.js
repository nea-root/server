import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
  status: { type: String, enum: ['active', 'cancelled', 'expired', 'past_due'], default: 'active' },
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: { type: Boolean, default: false },
  cancelledAt: Date,
  stripeSubscriptionId: String,
  stripeCustomerId: String,
  stripePriceId: String,
  currency: { type: String, default: 'USD', enum: ['USD', 'GBP', 'INR'] },
  amount: Number,
  interval: { type: String, enum: ['monthly', 'yearly'] },
}, { timestamps: true });

export default mongoose.model('Subscription', subscriptionSchema);
