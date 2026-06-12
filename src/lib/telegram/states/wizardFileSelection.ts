import { TelegramUpdate } from '../../../types/telegram';
import { UserContext } from '../../userContext';
import { getAdminDb } from '../../firebase/admin';
import { consumePairingToken } from '../../pairingToken';
import { sendMessage, editMessageText, getFile, downloadFile } from '../bot';
import { buildFileSelectionKeyboard, buildOverwriteConfirmKeyboard } from '../keyboards';
import { uploadFile, deleteFile } from '../../google/drive';

export async function handleWizardFileSelection(
  update: TelegramUpdate,
  context: UserContext
): Promise<void> {
  const db = getAdminDb();
  const userId = context.uid;

  // ── 1. Deep Link Pairing Handler ──
  if (update.message?.text?.startsWith('/start ')) {
    const payload = update.message.text.substring(7).trim(); // Remove "/start "
    
    if (payload.startsWith('pair_')) {
      const token = payload.substring(5).trim();
      const chat_id = update.message.chat.id;

      // Validate & consume token
      const pairingResult = await consumePairingToken(token);
      if (!pairingResult.success) {
        let errorMsg = 'Invalid or expired link. Please generate a new one from the dashboard.';
        if (pairingResult.error === 'used') {
          errorMsg = 'This link has already been used.';
        } else if (pairingResult.error === 'expired') {
          errorMsg = 'This link has expired. Please generate a new one from the dashboard.';
        }
        await sendMessage(chat_id, `❌ ${errorMsg}`);
        return;
      }

      const firebaseUid = pairingResult.firebaseUid!;
      const telegramUserId = String(update.message.from?.id);

      // Save telegram mapping
      await db.collection('telegram_mappings').doc(telegramUserId).set({
        telegramUserId,
        firebaseUid,
        linkedAt: new Date(),
      });

      // Initialize Bot Session
      await db.doc(`users/${firebaseUid}/botSession/current`).set({
        botState: 'WIZARD_FILE_SELECTION',
        targetSlot: null,
        targetProfileId: null,
        activeDraftId: null,
        lastMessageId: null,
        updatedAt: new Date(),
      });

      // Update basic user documentation state to wizard
      await db.doc(`users/${firebaseUid}`).set(
        {
          botState: 'WIZARD_FILE_SELECTION',
        },
        { merge: true }
      );

      // Welcome Message text as exactly described in Section 9 Scenario A:
      const welcomeText =
        `⚡ **Connection Successful!**\n` +
        `Welcome to your personal Applyr workspace. I've securely linked this Telegram account to your Google workspace.\n\n` +
        `Before I can start managing your job applications, I need your core professional files. Your **Resume (CV)** is required. Everything else is optional.`;

      // Fetch active profile or first profile
      const activeProfileId = context.user?.activeProfileId || '';
      let activeProfile = context.activeProfile;
      if (!activeProfile && activeProfileId) {
        const pSnap = await db.doc(`users/${firebaseUid}/profiles/${activeProfileId}`).get();
        if (pSnap.exists) {
          activeProfile = pSnap.data() as any;
        }
      }
      if (!activeProfile) {
        // Create a default profile if it doesn't exist
        const defaultProfileRef = db.collection(`users/${firebaseUid}/profiles`).doc('default');
        const defaultFolderId = context.googleConfig?.vaultFolderId || 'root';
        activeProfile = {
          profileId: 'default',
          name: 'Default Profile',
          driveFolderId: defaultFolderId,
          masterCvFileId: null,
          coverLetterTemplateFileId: null,
          headshotFileId: null,
          isActive: true,
          createdAt: new Date(),
        };
        await defaultProfileRef.set(activeProfile);
        await db.doc(`users/${firebaseUid}`).set({ activeProfileId: 'default' }, { merge: true });
      }

      const sentMsg = await sendMessage(chat_id, welcomeText, {
        parse_mode: 'Markdown',
        reply_markup: buildFileSelectionKeyboard(activeProfile!),
      });

      // Record the last message ID to edit in place if we want to update the keyboard
      await db.doc(`users/${firebaseUid}/botSession/current`).update({
        lastMessageId: sentMsg.message_id,
      });

      return;
    }
  }

  // Ensure user profile exists from context
  const activeProfile = context.activeProfile;
  if (!activeProfile) {
    // Fail-safe: if no active profile, let user know
    const chatId = update.message?.chat.id || update.callback_query?.message?.chat.id;
    if (chatId) {
      await sendMessage(
        chatId,
        '⚠️ No active profile selected. Please select or create a profile in your Join Applyr dashboard first.'
      );
    }
    return;
  }

  // ── 2. Callbacks (Button clicks) ──
  if (update.callback_query) {
    const query = update.callback_query;
    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;
    const data = query.data;

    if (!chatId || !messageId || !data) return;

    // Handle slot selection (slot_resume, slot_cover_letter, slot_headshot)
    if (data.startsWith('slot_')) {
      const slot = data.substring(5); // e.g. "resume", "cover_letter", "headshot"
      
      let isOccupied = false;
      let fieldText = '';
      if (slot === 'resume') {
        isOccupied = !!activeProfile.masterCvFileId;
        fieldText = 'Resume (CV)';
      } else if (slot === 'cover_letter') {
        isOccupied = !!activeProfile.coverLetterTemplateFileId;
        fieldText = 'Cover Letter Template';
      } else if (slot === 'headshot') {
        isOccupied = !!activeProfile.headshotFileId;
        fieldText = 'Professional Headshot';
      }

      if (isOccupied) {
        // Collision state: trigger Overwrite confirm message
        await db.doc(`users/${userId}/botSession/current`).update({
          botState: 'WIZARD_OVERWRITE_CONFIRM',
          targetSlot: slot,
          updatedAt: new Date(),
        });

        // Edit existing message or send a fresh overwrite confirm
        await sendMessage(chatId, `⚠️ **Asset Collision**\nA file already exists in the **${fieldText}** slot. What would you like to do?`, {
          parse_mode: 'Markdown',
          reply_markup: buildOverwriteConfirmKeyboard()
        });
      } else {
        // Empty slot: Transition to WIZARD_AWAITING_UPLOAD state
        await db.doc(`users/${userId}/botSession/current`).update({
          botState: 'WIZARD_AWAITING_UPLOAD',
          targetSlot: slot,
          updatedAt: new Date(),
        });

        const actionText = `📤 **Awaiting File Upload**\nSend your **${fieldText}** now. Accepted formats: ${
          slot === 'headshot' ? '`.jpg`, `.jpeg`, `.png`' : '`.docx` or `.pdf`'
        }`;
        
        await sendMessage(chatId, actionText, {
          parse_mode: 'Markdown',
        });
      }
      return;
    }

    // Handle overwrite callback yes/no
    if (data === 'overwrite_no') {
      // Re-trigger the selection keyboard unchanged
      await db.doc(`users/${userId}/botSession/current`).update({
        botState: 'WIZARD_FILE_SELECTION',
        targetSlot: null,
        updatedAt: new Date(),
      });

      await sendMessage(chatId, 'Selection retained.', {
        reply_markup: buildFileSelectionKeyboard(activeProfile),
      });
      return;
    }

    if (data === 'overwrite_yes') {
      const session = context.botSession;
      const targetSlot = session?.targetSlot;

      if (!targetSlot) {
        await sendMessage(chatId, '❌ Select a slot first.');
        return;
      }

      // Delete existing file
      let existingFileId = '';
      let fieldText = '';
      if (targetSlot === 'resume') {
        existingFileId = activeProfile.masterCvFileId || '';
        fieldText = 'Resume (CV)';
      } else if (targetSlot === 'cover_letter') {
        existingFileId = activeProfile.coverLetterTemplateFileId || '';
        fieldText = 'Cover Letter Template';
      } else if (targetSlot === 'headshot') {
        existingFileId = activeProfile.headshotFileId || '';
        fieldText = 'Professional Headshot';
      }

      if (existingFileId) {
        try {
          await deleteFile(userId, existingFileId);
        } catch (err) {
          console.error('Error deleting file during overwrite:', err);
        }
      }

      // Clear reference instantly
      const profileField =
        targetSlot === 'resume'
          ? 'masterCvFileId'
          : targetSlot === 'cover_letter'
          ? 'coverLetterTemplateFileId'
          : 'headshotFileId';

      await db.doc(`users/${userId}/profiles/${activeProfile.profileId}`).update({
        [profileField]: null,
      });

      // Update bot state to wait for incoming upload
      await db.doc(`users/${userId}/botSession/current`).update({
        botState: 'WIZARD_AWAITING_UPLOAD',
        updatedAt: new Date(),
      });

      await sendMessage(chatId, `🗑️ Old file deleted. Please upload your new **${fieldText}** now.`, {
        parse_mode: 'Markdown'
      });
      return;
    }

    // Handle Finish Button
    if (data === 'finish_wizard') {
      if (!activeProfile.masterCvFileId) {
        await sendMessage(
          chatId,
          '❌ Activation blocked. A Resume (CV) is required before Applyr can start. Please upload your CV first.',
          {
            reply_markup: buildFileSelectionKeyboard(activeProfile),
          }
        );
        return;
      }

      // Complete wizard! Transition to ACTIVE_STEADY_STATE
      await db.doc(`users/${userId}/botSession/current`).set({
        botState: 'ACTIVE_STEADY_STATE',
        targetSlot: null,
        targetProfileId: null,
        activeDraftId: null,
        lastMessageId: null,
        updatedAt: new Date(),
      });

      await db.doc(`users/${userId}`).update({
        botState: 'ACTIVE_STEADY_STATE',
        onboardingComplete: true
      });

      const activationSuccessText =
        `🚀 **Applyr is Active!**\n` +
        `Your AI assistant is online. Whenever you find a job you want to apply for, simply forward the post here — text, screenshot, or PDF. I'll handle the rest and ask for your approval before anything gets sent.`;

      await sendMessage(chatId, activationSuccessText, {
        parse_mode: 'Markdown',
      });
      return;
    }
  }

  // ── 3. Handle File Uploads (WIZARD_AWAITING_UPLOAD state) ──
  const currentState = context.botSession?.botState;
  if (currentState === 'WIZARD_AWAITING_UPLOAD') {
    const targetSlot = context.botSession?.targetSlot;
    const msg = update.message;

    if (!msg || !targetSlot) return;

    let fileId = '';
    let fileName = '';
    let mimeType = '';

    if (msg.document) {
      fileId = msg.document.file_id;
      fileName = msg.document.file_name || `${targetSlot}_file`;
      mimeType = msg.document.mime_type || 'application/octet-stream';
    } else if (msg.photo && msg.photo.length > 0) {
      // Find largest photo
      const largestPhoto = msg.photo.reduce((prev, current) => {
        return (prev.file_size || 0) > (current.file_size || 0) ? prev : current;
      });
      fileId = largestPhoto.file_id;
      fileName = `headshot_${Date.now()}.jpg`;
      mimeType = 'image/jpeg';
    }

    if (!fileId) {
      await sendMessage(
        msg.chat.id,
        '❌ No valid file detected. Please upload a document (.docx or .pdf) or an image.'
      );
      return;
    }

    // Send processing feedback
    const loadingMsg = await sendMessage(msg.chat.id, '⏳ Downloading and uploading file securely to your Drive...');

    try {
      // Fetch + Download from Telegram
      const fileInfo = await getFile(fileId);
      const fileBuffer = await downloadFile(fileInfo.file_path);

      // Save to Google Drive
      const driveFolderId = activeProfile.driveFolderId || context.googleConfig?.vaultFolderId || 'root';
      const uploadedFileId = await uploadFile(userId, driveFolderId, fileBuffer, fileName, mimeType);

      // Save to Firestore Profile
      const profileField =
        targetSlot === 'resume'
          ? 'masterCvFileId'
          : targetSlot === 'cover_letter'
          ? 'coverLetterTemplateFileId'
          : 'headshotFileId';

      await db.doc(`users/${userId}/profiles/${activeProfile.profileId}`).update({
        [profileField]: uploadedFileId,
      });

      // Reset state back to Selection Grid
      await db.doc(`users/${userId}/botSession/current`).update({
        botState: 'WIZARD_FILE_SELECTION',
        targetSlot: null,
        updatedAt: new Date(),
      });

      // Send updated Profile Details grid
      const updatedProfileSnap = await db.doc(`users/${userId}/profiles/${activeProfile.profileId}`).get();
      const updatedProfile = updatedProfileSnap.data() as any;

      await sendMessage(msg.chat.id, `✅ **${fileName}** uploaded successfully and saved to your context slot!`, {
        parse_mode: 'Markdown'
      });

      await sendMessage(msg.chat.id, `Interactive Document Configuration:`, {
        reply_markup: buildFileSelectionKeyboard(updatedProfile),
      });

    } catch (err: any) {
      console.error('File processing failed:', err);
      await sendMessage(msg.chat.id, `❌ File upload failed: ${err.message || err}`);
    }
    return;
  }
}
