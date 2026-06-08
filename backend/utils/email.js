const nodemailer = require('nodemailer');

const MAIL_DRIVER = process.env.MAIL_DRIVER || (process.env.SMTP_HOST ? 'smtp' : 'console');
const MAIL_FROM = process.env.MAIL_FROM || 'no-reply@career-align.local';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

function createTransporter() {
  if (MAIL_DRIVER !== 'smtp' || !SMTP_HOST) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

async function sendPasswordResetEmail(email, resetUrl) {
  const subject = 'Career Align password reset';
  const text = `Hi,\n\nYou requested a password reset. Use the link below to set a new password:\n\n${resetUrl}\n\nIf you didn't request this, please ignore this message.`;
  const html = `<p>Hi,</p><p>You requested a password reset. Use the link below to set a new password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, please ignore this message.</p>`;

  const transporter = createTransporter();
  if (transporter) {
    const message = {
      from: MAIL_FROM,
      to: email,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(message);
    console.log(`[EMAIL] Reset email sent to ${email}. Message ID: ${info.messageId}`);
    return info;
  }

  console.log(`[EMAIL] (${MAIL_DRIVER}) Password reset email for ${email}`);
  console.log(`Reset link: ${resetUrl}`);
  return null;
}

module.exports = {
  sendPasswordResetEmail,
};
