import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphQLError } from 'graphql';

vi.mock('../../../src/models/User.js', () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock('../../../src/models/Profile.js', () => ({
  default: { create: vi.fn() },
}));
vi.mock('../../../src/utils/email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue({}),
  sendPasswordResetEmail: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../../src/utils/jwt.js', () => ({
  generateAccessToken: vi.fn().mockReturnValue('access_token'),
  generateRefreshToken: vi.fn().mockReturnValue('refresh_token'),
  verifyRefreshToken: vi.fn(),
}));

import { authResolvers } from '../../../src/resolvers/auth.resolver.js';
import User from '../../../src/models/User.js';
import Profile from '../../../src/models/Profile.js';
import { verifyRefreshToken } from '../../../src/utils/jwt.js';

const mockUser = (overrides = {}) => ({
  _id: 'uid1',
  email: 'test@example.com',
  role: 'victim',
  isEmailVerified: true,
  isActive: true,
  isBanned: false,
  refreshTokens: [],
  lastLoginAt: null,
  comparePassword: vi.fn().mockResolvedValue(true),
  save: vi.fn().mockResolvedValue(true),
  toSafeObject: vi.fn().mockReturnValue({}),
  ...overrides,
});

const ctx = (user = null) => ({ user });

describe('authResolvers.Query.me', () => {
  it('returns the current user', () => {
    const user = mockUser();
    expect(authResolvers.Query.me(null, null, ctx(user))).toBe(user);
  });

  it('throws UNAUTHENTICATED when not logged in', () => {
    expect(() => authResolvers.Query.me(null, null, ctx(null))).toThrow(GraphQLError);
  });
});

describe('authResolvers.Mutation.register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws if email already exists', async () => {
    User.findOne.mockResolvedValue(mockUser());
    await expect(
      authResolvers.Mutation.register(null, { email: 'x@x.com', password: 'pass1234', role: 'victim' })
    ).rejects.toThrow(GraphQLError);
  });

  it('creates user and profile', async () => {
    User.findOne.mockResolvedValue(null);
    const created = mockUser();
    User.create.mockResolvedValue(created);
    Profile.create.mockResolvedValue({});

    const result = await authResolvers.Mutation.register(null, {
      email: 'new@test.com', password: 'pass1234', role: 'victim',
    });
    expect(result.userId).toBeDefined();
    expect(Profile.create).toHaveBeenCalledWith({ user: created._id });
  });

  it('sets anonymousAlias when isAnonymous is true', async () => {
    User.findOne.mockResolvedValue(null);
    const created = mockUser();
    User.create.mockResolvedValue(created);
    Profile.create.mockResolvedValue({});

    await authResolvers.Mutation.register(null, {
      email: 'anon@test.com', password: 'pass1234', role: 'victim', isAnonymous: true,
    });
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({ anonymousAlias: expect.any(String) })
    );
  });
});

describe('authResolvers.Mutation.verifyEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws NOT_FOUND when user missing', async () => {
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
    await expect(
      authResolvers.Mutation.verifyEmail(null, { userId: 'bad', code: '123456' })
    ).rejects.toThrow(GraphQLError);
  });

  it('throws if already verified', async () => {
    User.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(mockUser({ isEmailVerified: true })),
    });
    await expect(
      authResolvers.Mutation.verifyEmail(null, { userId: 'uid1', code: '123456' })
    ).rejects.toThrow(GraphQLError);
  });

  it('throws when code does not match', async () => {
    User.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(mockUser({
        isEmailVerified: false,
        emailVerificationCode: '111111',
        emailVerificationExpires: new Date(Date.now() + 60000),
      })),
    });
    await expect(
      authResolvers.Mutation.verifyEmail(null, { userId: 'uid1', code: '999999' })
    ).rejects.toThrow(GraphQLError);
  });

  it('verifies email successfully', async () => {
    const user = mockUser({
      isEmailVerified: false,
      emailVerificationCode: '123456',
      emailVerificationExpires: new Date(Date.now() + 60000),
    });
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });
    const result = await authResolvers.Mutation.verifyEmail(null, { userId: 'uid1', code: '123456' });
    expect(result.success).toBe(true);
    expect(user.isEmailVerified).toBe(true);
  });
});

