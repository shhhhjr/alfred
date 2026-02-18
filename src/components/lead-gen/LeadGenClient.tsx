"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Entry = {
  id: string;
  prospect: string;
  company: string;
  channel: string | null;
  contactEmail: string | null;
  contactInstagram: string | null;
  contactLinkedIn: string | null;
  contactPhone: string | null;
  stage: string;
  contactStatus: string | null;
  nextFollowUp: string | null;
  nextSteps: string | null;
  result: string | null;
  notes: string | null;
  isClosed: boolean;
  isConfirmed: boolean;
};

const STAGES = ["new", "contacted", "qualified", "proposal", "closed"] as const;
const CONTACT_STATUSES = ["not_reached", "reached", "responded", "meeting_scheduled", "no_response"] as const;

const emptyForm = {
  prospect: "",
  company: "",
  channel: "",
  contactEmail: "",
  contactInstagram: "",
  contactLinkedIn: "",
  contactPhone: "",
  stage: "new",
  contactStatus: "",
  nextFollowUp: "",
  nextSteps: "",
  notes: "",
  isClosed: false,
  isConfirmed: false,
};

function entryToForm(e: Entry) {
  return {
    prospect: e.prospect,
    company: e.company,
    channel: e.channel ?? "",
    contactEmail: e.contactEmail ?? "",
    contactInstagram: e.contactInstagram ?? "",
    contactLinkedIn: e.contactLinkedIn ?? "",
    contactPhone: e.contactPhone ?? "",
    stage: e.stage,
    contactStatus: e.contactStatus ?? "",
    nextFollowUp: e.nextFollowUp ? e.nextFollowUp.slice(0, 16) : "",
    nextSteps: e.nextSteps ?? "",
    notes: e.notes ?? "",
    isClosed: e.isClosed,
    isConfirmed: e.isConfirmed,
  };
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function ContactRow({ label, value, href }: { label: string; value: string | null; href?: string }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-zinc-500">{label}:</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#6C63FF] hover:underline truncate max-w-[200px]">
          {value}
        </a>
      ) : (
        <span className="truncate max-w-[200px]">{value}</span>
      )}
    </div>
  );
}

