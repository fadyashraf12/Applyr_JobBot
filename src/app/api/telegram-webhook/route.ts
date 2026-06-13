import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getAdminDb } from '../../../lib/firebase/admin';
import { loadUserContext } from '../../../lib/userContext';
import { routeUpdate } from '../../../lib/telegram/states';
import { sendMessage } from '../../../lib/telegram/bot';
import { logError } from '../../../lib/logger';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const secretTokenHeader = request.headers.get('x-telegram-bot-api-secret-token');
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (secretToken && secretTokenHeader !== secretToken) {
      logError('telegram-webhook-unauthorized', 'Unauthorized telegram-webhook request. Invalid secret token header.');
      return new Response('Forbidden', { status: 403 });
    }

    const update = await request.json();

    // Immediately return HTTP 200 OK to Telegram
    const response = NextResponse.json({ ok: true });

    // Handle background processing asynchronously
    after(async () => {
      try {
        let telegramUserId: string | null = null;
        let chatId: number | string | null = null;

        if (update.message) {
          telegramUserId = String(update.message.from?.id || '');
          chatId = update.message.chat.id;
        } else if (update.callback_query) {
          telegramUserId = String(update.callback_query.from?.id || '');
          chatId = update.callback_query.message?.chat.id || null;
        }

        if (!telegramUserId) {
          return;
        }

        const db = getAdminDb();
        const mappingRef = db.doc(`telegram_mappings/${telegramUserId}`);
        const mappingSnap = await mappingRef.get();

        if (mappingSnap.exists) {
          const mappingData = mappingSnap.data();
          const firebaseUid = mappingData?.firebaseUid;

          if (firebaseUid) {
            // Idempotency check: store and inspect update_id
            if (update.update_id) {
              const botSessionRef = db.doc(`users/${firebaseUid}/botSession/current`);
              const sessionSnap = await botSessionRef.get();
              if (sessionSnap.exists) {
                const sessionData = sessionSnap.data();
                const lastId = sessionData?.lastUpdateId || 0;
                if (update.update_id <= lastId) {
                  return; // Skip duplicate processing
                }
              }
              await botSessionRef.set({ lastUpdateId: update.update_id }, { merge: true });
            }

            const context = await loadUserContext(firebaseUid);
            await routeUpdate(update, context);
          }
        } else {
          // If no mapping, check if message is a pairing deep-link
          const isPairingMsg = update.message?.text?.startsWith('/start ');
          
          if (isPairingMsg) {
            const payload = update.message.text.substring(7).trim();
            if (payload.startsWith('pair_')) {
              const token = payload.substring(5).trim();
              const tokenSnap = await db.collection('pairing_tokens').doc(token).get();
              
              if (tokenSnap.exists) {
                const tokenData = tokenSnap.data();
                if (tokenData && !tokenData.used) {
                  const firebaseUid = tokenData.firebaseUid;
                  const context = await loadUserContext(firebaseUid);
                  
                  if (update.update_id) {
                    const botSessionRef = db.doc(`users/${firebaseUid}/botSession/current`);
                    await botSessionRef.set({ lastUpdateId: update.update_id }, { merge: true });
                  }

                  await routeUpdate(update, context);
                  return;
                }
              }
            }
          }

          // Otherwise, notify them to connect first
          if (chatId) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://applyr.vercel.app';
            await sendMessage(
              chatId,
              `⚠️ **Account Not Linked**\n\nPlease visit [Applyr Console](${appUrl}) to sign in and pair your Telegram account first!`,
              { parse_mode: 'Markdown' }
            );
          }
        }
      } catch (backgroundError) {
        logError('telegram-webhook-background', backgroundError);
      }
    });

    return response;
  } catch (error: any) {
    logError('telegram-webhook-root', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
