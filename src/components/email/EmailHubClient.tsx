"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Account = { id: string; provider: string; email: string; unreadCount: number };

type EmailMessage = {
  id: string;
  providerId: string;
  accountId: string;
  provider: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  isRead: boolean;
  importance: string;
  actionItems?: string[];
  aiSummary?: string | null;
  requiresResponse?: boolean;
  detectedEvents?: Array<{ title?: string; date?: string; time?: string; location?: string }>;
  detectedDeadlines?: Array<{ description?: string; dueDate?: string }>;
  requiresSignup?: boolean;
  signupUrl?: string | null;
};

function ProviderIcon({ provider }: { provider: string }) {
  const p = provider.toLowerCase();
  if (p === "gmail") return <span className="text-red-500">G</span>;
  if (p === "outlook") return <span className="text-blue-500">O</span>;
  if (p === "icloud") return <span className="text-zinc-400">i</span>;
  return <span>?</span>;
}

function ImportanceBadge({ importance }: { importance: string }) {
  const v = importance.toLowerCase();
  if (v === "high") return <Badge className="shrink-0 bg-red-900/50 text-red-300 text-[10px]">High</Badge>;
  if (v === "medium") return <Badge className="shrink-0 bg-yellow-900/50 text-yellow-300 text-[10px]">Med</Badge>;
  return <Badge className="shrink-0 bg-zinc-600 text-zinc-400 text-[10px]">Low</Badge>;
}

