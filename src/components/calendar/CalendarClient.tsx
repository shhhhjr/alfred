"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCalendar } from "@/hooks/useCalendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AddressAutocomplete } from "@/components/ui/AddressAutocomplete";

const SLOT_START = 6;
const SLOT_END = 24; // 11 PM = 23, we go to 24 for end
const SLOTS = Array.from({ length: SLOT_END - SLOT_START }, (_, i) => i + SLOT_START);
const GRID_LINE = "#1E1E2A";
const HOUR_SLOT_HEIGHT_WEEK = 88;
const HOUR_SLOT_HEIGHT_DAY = 96;
const EVENT_GAP = 8;
const TOTAL_GRID_HEIGHT_WEEK = (SLOT_END - SLOT_START) * HOUR_SLOT_HEIGHT_WEEK;
const TOTAL_GRID_HEIGHT_DAY = (SLOT_END - SLOT_START) * HOUR_SLOT_HEIGHT_DAY;

function toLocalInputValue(date: Date) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function formatHour(h: number) {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

function getEventColor(ev: {
  isFixed: boolean;
  color: string | null;
  travelTime: number | null;
  dueDate: string | null;
  source?: string | null;
}): string {
  if (ev.source === "travel") return "#6B7280";
  if (ev.travelTime && ev.travelTime > 0) return "#6B7280";
  if (ev.dueDate) return "#EF4444";
  if (ev.isFixed) return ev.color ?? "#3B82F6";
  return ev.color ?? "#22C55E";
}

/** Notion-style solid background colors (no opacity) for dark theme. */
function getEventStyles(ev: Parameters<typeof getEventColor>[0]): {
  backgroundColor: string;
  borderLeft: string;
  color: string;
} {
  const accent = getEventColor(ev);
  const styles: Record<string, { backgroundColor: string; borderLeft: string; color: string }> = {
    "#3B82F6": { backgroundColor: "#1e3a8a", borderLeft: "#3B82F6", color: "#e0e7ff" },
    "#22C55E": { backgroundColor: "#14532d", borderLeft: "#22C55E", color: "#dcfce7" },
    "#6B7280": { backgroundColor: "#374151", borderLeft: "#6B7280", color: "#e5e7eb" },
    "#EF4444": { backgroundColor: "#7f1d1d", borderLeft: "#EF4444", color: "#fecaca" },
  };
  return styles[accent] ?? {
    backgroundColor: "#1e3a8a",
    borderLeft: accent,
    color: "#e0e7ff",
  };
}

type CalendarEventItem = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  isFixed: boolean;
  travelTime: number | null;
  color: string | null;
  urgency: string;
  dueDate: string | null;
  estimatedTime: number | null;
  source?: string | null;
};

function isTravelBlock(ev: { source?: string | null }): boolean {
  return ev.source === "travel";
}

