import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ['victim', 'volunteer', 'lawyer', 'therapist', 'admin'], required: true },
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  phone: { type: String, trim: true },
  isAnonymous: { type: Boolean, default: false },
  anonymousAlias: { type: String },
  isEmailVerified: { type: Boolean, default: false },
  isDocumentVerified: { type: Boolean, default: false },
  isProfileComplete: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isBanned: { type: Boolean, default: false },
  emailVerificationCode: { type: String, select: false },
  emailVerificationExpires: { type: Date, select: false },
  passwordResetCode: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  refreshTokens: [{ type: String, select: false }],
  country: String,
  region: String,
  lastLoginAt: Date,
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model('User', userSchema);
