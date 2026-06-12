import { UserContext } from '../userContext';
import { DraftDoc } from '../../types/firestore';
import { sendDocument, sendMessage } from './bot';
import { downloadFile } from '../google/drive';
import { buildApprovalKeyboard } from './keyboards';
import { getAdminDb } from '../firebase/admin';

export async function sendReviewPackage(context: UserContext, draft: DraftDoc): Promise<void> {
  const db = getAdminDb();
  
  // Find Telegram character map to identify chatId
  const mappingSnap = await db.collection('telegram_mappings')
    .where('firebaseUid', '==', context.uid)
    .limit(1)
    .get();

  if (mappingSnap.empty) {
    throw new Error(`Telegram mapping not found for user: ${context.uid}`);
  }
  
  const chatId = Number(mappingSnap.docs[0].id);

  // Download Tailored CV from Google Drive
  const pdfBuffer = await downloadFile(context.uid, draft.tailoredCvFileId);
  const companyClean = draft.company.replace(/[^a-zA-Z0-9]/g, '_');
  const pdfName = `Tailored_CV_${companyClean}.pdf`;

  // 1. Attached Tailored Resume
  await sendDocument(
    chatId,
    pdfBuffer,
    pdfName,
    `📂 **Tailored Resume PDF** for ${draft.company}`
  );

  // 2. Draft review text body
  const previewMessage = `📥 Application Draft Ready — Please Review\n\n` +
    `To: ${draft.hrEmail || 'Not Specified'}\n` +
    `Subject: ${draft.emailSubject}\n\n` +
    `Email Body:\n` +
    `${draft.emailBody}`;

  const keyboard = buildApprovalKeyboard(draft.draftId);

  // 3. Send message with Approval Keyboard
  await sendMessage(chatId, previewMessage, {
    reply_markup: keyboard
  });
}