export function EmailHubClient() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [emailBody, setEmailBody] = useState<string>("");
  const [bodyLoading, setBodyLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [icloudEmail, setIcloudEmail] = useState("");
  const [icloudPassword, setIcloudPassword] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [draftStep, setDraftStep] = useState<"idle" | "asking" | "drafting" | "draft_ready" | "sending">("idle");
  const [draft, setDraft] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [draftSubject, setDraftSubject] = useState("");
  const [updatingRespond, setUpdatingRespond] = useState(false);

  const fetchAccounts = useCallback(async () => {
    const res = await fetch("/api/email/accounts");
    const data = await res.json();
    setAccounts(data.accounts ?? []);
  }, []);

  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchMessages = useCallback(async () => {
    const params = new URLSearchParams();
    if (selectedAccountId) params.set("accountId", selectedAccountId);
    params.set("limit", "50");
    params.set("offset", "0");
    const res = await fetch(`/api/email/messages?${params}`);
    const data = await res.json();
    setMessages(data.messages ?? []);
    setHasMore(data.hasMore ?? false);
  }, [selectedAccountId]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (selectedAccountId) params.set("accountId", selectedAccountId);
      params.set("limit", "50");
      params.set("offset", String(messages.length));
      const res = await fetch(`/api/email/messages?${params}`);
      const data = await res.json();
      const list = data.messages ?? [];
      setMessages((prev) => [...prev, ...list]);
      setHasMore(data.hasMore ?? false);
    } finally {
      setLoadingMore(false);
    }
  }, [selectedAccountId, messages.length]);

  useEffect(() => {
    fetchAccounts().finally(() => setLoading(false));
  }, [fetchAccounts]);

  useEffect(() => {
    const err = searchParams.get("error");
    const conn = searchParams.get("connected");
    if (err) setToast(decodeURIComponent(err));
    else if (conn) setToast(`${conn} connected successfully`);
    if (err || conn) setTimeout(() => setToast(null), 3000);
  }, [searchParams]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncMinutesAgo, setSyncMinutesAgo] = useState<number | null>(null);

  // Auto-sync every 30 minutes
  useEffect(() => {
    const SYNC_INTERVAL_MS = 30 * 60 * 1000;
    const intervalId = setInterval(async () => {
      try {
        await fetch("/api/email/sync", { method: "POST" });
        await fetchMessages();
        setLastSyncedAt(new Date());
      } catch {
        // silent failure
      }
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchMessages]);

  // Update "X min ago" display every minute
  useEffect(() => {
    if (!lastSyncedAt) return;
    const tick = setInterval(() => {
      setSyncMinutesAgo(Math.floor((Date.now() - lastSyncedAt.getTime()) / 60000));
    }, 60000);
    setSyncMinutesAgo(0);
    return () => clearInterval(tick);
  }, [lastSyncedAt]);

  const handleSync = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch("/api/email/sync", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        await fetchAccounts();
        await fetchMessages();
        setLastSyncedAt(new Date());
        setToast(data.message ?? "Sync complete");
      } else {
        setToast(data.error ?? "Sync failed");
      }
    } catch {
      setToast("Sync failed");
    } finally {
      setSyncLoading(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleSelectMessage = async (msg: EmailMessage) => {
    setSelectedMessage(msg);
    setEmailBody("");
    setDraftStep("idle");
    setDraft("");
    setBodyLoading(true);
    try {
      const res = await fetch(`/api/email/messages/${msg.id}/body`);
      const data = await res.json();
      setEmailBody(data.body ?? "");
    } catch {
      setEmailBody("Failed to load email body.");
    } finally {
      setBodyLoading(false);
    }
  };

  const handleDraftReply = async () => {
    if (!selectedMessage) return;
    setDraftStep("drafting");
    try {
      const res = await fetch(`/api/email/messages/${selectedMessage.id}/draft-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailBody }),
      });
      const data = await res.json();
      if (res.ok && data.draft) {
        setDraft(data.draft);
        setDraftTo(data.to ?? selectedMessage.from);
        setDraftSubject(data.subject ?? `Re: ${selectedMessage.subject}`);
        setDraftStep("draft_ready");
      } else {
        setToast(data.error ?? "Failed to draft");
        setDraftStep("idle");
      }
    } catch {
      setToast("Failed to draft reply");
      setDraftStep("idle");
    }
  };

  const handleSendDraft = async () => {
    setDraftStep("sending");
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: draftTo, subject: draftSubject, body: draft }),
      });
      const data = await res.json();
      if (data.ok) {
        setToast("Email sent!");
        setDraftStep("idle");
        setDraft("");
      } else {
        setToast(data.message ?? "Send not yet available. Copy the draft and send manually.");
        setDraftStep("draft_ready");
      }
    } catch {
      setToast("Send failed");
      setDraftStep("draft_ready");
    }
    setTimeout(() => setToast(null), 4000);
  };

  const handleConnectGmail = () => {
    window.location.href = "/api/email/connect/gmail";
  };

  const handleConnectOutlook = () => {
    window.location.href = "/api/email/connect/outlook";
  };

  const handleConnectIcloud = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!icloudEmail || !icloudPassword) return;
    const res = await fetch("/api/email/connect/icloud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: icloudEmail, appPassword: icloudPassword }),
    });
    const data = await res.json();
    if (data.ok) {
      setConnectOpen(false);
      setIcloudEmail("");
      setIcloudPassword("");
      await fetchAccounts();
      setToast("iCloud connected");
    } else {
      setToast(data.error ?? "Connection failed");
    }
    setTimeout(() => setToast(null), 3000);
  };

  const aiSummaryText = (m: EmailMessage) => {
    if (m.aiSummary?.trim()) return m.aiSummary;
    const items = (m.actionItems as string[] | undefined) ?? [];
    if (items.length > 0) return items.slice(0, 2).join(". ");
    return m.snippet?.slice(0, 120) ?? "";
  };

  const handleUpdateRequiresResponse = async (msg: EmailMessage, value: boolean) => {
    setUpdatingRespond(true);
    try {
      const res = await fetch(`/api/email/messages/${msg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiresResponse: value }),
      });
      if (res.ok) {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, requiresResponse: value } : m)));
        if (selectedMessage?.id === msg.id) setSelectedMessage({ ...selectedMessage, requiresResponse: value });
      } else {
        const data = await res.json();
        setToast(data.error ?? "Update failed");
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      setToast("Update failed");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setUpdatingRespond(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full max-w-full overflow-hidden gap-2">
      {/* Left: Accounts */}
      <Card className="flex w-48 min-w-[120px] shrink-0 flex-col overflow-hidden p-2">
        <div className="flex items-center justify-between gap-1">
          <h2 className="truncate text-sm font-semibold">Accounts</h2>
          <div className="flex flex-col items-end gap-0.5">
            <Button size="sm" variant="outline" onClick={handleSync} disabled={syncLoading} className="shrink-0 text-xs">
              {syncLoading ? "…" : "Sync"}
            </Button>
            {syncMinutesAgo !== null && (
              <span className="text-[9px] text-zinc-500">{syncMinutesAgo === 0 ? "just now" : `${syncMinutesAgo}m ago`}</span>
            )}
          </div>
        </div>
        <ScrollArea className="mt-2 flex-1 min-h-0">
          <div className="space-y-1">
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedAccountId(selectedAccountId === a.id ? null : a.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs transition-colors",
                  selectedAccountId === a.id ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                )}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-medium">
                  <ProviderIcon provider={a.provider} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-zinc-200">{a.email}</p>
                </div>
                {a.unreadCount > 0 && (
                  <span className="rounded-full bg-[#6C63FF] px-1.5 py-0.5 text-[10px] text-white">
                    {a.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
        <Button className="mt-2 w-full text-xs" variant="outline" size="sm" onClick={() => setConnectOpen(true)}>
          Connect
        </Button>
      </Card>

      {/* Center: Email list - Sender, Subject, AI summary on left; Importance, Requires response on right */}
      <Card className="flex min-w-0 flex-1 flex-col overflow-hidden p-0">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 p-2">
          <h3 className="text-sm font-medium">Inbox</h3>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="divide-y divide-zinc-800">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-start gap-2 p-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded bg-zinc-800 animate-pulse" />
                    <div className="h-3 w-full rounded bg-zinc-800 animate-pulse" />
                    <div className="h-2 w-1/2 rounded bg-zinc-800/80 animate-pulse" />
                  </div>
                  <div className="h-5 w-10 shrink-0 rounded bg-zinc-800 animate-pulse" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="p-4 text-sm text-zinc-400">No emails. Connect and sync.</div>
          ) : (
            <>
            <div className="divide-y divide-zinc-800">
              {messages.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleSelectMessage(m)}
                  className={cn(
                    "flex w-full items-start gap-2 p-3 text-left transition-colors hover:bg-zinc-800/50",
                    selectedMessage?.id === m.id && "bg-zinc-800",
                    !m.isRead && "bg-zinc-900/30"
                  )}
                >
                  <div className="min-w-0 flex-1 shrink">
                    <p className="truncate text-sm font-medium text-zinc-200">{m.from}</p>
                    <p className="truncate text-sm text-zinc-300">{m.subject}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
                      {aiSummaryText(m) || "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <ImportanceBadge importance={m.importance} />
                    {m.requiresResponse && (
                      <span className="rounded bg-amber-900/40 px-1.5 py-0.5 text-[10px] text-amber-300">
                        Reply
                      </span>
                    )}
                    {!m.isRead && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#6C63FF]" />
                    )}
                  </div>
                </button>
              ))}
            </div>
            {hasMore && (
              <div className="p-2 border-t border-zinc-800">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
            </>
          )}
        </ScrollArea>
      </Card>

      {/* Right: Email detail */}
      <Card className="flex w-80 min-w-0 shrink-0 flex-col overflow-hidden p-0 lg:w-96">
        {selectedMessage ? (
          <>
            <div className="flex shrink-0 flex-col gap-2 border-b border-zinc-800 p-3">
              <h4 className="truncate text-sm font-medium">{selectedMessage.subject}</h4>
              <p className="text-xs text-zinc-400 truncate">From: {selectedMessage.from}</p>
              <p className="text-xs text-zinc-500">
                {new Date(selectedMessage.receivedAt).toLocaleString()}
              </p>
              {(selectedMessage.actionItems as string[] | undefined)?.length ? (
                <div className="rounded border border-zinc-700 bg-zinc-900/50 p-2">
                  <p className="text-xs font-medium text-zinc-400">Action items</p>
                  <ul className="mt-1 list-inside list-disc text-xs text-zinc-300">
                    {(selectedMessage.actionItems as string[]).map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={selectedMessage.requiresResponse ? "default" : "outline"}
                  disabled={updatingRespond}
                  onClick={() => handleUpdateRequiresResponse(selectedMessage, true)}
                >
                  Need to respond
                </Button>
                <Button
                  size="sm"
                  variant={!selectedMessage.requiresResponse ? "default" : "outline"}
                  disabled={updatingRespond}
                  onClick={() => handleUpdateRequiresResponse(selectedMessage, false)}
                >
                  Don&apos;t need to respond
                </Button>
              </div>
              {selectedMessage.requiresResponse && draftStep === "idle" && (
                <Button size="sm" variant="outline" onClick={() => setDraftStep("asking")}>
                  Draft a reply?
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1 min-h-0 p-3">
              {bodyLoading ? (
                <p className="text-sm text-zinc-500">Loading…</p>
              ) : draftStep === "draft_ready" || draftStep === "sending" ? (
                <div className="space-y-2">
                  <label className="block text-xs text-zinc-400">Draft reply</label>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    disabled={draftStep === "sending"}
                    rows={12}
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSendDraft} disabled={draftStep === "sending"}>
                      {draftStep === "sending" ? "Sending…" : "Send"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setDraftStep("idle"); setDraft(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : emailBody.includes("<") ? (
                <div
                  className="prose prose-invert prose-sm max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: emailBody }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-sm text-zinc-300">{emailBody}</pre>
              )}
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-zinc-500">
            Select an email
          </div>
        )}
      </Card>

      {/* Draft confirmation dialog */}
      <Dialog open={draftStep === "asking"} onOpenChange={(o) => !o && setDraftStep("idle")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Draft a reply?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            This email appears to need a response. Should I draft a reply for you to review?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraftStep("idle")}>
              No
            </Button>
            <Button onClick={handleDraftReply}>
              Yes, draft it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drafting overlay - show in detail panel when drafting */}
      {draftStep === "drafting" && selectedMessage && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-zinc-900 px-6 py-4 text-sm">Drafting reply…</div>
        </div>
      )}

      {/* Connect modal */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
              />
              <Input
                type="password"
                placeholder="App-specific password"
                value={icloudPassword}
                onChange={(e) => setIcloudPassword(e.target.value)}
              />
              <Button type="submit" variant="outline" className="w-full">
                Connect iCloud
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-100 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
