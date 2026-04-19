import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) await collections[key].deleteMany({}); // eslint-disable-line no-await-in-loop
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// ─── Profile ──────────────────────────────────────────────────────────────────
import Profile from '../../../src/models/Profile.js';
import User from '../../../src/models/User.js';

describe('Profile model', () => {
  it('creates a profile with required user reference', async () => {
    const user = await User.create({ email: 'p@t.com', password: 'pass1234', role: 'victim' });
    const profile = await Profile.create({ user: user._id });
    expect(profile._id).toBeDefined();
    expect(profile.averageRating).toBe(0);
    expect(profile.totalReviews).toBe(0);
  });

  it('enforces unique user reference', async () => {
    const user = await User.create({ email: 'p2@t.com', password: 'pass1234', role: 'victim' });
    await Profile.create({ user: user._id });
    await expect(Profile.create({ user: user._id })).rejects.toThrow();
  });

  it('accepts valid gender enum values', async () => {
    const user = await User.create({ email: 'p3@t.com', password: 'pass1234', role: 'victim' });
    const profile = await Profile.create({ user: user._id, gender: 'female' });
    expect(profile.gender).toBe('female');
  });

  it('accepts valid currency enum', async () => {
    const user = await User.create({ email: 'p4@t.com', password: 'pass1234', role: 'lawyer' });
    const profile = await Profile.create({ user: user._id, currency: 'GBP' });
    expect(profile.currency).toBe('GBP');
  });
});

// ─── Document ─────────────────────────────────────────────────────────────────
import Document from '../../../src/models/Document.js';

describe('Document model', () => {
  it('creates a valid document', async () => {
    const user = await User.create({ email: 'doc@t.com', password: 'pass1234', role: 'victim' });
    const doc = await Document.create({
      owner: user._id,
      type: 'evidence',
      title: 'My Evidence',
      fileUrl: '/uploads/test.pdf',
      fileName: 'test.pdf',
    });
    expect(doc._id).toBeDefined();
    expect(doc.verificationStatus).toBe('pending');
    expect(doc.notes).toEqual([]);
  });

  it('rejects invalid document type', async () => {
    const user = await User.create({ email: 'doc2@t.com', password: 'pass1234', role: 'victim' });
    await expect(
      Document.create({
        owner: user._id,
        type: 'invalid_type',
        title: 'X',
        fileUrl: '/f',
        fileName: 'f',
      }),
    ).rejects.toThrow();
  });

  it('rejects invalid verification status', async () => {
    const user = await User.create({ email: 'doc3@t.com', password: 'pass1234', role: 'victim' });
    await expect(
      Document.create({
        owner: user._id,
        type: 'evidence',
        title: 'X',
        fileUrl: '/f',
        fileName: 'f',
        verificationStatus: 'approved',
      }),
    ).rejects.toThrow();
  });

  it('stores notes as subdocuments', async () => {
    const user = await User.create({ email: 'doc4@t.com', password: 'pass1234', role: 'victim' });
    const doc = await Document.create({
      owner: user._id,
      type: 'evidence',
      title: 'X',
      fileUrl: '/f',
      fileName: 'f',
      notes: [{ content: 'Important note', addedBy: user._id }],
    });
    expect(doc.notes.length).toBe(1);
    expect(doc.notes[0].isStarred).toBe(false);
  });
});

// ─── Availability ─────────────────────────────────────────────────────────────
import Availability from '../../../src/models/Availability.js';

describe('Availability model', () => {
  it('creates availability with defaults', async () => {
    const user = await User.create({ email: 'av@t.com', password: 'pass1234', role: 'lawyer' });
    const av = await Availability.create({ professional: user._id, weeklyIntervals: [] });
    expect(av.timezone).toBe('UTC');
    expect(av.sessionDurationMinutes).toBe(60);
    expect(av.isAcceptingClients).toBe(true);
  });

  it('enforces unique professional', async () => {
    const user = await User.create({ email: 'av2@t.com', password: 'pass1234', role: 'lawyer' });
    await Availability.create({ professional: user._id, weeklyIntervals: [] });
    await expect(
      Availability.create({ professional: user._id, weeklyIntervals: [] }),
    ).rejects.toThrow();
  });

  it('accepts valid session durations', async () => {
    const user = await User.create({ email: 'av3@t.com', password: 'pass1234', role: 'therapist' });
    const av = await Availability.create({
      professional: user._id,
      weeklyIntervals: [],
      sessionDurationMinutes: 30,
    });
    expect(av.sessionDurationMinutes).toBe(30);
  });
});

