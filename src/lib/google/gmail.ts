import { getValidAccessToken } from './oauth.js';

export async function sendEmail(
  uidOrObj: string | {
    uid: string;
    to: string;
    subject: string;
    body: string;
    attachmentBuffer?: Buffer;
    attachmentName?: string;
    attachmentMimeType?: string;
  },
  maybeParams?: {
    to: string;
    subject: string;
    body: string;
    attachment?: { filename: string; buffer: Buffer; mimeType: string };
  }
): Promise<{ messageId: string; threadId: string }> {
  let uid: string;
  let to: string;
  let subject: string;
  let body: string;
  let attachmentBuffer: Buffer | undefined;
  let attachmentName: string | undefined;
  let attachmentMimeType: string | undefined;

  if (typeof uidOrObj === 'string') {
    uid = uidOrObj;
    if (!maybeParams) {
      throw new Error('Params object is required when sending email');
    }
    to = maybeParams.to;
    subject = maybeParams.subject;
    body = maybeParams.body;
    if (maybeParams.attachment) {
      attachmentBuffer = maybeParams.attachment.buffer;
      attachmentName = maybeParams.attachment.filename;
      attachmentMimeType = maybeParams.attachment.mimeType;
    }
  } else {
    uid = uidOrObj.uid;
    to = uidOrObj.to;
    subject = uidOrObj.subject;
    body = uidOrObj.body;
    attachmentBuffer = uidOrObj.attachmentBuffer;
    attachmentName = uidOrObj.attachmentName;
    attachmentMimeType = uidOrObj.attachmentMimeType;
  }

  const accessToken = await getValidAccessToken(uid);

  // Build RFC 2822 email format
  let mimeMessage = '';
  
  if (attachmentBuffer && attachmentName && attachmentMimeType) {
    const boundary = 'foo_bar_gmail_boundary';
    
    mimeMessage += `To: ${to}\r\n`;
    mimeMessage += `Subject: ${subject}\r\n`;
    mimeMessage += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    
    // Body segment
    mimeMessage += `--${boundary}\r\n`;
    mimeMessage += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
    mimeMessage += `${body}\r\n\r\n`;
    
    // Attachment segment
    mimeMessage += `--${boundary}\r\n`;
    mimeMessage += `Content-Type: ${attachmentMimeType}; name="${attachmentName}"\r\n`;
    mimeMessage += `Content-Disposition: attachment; filename="${attachmentName}"\r\n`;
    mimeMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
    mimeMessage += `${attachmentBuffer.toString('base64')}\r\n`;
    mimeMessage += `--${boundary}--`;
  } else {
    mimeMessage += `To: ${to}\r\n`;
    mimeMessage += `Subject: ${subject}\r\n`;
    mimeMessage += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
    mimeMessage += `${body}`;
  }

  const encodedRaw = Buffer.from(mimeMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: encodedRaw
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gmail API failed to send email: ${errorText}`);
  }

  const result = await res.json();
  return {
    messageId: result.id,
    threadId: result.threadId || result.id
  };
}
