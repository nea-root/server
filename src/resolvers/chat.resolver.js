import { GraphQLError } from 'graphql';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/context.js';

const forbidden = () => {
  throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } });
};

export const chatResolvers = {
  Query: {
    chats: async (_, __, { user }) => {
      requireAuth(user);
      return Chat.find({ participants: user._id, isActive: true })
        .populate('participants')
        .populate('lastMessage')
        .sort({ lastMessageAt: -1 });
    },

    chatMessages: async (_, { chatId, page = 1, limit = 50 }, { user }) => {
      requireAuth(user);
      const chat = await Chat.findById(chatId);
      if (!chat) throw new GraphQLError('Chat not found', { extensions: { code: 'NOT_FOUND' } });
      if (!chat.participants.map(String).includes(user._id.toString())) forbidden();

      const messages = await Message.find({ chat: chatId, isDeleted: false })
        .populate('sender')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      await Message.updateMany(
        { chat: chatId, sender: { $ne: user._id }, isRead: false },
        { isRead: true, readAt: new Date() },
      );
      await Chat.findByIdAndUpdate(
        chatId,
        {
          $set: { 'unreadCounts.$[elem].count': 0 },
        },
        { arrayFilters: [{ 'elem.user': user._id }] },
      );

      return messages.reverse();
    },
  },

  Mutation: {
    getOrCreateChat: async (_, { participantId, type = 'direct' }, { user }) => {
      requireAuth(user);
      let chat = await Chat.findOne({
        participants: { $all: [user._id, participantId] },
        type,
      })
        .populate('participants')
        .populate('lastMessage');

      if (!chat) {
        chat = await Chat.create({
          participants: [user._id, participantId],
          type,
          unreadCounts: [
            { user: user._id, count: 0 },
            { user: participantId, count: 0 },
          ],
        });
        await chat.populate('participants');
      }
      return chat;
    },

    sendMessage: async (_, { chatId, content, type = 'text' }, { user }) => {
      requireAuth(user);
      const chat = await Chat.findById(chatId);
      if (!chat) throw new GraphQLError('Chat not found', { extensions: { code: 'NOT_FOUND' } });
      if (!chat.participants.map(String).includes(user._id.toString())) forbidden();

      const message = await Message.create({
        chat: chatId,
        sender: user._id,
        content,
        type,
        senderAlias: user.isAnonymous ? user.anonymousAlias : undefined,
      });

      chat.lastMessage = message._id;
      chat.lastMessageAt = new Date();
      chat.participants.forEach((p) => {
        if (p.toString() !== user._id.toString()) {
          const entry = chat.unreadCounts.find((u) => u.user.toString() === p.toString());
          if (entry) entry.count += 1;
        }
      });
      await chat.save();

      return message.populate('sender');
    },

    deleteMessage: async (_, { messageId }, { user }) => {
      requireAuth(user);
      const message = await Message.findById(messageId);
      if (!message)
        throw new GraphQLError('Message not found', { extensions: { code: 'NOT_FOUND' } });
      if (message.sender.toString() !== user._id.toString()) forbidden();
      message.isDeleted = true;
      message.deletedAt = new Date();
      message.content = null;
      await message.save();
      return { success: true, message: 'Message deleted' };
    },

    markMessagesRead: async (_, { chatId }, { user }) => {
      requireAuth(user);
      await Message.updateMany(
        { chat: chatId, sender: { $ne: user._id }, isRead: false },
        { isRead: true, readAt: new Date() },
      );
      await Chat.findByIdAndUpdate(
        chatId,
        {
          $set: { 'unreadCounts.$[elem].count': 0 },
        },
        { arrayFilters: [{ 'elem.user': user._id }] },
      );
      return { success: true, message: 'Messages marked as read' };
    },
  },

  Chat: {
    id: (c) => c._id,
    participants: (c) =>
      c.participants?.length && c.participants[0]?._id
        ? c.participants
        : User.find({ _id: { $in: c.participants } }),
    lastMessage: (c) =>
      c.lastMessage?._id ? c.lastMessage : c.lastMessage ? Message.findById(c.lastMessage) : null,
    unreadCount: (c, _, { user }) => {
      const entry = c.unreadCounts?.find((u) => u.user.toString() === user?._id?.toString());
      return entry?.count || 0;
    },
    appointment: (c) => c.appointment || null,
  },

  ChatMessage: {
    id: (m) => m._id,
    sender: (m) => (m.sender?._id ? m.sender : User.findById(m.sender)),
    chat: (m) => Chat.findById(m.chat),
    attachments: (m) => m.attachments || [],
  },
};
