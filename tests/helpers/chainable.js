import { vi } from 'vitest';

/**
 * Returns a mock that mimics Mongoose's chainable query API.
 * Pass the final resolved value; chain methods (populate, sort, etc.)
 * all return `this` so callers can keep chaining.
 */
export const mockQuery = (resolvedValue) => {
  const chain = {
    populate: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve(resolvedValue).then(resolve, reject),
    catch: (reject) => Promise.resolve(resolvedValue).catch(reject),
  };
  return chain;
};

/**
 * Build a mock Mongoose document that supports .save() and .populate().
 */
export const mockDoc = (data = {}) => ({
  ...data,
  save: vi.fn().mockResolvedValue({ ...data }),
  populate: vi.fn().mockResolvedValue({ ...data }),
  toObject: vi.fn().mockReturnValue({ ...data }),
});
