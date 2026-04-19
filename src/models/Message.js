import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: String,
  type: { type: String, enum: ['text', 'image', 'file', 'audio', 'system', 'call_event'], default: 'text' },
  attachments: [{
    url: String,
    fileName: String,
    mimeType: String,
    size: Number,
  }],
  isRead: { type: Boolean, default: false },
  readAt: Date,
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  senderAlias: String,
}, { timestamps: true });

messageSchema.index({ chat: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
