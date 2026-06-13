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
import { extractTextFromUpdate } from '../extractText';
import { sendReviewPackage } from '../reviewPackage';
import { DraftDoc } from '../../../types/firestore';

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
    } else if (classification.type === 'SET_MONITORING_CHANNEL') {
      await handleSetMonitoringChannel(chatId, text, context);
    } else {
      await sendMessage(
        chatId,
        `I didn't quite understand that. Forward a job post to apply, or send a command like 'Add Python to my skills'.`
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

  // 1. Extract text and identify type first to run non-blocking validation
  const { text: rawText, sourceType } = await extractTextFromUpdate(update);
  if (!rawText || rawText.trim().length < 20) {
    await sendMessage(chatId, `❌ **Error:** The job posting details could not be parsed successfully. Please check the content type and send again.`);
    return;
  }

  await sendMessage(chatId, `⚙️ **Processing your job post...** I'll have a draft ready in a moment.`);

  // Set state to ACTIVE_PROCESSING instantly
  await db.doc(`users/${uid}/botSession/current`).set({
    botState: 'ACTIVE_PROCESSING',
    updatedAt: new Date(),
  }, { merge: true });

  await db.doc(`users/${uid}`).update({
    botState: 'ACTIVE_PROCESSING'
  });

  try {
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

    // 5. Build requirements and tailor resume
    const jobRequirementsString = [
      ...(jobDetails.requiredSkills || []),
      ...(jobDetails.preferredSkills || []),
      ...(jobDetails.summaryKeywords || []),
      jobDetails.jobDescription || ''
    ].join(', ');

    const tailored = await tailorResume(parsedCv.summary, parsedCv.skills, jobRequirementsString);

    // 6. Generate cover email with Gemini
    const candidateName = context.user?.displayName || parsedCv.name || 'Candidate';
    const emailDraft = await generateCoverEmail({
      candidateName,
      jobTitle: jobDetails.jobTitle || 'Software Engineer',
      company: jobDetails.company || 'Target Company',
      relevantSkills: tailored.newSkills,
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
    const draftData: DraftDoc = {
      draftId,
      profileId: activeProfileId,
      company: jobDetails.company || 'Unknown Company',
      jobTitle: jobDetails.jobTitle || 'Unknown Role',
      hrEmail: jobDetails.hrEmail || null,
      hrEmailConfirmed: jobDetails.hrEmail !== null,
      status: jobDetails.hrEmail ? 'awaiting_approval' : 'awaiting_email_confirm',
      tailoredCvFileId: tailoredPdfFileId,
      emailSubject: emailDraft.subject,
      emailBody: emailDraft.body,
      createdAt: new Date(),
      jobDescription: jobDetails.jobDescription || rawText,
      sourceType: sourceType as any
    };
    await db.doc(`users/${uid}/drafts/${draftId}`).set(draftData);

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

    // 11. Deliver review package or request email
    if (jobDetails.hrEmail) {
      await sendReviewPackage(context, draftData);
    } else {
      await sendMessage(
        chatId,
        `🔍 **HR Email Not Found** — I couldn't find a contact email in the job post. Please type the HR or hiring manager's email address now, or type \`skip\` to discard this application.`
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

async function handleSetMonitoringChannel(chatId: number, text: string, context: UserContext): Promise<void> {
  const db = getAdminDb();
  const uid = context.uid;

  // Simple regex matching Telegram channel handle like @mychannel or numeric ID like -100123456
  const match = text.match(/(@\w+|-100\d+|-?\d+)/);
  if (!match) {
    await sendMessage(
      chatId,
      `⚠️ **Invalid Channel Format:** Please provide a valid channel handle starting with \`@\` or a numeric ID (e.g. \`Set monitoring channel to @mychannel\`).`
    );
    return;
  }

  const channelIdentifier = match[0];

  try {
    // Attempt to post confirmation message to channel
    await sendMessage(
      Number(channelIdentifier) || (channelIdentifier as any),
      `✅ <b>Applyr monitoring channel connected.</b> You'll receive activity alerts here.`,
      { parse_mode: 'HTML' }
    );

    // Save identifier to users/{uid}.monitoringChannelId
    await db.doc(`users/${uid}`).update({
      monitoringChannelId: channelIdentifier
    });

    await sendMessage(
      chatId,
      `✅ **Monitoring channel set!** I'll post activity summaries to \`${channelIdentifier}\` from now on.`
    );

  } catch (err) {
    console.warn(`Failed to verify or write to channel ${channelIdentifier}:`, err);
    await sendMessage(
      chatId,
      `❌ I couldn't post to that channel. Make sure you've added me as an admin with 'Post Messages' permission, then try again.`
    );
  }
}

