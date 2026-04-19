import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  professional: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, maxlength: 1000 },
  isAnonymous: { type: Boolean, default: true },
}, { timestamps: true });

reviewSchema.index({ professional: 1, createdAt: -1 });
reviewSchema.index({ reviewer: 1, professional: 1 }, { unique: true });

reviewSchema.post('save', async function () {
  const Profile = (await import('./Profile.js')).default;
  const stats = await mongoose.model('Review').aggregate([
    { $match: { professional: this.professional } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  if (stats.length) {
    await Profile.findOneAndUpdate(
      { user: this.professional },
      { averageRating: Math.round(stats[0].avg * 10) / 10, totalReviews: stats[0].count }
    );
  }
});

export default mongoose.model('Review', reviewSchema);
