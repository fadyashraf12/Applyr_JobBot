import { InlineKeyboard } from './bot';
import { ProfileDoc } from '../../types/firestore';

// The file upload wizard grid — builds dynamically based on which slots have files
export function buildFileSelectionKeyboard(profile: ProfileDoc): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        {
          text: profile.masterCvFileId ? '✅ Resume' : '📄 Resume (Required)',
          callback_data: 'slot_resume',
        },
      ],
      [
        {
          text: profile.coverLetterTemplateFileId ? '✅ Cover Letter' : '📝 Cover Letter Template',
          callback_data: 'slot_cover_letter',
        },
      ],
      [
        {
          text: profile.headshotFileId ? '✅ Headshot' : '🖼️ Professional Headshot',
          callback_data: 'slot_headshot',
        },
      ],
      [
        {
          text: '🏁 Finish & Activate Bot',
          callback_data: 'finish_wizard',
        },
      ],
    ],
  };
}

// The overwrite confirmation keyboard
export function buildOverwriteConfirmKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '🟢 Delete & Upload New', callback_data: 'overwrite_yes' },
        { text: '🔴 Keep Existing', callback_data: 'overwrite_no' },
      ],
    ],
  };
}

// The job application approval keyboard
export function buildApprovalKeyboard(draftId?: string): InlineKeyboard {
  const suffix = draftId ? `:${draftId}` : '';
  return {
    inline_keyboard: [
      [
        { text: '🚀 Looks Perfect — Send Now', callback_data: `send_now${suffix}` },
      ],
      [
        { text: '📝 Edit Email Body', callback_data: `edit_email${suffix}` },
      ],
      [
        { text: '❌ Discard Draft', callback_data: `discard_draft${suffix}` },
      ],
    ],
  };
}
export function buildApprovalKeyboardWithCallback(): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '🚀 Looks Perfect — Send Now', callback_data: 'send_now' },
      ],
      [
        { text: '📝 Edit Email Body', callback_data: 'edit_email' },
      ],
      [
        { text: '❌ Discard Draft', callback_data: 'discard_draft' },
      ],
    ],
  };
}
