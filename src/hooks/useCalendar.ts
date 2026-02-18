"use client";

import { useCallback, useEffect, useState } from "react";

export type CalendarEventItem = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  isFixed: boolean;
  travelTime: number | null;
  color: string | null;
  urgency: "low" | "medium" | "high";
  dueDate: string | null;
  estimatedTime: number | null;
  source?: string | null;
};

export function useCalendar(from?: string, to?: string) {
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const response = await fetch(`/api/calendar?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as { events?: CalendarEventItem[] };
    setEvents(payload.events ?? []);
    setIsLoading(false);
  }, [from, to]);

  useEffect(() => {
    fetchEvents().catch(() => setIsLoading(false));
  }, [fetchEvents]);

  return { events, setEvents, isLoading, refetch: fetchEvents };
}
