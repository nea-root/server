import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphQLError } from 'graphql';
import { mockQuery } from '../../helpers/chainable.js';

vi.mock('../../../src/models/Chat.js', () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock('../../../src/models/Message.js', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock('../../../src/models/User.js', () => ({
  default: { find: vi.fn(), findById: vi.fn() },
}));

import { chatResolvers } from '../../../src/resolvers/chat.resolver.js';
import Chat from '../../../src/models/Chat.js';
import Message from '../../../src/models/Message.js';

const user = { _id: 'uid1', role: 'victim', isAnonymous: false };
const ctx = (u = user) => ({ user: u });

const makeChat = (overrides = {}) => ({
  _id: 'chat1',
  participants: [{ _id: 'uid1', toString: () => 'uid1' }, { _id: 'uid2', toString: () => 'uid2' }],
  type: 'direct',
  unreadCounts: [
    { user: { toString: () => 'uid1' }, count: 0 },
    { user: { toString: () => 'uid2' }, count: 2 },
  ],
  lastMessage: null,
  lastMessageAt: null,
  isActive: true,
  save: vi.fn().mockResolvedValue(true),
  populate: vi.fn().mockResolvedValue({}),
  ...overrides,
});

const makeMessage = (overrides = {}) => ({
  _id: 'msg1',
  chat: 'chat1',
  sender: { _id: 'uid1', toString: () => 'uid1' },
  content: 'Hello',
  type: 'text',
  attachments: [],
  isRead: false,
  isDeleted: false,
  save: vi.fn().mockResolvedValue(true),
  populate: vi.fn().mockResolvedValue({ _id: 'msg1' }),
  ...overrides,
});

describe('chatResolvers.Query.chats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(chatResolvers.Query.chats(null, null, ctx(null))).rejects.toThrow(GraphQLError);
  });

  it('returns list of user chats', async () => {
    Chat.find.mockReturnValue(mockQuery([makeChat()]));
    const result = await chatResolvers.Query.chats(null, null, ctx());
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('chatResolvers.Query.chatMessages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(chatResolvers.Query.chatMessages(null, { chatId: 'c1' }, ctx(null))).rejects.toThrow(GraphQLError);
  });

  it('throws NOT_FOUND when chat missing', async () => {
    Chat.findById.mockResolvedValue(null);
    await expect(chatResolvers.Query.chatMessages(null, { chatId: 'c1' }, ctx())).rejects.toThrow(GraphQLError);
  });

  it('throws FORBIDDEN when user not in chat', async () => {
    Chat.findById.mockResolvedValue(makeChat({
      participants: [{ toString: () => 'other1' }],
    }));
    await expect(chatResolvers.Query.chatMessages(null, { chatId: 'c1' }, ctx())).rejects.toThrow(GraphQLError);
  });

  it('returns messages and marks them read', async () => {
    Chat.findById.mockResolvedValue(makeChat());
    Message.find.mockReturnValue(mockQuery([makeMessage()]));
    Message.updateMany.mockResolvedValue({});
    Chat.findByIdAndUpdate.mockResolvedValue({});
    const result = await chatResolvers.Query.chatMessages(null, { chatId: 'chat1' }, ctx());
    expect(Array.isArray(result)).toBe(true);
    expect(Message.updateMany).toHaveBeenCalled();
  });
});

describe('chatResolvers.Mutation.getOrCreateChat', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(
      chatResolvers.Mutation.getOrCreateChat(null, { participantId: 'p1' }, ctx(null))
    ).rejects.toThrow(GraphQLError);
  });

  it('returns existing chat if found', async () => {
    const chat = makeChat();
    Chat.findOne.mockReturnValue(mockQuery(chat));
    const result = await chatResolvers.Mutation.getOrCreateChat(null, { participantId: 'uid2' }, ctx());
    expect(result._id).toBe('chat1');
    expect(Chat.create).not.toHaveBeenCalled();
  });

  it('creates a new chat when none exists', async () => {
    Chat.findOne.mockReturnValue(mockQuery(null));
    const chat = makeChat();
    Chat.create.mockResolvedValue(chat);
    chat.populate = vi.fn().mockResolvedValue(chat);
    await chatResolvers.Mutation.getOrCreateChat(null, { participantId: 'uid2' }, ctx());
    expect(Chat.create).toHaveBeenCalled();
  });
});

describe('chatResolvers.Mutation.sendMessage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(
      chatResolvers.Mutation.sendMessage(null, { chatId: 'c1', content: 'Hi' }, ctx(null))
    ).rejects.toThrow(GraphQLError);
  });

  it('throws NOT_FOUND when chat missing', async () => {
    Chat.findById.mockResolvedValue(null);
    await expect(
      chatResolvers.Mutation.sendMessage(null, { chatId: 'c1', content: 'Hi' }, ctx())
    ).rejects.toThrow(GraphQLError);
  });

  it('throws FORBIDDEN when user not in chat', async () => {
    Chat.findById.mockResolvedValue(makeChat({ participants: [{ toString: () => 'other' }] }));
    await expect(
      chatResolvers.Mutation.sendMessage(null, { chatId: 'c1', content: 'Hi' }, ctx())
    ).rejects.toThrow(GraphQLError);
  });

  it('sends message and increments unread count', async () => {
    const chat = makeChat();
    Chat.findById.mockResolvedValue(chat);
    const msg = makeMessage();
    Message.create.mockResolvedValue(msg);
    await chatResolvers.Mutation.sendMessage(null, { chatId: 'chat1', content: 'Hello' }, ctx());
    expect(Message.create).toHaveBeenCalled();
    expect(chat.save).toHaveBeenCalled();
  });

  it('sets senderAlias for anonymous users', async () => {
    const anonUser = { _id: 'uid1', role: 'victim', isAnonymous: true, anonymousAlias: 'User123' };
    Chat.findById.mockResolvedValue(makeChat());
    const msg = makeMessage();
    Message.create.mockResolvedValue(msg);
    await chatResolvers.Mutation.sendMessage(null, { chatId: 'chat1', content: 'Hi' }, ctx(anonUser));
    expect(Message.create).toHaveBeenCalledWith(expect.objectContaining({ senderAlias: 'User123' }));
  });
});

describe('chatResolvers.Mutation.deleteMessage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws NOT_FOUND when message missing', async () => {
    Message.findById.mockResolvedValue(null);
    await expect(
      chatResolvers.Mutation.deleteMessage(null, { chatId: 'c1', messageId: 'm1' }, ctx())
    ).rejects.toThrow(GraphQLError);
  });

  it('throws FORBIDDEN when not the sender', async () => {
    Message.findById.mockResolvedValue(makeMessage({ sender: { toString: () => 'other' } }));
    await expect(
      chatResolvers.Mutation.deleteMessage(null, { chatId: 'c1', messageId: 'm1' }, ctx())
    ).rejects.toThrow(GraphQLError);
  });

  it('soft-deletes the message', async () => {
    const msg = makeMessage();
    Message.findById.mockResolvedValue(msg);
    const result = await chatResolvers.Mutation.deleteMessage(null, { chatId: 'c1', messageId: 'm1' }, ctx());
    expect(msg.isDeleted).toBe(true);
    expect(result.success).toBe(true);
  });
});

describe('chatResolvers.Mutation.markMessagesRead', () => {
  it('marks messages as read and returns success', async () => {
    Message.updateMany.mockResolvedValue({});
    Chat.findByIdAndUpdate.mockResolvedValue({});
    const result = await chatResolvers.Mutation.markMessagesRead(null, { chatId: 'c1' }, ctx());
    expect(result.success).toBe(true);
  });
});
