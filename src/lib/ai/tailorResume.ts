import { callGemini } from './gemini.js';

export interface TailorResponse {
  newSummary: string;
  newSkills: string[];
}

export async function tailorResume(
  currentSummary: string,
  currentSkills: string[],
  jobRequirements: string
): Promise<TailorResponse> {
  const prompt = `You are a professional resume writer. You are given:
1. The candidate's current Professional Summary
2. The candidate's current Core Skills list
3. A job post's key requirements and keywords

Your task:
- Rewrite the Professional Summary (3-4 sentences max) to naturally highlight experiences relevant to this job. Do NOT invent experience that is not implied by the original. Be truthful.
- Update the Core Skills list by adding the most relevant required skills from the job post that are missing from the current list. Do not remove existing skills.

Return only valid JSON:
{
  "newSummary": string,
  "newSkills": string[]
}

Current Summary: ${currentSummary}
Current Skills: ${JSON.stringify(currentSkills)}
Job Requirements: ${jobRequirements}`;

  try {
    const result = await callGemini(prompt);
    
    return {
      newSummary: result?.newSummary || currentSummary,
      newSkills: Array.isArray(result?.newSkills) ? result.newSkills : currentSkills
    };
  } catch (error) {
    console.error('Error tailoring resume:', error);
    return {
      newSummary: currentSummary,
      newSkills: currentSkills
    };
  }
}
