import { TelegramUpdate } from '../../../types/telegram';
import { UserContext } from '../../userContext';
import { handleWizardFileSelection } from './wizardFileSelection';
import { handleActiveSteadyState } from './activeSteadyState';
import { handleActiveProcessing } from './activeProcessing';
import { sendMessage } from '../bot';
import { isGoogleAuthError, logError } from '../../logger';

export async function routeUpdate(update: TelegramUpdate, context: UserContext): Promise<void> {
  const isStartPayload = !!(update.message?.text?.startsWith('/start '));
  const state = isStartPayload ? 'UNPAIRED' : (context.botSession?.botState ?? 'UNPAIRED');

  try {
    switch (state) {
      case 'UNPAIRED':
      case 'WIZARD_FILE_SELECTION':
      case 'WIZARD_AWAITING_UPLOAD':
        return await handleWizardFileSelection(update, context);
      case 'WIZARD_OVERWRITE_CONFIRM':
        if (context.botSession?.targetSlot === 'natural_command_confirm') {
          return await handleActiveProcessing(update, context);
        }
        return await handleWizardFileSelection(update, context);
      case 'ACTIVE_STEADY_STATE':
        return await handleActiveSteadyState(update, context);
      case 'ACTIVE_PROCESSING':
        // Ignore input — bot is busy processing a job post
        return;
      case 'AWAITING_EMAIL_CONFIRM':
      case 'AWAITING_APPROVAL':
      case 'EDITING_EMAIL':
        return await handleActiveProcessing(update, context);
      default:
        return await handleWizardFileSelection(update, context);
    }
  } catch (err: any) {
    logError('telegram-route-update-inner', err);
    if (isGoogleAuthError(err)) {
      let chatId: number | null = null;
      if (update.message) {
        chatId = update.message.chat.id;
      } else if (update.callback_query) {
        chatId = update.callback_query.message?.chat.id || null;
      }
      if (chatId) {
        await sendMessage(
          chatId,
          `⚠️ **Your Google connection needs to be re-authorized.** Please visit your dashboard and reconnect Google Drive/Gmail.`
        ).catch(() => null);
      }
    }
  }
}
