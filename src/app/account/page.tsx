import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { CosmeticsClient } from "@/components/account/CosmeticsClient";
import { ProfileAvatarClient } from "@/components/account/ProfileAvatarClient";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default async function AccountPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const userId = session.user.id;
  const [user, tasks, preferences] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, createdAt: true, profileImageUrl: true },
    }),
    prisma.task.findMany({
      where: { userId },
      select: { id: true, estimatedTime: true, isCompleted: true, completedAt: true, createdAt: true },
    }),
    prisma.userPreference.findUnique({ where: { userId } }),
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
    .map((t) => ((t.completedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)));
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

  const achievements: string[] = [];
  if (completedCount >= 10) achievements.push("Closer - Completed 10 tasks");
  if (workingRatio >= 0.7) achievements.push("On Mission - 70% working ratio");
  if (avgCompletionHours > 0 && avgCompletionHours <= 24) {
    achievements.push("Fast Operator - Avg completion under 24h");
  }
  if (achievements.length === 0) achievements.push("First Steps - Complete tasks to unlock achievements");

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
          <h2 className="text-lg font-semibold">Achievements</h2>
          <div className="mt-3 space-y-2 text-sm">
            {achievements.map((item) => (
              <div key={item} className="rounded-md bg-zinc-900 p-3 text-zinc-300">
                {item}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
