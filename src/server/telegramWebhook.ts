import { Request, Response } from 'express';
import { getAdminDb } from '../lib/firebase/admin';
import { loadUserContext } from '../lib/userContext';
import { routeUpdate } from '../lib/telegram/states';
import { sendMessage } from '../lib/telegram/bot';
import { logError } from '../lib/logger';

async function processTelegramUpdate(update: any): Promise<void> {
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
      const isPairingMsg = !!(update.message?.text?.startsWith('/start '));
      let handledPairing = false;
      
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
              handledPairing = true;
            }
          }
        }
      }

      // Otherwise, notify them to connect first — but only send this for /start payloads that are not pair_<token> deep links
      if (!handledPairing && chatId) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://applyr.vercel.app';
        await sendMessage(
          chatId,
          `⚠️ **Account Not Linked**\n\nPlease visit [Applyr Console](${appUrl}) to sign in and pair your Telegram account first!`,
          { parse_mode: 'Markdown' }
        );
      }
    }
  } catch (backgroundError) {
    logError('telegram-webhook-background-processing', backgroundError);
  }
}

export async function telegramWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    const secretTokenHeader = req.headers['x-telegram-bot-api-secret-token'];
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (secretToken && secretTokenHeader !== secretToken) {
      logError('telegram-webhook-unauthorized', 'Unauthorized telegram-webhook request. Invalid secret token header.');
      res.status(403).send('Forbidden');
      return;
    }

    const update = req.body;

    // Immediately return HTTP 200 OK to Telegram
    res.status(200).json({ ok: true });

    // Handle background processing asynchronously after response is sent
    processTelegramUpdate(update).catch((err) => {
      logError('telegram-webhook-bg', err);
    });
  } catch (error: any) {
    logError('telegram-webhook-root', error);
    // Since we are in an error state before response, send 500
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  }
}
