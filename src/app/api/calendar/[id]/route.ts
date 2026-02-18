import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { calculateTravelTime, normalizeTravelMode } from "@/lib/calendar/travel";
import { deleteTravelBlockForEvent, upsertTravelBlock } from "@/lib/calendar/travel-blocks";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  isFixed: z.boolean().optional(),
  color: z.string().trim().max(20).optional(),
  urgency: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedTime: z.number().int().min(15).max(24 * 60).nullable().optional(),
});

type Params = { params: { id: string } };

async function updateEvent(request: Request, { id }: { id: string }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.calendarEvent.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (existing.source === "travel") {
    return NextResponse.json({ error: "Cannot edit travel blocks directly" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
  }

  const startTime = parsed.data.startTime ? new Date(parsed.data.startTime) : existing.startTime;
  const location = parsed.data.location !== undefined ? parsed.data.location : existing.location;
  const title = parsed.data.title ?? existing.title;

  let travelTime: number | null | undefined = undefined;
  if (location !== undefined) {
    if (!location) {
      await deleteTravelBlockForEvent(session.user.id, id);
      travelTime = null;
    } else {
      const [prevEvent, user, prefs] = await Promise.all([
        prisma.calendarEvent.findFirst({
          where: {
            userId: session.user.id,
            id: { not: id },
            endTime: { lte: startTime },
            source: { not: "travel" },
            location: { not: null },
          },
          orderBy: { endTime: "desc" },
        }),
        prisma.user.findUnique({ where: { id: session.user.id }, select: { homeAddress: true } }),
        prisma.userPreference.findUnique({
          where: { userId: session.user.id },
          select: { travelMode: true },
        }),
      ]);
      const origin = prevEvent?.location ?? user?.homeAddress ?? null;
      const mode = normalizeTravelMode(prefs?.travelMode ?? "drive");
      if (origin) {
        const result = await calculateTravelTime(origin, location, mode);
        if (result) {
          travelTime = result.durationMinutes;
          await upsertTravelBlock(
            session.user.id,
            id,
            title,
            startTime,
            origin,
            location,
            mode
          );
        }
      } else {
        await deleteTravelBlockForEvent(session.user.id, id);
        travelTime = null;
      }
    }
  }

  const event = await prisma.calendarEvent.update({
    where: { id },
    data: {
      ...("title" in parsed.data ? { title: parsed.data.title } : {}),
      ...("description" in parsed.data ? { description: parsed.data.description ?? null } : {}),
      ...("location" in parsed.data ? { location: parsed.data.location ?? null } : {}),
      ...("startTime" in parsed.data ? { startTime: new Date(parsed.data.startTime!) } : {}),
      ...("endTime" in parsed.data ? { endTime: new Date(parsed.data.endTime!) } : {}),
      ...("isFixed" in parsed.data ? { isFixed: parsed.data.isFixed } : {}),
      ...("color" in parsed.data ? { color: parsed.data.color } : {}),
      ...("urgency" in parsed.data ? { urgency: parsed.data.urgency } : {}),
      ...("dueDate" in parsed.data
        ? { dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null }
        : {}),
      ...("estimatedTime" in parsed.data ? { estimatedTime: parsed.data.estimatedTime ?? null } : {}),
      ...(travelTime !== undefined ? { travelTime } : {}),
    },
  });

  return NextResponse.json({ event });
}

export async function PATCH(request: Request, { params }: Params) {
  return updateEvent(request, params);
}

export async function PUT(request: Request, { params }: Params) {
  return updateEvent(request, params);
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.calendarEvent.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (existing.source !== "travel") {
    await deleteTravelBlockForEvent(session.user.id, params.id);
  }
  await prisma.calendarEvent.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
