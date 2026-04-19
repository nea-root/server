import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/models/User.js', () => ({
  default: { findById: vi.fn().mockResolvedValue({ _id: 'u1', firstName: 'Alice' }) },
}));
vi.mock('../../../src/models/Profile.js', () => ({
  default: { findOne: vi.fn().mockResolvedValue({ _id: 'p1', bio: 'Hi' }) },
}));
vi.mock('../../../src/models/Chat.js', () => ({
  default: { findById: vi.fn().mockResolvedValue({ _id: 'c1' }), find: vi.fn(), findOne: vi.fn(), findByIdAndUpdate: vi.fn(), create: vi.fn() },
}));
vi.mock('../../../src/models/Message.js', () => ({
  default: { findById: vi.fn().mockResolvedValue({ _id: 'm1' }), find: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
}));
vi.mock('../../../src/models/Document.js', () => ({
  default: { findById: vi.fn(), find: vi.fn(), countDocuments: vi.fn() },
}));
vi.mock('../../../src/models/Availability.js', () => ({
  default: { findOne: vi.fn(), findOneAndUpdate: vi.fn() },
}));
vi.mock('../../../src/models/Appointment.js', () => ({
  default: { findById: vi.fn(), find: vi.fn(), findOne: vi.fn(), create: vi.fn() },
}));
vi.mock('../../../src/models/Payment.js', () => ({
  default: { findById: vi.fn(), find: vi.fn(), create: vi.fn() },
}));
vi.mock('../../../src/models/Subscription.js', () => ({
  default: { findOne: vi.fn(), create: vi.fn() },
}));
vi.mock('../../../src/models/Notification.js', () => ({
  default: { find: vi.fn(), updateMany: vi.fn(), findOneAndDelete: vi.fn(), countDocuments: vi.fn() },
}));
vi.mock('../../../src/models/SosEvent.js', () => ({
  default: { create: vi.fn(), find: vi.fn(), findByIdAndUpdate: vi.fn() },
}));
vi.mock('../../../src/models/Review.js', () => ({
  default: { find: vi.fn(), findOne: vi.fn(), create: vi.fn() },
}));
vi.mock('../../../src/models/AwarenessArticle.js', () => ({
  default: { find: vi.fn(), findOne: vi.fn(), findByIdAndUpdate: vi.fn(), findByIdAndDelete: vi.fn(), create: vi.fn() },
}));
vi.mock('../../../src/utils/email.js', () => ({
  sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn(), sendAppointmentEmail: vi.fn(),
}));
vi.mock('../../../src/utils/jwt.js', () => ({
  generateAccessToken: vi.fn(), generateRefreshToken: vi.fn(),
  verifyRefreshToken: vi.fn(), verifyAccessToken: vi.fn(),
}));

import { authResolvers } from '../../../src/resolvers/auth.resolver.js';
import { profileResolvers } from '../../../src/resolvers/profile.resolver.js';
import { documentResolvers } from '../../../src/resolvers/document.resolver.js';
import { availabilityResolvers } from '../../../src/resolvers/availability.resolver.js';
import { appointmentResolvers } from '../../../src/resolvers/appointment.resolver.js';
import { chatResolvers } from '../../../src/resolvers/chat.resolver.js';
import { paymentResolvers } from '../../../src/resolvers/payment.resolver.js';
import { notificationResolvers } from '../../../src/resolvers/notification.resolver.js';
import { sosResolvers } from '../../../src/resolvers/sos.resolver.js';
import { reviewResolvers } from '../../../src/resolvers/review.resolver.js';
import { awarenessResolvers } from '../../../src/resolvers/awareness.resolver.js';
import User from '../../../src/models/User.js';
import Profile from '../../../src/models/Profile.js';

// ─── Auth / User field resolvers ──────────────────────────────────────────────
describe('User type resolvers', () => {
  it('User.id returns _id', () => {
    expect(authResolvers.User.id({ _id: 'u1' })).toBe('u1');
  });

  it('User.profile calls Profile.findOne', async () => {
    Profile.findOne.mockResolvedValue({ _id: 'p1' });
    const result = await authResolvers.User.profile({ _id: 'u1' });
    expect(Profile.findOne).toHaveBeenCalledWith({ user: 'u1' });
  });
});

// ─── Profile field resolvers ──────────────────────────────────────────────────
describe('Profile type resolvers', () => {
  it('Profile.id returns _id', () => {
    expect(profileResolvers.Profile.id({ _id: 'p1' })).toBe('p1');
  });

  it('Profile.user returns populated user object when already populated', async () => {
    const populated = { _id: 'u1', firstName: 'Alice' };
    const result = await profileResolvers.Profile.user({ user: populated });
    expect(result).toBe(populated);
  });

  it('Profile.user fetches from DB when only ID stored', async () => {
    User.findById.mockResolvedValue({ _id: 'u1' });
    await profileResolvers.Profile.user({ user: 'u1' });
    expect(User.findById).toHaveBeenCalledWith('u1');
  });
});

// ─── Document field resolvers ─────────────────────────────────────────────────
describe('Document type resolvers', () => {
  it('Document.id returns _id', () => {
    expect(documentResolvers.Document.id({ _id: 'd1' })).toBe('d1');
  });

  it('Document.owner returns populated owner', async () => {
    const owner = { _id: 'u1' };
    const result = await documentResolvers.Document.owner({ owner });
    expect(result).toBe(owner);
  });

  it('Document.owner fetches when only ID', async () => {
    User.findById.mockResolvedValue({ _id: 'u1' });
    await documentResolvers.Document.owner({ owner: 'u1' });
    expect(User.findById).toHaveBeenCalledWith('u1');
  });

  it('Document.sharedWith returns empty array when none', async () => {
    const result = await documentResolvers.Document.sharedWith({ sharedWith: [] });
    expect(result).toEqual([]);
  });

  it('Document.notes returns notes array', () => {
    const notes = [{ content: 'n1' }];
    expect(documentResolvers.Document.notes({ notes })).toBe(notes);
  });

  it('DocumentNote.id returns _id', () => {
    expect(documentResolvers.DocumentNote.id({ _id: 'n1' })).toBe('n1');
  });

  it('DocumentNote.addedBy returns null when not set', async () => {
    const result = await documentResolvers.DocumentNote.addedBy({ addedBy: null });
    expect(result).toBeNull();
  });

  it('DocumentNote.addedBy fetches user when set', async () => {
    User.findById.mockResolvedValue({ _id: 'u1' });
    await documentResolvers.DocumentNote.addedBy({ addedBy: 'u1' });
    expect(User.findById).toHaveBeenCalledWith('u1');
  });
});

// ─── Availability field resolvers ─────────────────────────────────────────────
describe('Availability type resolvers', () => {
  it('Availability.id returns _id', () => {
    expect(availabilityResolvers.Availability.id({ _id: 'av1' })).toBe('av1');
  });

  it('Availability.professional fetches when only ID', async () => {
    User.findById.mockResolvedValue({ _id: 'u1' });
    await availabilityResolvers.Availability.professional({ professional: 'u1' });
    expect(User.findById).toHaveBeenCalledWith('u1');
  });

  it('Availability.professional returns already-populated object', async () => {
    const prof = { _id: 'u1', firstName: 'Dr.' };
    const result = await availabilityResolvers.Availability.professional({ professional: prof });
    expect(result).toBe(prof);
  });
});

// ─── Appointment field resolvers ──────────────────────────────────────────────
describe('Appointment type resolvers', () => {
  it('Appointment.id returns _id', () => {
    expect(appointmentResolvers.Appointment.id({ _id: 'a1' })).toBe('a1');
  });

  it('Appointment.client fetches when only ID', async () => {
    User.findById.mockResolvedValue({ _id: 'u1' });
    await appointmentResolvers.Appointment.client({ client: 'u1' });
    expect(User.findById).toHaveBeenCalledWith('u1');
  });

  it('Appointment.professional fetches when only ID', async () => {
    User.findById.mockResolvedValue({ _id: 'p1' });
    await appointmentResolvers.Appointment.professional({ professional: 'p1' });
    expect(User.findById).toHaveBeenCalledWith('p1');
  });

  it('Appointment.cancelledBy returns null when not set', async () => {
    const result = await appointmentResolvers.Appointment.cancelledBy({ cancelledBy: null });
    expect(result).toBeNull();
  });

  it('Appointment.cancelledBy fetches user when set', async () => {
    User.findById.mockResolvedValue({ _id: 'u1' });
    await appointmentResolvers.Appointment.cancelledBy({ cancelledBy: 'u1' });
    expect(User.findById).toHaveBeenCalledWith('u1');
  });

  it('Appointment.rescheduleHistory returns empty array as default', () => {
    expect(appointmentResolvers.Appointment.rescheduleHistory({ rescheduleHistory: undefined })).toEqual([]);
  });

  it('RescheduleRecord.rescheduledBy fetches user', async () => {
    User.findById.mockResolvedValue({ _id: 'u1' });
    await appointmentResolvers.RescheduleRecord.rescheduledBy({ rescheduledBy: 'u1' });
    expect(User.findById).toHaveBeenCalledWith('u1');
  });
});

// ─── Chat field resolvers ─────────────────────────────────────────────────────
import Chat from '../../../src/models/Chat.js';
import Message from '../../../src/models/Message.js';

describe('Chat type resolvers', () => {
  it('Chat.id returns _id', () => {
    expect(chatResolvers.Chat.id({ _id: 'c1' })).toBe('c1');
  });

  it('Chat.unreadCount returns 0 for current user', () => {
    const chat = {
      unreadCounts: [{ user: { toString: () => 'u1' }, count: 5 }],
    };
    const count = chatResolvers.Chat.unreadCount(chat, null, { user: { _id: { toString: () => 'u1' } } });
    expect(count).toBe(5);
  });

  it('Chat.unreadCount returns 0 when user not in list', () => {
    const count = chatResolvers.Chat.unreadCount({ unreadCounts: [] }, null, { user: { _id: { toString: () => 'u1' } } });
    expect(count).toBe(0);
  });

  it('Chat.lastMessage returns null when not set', () => {
    const result = chatResolvers.Chat.lastMessage({ lastMessage: null });
    expect(result).toBeNull();
  });

  it('Chat.lastMessage fetches when only ID', async () => {
    Message.findById.mockResolvedValue({ _id: 'm1' });
    await chatResolvers.Chat.lastMessage({ lastMessage: 'm1' });
    expect(Message.findById).toHaveBeenCalledWith('m1');
  });

  it('Chat.appointment returns null when not set', () => {
    expect(chatResolvers.Chat.appointment({ appointment: null })).toBeNull();
  });

  it('ChatMessage.id returns _id', () => {
    expect(chatResolvers.ChatMessage.id({ _id: 'm1' })).toBe('m1');
  });

  it('ChatMessage.sender fetches when only ID', async () => {
    User.findById.mockResolvedValue({ _id: 'u1' });
    await chatResolvers.ChatMessage.sender({ sender: 'u1' });
    expect(User.findById).toHaveBeenCalledWith('u1');
  });

  it('ChatMessage.chat fetches by ID', async () => {
    Chat.findById.mockResolvedValue({ _id: 'c1' });
    await chatResolvers.ChatMessage.chat({ chat: 'c1' });
    expect(Chat.findById).toHaveBeenCalledWith('c1');
  });

  it('ChatMessage.attachments returns empty array', () => {
    expect(chatResolvers.ChatMessage.attachments({ attachments: [] })).toEqual([]);
  });
});

// ─── Payment field resolvers ──────────────────────────────────────────────────
describe('Payment type resolvers', () => {
  it('Payment.id returns _id', () => {
    expect(paymentResolvers.Payment.id({ _id: 'pay1' })).toBe('pay1');
  });

  it('Payment.payer fetches when only ID', async () => {
    User.findById.mockResolvedValue({ _id: 'u1' });
    await paymentResolvers.Payment.payer({ payer: 'u1' });
    expect(User.findById).toHaveBeenCalledWith('u1');
  });

  it('SubscriptionType.id returns _id', () => {
    expect(paymentResolvers.SubscriptionType.id({ _id: 's1' })).toBe('s1');
  });

  it('SubscriptionType.cancelAtPeriodEnd defaults to false', () => {
    expect(paymentResolvers.SubscriptionType.cancelAtPeriodEnd({ cancelAtPeriodEnd: undefined })).toBe(false);
  });

  it('SubscriptionType.currency defaults to USD', () => {
    expect(paymentResolvers.SubscriptionType.currency({ currency: undefined })).toBe('USD');
  });

  it('SubscriptionType.user fetches when only ID', async () => {
    User.findById.mockResolvedValue({ _id: 'u1' });
    await paymentResolvers.SubscriptionType.user({ user: 'u1' });
    expect(User.findById).toHaveBeenCalledWith('u1');
  });
});

// ─── Notification field resolvers ─────────────────────────────────────────────
describe('Notification type resolvers', () => {
  it('Notification.id returns _id', () => {
    expect(notificationResolvers.Notification.id({ _id: 'n1' })).toBe('n1');
  });
});

// ─── SOS field resolvers ──────────────────────────────────────────────────────
describe('SosEvent type resolvers', () => {
  it('SosEvent.id returns _id', () => {
    expect(sosResolvers.SosEvent.id({ _id: 's1' })).toBe('s1');
  });

  it('SosEvent.triggeredBy fetches when only ID', async () => {
    User.findById.mockResolvedValue({ _id: 'u1' });
    await sosResolvers.SosEvent.triggeredBy({ triggeredBy: 'u1' });
    expect(User.findById).toHaveBeenCalledWith('u1');
  });
});

// ─── Review field resolvers ───────────────────────────────────────────────────
describe('Review type resolvers', () => {
  it('Review.id returns _id', () => {
    expect(reviewResolvers.Review.id({ _id: 'r1' })).toBe('r1');
  });

  it('Review.reviewer returns null for anonymous', async () => {
    const result = await reviewResolvers.Review.reviewer({ isAnonymous: true, reviewer: 'u1' });
    expect(result).toBeNull();
  });

  it('Review.reviewer fetches for non-anonymous', async () => {
    User.findById.mockResolvedValue({ _id: 'u1' });
    await reviewResolvers.Review.reviewer({ isAnonymous: false, reviewer: 'u1' });
    expect(User.findById).toHaveBeenCalledWith('u1');
  });

  it('Review.professional fetches when only ID', async () => {
    User.findById.mockResolvedValue({ _id: 'p1' });
    await reviewResolvers.Review.professional({ professional: 'p1' });
    expect(User.findById).toHaveBeenCalledWith('p1');
  });
});

// ─── AwarenessArticle field resolvers ────────────────────────────────────────
describe('AwarenessArticle type resolvers', () => {
  it('AwarenessArticle.id returns _id', () => {
    expect(awarenessResolvers.AwarenessArticle.id({ _id: 'art1' })).toBe('art1');
  });

  it('AwarenessArticle.author returns null when not set', async () => {
    const result = await awarenessResolvers.AwarenessArticle.author({ author: null });
    expect(result).toBeNull();
  });

  it('AwarenessArticle.author fetches when only ID', async () => {
    User.findById.mockResolvedValue({ _id: 'u1' });
    await awarenessResolvers.AwarenessArticle.author({ author: 'u1' });
    expect(User.findById).toHaveBeenCalledWith('u1');
  });

  it('AwarenessArticle.tags defaults to empty array', () => {
    expect(awarenessResolvers.AwarenessArticle.tags({ tags: undefined })).toEqual([]);
  });
});
