import mongoose from 'mongoose';

const availabilitySchema = new mongoose.Schema({
  professional: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  timezone: { type: String, default: 'UTC' },
  weeklyIntervals: [{
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    _id: false,
  }],
  absences: [{
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: String,
    _id: false,
  }],
  sessionDurationMinutes: { type: Number, default: 60, enum: [30, 45, 60, 90] },
  isAcceptingClients: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('Availability', availabilitySchema);
