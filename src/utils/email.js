import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const send = (to, subject, html) =>
  transporter.sendMail({ from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`, to, subject, html });

export const sendVerificationEmail = (to, code) =>
  send(to, 'Verify your Nevereveralone account',
    `<p>Your verification code is: <strong>${code}</strong>. Expires in 10 minutes.</p>`);

export const sendPasswordResetEmail = (to, code) =>
  send(to, 'Reset your password',
    `<p>Your password reset code is: <strong>${code}</strong>. Expires in 10 minutes.</p>`);

export const sendAppointmentEmail = (to, startTime) =>
  send(to, 'Appointment Confirmed',
    `<p>Your appointment on <strong>${new Date(startTime).toLocaleString()}</strong> is confirmed.</p>`);
