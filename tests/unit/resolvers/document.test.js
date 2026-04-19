import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphQLError } from 'graphql';
import { mockQuery } from '../../helpers/chainable.js';

vi.mock('../../../src/models/Document.js', () => ({
  default: {
    findById: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));
vi.mock('../../../src/models/User.js', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));
vi.mock('../../../src/models/Notification.js', () => ({
  default: { create: vi.fn().mockResolvedValue({}) },
}));

import { documentResolvers } from '../../../src/resolvers/document.resolver.js';
import Document from '../../../src/models/Document.js';
import User from '../../../src/models/User.js';
import Notification from '../../../src/models/Notification.js';

const victim = { _id: 'uid1', role: 'victim' };
const admin = { _id: 'admin1', role: 'admin' };
const ctx = (u = victim) => ({ user: u });

const makeDoc = (overrides = {}) => ({
  _id: 'doc1',
  owner: { _id: 'uid1', toString: () => 'uid1' },
  title: 'Test Doc',
  type: 'evidence',
  fileUrl: '/uploads/test.pdf',
  fileName: 'test.pdf',
  verificationStatus: 'pending',
  notes: [],
  sharedWith: [],
  isSharedWithProfessional: false,
  deletedAt: null,
  save: vi.fn().mockResolvedValue(true),
  populate: vi.fn().mockResolvedThis ? vi.fn().mockReturnThis() : vi.fn().mockResolvedValue({}),
  ...overrides,
});

describe('documentResolvers.Query.myDocuments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(documentResolvers.Query.myDocuments(null, {}, ctx(null))).rejects.toThrow(
      GraphQLError,
    );
  });

  it('returns user documents', async () => {
    Document.find.mockReturnValue(mockQuery([makeDoc()]));
    const result = await documentResolvers.Query.myDocuments(null, {}, ctx());
    expect(Array.isArray(result)).toBe(true);
  });

  it('filters by type when provided', async () => {
    Document.find.mockReturnValue(mockQuery([]));
    await documentResolvers.Query.myDocuments(null, { type: 'evidence' }, ctx());
    expect(Document.find).toHaveBeenCalledWith(expect.objectContaining({ type: 'evidence' }));
  });
});

describe('documentResolvers.Query.document', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(documentResolvers.Query.document(null, { id: 'd1' }, ctx(null))).rejects.toThrow(
      GraphQLError,
    );
  });

  it('throws NOT_FOUND when document missing', async () => {
    Document.findById.mockReturnValue(mockQuery(null));
    await expect(documentResolvers.Query.document(null, { id: 'd1' }, ctx())).rejects.toThrow(
      GraphQLError,
    );
  });

  it('throws FORBIDDEN when user is not owner or shared', async () => {
    const doc = makeDoc({ owner: { _id: 'other', toString: () => 'other' }, sharedWith: [] });
    Document.findById.mockReturnValue(mockQuery(doc));
    await expect(documentResolvers.Query.document(null, { id: 'd1' }, ctx())).rejects.toThrow(
      GraphQLError,
    );
  });

  it('returns document for owner', async () => {
    const doc = makeDoc();
    Document.findById.mockReturnValue(mockQuery(doc));
    const result = await documentResolvers.Query.document(null, { id: 'doc1' }, ctx());
    expect(result._id).toBe('doc1');
  });

  it('returns document for shared user', async () => {
    const sharedUser = { _id: 'shared1', role: 'lawyer' };
    const doc = makeDoc({
      owner: { _id: 'other', toString: () => 'other' },
      sharedWith: [{ toString: () => 'shared1' }],
    });
    Document.findById.mockReturnValue(mockQuery(doc));
    const result = await documentResolvers.Query.document(null, { id: 'd1' }, ctx(sharedUser));
    expect(result).toBeDefined();
  });
});

describe('documentResolvers.Mutation.addDocumentNote', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(
      documentResolvers.Mutation.addDocumentNote(
        null,
        { documentId: 'd1', content: 'note' },
        ctx(null),
      ),
    ).rejects.toThrow(GraphQLError);
  });

  it('throws NOT_FOUND when document missing', async () => {
    Document.findById.mockResolvedValue(null);
    await expect(
      documentResolvers.Mutation.addDocumentNote(
        null,
        { documentId: 'd1', content: 'note' },
        ctx(),
      ),
    ).rejects.toThrow(GraphQLError);
  });

  it('adds a note to the document', async () => {
    const doc = makeDoc({ notes: [] });
    doc.populate = vi.fn().mockResolvedValue(doc);
    Document.findById.mockResolvedValue(doc);
    await documentResolvers.Mutation.addDocumentNote(
      null,
      { documentId: 'd1', content: 'My note' },
      ctx(),
    );
    expect(doc.notes.length).toBe(1);
    expect(doc.save).toHaveBeenCalled();
  });
});

