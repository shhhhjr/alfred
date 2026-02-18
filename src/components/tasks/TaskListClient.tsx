"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useTasks, type TaskItem } from "@/hooks/useTasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "assignment", label: "Assignment" },
  { value: "exam", label: "Exam" },
  { value: "personal", label: "Personal" },
  { value: "work", label: "Work" },
  { value: "errand", label: "Errand" },
] as const;

type GroupBy = "none" | "subject" | "category";

function getCategoryVariant(
  cat: string | null
): "exam" | "assignment" | "work" | "personal" | "errand" | "default" {
  const c = (cat ?? "personal").toLowerCase();
  if (c === "exam") return "exam";
  if (c === "assignment") return "assignment";
  if (c === "work") return "work";
  if (c === "personal") return "personal";
  if (c === "errand") return "errand";
  return "default";
}

function formatDueDate(s: string | null): string {
  if (!s) return "No due date";
  const d = new Date(s);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatEstimatedTime(mins: number | null): string {
  if (!mins) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getPriorityBorder(score: number | null): string {
  if (score == null) return "border-l-green-500/60";
  if (score > 70) return "border-l-red-500";
  if (score >= 40) return "border-l-orange-500";
  return "border-l-green-500/60";
}

type TaskFormData = {
  title: string;
  description: string;
  category: string;
  subject: string;
  dueDate: string;
  dueTime: string;
  estimatedHours: string;
  estimatedMinutes: string;
  importance: number;
};

const emptyForm: TaskFormData = {
  title: "",
  description: "",
  category: "personal",
  subject: "",
  dueDate: "",
  dueTime: "23:59",
  estimatedHours: "1",
  estimatedMinutes: "0",
  importance: 5,
};

function taskToForm(t: TaskItem | null): TaskFormData {
  if (!t) return { ...emptyForm };
  const d = t.dueDate ? new Date(t.dueDate) : null;
  const et = t.estimatedTime ?? 60;
  return {
    title: t.title,
    description: t.description ?? "",
    category: (t.category ?? "personal").toLowerCase(),
    subject: t.subject ?? "",
    dueDate: d ? d.toISOString().slice(0, 10) : "",
    dueTime: d ? d.toTimeString().slice(0, 5) : "23:59",
    estimatedHours: String(Math.floor(et / 60)),
    estimatedMinutes: String(et % 60),
    importance: t.importance ?? 5,
  };
}

function formToPayload(form: TaskFormData) {
  const due =
    form.dueDate && form.dueTime
      ? new Date(`${form.dueDate}T${form.dueTime}`).toISOString()
      : undefined;
  const mins =
    (parseInt(form.estimatedHours, 10) || 0) * 60 +
    (parseInt(form.estimatedMinutes, 10) || 0);
  const estimatedTime = mins >= 15 ? mins : 60;
  return {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    category: form.category || undefined,
    subject: form.subject.trim() || undefined,
    dueDate: due,
    estimatedTime,
    importance: Math.min(10, Math.max(1, form.importance)),
  };
}

function TaskCard({
  task,
  onComplete,
  onEdit,
}: {
  task: TaskItem;
  onComplete: (id: string, completed: boolean) => void;
  onEdit: (task: TaskItem) => void;
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer border-l-4 p-3 transition-all hover:border-zinc-600",
        getPriorityBorder(task.priorityScore),
        task.isCompleted && "opacity-60"
      )}
      onClick={() => onEdit(task)}
    >
      <div className="flex items-start gap-3">
        <div
          role="button"
          tabIndex={0}
          aria-label={task.isCompleted ? "Mark incomplete" : "Complete task"}
          title={task.isCompleted ? "Click to mark incomplete" : "Click to complete"}
          onClick={(e) => {
            e.stopPropagation();
            onComplete(task.id, task.isCompleted);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onComplete(task.id, task.isCompleted);
            }
          }}
          className="-m-1 shrink-0 cursor-pointer rounded p-1 hover:bg-zinc-800/50"
        >
          <input
            type="checkbox"
            checked={task.isCompleted}
            readOnly
            tabIndex={-1}
            aria-hidden
            className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-[#6C63FF] pointer-events-none"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{task.title}</span>
            <Badge variant={getCategoryVariant(task.category)}>
              {(task.category ?? "personal").charAt(0).toUpperCase() +
                (task.category ?? "personal").slice(1)}
            </Badge>
            {task.subject && (
              <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                {task.subject}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
            {task.dueDate && (
              <span>Due: {formatDueDate(task.dueDate)}</span>
            )}
            {task.estimatedTime != null && (
              <span>{formatEstimatedTime(task.estimatedTime)}</span>
            )}
            <span className="flex items-center gap-1">
              Importance:{" "}
              {Array.from({ length: 10 }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    i < (task.importance ?? 5)
                      ? "bg-[#6C63FF]"
                      : "bg-zinc-600"
                  )}
                />
              ))}
            </span>
          </div>
          {task.isCompleted && task.completedAt && (
            <p className="mt-1 text-xs text-zinc-500">
              Completed: {formatDueDate(task.completedAt)}
            </p>
          )}
        </div>
        <Link
          href={`/calendar?title=${encodeURIComponent(task.title)}&minutes=${task.estimatedTime ?? 60}`}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-[#6C63FF] hover:text-[#6C63FF]"
        >
          Schedule
        </Link>
      </div>
    </Card>
  );
}

