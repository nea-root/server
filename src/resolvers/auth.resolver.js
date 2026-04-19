import crypto from 'crypto';
import { GraphQLError } from 'graphql';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email.js';
import { requireAuth } from '../middleware/context.js';

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const err = (msg, code = 'BAD_USER_INPUT') => {
  throw new GraphQLError(msg, { extensions: { code } });
};

export const authResolvers = {
  Query: {
    me: (_, __, { user }) => {
      requireAuth(user);
      return user;
    },
  },

  Mutation: {
    register: async (_, args) => {
      const { email, isAnonymous } = args;
      if (await User.findOne({ email })) err('Email already registered');

      const newUser = await User.create({
        ...args,
        anonymousAlias: isAnonymous ? `User${Date.now().toString(36)}` : undefined,
      });
      await Profile.create({ user: newUser._id });

      const code = generateOTP();
      newUser.emailVerificationCode = code;
      newUser.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
      await newUser.save({ validateBeforeSave: false });
      await sendVerificationEmail(email, code).catch(() => {});

      return {
        userId: newUser._id,
        message: 'Registration successful. Check your email for the verification code.',
      };
    },

    verifyEmail: async (_, { userId, code }) => {
      const user = await User.findById(userId).select(
        '+emailVerificationCode +emailVerificationExpires',
      );
      if (!user) err('User not found', 'NOT_FOUND');
      if (user.isEmailVerified) err('Already verified');
      if (user.emailVerificationCode !== code || user.emailVerificationExpires < new Date()) {
        err('Invalid or expired code');
      }
      user.isEmailVerified = true;
      user.emailVerificationCode = undefined;
      user.emailVerificationExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return { success: true, message: 'Email verified successfully' };
    },

    resendVerification: async (_, { email }) => {
      const user = await User.findOne({ email });
      if (user && !user.isEmailVerified) {
        const code = generateOTP();
        user.emailVerificationCode = code;
        user.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save({ validateBeforeSave: false });
        await sendVerificationEmail(email, code).catch(() => {});
      }
      return { success: true, message: 'If this account exists, a verification code was sent' };
    },

    login: async (_, { email, password }) => {
      const user = await User.findOne({ email }).select('+password +refreshTokens');
      if (!user || !(await user.comparePassword(password)))
        err('Invalid email or password', 'UNAUTHENTICATED');
      if (!user.isEmailVerified) err('Please verify your email first', 'FORBIDDEN');
      if (user.isBanned) err('Account suspended. Contact support.', 'FORBIDDEN');

      const payload = { userId: user._id, role: user.role };
      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
      user.lastLoginAt = new Date();
      await user.save({ validateBeforeSave: false });

      return { accessToken, refreshToken, user };
    },

    refreshToken: async (_, { refreshToken }) => {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        const user = await User.findById(decoded.userId).select('+refreshTokens');
        if (!user || !user.refreshTokens.includes(refreshToken))
          err('Invalid refresh token', 'UNAUTHENTICATED');

        const payload = { userId: user._id, role: user.role };
        const newAccess = generateAccessToken(payload);
        const newRefresh = generateRefreshToken(payload);

        user.refreshTokens = user.refreshTokens
          .filter((t) => t !== refreshToken)
          .concat(newRefresh);
        await user.save({ validateBeforeSave: false });

        return { accessToken: newAccess, refreshToken: newRefresh };
      } catch {
        err('Invalid or expired refresh token', 'UNAUTHENTICATED');
      }
    },

    logout: async (_, { refreshToken }, { user }) => {
      requireAuth(user);
      const dbUser = await User.findById(user._id).select('+refreshTokens');
      if (dbUser && refreshToken) {
        dbUser.refreshTokens = (dbUser.refreshTokens || []).filter((t) => t !== refreshToken);
        await dbUser.save({ validateBeforeSave: false });
      }
      return { success: true, message: 'Logged out' };
    },

    forgotPassword: async (_, { email }) => {
      const user = await User.findOne({ email });
      if (user) {
        const code = generateOTP();
        user.passwordResetCode = code;
        user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save({ validateBeforeSave: false });
        await sendPasswordResetEmail(email, code).catch(() => {});
      }
      return { success: true, message: 'If this email is registered, a reset code was sent' };
    },

    verifyResetCode: async (_, { email, code }) => {
      const user = await User.findOne({ email }).select('+passwordResetCode +passwordResetExpires');
      if (!user || user.passwordResetCode !== code || user.passwordResetExpires < new Date()) {
        err('Invalid or expired code');
      }
      const tempToken = crypto.randomBytes(32).toString('hex');
      user.passwordResetCode = `verified:${tempToken}`;
      user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
      await user.save({ validateBeforeSave: false });
      return { resetToken: tempToken };
    },

    resetPassword: async (_, { email, resetToken, newPassword }) => {
      const user = await User.findOne({ email }).select('+passwordResetCode +passwordResetExpires');
      if (
        !user ||
        user.passwordResetCode !== `verified:${resetToken}` ||
        user.passwordResetExpires < new Date()
      ) {
        err('Invalid or expired reset token');
      }
      user.password = newPassword;
      user.passwordResetCode = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      return { success: true, message: 'Password reset successfully' };
    },

    changePassword: async (_, { currentPassword, newPassword }, { user }) => {
      requireAuth(user);
      const dbUser = await User.findById(user._id).select('+password');
      if (!(await dbUser.comparePassword(currentPassword))) err('Current password is incorrect');
      dbUser.password = newPassword;
      await dbUser.save();
      return { success: true, message: 'Password changed successfully' };
    },
  },

  User: {
    id: (u) => u._id,
    profile: (u) => Profile.findOne({ user: u._id }),
  },
};
