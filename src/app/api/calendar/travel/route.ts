import { getAuthSession } from "@/lib/auth/session";
import { calculateTravelTime, normalizeTravelMode } from "@/lib/calendar/travel";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const origin = searchParams.get("origin");
  const destination = searchParams.get("destination");
  let mode = searchParams.get("mode");

  if (!origin || !destination) {
    return NextResponse.json(
      { error: "origin and destination are required" },
      { status: 400 }
    );
  }

  if (!mode) {
    const prefs = await prisma.userPreference.findUnique({
      where: { userId: session.user.id },
      select: { travelMode: true },
    });
    mode = normalizeTravelMode(prefs?.travelMode ?? "drive");
  }

  const validModes = ["driving", "walking", "transit", "bicycling"];
  if (!validModes.includes(mode)) {
    mode = "driving";
  }

  const result = await calculateTravelTime(
    origin,
    destination,
    mode as "driving" | "walking" | "transit" | "bicycling"
  );

  if (!result) {
    return NextResponse.json(
      { error: "Could not calculate travel time. Check addresses and GOOGLE_MAPS_API_KEY." },
      { status: 502 }
    );
  }

  return NextResponse.json(result);
}
