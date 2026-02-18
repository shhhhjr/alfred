import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

const SKILL_KEYWORDS = [
  "javascript", "typescript", "python", "java", "react", "node", "sql", "aws", "docker", "kubernetes",
  "git", "agile", "scrum", "leadership", "communication", "problem solving", "analytical", "data analysis",
  "machine learning", "ai", "frontend", "backend", "full stack", "api", "rest", "graphql", "mongodb",
  "postgresql", "mysql", "redis", "elasticsearch", "ci/cd", "devops", "linux", "unix", "bash", "shell",
  "html", "css", "sass", "less", "webpack", "babel", "jest", "testing", "tdd", "bdd", "microservices",
  "architecture", "design patterns", "oop", "functional programming", "algorithms", "data structures",
];

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const skill of SKILL_KEYWORDS) {
    if (lower.includes(skill.toLowerCase())) {
      found.push(skill);
    }
  }
  return [...new Set(found)];
}

function extractEducation(text: string): string | null {
  const eduPatterns = [
    /(?:university|college|school|degree|bachelor|master|phd|doctorate|diploma|certificate)[\s\w,]+/gi,
    /(?:b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?a\.?|ph\.?d\.?|mba)[\s\w,]+/gi,
  ];
  for (const pattern of eduPatterns) {
    const match = text.match(pattern);
    if (match && match[0].length > 5) {
      return match[0].trim();
    }
  }
  return null;
}

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const freq: Record<string, number> = {};
  for (const word of words) {
    if (word.length >= 4 && !["that", "this", "with", "from", "have", "will", "would", "could", "should"].includes(word)) {
      freq[word] = (freq[word] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word]) => word);
}

async function extractWithAI(text: string): Promise<{ skills: string[]; education: string | null; keywords: string[] }> {
  const prompt = `Extract structured data from this resume text. Return ONLY valid JSON (no markdown, no code block) with this exact shape:
{"skills":["skill1","skill2",...],"education":"degree or null","keywords":["keyword1",...]}

Rules: skills = technical and soft skills (e.g. JavaScript, Python, Leadership). education = degree/institution or null. keywords = notable terms. Use arrays of strings.`;

  const { text: raw } = await generateText({
    model: google("gemini-2.0-flash"),
    prompt: `${prompt}\n\nResume text:\n${text.slice(0, 4000)}`,
  });
  try {
    const json = raw.replace(/```\w*\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(json) as { skills?: string[]; education?: string | null; keywords?: string[] };
    return {
      skills: Array.isArray(parsed.skills) ? parsed.skills : extractSkills(text),
      education: typeof parsed.education === "string" ? parsed.education : extractEducation(text),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : extractKeywords(text),
    };
  } catch {
    return {
      skills: extractSkills(text),
      education: extractEducation(text),
      keywords: extractKeywords(text),
    };
  }
}

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resume = await prisma.resume.findUnique({
    where: { userId: session.user.id },
  });

  if (!resume) {
    return NextResponse.json({ resume: null });
  }

  return NextResponse.json({
    resume: {
      id: resume.id,
      content: resume.content,
      skills: resume.skills,
      keywords: resume.keywords,
      education: resume.education,
      fileUrl: resume.fileUrl,
      contentLength: resume.content.length,
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let text = "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    const pasted = (body?.text ?? body?.content ?? "").trim();
    if (!pasted) {
      return NextResponse.json({ error: "No resume text provided" }, { status: 400 });
    }
    text = pasted;
  } else {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded. Upload a PDF/DOCX or paste your resume text." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      if (file.name.endsWith(".pdf")) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
          const { PDFParse } = require("pdf-parse");
          const parser = new PDFParse({ data: new Uint8Array(buffer) });
          try {
            const result = await parser.getText();
            text = result?.text ?? "";
          } finally {
            if (typeof parser.destroy === "function") {
              await parser.destroy();
            }
          }
        } catch (pdfErr) {
          const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
          return NextResponse.json({
            error: `PDF parsing failed (${msg}). Try pasting your resume text instead — we'll use AI to extract skills and education.`,
          }, { status: 400 });
        }
      } else if (file.name.endsWith(".docx")) {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } else {
        return NextResponse.json({ error: "Unsupported file type. Use PDF or DOCX." }, { status: 400 });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Failed to parse file: ${msg}. Try pasting your resume text instead.` }, { status: 400 });
    }
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "Could not extract text. Paste your resume text or try a different file." }, { status: 400 });
  }

  let skills: string[];
  let education: string | null;
  let keywords: string[];

  try {
    const aiExtracted = await extractWithAI(text);
    skills = aiExtracted.skills.length > 0 ? aiExtracted.skills : extractSkills(text);
    education = aiExtracted.education ?? extractEducation(text);
    keywords = aiExtracted.keywords.length > 0 ? aiExtracted.keywords : extractKeywords(text);
  } catch {
    skills = extractSkills(text);
    education = extractEducation(text);
    keywords = extractKeywords(text);
  }

  const resume = await prisma.resume.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      content: text,
      skills,
      keywords,
      education: education ?? undefined,
    },
    update: {
      content: text,
      skills,
      keywords,
      education: education ?? undefined,
    },
  });

  return NextResponse.json({
    resume: {
      id: resume.id,
      skills: resume.skills,
      keywords: resume.keywords,
      education: resume.education,
      contentLength: resume.content.length,
    },
  });
}
