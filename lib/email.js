const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/**
 * Sends an approval-request email from Friday to the owner.
 *
 * IMPORTANT: reply_to is set to GMAIL_USER (Friday's own address), not
 * OWNER_EMAIL. This is the exact bug that broke reply-continuity on Remy -
 * replies were routing back to the owner's own inbox instead of to Friday,
 * so there was no way to reply in-thread. Keep this as GMAIL_USER.
 */
async function sendApprovalEmail({ subject, body }) {
  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: process.env.OWNER_EMAIL,
    replyTo: process.env.GMAIL_USER,
    subject,
    text: body,
  });
}

module.exports = { sendApprovalEmail };