export function CalendarClient() {
  const searchParams = useSearchParams();
  const initialTitle = searchParams.get("title") ?? "";
  const initialMinutes = Number(searchParams.get("minutes") ?? "60") || 60;
  const initialDuration = initialMinutes * 60 * 1000;

  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [focusDate, setFocusDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isFixed, setIsFixed] = useState(true);
  const [color, setColor] = useState("#3B82F6");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const { start, end } = useMemo(() => {
    const s = new Date(focusDate);
    s.setHours(0, 0, 0, 0);
    const e = new Date(s);
    if (view === "day") {
      e.setDate(e.getDate() + 1);
    } else if (view === "week") {
      const dow = (s.getDay() + 6) % 7;
      s.setDate(s.getDate() - dow);
      e.setDate(s.getDate() + 7);
    } else {
      s.setDate(1);
      e.setMonth(e.getMonth() + 1);
    }
    return { start: s, end: e };
  }, [focusDate, view]);

  const { events, isLoading, refetch } = useCalendar(start.toISOString(), end.toISOString());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const goPrev = useCallback(() => {
    const d = new Date(focusDate);
    if (view === "day") d.setDate(d.getDate() - 1);
    else if (view === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setFocusDate(d);
  }, [focusDate, view]);

  const goNext = useCallback(() => {
    const d = new Date(focusDate);
    if (view === "day") d.setDate(d.getDate() + 1);
    else if (view === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setFocusDate(d);
  }, [focusDate, view]);

  const goToday = useCallback(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setFocusDate(d);
  }, []);

  const openCreate = useCallback((day: Date, hour: number) => {
    const s = new Date(day);
    s.setHours(hour, 0, 0, 0);
    const e = new Date(s.getTime() + initialDuration);
    setTitle(initialTitle);
    setDescription("");
    setLocation("");
    setStartTime(toLocalInputValue(s));
    setEndTime(toLocalInputValue(e));
    setIsFixed(true);
    setColor("#3B82F6");
    setSelectedEventId(null);
    setModalMode("create");
  }, [initialTitle, initialDuration]);

  const openEdit = useCallback((ev: CalendarEventItem) => {
    setSelectedEventId(ev.id);
    setTitle(ev.title);
    setDescription(ev.description ?? "");
    setLocation(ev.location ?? "");
    setStartTime(toLocalInputValue(new Date(ev.startTime)));
    setEndTime(toLocalInputValue(new Date(ev.endTime)));
    setIsFixed(ev.isFixed);
    setColor(ev.color ?? (ev.isFixed ? "#3B82F6" : "#22C55E"));
    setModalMode("edit");
  }, []);

  const closeModal = useCallback(() => {
    setModalMode(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const startD = new Date(startTime);
      const endD = new Date(endTime);
      if (endD <= startD) return;

      if (modalMode === "create") {
        await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: description || undefined,
            location: location || undefined,
            startTime: startD.toISOString(),
            endTime: endD.toISOString(),
            isFixed,
            color,
            estimatedTime: Math.round((endD.getTime() - startD.getTime()) / 60000),
          }),
        });
      } else if (selectedEventId) {
        await fetch(`/api/calendar/${selectedEventId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: description || null,
            location: location || null,
            startTime: startD.toISOString(),
            endTime: endD.toISOString(),
            isFixed,
            color,
            estimatedTime: Math.round((endD.getTime() - startD.getTime()) / 60000),
          }),
        });
      }
      closeModal();
      refetch();
    },
    [modalMode, selectedEventId, title, description, location, startTime, endTime, isFixed, color, closeModal, refetch]
  );

  const handleDelete = useCallback(async () => {
    if (!selectedEventId) return;
    await fetch(`/api/calendar/${selectedEventId}`, { method: "DELETE" });
    closeModal();
    refetch();
  }, [selectedEventId, closeModal, refetch]);

  const handleEventMove = useCallback(
    async (ev: CalendarEventItem, newDay: Date, newHour: number) => {
      if (isTravelBlock(ev)) return;
      const start = new Date(ev.startTime);
      const end = new Date(ev.endTime);
      const durationMs = end.getTime() - start.getTime();
      const newStart = new Date(newDay);
      newStart.setHours(newHour, 0, 0, 0);
      const newEnd = new Date(newStart.getTime() + durationMs);
      await fetch(`/api/calendar/${ev.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
        }),
      });
      refetch();
    },
    [refetch]
  );

  const weekDays = useMemo(() => {
    if (view !== "week") return [];
    const base = new Date(start);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, [view, start]);

  const monthGrid = useMemo(() => {
    if (view !== "month") return [];
    const year = start.getFullYear();
    const month = start.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startOffset = (first.getDay() + 6) % 7;
    const totalDays = last.getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    while (cells.length < 42) cells.push(null);
    return cells;
  }, [view, start]);

  function getEventsForDay(day: Date) {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    return events.filter((e) => {
      const d = new Date(e.startTime);
      return d >= dayStart && d <= dayEnd;
    });
  }

  function getEventPosition(
    ev: { startTime: string; endTime: string },
    day: Date,
    hourSlotHeight: number
  ): { top: number; height: number } {
    const start = new Date(ev.startTime);
    const end = new Date(ev.endTime);
    const startHour = start.getHours() + start.getMinutes() / 60 + start.getSeconds() / 3600;
    const slotStartHour = SLOT_START;
    const top = ((startHour - slotStartHour) * 60) / 60 * hourSlotHeight;
    const durationMinutes = (end.getTime() - start.getTime()) / 60000;
    const height = (durationMinutes / 60) * hourSlotHeight;
    const maxHeight = (SLOT_END - SLOT_START) * hourSlotHeight;
    return {
      top: Math.max(0, top),
      height: Math.min(Math.max(height, 1), maxHeight - Math.max(0, top)),
    };
  }

  /** Assign column indices so overlapping events display side-by-side as rectangles. */
  function assignOverlapColumns<T extends { startTime: string; endTime: string }>(
    dayEvents: T[]
  ): Array<T & { column: number; totalColumns: number }> {
    const sorted = [...dayEvents].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    const columns: T[][] = [];
    const assigned: Array<{ ev: T; column: number }> = [];
    for (const ev of sorted) {
      const start = new Date(ev.startTime).getTime();
      const end = new Date(ev.endTime).getTime();
      let col = 0;
      while (col < columns.length) {
        const conflicts = columns[col].some((c) => {
          const cs = new Date(c.startTime).getTime();
          const ce = new Date(c.endTime).getTime();
          return start < ce && end > cs;
        });
        if (!conflicts) break;
        col++;
      }
      if (!columns[col]) columns[col] = [];
      columns[col].push(ev);
      assigned.push({ ev, column: col });
    }
    const totalCols = columns.length || 1;
    return assigned.map(({ ev, column }) => ({ ...ev, column, totalColumns: totalCols }));
  }

  const navLabel =
    view === "day"
      ? focusDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
      : view === "week"
        ? `${start.toLocaleDateString(undefined, { month: "short" })} ${start.getDate()} - ${new Date(start.getTime() + 6 * 86400000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
        : start.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const isTodayInRange =
    view === "day"
      ? focusDate.toDateString() === now.toDateString()
      : view === "week" && now >= start && now < end;
  const currentTimePercent =
    view !== "month" && isTodayInRange
      ? ((now.getHours() + now.getMinutes() / 60 - SLOT_START) / (SLOT_END - SLOT_START)) * 100
      : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={goPrev}>
            ←
          </Button>
          <Button size="sm" variant="outline" onClick={goNext}>
            →
          </Button>
          <Button size="sm" variant="outline" onClick={goToday}>
            Today
          </Button>
          <span className="ml-2 text-sm font-medium">{navLabel}</span>
        </div>
        <div className="flex gap-2">
          {(["day", "week", "month"] as const).map((v) => (
            <Button
              key={v}
              size="sm"
              variant={view === v ? "default" : "outline"}
              onClick={() => setView(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
        style={{ borderColor: GRID_LINE }}
      >
        {view === "week" && (
          <>
            <div className="shrink-0 grid grid-cols-8 border-b text-xs" style={{ borderColor: GRID_LINE }}>
              <div className="p-2" style={{ borderRight: `1px solid ${GRID_LINE}` }} />
              {weekDays.map((d) => (
                <div
                  key={d.toISOString()}
                  className="p-2 text-center text-zinc-400"
                  style={{ borderRight: `1px solid ${GRID_LINE}` }}
                >
                  {d.toLocaleDateString(undefined, { weekday: "short" })} {d.getDate()}
                </div>
              ))}
            </div>
            <div className="relative min-h-0 flex-1 overflow-y-auto">
              <div
                className="grid grid-cols-8"
                style={{ height: TOTAL_GRID_HEIGHT_WEEK, minHeight: TOTAL_GRID_HEIGHT_WEEK }}
              >
                <div
                  className="flex flex-col"
                  style={{ borderRight: `1px solid ${GRID_LINE}` }}
                >
                  {SLOTS.map((hour) => (
                    <div
                      key={hour}
                      className="p-1 text-right text-xs text-zinc-500"
                      style={{ height: HOUR_SLOT_HEIGHT_WEEK, minHeight: HOUR_SLOT_HEIGHT_WEEK, borderBottom: `1px solid ${GRID_LINE}` }}
                    >
                      {formatHour(hour)}
                    </div>
                  ))}
                </div>
                {weekDays.map((day) => (
                  <div
                    key={day.toISOString()}
                    className="relative"
                    style={{
                      height: TOTAL_GRID_HEIGHT_WEEK,
                      minWidth: 0,
                      borderRight: `1px solid ${GRID_LINE}`,
                    }}
                  >
                    {SLOTS.map((hour) => (
                      <div
                        key={hour}
                        className="absolute left-0 right-0 cursor-pointer hover:bg-zinc-900/50"
                        style={{
                          top: (hour - SLOT_START) * HOUR_SLOT_HEIGHT_WEEK,
                          height: HOUR_SLOT_HEIGHT_WEEK,
                          borderBottom: `1px solid ${GRID_LINE}`,
                        }}
                        onClick={() => !isLoading && openCreate(day, hour)}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-zinc-800/50"); }}
                        onDragLeave={(e) => e.currentTarget.classList.remove("bg-zinc-800/50")}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove("bg-zinc-800/50");
                          const evId = e.dataTransfer.getData("calendar-event-id");
                          const ev = events.find((x) => x.id === evId) as CalendarEventItem | undefined;
                          if (ev && !isTravelBlock(ev)) handleEventMove(ev, day, hour);
                        }}
                        data-day={day.toISOString()}
                        data-hour={hour}
                      />
                    ))}
                    {!isLoading &&
                      assignOverlapColumns(getEventsForDay(day)).map((ev) => {
                        const pos = getEventPosition(ev, day, HOUR_SLOT_HEIGHT_WEEK);
                        const n = ev.totalColumns;
                        const g = EVENT_GAP;
                        const leftPct = n > 1 ? (ev.column / n) * 100 : 0;
                        const widthPct = n > 1 ? 100 / n : 100;
                        const left = n > 1
                          ? `calc(${leftPct}% + ${g}px)`
                          : `${g}px`;
                        const width = n > 1
                          ? `calc(${widthPct}% - ${g * 2}px)`
                          : `calc(100% - ${g * 2}px)`;
                        const styles = getEventStyles(ev);
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            draggable={!isTravelBlock(ev)}
                            onDragStart={(e) => {
                              if (isTravelBlock(ev)) return;
                              e.dataTransfer.setData("calendar-event-id", ev.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            className="absolute rounded text-left text-xs hover:ring-1 hover:ring-zinc-500 overflow-hidden px-2 py-1 min-h-0 border-0 cursor-grab active:cursor-grabbing"
                            style={{
                              top: pos.top,
                              height: pos.height,
                              left,
                              width,
                              backgroundColor: styles.backgroundColor,
                              color: styles.color,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isTravelBlock(ev)) openEdit(ev);
                            }}
                          >
                            <p className="truncate font-medium">{ev.title}</p>
                            <p className="truncate opacity-90 text-[10px]">
                              {new Date(ev.startTime).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                              –
                              {new Date(ev.endTime).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                          </button>
                        );
                      })}
                  </div>
                ))}
              </div>
              {currentTimePercent != null && (
                <div
                  className="pointer-events-none absolute left-0 right-0 h-0.5 bg-red-500 z-10"
                  style={{
                    top: `${(currentTimePercent / 100) * TOTAL_GRID_HEIGHT_WEEK}px`,
                  }}
                />
              )}
            </div>
          </>
        )}

        {view === "day" && (
          <div className="relative min-h-0 flex-1 overflow-y-auto">
            <div
              className="grid grid-cols-2"
              style={{ height: TOTAL_GRID_HEIGHT_DAY, minHeight: TOTAL_GRID_HEIGHT_DAY }}
            >
              <div
                className="flex flex-col"
                style={{ borderRight: `1px solid ${GRID_LINE}` }}
              >
                {SLOTS.map((hour) => (
                  <div
                    key={hour}
                    className="p-2 text-xs text-zinc-500"
                    style={{
                      height: HOUR_SLOT_HEIGHT_DAY,
                      minHeight: HOUR_SLOT_HEIGHT_DAY,
                      borderBottom: `1px solid ${GRID_LINE}`,
                    }}
                  >
                    {formatHour(hour)}
                  </div>
                ))}
              </div>
              <div
                className="relative"
                style={{
                  height: TOTAL_GRID_HEIGHT_DAY,
                  borderRight: `1px solid ${GRID_LINE}`,
                }}
              >
                {SLOTS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 cursor-pointer hover:bg-zinc-900/50"
                    style={{
                      top: (hour - SLOT_START) * HOUR_SLOT_HEIGHT_DAY,
                      height: HOUR_SLOT_HEIGHT_DAY,
                      borderBottom: `1px solid ${GRID_LINE}`,
                    }}
                    onClick={() => !isLoading && openCreate(focusDate, hour)}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-zinc-800/50"); }}
                    onDragLeave={(e) => e.currentTarget.classList.remove("bg-zinc-800/50")}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove("bg-zinc-800/50");
                      const evId = e.dataTransfer.getData("calendar-event-id");
                      const ev = events.find((x) => x.id === evId) as CalendarEventItem | undefined;
                      if (ev && !isTravelBlock(ev)) handleEventMove(ev, focusDate, hour);
                    }}
                  />
                ))}
                {!isLoading &&
                  assignOverlapColumns(getEventsForDay(focusDate)).map((ev) => {
                    const pos = getEventPosition(ev, focusDate, HOUR_SLOT_HEIGHT_DAY);
                    const n = ev.totalColumns;
                    const g = EVENT_GAP;
                    const leftPct = n > 1 ? (ev.column / n) * 100 : 0;
                    const widthPct = n > 1 ? 100 / n : 100;
                    const left = n > 1
                      ? `calc(${leftPct}% + ${g}px)`
                      : `${g}px`;
                    const width = n > 1
                      ? `calc(${widthPct}% - ${g * 2}px)`
                      : `calc(100% - ${g * 2}px)`;
                    const styles = getEventStyles(ev);
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        draggable={!isTravelBlock(ev)}
                        onDragStart={(e) => {
                          if (isTravelBlock(ev)) return;
                          e.dataTransfer.setData("calendar-event-id", ev.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        className="absolute rounded border-0 p-2 text-left hover:ring-1 hover:ring-zinc-500 overflow-hidden cursor-grab active:cursor-grabbing"
                        style={{
                          top: pos.top,
                          height: pos.height,
                          left,
                          width,
                          backgroundColor: styles.backgroundColor,
                          color: styles.color,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isTravelBlock(ev)) openEdit(ev);
                        }}
                      >
                        <p className="font-medium truncate text-sm">{ev.title}</p>
                        {ev.description && pos.height > 44 && (
                          <p className="mt-0.5 overflow-hidden text-xs opacity-90 line-clamp-2">{ev.description}</p>
                        )}
                        <p className="mt-0.5 text-xs opacity-90 truncate">
                          {new Date(ev.startTime).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                          –{" "}
                          {new Date(ev.endTime).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                          {ev.location && ` • ${ev.location}`}
                        </p>
                      </button>
                    );
                  })}
              </div>
            </div>
            {currentTimePercent != null && (
              <div
                className="pointer-events-none absolute left-0 right-0 h-0.5 bg-red-500 z-10"
                style={{
                  top: `${(currentTimePercent / 100) * TOTAL_GRID_HEIGHT_DAY}px`,
                }}
              />
            )}
          </div>
        )}

        {view === "month" && (
          <div className="grid grid-cols-7">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div
                key={d}
                className="border-b border-r p-2 text-center text-xs font-medium text-zinc-400"
                style={{ borderColor: GRID_LINE }}
              >
                {d}
              </div>
            ))}
            {monthGrid.map((dayNum, idx) => {
              if (dayNum === null) {
                return (
                  <div
                    key={`e-${idx}`}
                    className="min-h-[100px] border-b border-r bg-zinc-900/30"
                    style={{ borderColor: GRID_LINE }}
                  />
                );
              }
              const day = new Date(start.getFullYear(), start.getMonth(), dayNum);
              const dayEvents = getEventsForDay(day);
              return (
                <div
                  key={dayNum}
                  className="min-h-[100px] cursor-pointer border-b border-r p-2 hover:bg-zinc-900/50"
                  style={{ borderColor: GRID_LINE }}
                  onClick={() => {
                    setFocusDate(day);
                    setView("day");
                  }}
                >
                  <p className="text-sm font-medium text-zinc-300">{dayNum}</p>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const styles = getEventStyles(ev);
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          className="block w-full rounded px-1 py-0.5 text-left text-xs hover:ring-1"
                          style={{
                            backgroundColor: styles.backgroundColor,
                            borderLeft: `3px solid ${styles.borderLeft}`,
                            color: styles.color,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isTravelBlock(ev)) openEdit(ev);
                          }}
                        >
                          {ev.title}
                        </button>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <p className="text-xs text-zinc-500">+{dayEvents.length - 3}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={modalMode !== null} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalMode === "create" ? "New Event" : "Edit Event"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Location</label>
              <AddressAutocomplete
                value={location}
                onChange={setLocation}
                placeholder="Optional - start typing an address"
              />
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Start</label>
                <Input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  step="900"
                  className="font-mono text-sm"
                  required
                />
                {startTime && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {new Date(startTime).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">End</label>
                <Input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  step="900"
                  className="font-mono text-sm"
                  required
                />
                {endTime && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {new Date(endTime).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-zinc-400">Fixed time block</label>
              <Switch checked={isFixed} onCheckedChange={setIsFixed} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-400">Color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-12 rounded border border-zinc-700 bg-zinc-900"
              />
            </div>
            <DialogFooter>
              {modalMode === "edit" && (
                <Button type="button" variant="outline" className="text-red-400 hover:text-red-300" onClick={handleDelete}>
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit">{modalMode === "create" ? "Create" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
