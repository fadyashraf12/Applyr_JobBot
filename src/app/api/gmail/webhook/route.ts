import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getAdminDb } from '../../../../lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { getHistorySince, getMessage } from '../../../../lib/google/gmail';
import { loadUserContext } from '../../../../lib/userContext';
import { postRecruiterReplyAlert } from '../../../../lib/telegram/monitoring';
import { logError } from '../../../../lib/logger';

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
        
        const { emailAddress, historyId: payloadHistoryId } = watchPayload;
        if (!emailAddress || !payloadHistoryId) return;

        const db = getAdminDb();
        
        // Find matching connected google credential context (collectionGroup config matches doc path users/{uid}/config/google)
        const googleConfigs = await db.collectionGroup('config')
          .where('connectedEmail', '==', emailAddress)
          .get();

        if (googleConfigs.empty) {
          return;
        }

        const configDoc = googleConfigs.docs[0];
        const configPathParts = configDoc.ref.path.split('/');
        const uid = configPathParts[1];

        const userContext = await loadUserContext(uid);
        if (!userContext || !userContext.user) {
          return;
        }

        const googleConfig = configDoc.data() as any;
        const lastKnownHistoryId = googleConfig.gmailHistoryId;

        // Retrieve Gmail thread additions delta
        if (!lastKnownHistoryId) {
          // If no historyId is stored yet, we save this payload's historyId as baseline and skip processing history now
          await configDoc.ref.update({ gmailHistoryId: String(payloadHistoryId) });
          return;
        }

        const newMessageIds = await getHistorySince(uid, lastKnownHistoryId);

        for (const msgId of newMessageIds) {
          try {
            const msgInfo = await getMessage(uid, msgId);
            
            // Check if message is a sent message (has SENT label) to exclude
            if (msgInfo.labelIds && msgInfo.labelIds.includes('SENT')) {
              continue;
            }

            const fromEmail = msgInfo.from.toLowerCase();

            // Find matching applications (case-insensitive match)
            const applicationsSnap = await db.collection(`users/${uid}/applications`).get();
            const matchingAppDocs = applicationsSnap.docs.filter(docSnap => {
              const appData = docSnap.data();
              return appData.hrEmail && appData.hrEmail.toLowerCase() === fromEmail;
            });

            for (const appDoc of matchingAppDocs) {
              const application = { id: appDoc.id, ...appDoc.data() } as any;

              // Update the application
              const lastReplyAtTimestamp = Timestamp.fromMillis(Number(msgInfo.internalDate));
              const replySnippet = msgInfo.snippet.slice(0, 200);

              await appDoc.ref.update({
                recruiterReplied: true,
                lastReplyAt: lastReplyAtTimestamp,
                lastReplySnippet: replySnippet
              });

              // Construct updated application record
              const updatedAppRecord = {
                ...application,
                recruiterReplied: true,
                lastReplyAt: lastReplyAtTimestamp,
                lastReplySnippet: replySnippet
              };

              await postRecruiterReplyAlert(userContext, updatedAppRecord, {
                from: msgInfo.from,
                snippet: msgInfo.snippet,
                internalDate: msgInfo.internalDate
              }).catch(err => {
                logError('gmail-webhook-post-alert', err);
              });
            }
          } catch (msgErr) {
            logError('gmail-webhook-msg-process', msgErr);
          }
        }

        // Update to latest historyId
        await configDoc.ref.update({ gmailHistoryId: String(payloadHistoryId) });

      } catch (childErr) {
        logError('gmail-webhook-child-thread', childErr);
      }
    });

    return res;

  } catch (error: any) {
    logError('gmail-webhook-root', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
