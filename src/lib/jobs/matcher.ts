import { prisma } from "@/lib/db/prisma";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { env } from "@/lib/env";
import type { JobListing } from "./scraper";

export async function calculateMatchScore(
  userId: string,
  job: JobListing
): Promise<number> {
  const resume = await prisma.resume.findUnique({
    where: { userId },
  });

  if (!resume) {
    return 0;
  }

  const jobText = `${job.title} ${job.company} ${job.description || ""}`.toLowerCase();
  const resumeSkills = resume.skills.map((s) => s.toLowerCase());
  const resumeKeywords = resume.keywords.map((k) => k.toLowerCase());

  let score = 0;

  for (const skill of resumeSkills) {
    if (jobText.includes(skill)) {
      score += 5;
    }
  }

  for (const keyword of resumeKeywords.slice(0, 20)) {
    if (jobText.includes(keyword)) {
      score += 2;
    }
  }

  const baseScore = Math.min(100, score);

  if (env.GEMINI_API_KEY && baseScore > 20) {
    try {
      const aiScore = await getAIMatchScore(resume, job);
      return Math.round((baseScore * 0.6 + aiScore * 0.4));
    } catch {
      return Math.round(baseScore);
    }
  }

  return Math.round(baseScore);
}

async function getAIMatchScore(resume: { content: string; skills: string[] }, job: JobListing): Promise<number> {
  const prompt = `Rate how well this resume matches this job posting on a scale of 0-100. Consider:
- Skills overlap
- Experience relevance
- Education requirements
- Job title match

Resume skills: ${resume.skills.slice(0, 20).join(", ")}
Resume excerpt: ${resume.content.slice(0, 500)}

Job: ${job.title} at ${job.company}
Description: ${(job.description || "").slice(0, 500)}

Respond with ONLY a number between 0-100.`;

  try {
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt,
    });

    const num = parseInt(text.trim().match(/\d+/)?.[0] || "0", 10);
    return Math.max(0, Math.min(100, num));
  } catch {
    return 50;
  }
}
