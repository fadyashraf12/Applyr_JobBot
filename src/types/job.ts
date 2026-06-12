export interface JobDetails {
  company: string | null;
  jobTitle: string | null;
  hrEmail: string | null;
  location: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  summaryKeywords: string[];
  jobDescription: string;
}
