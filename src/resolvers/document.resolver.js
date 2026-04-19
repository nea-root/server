import { GraphQLError } from 'graphql';
import Document from '../models/Document.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { requireAuth, requireRole } from '../middleware/context.js';

const notFound = (msg = 'Not found') => { throw new GraphQLError(msg, { extensions: { code: 'NOT_FOUND' } }); };
const forbidden = () => { throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } }); };

export const documentResolvers = {
  Query: {
    myDocuments: async (_, { type }, { user }) => {
      requireAuth(user);
      const filter = { owner: user._id, deletedAt: null };
      if (type) filter.type = type;
      return Document.find(filter).populate('owner').sort({ createdAt: -1 });
    },

    document: async (_, { id }, { user }) => {
      requireAuth(user);
      const doc = await Document.findById(id).populate('owner').populate('sharedWith');
      if (!doc) notFound();
      const ownerId = doc.owner._id ?? doc.owner;
      const sharedIds = doc.sharedWith.map((u) => (u._id ?? u).toString());
      if (ownerId.toString() !== user._id.toString() && !sharedIds.includes(user._id.toString())) forbidden();
      return doc;
    },
  },

  Mutation: {
    addDocumentNote: async (_, { documentId, content }, { user }) => {
      requireAuth(user);
      const doc = await Document.findById(documentId);
      if (!doc) notFound();
      const ownerId = doc.owner.toString();
      const sharedIds = doc.sharedWith.map(String);
      if (ownerId !== user._id.toString() && !sharedIds.includes(user._id.toString())) forbidden();
      doc.notes.push({ content, addedBy: user._id });
      await doc.save();
      return doc.populate('owner');
    },

    toggleNoteStarred: async (_, { documentId, noteId }, { user }) => {
      requireAuth(user);
      const doc = await Document.findById(documentId);
      if (!doc) notFound();
      if (doc.owner.toString() !== user._id.toString()) forbidden();
      const note = doc.notes.id(noteId);
      if (!note) notFound('Note not found');
      note.isStarred = !note.isStarred;
      await doc.save();
      return doc.populate('owner');
    },

    shareDocument: async (_, { documentId, professionalId }, { user }) => {
      requireAuth(user);
      const doc = await Document.findById(documentId);
      if (!doc) notFound();
      if (doc.owner.toString() !== user._id.toString()) forbidden();
      if (!doc.sharedWith.map(String).includes(professionalId)) {
        doc.sharedWith.push(professionalId);
        doc.isSharedWithProfessional = true;
        await doc.save();
      }
      return { success: true, message: 'Document shared' };
    },

    deleteDocument: async (_, { id }, { user }) => {
      requireAuth(user);
      const doc = await Document.findById(id);
      if (!doc) notFound();
      if (doc.owner.toString() !== user._id.toString()) forbidden();
      doc.deletedAt = new Date();
      await doc.save();
      return { success: true, message: 'Document deleted' };
    },

    verifyDocument: async (_, { documentId, status, rejectionReason }, { user }) => {
      requireRole(user, 'admin');
      const doc = await Document.findById(documentId);
      if (!doc) notFound();
      doc.verificationStatus = status;
      doc.verifiedBy = user._id;
      doc.verifiedAt = new Date();
      if (status === 'rejected') doc.rejectionReason = rejectionReason;
      await doc.save();

      if (status === 'verified') {
        const pending = await Document.countDocuments({ owner: doc.owner, verificationStatus: { $ne: 'verified' }, deletedAt: null });
        if (pending === 0) await User.findByIdAndUpdate(doc.owner, { isDocumentVerified: true });
      }

      await Notification.create({
        recipient: doc.owner,
        type: status === 'verified' ? 'document_verified' : 'document_rejected',
        title: status === 'verified' ? 'Document Verified' : 'Document Rejected',
        body: status === 'verified'
          ? `Your document "${doc.title}" has been verified.`
          : `Your document "${doc.title}" was rejected: ${rejectionReason}`,
        data: { documentId: doc._id },
      });

      return doc.populate('owner');
    },
  },

  Document: {
    id: (d) => d._id,
    owner: (d) => d.owner?._id ? d.owner : User.findById(d.owner),
    sharedWith: (d) => d.sharedWith?.length ? User.find({ _id: { $in: d.sharedWith } }) : [],
    notes: (d) => d.notes || [],
  },

  DocumentNote: {
    id: (n) => n._id,
    addedBy: (n) => n.addedBy ? User.findById(n.addedBy) : null,
  },
};
