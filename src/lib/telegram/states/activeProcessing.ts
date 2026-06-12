import { TelegramUpdate } from '../../../types/telegram';
import { UserContext } from '../../userContext';
import { getAdminDb } from '../../firebase/admin';
import { sendMessage, sendDocument } from '../bot';
import { sendEmail } from '../../google/gmail';
import { downloadFile, updateFile, deleteFile } from '../../google/drive';
import { buildDocx } from '../../documents/buildDocx';
import { convertToPdf } from '../../documents/convertToPdf';
import { sendReviewPackage } from './activeSteadyState';

export async function handleActiveProcessing(
  update: TelegramUpdate,
  context: UserContext
): Promise<void> {
  const db = getAdminDb();
  const uid = context.uid;
  const botState = context.botSession?.botState;

  const chatId = update.message?.chat.id || update.callback_query?.message?.chat.id;
  if (!chatId) return;

  // ── 1. Handle CB Queries (AWAITING_APPROVAL replies) ──
  if (update.callback_query) {
    const cb = update.callback_query;
    const data = cb.data || '';

    if (data.startsWith('send_now:')) {
      const draftId = data.substring(9);
      await handleSendNow(chatId, draftId, context);
    } else if (data.startsWith('edit_email:')) {
      const draftId = data.substring(11);
      // Change state to EDITING_EMAIL
      await db.doc(`users/${uid}/botSession/current`).set({
        botState: 'EDITING_EMAIL',
        activeDraftId: draftId,
        updatedAt: new Date()
      }, { merge: true });
      await db.doc(`users/${uid}`).update({ botState: 'EDITING_EMAIL' });

      await sendMessage(chatId, `✏️ **Edit Mode Engaged:**\n\nPlease type your new cover email body message content below. I will update the preview package accordingly.`);
    } else if (data.startsWith('discard_draft:')) {
      const draftId = data.substring(14);
      await handleDiscardDraft(chatId, draftId, context);
    }
    return;
  }

  // ── 2. Handle Text Messages ──
  const textMsg = update.message?.text?.trim();
  if (!textMsg) return;

  // Case A: Natural CV Command permanent replacement confirm
  if (botState === 'WIZARD_OVERWRITE_CONFIRM' && context.botSession?.targetSlot === 'natural_command_confirm') {
    const txtLower = textMsg.toLowerCase();
    
    if (txtLower === 'confirm') {
      await sendMessage(chatId, `⏳ **Updating master resume with edits...**`);
      try {
        const tempParsedCvStr = context.botSession.tempParsedCv;
        if (!tempParsedCvStr) {
          throw new Error("Temporary CVS buffer edits are missing.");
        }
        const tempParsedCv = JSON.parse(tempParsedCvStr);

        // Find CV file ID
        const activeProfileId = context.activeProfile?.profileId || context.user?.activeProfileId;
        if (!activeProfileId) {
          throw new Error("No active profile context found.");
        }
        const profileSnap = await db.doc(`users/${uid}/profiles/${activeProfileId}`).get();
        const profile = profileSnap.data();
        const masterCvFileId = profile?.masterCvFileId;

        if (!masterCvFileId) {
          throw new Error("Master CV file ID target lost.");
        }

        // Build edited docx
        const newDocxBuffer = await buildDocx(tempParsedCv, tempParsedCv.summary, tempParsedCv.skills);

        // Overwrite Master CV in Google Drive
        await updateFile(uid, masterCvFileId, newDocxBuffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        // Repost feedback PDF
        const pdfBuffer = await convertToPdf(tempParsedCv, tempParsedCv.summary, tempParsedCv.skills);
        await sendDocument(
          chatId,
          pdfBuffer,
          'Master_CV_Updated.pdf',
          `✅ **Master CV Successfully Updated and Synchronized!**\n\nYour CV has been updated on your Google Drive permanently and is active for future tailoring sessions.`
        );

      } catch (err: any) {
        console.error('Core master override confirmation err:', err);
        await sendMessage(chatId, `❌ **Override Fail:** ${err.message || err}`);
      }

      // Reset bot session
      await resetToSteadyState(uid);
    } else if (txtLower === 'cancel') {
      await sendMessage(chatId, `❌ **Changes Discarded.** Your Master resume is untouched.`);
      await resetToSteadyState(uid);
    } else {
      await sendMessage(chatId, `⚠️ Please reply **"confirm"** to accept changes, or **"cancel"** to revert.`);
    }
    return;
  }

  // Case B: Awaiting Email Confirmation input
  if (botState === 'AWAITING_EMAIL_CONFIRM') {
    const draftId = context.botSession?.activeDraftId;
    if (!draftId) {
      await sendMessage(chatId, `❌ No active application draft session mapped. Please restart job post forwarding.`);
      await resetToSteadyState(uid);
      return;
    }

    if (textMsg.toLowerCase() === 'skip') {
      await handleDiscardDraft(chatId, draftId, context);
      return;
    }

    // Email regex check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(textMsg)) {
      await sendMessage(chatId, `⚠️ **Invalid Email:** Please enter a valid email address (e.g. \`hr@company.com\`), or type \`skip\` to cancel.`);
      return;
    }

    try {
      // Update draft details
      await db.doc(`users/${uid}/drafts/${draftId}`).update({
        hrEmail: textMsg,
        hrEmailConfirmed: true,
        status: 'awaiting_approval'
      });

      // Change state
      await db.doc(`users/${uid}/botSession/current`).set({
        botState: 'AWAITING_APPROVAL',
        updatedAt: new Date()
      }, { merge: true });
      await db.doc(`users/${uid}`).update({ botState: 'AWAITING_APPROVAL' });

      // Build & Send review Package
      const draftSnap = await db.doc(`users/${uid}/drafts/${draftId}`).get();
      const draft = draftSnap.data() as any;

      const pdfBuffer = await downloadFile(uid, draft.tailoredCvFileId);
      const companyClean = draft.company.replace(/[^a-zA-Z0-9]/g, '_');
      
      await sendReviewPackage(chatId, {
        draftId,
        company: draft.company,
        jobTitle: draft.jobTitle,
        hrEmail: textMsg,
        emailSubject: draft.emailSubject,
        emailBody: draft.emailBody,
        pdfBuffer,
        pdfName: `Tailored_CV_${companyClean}.pdf`
      });

    } catch (err: any) {
      console.error('Email confirmation ingestion failed:', err);
      await sendMessage(chatId, `❌ **Confirmation Ingestion Failed:** ${err.message || err}`);
    }
    return;
  }

  // Case C: Editing cover letter text body
  if (botState === 'EDITING_EMAIL') {
    const draftId = context.botSession?.activeDraftId;
    if (!draftId) {
      await sendMessage(chatId, `❌ Draft session lost.`);
      await resetToSteadyState(uid);
      return;
    }

    try {
      // Update draft body content
      await db.doc(`users/${uid}/drafts/${draftId}`).update({
        emailBody: textMsg,
        status: 'awaiting_approval'
      });

      // Reset state to AWAITING_APPROVAL
      await db.doc(`users/${uid}/botSession/current`).set({
        botState: 'AWAITING_APPROVAL',
        updatedAt: new Date()
      }, { merge: true });
      await db.doc(`users/${uid}`).update({ botState: 'AWAITING_APPROVAL' });

      // Refresh review presentation
      const draftSnap = await db.doc(`users/${uid}/drafts/${draftId}`).get();
      const draft = draftSnap.data() as any;

      const pdfBuffer = await downloadFile(uid, draft.tailoredCvFileId);
      const companyClean = draft.company.replace(/[^a-zA-Z0-9]/g, '_');
      
      await sendReviewPackage(chatId, {
        draftId,
        company: draft.company,
        jobTitle: draft.jobTitle,
        hrEmail: draft.hrEmail || '',
        emailSubject: draft.emailSubject,
        emailBody: textMsg,
        pdfBuffer,
        pdfName: `Tailored_CV_${companyClean}.pdf`
      });

    } catch (err: any) {
      console.error('Refining draft email workflow fails:', err);
      await sendMessage(chatId, `❌ **Refining Draft Failed:** ${err.message || err}`);
    }
    return;
  }
}

