import { TelegramUpdate } from '../../types/telegram';
import { getFile, downloadFile } from './bot';
import { callGeminiVision } from '../ai/gemini';
import * as pdfParse_ from 'pdf-parse';
const pdfParse = (pdfParse_ as any).default || pdfParse_;

export async function extractTextFromUpdate(update: TelegramUpdate): Promise<{
  text: string;
  sourceType: 'image' | 'text' | 'pdf';
}> {
  const msg = update.message;
  if (!msg) {
    return { text: '', sourceType: 'text' };
  }

  if (msg.text) {
    return { text: msg.text, sourceType: 'text' };
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
    const extractedText = ocrResult?.fullText || '';
    return { text: extractedText, sourceType: 'image' };
  }

  if (msg.document && msg.document.mime_type === 'application/pdf') {
    const fileInfo = await getFile(msg.document.file_id);
    const fileBuffer = await downloadFile(fileInfo.file_path);
    const data = await pdfParse(fileBuffer);
    return { text: data.text || '', sourceType: 'pdf' };
  }

  return { text: '', sourceType: 'text' };
}
