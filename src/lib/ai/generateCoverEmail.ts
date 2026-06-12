import { callGemini } from './gemini.js';

export interface CoverEmailResponse {
  subject: string;
  body: string;
}

export async function generateCoverEmail({
  candidateName,
  jobTitle,
  company,
  relevantSkills,
  summary
}: {
  candidateName: string;
  jobTitle: string;
  company: string;
  relevantSkills: string[];
  summary: string;
}): Promise<CoverEmailResponse> {
  const prompt = `You are a professional email writer. Write a concise, confident, and personalized cover email for a job application.

Rules:
- No more than 4 short paragraphs
- First paragraph: express interest in the specific role and company
- Second paragraph: highlight 2-3 relevant experiences matching the job requirements
- Third paragraph: a brief closing with a call to action
- Tone: professional but warm, not robotic
- Do NOT use phrases like "I am writing to apply" or "Please find attached"

Return only valid JSON:
{
  "subject": string,
  "body": string
}

Candidate Name: ${candidateName}
Job Title: ${jobTitle}
Company: ${company}
Relevant Skills Match: ${JSON.stringify(relevantSkills)}
Professional Summary: ${summary}`;

  try {
    const result = await callGemini(prompt);
    
    return {
      subject: result?.subject || `Application for ${jobTitle} at ${company}`,
      body: result?.body || `Dear Hiring Team,\n\nI am excited about the opportunity to join ${company} as a ${jobTitle}. I would love to bring my skills to your team.\n\nBest regards,\n${candidateName}`
    };
  } catch (error) {
    console.error('Error generating cover email:', error);
    return {
      subject: `Application for ${jobTitle} at ${company}`,
      body: `Dear Hiring Team,\n\nI am excited about the opportunity to join ${company} as a ${jobTitle}. I would love to bring my skills to your team.\n\nBest regards,\n${candidateName}`
    };
  }
}
