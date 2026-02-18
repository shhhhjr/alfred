import type { Task } from "@prisma/client";

type Slot = {
  start: Date;
  end: Date;
};

export function distributeTaskBlocks(tasks: Task[], slots: Slot[]) {
  const plan: Array<{ taskId: string; start: Date; end: Date }> = [];
  let slotIndex = 0;

  for (const task of tasks) {
    if (!task.estimatedTime || task.estimatedTime <= 0) {
      continue;
    }

    let minutesRemaining = task.estimatedTime;
    while (minutesRemaining > 0 && slotIndex < slots.length) {
      const slot = slots[slotIndex];
      const slotMinutes = Math.max(
        0,
        Math.floor((slot.end.getTime() - slot.start.getTime()) / (1000 * 60)),
      );

      if (slotMinutes === 0) {
        slotIndex += 1;
        continue;
      }

      const chunk = Math.min(minutesRemaining, Math.min(slotMinutes, 120));
      const chunkEnd = new Date(slot.start.getTime() + chunk * 60 * 1000);
      plan.push({ taskId: task.id, start: new Date(slot.start), end: chunkEnd });

      minutesRemaining -= chunk;
      slot.start = new Date(chunkEnd);

      if (slot.start >= slot.end) {
        slotIndex += 1;
      }
    }
  }

  return plan;
}
