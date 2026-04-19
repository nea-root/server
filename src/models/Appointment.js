import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const appointmentSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  professional: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  professionalType: { type: String, enum: ['lawyer', 'therapist'], required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  durationMinutes: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'pending',
  },
  meetingRoomId: { type: String, default: uuidv4 },
  notes: String,
  cancellationReason: String,
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rescheduleHistory: [{
    previousStartTime: Date,
    previousEndTime: Date,
    rescheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rescheduledAt: { type: Date, default: Date.now },
    reason: String,
  }],
  amountCharged: Number,
  currency: { type: String, default: 'USD' },
  reminderSent: { type: Boolean, default: false },
}, { timestamps: true });

appointmentSchema.index({ client: 1, startTime: -1 });
appointmentSchema.index({ professional: 1, startTime: -1 });

export default mongoose.model('Appointment', appointmentSchema);
