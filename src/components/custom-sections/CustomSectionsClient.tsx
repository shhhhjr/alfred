"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

type Section = { id: string; name: string; icon: string; sortOrder: number; entries: unknown[] };

export function CustomSectionsClient() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  const fetchSections = useCallback(async () => {
    const res = await fetch("/api/custom-sections", { cache: "no-store" });
    const data = (await res.json()) as { sections?: Section[] };
    setSections(data.sections ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSections().catch(() => setLoading(false));
  }, [fetchSections]);

  async function createSection(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    await fetch("/api/custom-sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setNewName("");
    await fetchSections();
  }

  if (loading) {
    return <Card className="p-6 text-zinc-400">Loading sections…</Card>;
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h1 className="text-2xl font-semibold">Custom Sections</h1>
        <p className="mt-1 text-sm text-zinc-400">Create named sections to organize your work (e.g. Lead Gen, Projects).</p>
        <form className="mt-4 flex gap-2" onSubmit={createSection}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Section name"
            className="h-10 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
          />
          <Button type="submit">Add Section</Button>
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((s) => (
          <Card key={s.id} className="p-4">
            <Link href={`/sections/${s.id}`} className="block">
              <h3 className="font-semibold">{s.name}</h3>
              <p className="mt-1 text-sm text-zinc-400">{s.entries.length} entries</p>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
