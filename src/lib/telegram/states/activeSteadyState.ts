import { TelegramUpdate } from '../../../types/telegram';
import { UserContext } from '../../userContext';
import { getAdminDb } from '../../firebase/admin';
import { sendMessage, sendDocument, getFile, downloadFile } from '../bot';
import { classifyMessage } from '../../ai/classifyMessage';
import { parseNaturalCommand } from '../../ai/parseNaturalCommand';
import { extractJobDetails } from '../../ai/extractJobDetails';
import { tailorResume } from '../../ai/tailorResume';
import { generateCoverEmail } from '../../ai/generateCoverEmail';
import { parseDocx } from '../../documents/parseDocx';
import { buildDocx } from '../../documents/buildDocx';
import { convertToPdf } from '../../documents/convertToPdf';
import { uploadFile, downloadFile as downloadDriveFile } from '../../google/drive';
import { callGeminiVision } from '../../ai/gemini';
import * as pdfParse_ from 'pdf-parse';
const pdfParse = (pdfParse_ as any).default || pdfParse_;

export async function handleActiveSteadyState(
  update: TelegramUpdate,
  context: UserContext
): Promise<void> {
  const chatId = update.message?.chat.id;
  if (!chatId) return;

  const msg = update.message;
  if (!msg) return;

  const hasPhoto = msg.photo && msg.photo.length > 0;
  const hasDocument = !!msg.document;
  const hasText = !!msg.text;

  if (hasPhoto || hasDocument) {
    await startJobProcessing(chatId, update, context);
  } else if (hasText) {
    const text = msg.text || '';
    
    // Classify the message using Gemini
    const classification = await classifyMessage(text);
    
    if (classification.type === 'JOB_POST') {
      await startJobProcessing(chatId, update, context);
    } else if (classification.type === 'PROFILE_SWITCH') {
      await handleProfileSwitch(chatId, text, context);
    } else if (classification.type === 'NATURAL_COMMAND') {
      await handleNaturalCommand(chatId, text, context);
    } else {
      // Default fallback messaging
      await sendMessage(
        chatId,
        `⚙️ **Applyr Assistant**\n\n` +
        `Forward or paste a job posting to initiate the application process.\n\n` +
        `Alternatively, send commands to modify your active CV directly (e.g. *"Add Docker and Kubernetes to my skills Section"*) or switch CV profiles.`,
        { parse_mode: 'Markdown' }
      );
    }
  }
}

