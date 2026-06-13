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

// Registers a Gmail push notification watch on the user's inbox
export async function watchInbox(uid: string): Promise<{ historyId: string; expiration: string }> {
  const accessToken = await getValidAccessToken(uid);
  const topicName = process.env.GMAIL_PUBSUB_TOPIC;
  if (!topicName) {
    throw new Error('GMAIL_PUBSUB_TOPIC environment variable is not defined');
  }

  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/watch';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      topicName,
      labelIds: ['INBOX']
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gmail API watchInbox failed: ${errorText}`);
  }

  const data = await res.json();
  return {
    historyId: data.historyId,
    expiration: data.expiration
  };
}

// Fetches the history delta since lastHistoryId, returns new INBOX message IDs (excluding SENT)
export async function getHistorySince(uid: string, lastHistoryId: string): Promise<string[]> {
  const accessToken = await getValidAccessToken(uid);
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${lastHistoryId}&historyTypes=messageAdded`;
  
  let nextPageToken: string | undefined = undefined;
  const messageIds: string[] = [];
  
  do {
    let pageUrl = url;
    if (nextPageToken) {
      pageUrl += `&pageToken=${nextPageToken}`;
    }
    const res = await fetch(pageUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Gmail API getHistorySince failed on page query: ${errorText}`);
      break;
    }
    const data = await res.json();
    if (data.history) {
      for (const h of data.history) {
        if (h.messagesAdded) {
          for (const ma of h.messagesAdded) {
            if (ma.message && ma.message.id) {
              const labelIds = ma.message.labelIds || [];
              if (!labelIds.includes('SENT')) {
                messageIds.push(ma.message.id);
              }
            }
          }
        }
      }
    }
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return Array.from(new Set(messageIds));
}

// Fetches a single message: sender, subject, snippet, internalDate
export async function getMessage(uid: string, messageId: string): Promise<{
  from: string;
  subject: string;
  snippet: string;
  internalDate: string;
  labelIds: string[];
}> {
  const accessToken = await getValidAccessToken(uid);
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gmail API getMessage failed: ${errorText}`);
  }

  const data = await res.json();
  const headers = data.payload?.headers || [];
  
  const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
  const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';

  // Extract email from "Sarah Jones <s.jones@acme.com>" or just "s.jones@acme.com"
  const emailRegex = /<([^>]+)>/;
  const match = fromHeader.match(emailRegex);
  const cleanFrom = match ? match[1].trim() : fromHeader.trim();

  return {
    from: cleanFrom,
    subject: subjectHeader,
    snippet: data.snippet || '',
    internalDate: data.internalDate || '',
    labelIds: data.labelIds || []
  };
}
