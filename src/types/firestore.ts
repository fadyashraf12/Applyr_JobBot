export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  createdAt: any; // Timestamp
  onboardingComplete: boolean;
  botState: string;
  activeProfileId: string;
  monitoringChannelId: string | null;
}

export interface GoogleConfigDoc {
  connectedEmail: string;
  accessToken: string; // AES-256-GCM encrypted
  refreshToken: string; // AES-256-GCM encrypted
  tokenExpiry: number; // Unix timestamp
  driveConnected: boolean;
  gmailConnected: boolean;
  vaultFolderId: string; // Root Drive folder ID
  vaultFolderName: string;
  gmailWatchExpiry: any | null; // Timestamp | null
  gmailHistoryId: string | null; // Last processed Gmail history ID;
}

export interface ProfileDoc {
  profileId: string;
  name: string; // e.g. "Software Engineer", "Product Manager"
  driveFolderId: string; // Sub-folder inside vault for this profile
  masterCvFileId: string | null; // Drive file ID of Master_CV.docx
  coverLetterTemplateFileId: string | null;
  headshotFileId: string | null;
  isActive: boolean;
  createdAt: any; // Timestamp
}

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  role: string;
  notes: string;
}

export interface ApplicationDoc {
  applicationId: string;
  profileId: string; // Which CV profile was used
  company: string;
  jobTitle: string;
  jobDescription: string; // Raw job post text extracted/OCR'd
  hrEmail: string;
  status: 'pending' | 'interview' | 'offer' | 'rejected' | 'ghosted';
  appliedAt: any; // Timestamp
  tailoredCvFileId: string; // Drive file ID of the tailored PDF
  emailSubject: string;
  emailBody: string;
  notes: string;
  followUpDate: any | null; // Timestamp | null
  contacts: ContactInfo[];
  recruiterReplied: boolean;
  lastReplyAt: any | null; // Timestamp | null
  lastReplySnippet: string | null; // First 200 chars of recruiter reply
  sourceType: 'image' | 'text' | 'pdf';
}

export interface DraftDoc {
  draftId: string;
  profileId: string;
  company: string;
  jobTitle: string;
  hrEmail: string | null; // null if Gemini could not extract it
  hrEmailConfirmed: boolean;
  status: 'awaiting_email_confirm' | 'awaiting_approval' | 'editing_email';
  tailoredCvFileId: string;
  emailSubject: string;
  emailBody: string;
  createdAt: any; // Timestamp
  jobDescription?: string;
  sourceType?: 'image' | 'text' | 'pdf';
}

export interface BotSessionDoc {
  botState: string;
  targetSlot: string | null; // e.g. "resume", "coverLetter", "headshot"
  targetProfileId: string | null;
  activeDraftId: string | null;
  lastMessageId: number | null; // Telegram message ID for edit-in-place
  tempParsedCv?: string | null;
  updatedAt: any; // Timestamp
}

export interface TelegramMappingDoc {
  telegramUserId: string; // Telegram's native user ID (the document ID)
  firebaseUid: string; // Linked Firebase user UID
  linkedAt: any; // Timestamp
}

export interface PairingTokenDoc {
  token: string; // The random UUID token
  firebaseUid: string; // Owner of this token
  createdAt: any; // Timestamp
  expiresAt: any; // Timestamp (createdAt + 15 minutes)
  used: boolean; // True once consumed by the bot
}