async function startJobProcessing(chatId: number, update: TelegramUpdate, context: UserContext): Promise<void> {
  const db = getAdminDb();
  const uid = context.uid;
  const activeProfileId = context.activeProfile?.profileId || context.user?.activeProfileId;

  if (!activeProfileId) {
    await sendMessage(chatId, `❌ **Error:** No active profile configured in your console. Please visit the profiles panel.`);
    return;
  }

  await sendMessage(chatId, `⚙️ **Processing your job post...** I'll have a tailored CV draft and cover letter ready shortly.`);

  // Set state to ACTIVE_PROCESSING instantly
  await db.doc(`users/${uid}/botSession/current`).set({
    botState: 'ACTIVE_PROCESSING',
    updatedAt: new Date(),
  }, { merge: true });

  await db.doc(`users/${uid}`).update({
    botState: 'ACTIVE_PROCESSING'
  });

  try {
    // 1. Extract raw job description
    const rawText = await extractRawTextFromUpdate(update, uid);
    if (!rawText || rawText.trim().length < 20) {
      throw new Error("Specified input yields insufficient job details text content.");
    }

    // 2. Extract job specifications via Gemini
    const jobDetails = await extractJobDetails(rawText);

    // 3. Load active profile
    const profileSnap = await db.doc(`users/${uid}/profiles/${activeProfileId}`).get();
    if (!profileSnap.exists) {
      throw new Error("Active CV profile is missing.");
    }
    const profile = profileSnap.data();
    const masterCvFileId = profile?.masterCvFileId;

    if (!masterCvFileId) {
      throw new Error("No resume uploaded for active profile. Please upload CV on dashboard onboarding first.");
    }

    // 4. Download and parse CV from Drive
    const docBytes = await downloadDriveFile(uid, masterCvFileId);
    const parsedCv = await parseDocx(docBytes);

    // 5. Tailor CV with Gemini
    const tailored = await tailorResume(parsedCv.summary, parsedCv.skills, jobDetails.jobDescription);

    // 6. Generate cover email with Gemini
    const candidateName = parsedCv.name || context.user?.displayName || 'Ahmed Hassan';
    const emailDraft = await generateCoverEmail({
      candidateName,
      jobTitle: jobDetails.jobTitle || 'Software Engineer',
      company: jobDetails.company || 'Target Company',
      relevantSkills: jobDetails.requiredSkills,
      summary: tailored.newSummary
    });

    // 7. Write tailored PDF
    const pdfBuffer = await convertToPdf(parsedCv, tailored.newSummary, tailored.newSkills);

    // 8. Upload to cloud Drive
    const folderId = profile?.driveFolderId || context.googleConfig?.vaultFolderId || 'root';
    const dateStr = new Date().toISOString().substring(0, 10);
    const companyClean = (jobDetails.company || 'Company').replace(/[^a-zA-Z0-9]/g, '_');
    const pdfName = `Tailored_CV_${companyClean}_${dateStr}.pdf`;
    const tailoredPdfFileId = await uploadFile(uid, folderId, pdfBuffer, pdfName, 'application/pdf');

    // 9. Store draft record
    const draftId = db.collection(`users/${uid}/drafts`).doc().id;
    await db.doc(`users/${uid}/drafts/${draftId}`).set({
      draftId,
      profileId: activeProfileId,
      company: jobDetails.company || 'Target Company',
      jobTitle: jobDetails.jobTitle || 'Software Engineer',
      hrEmail: jobDetails.hrEmail || null,
      hrEmailConfirmed: !!jobDetails.hrEmail,
      status: jobDetails.hrEmail ? 'awaiting_approval' : 'awaiting_email_confirm',
      tailoredCvFileId: tailoredPdfFileId,
      emailSubject: emailDraft.subject,
      emailBody: emailDraft.body,
      createdAt: new Date()
    });

    // 10. Transition state
    const nextState = jobDetails.hrEmail ? 'AWAITING_APPROVAL' : 'AWAITING_EMAIL_CONFIRM';
    await db.doc(`users/${uid}/botSession/current`).set({
      botState: nextState,
      activeDraftId: draftId,
      updatedAt: new Date()
    }, { merge: true });

    await db.doc(`users/${uid}`).update({
      botState: nextState
    });

    // 11. Deliver review package
    if (jobDetails.hrEmail) {
      await sendReviewPackage(chatId, {
        draftId,
        company: jobDetails.company || 'Target Company',
        jobTitle: jobDetails.jobTitle || 'Software Engineer',
        hrEmail: jobDetails.hrEmail,
        emailSubject: emailDraft.subject,
        emailBody: emailDraft.body,
        pdfBuffer,
        pdfName
      });
    } else {
      await sendMessage(
        chatId,
        `🔍 **HR Email Not Found**\n\n` +
        `I have generated your tailored CV PDF but I could not find an HR email address in the job posting.\n\n` +
        `Please type the **HR email address** below now, or reply **"skip"** to discard this application.`
      );
    }

  } catch (error: any) {
    console.error('Job post ingestion pipeline failed:', error);
    await db.doc(`users/${uid}/botSession/current`).set({
      botState: 'ACTIVE_STEADY_STATE',
      updatedAt: new Date(),
    }, { merge: true });
    await db.doc(`users/${uid}`).update({
      botState: 'ACTIVE_STEADY_STATE'
    });
    await sendMessage(chatId, `❌ **Ingestion Failed:** ${error?.message || error}`);
  }
}

