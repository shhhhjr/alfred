import { prisma } from "@/lib/db/prisma";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export async function generateCustomResume(
  userId: string,
  jobId: string
): Promise<string> {
  const [resume, job] = await Promise.all([
    prisma.resume.findUnique({ where: { userId } }),
    prisma.job.findFirst({ where: { id: jobId, userId } }),
  ]);

  if (!resume || !job) {
    throw new Error("Resume or job not found");
  }

  const jobDesc = job.description || job.location || "Not provided";

  const prompt = `Given this master resume:

${resume.content.slice(0, 3000)}

Tailor it for this job: ${job.title} at ${job.company}.

Job description: ${jobDesc.slice(0, 1500)}

Reorganize and emphasize the most relevant experience and skills. Output a professional resume in Jake's resume format (plain text, strictly following this structure):

LINE 1: Full name only (no label, no extra text)
LINE 2: Contact info in this format: email | phone | linkedin | city, province  (pipe-separated, use actual info from the master resume)
LINE 3: (blank line)
SECTIONS: For each section (Education, Experience, Skills, Projects, etc.):
  - Write the section title on its own line (e.g. "Education")
  - Write "---" on the very next line (this signals a horizontal rule)
  - For each role/entry: write "Company or Institution Name	Month Year – Month Year" (use a TAB character between the name and the date range so dates can be right-aligned)
  - On the next line: write the role/degree title in plain text
  - Use – (en dash + space) for bullet points describing responsibilities/achievements
  - Leave a blank line between entries within a section

RULES:
- Do not invent experience
- No **bold** markers or asterisks — formatting is handled by the tab separator and --- markers
- Return ONLY the resume text, no extra commentary or page numbers`;

  try {
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt,
    });

    return text;
  } catch (err) {
    throw new Error(`Failed to generate resume: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function generateCoverLetter(
  userId: string,
  jobId: string
): Promise<string> {
  const [resume, job, user] = await Promise.all([
    prisma.resume.findUnique({ where: { userId } }),
    prisma.job.findFirst({ where: { id: jobId, userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
  ]);

  if (!resume || !job) {
    throw new Error("Resume or job not found");
  }

  const userName = user?.name || "the applicant";
  const userEmail = user?.email || "";
  const jobDesc = job.description || job.location || "Not provided";

  const prompt = `Write a cover letter for ${userName} applying to ${job.title} at ${job.company}.

RESUME (use ALL information from here — name, contact info, experience, education, skills. Do NOT use placeholders or ask for any info. Extract and use what's provided):
${resume.content.slice(0, 3000)}

JOB DESCRIPTION:
${jobDesc.slice(0, 1200)}

REQUIREMENTS:
- Use the applicant's actual name, email (${userEmail || "from resume"}), phone, LinkedIn if present in the resume
- Sound natural and human — vary sentence length, avoid stiff phrases like "I am writing to express my interest" or "Please find my resume attached"
- Be specific to the role and company — reference relevant experience from the resume that matches the job
- Professional but conversational — like a real person writing, not a template
- 3–4 paragraphs: brief intro, why you fit, key experience, closing
- No placeholders, brackets, or "[insert X]" — only use information from the resume
- Return ONLY the cover letter body, no subject line or metadata`;

  try {
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt,
    });

    return text;
  } catch (err) {
    throw new Error(`Failed to generate cover letter: ${err instanceof Error ? err.message : String(err)}`);
  }
}
