import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { calculateTravelTime, normalizeTravelMode } from "@/lib/calendar/travel";
import { deleteTravelBlockForEvent, upsertTravelBlock } from "@/lib/calendar/travel-blocks";
import { calculateTaskPriority } from "@/lib/tasks/prioritizer";
import { planDay } from "@/lib/calendar/scheduler";

export function createAlfredTools(userId: string) {
  return {
    getCalendarEvents: tool({
      description:
        "Fetch the user's calendar events for a date range. Call this BEFORE creating events to check for conflicts and find open slots. Use ISO date strings for startDate and endDate (e.g. 2025-02-14).",
      inputSchema: z.object({
        startDate: z.string().describe("Start of range, ISO date (YYYY-MM-DD)"),
        endDate: z.string().describe("End of range, ISO date (YYYY-MM-DD)"),
      }),
      execute: async ({ startDate, endDate }) => {
        const events = await prisma.calendarEvent.findMany({
          where: {
            userId,
            startTime: { gte: new Date(startDate), lte: new Date(endDate + "T23:59:59") },
          },
          orderBy: { startTime: "asc" },
        });
        return {
          events: events.map((e) => ({
            id: e.id,
            title: e.title,
            startTime: e.startTime.toISOString(),
            endTime: e.endTime.toISOString(),
            isFixed: e.isFixed,
            source: e.source,
          })),
          count: events.length,
        };
      },
    }),

    createCalendarEvent: tool({
      description:
        "Create a calendar event. ALWAYS call getCalendarEvents first for the target day to check conflicts. Use ISO 8601 datetime strings for startTime and endTime (e.g. 2025-02-14T14:00:00).",
      inputSchema: z.object({
        title: z.string().min(1).max(160),
        description: z.string().max(2000).optional(),
        location: z.string().max(200).optional(),
        startTime: z.string().describe("ISO 8601 datetime"),
        endTime: z.string().describe("ISO 8601 datetime"),
        isFixed: z.boolean().default(true),
        color: z.string().max(20).optional().describe("Hex color code like #3B82F6 for work events, #8B5CF6 for personal, #F59E0B for urgent"),
      }),
      execute: async (input) => {
        const startTime = new Date(input.startTime);
        const endTime = new Date(input.endTime);
        if (endTime <= startTime) {
          return { success: false, error: "endTime must be after startTime" };
        }
        const dayStart = new Date(startTime);
        dayStart.setHours(0, 0, 0, 0);
        const [previousEvent, user, prefs] = await Promise.all([
          prisma.calendarEvent.findFirst({
            where: {
              userId,
              endTime: { gte: dayStart, lte: startTime },
              source: { not: "travel" },
              location: { not: null },
            },
            orderBy: { endTime: "desc" },
          }),
          prisma.user.findUnique({ where: { id: userId }, select: { homeAddress: true } }),
          prisma.userPreference.findUnique({
            where: { userId },
            select: { travelMode: true },
          }),
        ]);
        const origin = previousEvent?.location ?? user?.homeAddress ?? null;
        const destination = input.location ?? null;
        const mode = normalizeTravelMode(prefs?.travelMode ?? "drive");
        const travelResult =
          origin && destination ? await calculateTravelTime(origin, destination, mode) : null;
        const travelTime = travelResult?.durationMinutes ?? null;
        const event = await prisma.calendarEvent.create({
          data: {
            userId,
            title: input.title,
            description: input.description,
            location: input.location,
            startTime,
            endTime,
            isFixed: input.isFixed,
            color: input.color ?? (input.isFixed ? "#3B82F6" : "#22C55E"),
            travelTime,
            source: "chat",
          },
        });
        if (travelTime && origin && destination) {
          await upsertTravelBlock(
            userId,
            event.id,
            event.title,
            event.startTime,
            origin,
            destination,
            mode
          );
        }
        const timeRange = `${startTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}–${endTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
        const dateStr = startTime.toLocaleString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        let displayText = `Added "${event.title}" to calendar — ${dateStr} ${timeRange}`;
        if (event.location) displayText += ` at ${event.location}`;
        if (travelTime && origin && destination) {
          displayText += `. I've added a ${travelResult!.durationText} travel block before it from ${origin}.`;
        } else {
          displayText += ".";
        }
        return {
          success: true,
          action: "created",
          event: {
            id: event.id,
            title: event.title,
            startTime: event.startTime.toISOString(),
            endTime: event.endTime.toISOString(),
            travelTime: event.travelTime,
            location: event.location,
          },
          displayText,
        };
      },
    }),

    updateCalendarEvent: tool({
      description: "Update an existing calendar event. Requires the event ID.",
      inputSchema: z.object({
        eventId: z.string(),
        title: z.string().min(1).max(160).optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        location: z.string().max(200).optional(),
      }),
      execute: async (input) => {
        const existing = await prisma.calendarEvent.findFirst({
          where: { id: input.eventId, userId },
        });
        if (!existing) return { success: false, error: "Event not found" };
        if (existing.source === "travel") return { success: false, error: "Cannot edit travel blocks" };
        const data: Record<string, unknown> = {};
        if (input.title) data.title = input.title;
        if (input.startTime) data.startTime = new Date(input.startTime);
        if (input.endTime) data.endTime = new Date(input.endTime);
        if (input.location !== undefined) data.location = input.location;
        const event = await prisma.calendarEvent.update({
          where: { id: input.eventId },
          data,
        });
        const timeOrLocationChanged =
          input.startTime !== undefined ||
          input.endTime !== undefined ||
          input.location !== undefined;
        const newLocation = (input.location ?? existing.location) as string | null;
        if (timeOrLocationChanged) {
          await deleteTravelBlockForEvent(userId, input.eventId);
        }
        if (timeOrLocationChanged && newLocation) {
          const dayStart = new Date(event.startTime);
          dayStart.setHours(0, 0, 0, 0);
          const [previousEvent, user, prefs] = await Promise.all([
            prisma.calendarEvent.findFirst({
              where: {
                userId,
                id: { not: input.eventId },
                endTime: { gte: dayStart, lte: event.startTime },
                source: { not: "travel" },
                location: { not: null },
              },
              orderBy: { endTime: "desc" },
            }),
            prisma.user.findUnique({ where: { id: userId }, select: { homeAddress: true } }),
            prisma.userPreference.findUnique({
              where: { userId },
              select: { travelMode: true },
            }),
          ]);
          const origin = previousEvent?.location ?? user?.homeAddress ?? null;
          const mode = normalizeTravelMode(prefs?.travelMode ?? "drive");
          const travelResult =
            origin && newLocation ? await calculateTravelTime(origin, newLocation, mode) : null;
          const travelTime = travelResult?.durationMinutes ?? null;
          await prisma.calendarEvent.update({
            where: { id: input.eventId },
            data: { travelTime },
          });
          if (travelTime && origin && newLocation) {
            await upsertTravelBlock(
              userId,
              event.id,
              event.title,
              event.startTime,
              origin,
              newLocation,
              mode
            );
          }
        } else if (timeOrLocationChanged && !newLocation) {
          await prisma.calendarEvent.update({
            where: { id: input.eventId },
            data: { travelTime: null },
          });
        }
        return {
          success: true,
          action: "updated",
          event: {
            id: event.id,
            title: event.title,
            startTime: event.startTime.toISOString(),
            endTime: event.endTime.toISOString(),
          },
          displayText: `Updated "${event.title}"`,
        };
      },
    }),

    deleteCalendarEvent: tool({
      description: "Delete a calendar event. Requires the event ID.",
      inputSchema: z.object({ eventId: z.string() }),
      execute: async ({ eventId }) => {
        const existing = await prisma.calendarEvent.findFirst({
          where: { id: eventId, userId },
        });
        if (!existing) return { success: false, error: "Event not found" };
        const { deleteTravelBlockForEvent } = await import("@/lib/calendar/travel-blocks");
        if (existing.source !== "travel") {
          await deleteTravelBlockForEvent(userId, eventId);
        }
        await prisma.calendarEvent.delete({ where: { id: eventId } });
        return {
          success: true,
          action: "deleted",
          displayText: `Removed "${existing.title}" from calendar`,
        };
      },
    }),

    createTasks: tool({
      description:
        "Create multiple tasks at once. Use this when the user asks to add several tasks (e.g. 'add these 3 tasks', 'add tasks: 1) X 2) Y 3) Z'). Call ONCE with the full array of tasks — never omit any task.",
      inputSchema: z.object({
        tasks: z.array(
          z.object({
            title: z.string().min(1).max(150),
            description: z.string().max(2000).optional(),
            category: z.string().max(40).optional(),
            subject: z.string().max(100).optional(),
            topicName: z.string().max(80).optional().describe("Name of the task topic/category for color-coding"),
            dueDate: z.string().optional(),
            estimatedTime: z.number().int().min(15).max(1440).optional(),
            importance: z.number().int().min(1).max(10).default(5),
          })
        ).min(1).max(20),
      }),
      execute: async ({ tasks: inputs }) => {
        const results: Array<{ id: string; title: string; dueDate: string | null }> = [];
        for (const input of inputs) {
          const dueDate = input.dueDate ? new Date(input.dueDate) : null;
          const priorityScore = calculateTaskPriority({
            dueDate,
            estimatedTime: input.estimatedTime ?? null,
            importance: input.importance ?? 5,
            category: input.category ?? null,
          });
          let topicId: string | undefined;
          if (input.topicName) {
            const topic = await prisma.taskTopic.findFirst({
              where: { userId, name: { equals: input.topicName, mode: "insensitive" } },
            });
            if (topic) topicId = topic.id;
          }
          const task = await prisma.task.create({
            data: {
              userId,
              title: input.title,
              description: input.description,
              category: input.category,
              subject: input.subject,
              dueDate,
              estimatedTime: input.estimatedTime ?? null,
              importance: input.importance ?? 5,
              priorityScore,
              source: "chat",
              ...(topicId ? { topicId } : {}),
            },
          });
          results.push({
            id: task.id,
            title: task.title,
            dueDate: task.dueDate?.toISOString() ?? null,
          });
        }
        return {
          success: true,
          action: "created",
          tasks: results,
          count: results.length,
          displayText: `Added ${results.length} task(s): ${results.map((t) => t.title).join(", ")}`,
        };
      },
    }),

    createTask: tool({
      description:
        "Create a single task. For multiple tasks, use createTasks instead so all tasks are added in one call.",
      inputSchema: z.object({
        title: z.string().min(1).max(150),
        description: z.string().max(2000).optional(),
        category: z.string().max(40).optional(),
        subject: z.string().max(100).optional(),
        topicName: z.string().max(80).optional().describe("Name of the task topic/category for color-coding"),
        dueDate: z.string().optional(),
        estimatedTime: z.number().int().min(15).max(1440).optional(),
        importance: z.number().int().min(1).max(10).default(5),
      }),
      execute: async (input) => {
        const dueDate = input.dueDate ? new Date(input.dueDate) : null;
        const priorityScore = calculateTaskPriority({
          dueDate,
          estimatedTime: input.estimatedTime ?? null,
          importance: input.importance ?? 5,
          category: input.category ?? null,
        });
        let topicId: string | undefined;
        if (input.topicName) {
          const topic = await prisma.taskTopic.findFirst({
            where: { userId, name: { equals: input.topicName, mode: "insensitive" } },
          });
          if (topic) topicId = topic.id;
        }
        const task = await prisma.task.create({
          data: {
            userId,
            title: input.title,
            description: input.description,
            category: input.category,
            subject: input.subject,
            dueDate,
            estimatedTime: input.estimatedTime ?? null,
            importance: input.importance ?? 5,
            priorityScore,
            source: "chat",
            ...(topicId ? { topicId } : {}),
          },
        });
        return {
          success: true,
          action: "created",
          task: {
            id: task.id,
            title: task.title,
            dueDate: task.dueDate?.toISOString(),
            priorityScore: task.priorityScore,
          },
          displayText: `Added task "${task.title}"`,
        };
      },
    }),

    updateTask: tool({
      description: "Update an existing task.",
      inputSchema: z.object({
        taskId: z.string(),
        title: z.string().min(1).max(150).optional(),
        dueDate: z.string().nullable().optional(),
        importance: z.number().int().min(1).max(10).optional(),
        isCompleted: z.boolean().optional(),
      }),
      execute: async (input) => {
        const existing = await prisma.task.findFirst({
          where: { id: input.taskId, userId },
        });
        if (!existing) return { success: false, error: "Task not found" };
        const dueDate = input.dueDate !== undefined
          ? (input.dueDate ? new Date(input.dueDate) : null)
          : existing.dueDate;
        const importance = input.importance ?? existing.importance;
        const priorityScore = calculateTaskPriority({
          dueDate,
          estimatedTime: existing.estimatedTime,
          importance,
          category: existing.category,
        });
        const updateData: Record<string, unknown> = { priorityScore };
        if (input.title) updateData.title = input.title;
        if (input.dueDate !== undefined) updateData.dueDate = dueDate;
        if (input.importance !== undefined) updateData.importance = input.importance;
        if (input.isCompleted !== undefined) {
          updateData.isCompleted = input.isCompleted;
          updateData.completedAt = input.isCompleted ? new Date() : null;
        }
        const task = await prisma.task.update({
          where: { id: input.taskId },
          data: updateData,
        });
        return {
          success: true,
          action: "updated",
          displayText: `Updated task "${task.title}"`,
        };
      },
    }),

    completeTask: tool({
      description: "Mark a task as completed.",
      inputSchema: z.object({ taskId: z.string() }),
      execute: async ({ taskId }) => {
        const existing = await prisma.task.findFirst({
          where: { id: taskId, userId },
        });
        if (!existing) return { success: false, error: "Task not found" };
        const task = await prisma.task.update({
          where: { id: taskId },
          data: { isCompleted: true, completedAt: new Date() },
        });
        return {
          success: true,
          action: "completed",
          displayText: `Marked "${task.title}" as done`,
        };
      },
    }),

    getTasks: tool({
      description: "Fetch the user's tasks. Use to reference tasks before updating or completing.",
      inputSchema: z.object({
        completed: z.boolean().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async (input) => {
        const tasks = await prisma.task.findMany({
          where: {
            userId,
            ...(input.completed !== undefined ? { isCompleted: input.completed } : {}),
          },
          orderBy: [{ isCompleted: "asc" }, { priorityScore: "desc" }],
          take: input.limit ?? 20,
        });
        return {
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            isCompleted: t.isCompleted,
            dueDate: t.dueDate?.toISOString(),
            priorityScore: t.priorityScore,
          })),
          count: tasks.length,
        };
      },
    }),

    getLeadGenEntries: tool({
      description: "Fetch the user's lead gen entries (prospects). Optionally filter by stage (e.g. new, contacted, qualified, proposal, closed).",
      inputSchema: z.object({
        stage: z.string().max(40).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      execute: async (input) => {
        const entries = await prisma.leadGenEntry.findMany({
          where: {
            userId,
            ...(input.stage ? { stage: input.stage } : {}),
          },
          orderBy: [{ stage: "asc" }, { nextFollowUp: "asc" }],
          take: input.limit ?? 30,
        });
        return {
          entries: entries.map((e) => ({
            id: e.id,
            prospect: e.prospect,
            company: e.company,
            channel: e.channel,
            stage: e.stage,
            nextFollowUp: e.nextFollowUp?.toISOString(),
            notes: e.notes,
          })),
          count: entries.length,
        };
      },
    }),

    createLeadGenEntry: tool({
      description:
        "Add a lead/prospect to the lead generation tracker. Use when the user wants to track a sales lead, prospect, or contact.",
      inputSchema: z.object({
        prospect: z.string().min(1).max(120).describe("Name of the prospect/contact"),
        company: z.string().min(1).max(120).describe("Company name"),
        channel: z.string().max(80).optional().describe("How you reached them: LinkedIn, email, cold call, etc."),
        stage: z.string().max(40).optional().default("new").describe("Pipeline stage: new, contacted, qualified, proposal, closed"),
        nextFollowUp: z.string().optional().describe("ISO 8601 datetime for when to follow up"),
        notes: z.string().max(1000).optional(),
      }),
      execute: async (input) => {
        const entry = await prisma.leadGenEntry.create({
          data: {
            userId,
            prospect: input.prospect.trim(),
            company: input.company.trim(),
            channel: input.channel?.trim() ?? null,
            stage: input.stage?.trim() ?? "new",
            nextFollowUp: input.nextFollowUp ? new Date(input.nextFollowUp) : null,
            notes: input.notes?.trim() ?? null,
          },
        });
        let displayText = `Added "${entry.prospect}" at ${entry.company} to lead gen`;
        if (entry.channel) displayText += ` (via ${entry.channel})`;
        displayText += ".";
        if (entry.nextFollowUp) {
          displayText += ` Follow-up set for ${entry.nextFollowUp.toLocaleDateString()}.`;
        }
        return {
          success: true,
          action: "created",
          entry: {
            id: entry.id,
            prospect: entry.prospect,
            company: entry.company,
            stage: entry.stage,
          },
          displayText,
        };
      },
    }),

    updateLeadGenEntry: tool({
      description: "Update an existing lead (stage, follow-up date, notes). Requires the lead ID.",
      inputSchema: z.object({
        leadId: z.string(),
        stage: z.string().max(40).optional(),
        nextFollowUp: z.string().nullable().optional().describe("ISO 8601 datetime or null to clear"),
        notes: z.string().max(1000).optional(),
      }),
      execute: async (input) => {
        const existing = await prisma.leadGenEntry.findFirst({
          where: { id: input.leadId, userId },
        });
        if (!existing) return { success: false, error: "Lead not found" };
        const data: Record<string, unknown> = {};
        if (input.stage) data.stage = input.stage;
        if (input.nextFollowUp !== undefined) {
          data.nextFollowUp = input.nextFollowUp ? new Date(input.nextFollowUp) : null;
        }
        if (input.notes !== undefined) data.notes = input.notes;
        const entry = await prisma.leadGenEntry.update({
          where: { id: input.leadId },
          data,
        });
        return {
          success: true,
          action: "updated",
          displayText: `Updated lead "${entry.prospect}"`,
        };
      },
    }),

    getDayPlan: tool({
      description: "Generate a day plan (suggested schedule with tasks in open slots). Use ISO date (YYYY-MM-DD).",
      inputSchema: z.object({
        date: z.string().describe("ISO date YYYY-MM-DD"),
      }),
      execute: async ({ date }) => {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        const dayStart = new Date(targetDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(targetDate);
        dayEnd.setHours(23, 59, 59, 999);
        const [events, tasks, prefs] = await Promise.all([
          prisma.calendarEvent.findMany({
            where: {
              userId,
              startTime: { gte: dayStart, lte: dayEnd },
            },
            orderBy: { startTime: "asc" },
          }),
          prisma.task.findMany({
            where: { userId, isCompleted: false },
            orderBy: [{ priorityScore: "desc" }, { dueDate: "asc" }],
          }),
          prisma.userPreference.findUnique({
            where: { userId },
            select: { workHoursStart: true, workHoursEnd: true, breakMinutes: true },
          }),
        ]);
        const userPrefs = {
          workHoursStart: prefs?.workHoursStart ?? 9,
          workHoursEnd: prefs?.workHoursEnd ?? 17,
          breakMinutes: prefs?.breakMinutes ?? 15,
          bufferMinutes: 15,
        };
        const proposed = planDay(targetDate, events, tasks, userPrefs);
        return {
          date: targetDate.toISOString().slice(0, 10),
          schedule: proposed.map((p) => ({
            title: p.title,
            startTime: p.startTime.toISOString(),
            endTime: p.endTime.toISOString(),
            isFixed: p.isFixed,
          })),
          displayText: `Generated plan for ${targetDate.toLocaleDateString()} with ${proposed.filter((p) => !p.id).length} proposed blocks`,
        };
      },
    }),
  };
}
