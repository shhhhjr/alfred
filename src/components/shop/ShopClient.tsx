"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShopResetTimer } from "./ShopResetTimer";
import { RotatingPicksTimer } from "./RotatingPicksTimer";
import { CosmeticPreview } from "./CosmeticPreview";

type ShopItem = {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  available: boolean;
  kind?: string;
  config?: { gradientFrom?: string; gradientTo?: string; text?: string; color?: string; accent?: string } | null;
};
export function ShopClient() {
  const [balance, setBalance] = useState<number | null>(null);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [rotatingItems, setRotatingItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [walletRes, itemsRes, rotatingRes] = await Promise.all([
      fetch("/api/wallet", { cache: "no-store" }),
      fetch("/api/shop/items", { cache: "no-store" }),
      fetch("/api/shop/items/rotating", { cache: "no-store" }),
    ]);
    const wallet = (await walletRes.json()) as { balance?: number };
    const shop = (await itemsRes.json()) as { items?: ShopItem[] };
    const rotating = (await rotatingRes.json()) as { items?: ShopItem[] };
    setBalance(wallet.balance ?? 0);
    setItems(shop.items ?? []);
    setRotatingItems(rotating.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData().catch(() => setLoading(false));
  }, [fetchData]);

  async function redeem(itemId: string, itemName: string, cost: number) {
    if (balance === null || balance < cost) return;
    setRedeeming(itemId);
    try {
      const res = await fetch("/api/shop/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const data = (await res.json()) as { newBalance?: number; error?: string };
      if (res.ok && data.newBalance !== undefined) {
        setBalance(data.newBalance);
      }
    } finally {
      setRedeeming(null);
    }
  }

  if (loading) {
    return <Card className="p-6 text-zinc-400">Loading shop…</Card>;
  }

  const featured = items.filter((item) => item.kind && item.kind !== "generic");
  const daily = items.filter((item) => !item.kind || item.kind === "generic");

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h1 className="text-2xl font-semibold">Shop</h1>
        <p className="mt-1 text-sm text-zinc-400">Spend Rangs on rewards. Earn Rangs by completing tasks on time.</p>
        <div className="mt-4">
          <ShopResetTimer />
        </div>
        <div className="mt-4 rounded-lg bg-zinc-900 px-4 py-3">
          <span className="text-sm text-zinc-400">Balance</span>
          <p className="text-2xl font-bold text-[#6C63FF]">{balance ?? 0} Rangs</p>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Rotating picks</h2>
            <p className="mt-1 text-sm text-zinc-400">
              6 items from a pool of 50, changing every 6 hours.
            </p>
          </div>
          <RotatingPicksTimer />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rotatingItems.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Run <code className="rounded bg-zinc-800 px-1">npm run prisma:seed</code> to add rotating items.
            </p>
          ) : (
            rotatingItems.map((item) => {
              const isCosmetic = item.kind && item.kind !== "generic";
              const kindLabel =
                item.kind === "banner"
                  ? "Banner"
                  : item.kind === "title"
                    ? "Title"
                    : item.kind === "border"
                      ? "Profile Border"
                      : item.kind === "theme"
                        ? "Theme"
                        : null;
              return (
                <div
                  key={item.id}
                  className={`flex flex-col rounded-lg border p-4 ${
                    isCosmetic
                      ? "border-zinc-700 bg-gradient-to-br from-[#111827] to-[#020617] shadow-lg"
                      : "border-zinc-800 bg-zinc-900/50"
                  }`}
                >
                  {isCosmetic && (
                    <div className="mb-3">
                      <CosmeticPreview
                        kind={item.kind as "banner" | "title" | "border" | "theme"}
                        config={item.config ?? null}
                        name={item.name}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{item.name}</p>
                    {kindLabel && (
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                        {kindLabel}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-1 text-sm text-zinc-400">{item.description}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[#6C63FF] font-semibold">{item.cost} Rangs</span>
                    <Button
                      size="sm"
                      disabled={(balance ?? 0) < item.cost || !!redeeming}
                      onClick={() => redeem(item.id, item.name, item.cost)}
                    >
                      {redeeming === item.id ? "…" : "Redeem"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Featured cosmetics</h2>
        <p className="mt-1 text-sm text-zinc-400">Limited-run banners, titles, borders, and themes.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {featured.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No cosmetics yet. Run{" "}
              <code className="rounded bg-zinc-800 px-1">npm run prisma:seed</code> to add demo items.
            </p>
          ) : (
            featured.map((item) => {
              const kindLabel =
                item.kind === "banner"
                  ? "Banner"
                  : item.kind === "title"
                    ? "Title"
                    : item.kind === "border"
                      ? "Profile Border"
                      : item.kind === "theme"
                        ? "Theme"
                        : null;
              return (
                <div
                  key={item.id}
                  className="flex flex-col rounded-lg border border-zinc-700 bg-gradient-to-br from-[#111827] to-[#020617] p-4 shadow-lg"
                >
                  <div className="mb-3">
                    <CosmeticPreview
                      kind={item.kind as "banner" | "title" | "border" | "theme"}
                      config={item.config ?? null}
                      name={item.name}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{item.name}</p>
                    {kindLabel && (
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                        {kindLabel}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-1 text-sm text-zinc-400">{item.description}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[#6C63FF] font-semibold">{item.cost} Rangs</span>
                    <Button
                      size="sm"
                      disabled={(balance ?? 0) < item.cost || !!redeeming}
                      onClick={() => redeem(item.id, item.name, item.cost)}
                    >
                      {redeeming === item.id ? "…" : "Redeem"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Daily operations</h2>
        <p className="mt-1 text-sm text-zinc-400">Utility boosts and helpers for your study ops.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {daily.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No items yet. Run{" "}
              <code className="rounded bg-zinc-800 px-1">npm run prisma:seed</code> to add demo items.
            </p>
          ) : (
            daily.map((item) => (
              <div
                key={item.id}
                className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
              >
                <p className="font-medium">{item.name}</p>
                {item.description && (
                  <p className="mt-1 text-sm text-zinc-400">{item.description}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[#6C63FF] font-semibold">{item.cost} Rangs</span>
                  <Button
                    size="sm"
                    disabled={(balance ?? 0) < item.cost || !!redeeming}
                    onClick={() => redeem(item.id, item.name, item.cost)}
                  >
                    {redeeming === item.id ? "…" : "Redeem"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
