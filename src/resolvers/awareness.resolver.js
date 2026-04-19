import { GraphQLError } from 'graphql';
import AwarenessArticle from '../models/AwarenessArticle.js';
import User from '../models/User.js';
import { requireRole } from '../middleware/context.js';

export const awarenessResolvers = {
  Query: {
    articles: async (_, { category, tag, page = 1, limit = 20 }) => {
      const filter = { isPublished: true };
      if (category) filter.category = category;
      if (tag) filter.tags = tag;
      return AwarenessArticle.find(filter)
        .populate('author')
        .sort({ publishedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
    },

    article: async (_, { slug }) => {
      const article = await AwarenessArticle.findOne({ slug, isPublished: true }).populate('author');
      if (!article) throw new GraphQLError('Article not found', { extensions: { code: 'NOT_FOUND' } });
      article.viewCount += 1;
      await article.save();
      return article;
    },
  },

  Mutation: {
    createArticle: async (_, args, { user }) => {
      requireRole(user, 'admin');
      return AwarenessArticle.create({ ...args, author: user._id, isPublished: false });
    },

    publishArticle: async (_, { id }, { user }) => {
      requireRole(user, 'admin');
      const article = await AwarenessArticle.findByIdAndUpdate(
        id, { isPublished: true, publishedAt: new Date() }, { new: true }
      ).populate('author');
      if (!article) throw new GraphQLError('Article not found', { extensions: { code: 'NOT_FOUND' } });
      return article;
    },

    deleteArticle: async (_, { id }, { user }) => {
      requireRole(user, 'admin');
      await AwarenessArticle.findByIdAndDelete(id);
      return { success: true, message: 'Article deleted' };
    },
  },

  AwarenessArticle: {
    id: (a) => a._id,
    author: (a) => a.author?._id ? a.author : (a.author ? User.findById(a.author) : null),
    tags: (a) => a.tags || [],
  },
};
