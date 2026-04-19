import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  content: { type: String, required: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isStarred: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const documentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['evidence', 'police_report', 'medical_record', 'court_order',
      'law_license', 'therapy_license', 'bar_registration', 'insurance',
      'id_proof', 'qualification_certificate', 'other'],
    required: true,
  },
  title: { type: String, required: true },
  description: String,
  fileUrl: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: Number,
  mimeType: String,
  verificationStatus: {
    type: String,
    enum: ['pending', 'under_review', 'verified', 'rejected'],
    default: 'pending',
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  rejectionReason: String,
  notes: [noteSchema],
  isSharedWithProfessional: { type: Boolean, default: false },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deletedAt: Date,
}, { timestamps: true });

documentSchema.index({ owner: 1, type: 1 });

export default mongoose.model('Document', documentSchema);
