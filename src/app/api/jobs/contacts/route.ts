import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { findContact } from "@/lib/jobs/emailFinder";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const contactSchema = z.object({
  jobId: z.string(),
});

export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { jobId } = parsed.data;

  const job = await prisma.job.findFirst({
    where: { id: jobId, userId: session.user.id },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  try {
    const result = await findContact(job.company, job.title);

    if (!result.success) {
      if (result.error === "no_api_keys") {
        return NextResponse.json(
          { error: "API keys not configured. Add HUNTER_API_KEY and/or APOLLO_API_KEY to your .env file." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: "Could not find contact information" }, { status: 404 });
    }

    const { contact } = result;

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        contactName: contact.name,
        contactEmail: contact.email,
        contactTitle: contact.title,
        contactPhone: contact.phone ?? null,
      },
    });

    return NextResponse.json({
      contact: {
        name: updated.contactName,
        email: updated.contactEmail,
        title: updated.contactTitle,
        phone: updated.contactPhone,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
