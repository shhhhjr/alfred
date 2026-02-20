import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const settingsSchema = z.object({
  name: z.string().trim().max(80).optional(),
  homeAddress: z.string().trim().max(200).optional(),
  automationLevel: z.enum(["manual", "semi", "auto"]).optional(),
  school: z.string().trim().max(120).optional(),
  courses: z.array(z.string().trim().max(80)).optional(),
  travelMode: z.enum(["drive", "walk", "transit", "bicycling"]).optional(),
  workHoursStart: z.number().int().min(0).max(23).optional(),
  workHoursEnd: z.number().int().min(1).max(24).optional(),
  breakMinutes: z.number().int().min(5).max(120).optional(),
  emailDigestHours: z.number().int().min(1).max(168).optional(),
  profileVisibility: z.enum(["private", "friends", "public"]).optional(),
  profileHeadline: z.string().trim().max(120).optional(),
  profileBio: z.string().trim().max(500).optional(),
  jobSearchKeywords: z.string().trim().max(500).optional(),
  jobSearchLocations: z.string().trim().max(500).optional(),
  jobSearchExcludedCompanies: z.string().trim().max(500).optional(),
  notifEmailDigest: z.boolean().optional(),
  notifPush: z.boolean().optional(),
  notifMorningBrief: z.boolean().optional(),
  hasCompletedOnboarding: z.boolean().optional(),
});

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, preferences] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, homeAddress: true, automationLevel: true },
    }),
    prisma.userPreference.findUnique({
      where: { userId: session.user.id },
    }),
  ]);

  return NextResponse.json({ user, preferences });
}

async function handleUpdate(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
  }

  const data = parsed.data;

  const existingPref = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
  });

  let automationLevelNote: string | undefined;
  if (
    "jobSearchKeywords" in data ||
    "jobSearchLocations" in data ||
    "jobSearchExcludedCompanies" in data
  ) {
    let base: Record<string, unknown> = {};
    if (existingPref?.automationLevelNote) {
      try {
        base = JSON.parse(existingPref.automationLevelNote) as Record<string, unknown>;
      } catch {
        base = {};
      }
    }
    const currentJob = (base.jobSearch as Record<string, unknown>) ?? {};
    base.jobSearch = {
      keywords: data.jobSearchKeywords ?? (currentJob.keywords as string | undefined) ?? "",
      locations: data.jobSearchLocations ?? (currentJob.locations as string | undefined) ?? "",
      excludedCompanies:
        data.jobSearchExcludedCompanies ?? (currentJob.excludedCompanies as string | undefined) ?? "",
    };
    automationLevelNote = JSON.stringify(base);
  }

  const [user] = await Promise.all([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...("name" in data ? { name: data.name } : {}),
        ...("homeAddress" in data ? { homeAddress: data.homeAddress } : {}),
        ...("automationLevel" in data ? { automationLevel: data.automationLevel } : {}),
      },
    }),
    prisma.userPreference.upsert({
      where: { userId: session.user.id },
      update: {
        ...("school" in data ? { school: data.school } : {}),
        ...("courses" in data ? { courses: data.courses } : {}),
        ...("travelMode" in data ? { travelMode: data.travelMode } : {}),
        ...("workHoursStart" in data ? { workHoursStart: data.workHoursStart } : {}),
        ...("workHoursEnd" in data ? { workHoursEnd: data.workHoursEnd } : {}),
        ...("breakMinutes" in data ? { breakMinutes: data.breakMinutes } : {}),
        ...("emailDigestHours" in data ? { emailDigestHours: data.emailDigestHours } : {}),
        ...("profileVisibility" in data ? { profileVisibility: data.profileVisibility } : {}),
        ...("profileHeadline" in data ? { profileHeadline: data.profileHeadline } : {}),
        ...("profileBio" in data ? { profileBio: data.profileBio } : {}),
        ...(automationLevelNote !== undefined ? { automationLevelNote } : {}),
        ...("notifEmailDigest" in data ? { notifEmailDigest: data.notifEmailDigest } : {}),
        ...("notifPush" in data ? { notifPush: data.notifPush } : {}),
        ...("notifMorningBrief" in data ? { notifMorningBrief: data.notifMorningBrief } : {}),
        ...("hasCompletedOnboarding" in data ? { hasCompletedOnboarding: data.hasCompletedOnboarding } : {}),
      },
      create: {
        userId: session.user.id,
        school: data.school,
        courses: data.courses ?? [],
        travelMode: data.travelMode ?? "drive",
        workHoursStart: data.workHoursStart ?? 9,
        workHoursEnd: data.workHoursEnd ?? 17,
        breakMinutes: data.breakMinutes ?? 15,
        emailDigestHours: data.emailDigestHours ?? 24,
        profileVisibility: data.profileVisibility ?? "private",
        profileHeadline: data.profileHeadline,
        profileBio: data.profileBio,
        notifEmailDigest: data.notifEmailDigest ?? false,
        notifPush: data.notifPush ?? false,
        notifMorningBrief: data.notifMorningBrief ?? false,
        hasCompletedOnboarding: data.hasCompletedOnboarding ?? false,
        automationLevelNote:
          automationLevelNote ??
          existingPref?.automationLevelNote ??
          JSON.stringify({
            jobSearch: {
              keywords: data.jobSearchKeywords ?? "",
              locations: data.jobSearchLocations ?? "",
              excludedCompanies: data.jobSearchExcludedCompanies ?? "",
            },
          }),
      },
    }),
  ]);

  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  return handleUpdate(request);
}

export async function PUT(request: Request) {
  return handleUpdate(request);
}