export function TaskListClient() {
  type TaskFiltersState = {
    categories: string[];
    subject: string;
    showCompleted: boolean;
    startDate: string;
    endDate: string;
  };

  const [filters, setFilters] = useState<TaskFiltersState>({
    categories: [],
    subject: "",
    showCompleted: true,
    startDate: "",
    endDate: "",
  });
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<TaskFormData>(emptyForm);
  const apiFilters = useMemo(
    () => ({
      categories:
        filters.categories.length > 0 ? filters.categories : undefined,
      subject: filters.subject || undefined,
      completed: filters.showCompleted ? undefined : false,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
    }),
    [
      filters.categories,
      filters.subject,
      filters.showCompleted,
      filters.startDate,
      filters.endDate,
    ]
  );

  const { tasks, setTasks, isLoading, refetch } = useTasks(apiFilters);

  const subjects = useMemo(
    () => [...new Set(tasks.map((t) => t.subject).filter(Boolean))] as string[],
    [tasks]
  );

  const toggleCategory = useCallback((cat: string) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  }, []);

  const grouped = useMemo(() => {
    if (groupBy === "none") {
      return [{ key: "all", label: "All", tasks }];
    }
    const map = new Map<string, TaskItem[]>();
    for (const t of tasks) {
      const key =
        groupBy === "subject"
          ? t.subject || "No subject"
          : (t.category ?? "personal");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).map(([key, tasks]) => ({
      key,
      label: key,
      tasks,
    }));
  }, [tasks, groupBy]);

  const openCreate = useCallback(() => {
    setForm(emptyForm);
    setEditingTask(null);
    setIsCreateOpen(true);
  }, []);

  const openEdit = useCallback((task: TaskItem) => {
    setForm(taskToForm(task));
    setEditingTask(task);
    setIsCreateOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsCreateOpen(false);
    setEditingTask(null);
  }, []);

  const submitForm = useCallback(async () => {
    const payload = formToPayload(form);
    if (!payload.title) return;

    if (editingTask) {
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;
    } else {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;
    }
    closeModal();
    await refetch();
  }, [form, editingTask, closeModal, refetch]);

  const deleteTask = useCallback(async () => {
    if (!editingTask) return;
    await fetch(`/api/tasks/${editingTask.id}`, { method: "DELETE" });
    closeModal();
    await refetch();
  }, [editingTask, closeModal, refetch]);

  const completeTask = useCallback(
    async (id: string, isCompleted: boolean) => {
      const nextCompleted = !isCompleted;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                isCompleted: nextCompleted,
                completedAt: nextCompleted ? new Date().toISOString() : null,
              }
            : t
        )
      );
      try {
        const res = await fetch(`/api/tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isCompleted: nextCompleted }),
        });
        if (!res.ok) await refetch();
      } catch {
        await refetch();
      }
    },
    [setTasks, refetch]
  );

  const activeTasks = useMemo(
    () => [...tasks].sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0)),
    [tasks]
  );
  const completedTasks = useMemo(
    () => activeTasks.filter((t) => t.isCompleted),
    [activeTasks]
  );
  const incompleteTasks = useMemo(
    () => activeTasks.filter((t) => !t.isCompleted),
    [activeTasks]
  );

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="mb-4 text-lg font-semibold">Filters</h2>
        <div className="flex flex-wrap gap-4">
          <div>
            <span className="mr-2 text-sm text-zinc-400">Category:</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {CATEGORIES.map((c) => {
                const selected = filters.categories.includes(c.value);
                return (
                  <Badge
                    key={c.value}
                    variant={getCategoryVariant(c.value)}
                    className={cn(
                      "cursor-pointer",
                      selected && "ring-2 ring-[#6C63FF] ring-offset-2 ring-offset-[#0A0A0F]"
                    )}
                    onClick={() => toggleCategory(c.value)}
                  >
                    {c.label} {selected ? "✓" : ""}
                  </Badge>
                );
              })}
            </div>
          </div>

          <div>
            <span className="mr-2 text-sm text-zinc-400">Subject:</span>
            <Select
              value={filters.subject || "all"}
              onValueChange={(v) =>
                setFilters((p) => ({ ...p, subject: v === "all" ? "" : v }))
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s} value={s!}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <span className="mr-2 text-sm text-zinc-400">Due from:</span>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters((p) => ({ ...p, startDate: e.target.value }))
              }
              className="w-[140px]"
            />
          </div>
          <div>
            <span className="mr-2 text-sm text-zinc-400">Due to:</span>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                setFilters((p) => ({ ...p, endDate: e.target.value }))
              }
              className="w-[140px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="show-completed"
              checked={filters.showCompleted}
              onCheckedChange={(v) =>
                setFilters((p) => ({ ...p, showCompleted: v }))
              }
            />
            <label htmlFor="show-completed" className="text-sm text-zinc-400">
              Show completed
            </label>
          </div>

          <div>
            <span className="mr-2 text-sm text-zinc-400">Group by:</span>
            <Select
              value={groupBy}
              onValueChange={(v: GroupBy) => setGroupBy(v)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="subject">Subject</SelectItem>
                <SelectItem value="category">Category</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="flex justify-between">
        <h2 className="text-lg font-semibold">Tasks</h2>
        <Button onClick={openCreate}>Create task</Button>
      </div>

      <ScrollArea className="h-[calc(100vh-280px)]">
        {isLoading ? (
          <Card className="p-4 text-sm text-zinc-400">Loading tasks...</Card>
        ) : tasks.length === 0 ? (
          <Card className="p-4 text-sm text-zinc-400">No tasks, sir. Enjoy the calm.</Card>
        ) : (
          <div className="space-y-6 pr-4">
            {groupBy === "none" ? (
              <>
                <div className="space-y-2">
                  {incompleteTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onComplete={completeTask}
                      onEdit={openEdit}
                    />
                  ))}
                </div>
                {completedTasks.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-zinc-500">
                      Completed ({completedTasks.length})
                    </h3>
                    {completedTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onComplete={completeTask}
                        onEdit={openEdit}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              grouped.map(({ key, label, tasks: sectionTasks }) => (
                <div key={key} className="space-y-2">
                  <h3 className="text-sm font-medium text-zinc-400">
                    {label} ({sectionTasks.length})
                  </h3>
                  <div className="space-y-2">
                    {sectionTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onComplete={completeTask}
                        onEdit={openEdit}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </ScrollArea>

      <Dialog open={isCreateOpen} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? "Edit task" : "Create task"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitForm();
            }}
          >
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Title</label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
                placeholder="Task title"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                rows={2}
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Category</label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, category: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Subject</label>
              <Input
                value={form.subject}
                onChange={(e) =>
                  setForm((p) => ({ ...p, subject: e.target.value }))
                }
                placeholder="e.g. CS 101"
                list="subjects-list"
              />
              <datalist id="subjects-list">
                {subjects.map((s) => (
                  <option key={s} value={s!} />
                ))}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-zinc-400">
                  Due date
                </label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, dueDate: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Time</label>
                <Input
                  type="time"
                  value={form.dueTime}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, dueTime: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-zinc-400">
                  Est. hours
                </label>
                <Input
                  type="number"
                  min={0}
                  value={form.estimatedHours}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, estimatedHours: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">
                  Est. minutes
                </label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={form.estimatedMinutes}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      estimatedMinutes: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">
                Importance: {form.importance}
              </label>
              <Slider
                value={[form.importance]}
                onValueChange={([v]) =>
                  setForm((p) => ({ ...p, importance: v ?? 5 }))
                }
                min={1}
                max={10}
                step={1}
              />
            </div>
            <div className="flex justify-between gap-2">
              <div>
                {editingTask && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-red-400 hover:bg-red-900/20 hover:text-red-300"
                    onClick={deleteTask}
                  >
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingTask ? "Save" : "Create"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
