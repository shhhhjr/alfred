"use client";

import { FormEvent, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Entry = { id: string; payload: unknown; nextAction: Date | string | null; tags: string[] };
type Section = { id: string; name: string; icon: string; entries: Entry[] };

export function SectionDetailClient({ section: initial }: { section: Section }) {
  const [entries, setEntries] = useState(initial.entries);
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");

  const fetchEntries = useCallback(async () => {
    const res = await fetch(`/api/custom-sections/${initial.id}`, { cache: "no-store" });
    const data = (await res.json()) as { section?: Section };
    if (data.section) setEntries(data.section.entries);
  }, [initial.id]);

  async function addEntry(event: FormEvent) {
    event.preventDefault();
    if (!notes.trim()) return;
    await fetch(`/api/custom-sections/${initial.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: { notes: notes.trim() },
        nextAction: nextAction ? new Date(nextAction).toISOString() : null,
        tags: [],
      }),
    });
    setNotes("");
    setNextAction("");
    await fetchEntries();
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h1 className="text-2xl font-semibold">{initial.name}</h1>
        <form className="mt-4 flex flex-wrap gap-2" onSubmit={addEntry}>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add entry / note"
            className="h-10 flex-1 min-w-[200px] rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
          />
          <input
            type="datetime-local"
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
            placeholder="Next action"
          />
          <Button type="submit">Add</Button>
        </form>
      </Card>

      <Card className="p-4">
        <div className="space-y-2">
          {entries.length === 0 ? (
            <p className="text-sm text-zinc-500">No entries yet.</p>
          ) : (
            entries.map((e) => (
              <div
                key={e.id}
                className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-sm"
              >
                <pre className="whitespace-pre-wrap text-zinc-300">
                  {JSON.stringify(e.payload, null, 2)}
                </pre>
                {e.nextAction != null && (
                  <p className="mt-1 text-xs text-zinc-500">
                    Next: {new Date(e.nextAction as string | Date).toLocaleString()}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
