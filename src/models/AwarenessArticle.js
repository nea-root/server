import mongoose from 'mongoose';

const awarenessArticleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  excerpt: String,
  content: { type: String, required: true },
  coverImage: String,
  category: { type: String, enum: ['safety_planning', 'legal_rights', 'mental_health', 'resources', 'stories', 'news'] },
  tags: [String],
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isPublished: { type: Boolean, default: false },
  publishedAt: Date,
  viewCount: { type: Number, default: 0 },
}, { timestamps: true });

awarenessArticleSchema.index({ isPublished: 1, publishedAt: -1 });

export default mongoose.model('AwarenessArticle', awarenessArticleSchema);
