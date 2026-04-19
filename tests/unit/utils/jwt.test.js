import { describe, it, expect } from 'vitest';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../../src/utils/jwt.js';

const payload = { userId: 'user123', role: 'victim' };

describe('JWT utils', () => {
  describe('generateAccessToken', () => {
    it('returns a string token', () => {
      expect(typeof generateAccessToken(payload)).toBe('string');
    });

    it('produces different tokens for different payloads', () => {
      const t1 = generateAccessToken(payload);
      const t2 = generateAccessToken({ userId: 'other', role: 'admin' });
      expect(t1).not.toBe(t2);
    });
  });

  describe('generateRefreshToken', () => {
    it('returns a string token', () => {
      expect(typeof generateRefreshToken(payload)).toBe('string');
    });

    it('produces a different token than the access token', () => {
      expect(generateRefreshToken(payload)).not.toBe(generateAccessToken(payload));
    });
  });

  describe('verifyAccessToken', () => {
    it('decodes a valid access token', () => {
      const token = generateAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.role).toBe(payload.role);
    });

    it('throws on tampered token', () => {
      expect(() => verifyAccessToken('bad.token.here')).toThrow();
    });

    it('throws when a refresh token is passed to verifyAccessToken', () => {
      const refresh = generateRefreshToken(payload);
      expect(() => verifyAccessToken(refresh)).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('decodes a valid refresh token', () => {
      const token = generateRefreshToken(payload);
      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe(payload.userId);
    });

    it('throws on tampered token', () => {
      expect(() => verifyRefreshToken('bad.token.here')).toThrow();
    });

    it('throws when an access token is passed to verifyRefreshToken', () => {
      const access = generateAccessToken(payload);
      expect(() => verifyRefreshToken(access)).toThrow();
    });
  });
});
