import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getAdminDb } from '../../../lib/firebase/admin';
import { loadUserContext } from '../../../lib/userContext';
import { routeUpdate } from '../../../lib/telegram/states';
import { sendMessage } from '../../../lib/telegram/bot';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const secretTokenHeader = request.headers.get('x-telegram-bot-api-secret-token');
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (secretToken && secretTokenHeader !== secretToken) {
      console.warn('Unauthorized telegram-webhook request. Invalid secret token header.');
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
          console.warn('No telegram_user_id found in update payload');
          return;
        }

        const db = getAdminDb();
        const mappingRef = db.doc(`telegram_mappings/${telegramUserId}`);
        const mappingSnap = await mappingRef.get();

        if (mappingSnap.exists) {
          const mappingData = mappingSnap.data();
          const firebaseUid = mappingData?.firebaseUid;

          if (firebaseUid) {
            const context = await loadUserContext(firebaseUid);
            await routeUpdate(update, context);
          } else {
            console.warn(`No firebaseUid in mapping for user: ${telegramUserId}`);
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
        console.error('Error during background processing of telegram update:', backgroundError);
      }
    });

    return response;
  } catch (error: any) {
    console.error('Error in Telegram Webhook endpoint:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
