import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  payer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
  type: { type: String, enum: ['appointment', 'subscription'], required: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, default: 'USD', enum: ['USD', 'GBP', 'INR'] },
  status: { type: String, enum: ['pending', 'succeeded', 'failed', 'refunded', 'cancelled'], default: 'pending' },
  stripePaymentIntentId: String,
  stripeChargeId: String,
  paymentMethod: { type: String, enum: ['card', 'apple_pay', 'google_pay', 'bank_transfer'] },
  billingDetails: {
    name: String,
    email: String,
    address: { line1: String, city: String, country: String, postalCode: String },
  },
  receiptUrl: String,
}, { timestamps: true });

paymentSchema.index({ payer: 1, createdAt: -1 });

export default mongoose.model('Payment', paymentSchema);
