import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'appointment_confirmed', 'appointment_cancelled', 'appointment_reminder',
      'appointment_rescheduled', 'message_received', 'document_verified',
      'document_rejected', 'payment_succeeded', 'payment_failed',
      'subscription_renewed', 'subscription_expiring', 'sos_triggered',
      'profile_complete', 'new_review', 'system',
    ],
    required: true,
  },
  title: { type: String, required: true },
  body: { type: String, required: true },
  data: mongoose.Schema.Types.Mixed,
  isRead: { type: Boolean, default: false },
  readAt: Date,
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
