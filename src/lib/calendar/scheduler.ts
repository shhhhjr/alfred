import type { CalendarEvent, Task } from "@prisma/client";

export type UserPrefs = {
  workHoursStart: number;
  workHoursEnd: number;
  breakMinutes: number;
  bufferMinutes?: number;
};

export type ProposedEvent = {
  id?: string;
  title: string;
  startTime: Date;
  endTime: Date;
  isFixed: boolean;
  color?: string;
  source?: string;
  sourceRef?: string;
  taskId?: string;
};

/**
 * Day planner: fills available gaps with task blocks while keeping fixed events + travel locked.
 */
export function planDay(
  targetDate: Date,
  fixedEvents: CalendarEvent[],
  tasks: Task[],
  prefs: UserPrefs
): ProposedEvent[] {
  const buffer = prefs.bufferMinutes ?? 15;
  const dayStart = new Date(targetDate);
  dayStart.setHours(prefs.workHoursStart, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(prefs.workHoursEnd, 0, 0, 0);

  const sorted = [...fixedEvents].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const occupied: Array<{ start: Date; end: Date }> = sorted.map((e) => {
    const start = new Date(e.startTime);
    const end = new Date(e.endTime);
    return {
      start: new Date(start.getTime() - buffer * 60 * 1000),
      end: new Date(end.getTime() + buffer * 60 * 1000),
    };
  });

  const slots = computeGaps(dayStart, dayEnd, occupied, buffer);

  const tasksWithTime = tasks
    .filter((t) => t.estimatedTime && t.estimatedTime >= 15)
    .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));

  const result: ProposedEvent[] = sorted.map((e) => ({
    id: e.id,
    title: e.title,
    startTime: new Date(e.startTime),
    endTime: new Date(e.endTime),
    isFixed: e.isFixed,
    color: e.color ?? undefined,
    source: e.source ?? undefined,
    sourceRef: e.sourceRef ?? undefined,
  }));

  let slotIdx = 0;
  for (const task of tasksWithTime) {
    let remaining = task.estimatedTime!;
    while (remaining > 0 && slotIdx < slots.length) {
      const slot = slots[slotIdx];
      const slotMins = Math.floor(
        (slot.end.getTime() - slot.start.getTime()) / (60 * 1000)
      );
      if (slotMins < 15) {
        slotIdx++;
        continue;
      }
      const chunk = Math.min(remaining, Math.min(slotMins, 120));
      const chunkEnd = new Date(slot.start.getTime() + chunk * 60 * 1000);
      result.push({
        title: task.title,
        startTime: new Date(slot.start),
        endTime: chunkEnd,
        isFixed: false,
        color: "#22C55E",
        source: "plan",
        sourceRef: task.id,
        taskId: task.id,
      });
      remaining -= chunk;
      slot.start = new Date(chunkEnd.getTime() + buffer * 60 * 1000);
      if (slot.start >= slot.end) slotIdx++;
    }
  }

  return result.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

function computeGaps(
  dayStart: Date,
  dayEnd: Date,
  occupied: Array<{ start: Date; end: Date }>,
  bufferMinutes: number
): Array<{ start: Date; end: Date }> {
  const gaps: Array<{ start: Date; end: Date }> = [];
  const buf = bufferMinutes * 60 * 1000;

  const merged = mergeIntervals(
    occupied.map((o) => ({
      start: o.start.getTime(),
      end: o.end.getTime(),
    }))
  );

  let cursor = dayStart.getTime();
  const endTime = dayEnd.getTime();

  for (const block of merged) {
    if (cursor < block.start && block.start - cursor >= buf) {
      gaps.push(
        { start: new Date(cursor), end: new Date(block.start) }
      );
    }
    cursor = Math.max(cursor, block.end);
  }
  if (cursor < endTime && endTime - cursor >= buf) {
    gaps.push({ start: new Date(cursor), end: new Date(endTime) });
  }

  return gaps;
}

function mergeIntervals(
  intervals: Array<{ start: number; end: number }>
): Array<{ start: number; end: number }> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const last = merged[merged.length - 1];
    if (curr.start <= last.end) {
      last.end = Math.max(last.end, curr.end);
    } else {
      merged.push(curr);
    }
  }
  return merged;
}