async function extractRawTextFromUpdate(update: TelegramUpdate, uid: string): Promise<string> {
  const msg = update.message;
  if (!msg) return '';

  if (msg.text) {
    return msg.text;
  }

  if (msg.photo && msg.photo.length > 0) {
    const largestPhoto = msg.photo.reduce((prev, current) => {
      return (prev.file_size || 0) > (current.file_size || 0) ? prev : current;
    });

    const fileInfo = await getFile(largestPhoto.file_id);
    const fileBuffer = await downloadFile(fileInfo.file_path);

    const prompt = `You are a professional career coordinator. Extract all listing specifications, requirement details, and experience information from this attached job posting screenshot.

Return only valid JSON. Do not write anything else.
{
  "fullText": string
}`;
    const ocrResult = await callGeminiVision(fileBuffer, 'image/jpeg', prompt);
    return ocrResult?.fullText || '';
  }

  if (msg.document && msg.document.mime_type === 'application/pdf') {
    const fileInfo = await getFile(msg.document.file_id);
    const fileBuffer = await downloadFile(fileInfo.file_path);
    const data = await pdfParse(fileBuffer);
    return data.text || '';
  }

  return '';
}

async function handleProfileSwitch(chatId: number, text: string, context: UserContext): Promise<void> {
  const db = getAdminDb();
  const uid = context.uid;

  const profilesSnap = await db.collection(`users/${uid}/profiles`).get();
  if (profilesSnap.empty) {
    await sendMessage(chatId, `❌ **Error:** No profiles configured in your console.`);
    return;
  }

  const profiles = profilesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

  // Word match
  const word = text.toLowerCase();
  let selected = null;
  for (const p of profiles) {
    const pName = p.name.toLowerCase();
    if (word.includes(pName) || pName.includes(word.replace('switch to', '').replace('profile', '').trim())) {
      selected = p;
      break;
    }
  }

  // Gemini match fallback
  if (!selected) {
    const options = profiles.map(p => p.name).join(', ');
    const prompt = `Fuzzy match the switch intent to a profile name. Option list: [${options}].
User query: "${text}"
Return only valid JSON.
{
  "matchedProfileName": string | null
}`;
    try {
      const matchResult = await callGeminiVision(Buffer.alloc(0), 'image/jpeg', prompt).catch(() => callGeminiVision(undefined as any, '', prompt)).catch(() => null);
      if (matchResult && matchResult.matchedProfileName) {
        selected = profiles.find(p => p.name.toLowerCase() === matchResult.matchedProfileName.toLowerCase());
      }
    } catch {
      // Ignored
    }
  }

  if (selected) {
    await db.doc(`users/${uid}`).update({ activeProfileId: selected.id });
    await sendMessage(chatId, `✅ **Profile Switched to ${selected.name}**\nYour next applications will run against this CV profile context.`);
  } else {
    const optionsText = profiles.map(p => `• *${p.name}*`).join('\n');
    await sendMessage(chatId, `❓ **Unknown Profile:** Try listing the exact name. Currently configured settings:\n\n${optionsText}`, { parse_mode: 'Markdown' });
  }
}