async function handleSendNow(chatId: number, draftId: string, context: UserContext): Promise<void> {
  const db = getAdminDb();
  const uid = context.uid;

  await sendMessage(chatId, `🚀 **Sending your application now...**`);

  try {
    const draftSnap = await db.doc(`users/${uid}/drafts/${draftId}`).get();
    if (!draftSnap.exists) {
      throw new Error("Hiring draft document expired or missing.");
    }

    const draft = draftSnap.data() as any;
    const hrEmail = draft.hrEmail;

    if (!hrEmail) {
      throw new Error("No receiver contact email specified.");
    }

    // Download compiled PDF CV Buffer
    const pdfBuffer = await downloadFile(uid, draft.tailoredCvFileId);
    const companyClean = draft.company.replace(/[^a-zA-Z0-9]/g, '_');
    const pdfName = `Tailored_CV_${companyClean}.pdf`;

    // Trigger exact atomic Google API send
    await sendEmail({
      uid,
      to: hrEmail,
      subject: draft.emailSubject,
      body: draft.emailBody,
      attachmentBuffer: pdfBuffer,
      attachmentName: pdfName,
      attachmentMimeType: 'application/pdf'
    });

    // Create persistent CRM Application Record
    const appDocId = db.collection(`users/${uid}/applications`).doc().id;
    await db.doc(`users/${uid}/applications/${appDocId}`).set({
      applicationId: appDocId,
      profileId: draft.profileId,
      company: draft.company,
      jobTitle: draft.jobTitle,
      jobDescription: '', // Keep clean / parsed
      hrEmail: hrEmail,
      status: 'pending',
      appliedAt: new Date(),
      tailoredCvFileId: draft.tailoredCvFileId,
      emailSubject: draft.emailSubject,
      emailBody: draft.emailBody,
      notes: '',
      followUpDate: null,
      contacts: [],
      recruiterReplied: false,
      lastReplyAt: null,
      lastReplySnippet: null,
      sourceType: 'text'
    });

    // Delete draft record
    await db.doc(`users/${uid}/drafts/${draftId}`).delete();

    // Reset bot states
    await resetToSteadyState(uid);

    await sendMessage(chatId, `✅ **Success!** Your application has been sent to \`${hrEmail}\` and logged into your Applyr CRM dashboard.`);

    // Send Monitoring Channel alert if configure mapped
    const userDoc = await db.doc(`users/${uid}`).get();
    const monitoringChannelId = userDoc.data()?.monitoringChannelId;

    if (monitoringChannelId) {
      const channelMsg = `✅ **Application Sent**\n` +
        `─────────────────────\n` +
        `🏢 **Company:**   ${draft.company}\n` +
        `💼 **Role:**      ${draft.jobTitle}\n` +
        `📧 **Sent to:**   \`${hrEmail}\`\n` +
        `🕐 **Time:**      ${new Date().toLocaleTimeString()} · ${new Date().toLocaleDateString()}\n` +
        `─────────────────────\n` +
        `Track App → ${process.env.NEXT_PUBLIC_APP_URL || 'https://applyr.vercel.app'}/dashboard/applications`;

      await sendMessage(monitoringChannelId, channelMsg, { parse_mode: 'Markdown' }).catch((chanErr) => {
        console.warn('Silent fail dispatching alert to monitoring channel:', chanErr);
      });
    }

  } catch (err: any) {
    console.error('Final deployment send atomic workflow fails:', err);
    await sendMessage(chatId, `❌ **Delivery Failure:** ${err?.message || err}`);
    await resetToSteadyState(uid);
  }
}