// ─── Appointment ──────────────────────────────────────────────────────────────
import Appointment from '../../../src/models/Appointment.js';

describe('Appointment model', () => {
  it('creates a valid appointment', async () => {
    const client = await User.create({ email: 'cl@t.com', password: 'pass1234', role: 'victim' });
    const prof = await User.create({ email: 'pr@t.com', password: 'pass1234', role: 'lawyer' });
    const start = new Date('2027-01-01T10:00:00Z');
    const end = new Date('2027-01-01T11:00:00Z');
    const appt = await Appointment.create({
      client: client._id,
      professional: prof._id,
      professionalType: 'lawyer',
      startTime: start,
      endTime: end,
      durationMinutes: 60,
    });
    expect(appt.status).toBe('pending');
    expect(appt.meetingRoomId).toBeDefined();
  });

  it('rejects invalid professionalType', async () => {
    const u = await User.create({ email: 'ca@t.com', password: 'pass1234', role: 'victim' });
    await expect(
      Appointment.create({
        client: u._id,
        professional: u._id,
        professionalType: 'nurse',
        startTime: new Date(),
        endTime: new Date(),
        durationMinutes: 60,
      }),
    ).rejects.toThrow();
  });

  it('defaults reminderSent to false', async () => {
    const u = await User.create({ email: 'cb@t.com', password: 'pass1234', role: 'victim' });
    const appt = await Appointment.create({
      client: u._id,
      professional: u._id,
      professionalType: 'lawyer',
      startTime: new Date(),
      endTime: new Date(),
      durationMinutes: 60,
    });
    expect(appt.reminderSent).toBe(false);
  });
});

// ─── Chat & Message ───────────────────────────────────────────────────────────
import Chat from '../../../src/models/Chat.js';
import Message from '../../../src/models/Message.js';

describe('Chat model', () => {
  it('creates a chat with default type', async () => {
    const u1 = await User.create({ email: 'ch1@t.com', password: 'pass1234', role: 'victim' });
    const u2 = await User.create({ email: 'ch2@t.com', password: 'pass1234', role: 'volunteer' });
    const chat = await Chat.create({ participants: [u1._id, u2._id] });
    expect(chat.type).toBe('direct');
    expect(chat.isActive).toBe(true);
  });

  it('accepts anonymous_support type', async () => {
    const u1 = await User.create({ email: 'ch3@t.com', password: 'pass1234', role: 'victim' });
    const u2 = await User.create({ email: 'ch4@t.com', password: 'pass1234', role: 'volunteer' });
    const chat = await Chat.create({ participants: [u1._id, u2._id], type: 'anonymous_support' });
    expect(chat.type).toBe('anonymous_support');
  });
});

describe('Message model', () => {
  it('creates a text message', async () => {
    const u = await User.create({ email: 'ms@t.com', password: 'pass1234', role: 'victim' });
    const u2 = await User.create({ email: 'ms2@t.com', password: 'pass1234', role: 'volunteer' });
    const chat = await Chat.create({ participants: [u._id, u2._id] });
    const msg = await Message.create({ chat: chat._id, sender: u._id, content: 'Hello' });
    expect(msg.type).toBe('text');
    expect(msg.isRead).toBe(false);
    expect(msg.isDeleted).toBe(false);
  });
});

// ─── Payment & Subscription ───────────────────────────────────────────────────
import Payment from '../../../src/models/Payment.js';
import Subscription from '../../../src/models/Subscription.js';

describe('Payment model', () => {
  it('creates a payment with defaults', async () => {
    const u = await User.create({ email: 'pay@t.com', password: 'pass1234', role: 'victim' });
    const p = await Payment.create({
      payer: u._id,
      type: 'appointment',
      amount: 100,
      currency: 'USD',
    });
    expect(p.status).toBe('pending');
  });

  it('rejects invalid currency', async () => {
    const u = await User.create({ email: 'pay2@t.com', password: 'pass1234', role: 'victim' });
    await expect(
      Payment.create({ payer: u._id, type: 'appointment', amount: 50, currency: 'EUR' }),
    ).rejects.toThrow();
  });

  it('rejects invalid type', async () => {
    const u = await User.create({ email: 'pay3@t.com', password: 'pass1234', role: 'victim' });
    await expect(
      Payment.create({ payer: u._id, type: 'gift', amount: 50, currency: 'USD' }),
    ).rejects.toThrow();
  });
});

