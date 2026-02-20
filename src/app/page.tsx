import { AppShell } from "@/components/layout/AppShell";
import { TodayScheduleClient } from "@/components/dashboard/TodayScheduleClient";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { Card } from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth/session";
import { getWalletBalance } from "@/lib/rangs/earn";
import { computeDailyRatio } from "@/lib/social/productivity";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function HomePage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const userId = session.user.id;
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const streakWindowStart = new Date(now);
  streakWindowStart.setDate(streakWindowStart.getDate() - 13);
  streakWindowStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);

  const [activity, todayEvents, urgentTasks, topTasks, unreadEmails, jobs, rangs, weeklyTasks, weeklySnapshots, socialSettings] =
    await Promise.all([
      prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.calendarEvent.findMany({
        where: {
          userId,
          startTime: { gte: todayStart, lte: todayEnd },
        },
        orderBy: { startTime: "asc" },
        take: 8,
      }),
      prisma.task.findMany({
        where: {
          userId,
          isCompleted: false,
          dueDate: { lte: next48h },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
      }),
      prisma.task.findMany({
        where: { userId, isCompleted: false },
        orderBy: [{ priorityScore: "desc" }, { dueDate: "asc" }],
        take: 5,
      }),
      prisma.emailMessage.findMany({
        where: {
          userId,
          importance: { in: ["high", "medium"] },
          receivedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
        orderBy: [{ importance: "desc" }, { receivedAt: "desc" }],
        select: {
          id: true,
          subject: true,
          fromAddress: true,
          importance: true,
          receivedAt: true,
          aiSummary: true,
          isRead: true,
        },
        take: 5,
      }),
      prisma.job.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      getWalletBalance(userId),
      prisma.task.findMany({
        where: {
          userId,
          isCompleted: true,
          completedAt: { gte: streakWindowStart },
        },
        select: { completedAt: true, estimatedTime: true },
      }),
      prisma.productivitySnapshot.findMany({
        where: {
          userId,
          createdAt: { gte: streakWindowStart },
        },
        select: { createdAt: true, productiveMinutes: true },
      }),
      prisma.socialSettings.findUnique({
        where: { userId },
      }),
    ]);

  const preferences = await prisma.userPreference.findUnique({ where: { userId } });

  // Morning briefing: create digest notification if notifMorningBrief is on and not yet sent today
  const todayKey = now.toISOString().slice(0, 10);
  if (
    preferences?.notifMorningBrief &&
    now.getHours() >= (preferences.notifMorningHour ?? 8) &&
    preferences.lastBriefingDate !== todayKey
  ) {
    // Fire and forget — don't block the page
    fetch(`${process.env.NEXTAUTH_URL ?? ""}/api/notifications/digest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});
  }

  const todayStats = await computeDailyRatio(userId, now);

  const byDay = new Map<string, { minutes: number }>();
  for (const task of weeklyTasks) {
    const key = task.completedAt!.toISOString().slice(0, 10);
    const row = byDay.get(key) ?? { minutes: 0 };
    row.minutes += task.estimatedTime ?? 0;
    byDay.set(key, row);
  }
  for (const snap of weeklySnapshots) {
    const key = snap.createdAt.toISOString().slice(0, 10);
    const row = byDay.get(key) ?? { minutes: 0 };
    row.minutes += snap.productiveMinutes;
    byDay.set(key, row);
  }

  const weeklyGoalMinutes = 600;
  const weekKeyStart = weekStart.toISOString().slice(0, 10);
  let weeklyMinutes = 0;
  for (const [key, row] of byDay.entries()) {
    if (key >= weekKeyStart) {
      weeklyMinutes += row.minutes;
    }
  }
  const weeklyProgress = Math.min(1, weeklyMinutes / weeklyGoalMinutes);

  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const key = cursor.toISOString().slice(0, 10);
    const row = byDay.get(key);
    if (!row || row.minutes < 60) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const inProgressJobs = jobs.filter((job) => ["saved", "applied", "interview"].includes(job.status));
  const canShareToday = (socialSettings?.enabled ?? true) && todayStats.productiveMinutes > 0;

  return (
    <AppShell>
      {!preferences?.hasCompletedOnboarding && (
        <OnboardingModal userName={session.user.name} />
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-3 p-5">
          <h2 className="text-xl font-semibold">Good day, {session.user.name ?? "sir"}.</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}{" "}
            - today&apos;s briefing and productivity report.
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="text-lg font-medium">While You Were Away</h3>
          <div className="mt-3 space-y-2 text-sm">
            {activity.length === 0 ? (
              <p className="text-zinc-400">No recent activity logged yet.</p>
            ) : (
              activity.map((item) => (
                <p key={item.id} className="text-zinc-300">
                  {item.description}
                </p>
              ))
            )}
          </div>
        </Card>

        <TodayScheduleClient
          events={todayEvents.map((e) => ({
            id: e.id,
            title: e.title,
            startTime: e.startTime,
            endTime: e.endTime,
            travelTime: e.travelTime,
            source: e.source,
            color: e.color,
          }))}
        />

        <Card className="p-4">
          <h3 className="text-lg font-medium text-red-400">Urgent Actions</h3>
          <div className="mt-3 space-y-2 text-sm">
            {urgentTasks.length === 0 ? (
              <p className="text-zinc-400">No urgent deadlines in the next 48h.</p>
            ) : (
              urgentTasks.map((task) => (
                <p key={task.id} className="text-zinc-200">
                  {task.title}{" "}
                  <span className="text-zinc-500">
                    ({task.dueDate ? new Date(task.dueDate).toLocaleString() : "No due date"})
                  </span>
                </p>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-lg font-medium">Rangs</h3>
          <p className="mt-1 text-2xl font-bold text-[#6C63FF]">{rangs}</p>
          <p className="mt-1 text-xs text-zinc-400">
            Earn by completing tasks on time. Stay consistent to keep your streak alive.
          </p>
          <div className="mt-3 space-y-2 text-xs text-zinc-400">
            <p>
              Weekly focus: <span className="font-medium text-zinc-100">{weeklyMinutes} min</span> /{" "}
              {weeklyGoalMinutes} min
            </p>
            <div className="h-1.5 w-full rounded-full bg-zinc-800">
              <div
                className="h-1.5 rounded-full bg-[#6C63FF]"
                style={{ width: `${Math.round(weeklyProgress * 100)}%` }}
              />
            </div>
            <p>
              Current streak:{" "}
              <span className="font-medium text-zinc-100">{streak > 0 ? `${streak} day(s)` : "No streak yet"}</span>
            </p>
          </div>
          <Link href="/shop" className="mt-3 inline-block text-sm text-[#6C63FF] hover:underline">
            Visit shop →
          </Link>
        </Card>

        <Card className="p-4">
          <h3 className="text-lg font-medium">Today&apos;s Focus</h3>
          <p className="mt-1 text-sm text-zinc-300">
            {Math.round(todayStats.ratio * 100)}% of an 8h day tracked • {todayStats.completedTasks} tasks •{" "}
            {todayStats.productiveMinutes} productive minutes.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Link
              href="/tasks"
              className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
            >
              Review Top 5 tasks
            </Link>
            <Link
              href="/calendar"
              className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
            >
              Schedule study blocks
            </Link>
            <Link
              href="/social"
              className="inline-flex items-center rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:border-[#6C63FF] hover:text-[#6C63FF]"
            >
              {canShareToday ? "Share today&apos;s ratio" : "Log activity on Social"}
            </Link>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Evening ritual: scan this card, close your top 3 tasks, then log your day on Social.
          </p>
        </Card>

        <Suspense fallback={<Card className="p-4 animate-pulse"><div className="h-5 w-32 rounded bg-zinc-800" /><div className="mt-3 space-y-2"><div className="h-4 w-full rounded bg-zinc-800" /><div className="h-4 w-3/4 rounded bg-zinc-800" /></div></Card>}>
        <Card className="p-4">
          <h3 className="text-lg font-medium">Task Overview</h3>
          <div className="mt-3 space-y-2 text-sm">
            {topTasks.length === 0 ? (
              <p className="text-zinc-400">No active tasks.</p>
            ) : (
              topTasks.map((task) => (
                <p key={task.id} className="text-zinc-200">
                  {task.title} <span className="text-zinc-500">score {Math.round(task.priorityScore ?? 0)}</span>
                </p>
              ))
            )}
          </div>
        </Card>
        </Suspense>

        <Suspense fallback={<Card className="p-4 animate-pulse"><div className="h-5 w-32 rounded bg-zinc-800" /><div className="mt-3 space-y-2"><div className="h-4 w-full rounded bg-zinc-800" /><div className="h-4 w-3/4 rounded bg-zinc-800" /></div></Card>}>
        <Card className="p-4">
          <h3 className="text-lg font-medium">Email Digest</h3>
          <p className="mt-2 text-sm text-zinc-400">Important emails in the last 24 hours</p>
          <div className="mt-3 space-y-3 text-sm">
            {unreadEmails.length === 0 ? (
              <p className="text-zinc-400">No important emails in the last 24 hours.</p>
            ) : (
              unreadEmails.map((email) => (
                <div key={email.id} className="border-l-2 border-zinc-700 pl-2">
                  <p className="text-zinc-200 font-medium">{email.subject}</p>
                  {email.aiSummary ? (
                    <p className="mt-0.5 text-xs text-zinc-400 line-clamp-2">{email.aiSummary}</p>
                  ) : (
                    <p className="mt-0.5 text-xs text-zinc-500">{email.importance} importance</p>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
        </Suspense>

        <Card className="p-4">
          <h3 className="text-lg font-medium">Job Search Status</h3>
          <div className="mt-3 space-y-1 text-sm text-zinc-300">
            <p>New matches found: {jobs.length}</p>
            <p>Applications in progress: {inProgressJobs.length}</p>
            <p>Upcoming interviews: {jobs.filter((j) => j.status === "interview").length}</p>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
