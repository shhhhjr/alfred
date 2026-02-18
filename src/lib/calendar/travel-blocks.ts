import { prisma } from "@/lib/db/prisma";
import { calculateTravelTime, getTravelBlockIcon, normalizeTravelMode } from "./travel";

export async function upsertTravelBlock(
  userId: string,
  mainEventId: string,
  mainEventTitle: string,
  mainEventStart: Date,
  origin: string,
  destination: string,
  mode: string
): Promise<void> {
  const result = await calculateTravelTime(
    origin,
    destination,
    normalizeTravelMode(mode) as "driving" | "walking" | "transit" | "bicycling"
  );
  if (!result) return;

  const icon = getTravelBlockIcon(normalizeTravelMode(mode));
  const title = `${icon} Travel to ${mainEventTitle} — ${result.durationText}`;
  const start = new Date(mainEventStart.getTime() - result.durationMinutes * 60 * 1000);
  const end = new Date(mainEventStart);

  const existing = await prisma.calendarEvent.findFirst({
    where: { userId, source: "travel", sourceRef: mainEventId },
  });

  if (existing) {
    await prisma.calendarEvent.update({
      where: { id: existing.id },
      data: { title, startTime: start, endTime: end },
    });
  } else {
    await prisma.calendarEvent.create({
      data: {
        userId,
        title,
        startTime: start,
        endTime: end,
        isFixed: true,
        color: "#6B7280",
        source: "travel",
        sourceRef: mainEventId,
      },
    });
  }
}

export async function deleteTravelBlockForEvent(userId: string, mainEventId: string): Promise<void> {
  await prisma.calendarEvent.deleteMany({
    where: { userId, source: "travel", sourceRef: mainEventId },
  });
}
