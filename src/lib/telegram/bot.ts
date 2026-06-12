import { TelegramMessage } from '../../types/telegram';

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboard {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface KeyboardButton {
  text: string;
}

export interface ReplyKeyboard {
  keyboard: KeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
}

export class TelegramError extends Error {
  constructor(message: string, public description?: string) {
    super(message);
    this.name = 'TelegramError';
  }
}

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing in the environment variables.');
  }
  return token;
}

async function callTelegramApi(method: string, body: any): Promise<any> {
  const token = getBotToken();
  const url = `https://api.telegram.org/bot${token}/${method}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new TelegramError(
      `Telegram API error on ${method}: ${data.description || res.statusText}`,
      data.description
    );
  }

  return data.result;
}

export async function sendMessage(
  chatId: number | string,
  text: string,
  options?: {
    parse_mode?: 'HTML' | 'Markdown';
    reply_markup?: InlineKeyboard | ReplyKeyboard;
  }
): Promise<TelegramMessage> {
  return callTelegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: options?.parse_mode,
    reply_markup: options?.reply_markup,
  });
}

export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  options?: {
    parse_mode?: 'HTML' | 'Markdown';
    reply_markup?: InlineKeyboard;
  }
): Promise<void> {
  await callTelegramApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: options?.parse_mode,
    reply_markup: options?.reply_markup,
  });
}

export async function editMessageReplyMarkup(
  chatId: number | string,
  messageId: number,
  reply_markup: InlineKeyboard
): Promise<void> {
  await callTelegramApi('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup,
  });
}

export async function sendDocument(
  chatId: number | string,
  fileBuffer: Buffer,
  filename: string,
  caption?: string
): Promise<TelegramMessage> {
  const token = getBotToken();
  const url = `https://api.telegram.org/bot${token}/sendDocument`;
  
  const formData = new FormData();
  formData.append('chat_id', String(chatId));
  if (caption) {
    formData.append('caption', caption);
  }
  
  // Use Blob with name to handle FormData correctly
  const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
  formData.append('document', blob, filename);

  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new TelegramError(
      `Telegram sendDocument API error: ${data.description || res.statusText}`,
      data.description
    );
  }

  return data.result;
}

export async function getFile(fileId: string): Promise<{ file_path: string }> {
  return callTelegramApi('getFile', { file_id: fileId });
}

export async function downloadFile(filePath: string): Promise<Buffer> {
  const token = getBotToken();
  const url = `https://api.telegram.org/file/bot${token}/${filePath}`;
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download Telegram file: ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  await callTelegramApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
  });
}