describe('authResolvers.Mutation.login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws UNAUTHENTICATED for unknown email', async () => {
    User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
    await expect(
      authResolvers.Mutation.login(null, { email: 'no@test.com', password: 'pass' })
    ).rejects.toThrow(GraphQLError);
  });

  it('throws UNAUTHENTICATED for wrong password', async () => {
    const user = mockUser({ comparePassword: vi.fn().mockResolvedValue(false) });
    User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });
    await expect(
      authResolvers.Mutation.login(null, { email: 'test@test.com', password: 'wrong' })
    ).rejects.toThrow(GraphQLError);
  });

  it('throws FORBIDDEN when email not verified', async () => {
    const user = mockUser({ isEmailVerified: false });
    User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });
    await expect(
      authResolvers.Mutation.login(null, { email: 'test@test.com', password: 'pass' })
    ).rejects.toThrow(GraphQLError);
  });

  it('throws FORBIDDEN when account is banned', async () => {
    const user = mockUser({ isBanned: true });
    User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });
    await expect(
      authResolvers.Mutation.login(null, { email: 'test@test.com', password: 'pass' })
    ).rejects.toThrow(GraphQLError);
  });

  it('returns tokens and user on success', async () => {
    const user = mockUser();
    User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });
    const result = await authResolvers.Mutation.login(null, { email: 'test@test.com', password: 'pass' });
    expect(result.accessToken).toBe('access_token');
    expect(result.refreshToken).toBe('refresh_token');
  });
});

describe('authResolvers.Mutation.logout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws UNAUTHENTICATED when not logged in', async () => {
    await expect(
      authResolvers.Mutation.logout(null, {}, ctx(null))
    ).rejects.toThrow(GraphQLError);
  });

  it('removes the refresh token and returns success', async () => {
    const user = mockUser({ refreshTokens: ['rt1', 'rt2'] });
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });
    const result = await authResolvers.Mutation.logout(null, { refreshToken: 'rt1' }, ctx(user));
    expect(result.success).toBe(true);
    expect(user.refreshTokens).not.toContain('rt1');
  });
});

describe('authResolvers.Mutation.resendVerification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing but returns success when user not found', async () => {
    User.findOne.mockResolvedValue(null);
    const result = await authResolvers.Mutation.resendVerification(null, { email: 'nobody@x.com' });
    expect(result.success).toBe(true);
  });

  it('does nothing when user already verified', async () => {
    User.findOne.mockResolvedValue(mockUser({ isEmailVerified: true }));
    const result = await authResolvers.Mutation.resendVerification(null, { email: 'test@x.com' });
    expect(result.success).toBe(true);
  });

  it('sends a new code when user exists and unverified', async () => {
    const user = mockUser({ isEmailVerified: false });
    User.findOne.mockResolvedValue(user);
    const result = await authResolvers.Mutation.resendVerification(null, { email: 'test@x.com' });
    expect(result.success).toBe(true);
    expect(user.save).toHaveBeenCalled();
  });
});

describe('authResolvers.Mutation.verifyResetCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when user not found', async () => {
    User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
    await expect(
      authResolvers.Mutation.verifyResetCode(null, { email: 'x@x.com', code: '123456' })
    ).rejects.toThrow(GraphQLError);
  });

  it('throws when code does not match', async () => {
    User.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue(mockUser({
        passwordResetCode: '999999',
        passwordResetExpires: new Date(Date.now() + 60000),
      })),
    });
    await expect(
      authResolvers.Mutation.verifyResetCode(null, { email: 'x@x.com', code: '123456' })
    ).rejects.toThrow(GraphQLError);
  });

  it('throws when code is expired', async () => {
    User.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue(mockUser({
        passwordResetCode: '123456',
        passwordResetExpires: new Date(Date.now() - 60000),
      })),
    });
    await expect(
      authResolvers.Mutation.verifyResetCode(null, { email: 'x@x.com', code: '123456' })
    ).rejects.toThrow(GraphQLError);
  });

  it('returns resetToken on valid code', async () => {
    const user = mockUser({
      passwordResetCode: '123456',
      passwordResetExpires: new Date(Date.now() + 60000),
    });
    User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });
    const result = await authResolvers.Mutation.verifyResetCode(null, { email: 'x@x.com', code: '123456' });
    expect(result.resetToken).toBeDefined();
  });
});

