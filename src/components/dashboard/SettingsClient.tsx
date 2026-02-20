"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AddressAutocomplete } from "@/components/ui/AddressAutocomplete";

type SettingsResponse = {
  user?: {
    name?: string | null;
    homeAddress?: string | null;
    automationLevel?: "manual" | "semi" | "auto";
  };
  preferences?: {
    school?: string | null;
    courses?: string[] | null;
    travelMode?: string | null;
    workHoursStart?: number | null;
    workHoursEnd?: number | null;
    breakMinutes?: number | null;
    automationLevelNote?: string | null;
    notifEmailDigest?: boolean | null;
    notifPush?: boolean | null;
    notifMorningBrief?: boolean | null;
  } | null;
};

type EmailAccountSummary = {
  id: string;
  provider: string;
  email: string;
  unreadCount: number;
  lastSynced?: string | null;
  status?: "connected" | "disconnected" | "error";
};

type JobSearchConfig = {
  keywords: string;
  locations: string;
  excludedCompanies: string;
};

function providerLabel(provider: string) {
  const p = provider.toLowerCase();
  if (p === "gmail") return "Gmail";
  if (p === "outlook") return "Outlook";
  if (p === "icloud") return "iCloud";
  return provider;
}

function statusDot(status: EmailAccountSummary["status"]) {
  if (status === "connected") return <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />;
  if (status === "error") return <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />;
  return <span className="mr-1 inline-block h-2 w-2 rounded-full bg-zinc-600" />;
}

function parseJobSearch(note: string | null | undefined): JobSearchConfig {
  if (!note) return { keywords: "", locations: "", excludedCompanies: "" };
  try {
    const parsed = JSON.parse(note) as { jobSearch?: Partial<JobSearchConfig> } | undefined;
    const job = parsed?.jobSearch ?? {};
    return {
      keywords: job.keywords ?? "",
      locations: job.locations ?? "",
      excludedCompanies: job.excludedCompanies ?? "",
    };
  } catch {
    return { keywords: "", locations: "", excludedCompanies: "" };
  }
}

function formatTimeValue(hour: number | null | undefined): string {
  const h = typeof hour === "number" && hour >= 0 && hour <= 23 ? hour : 9;
  return `${h.toString().padStart(2, "0")}:00`;
}

function parseTimeToHour(value: string, fallback: number): number {
  if (!value) return fallback;
  const [h] = value.split(":");
  const num = Number(h);
  if (Number.isNaN(num) || num < 0 || num > 23) return fallback;
  return num;
}

