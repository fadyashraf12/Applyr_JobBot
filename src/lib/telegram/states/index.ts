import { TelegramUpdate } from '../../../types/telegram';
import { UserContext } from '../../userContext';
import { handleWizardFileSelection } from './wizardFileSelection';
import { handleActiveSteadyState } from './activeSteadyState';
import { handleActiveProcessing } from './activeProcessing';

export async function routeUpdate(update: TelegramUpdate, context: UserContext): Promise<void> {
  // If we have update start payload and user is not paired (could still map state), let wizard select it
  const isStartPayload = !!(update.message?.text?.startsWith('/start '));
  const state = isStartPayload ? 'UNPAIRED' : (context.botSession?.botState ?? 'UNPAIRED');

  switch (state) {
    case 'UNPAIRED':
    case 'WIZARD_FILE_SELECTION':
    case 'WIZARD_AWAITING_UPLOAD':
      return handleWizardFileSelection(update, context);
    case 'WIZARD_OVERWRITE_CONFIRM':
      if (context.botSession?.targetSlot === 'natural_command_confirm') {
        return handleActiveProcessing(update, context);
      }
      return handleWizardFileSelection(update, context);
    case 'ACTIVE_STEADY_STATE':
      return handleActiveSteadyState(update, context);
    case 'ACTIVE_PROCESSING':
      // Ignore input — bot is busy processing a job post
      return;
    case 'AWAITING_EMAIL_CONFIRM':
    case 'AWAITING_APPROVAL':
    case 'EDITING_EMAIL':
      return handleActiveProcessing(update, context);
    default:
      return handleWizardFileSelection(update, context);
  }
}