async function handleNaturalCommand(chatId: number, text: string, context: UserContext): Promise<void> {
  const db = getAdminDb();
  const uid = context.uid;
  const activeProfileId = context.activeProfile?.profileId || context.user?.activeProfileId;

  if (!activeProfileId) {
    await sendMessage(chatId, `❌ **Error:** Please configure an active profile on your admin dashboard.`);
    return;
  }

  const profileSnap = await db.doc(`users/${uid}/profiles/${activeProfileId}`).get();
  if (!profileSnap.exists) {
    await sendMessage(chatId, `❌ **Profile context not found.**`);
    return;
  }

  const profile = profileSnap.data();
  const masterCvFileId = profile?.masterCvFileId;

  if (!masterCvFileId) {
    await sendMessage(chatId, `❌ **Please upload your Master Resume (CV) draft first.**`);
    return;
  }

  await sendMessage(chatId, `🧠 **Analyzing edits and reading Master CV...**`);

  try {
    const parsedCommand = await parseNaturalCommand(text);
    const masterCvBytes = await downloadDriveFile(uid, masterCvFileId);
    const parsedCv = await parseDocx(masterCvBytes);

    const updatedCv = { ...parsedCv };
    const val = parsedCommand.value;

    switch (parsedCommand.targetSection) {
      case 'skills':
        if (parsedCommand.action === 'add') {
          const arr = val.split(',').map((s: string) => s.trim()).filter(Boolean);
          updatedCv.skills = Array.from(new Set([...updatedCv.skills, ...arr]));
        } else if (parsedCommand.action === 'remove') {
          const arr = val.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
          updatedCv.skills = updatedCv.skills.filter((s: string) => !arr.includes(s.toLowerCase()));
        } else {
          updatedCv.skills = val.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
        break;
      case 'summary':
        updatedCv.summary = val;
        break;
      case 'phone':
        updatedCv.phone = val;
        break;
      case 'email':
        updatedCv.email = val;
        break;
      case 'linkedin':
        updatedCv.linkedin = val;
        break;
      case 'address':
        updatedCv.address = val;
        break;
      default:
        updatedCv.other = val || parsedCv.other;
        break;
    }

    const pdfBuffer = await convertToPdf(updatedCv, updatedCv.summary, updatedCv.skills);

    // Save temporal buffer reference to Session
    await db.doc(`users/${uid}/botSession/current`).set({
      botState: 'WIZARD_OVERWRITE_CONFIRM',
      targetSlot: 'natural_command_confirm',
      tempParsedCv: JSON.stringify(updatedCv),
      updatedAt: new Date()
    }, { merge: true });

    await db.doc(`users/${uid}`).update({
      botState: 'WIZARD_OVERWRITE_CONFIRM'
    });

    await sendDocument(
      chatId,
      pdfBuffer,
      'CV_Updated_Preview.pdf',
      `✨ **CV Changes Generated!**\n\nI have processed your edits. Please review the attached PDF preview.\n\nReply **"confirm"** to save permanently to your Master CV, or **"cancel"** to discard.`
    );

  } catch (error) {
    console.error('Core CV natural modification failed:', error);
    await sendMessage(chatId, `❌ **Update Processing Failed:** Please try with simplified syntax instructions.`);
  }
}

export async function sendReviewPackage(chatId: number, details: {
  draftId: string;
  company: string;
  jobTitle: string;
  hrEmail: string;
  emailSubject: string;
  emailBody: string;
  pdfBuffer: Buffer;
  pdfName: string;
}): Promise<void> {
  // Attached Tailored Resume
  await sendDocument(
    chatId,
    details.pdfBuffer,
    details.pdfName,
    `📂 **Tailored Resume PDF** for ${details.company}`
  );

  const preview = `📥 **Application Draft Ready — Please Review**\n\n` +
    `**To:** \`${details.hrEmail}\`\n` +
    `**Subject:** *${details.emailSubject}*\n\n` +
    `**Email Body:**\n` +
    `\`\`\`\n${details.emailBody}\n\`\`\``;

  const replyMarkup = {
    inline_keyboard: [
      [{ text: '🚀 Looks Perfect — Send Now', callback_data: `send_now:${details.draftId}` }],
      [{ text: '✏️ Edit Email Body', callback_data: `edit_email:${details.draftId}` }],
      [{ text: '🗑️ Discard Draft', callback_data: `discard_draft:${details.draftId}` }]
    ]
  };

  await sendMessage(chatId, preview, {
    parse_mode: 'Markdown',
    reply_markup: replyMarkup
  });
}
