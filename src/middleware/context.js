import { GraphQLError } from 'graphql';
import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/User.js';

export const buildContext = async ({ req }) => {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return { user: null };
  const token = auth.split(' ')[1];
  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive || user.isBanned) return { user: null };
    return { user };
  } catch {
    return { user: null };
  }
};

export const requireAuth = (user) => {
  if (!user) throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
};

export const requireRole = (user, ...roles) => {
  requireAuth(user);
  if (!roles.includes(user.role)) {
    throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } });
  }
};

export const requireVerified = (user) => {
  requireAuth(user);
  if (!user.isEmailVerified) {
    throw new GraphQLError('Email not verified', { extensions: { code: 'FORBIDDEN' } });
  }
};
