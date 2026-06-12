import mammoth from 'mammoth';
import { callGemini } from '../ai/gemini.js';

export interface ParsedCv {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  address: string;
  summary: string;
  skills: string[];
  workHistory: string;
  education: string;
  other: string;
}

export async function parseDocx(buffer: Buffer): Promise<ParsedCv> {
  const result = await mammoth.extractRawText({ buffer });
  const rawText = result.value;

  const prompt = `You are an expert resume parser. Analyze the following raw text extracted from a CV and structure it into a JSON object.
Be extremely careful to preserve all exact details, especially dates, company names, and descriptions in the workHistory and education sections.

Return only valid JSON with this exact structure:
{
  "name": string,
  "email": string,
  "phone": string,
  "linkedin": string,
  "address": string,
  "summary": string,  // Must extract the professional summary paragraph(s)
  "skills": string[],  // Must extract the list of core skills/keywords
  "workHistory": string,  // Extract the entire experience/experience/employment history section with details verbatim
  "education": string,  // Extract the entire education section verbatim
  "other": string  // Any other info like certifications, projects, languages verbatim
}

Raw Text:
${rawText}`;

  try {
    const parsed = await callGemini(prompt);
    return {
      name: parsed?.name?.trim() || 'John Doe',
      email: parsed?.email?.trim() || '',
      phone: parsed?.phone?.trim() || '',
      linkedin: parsed?.linkedin?.trim() || '',
      address: parsed?.address?.trim() || '',
      summary: parsed?.summary?.trim() || '',
      skills: Array.isArray(parsed?.skills) ? parsed.skills : [],
      workHistory: parsed?.workHistory?.trim() || '',
      education: parsed?.education?.trim() || '',
      other: parsed?.other?.trim() || ''
    };
  } catch (error) {
    console.error('Error parsing docx text with Gemini:', error);
    return {
      name: 'John Doe',
      email: '',
      phone: '',
      linkedin: '',
      address: '',
      summary: rawText.substring(0, 500),
      skills: [],
      workHistory: rawText,
      education: '',
      other: ''
    };
  }
}
