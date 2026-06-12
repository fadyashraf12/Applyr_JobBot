import { GoogleGenAI } from '@google/genai';

export class GeminiError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'GeminiError';
  }
}

let aiInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY environment variable is missing.');
      aiInstance = new GoogleGenAI({ 
        apiKey: 'DUMMY_API_KEY',
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    } else {
      aiInstance = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    }
  }
  return aiInstance;
}

// Retry logic: up to 3 attempts with 1-second delay on 503 or rate limit errors.
async function runWithRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const isRetryable = error?.status === 503 || error?.status === 429 || 
                          (error?.message && (error.message.includes('503') || error.message.includes('429') || error.message.includes('quota') || error.message.includes('rate limit')));
      if (attempt < retries && isRetryable) {
        console.warn(`Gemini API retryable error: ${error?.message || error}. Retrying in ${delayMs}ms (attempt ${attempt}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
}

export async function callGemini(prompt: string): Promise<any> {
  const ai = getGeminiClient();
  const modelName = 'gemini-2.5-flash';

  try {
    const response = await runWithRetry(() =>
      ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      })
    );

    const txt = response.text;
    if (!txt) {
      throw new Error('Received empty text from Gemini.');
    }

    // Try parsing the text as JSON, stripping potential markdown markers if Gemini somehow included them
    let cleanText = txt.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.substring(7);
    }
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();

    return JSON.parse(cleanText);
  } catch (error: any) {
    console.error('Gemini error:', error);
    throw new GeminiError(error?.message || 'Gemini transaction failed.', error);
  }
}

export async function callGeminiVision(imageBytes: Buffer, mimeType: string, prompt: string): Promise<any> {
  const ai = getGeminiClient();
  const modelName = 'gemini-2.5-flash';

  try {
    const base64Data = imageBytes.toString('base64');
    const imagePart = {
      inlineData: {
        mimeType,
        data: base64Data,
      }
    };
    const textPart = {
      text: prompt,
    };

    const response = await runWithRetry(() =>
      ai.models.generateContent({
        model: modelName,
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: 'application/json',
        }
      })
    );

    const txt = response.text;
    if (!txt) {
      throw new Error('Received empty text from Gemini Vision call.');
    }

    let cleanText = txt.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.substring(7);
    }
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();

    return JSON.parse(cleanText);
  } catch (error: any) {
    console.error('Gemini Vision error:', error);
    throw new GeminiError(error?.message || 'Gemini vision transaction failed.', error);
  }
}
