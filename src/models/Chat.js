import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  type: { type: String, enum: ['direct', 'anonymous_support', 'appointment'], default: 'direct' },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  lastMessageAt: Date,
  isActive: { type: Boolean, default: true },
  unreadCounts: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    count: { type: Number, default: 0 },
  }],
}, { timestamps: true });

chatSchema.index({ participants: 1 });

export default mongoose.model('Chat', chatSchema);