export function LeadGenClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  const fetchEntries = useCallback(async () => {
    const res = await fetch("/api/lead-gen", { cache: "no-store" });
    const data = (await res.json()) as { entries?: Entry[] };
    setEntries(data.entries ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries().catch(() => setLoading(false));
  }, [fetchEntries]);

  async function createEntry(event: FormEvent) {
    event.preventDefault();
    if (!form.prospect.trim() || !form.company.trim()) return;
    setCreating(true);
    try {
      await fetch("/api/lead-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect: form.prospect.trim(),
          company: form.company.trim(),
          channel: form.channel.trim() || null,
          contactEmail: form.contactEmail.trim() || null,
          contactInstagram: form.contactInstagram.trim() || null,
          contactLinkedIn: form.contactLinkedIn.trim() || null,
          contactPhone: form.contactPhone.trim() || null,
          stage: form.stage || "new",
          contactStatus: form.contactStatus.trim() || null,
          nextFollowUp: form.nextFollowUp ? new Date(form.nextFollowUp).toISOString() : null,
          nextSteps: form.nextSteps.trim() || null,
          notes: form.notes.trim() || null,
          isClosed: form.isClosed,
          isConfirmed: form.isConfirmed,
        }),
      });
      setForm(emptyForm);
      await fetchEntries();
    } finally {
      setCreating(false);
    }
  }

  async function updateEntry(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    await fetch(`/api/lead-gen/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospect: form.prospect.trim(),
        company: form.company.trim(),
        channel: form.channel.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        contactInstagram: form.contactInstagram.trim() || null,
        contactLinkedIn: form.contactLinkedIn.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        stage: form.stage || "new",
        contactStatus: form.contactStatus.trim() || null,
        nextFollowUp: form.nextFollowUp ? new Date(form.nextFollowUp).toISOString() : null,
        nextSteps: form.nextSteps.trim() || null,
        notes: form.notes.trim() || null,
        isClosed: form.isClosed,
        isConfirmed: form.isConfirmed,
      }),
    });
    setEditing(null);
    setForm(emptyForm);
    await fetchEntries();
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this lead?")) return;
    await fetch(`/api/lead-gen/${id}`, { method: "DELETE" });
    setEditing(null);
    await fetchEntries();
  }

  const openEdit = (e: Entry) => {
    setEditing(e);
    setForm(entryToForm(e));
  };

  const newCount = entries.filter((e) => e.stage === "new" && !e.isClosed).length;
  const followUpDue = entries.filter((e) => {
    if (!e.nextFollowUp || e.isClosed) return false;
    return new Date(e.nextFollowUp) <= new Date();
  }).length;
  const confirmedCount = entries.filter((e) => e.isConfirmed && !e.isClosed).length;
  const closedCount = entries.filter((e) => e.isClosed).length;

  const activeEntries = entries.filter((e) => !e.isClosed);
  const closedEntries = entries.filter((e) => e.isClosed);

  if (loading) {
    return <Card className="p-6 text-zinc-400">Loading…</Card>;
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h1 className="text-2xl font-semibold">Lead Gen</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Track prospects, contact info, outreach status, next steps, and closed leads.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-md bg-zinc-900 p-3">
            <p className="text-zinc-400">New</p>
            <p className="text-lg font-semibold">{newCount}</p>
          </div>
          <div className="rounded-md bg-zinc-900 p-3">
            <p className="text-zinc-400">Follow-ups due</p>
            <p className="text-lg font-semibold">{followUpDue}</p>
          </div>
          <div className="rounded-md bg-zinc-900 p-3">
            <p className="text-zinc-400">Confirmed</p>
            <p className="text-lg font-semibold text-emerald-400">{confirmedCount}</p>
          </div>
          <div className="rounded-md bg-zinc-900 p-3">
            <p className="text-zinc-400">Closed</p>
            <p className="text-lg font-semibold text-zinc-500">{closedCount}</p>
          </div>
        </div>

        <form className="mt-4 space-y-3" onSubmit={createEntry}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={form.prospect}
              onChange={(e) => setForm((f) => ({ ...f, prospect: e.target.value }))}
              placeholder="Prospect name"
              required
            />
            <Input
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              placeholder="Company"
              required
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              value={form.contactEmail}
              onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
              type="email"
              placeholder="Email"
            />
            <Input
              value={form.contactInstagram}
              onChange={(e) => setForm((f) => ({ ...f, contactInstagram: e.target.value }))}
              placeholder="Instagram"
            />
            <Input
              value={form.contactLinkedIn}
              onChange={(e) => setForm((f) => ({ ...f, contactLinkedIn: e.target.value }))}
              placeholder="LinkedIn"
            />
            <Input
              value={form.contactPhone}
              onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
              placeholder="Phone"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              value={form.channel}
              onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
              placeholder="Channel (e.g. cold email, DM)"
              className="max-w-[200px]"
            />
            <Input
              value={form.nextFollowUp}
              onChange={(e) => setForm((f) => ({ ...f, nextFollowUp: e.target.value }))}
              type="datetime-local"
              placeholder="Next follow-up"
              className="max-w-[220px]"
            />
            <Button type="submit" disabled={creating}>
              {creating ? "Adding…" : "Add Lead"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Active leads</h2>
        <p className="mt-1 text-sm text-zinc-400">Leads in progress. Click to edit.</p>
        <div className="mt-4 space-y-3">
          {activeEntries.length === 0 ? (
            <p className="text-sm text-zinc-500">No active leads. Add one above.</p>
          ) : (
            activeEntries.map((e) => (
              <div
                key={e.id}
                onClick={() => openEdit(e)}
                className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-zinc-700 hover:bg-zinc-900/80"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{e.prospect}</span>
                      <span className="text-zinc-500">—</span>
                      <span className="text-zinc-300">{e.company}</span>
                      {e.isConfirmed && (
                        <Badge variant="secondary" className="text-emerald-400 border-emerald-700/50 bg-emerald-900/30">
                          Confirmed
                        </Badge>
                      )}
                      {e.stage !== "new" && (
                        <Badge variant="outline">{e.stage}</Badge>
                      )}
                      {e.contactStatus && (
                        <span className="text-xs text-zinc-500">({e.contactStatus})</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <ContactRow label="Email" value={e.contactEmail} href={e.contactEmail ? `mailto:${e.contactEmail}` : undefined} />
                      <ContactRow label="IG" value={e.contactInstagram} href={e.contactInstagram ? `https://instagram.com/${e.contactInstagram.replace(/^@/, "")}` : undefined} />
                      <ContactRow label="LinkedIn" value={e.contactLinkedIn} href={e.contactLinkedIn ?? undefined} />
                      <ContactRow label="Phone" value={e.contactPhone} href={e.contactPhone ? `tel:${e.contactPhone}` : undefined} />
                      {e.channel && <span className="text-zinc-500">Via {e.channel}</span>}
                    </div>
                    {(e.nextSteps || e.nextFollowUp) && (
                      <div className="mt-2 text-sm">
                        {e.nextSteps && <p className="text-zinc-400"><span className="text-zinc-500">Next:</span> {e.nextSteps}</p>}
                        {e.nextFollowUp && (
                          <p className={`text-xs ${new Date(e.nextFollowUp) <= new Date() ? "text-amber-400" : "text-zinc-500"}`}>
                            Follow-up: {formatDate(e.nextFollowUp)}
                            {new Date(e.nextFollowUp) <= new Date() && " (due)"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {closedEntries.length > 0 && (
        <Card className="p-5">
          <h2 className="text-lg font-semibold">Closed leads</h2>
          <div className="mt-4 space-y-2">
            {closedEntries.map((e) => (
              <div
                key={e.id}
                onClick={() => openEdit(e)}
                className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-800/80 bg-zinc-900/30 p-3 opacity-75 transition hover:opacity-100"
              >
                <div>
                  <span className="font-medium">{e.prospect}</span>
                  <span className="text-zinc-500"> — {e.company}</span>
                  {e.result && <span className="ml-2 text-sm text-zinc-400">({e.result})</span>}
                </div>
                <Badge variant="outline" className="border-zinc-600">Closed</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={updateEntry} className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Name</label>
                <Input
                  value={form.prospect}
                  onChange={(e) => setForm((f) => ({ ...f, prospect: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Company</label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Contact info</label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                  placeholder="Email"
                />
                <Input
                  value={form.contactInstagram}
                  onChange={(e) => setForm((f) => ({ ...f, contactInstagram: e.target.value }))}
                  placeholder="Instagram"
                />
                <Input
                  value={form.contactLinkedIn}
                  onChange={(e) => setForm((f) => ({ ...f, contactLinkedIn: e.target.value }))}
                  placeholder="LinkedIn URL"
                />
                <Input
                  value={form.contactPhone}
                  onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                  placeholder="Phone"
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Channel</label>
                <Input
                  value={form.channel}
                  onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                  placeholder="How you reached them"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Stage</label>
                <select
                  value={form.stage}
                  onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
                  className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Contact status</label>
              <select
                value={form.contactStatus}
                onChange={(e) => setForm((f) => ({ ...f, contactStatus: e.target.value }))}
                className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
              >
                <option value="">—</option>
                {CONTACT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Next follow-up</label>
              <Input
                type="datetime-local"
                value={form.nextFollowUp}
                onChange={(e) => setForm((f) => ({ ...f, nextFollowUp: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Next steps</label>
              <textarea
                value={form.nextSteps}
                onChange={(e) => setForm((f) => ({ ...f, nextSteps: e.target.value }))}
                placeholder="What to do next?"
                rows={2}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm placeholder:text-zinc-500 focus:border-[#6C63FF] focus:outline-none focus:ring-1 focus:ring-[#6C63FF]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm placeholder:text-zinc-500 focus:border-[#6C63FF] focus:outline-none focus:ring-1 focus:ring-[#6C63FF]"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isConfirmed}
                  onChange={(e) => setForm((f) => ({ ...f, isConfirmed: e.target.checked }))}
                  className="rounded border-zinc-600 bg-zinc-800"
                />
                Confirmed lead
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isClosed}
                  onChange={(e) => setForm((f) => ({ ...f, isClosed: e.target.checked }))}
                  className="rounded border-zinc-600 bg-zinc-800"
                />
                Closed
              </label>
            </div>
            <DialogFooter>
              {editing && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-red-400 hover:bg-red-500/10"
                  onClick={() => deleteEntry(editing.id)}
                >
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
