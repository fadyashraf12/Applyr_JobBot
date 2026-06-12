import { callGemini } from './gemini.js';

export interface ParsedEditCommand {
  targetSection: 'skills' | 'summary' | 'phone' | 'email' | 'linkedin' | 'address' | 'other';
  action: 'add' | 'remove' | 'replace';
  value: string;
}

export async function parseNaturalCommand(userInstruction: string): Promise<ParsedEditCommand> {
  const prompt = `You are a CV editor assistant. Parse the user's instruction into a structured edit command.

Return only valid JSON with this exact structure:
{
  "targetSection": "skills" | "summary" | "phone" | "email" | "linkedin" | "address" | "other",
  "action": "add" | "remove" | "replace",
  "value": string
}

User instruction: ${userInstruction}`;

  try {
    const result = await callGemini(prompt);
    
    return {
      targetSection: result?.targetSection || 'other',
      action: result?.action || 'replace',
      value: result?.value || ''
    };
  } catch (error) {
    console.error('Error parsing natural command:', error);
    return {
      targetSection: 'other',
      action: 'replace',
      value: ''
    };
  }
}