describe('Subscription model', () => {
  it('creates a subscription with defaults', async () => {
    const u = await User.create({ email: 'sub@t.com', password: 'pass1234', role: 'victim' });
    const s = await Subscription.create({ user: u._id });
    expect(s.plan).toBe('free');
    expect(s.status).toBe('active');
    expect(s.cancelAtPeriodEnd).toBe(false);
  });
});

// ─── Notification ─────────────────────────────────────────────────────────────
import Notification from '../../../src/models/Notification.js';

describe('Notification model', () => {
  it('creates a notification', async () => {
    const u = await User.create({ email: 'nf@t.com', password: 'pass1234', role: 'victim' });
    const n = await Notification.create({
      recipient: u._id,
      type: 'system',
      title: 'Hello',
      body: 'World',
    });
    expect(n.isRead).toBe(false);
    expect(n.readAt).toBeUndefined();
  });

  it('rejects invalid notification type', async () => {
    const u = await User.create({ email: 'nf2@t.com', password: 'pass1234', role: 'victim' });
    await expect(
      Notification.create({
        recipient: u._id,
        type: 'unknown_type',
        title: 'X',
        body: 'Y',
      }),
    ).rejects.toThrow();
  });
});

// ─── SosEvent ─────────────────────────────────────────────────────────────────
import SosEvent from '../../../src/models/SosEvent.js';

describe('SosEvent model', () => {
  it('creates a SOS event with default status', async () => {
    const u = await User.create({ email: 'sos@t.com', password: 'pass1234', role: 'victim' });
    const s = await SosEvent.create({
      triggeredBy: u._id,
      location: { type: 'Point', coordinates: [0, 0] },
    });
    expect(s.status).toBe('triggered');
  });

  it('stores geolocation coordinates', async () => {
    const u = await User.create({ email: 'sos2@t.com', password: 'pass1234', role: 'victim' });
    const s = await SosEvent.create({
      triggeredBy: u._id,
      location: { type: 'Point', coordinates: [-0.1, 51.5] },
    });
    expect(s.location.coordinates).toEqual([-0.1, 51.5]);
  });
});

// ─── AwarenessArticle ─────────────────────────────────────────────────────────
import AwarenessArticle from '../../../src/models/AwarenessArticle.js';

describe('AwarenessArticle model', () => {
  it('creates an article with defaults', async () => {
    const a = await AwarenessArticle.create({
      title: 'Safety Guide',
      slug: 'safety-guide',
      content: 'Content body',
    });
    expect(a.isPublished).toBe(false);
    expect(a.viewCount).toBe(0);
    expect(a.tags).toEqual([]);
  });

  it('enforces unique slug', async () => {
    await AwarenessArticle.create({ title: 'A', slug: 'unique-slug', content: 'c' });
    await expect(
      AwarenessArticle.create({ title: 'B', slug: 'unique-slug', content: 'd' }),
    ).rejects.toThrow();
  });

  it('accepts valid category enum', async () => {
    const a = await AwarenessArticle.create({
      title: 'Legal',
      slug: 'legal-rights',
      content: 'c',
      category: 'legal_rights',
    });
    expect(a.category).toBe('legal_rights');
  });
});

// ─── Review ───────────────────────────────────────────────────────────────────
import Review from '../../../src/models/Review.js';

describe('Review model', () => {
  it('creates a review', async () => {
    const reviewer = await User.create({ email: 'rv@t.com', password: 'pass1234', role: 'victim' });
    const prof = await User.create({ email: 'rv2@t.com', password: 'pass1234', role: 'lawyer' });
    const r = await Review.create({ reviewer: reviewer._id, professional: prof._id, rating: 4 });
    expect(r.isAnonymous).toBe(true);
    expect(r.rating).toBe(4);
  });

  it('rejects rating out of range', async () => {
    const u = await User.create({ email: 'rv3@t.com', password: 'pass1234', role: 'victim' });
    await expect(
      Review.create({ reviewer: u._id, professional: u._id, rating: 6 }),
    ).rejects.toThrow();
  });

  it('enforces unique reviewer-professional pair', async () => {
    const u1 = await User.create({ email: 'rv4@t.com', password: 'pass1234', role: 'victim' });
    const u2 = await User.create({ email: 'rv5@t.com', password: 'pass1234', role: 'lawyer' });
    await Review.create({ reviewer: u1._id, professional: u2._id, rating: 5 });
    await expect(
      Review.create({ reviewer: u1._id, professional: u2._id, rating: 3 }),
    ).rejects.toThrow();
  });
});
