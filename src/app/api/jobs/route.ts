import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const searchSchema = z.object({
  title: z.string().trim().min(1),
  company: z.string().trim().min(1),
  url: z.string().url(),
  source: z.string().trim().min(1),
  location: z.string().trim().optional(),
});

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await prisma.job.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const body = await request.json();
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const job = await prisma.job.create({
    data: {
      userId: session.user.id,
      ...parsed.data,
      status: "found",
    },
  });

  return NextResponse.json({ job }, { status: 201 });
}