export function SettingsClient() {
  // Profile
  const [name, setName] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [school, setSchool] = useState("");
  const [courses, setCourses] = useState<string[]>([]);
  const [courseInput, setCourseInput] = useState("");

  // Automation
  const [automationLevel, setAutomationLevel] = useState<"manual" | "semi" | "auto">("semi");
  
  const handleAutomationLevelChange = (level: "manual" | "semi" | "auto") => {
    setAutomationLevel(level);
  };

  // Calendar preferences
  const [travelMode, setTravelMode] = useState<"drive" | "transit" | "walk" | "bicycling">("drive");
  const [workHoursStart, setWorkHoursStart] = useState<number>(9);
  const [workHoursEnd, setWorkHoursEnd] = useState<number>(17);
  const [breakMinutes, setBreakMinutes] = useState<number>(15);

  // Email accounts
  const [emailAccounts, setEmailAccounts] = useState<EmailAccountSummary[]>([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [connectEmailOpen, setConnectEmailOpen] = useState(false);
  const [icloudEmail, setIcloudEmail] = useState("");
  const [icloudPassword, setIcloudPassword] = useState("");
  const [connectEmailStatus, setConnectEmailStatus] = useState<string | null>(null);

  // Job search
  const [jobKeywords, setJobKeywords] = useState("");
  const [jobLocations, setJobLocations] = useState("");
  const [jobExcludedCompanies, setJobExcludedCompanies] = useState("");

  // Notifications (UI-only placeholders)
  const [notifEmailDigest, setNotifEmailDigest] = useState(false);
  const [notifPush, setNotifPush] = useState(false);
  const [notifMorningBrief, setNotifMorningBrief] = useState(false);

  // Data & privacy
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadedRef = useRef(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) {
      setStatus(`${connected === "gmail" ? "Gmail" : connected === "outlook" ? "Outlook" : "Account"} connected successfully.`);
      setTimeout(() => setStatus(null), 3000);
      const refreshAccounts = async () => {
        const emailRes = await fetch("/api/email/accounts", { cache: "no-store" }).catch(() => null);
        if (emailRes && emailRes.ok) {
          const emailData = (await emailRes.json()) as { accounts?: EmailAccountSummary[] };
          setEmailAccounts(emailData.accounts ?? []);
        }
      };
      refreshAccounts();
    } else if (error) {
      setStatus(`Connection failed: ${decodeURIComponent(error)}`);
      setTimeout(() => setStatus(null), 5000);
    }
  }, [searchParams]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const load = async () => {
      try {
        const [settingsRes, emailRes] = await Promise.all([
          fetch("/api/settings", { cache: "no-store" }),
          fetch("/api/email/accounts", { cache: "no-store" }).catch(() => null),
        ]);

        if (settingsRes.ok) {
          const payload = (await settingsRes.json()) as SettingsResponse;
          setName(payload.user?.name ?? "");
          setHomeAddress(payload.user?.homeAddress ?? "");
          setAutomationLevel((payload.user?.automationLevel as "manual" | "semi" | "auto") ?? "semi");

          const prefs = payload.preferences;
          setSchool(prefs?.school ?? "");
          setCourses(prefs?.courses ?? []);
          setTravelMode((prefs?.travelMode as "drive" | "transit" | "walk" | "bicycling") ?? "drive");
          setWorkHoursStart(prefs?.workHoursStart ?? 9);
          setWorkHoursEnd(prefs?.workHoursEnd ?? 17);
          setBreakMinutes(prefs?.breakMinutes ?? 15);

          const job = parseJobSearch(prefs?.automationLevelNote);
          setJobKeywords(job.keywords);
          setJobLocations(job.locations);
          setJobExcludedCompanies(job.excludedCompanies);

          setNotifEmailDigest(prefs?.notifEmailDigest ?? false);
          setNotifPush(prefs?.notifPush ?? false);
          setNotifMorningBrief(prefs?.notifMorningBrief ?? false);
        } else {
          setStatus("Unable to load settings.");
        }

        if (emailRes && emailRes.ok) {
          const data = (await emailRes.json()) as { accounts?: EmailAccountSummary[] };
          setEmailAccounts(data.accounts ?? []);
        }
      } catch {
        setStatus("Unable to load settings.");
      }
    };

    setEmailLoading(true);
    load().finally(() => setEmailLoading(false));
  }, []);

  const handleAddCourse = () => {
    const value = courseInput.trim();
    if (!value) return;
    if (!courses.includes(value)) {
      setCourses([...courses, value]);
    }
    setCourseInput("");
  };

  const handleRemoveCourse = (value: string) => {
    setCourses(courses.filter((c) => c !== value));
  };

  const saveInProgressRef = useRef(false);
  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    if (saveInProgressRef.current) return;
    saveInProgressRef.current = true;
    setSaving(true);
    setStatus("Saving…");
    const done = () => {
      setSaving(false);
      saveInProgressRef.current = false;
    };
    const formEl = typeof document !== "undefined" && (e?.target as HTMLFormElement)?.closest?.("form");
    if (formEl) formEl.style.pointerEvents = "none";
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          homeAddress,
          automationLevel,
          school,
          courses,
          travelMode,
          workHoursStart,
          workHoursEnd,
          breakMinutes,
          jobSearchKeywords: jobKeywords,
          jobSearchLocations: jobLocations,
          jobSearchExcludedCompanies: jobExcludedCompanies,
          notifEmailDigest,
          notifPush,
          notifMorningBrief,
        }),
      });
      const ok = res.ok;
      setStatus(ok ? "Settings saved." : "Failed to save settings.");
      done();
      setTimeout(() => setStatus(null), ok ? 5000 : 8000);
    } catch {
      setStatus("Failed to save settings.");
      done();
      setTimeout(() => setStatus(null), 8000);
    } finally {
      if (formEl) formEl.style.pointerEvents = "";
    }
  }

  async function handleDisconnectAccount(id: string) {
    if (!confirm("Disconnect this email account?")) return;
    try {
      const res = await fetch(`/api/email/accounts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEmailAccounts((prev) => prev.filter((a) => a.id !== id));
        setStatus("Account disconnected.");
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus("Failed to disconnect account.");
      }
    } catch {
      setStatus("Failed to disconnect account.");
    }
  }

  async function handleConnectGmail() {
    setConnectEmailStatus(null);
    try {
      // Gmail OAuth returns a redirect; fetch with redirect:manual to catch 500 first
      const res = await fetch("/api/email/connect/gmail?returnTo=/settings", { redirect: "manual" });
      if (res.status === 500) {
        const data = await res.json().catch(() => ({}));
        setConnectEmailStatus(data.error || "Gmail not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env");
        return;
      }
      // Redirect to start OAuth flow
      window.location.assign("/api/email/connect/gmail?returnTo=/settings");
    } catch {
      window.location.assign("/api/email/connect/gmail?returnTo=/settings");
    }
  }

  async function handleConnectOutlook() {
    try {
      const res = await fetch("/api/email/connect/outlook");
      if (res.redirected) {
        window.location.href = res.url;
      } else if (res.status === 500) {
        const data = await res.json().catch(() => ({}));
        if (data.error?.includes("not configured")) {
          setStatus("Outlook connection not configured yet. Check MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.");
          setTimeout(() => setStatus(null), 5000);
        } else {
          setStatus(data.error || "Failed to connect Outlook.");
          setTimeout(() => setStatus(null), 5000);
        }
      } else {
        window.location.href = "/api/email/connect/outlook?returnTo=/settings";
      }
    } catch {
      window.location.href = "/api/email/connect/outlook?returnTo=/settings";
    }
  }

  async function handleConnectIcloud(e: React.FormEvent) {
    e.preventDefault();
    if (!icloudEmail.trim() || !icloudPassword) {
      setConnectEmailStatus("Please enter both email and app-specific password.");
      setTimeout(() => setConnectEmailStatus(null), 4000);
      return;
    }
    setConnectEmailStatus(null);
    try {
      const res = await fetch("/api/email/connect/icloud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: icloudEmail.trim(), appPassword: icloudPassword }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setConnectEmailStatus("iCloud connected successfully.");
        setIcloudEmail("");
        setIcloudPassword("");
        setStatus("iCloud connected successfully.");
        const emailRes = await fetch("/api/email/accounts", { cache: "no-store" });
        if (emailRes.ok) {
          const emailData = (await emailRes.json()) as { accounts?: EmailAccountSummary[] };
          setEmailAccounts(emailData.accounts ?? []);
        }
        setTimeout(() => {
          setConnectEmailOpen(false);
          setConnectEmailStatus(null);
          setStatus(null);
        }, 1500);
      } else {
        const msg = data.error || "Invalid email or app-specific password. Try again.";
        setConnectEmailStatus(msg);
        setStatus(msg);
        setTimeout(() => { setStatus(null); setConnectEmailStatus(null); }, 5000);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect iCloud account.";
      setConnectEmailStatus(msg);
      setStatus(msg);
      setTimeout(() => { setStatus(null); setConnectEmailStatus(null); }, 5000);
    }
  }

  async function handleDeleteAccount() {
    if (deleteText !== "DELETE") return;
    setDeleteBusy(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (res.ok) {
        await signOut({ callbackUrl: "/login" });
      } else {
        setStatus("Failed to delete account.");
      }
    } catch {
      setStatus("Failed to delete account.");
    } finally {
      setDeleteBusy(false);
      setDeleteOpen(false);
      setDeleteText("");
    }
  }

  return (
    <div className="flex gap-6">
      {/* Left: settings nav */}
      <aside className="hidden w-56 shrink-0 flex-col gap-2 md:flex">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Settings</h2>
        <a href="#profile" className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
          Profile
        </a>
        <a href="#automation" className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
          Automation level
        </a>
        <a href="#email" className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
          Email accounts
        </a>
        <a href="#calendar" className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
          Calendar preferences
        </a>
        <a href="#job-search" className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
          Job search
        </a>
        <a href="#notifications" className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
          Notifications
        </a>
        <a href="#privacy" className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
          Data & privacy
        </a>
      </aside>

      {/* Right: content */}
      <form
        className="flex-1 space-y-6"
        onSubmit={(e) => handleSave(e)}
      >
        <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-zinc-800 bg-zinc-950/95 py-4 backdrop-blur">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-50">Settings</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Update your profile, automation level, calendar preferences, and more.
            </p>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Saving…
              </span>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
        {status && <p className="text-sm text-zinc-300">{status}</p>}

        {/* Profile */}
        <Card id="profile" className="border-zinc-800 bg-zinc-950/60 p-5">
          <h2 className="text-lg font-semibold text-zinc-100">Profile</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Basic information Alfred uses for personalization and travel time.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">School</label>
              <Input
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                placeholder="School or university"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-zinc-400">Home address</label>
              <AddressAutocomplete
                value={homeAddress}
                onChange={setHomeAddress}
                placeholder="Used as default origin for travel time"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-medium text-zinc-400">Current courses / subjects</label>
              <div className="flex flex-wrap gap-2">
                {courses.map((course) => (
                  <span
                    key={course}
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-100"
                  >
                    {course}
                    <button
                      type="button"
                      className="text-zinc-400 hover:text-zinc-200"
                      onClick={() => handleRemoveCourse(course)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={courseInput}
                  onChange={(e) => setCourseInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCourse();
                    }
                  }}
                  placeholder='Type a subject like "MOS 1023" and press Enter'
                />
                <Button type="button" variant="outline" onClick={handleAddCourse}>
                  Add
                </Button>
              </div>
              <p className="text-xs text-zinc-500">
                These subjects populate the subject dropdown when creating tasks.
              </p>
            </div>
          </div>
        </Card>

        {/* Automation level */}
        <Card id="automation" className="border-zinc-800 bg-zinc-950/60 p-5">
          <h2 className="text-lg font-semibold text-zinc-100">Automation level</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Choose how proactive Alfred should be with your calendar, tasks, and email.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <button
              type="button"
              onClick={() => handleAutomationLevelChange("manual")}
              className={`flex h-full flex-col justify-between rounded-xl border p-4 text-left text-sm transition ${
                automationLevel === "manual"
                  ? "border-[#6C63FF] bg-[#6C63FF]/10"
                  : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900/60"
              }`}
            >
              <div>
                <h3 className="font-semibold text-zinc-100">Manual</h3>
                <p className="mt-2 text-xs text-zinc-400">
                  Alfred suggests actions but only does things when you explicitly ask. Nothing
                  happens without your direct request.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleAutomationLevelChange("semi")}
              className={`flex h-full flex-col justify-between rounded-xl border p-4 text-left text-sm transition ${
                automationLevel === "semi"
                  ? "border-[#6C63FF] bg-[#6C63FF]/10"
                  : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900/60"
              }`}
            >
              <div>
                <h3 className="font-semibold text-zinc-100">Semi-automatic</h3>
                <p className="mt-2 text-xs text-zinc-400">
                  Alfred proactively detects events, deadlines, and tasks from your emails and
                  prepares them, but always asks for your confirmation before making changes.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleAutomationLevelChange("auto")}
              className={`flex h-full flex-col justify-between rounded-xl border p-4 text-left text-sm transition ${
                automationLevel === "auto"
                  ? "border-[#6C63FF] bg-[#6C63FF]/10"
                  : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900/60"
              }`}
            >
              <div>
                <h3 className="font-semibold text-zinc-100">Automatic</h3>
                <p className="mt-2 text-xs text-zinc-400">
                  Alfred handles everything automatically. Events get added, tasks created, emails
                  processed. You&apos;ll be notified of what was done, but don&apos;t need to approve
                  each action.
                </p>
              </div>
            </button>
          </div>
        </Card>

        {/* Email accounts */}
        <Card id="email" className="border-zinc-800 bg-zinc-950/60 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Email accounts</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Connected inboxes Alfred can read to find events, deadlines, and tasks.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConnectEmailOpen(true)}
            >
              Connect account
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {emailLoading ? (
              <p className="text-sm text-zinc-400">Loading email accounts…</p>
            ) : emailAccounts.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No connected accounts yet. Connect Gmail, Outlook, or iCloud from here or the Email
                page.
              </p>
            ) : (
              emailAccounts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-100">
                      {providerLabel(a.provider)[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {statusDot(a.status)}
                        <span className="font-medium text-zinc-100">{a.email}</span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {providerLabel(a.provider)}
                        {a.lastSynced
                          ? ` • Last synced ${new Date(a.lastSynced).toLocaleString()}`
                          : " • Never synced"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.unreadCount > 0 && (
                      <span className="rounded-full bg-[#6C63FF] px-2 py-0.5 text-xs text-white">
                        {a.unreadCount} unread
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-red-500/40 text-red-300 hover:bg-red-500/10"
                      onClick={() => handleDisconnectAccount(a.id)}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Calendar preferences */}
        <Card id="calendar" className="border-zinc-800 bg-zinc-950/60 p-5">
          <h2 className="text-lg font-semibold text-zinc-100">Calendar preferences</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Travel mode and working hours Alfred uses when planning your day.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Default travel mode</label>
              <Select
                value={travelMode}
                onValueChange={(v: "drive" | "transit" | "walk" | "bicycling") => setTravelMode(v)}
              >
                <SelectTrigger className="bg-zinc-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 text-sm text-zinc-100">
                  <SelectItem value="drive">Driving</SelectItem>
                  <SelectItem value="transit">Transit</SelectItem>
                  <SelectItem value="walk">Walking</SelectItem>
                  <SelectItem value="bicycling">Bicycling</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Break duration (minutes)</label>
              <Input
                type="number"
                min={5}
                max={120}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(Number(e.target.value) || 15)}
              />
              <p className="text-xs text-zinc-500">
                Added between blocks when Alfred plans your day.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Work hours start</label>
              <Input
                type="time"
                value={formatTimeValue(workHoursStart)}
                onChange={(e) => setWorkHoursStart(parseTimeToHour(e.target.value, 9))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Work hours end</label>
              <Input
                type="time"
                value={formatTimeValue(workHoursEnd)}
                onChange={(e) => setWorkHoursEnd(parseTimeToHour(e.target.value, 17))}
              />
            </div>
          </div>
        </Card>

        {/* Job search */}
        <Card id="job-search" className="border-zinc-800 bg-zinc-950/60 p-5">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-100">Job search</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Configure how Alfred should search for internships and jobs.
          </p>
          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Default search keywords</label>
              <Input
                value={jobKeywords}
                onChange={(e) => setJobKeywords(e.target.value)}
                placeholder="e.g., software intern, AI research, MOS tutor"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Preferred locations</label>
              <Input
                value={jobLocations}
                onChange={(e) => setJobLocations(e.target.value)}
                placeholder="e.g., Toronto, remote, London"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Excluded companies</label>
              <Input
                value={jobExcludedCompanies}
                onChange={(e) => setJobExcludedCompanies(e.target.value)}
                placeholder="Companies you never want Alfred to suggest"
              />
            </div>
          </div>
        </Card>

        {/* Notifications */}
        <Card id="notifications" className="border-zinc-800 bg-zinc-950/60 p-5">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-100">Notifications</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Control digests and briefings from Alfred.
          </p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
              <div>
                <p className="text-sm text-zinc-100">Email digest</p>
                <p className="text-xs text-zinc-500">Summary of tasks and events sent by email.</p>
              </div>
              <Switch checked={notifEmailDigest} onCheckedChange={setNotifEmailDigest} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
              <div>
                <p className="text-sm text-zinc-100">Push notifications</p>
                <p className="text-xs text-zinc-500">Real-time alerts on important changes.</p>
              </div>
              <Switch checked={notifPush} onCheckedChange={setNotifPush} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
              <div>
                <p className="text-sm text-zinc-100">Daily morning briefing</p>
                <p className="text-xs text-zinc-500">A quick summary of your day each morning.</p>
              </div>
              <Switch checked={notifMorningBrief} onCheckedChange={setNotifMorningBrief} />
            </div>
          </div>
        </Card>

        {/* Data & privacy */}
        <Card id="privacy" className="border-zinc-800 bg-zinc-950/60 p-5">
          <h2 className="text-lg font-semibold text-zinc-100">Data & privacy</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Control how your data is stored. Export or permanently delete your account.
          </p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <Button
              type="button"
              variant="outline"
              className="md:w-48"
              onClick={() => setStatus("Data export is coming soon.")}
            >
              Export my data
            </Button>
            <div className="flex-1 rounded-lg border border-red-500/40 bg-red-950/20 px-4 py-3">
              <p className="text-sm font-medium text-red-300">Delete account</p>
              <p className="mt-1 text-xs text-red-200/80">
                This will permanently delete your account and all associated data. This action cannot
                be undone.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 border-red-500/60 text-xs text-red-300 hover:bg-red-500/10"
                onClick={() => setDeleteOpen(true)}
              >
                Delete account
              </Button>
            </div>
          </div>
        </Card>
      </form>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-300">
            This will permanently delete your account and all data. This action cannot be undone.
            Type <span className="font-mono text-red-400">DELETE</span> to confirm.
          </p>
          <Input
            value={deleteText}
            onChange={(e) => setDeleteText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="mt-3"
          />
          <DialogFooter className="mt-4 flex items-center justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-500/60 text-red-300 hover:bg-red-500/10"
              disabled={deleteText !== "DELETE" || deleteBusy}
              onClick={handleDeleteAccount}
            >
              {deleteBusy ? "Deleting…" : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={connectEmailOpen} onOpenChange={(open) => { setConnectEmailOpen(open); if (!open) setConnectEmailStatus(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Email Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {connectEmailStatus && (
              <p className={`rounded-lg px-3 py-2 text-sm ${connectEmailStatus.startsWith("iCloud connected") || connectEmailStatus.includes("success") ? "bg-emerald-900/40 text-emerald-300" : "bg-red-900/40 text-red-300"}`}>
                {connectEmailStatus}
              </p>
            )}
            <Button className="w-full" onClick={handleConnectGmail}>
              Connect Gmail
            </Button>
            <Button className="w-full" variant="outline" onClick={handleConnectOutlook}>
              Connect Outlook
            </Button>
            <form onSubmit={handleConnectIcloud} className="space-y-3 border-t border-zinc-800 pt-4">
              <p className="text-sm text-zinc-400">iCloud (app-specific password)</p>
              <Input
                type="email"
                placeholder="iCloud email"
                value={icloudEmail}
                onChange={(e) => setIcloudEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="App-specific password"
                value={icloudPassword}
                onChange={(e) => setIcloudPassword(e.target.value)}
                required
              />
              <Button type="submit" variant="outline" className="w-full">
                Connect iCloud
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
