import { callGemini } from './gemini.js';

export interface StructuredJobDetails {
  company: string | null;
  jobTitle: string | null;
  hrEmail: string | null;
  location: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  summaryKeywords: string[];
  jobDescription: string;
}

export async function extractJobDetails(rawJobText: string): Promise<StructuredJobDetails> {
  const prompt = `You are a job post parser. Extract structured data from the following job post.
If a field cannot be found, set it to null.

Return only valid JSON with this exact structure:
{
  "company": string | null,
  "jobTitle": string | null,
  "hrEmail": string | null,
  "location": string | null,
  "requiredSkills": string[],
  "preferredSkills": string[],
  "summaryKeywords": string[],
  "jobDescription": string
}

Job Post: ${rawJobText}`;

  try {
    const result = await callGemini(prompt);
    
    return {
      company: result?.company || null,
      jobTitle: result?.jobTitle || null,
      hrEmail: result?.hrEmail || null,
      location: result?.location || null,
      requiredSkills: Array.isArray(result?.requiredSkills) ? result.requiredSkills : [],
      preferredSkills: Array.isArray(result?.preferredSkills) ? result.preferredSkills : [],
      summaryKeywords: Array.isArray(result?.summaryKeywords) ? result.summaryKeywords : [],
      jobDescription: result?.jobDescription || rawJobText
    };
  } catch (error) {
    console.error('Error extracting job details:', error);
    return {
      company: null,
      jobTitle: null,
      hrEmail: null,
      location: null,
      requiredSkills: [],
      preferredSkills: [],
      summaryKeywords: [],
      jobDescription: rawJobText
    };
  }
}
