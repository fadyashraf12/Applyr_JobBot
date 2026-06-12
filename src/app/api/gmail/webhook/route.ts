import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getAdminDb } from '../../../../lib/firebase/admin';
import { getValidAccessToken } from '../../../../lib/google/oauth';
import { sendMessage } from '../../../../lib/telegram/bot';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.message || !body.message.data) {
      return NextResponse.json({ success: true, warning: 'Empty message body ignored' });
    }

    // Google Pub/Sub requires rapid 200 return to avoid duplicate queues
    const res = NextResponse.json({ success: true });

    // Continue background synchronization gracefully inside serverless execution thread
    after(async () => {
      try {
        const decodedText = Buffer.from(body.message.data, 'base64').toString('utf-8');
        const watchPayload = JSON.parse(decodedText);
        
        const { emailAddress, historyId: startHistoryId } = watchPayload;
        if (!emailAddress || !startHistoryId) return;

        const db = getAdminDb();
        
        // Find matching connected google credential context
        const googleConfigs = await db.collectionGroup('google')
          .where('connectedEmail', '==', emailAddress)
          .get();

        if (googleConfigs.empty) return;

        const configDoc = googleConfigs.docs[0];
        const configPathParts = configDoc.ref.path.split('/');
        const uid = configPathParts[1];

        const userDoc = await db.doc(`users/${uid}`).get();
        if (!userDoc.exists) return;
        const userData = userDoc.data() as any;

        const googleConfig = configDoc.data() as any;
        const lastKnownHistoryId = googleConfig.gmailHistoryId;

        // Decrypt connection credentials
        const accessToken = await getValidAccessToken(uid);

        // Save new history ID reference
        await configDoc.ref.update({ gmailHistoryId: String(startHistoryId) });

        // Retrieve Gmail thread additions delta
        let historyUrl = `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${lastKnownHistoryId || startHistoryId}`;
        const historyResponse = await fetch(historyUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!historyResponse.ok) {
          console.warn('Gmail history retrieve failure:', await historyResponse.text());
          return;
        }

        const historyResult = await historyResponse.json();
        if (!historyResult.history) return;

        const newMessageIds: string[] = [];
        for (const record of historyResult.history) {
          if (record.messagesAdded) {
            for (const item of record.messagesAdded) {
              if (item.message && item.message.id) {
                newMessageIds.push(item.message.id);
              }
            }
          }
        }

        // De-duplicate gathered IDs
        const uniqueMessageIds = Array.from(new Set(newMessageIds));

        for (const msgId of uniqueMessageIds) {
          // Fetch raw headers & snippets
          const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`;
          const msgResponse = await fetch(msgUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          if (!msgResponse.ok) continue;

          const msgData = await msgResponse.json();
          const headers = msgData.payload?.headers || [];
          
          let fromValue = '';
          let subjectValue = '';
          for (const h of headers) {
            const nameLower = h.name.toLowerCase();
            if (nameLower === 'from') fromValue = h.value;
            if (nameLower === 'subject') subjectValue = h.value;
          }

          if (!fromValue) continue;

          // Parse matching clean email address
          const emailMatch = fromValue.match(/<([^>]+)>/) || [null, fromValue];
          const senderEmail = (emailMatch[1] || fromValue).trim().toLowerCase();

          // Verify if sender email is currently logged under active applications
          const applicationsSnap = await db.collection(`users/${uid}/applications`)
            .where('hrEmail', '==', senderEmail)
            .get();

          if (applicationsSnap.empty) continue;

          // Loop applications matching the sender's email ID
          for (const doc of applicationsSnap.docs) {
            const app = doc.data() as any;

            // Mark recruiter replied
            await doc.ref.update({
              recruiterReplied: true,
              lastReplyAt: new Date(),
              lastReplySnippet: msgData.snippet || 'No message content preview available.'
            });

            // Trigger real-time private channel alert
            const monitoringChannelId = userData.monitoringChannelId;
            if (monitoringChannelId) {
              const alertMsg = `📬 **Recruiter Reply Detected**\n` +
                `─────────────────────────────\n` +
                `🏢 **Company:**   ${app.company}\n` +
                `💼 **Role:**      ${app.jobTitle}\n` +
                `👤 **From:**      ${fromValue}\n` +
                `🕐 **Received:**  ${new Date().toLocaleTimeString()} · ${new Date().toLocaleDateString()}\n` +
                `💬 **Preview:**   *"${msgData.snippet || 'No snippet'}"*\n` +
                `─────────────────────────────\n` +
                `Update Status → ${process.env.NEXT_PUBLIC_APP_URL || 'https://applyr.vercel.app'}/dashboard/applications`;

              await sendMessage(monitoringChannelId, alertMsg, { parse_mode: 'Markdown' }).catch((err) => {
                console.warn('Telegram monitoring alert failed:', err);
              });
            }
          }
        }

      } catch (childErr) {
        console.error('Child webhook notification flow failed:', childErr);
      }
    });

    return res;

  } catch (error: any) {
    console.error('Core Gmail listener webhook crash:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
