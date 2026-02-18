"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Friend = { id: string; name: string | null; friendCode: string | null };
type Pending = { id: string; userA: { name: string | null } };
type Post = {
  id: string;
  ratio: number;
  completedTasks: number;
  productiveMinutes: number;
  note: string | null;
  postedAt: string;
  user: { id: string; name: string | null };
};

export function SocialClient() {
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [settings, setSettings] = useState({ enabled: true, visibility: "private", promptIntervalHours: 3 });
  const [inputCode, setInputCode] = useState("");
  const [postNote, setPostNote] = useState("");
  const [activityNote, setActivityNote] = useState("");
  const [activityMinutes, setActivityMinutes] = useState(60);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [codeRes, friendsRes, feedRes, settingsRes] = await Promise.all([
      fetch("/api/social/friends/code"),
      fetch("/api/social/friends"),
      fetch("/api/social/feed"),
      fetch("/api/social/settings"),
    ]);
    const codeData = (await codeRes.json()) as { friendCode?: string };
    const friendsData = (await friendsRes.json()) as { friends?: Friend[]; pending?: Pending[] };
    const feedData = (await feedRes.json()) as { posts?: Post[] };
    const settingsData = (await settingsRes.json()) as {
      enabled?: boolean;
      visibility?: string;
      promptIntervalHours?: number;
    };
    setFriendCode(codeData.friendCode ?? null);
    setFriends(friendsData.friends ?? []);
    setPending(friendsData.pending ?? []);
    setPosts(feedData.posts ?? []);
    setSettings({
      enabled: settingsData.enabled ?? true,
      visibility: settingsData.visibility ?? "private",
      promptIntervalHours: settingsData.promptIntervalHours ?? 3,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData().catch(() => setLoading(false));
  }, [fetchData]);

  async function addFriend(e: FormEvent) {
    e.preventDefault();
    if (!inputCode.trim()) return;
    const res = await fetch("/api/social/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendCode: inputCode.trim().toUpperCase() }),
    });
    const data = (await res.json()) as { error?: string };
    if (res.ok) {
      setInputCode("");
      fetchData();
    } else {
      alert(data.error ?? "Failed");
    }
  }

  async function respondToRequest(friendshipId: string, accept: boolean) {
    await fetch("/api/social/friends/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendshipId, accept }),
    });
    fetchData();
  }

  async function logActivity(e: FormEvent) {
    e.preventDefault();
    if (!activityNote.trim()) return;
    const res = await fetch("/api/social/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activity: activityNote.trim(), productiveMinutes: activityMinutes }),
    });
    const data = (await res.json()) as { error?: string };
    if (res.ok) {
      setActivityNote("");
      fetchData();
    } else {
      alert(data.error ?? "Could not log activity");
    }
  }

  async function shareToFeed() {
    const res = await fetch("/api/social/feed/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: postNote || undefined }),
    });
    const data = (await res.json()) as { error?: string };
    if (res.ok) {
      setPostNote("");
      fetchData();
    } else {
      alert(data.error ?? "Could not share to feed");
    }
  }

  async function updateSettings(updates: Partial<typeof settings>) {
    await fetch("/api/social/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setSettings((s) => ({ ...s, ...updates }));
    fetchData();
  }

  if (loading) {
    return <Card className="p-6 text-zinc-400">Loading…</Card>;
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h1 className="text-2xl font-semibold">Social</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Share your productivity with friends.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="rounded-lg bg-zinc-900 px-4 py-3">
            <p className="text-xs text-zinc-400">Your friend code</p>
            <p className="font-mono text-lg font-semibold">{friendCode ?? "—"}</p>
          </div>
          <div className="flex items-end gap-2">
            <form onSubmit={addFriend} className="flex gap-2">
              <input
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="Enter friend code"
                className="h-10 w-40 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm font-mono"
              />
              <Button type="submit" size="sm">Add Friend</Button>
            </form>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={settings.enabled}
              onClick={() => updateSettings({ enabled: !settings.enabled })}
              className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
                settings.enabled
                  ? "border-[#6C63FF] bg-[#6C63FF]"
                  : "border-zinc-600 bg-zinc-800"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  settings.enabled ? "left-5" : "left-0.5"
                }`}
              />
            </button>
            <span className="text-sm text-zinc-300">Social on</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">Visibility</span>
            <select
              value={settings.visibility}
              onChange={(e) => updateSettings({ visibility: e.target.value })}
              className="rounded-md border border-zinc-700 bg-[#12121A] px-3 py-1.5 text-sm text-zinc-200 focus:border-[#6C63FF] focus:outline-none focus:ring-1 focus:ring-[#6C63FF]"
            >
              <option value="private">Just me</option>
              <option value="friends">Friends</option>
            </select>
          </div>
          <span className="text-sm text-zinc-500">
            Prompt every {settings.promptIntervalHours}h
          </span>
        </div>
      </Card>

      {pending.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold">Pending requests</h3>
          <div className="mt-2 space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded bg-zinc-900 p-2">
                <span>{p.userA.name ?? "Someone"}</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => respondToRequest(p.id, true)}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => respondToRequest(p.id, false)}>Decline</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="font-semibold">Friends</h3>
        <div className="mt-2 space-y-2">
          {friends.length === 0 ? (
            <p className="text-sm text-zinc-500">No friends yet. Share your code or add theirs.</p>
          ) : (
            friends.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded bg-zinc-900 p-2 text-sm">
                <div>
                  {f.name ?? "Unknown"} <span className="text-zinc-500 font-mono">{f.friendCode}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Simple nudge hook – can later fan out to notifications
                    alert(`Nudge sent to ${f.name ?? "your friend"} (coming soon).`);
                  }}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-[#6C63FF] hover:text-[#6C63FF]"
                >
                  Nudge
                </button>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold">Log activity</h3>
        <p className="mt-1 text-sm text-zinc-400">What did you work on? Helps compute your productivity ratio.</p>
        <form onSubmit={logActivity} className="mt-3 flex flex-wrap gap-2">
          <input
            value={activityNote}
            onChange={(e) => setActivityNote(e.target.value)}
            placeholder="e.g. Studied MOS chapter 3"
            className="h-10 flex-1 min-w-[200px] rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
          />
          <input
            type="number"
            min={0}
            max={480}
            value={activityMinutes}
            onChange={(e) => setActivityMinutes(Number(e.target.value))}
            className="h-10 w-24 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
          />
          <span className="flex items-center text-sm text-zinc-400">min</span>
          <Button type="submit" disabled={!settings.enabled}>Log</Button>
        </form>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold">Share to feed</h3>
        <p className="mt-1 text-sm text-zinc-400">Post your daily productivity ratio.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={postNote}
            onChange={(e) => setPostNote(e.target.value)}
            placeholder="Optional note"
            className="h-10 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
          />
          <Button onClick={shareToFeed} disabled={!settings.enabled}>Share</Button>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold">Feed</h3>
        <div className="mt-3 space-y-3">
          {posts.length === 0 ? (
            <p className="text-sm text-zinc-500">No posts yet. Share your day!</p>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <p className="font-medium">{post.user.name ?? "Anonymous"}</p>
                <p className="text-sm text-zinc-400">
                  {Math.round(post.ratio * 100)}% ratio • {post.completedTasks} tasks • {post.productiveMinutes} min
                </p>
                {post.note && <p className="mt-1 text-sm text-zinc-300">{post.note}</p>}
                <p className="mt-1 text-xs text-zinc-500">
                  {new Date(post.postedAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
