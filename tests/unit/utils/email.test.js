import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock nodemailer before importing email utils
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
    })),
  },
}));

const { sendVerificationEmail, sendPasswordResetEmail, sendAppointmentEmail } =
  await import('../../../src/utils/email.js');

describe('Email utils', () => {
  it('sendVerificationEmail resolves without throwing', async () => {
    await expect(sendVerificationEmail('user@test.com', '123456')).resolves.toBeDefined();
  });

  it('sendPasswordResetEmail resolves without throwing', async () => {
    await expect(sendPasswordResetEmail('user@test.com', '654321')).resolves.toBeDefined();
  });

  it('sendAppointmentEmail resolves without throwing', async () => {
    await expect(sendAppointmentEmail('user@test.com', new Date())).resolves.toBeDefined();
  });
});
