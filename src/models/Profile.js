import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  bio: { type: String, maxlength: 1000 },
  avatar: String,
  dateOfBirth: Date,
  gender: { type: String, enum: ['male', 'female', 'non-binary', 'prefer_not_to_say'] },
  languages: [String],
  professionalTitle: String,
  specializations: [String],
  yearsOfExperience: { type: Number, min: 0 },
  licenseNumber: String,
  barRegistrationNumber: String,
  qualifications: [String],
  hourlyRate: { type: Number, min: 0 },
  currency: { type: String, default: 'USD', enum: ['USD', 'GBP', 'INR'] },
  areasServed: [String],
  volunteerMotivation: String,
  volunteerAvailability: String,
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('Profile', profileSchema);
