import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/User.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';

const connectedUsers = new Map();

export const initChatSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) throw new Error('No token');
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId);
      if (!user) throw new Error('User not found');
      socket.user = user;
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    connectedUsers.set(userId, socket.id);
    socket.broadcast.emit('user:online', { userId });

    Chat.find({ participants: socket.user._id, isActive: true })
      .then((chats) => chats.forEach((c) => socket.join(c._id.toString())));

    socket.on('chat:join', async (chatId) => {
      const chat = await Chat.findById(chatId);
      if (chat && chat.participants.map(String).includes(userId)) {
        socket.join(chatId);
        socket.emit('chat:joined', { chatId });
      }
    });

    socket.on('chat:message', async ({ chatId, content, type = 'text' }) => {
      try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.map(String).includes(userId)) return;

        const message = await Message.create({
          chat: chatId, sender: socket.user._id, content, type,
          senderAlias: socket.user.isAnonymous ? socket.user.anonymousAlias : undefined,
        });

        await message.populate('sender', 'firstName lastName role anonymousAlias isAnonymous');

        chat.lastMessage = message._id;
        chat.lastMessageAt = new Date();
        chat.participants.forEach((p) => {
          if (p.toString() !== userId) {
            const entry = chat.unreadCounts.find((u) => u.user.toString() === p.toString());
            if (entry) entry.count += 1;
          }
        });
        await chat.save();

        io.to(chatId).emit('chat:message', { message });
      } catch (err) {
        console.error('Socket message error:', err.message);
      }
    });

    socket.on('chat:typing', ({ chatId }) => {
      socket.to(chatId).emit('chat:typing', {
        chatId, userId,
        alias: socket.user.isAnonymous ? socket.user.anonymousAlias : socket.user.firstName,
      });
    });

    socket.on('chat:stop_typing', ({ chatId }) => {
      socket.to(chatId).emit('chat:stop_typing', { chatId, userId });
    });

    socket.on('chat:read', async ({ chatId }) => {
      try {
        await Message.updateMany(
          { chat: chatId, sender: { $ne: socket.user._id }, isRead: false },
          { isRead: true, readAt: new Date() }
        );
        socket.to(chatId).emit('chat:read', { chatId, userId });
      } catch (err) {
        console.error('Socket read error:', err.message);
      }
    });

    socket.on('disconnect', () => {
      connectedUsers.delete(userId);
      socket.broadcast.emit('user:offline', { userId });
    });
  });
};
