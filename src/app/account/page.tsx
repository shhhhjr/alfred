import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { CosmeticsClient } from "@/components/account/CosmeticsClient";
import { ProfileAvatarClient } from "@/components/account/ProfileAvatarClient";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { type LucideProps, Trophy, Star, Zap, Target, Clock, Flame, Users, Briefcase, Mail, Award, Moon, Sunrise } from "lucide-react";
import { type ForwardRefExoticComponent, type RefAttributes } from "react";

type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;

type AchievementDef = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  xp: number;
  tier: "bronze" | "silver" | "gold";
  unlocked: boolean;
  progress?: { current: number; total: number };
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

const TIER_STYLES: Record<string, { border: string; badge: string; glow: string }> = {
  gold:   { border: "border-yellow-500/60", badge: "bg-yellow-500/20 text-yellow-400", glow: "shadow-yellow-500/10" },
  silver: { border: "border-zinc-400/60",   badge: "bg-zinc-400/20 text-zinc-300",    glow: "shadow-zinc-400/10" },
  bronze: { border: "border-orange-500/60", badge: "bg-orange-500/20 text-orange-400", glow: "shadow-orange-500/10" },
};

export default async function AccountPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const userId = session.user.id;

  const [user, tasks, preferences, leadCount, appliedJobCount, emailAccountCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, createdAt: true, profileImageUrl: true },
    }),
    prisma.task.findMany({
      where: { userId },
      select: { id: true, estimatedTime: true, isCompleted: true, completedAt: true, createdAt: true },
    }),
    prisma.userPreference.findUnique({ where: { userId } }),
    prisma.leadGenEntry.count({ where: { userId } }),
    prisma.job.count({ where: { userId, status: { in: ["applied", "interview", "offer", "rejected"] } } }),
    prisma.emailAccount.count({ where: { userId } }),
  ]);

  const cosmetics =
    preferences &&
    (await prisma.shopItem.findMany({
      where: {
        id: {
          in: [
            preferences.equippedBannerId,
            preferences.equippedTitleId,
            preferences.equippedBorderId,
            preferences.equippedThemeId,
          ].filter((v): v is string => !!v),
        },
      },
    }));

  const completed = tasks.filter((t) => t.isCompleted);
  const completedCount = completed.length;
  const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimatedTime ?? 0), 0);
  const completedEstimated = completed.reduce((sum, t) => sum + (t.estimatedTime ?? 0), 0);
  const workingRatio = totalEstimated > 0 ? completedEstimated / totalEstimated : 0;

  const completionHours = completed
    .filter((t) => t.completedAt)
    .map((t) => (t.completedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60));
  const avgCompletionHours =
    completionHours.length > 0
      ? completionHours.reduce((a, b) => a + b, 0) / completionHours.length
      : 0;

  const dailyMap = new Map<string, { created: number; completed: number }>();
  for (const task of tasks) {
    const createdKey = task.createdAt.toISOString().slice(0, 10);
    const createdRow = dailyMap.get(createdKey) ?? { created: 0, completed: 0 };
    createdRow.created += 1;
    dailyMap.set(createdKey, createdRow);
    if (task.isCompleted && task.completedAt) {
      const doneKey = task.completedAt.toISOString().slice(0, 10);
      const doneRow = dailyMap.get(doneKey) ?? { created: 0, completed: 0 };
      doneRow.completed += 1;
      dailyMap.set(doneKey, doneRow);
    }
  }
  let highestRatio = 0;
  for (const row of dailyMap.values()) {
    if (row.created === 0) continue;
    highestRatio = Math.max(highestRatio, row.completed / row.created);
  }

  // Streak calculation (last 14 days)
  const streakWindowStart = new Date();
  streakWindowStart.setDate(streakWindowStart.getDate() - 13);
  streakWindowStart.setHours(0, 0, 0, 0);
  const recentCompleted = tasks.filter((t) => t.isCompleted && t.completedAt && t.completedAt >= streakWindowStart);
  const completedDays = new Set(recentCompleted.map((t) => t.completedAt!.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    if (!completedDays.has(cursor.toISOString().slice(0, 10))) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const accountAgeDays = Math.floor((Date.now() - (user?.createdAt?.getTime() ?? Date.now())) / (1000 * 60 * 60 * 24));

  const hasNightOwl = completed.some((t) => {
    if (!t.completedAt) return false;
    const h = t.completedAt.getHours();
    return h >= 23;
  });
  const hasEarlyBird = completed.some((t) => {
    if (!t.completedAt) return false;
    const h = t.completedAt.getHours();
    return h < 9;
  });

  const achievements: AchievementDef[] = [
    {
      id: "first_steps",
      title: "First Steps",
      description: "Complete your very first task.",
      icon: Trophy,
      xp: 50,
      tier: "bronze",
      unlocked: completedCount >= 1,
      progress: { current: Math.min(completedCount, 1), total: 1 },
    },
    {
      id: "closer",
      title: "Closer",
      description: "Complete 10 tasks.",
      icon: Target,
      xp: 100,
      tier: "silver",
      unlocked: completedCount >= 10,
      progress: { current: Math.min(completedCount, 10), total: 10 },
    },
    {
      id: "veteran",
      title: "Veteran",
      description: "Complete 50 tasks.",
      icon: Award,
      xp: 250,
      tier: "gold",
      unlocked: completedCount >= 50,
      progress: { current: Math.min(completedCount, 50), total: 50 },
    },
    {
      id: "on_mission",
      title: "On Mission",
      description: "Reach a 70% working ratio.",
      icon: Zap,
      xp: 150,
      tier: "silver",
      unlocked: workingRatio >= 0.7,
      progress: { current: Math.round(workingRatio * 100), total: 70 },
    },
    {
      id: "speed_runner",
      title: "Speed Runner",
      description: "Average task completion under 24 hours.",
      icon: Clock,
      xp: 75,
      tier: "bronze",
      unlocked: avgCompletionHours > 0 && avgCompletionHours <= 24,
    },
    {
      id: "streak_lord",
      title: "Streak Lord",
      description: "Maintain a 7-day completion streak.",
      icon: Flame,
      xp: 300,
      tier: "gold",
      unlocked: streak >= 7,
      progress: { current: Math.min(streak, 7), total: 7 },
    },
    {
      id: "networker",
      title: "Networker",
      description: "Find 10 leads in the lead gen tool.",
      icon: Users,
      xp: 120,
      tier: "silver",
      unlocked: leadCount >= 10,
      progress: { current: Math.min(leadCount, 10), total: 10 },
    },
    {
      id: "job_hunter",
      title: "Job Hunter",
      description: "Apply to your first job.",
      icon: Briefcase,
      xp: 80,
      tier: "bronze",
      unlocked: appliedJobCount >= 1,
      progress: { current: Math.min(appliedJobCount, 1), total: 1 },
    },
    {
      id: "email_warrior",
      title: "Email Warrior",
      description: "Connect an email account.",
      icon: Mail,
      xp: 70,
      tier: "bronze",
      unlocked: emailAccountCount >= 1,
      progress: { current: Math.min(emailAccountCount, 1), total: 1 },
    },
    {
      id: "power_user",
      title: "Power User",
      description: "Use Alfred for 30 days.",
      icon: Star,
      xp: 500,
      tier: "gold",
      unlocked: accountAgeDays >= 30,
      progress: { current: Math.min(accountAgeDays, 30), total: 30 },
    },
    {
      id: "night_owl",
      title: "Night Owl",
      description: "Complete a task after 11 PM.",
      icon: Moon,
      xp: 60,
      tier: "bronze",
      unlocked: hasNightOwl,
    },
    {
      id: "early_bird",
      title: "Early Bird",
      description: "Complete a task before 9 AM.",
      icon: Sunrise,
      xp: 60,
      tier: "bronze",
      unlocked: hasEarlyBird,
    },
  ];

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalXp = achievements.filter((a) => a.unlocked).reduce((s, a) => s + a.xp, 0);

  return (
    <AppShell>
      <div className="space-y-4">
        <Card className="p-6">
          <h1 className="text-2xl font-semibold">Account</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Public profile controls and productivity statistics.
          </p>
        </Card>

        <ProfileAvatarClient initialUrl={user?.profileImageUrl ?? null} />

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Public Profile</h2>
          <div className="mt-3 grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
            <p>Name: {user?.name ?? "Not set"}</p>
            <p>Email: {user?.email ?? "-"}</p>
            <p>Visibility: {preferences?.profileVisibility ?? "private"}</p>
            <p>Headline: {preferences?.profileHeadline ?? "Not set"}</p>
          </div>
          <p className="mt-3 text-sm text-zinc-400">
            Edit profile visibility, headline, and bio in Settings.
          </p>
          <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950 p-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Appearance preview</p>
            <div className="mt-3 overflow-hidden rounded-lg border border-zinc-800">
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  backgroundImage:
                    cosmetics && preferences?.equippedBannerId
                      ? "linear-gradient(to right, #1a1333, #6C63FF)"
                      : undefined,
                  backgroundColor: !preferences?.equippedBannerId ? "#020617" : undefined,
                }}
              >
                {user?.profileImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.profileImageUrl}
                    alt="Profile"
                    className="h-12 w-12 shrink-0 rounded-full border-2 border-white/20 object-cover"
                  />
                )}
                <div>
                  <p className="text-xs text-zinc-400">
                    {new Date(user?.createdAt ?? new Date()).toLocaleDateString()}
                  </p>
                  <p className="text-lg font-semibold">
                    {user?.name ?? "Not set"}{" "}
                    {preferences?.equippedTitleId && cosmetics && (
                      <span className="text-xs text-[#6C63FF]">
                        •{" "}
                        {cosmetics.find((c) => c.id === preferences.equippedTitleId)?.name ??
                          "Equipped title"}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div
                className="border-t border-zinc-800 bg-[#020617] p-4 text-xs text-zinc-400"
                style={{
                  boxShadow: preferences?.equippedBorderId
                    ? "0 0 0 1px rgba(250, 204, 21, 0.6)"
                    : undefined,
                }}
              >
                This is how your profile frame will appear in Alfred.
              </div>
            </div>
          </div>
        </Card>

        <CosmeticsClient />

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Stats</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div className="rounded-md bg-zinc-900 p-3">
              <p className="text-zinc-400">Tasks Completed</p>
              <p className="text-lg font-semibold">{completedCount}</p>
            </div>
            <div className="rounded-md bg-zinc-900 p-3">
              <p className="text-zinc-400">Avg Completion Time</p>
              <p className="text-lg font-semibold">
                {avgCompletionHours > 0 ? `${avgCompletionHours.toFixed(1)}h` : "-"}
              </p>
            </div>
            <div className="rounded-md bg-zinc-900 p-3">
              <p className="text-zinc-400">Working Ratio</p>
              <p className="text-lg font-semibold">{percent(workingRatio)}</p>
            </div>
            <div className="rounded-md bg-zinc-900 p-3">
              <p className="text-zinc-400">Highest Daily Ratio</p>
              <p className="text-lg font-semibold">{percent(highestRatio)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Achievements</h2>
              <p className="mt-0.5 text-sm text-zinc-400">
                {unlockedCount}/{achievements.length} unlocked · {totalXp} XP earned
              </p>
            </div>
            <div className="rounded-full bg-[#6C63FF]/20 px-3 py-1 text-sm font-medium text-[#6C63FF]">
              {totalXp} XP
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((ach) => {
              const style = TIER_STYLES[ach.tier];
              const Icon = ach.icon;
              return (
                <div
                  key={ach.id}
                  className={`relative overflow-hidden rounded-lg border p-4 transition ${style.border} ${
                    ach.unlocked ? `shadow-lg ${style.glow}` : "opacity-45"
                  }`}
                >
                  {/* XP badge */}
                  <span className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}>
                    +{ach.xp} XP
                  </span>

                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.badge}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="font-medium text-zinc-100">{ach.title}</p>
                      <p className="text-xs text-zinc-500">{ach.description}</p>
                    </div>
                  </div>

                  {ach.progress && !ach.unlocked && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] text-zinc-600 mb-1">
                        <span>{ach.progress.current}/{ach.progress.total}</span>
                        <span>{Math.round((ach.progress.current / ach.progress.total) * 100)}%</span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-zinc-800">
                        <div
                          className="h-1 rounded-full bg-[#6C63FF]"
                          style={{ width: `${Math.min(100, Math.round((ach.progress.current / ach.progress.total) * 100))}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {ach.unlocked && (
                    <p className="mt-2 text-[11px] font-medium text-green-400">Unlocked</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
