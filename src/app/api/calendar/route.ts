import { getAuthSession } from "@/lib/auth/session";
import { calculateTravelTime, normalizeTravelMode } from "@/lib/calendar/travel";
import { upsertTravelBlock } from "@/lib/calendar/travel-blocks";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const eventSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(200).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  isFixed: z.boolean().default(false),
  color: z.string().trim().max(20).optional(),
  urgency: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().datetime().optional(),
  estimatedTime: z.number().int().min(15).max(24 * 60).optional(),
});

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? searchParams.get("startDate");
  const to = searchParams.get("to") ?? searchParams.get("endDate");

  const events = await prisma.calendarEvent.findMany({
    where: {
      userId: session.user.id,
      ...(from || to
        ? {
            startTime: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
    }

    const startTime = new Date(parsed.data.startTime);
    const endTime = new Date(parsed.data.endTime);
    if (endTime <= startTime) {
      return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });
    }

    const [previousEvent, user, prefs] = await Promise.all([
      prisma.calendarEvent.findFirst({
        where: {
          userId: session.user.id,
          endTime: { lte: startTime },
          source: { not: "travel" },
          location: { not: null },
        },
        orderBy: { endTime: "desc" },
      }),
      prisma.user.findUnique({ where: { id: session.user.id }, select: { homeAddress: true } }),
      prisma.userPreference.findUnique({ where: { userId: session.user.id }, select: { travelMode: true } }),
    ]);

    const origin = previousEvent?.location ?? user?.homeAddress ?? null;
    const destination = parsed.data.location ?? null;
    const mode = normalizeTravelMode(prefs?.travelMode ?? "drive");
    const travelResult =
      origin && destination ? await calculateTravelTime(origin, destination, mode) : null;
    const travelTime = travelResult?.durationMinutes ?? null;

    const event = await prisma.calendarEvent.create({
      data: {
        userId: session.user.id,
        title: parsed.data.title,
        description: parsed.data.description,
        location: parsed.data.location,
        startTime,
        endTime,
        isFixed: parsed.data.isFixed,
        color: parsed.data.color ?? (parsed.data.isFixed ? "#3B82F6" : "#22C55E"),
        urgency: parsed.data.urgency,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        estimatedTime: parsed.data.estimatedTime,
        travelTime,
        source: "manual",
      },
    });

    if (travelTime && origin && destination) {
      await upsertTravelBlock(
        session.user.id,
        event.id,
        event.title,
        event.startTime,
        origin,
        destination,
        mode
      );
    }

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: "event_created",
        description: `Created event: ${event.title}`,
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error("Calendar create error", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
