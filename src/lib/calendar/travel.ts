import { env } from "@/lib/env";

export type TravelMode = "driving" | "walking" | "transit" | "bicycling";

/** Map user preference travelMode (e.g. "drive") to Directions API mode */
export function normalizeTravelMode(pref: string | null | undefined): TravelMode {
  const m = (pref ?? "drive").toLowerCase();
  if (m === "transit" || m === "bus" || m === "train") return "transit";
  if (m === "walk" || m === "walking") return "walking";
  if (m === "bike" || m === "bicycling") return "bicycling";
  return "driving";
}

export type TravelResult = { durationMinutes: number; durationText: string };

export async function calculateTravelTime(
  origin: string,
  destination: string,
  mode: TravelMode = "driving"
): Promise<TravelResult | null> {
  if (!env.GOOGLE_MAPS_API_KEY) {
    return null;
  }

  const params = new URLSearchParams({
    origin,
    destination,
    mode,
    key: env.GOOGLE_MAPS_API_KEY,
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`,
    { method: "GET" }
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    routes?: Array<{
      legs?: Array<{ duration?: { value?: number; text?: string } }>;
    }>;
  };
  const leg = payload.routes?.[0]?.legs?.[0];
  const seconds = leg?.duration?.value;
  const text = leg?.duration?.text ?? "";

  if (!seconds) return null;

  const durationMinutes = Math.max(1, Math.round(seconds / 60));
  return { durationMinutes, durationText: text || `${durationMinutes} min` };
}

/** @deprecated Use calculateTravelTime */
export async function getTravelMinutes(
  origin: string,
  destination: string,
  mode: TravelMode = "driving"
): Promise<number | null> {
  const result = await calculateTravelTime(origin, destination, mode);
  return result?.durationMinutes ?? null;
}

export function getTravelBlockIcon(mode: TravelMode): string {
  switch (mode) {
    case "transit":
      return "🚌";
    case "walking":
      return "🚶";
    case "bicycling":
      return "🚴";
    default:
      return "🚗";
  }
}
