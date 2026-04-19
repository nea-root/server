import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../../../src/models/User.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const validUser = () => ({
  email: 'test@example.com',
  password: 'password123',
  role: 'victim',
});

describe('User model', () => {
  describe('schema validation', () => {
    it('saves a valid user', async () => {
      const user = await User.create(validUser());
      expect(user._id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe('victim');
    });

    it('enforces unique email', async () => {
      await User.create(validUser());
      await expect(User.create(validUser())).rejects.toThrow();
    });

    it('rejects invalid role', async () => {
      await expect(User.create({ ...validUser(), role: 'hacker' })).rejects.toThrow();
    });

    it('requires email', async () => {
      await expect(User.create({ password: 'pass1234', role: 'victim' })).rejects.toThrow();
    });

    it('requires password', async () => {
      await expect(User.create({ email: 'a@b.com', role: 'victim' })).rejects.toThrow();
    });

    it('lowercases email', async () => {
      const user = await User.create({ ...validUser(), email: 'TEST@EXAMPLE.COM' });
      expect(user.email).toBe('test@example.com');
    });

    it('defaults isEmailVerified to false', async () => {
      const user = await User.create(validUser());
      expect(user.isEmailVerified).toBe(false);
    });

    it('defaults isActive to true', async () => {
      const user = await User.create(validUser());
      expect(user.isActive).toBe(true);
    });

    it('defaults isAnonymous to false', async () => {
      const user = await User.create(validUser());
      expect(user.isAnonymous).toBe(false);
    });
  });

  describe('password hashing', () => {
    it('hashes password on save', async () => {
      const user = await User.create(validUser());
      const raw = await User.findById(user._id).select('+password');
      expect(raw.password).not.toBe('password123');
      expect(raw.password.startsWith('$2')).toBe(true);
    });

    it('does not re-hash on unrelated field save', async () => {
      const user = await User.create(validUser());
      const rawBefore = await User.findById(user._id).select('+password');
      rawBefore.firstName = 'Alice';
      await rawBefore.save();
      const rawAfter = await User.findById(user._id).select('+password');
      expect(rawAfter.password).toBe(rawBefore.password);
    });
  });

  describe('comparePassword', () => {
    it('returns true for correct password', async () => {
      const user = await User.create(validUser());
      const found = await User.findById(user._id).select('+password');
      expect(await found.comparePassword('password123')).toBe(true);
    });

    it('returns false for wrong password', async () => {
      const user = await User.create(validUser());
      const found = await User.findById(user._id).select('+password');
      expect(await found.comparePassword('wrongpass')).toBe(false);
    });
  });

  describe('timestamps', () => {
    it('adds createdAt and updatedAt', async () => {
      const user = await User.create(validUser());
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });
  });

  describe('allowed roles', () => {
    const roles = ['victim', 'volunteer', 'lawyer', 'therapist', 'admin'];
    for (const role of roles) {
      it(`accepts role: ${role}`, async () => {
        const u = await User.create({ email: `${role}@test.com`, password: 'pass1234', role });
        expect(u.role).toBe(role);
      });
    }
  });
});
