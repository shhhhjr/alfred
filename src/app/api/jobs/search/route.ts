import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { scrapeAllJobs } from "@/lib/jobs/scraper";
import { calculateMatchScore } from "@/lib/jobs/matcher";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const searchSchema = z.object({
  keywords: z.string().optional(),
  jobTitle: z.string().optional(),
  location: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search parameters" }, { status: 400 });
  }

  const { keywords, jobTitle, location } = parsed.data;

  // Verify user exists in DB (session JWT may reference a deleted user after DB reset)
  const userExists = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  if (!userExists) {
    return NextResponse.json(
      { error: "User not found. Please sign out and create a new account." },
      { status: 401 }
    );
  }

  try {
  const { jobs, sources } = await scrapeAllJobs({ keywords, jobTitle, location });

  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      const matchScore = await calculateMatchScore(session.user.id, job);

      const fullUrl = job.url.startsWith("http")
        ? job.url
        : `https://${job.source === "indeed" ? "www.indeed.com" : job.source === "linkedin" ? "www.linkedin.com" : "www.businessoffashion.com"}${job.url.startsWith("/") ? job.url : "/" + job.url}`;

      const existing = await prisma.job.findFirst({
        where: {
          userId: session.user.id,
          url: fullUrl,
        },
      });

      if (existing) {
        return await prisma.job.update({
          where: { id: existing.id },
          data: { matchScore },
        });
      }

      return await prisma.job.create({
        data: {
          userId: session.user.id,
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description || null,
          url: fullUrl,
          source: job.source,
          matchScore,
        },
      });
    })
  );

  const savedJobs = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof prisma.job.create>>>).value);

  return NextResponse.json({
    jobs: savedJobs.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      url: j.url,
      source: j.source,
      matchScore: j.matchScore,
      status: j.status,
      customResume: j.customResume,
      customCover: j.customCover,
      contactName: j.contactName,
      contactEmail: j.contactEmail,
      contactTitle: j.contactTitle,
      notes: j.notes,
      createdAt: j.createdAt.toISOString(),
    })),
    sources,
  });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Search failed: ${msg}` }, { status: 500 });
  }
}
