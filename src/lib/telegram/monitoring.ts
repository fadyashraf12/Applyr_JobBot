import { UserContext } from '../userContext';
import { format } from 'date-fns';
import { sendMessage } from './bot';
import { getAdminDb } from '../firebase/admin';

export async function postApplicationSentReceipt(
  context: UserContext,
  application: any
): Promise<void> {
  const monitoringChannelId = context.user?.monitoringChannelId;
  if (!monitoringChannelId) return;

  const db = getAdminDb();
  let profileName = 'Default Profile';
  if (application.profileId) {
    const profileSnap = await db.doc(`users/${context.uid}/profiles/${application.profileId}`).get();
    if (profileSnap.exists) {
      profileName = (profileSnap.data() as any).name || 'Default Profile';
    }
  }

  const appliedDate = application.appliedAt?.toDate ? application.appliedAt.toDate() : new Date(application.appliedAt);
  const formattedTime = format(appliedDate, 'HH:mm');
  const formattedDate = format(appliedDate, 'MMMM d, yyyy');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://applyr.vercel.app';

  const text = `<b>✅ Application Sent</b>\n` +
    `─────────────────────\n` +
    `🏢  <b>Company:</b>   ${application.company}\n` +
    `💼  <b>Role:</b>      ${application.jobTitle}\n` +
    `📧  <b>Sent to:</b>   ${application.hrEmail}\n` +
    `🕐  <b>Time:</b>      ${formattedTime} · ${formattedDate}\n` +
    `📄  <b>Profile:</b>   ${profileName}\n` +
    `─────────────────────\n` +
    `View in Dashboard → <a href="${appUrl}/dashboard/applications">${appUrl}/dashboard/applications</a>`;

  await sendMessage(Number(monitoringChannelId) || (monitoringChannelId as any), text, { parse_mode: 'HTML' }).catch(err => {
    console.error('Failed to post application sent receipt to monitoring channel:', err);
  });
}

export async function postRecruiterReplyAlert(
  context: UserContext,
  application: any,
  reply: { from: string; snippet: string; internalDate: string }
): Promise<void> {
  const monitoringChannelId = context.user?.monitoringChannelId;
  if (!monitoringChannelId) return;

  const receivedDate = new Date(Number(reply.internalDate));
  const formattedTime = format(receivedDate, 'HH:mm');
  const formattedDate = format(receivedDate, 'MMMM d, yyyy');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://applyr.vercel.app';

  const escapeHtml = (unsafe: string) => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const senderDisplay = escapeHtml(reply.from);
  const snippetEscaped = escapeHtml(reply.snippet);

  const text = `<b>📬 Recruiter Reply Detected</b>\n` +
    `─────────────────────────────\n` +
    `🏢  <b>Company:</b>   ${application.company}\n` +
    `💼  <b>Role:</b>      ${application.jobTitle}\n` +
    `👤  <b>From:</b>      ${senderDisplay}\n` +
    `🕐  <b>Received:</b>  ${formattedTime} · ${formattedDate}\n` +
    `💬  <b>Preview:</b>   "${snippetEscaped}"\n` +
    `─────────────────────────────\n` +
    `Update Status → <a href="${appUrl}/dashboard/applications">${appUrl}/dashboard/applications</a>`;

  await sendMessage(Number(monitoringChannelId) || (monitoringChannelId as any), text, { parse_mode: 'HTML' }).catch(err => {
    console.error('Failed to post recruiter reply alert to monitoring channel:', err);
  });
}
