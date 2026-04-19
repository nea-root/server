import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphQLError } from 'graphql';

vi.mock('../../../src/models/Notification.js', () => ({
  default: {
    find: vi.fn(),
    findOneAndDelete: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({}),
    countDocuments: vi.fn(),
  },
}));

import { notificationResolvers } from '../../../src/resolvers/notification.resolver.js';
import Notification from '../../../src/models/Notification.js';

const user = { _id: 'uid1', role: 'victim' };
const ctx = (u = user) => ({ user: u });

const makeNotif = () => ({ _id: 'n1', type: 'system', title: 'Test', body: 'Body', isRead: false });

const chainableNotif = (data) => ({
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  then: (resolve) => Promise.resolve(data).then(resolve),
});

describe('notificationResolvers.Query.notifications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(notificationResolvers.Query.notifications(null, {}, ctx(null))).rejects.toThrow(GraphQLError);
  });

  it('returns notifications with unread count', async () => {
    Notification.find.mockReturnValue(chainableNotif([makeNotif()]));
    Notification.countDocuments.mockResolvedValue(1);
    const result = await notificationResolvers.Query.notifications(null, {}, ctx());
    expect(result.unreadCount).toBe(1);
    expect(result.notifications.length).toBe(1);
  });

  it('filters unread only when requested', async () => {
    Notification.find.mockReturnValue(chainableNotif([]));
    Notification.countDocuments.mockResolvedValue(0);
    await notificationResolvers.Query.notifications(null, { unreadOnly: true }, ctx());
    expect(Notification.find).toHaveBeenCalledWith(expect.objectContaining({ isRead: false }));
  });
});

describe('notificationResolvers.Mutation.markNotificationsRead', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(
      notificationResolvers.Mutation.markNotificationsRead(null, {}, ctx(null))
    ).rejects.toThrow(GraphQLError);
  });

  it('marks all notifications read when no ids provided', async () => {
    Notification.updateMany.mockResolvedValue({});
    const result = await notificationResolvers.Mutation.markNotificationsRead(null, {}, ctx());
    expect(result.success).toBe(true);
    expect(Notification.updateMany).toHaveBeenCalledWith(
      { recipient: user._id },
      expect.any(Object)
    );
  });

  it('marks specific notifications read when ids provided', async () => {
    Notification.updateMany.mockResolvedValue({});
    const result = await notificationResolvers.Mutation.markNotificationsRead(null, { ids: ['n1', 'n2'] }, ctx());
    expect(result.success).toBe(true);
    expect(Notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ _id: { $in: ['n1', 'n2'] } }),
      expect.any(Object)
    );
  });
});

describe('notificationResolvers.Mutation.deleteNotification', () => {
  it('throws when not authenticated', async () => {
    await expect(
      notificationResolvers.Mutation.deleteNotification(null, { id: 'n1' }, ctx(null))
    ).rejects.toThrow(GraphQLError);
  });

  it('deletes the notification and returns success', async () => {
    Notification.findOneAndDelete.mockResolvedValue({});
    const result = await notificationResolvers.Mutation.deleteNotification(null, { id: 'n1' }, ctx());
    expect(result.success).toBe(true);
    expect(Notification.findOneAndDelete).toHaveBeenCalledWith({ _id: 'n1', recipient: user._id });
  });
});
