"use client";

import { useCallback, useEffect, useState } from "react";

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  subject: string | null;
  dueDate: string | null;
  estimatedTime: number | null;
  importance: number;
  priorityScore: number | null;
  isCompleted: boolean;
  completedAt: string | null;
  topicId?: string | null;
  topic?: { id: string; name: string; color?: string | null } | null;
};

export type TaskFilters = {
  categories?: string[];
  subject?: string;
  completed?: boolean;
  startDate?: string;
  endDate?: string;
};

export function useTasks(filters?: TaskFilters) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [topics, setTopics] = useState<Array<{ id: string; name: string; color?: string | null }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const cats = filters?.categories ?? [];
  const catsKey = cats.join(",");
  const subj = filters?.subject ?? "";
  const compl = filters?.completed;
  const start = filters?.startDate ?? "";
  const end = filters?.endDate ?? "";

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (cats.length > 0) {
      cats.forEach((c) => params.append("category", c));
    }
    if (subj !== "") {
      params.set("subject", subj);
    }
    if (compl !== undefined) {
      params.set("completed", String(compl));
    }
    if (start) params.set("startDate", start);
    if (end) params.set("endDate", end);
    const qs = params.toString();
    const url = qs ? `/api/tasks?${qs}` : "/api/tasks";
    const response = await fetch(url, { cache: "no-store" });
    const payload = (await response.json()) as {
      tasks?: TaskItem[];
      topics?: Array<{ id: string; name: string; color?: string | null }>;
    };
    setTasks(payload.tasks ?? []);
    setTopics(payload.topics ?? []);
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- catsKey encodes cats
  }, [catsKey, subj, compl, start, end]);

  useEffect(() => {
    fetchTasks().catch(() => setIsLoading(false));
  }, [fetchTasks]);

  return { tasks, topics, setTasks, isLoading, refetch: fetchTasks };
}
