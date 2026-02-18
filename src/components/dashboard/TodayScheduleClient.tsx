"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ScheduleItem = {
  id?: string;
  title: string;
  startTime: string;
  endTime: string;
  isFixed?: boolean;
  color?: string;
  source?: string;
};

type TodayScheduleClientProps = {
  events: Array<{
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    travelTime?: number | null;
    source?: string | null;
    color?: string | null;
  }>;
};

export function TodayScheduleClient({ events: initialEvents }: TodayScheduleClientProps) {
  const events = initialEvents;
  const [planOpen, setPlanOpen] = useState(false);
  const [planSchedule, setPlanSchedule] = useState<ScheduleItem[]>([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [acceptLoading, setAcceptLoading] = useState(false);


  const handlePlanMyDay = useCallback(async () => {
    setPlanLoading(true);
    setPlanOpen(true);
    try {
      const res = await fetch("/api/calendar/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: new Date().toISOString().slice(0, 10) }),
      });
      const data = await res.json();
      setPlanSchedule(data.schedule ?? []);
    } catch {
      setPlanSchedule([]);
    } finally {
      setPlanLoading(false);
    }
  }, []);

  const handleAcceptPlan = useCallback(async () => {
    const proposed = planSchedule.filter((s) => !s.id);
    if (proposed.length === 0) {
      setPlanOpen(false);
      return;
    }
    setAcceptLoading(true);
    try {
      await fetch("/api/calendar/plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposed }),
      });
      setPlanOpen(false);
      window.location.reload();
    } finally {
      setAcceptLoading(false);
    }
  }, [planSchedule]);

  const displayEvents = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Today&apos;s Schedule</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePlanMyDay}
            className="shrink-0"
          >
            Plan My Day
          </Button>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          {displayEvents.length === 0 ? (
            <p className="text-zinc-400">No events today.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {displayEvents.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    "rounded-md p-2",
                    event.source === "travel"
                      ? "bg-zinc-800/80"
                      : "bg-zinc-900"
                  )}
                  style={
                    event.source === "travel"
                      ? undefined
                      : { borderLeft: `3px solid ${event.color ?? "#3B82F6"}` }
                  }
                >
                  <p className="font-medium">{event.title}</p>
                  <p className="text-zinc-400">
                    {new Date(event.startTime).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    -{" "}
                    {new Date(event.endTime).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {event.travelTime ? ` • travel ${event.travelTime} min` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Plan My Day</DialogTitle>
          </DialogHeader>
          {planLoading ? (
            <p className="py-8 text-center text-zinc-400">Generating plan…</p>
          ) : planSchedule.length === 0 ? (
            <p className="py-4 text-zinc-400">
              No events or tasks to schedule for today.
            </p>
          ) : (
            <>
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-2 pr-4">
                  {planSchedule.map((item, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-md p-2",
                        item.source === "travel"
                          ? "bg-zinc-800/80"
                          : item.isFixed
                            ? "bg-zinc-900"
                            : "bg-green-900/20"
                      )}
                      style={
                        item.source === "travel"
                          ? undefined
                          : {
                              borderLeft: `3px solid ${item.color ?? (item.isFixed ? "#3B82F6" : "#22C55E")}`,
                            }
                      }
                    >
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-zinc-400">
                        {new Date(item.startTime).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        -{" "}
                        {new Date(item.endTime).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {!item.id && " (proposed)"}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {planSchedule.some((s) => !s.id) && (
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setPlanOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAcceptPlan} disabled={acceptLoading}>
                    {acceptLoading ? "Saving…" : "Looks good"}
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
