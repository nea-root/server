import { describe, it, expect, vi } from 'vitest';
import { Kind } from 'graphql';

// Mock all models and dependencies so resolvers.js can be imported cleanly
vi.mock('../../../src/models/User.js', () => ({ default: {} }));
vi.mock('../../../src/models/Profile.js', () => ({ default: {} }));
vi.mock('../../../src/models/Document.js', () => ({ default: {} }));
vi.mock('../../../src/models/Availability.js', () => ({ default: {} }));
vi.mock('../../../src/models/Appointment.js', () => ({ default: {} }));
vi.mock('../../../src/models/Chat.js', () => ({ default: {} }));
vi.mock('../../../src/models/Message.js', () => ({ default: {} }));
vi.mock('../../../src/models/Payment.js', () => ({ default: {} }));
vi.mock('../../../src/models/Subscription.js', () => ({ default: {} }));
vi.mock('../../../src/models/Notification.js', () => ({ default: {} }));
vi.mock('../../../src/models/SosEvent.js', () => ({ default: {} }));
vi.mock('../../../src/models/Review.js', () => ({ default: {} }));
vi.mock('../../../src/models/AwarenessArticle.js', () => ({ default: {} }));
vi.mock('../../../src/utils/email.js', () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendAppointmentEmail: vi.fn(),
}));
vi.mock('../../../src/utils/jwt.js', () => ({
  generateAccessToken: vi.fn(),
  generateRefreshToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
  verifyAccessToken: vi.fn(),
}));
vi.mock('../../../src/middleware/context.js', () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  requireVerified: vi.fn(),
  buildContext: vi.fn(),
}));

import { resolvers } from '../../../resolvers.js';

describe('resolvers index', () => {
  it('exports a Date scalar', () => {
    expect(resolvers.Date).toBeDefined();
    expect(typeof resolvers.Date.serialize).toBe('function');
    expect(typeof resolvers.Date.parseValue).toBe('function');
    expect(typeof resolvers.Date.parseLiteral).toBe('function');
  });

  it('Date.serialize converts Date to ISO string', () => {
    const d = new Date('2026-01-01T00:00:00.000Z');
    expect(resolvers.Date.serialize(d)).toBe('2026-01-01T00:00:00.000Z');
  });

  it('Date.serialize stringifies non-Date values', () => {
    expect(resolvers.Date.serialize('2026-01-01')).toBe('2026-01-01');
  });

  it('Date.parseValue parses a date string', () => {
    const d = resolvers.Date.parseValue('2026-01-01T00:00:00.000Z');
    expect(d instanceof Date).toBe(true);
  });

  it('Date.parseLiteral parses a StringValue AST node', () => {
    const ast = { kind: Kind.STRING, value: '2026-06-01T00:00:00.000Z' };
    const d = resolvers.Date.parseLiteral(ast);
    expect(d instanceof Date).toBe(true);
  });

  it('Date.parseLiteral returns null for non-string AST nodes', () => {
    const ast = { kind: Kind.INT, value: '123' };
    expect(resolvers.Date.parseLiteral(ast)).toBeNull();
  });

  it('exports Query with all expected resolvers', () => {
    const keys = Object.keys(resolvers.Query);
    expect(keys).toContain('me');
    expect(keys).toContain('appointments');
    expect(keys).toContain('chats');
    expect(keys).toContain('articles');
    expect(keys).toContain('sosHistory');
    expect(keys.length).toBeGreaterThanOrEqual(19);
  });

  it('exports Mutation with all expected resolvers', () => {
    const keys = Object.keys(resolvers.Mutation);
    expect(keys).toContain('register');
    expect(keys).toContain('login');
    expect(keys).toContain('bookAppointment');
    expect(keys).toContain('triggerSOS');
    expect(keys.length).toBeGreaterThanOrEqual(37);
  });
});
