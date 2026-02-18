import { prisma } from "@/lib/db/prisma";

export async function computeDailyRatio(userId: string, date: Date): Promise<{
  ratio: number;
  completedTasks: number;
  productiveMinutes: number;
}> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const [tasks, snapshots] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        isCompleted: true,
        completedAt: { gte: dayStart, lte: dayEnd },
      },
      select: { estimatedTime: true },
    }),
    prisma.productivitySnapshot.findMany({
      where: { userId, createdAt: { gte: dayStart, lte: dayEnd } },
      select: { productiveMinutes: true },
    }),
  ]);

  const taskMinutes = tasks.reduce((sum, t) => sum + (t.estimatedTime ?? 0), 0);
  const snapshotMinutes = snapshots.reduce((sum, s) => sum + s.productiveMinutes, 0);
  const productiveMinutes = taskMinutes + snapshotMinutes;

  const totalTracked = 8 * 60;
  const ratio = totalTracked > 0 ? Math.min(1, productiveMinutes / totalTracked) : 0;

  return {
    ratio,
    completedTasks: tasks.length,
    productiveMinutes,
  };
}
