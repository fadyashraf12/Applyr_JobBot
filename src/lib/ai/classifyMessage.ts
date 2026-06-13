import { callGemini } from './gemini.js';

export async function classifyMessage(userMessage: string): Promise<{ type: 'JOB_POST' | 'NATURAL_COMMAND' | 'PROFILE_SWITCH' | 'SET_MONITORING_CHANNEL' | 'UNKNOWN' }> {
  const prompt = `You are a message classifier for a job application automation tool.
Classify the following message into one of these categories:
- JOB_POST: Contains a job description, vacancy, or job listing
- NATURAL_COMMAND: A direct instruction to edit the user's CV or settings
- PROFILE_SWITCH: An instruction to switch to a different CV profile (such as "switch to software engineer" or "use my backend dev profile")
- SET_MONITORING_CHANNEL: An instruction to set or change the Telegram monitoring/notification channel
- UNKNOWN: Anything else

Return only valid JSON. Do not include markdown wrappers or any other text.
{
  "type": "JOB_POST" | "NATURAL_COMMAND" | "PROFILE_SWITCH" | "SET_MONITORING_CHANNEL" | "UNKNOWN"
}

Message: ${userMessage}`;

  try {
    const result = await callGemini(prompt);
    if (result && result.type) {
      return result;
    }
    return { type: 'UNKNOWN' };
  } catch (error) {
    console.error('Error classifying message:', error);
    return { type: 'UNKNOWN' };
  }
}
