import Notification from '../models/Notification.js';
import { requireAuth } from '../middleware/context.js';

export const notificationResolvers = {
  Query: {
    notifications: async (_, { unreadOnly, page = 1, limit = 20 }, { user }) => {
      requireAuth(user);
      const filter = { recipient: user._id };
      if (unreadOnly) filter.isRead = false;
      const [notifications, unreadCount] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        Notification.countDocuments({ recipient: user._id, isRead: false }),
      ]);
      return { notifications, unreadCount };
    },
  },

  Mutation: {
    markNotificationsRead: async (_, { ids }, { user }) => {
      requireAuth(user);
      const filter = { recipient: user._id };
      if (ids?.length) filter._id = { $in: ids };
      await Notification.updateMany(filter, { isRead: true, readAt: new Date() });
      return { success: true, message: 'Notifications marked as read' };
    },

    deleteNotification: async (_, { id }, { user }) => {
      requireAuth(user);
      await Notification.findOneAndDelete({ _id: id, recipient: user._id });
      return { success: true, message: 'Notification deleted' };
    },
  },

  Notification: {
    id: (n) => n._id,
  },
};
