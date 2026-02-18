"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type OwnedItem = {
  id: string;
  name: string;
  kind: "banner" | "title" | "border" | "theme" | string;
};

type Equipped = {
  bannerId: string | null;
  titleId: string | null;
  borderId: string | null;
  themeId: string | null;
};

export function CosmeticsClient() {
  const [owned, setOwned] = useState<OwnedItem[]>([]);
  const [equipped, setEquipped] = useState<Equipped | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/cosmetics", { cache: "no-store" });
        const data = (await res.json()) as { owned?: OwnedItem[]; equipped?: Equipped };
        setOwned(data.owned ?? []);
        setEquipped(
          data.equipped ?? {
            bannerId: null,
            titleId: null,
            borderId: null,
            themeId: null,
          },
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function equip(slot: "banner" | "title" | "border" | "theme", itemId: string) {
    setSaving(`${slot}:${itemId}`);
    try {
      const res = await fetch("/api/cosmetics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, itemId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        alert(data.error ?? "Could not equip item");
        return;
      }
      setEquipped((prev) => {
        const base: Equipped =
          prev ?? { bannerId: null, titleId: null, borderId: null, themeId: null };
        if (slot === "banner") return { ...base, bannerId: itemId };
        if (slot === "title") return { ...base, titleId: itemId };
        if (slot === "border") return { ...base, borderId: itemId };
        return { ...base, themeId: itemId };
      });
    } finally {
      setSaving(null);
    }
  }

  if (loading || !equipped) {
    return <Card className="p-6 text-sm text-zinc-400">Loading cosmetics…</Card>;
  }

  const bannerItems = owned.filter((o) => o.kind === "banner");
  const titleItems = owned.filter((o) => o.kind === "title");
  const borderItems = owned.filter((o) => o.kind === "border");
  const themeItems = owned.filter((o) => o.kind === "theme");

  const slotGroups: { label: string; slot: "banner" | "title" | "border" | "theme"; items: OwnedItem[]; currentId: string | null }[] =
    [
      { label: "Banner", slot: "banner", items: bannerItems, currentId: equipped.bannerId },
      { label: "Title", slot: "title", items: titleItems, currentId: equipped.titleId },
      { label: "Profile Border", slot: "border", items: borderItems, currentId: equipped.borderId },
      { label: "Theme", slot: "theme", items: themeItems, currentId: equipped.themeId },
    ];

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Cosmetics</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Equip banners, titles, borders, and themes you&apos;ve unlocked in the shop.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {slotGroups.map(({ label, slot, items, currentId }) => (
          <div key={slot} className="rounded-md bg-zinc-900 p-3 text-sm">
            <p className="font-medium">{label}</p>
            {items.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">No {label.toLowerCase()}s owned yet.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{item.name}</span>
                    <Button
                      size="xs"
                      variant={currentId === item.id ? "default" : "outline"}
                      disabled={saving !== null}
                      onClick={() => equip(slot, item.id)}
                    >
                      {currentId === item.id ? "Equipped" : "Equip"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

