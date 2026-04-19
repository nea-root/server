import mongoose from 'mongoose';

const sosEventSchema = new mongoose.Schema({
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number],
  },
  emergencyNumber: String,
  status: { type: String, enum: ['triggered', 'services_notified', 'resolved'], default: 'triggered' },
  resolvedAt: Date,
  notes: String,
}, { timestamps: true });

sosEventSchema.index({ location: '2dsphere' });

export default mongoose.model('SosEvent', sosEventSchema);