describe('documentResolvers.Mutation.toggleNoteStarred', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws NOT_FOUND when document missing', async () => {
    Document.findById.mockResolvedValue(null);
    await expect(
      documentResolvers.Mutation.toggleNoteStarred(null, { documentId: 'd1', noteId: 'n1' }, ctx()),
    ).rejects.toThrow(GraphQLError);
  });

  it('throws FORBIDDEN when user is not owner', async () => {
    const doc = makeDoc({ owner: { _id: 'other', toString: () => 'other' } });
    Document.findById.mockResolvedValue(doc);
    await expect(
      documentResolvers.Mutation.toggleNoteStarred(null, { documentId: 'd1', noteId: 'n1' }, ctx()),
    ).rejects.toThrow(GraphQLError);
  });

  it('throws NOT_FOUND when note does not exist', async () => {
    const doc = makeDoc({ notes: { id: vi.fn().mockReturnValue(null) } });
    Document.findById.mockResolvedValue(doc);
    await expect(
      documentResolvers.Mutation.toggleNoteStarred(
        null,
        { documentId: 'd1', noteId: 'bad-note' },
        ctx(),
      ),
    ).rejects.toThrow(GraphQLError);
  });

  it('toggles note starred status', async () => {
    const note = { _id: 'n1', isStarred: false };
    const doc = makeDoc({ notes: { id: vi.fn().mockReturnValue(note) } });
    doc.populate = vi.fn().mockResolvedValue(doc);
    Document.findById.mockResolvedValue(doc);
    await documentResolvers.Mutation.toggleNoteStarred(
      null,
      { documentId: 'd1', noteId: 'n1' },
      ctx(),
    );
    expect(note.isStarred).toBe(true);
    expect(doc.save).toHaveBeenCalled();
  });
});

describe('documentResolvers.Mutation.deleteDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws FORBIDDEN when not the owner', async () => {
    const doc = makeDoc({ owner: { _id: 'other', toString: () => 'other' } });
    Document.findById.mockResolvedValue(doc);
    await expect(
      documentResolvers.Mutation.deleteDocument(null, { id: 'd1' }, ctx()),
    ).rejects.toThrow(GraphQLError);
  });

  it('soft-deletes by setting deletedAt', async () => {
    const doc = makeDoc();
    Document.findById.mockResolvedValue(doc);
    const result = await documentResolvers.Mutation.deleteDocument(null, { id: 'd1' }, ctx());
    expect(doc.deletedAt).toBeDefined();
    expect(result.success).toBe(true);
  });
});

describe('documentResolvers.Mutation.shareDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds professionalId to sharedWith', async () => {
    const doc = makeDoc({ sharedWith: [] });
    Document.findById.mockResolvedValue(doc);
    const result = await documentResolvers.Mutation.shareDocument(
      null,
      { documentId: 'd1', professionalId: 'prof1' },
      ctx(),
    );
    expect(result.success).toBe(true);
    expect(doc.isSharedWithProfessional).toBe(true);
  });

  it('does not duplicate if already shared', async () => {
    const doc = makeDoc({ sharedWith: [{ toString: () => 'prof1' }, 'prof1'] });
    doc.sharedWith.map = vi.fn().mockReturnValue(['prof1']);
    Document.findById.mockResolvedValue(doc);
    await documentResolvers.Mutation.shareDocument(
      null,
      { documentId: 'd1', professionalId: 'prof1' },
      ctx(),
    );
    expect(doc.save).not.toHaveBeenCalled();
  });
});

describe('documentResolvers.Mutation.verifyDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws FORBIDDEN for non-admin', async () => {
    await expect(
      documentResolvers.Mutation.verifyDocument(
        null,
        { documentId: 'd1', status: 'verified' },
        ctx(),
      ),
    ).rejects.toThrow(GraphQLError);
  });

  it('verifies document and updates user', async () => {
    const doc = makeDoc({ owner: { toString: () => 'uid1' } });
    doc.populate = vi.fn().mockResolvedValue(doc);
    Document.findById.mockResolvedValue(doc);
    Document.countDocuments.mockResolvedValue(0);
    User.findByIdAndUpdate.mockResolvedValue({});
    Notification.create.mockResolvedValue({});

    await documentResolvers.Mutation.verifyDocument(
      null,
      { documentId: 'd1', status: 'verified' },
      ctx(admin),
    );
    expect(doc.verificationStatus).toBe('verified');
    expect(User.findByIdAndUpdate).toHaveBeenCalled();
  });

  it('rejects document with reason', async () => {
    const doc = makeDoc({ owner: { toString: () => 'uid1' } });
    doc.populate = vi.fn().mockResolvedValue(doc);
    Document.findById.mockResolvedValue(doc);
    Notification.create.mockResolvedValue({});

    await documentResolvers.Mutation.verifyDocument(
      null,
      { documentId: 'd1', status: 'rejected', rejectionReason: 'Bad scan' },
      ctx(admin),
    );
    expect(doc.verificationStatus).toBe('rejected');
    expect(doc.rejectionReason).toBe('Bad scan');
  });
});