async function handleDiscardDraft(chatId: number, draftId: string, context: UserContext): Promise<void> {
  const db = getAdminDb();
  const uid = context.uid;

  try {
    const draftSnap = await db.doc(`users/${uid}/drafts/${draftId}`).get();
    if (draftSnap.exists) {
      const draft = draftSnap.data() as any;
      if (draft.tailoredCvFileId) {
        // Delete working CV pdf copy from Cloud Drive to avoid clutter as specified in spec
        await deleteFile(uid, draft.tailoredCvFileId).catch(() => null);
      }
      await db.doc(`users/${uid}/drafts/${draftId}`).delete();
    }
  } catch {
    // Ignored
  }

  await resetToSteadyState(uid);
  await sendMessage(chatId, `🗑️ **Draft Discarded.** Send another job listing whenever you're ready.`);
}

async function resetToSteadyState(uid: string): Promise<void> {
  const db = getAdminDb();
  await db.doc(`users/${uid}/botSession/current`).set({
    botState: 'ACTIVE_STEADY_STATE',
    activeDraftId: null,
    targetSlot: null,
    tempParsedCv: null,
    updatedAt: new Date()
  }, { merge: true });
  await db.doc(`users/${uid}`).update({
    botState: 'ACTIVE_STEADY_STATE'
  });
}
