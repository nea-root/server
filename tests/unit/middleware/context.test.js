import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphQLError } from 'graphql';

vi.mock('../../../src/models/User.js', () => ({
  default: { findById: vi.fn() },
}));
vi.mock('../../../src/utils/jwt.js', () => ({
  verifyAccessToken: vi.fn(),
}));

import { buildContext, requireAuth, requireRole, requireVerified } from '../../../src/middleware/context.js';
import User from '../../../src/models/User.js';
import { verifyAccessToken } from '../../../src/utils/jwt.js';

const activeUser = { _id: 'u1', role: 'victim', isActive: true, isBanned: false, isEmailVerified: true };

describe('buildContext', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns { user: null } when no Authorization header', async () => {
    const ctx = await buildContext({ req: { headers: {} } });
    expect(ctx.user).toBeNull();
  });

  it('returns { user: null } when header does not start with Bearer', async () => {
    const ctx = await buildContext({ req: { headers: { authorization: 'Basic abc' } } });
    expect(ctx.user).toBeNull();
  });

  it('returns { user: null } when verifyAccessToken throws', async () => {
    verifyAccessToken.mockImplementation(() => { throw new Error('bad'); });
    const ctx = await buildContext({ req: { headers: { authorization: 'Bearer bad' } } });
    expect(ctx.user).toBeNull();
  });

  it('returns { user: null } when user not found in DB', async () => {
    verifyAccessToken.mockReturnValue({ userId: 'u1' });
    User.findById.mockResolvedValue(null);
    const ctx = await buildContext({ req: { headers: { authorization: 'Bearer token' } } });
    expect(ctx.user).toBeNull();
  });

  it('returns { user: null } when user is banned', async () => {
    verifyAccessToken.mockReturnValue({ userId: 'u1' });
    User.findById.mockResolvedValue({ ...activeUser, isBanned: true });
    const ctx = await buildContext({ req: { headers: { authorization: 'Bearer token' } } });
    expect(ctx.user).toBeNull();
  });

  it('returns { user: null } when user is inactive', async () => {
    verifyAccessToken.mockReturnValue({ userId: 'u1' });
    User.findById.mockResolvedValue({ ...activeUser, isActive: false });
    const ctx = await buildContext({ req: { headers: { authorization: 'Bearer token' } } });
    expect(ctx.user).toBeNull();
  });

  it('returns { user } for a valid active user', async () => {
    verifyAccessToken.mockReturnValue({ userId: 'u1' });
    User.findById.mockResolvedValue(activeUser);
    const ctx = await buildContext({ req: { headers: { authorization: 'Bearer good' } } });
    expect(ctx.user).toEqual(activeUser);
  });
});

describe('requireAuth', () => {
  it('throws UNAUTHENTICATED when user is null', () => {
    expect(() => requireAuth(null)).toThrow(GraphQLError);
    try { requireAuth(null); } catch (e) {
      expect(e.extensions.code).toBe('UNAUTHENTICATED');
    }
  });

  it('does not throw when user is present', () => {
    expect(() => requireAuth(activeUser)).not.toThrow();
  });
});

describe('requireRole', () => {
  it('throws UNAUTHENTICATED when user is null', () => {
    expect(() => requireRole(null, 'admin')).toThrow(GraphQLError);
  });

  it('throws FORBIDDEN when user has wrong role', () => {
    try { requireRole(activeUser, 'admin'); } catch (e) {
      expect(e.extensions.code).toBe('FORBIDDEN');
    }
  });

  it('does not throw when user has correct role', () => {
    expect(() => requireRole(activeUser, 'victim')).not.toThrow();
  });

  it('does not throw when user has one of multiple allowed roles', () => {
    expect(() => requireRole({ ...activeUser, role: 'lawyer' }, 'lawyer', 'therapist')).not.toThrow();
  });
});

describe('requireVerified', () => {
  it('throws FORBIDDEN when email is not verified', () => {
    try { requireVerified({ ...activeUser, isEmailVerified: false }); } catch (e) {
      expect(e.extensions.code).toBe('FORBIDDEN');
    }
  });

  it('does not throw for a verified user', () => {
    expect(() => requireVerified(activeUser)).not.toThrow();
  });
});
