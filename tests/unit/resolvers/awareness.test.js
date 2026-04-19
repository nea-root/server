import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphQLError } from 'graphql';
import { mockQuery } from '../../helpers/chainable.js';

vi.mock('../../../src/models/AwarenessArticle.js', () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn().mockResolvedValue({}),
    create: vi.fn(),
  },
}));
vi.mock('../../../src/models/User.js', () => ({
  default: { findById: vi.fn() },
}));

import { awarenessResolvers } from '../../../src/resolvers/awareness.resolver.js';
import AwarenessArticle from '../../../src/models/AwarenessArticle.js';

const admin = { _id: 'admin1', role: 'admin' };
const victim = { _id: 'uid1', role: 'victim' };
const ctx = (u = admin) => ({ user: u });

const makeArticle = (overrides = {}) => ({
  _id: 'art1',
  title: 'Safety Tips',
  slug: 'safety-tips',
  content: 'Content here',
  isPublished: true,
  tags: [],
  viewCount: 0,
  save: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe('awarenessResolvers.Query.articles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns published articles', async () => {
    AwarenessArticle.find.mockReturnValue(mockQuery([makeArticle()]));
    const result = await awarenessResolvers.Query.articles(null, {});
    expect(Array.isArray(result)).toBe(true);
  });

  it('filters by category', async () => {
    AwarenessArticle.find.mockReturnValue(mockQuery([]));
    await awarenessResolvers.Query.articles(null, { category: 'legal_rights' });
    expect(AwarenessArticle.find).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'legal_rights' })
    );
  });

  it('filters by tag', async () => {
    AwarenessArticle.find.mockReturnValue(mockQuery([]));
    await awarenessResolvers.Query.articles(null, { tag: 'safety' });
    expect(AwarenessArticle.find).toHaveBeenCalledWith(
      expect.objectContaining({ tags: 'safety' })
    );
  });
});

describe('awarenessResolvers.Query.article', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws NOT_FOUND for unknown slug', async () => {
    AwarenessArticle.findOne.mockReturnValue(mockQuery(null));
    await expect(awarenessResolvers.Query.article(null, { slug: 'not-found' })).rejects.toThrow(GraphQLError);
  });

  it('returns article and increments viewCount', async () => {
    const article = makeArticle();
    AwarenessArticle.findOne.mockReturnValue(mockQuery(article));
    const result = await awarenessResolvers.Query.article(null, { slug: 'safety-tips' });
    expect(result.viewCount).toBe(1);
    expect(article.save).toHaveBeenCalled();
  });
});

describe('awarenessResolvers.Mutation.createArticle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws FORBIDDEN for non-admin', async () => {
    await expect(
      awarenessResolvers.Mutation.createArticle(
        null, { title: 'T', slug: 's', content: 'c' }, ctx(victim)
      )
    ).rejects.toThrow(GraphQLError);
  });

  it('creates article as unpublished', async () => {
    AwarenessArticle.create.mockResolvedValue(makeArticle({ isPublished: false }));
    const result = await awarenessResolvers.Mutation.createArticle(
      null, { title: 'Safety Tips', slug: 'safety-tips', content: 'Content' }, ctx()
    );
    expect(AwarenessArticle.create).toHaveBeenCalledWith(
      expect.objectContaining({ isPublished: false, author: admin._id })
    );
  });
});

describe('awarenessResolvers.Mutation.publishArticle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws FORBIDDEN for non-admin', async () => {
    await expect(
      awarenessResolvers.Mutation.publishArticle(null, { id: 'a1' }, ctx(victim))
    ).rejects.toThrow(GraphQLError);
  });

  it('throws NOT_FOUND when article missing', async () => {
    AwarenessArticle.findByIdAndUpdate.mockReturnValue(mockQuery(null));
    await expect(
      awarenessResolvers.Mutation.publishArticle(null, { id: 'a1' }, ctx())
    ).rejects.toThrow(GraphQLError);
  });

  it('publishes the article', async () => {
    AwarenessArticle.findByIdAndUpdate.mockReturnValue(mockQuery(makeArticle({ isPublished: true })));
    const result = await awarenessResolvers.Mutation.publishArticle(null, { id: 'art1' }, ctx());
    expect(result.isPublished).toBe(true);
  });
});

describe('awarenessResolvers.Mutation.deleteArticle', () => {
  it('throws FORBIDDEN for non-admin', async () => {
    await expect(
      awarenessResolvers.Mutation.deleteArticle(null, { id: 'a1' }, ctx(victim))
    ).rejects.toThrow(GraphQLError);
  });

  it('deletes and returns success', async () => {
    AwarenessArticle.findByIdAndDelete.mockResolvedValue({});
    const result = await awarenessResolvers.Mutation.deleteArticle(null, { id: 'a1' }, ctx());
    expect(result.success).toBe(true);
  });
});