describe('authResolvers.Mutation.forgotPassword', () => {
  it('always returns success (no user enumeration)', async () => {
    User.findOne.mockResolvedValue(null);
    const result = await authResolvers.Mutation.forgotPassword(null, { email: 'x@x.com' });
    expect(result.success).toBe(true);
  });

  it('saves reset code when user exists', async () => {
    const user = mockUser();
    User.findOne.mockResolvedValue(user);
    await authResolvers.Mutation.forgotPassword(null, { email: 'test@test.com' });
    expect(user.save).toHaveBeenCalled();
  });
});

describe('authResolvers.Mutation.resetPassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when token is invalid', async () => {
    User.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue(mockUser({
        passwordResetCode: 'verified:wrongtoken',
        passwordResetExpires: new Date(Date.now() + 60000),
      })),
    });
    await expect(
      authResolvers.Mutation.resetPassword(null, { email: 'x@x.com', resetToken: 'badtoken', newPassword: 'newpass123' })
    ).rejects.toThrow(GraphQLError);
  });

  it('resets password when token is valid', async () => {
    const user = mockUser({
      passwordResetCode: 'verified:goodtoken',
      passwordResetExpires: new Date(Date.now() + 60000),
    });
    User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });
    const result = await authResolvers.Mutation.resetPassword(
      null, { email: 'x@x.com', resetToken: 'goodtoken', newPassword: 'newpass123' }
    );
    expect(result.success).toBe(true);
    expect(user.password).toBe('newpass123');
  });
});

describe('authResolvers.Mutation.changePassword', () => {
  it('throws UNAUTHENTICATED when not logged in', async () => {
    await expect(
      authResolvers.Mutation.changePassword(null, { currentPassword: 'a', newPassword: 'b' }, ctx(null))
    ).rejects.toThrow(GraphQLError);
  });

  it('throws when current password is wrong', async () => {
    const user = mockUser();
    const dbUser = mockUser({ comparePassword: vi.fn().mockResolvedValue(false) });
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(dbUser) });
    await expect(
      authResolvers.Mutation.changePassword(null, { currentPassword: 'wrong', newPassword: 'new' }, ctx(user))
    ).rejects.toThrow(GraphQLError);
  });

  it('changes password successfully', async () => {
    const user = mockUser();
    const dbUser = mockUser();
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(dbUser) });
    const result = await authResolvers.Mutation.changePassword(
      null, { currentPassword: 'current', newPassword: 'newpass' }, ctx(user)
    );
    expect(result.success).toBe(true);
    expect(dbUser.password).toBe('newpass');
  });
});

describe('authResolvers.Mutation.refreshToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws UNAUTHENTICATED on invalid token', async () => {
    verifyRefreshToken.mockImplementation(() => { throw new Error('bad'); });
    await expect(
      authResolvers.Mutation.refreshToken(null, { refreshToken: 'bad' })
    ).rejects.toThrow(GraphQLError);
  });

  it('throws when token not in user record', async () => {
    verifyRefreshToken.mockReturnValue({ userId: 'u1' });
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(mockUser({ refreshTokens: [] })) });
    await expect(
      authResolvers.Mutation.refreshToken(null, { refreshToken: 'token_not_stored' })
    ).rejects.toThrow(GraphQLError);
  });

  it('returns new tokens on success', async () => {
    verifyRefreshToken.mockReturnValue({ userId: 'u1' });
    const user = mockUser({ refreshTokens: ['old_refresh'] });
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });
    const result = await authResolvers.Mutation.refreshToken(null, { refreshToken: 'old_refresh' });
    expect(result.accessToken).toBe('access_token');
    expect(result.refreshToken).toBe('refresh_token');
  });
});
