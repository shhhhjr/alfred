"use client";

import { useEffect, useState } from "react";

/** Resets daily at midnight UTC (Fortnite-style). */
function getNextReset(): Date {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return next;
}

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "0h 0m 0s";
  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((ms % (1000 * 60)) / 1000);
  return `${h}h ${m}m ${s}s`;
}

export function ShopResetTimer() {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [nextReset, setNextReset] = useState<Date | null>(null);

  useEffect(() => {
    const next = getNextReset();
    setNextReset(next);

    const tick = () => {
      const ms = next.getTime() - Date.now();
      setTimeLeft(ms <= 0 ? 0 : ms);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (timeLeft === null || !nextReset) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-3">
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Shop resets in</span>
      <span className="font-mono text-lg font-semibold tabular-nums text-[#6C63FF]">
        {formatTimeLeft(timeLeft)}
      </span>
      <span className="text-xs text-zinc-500">
        {nextReset.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
      </span>
    </div>
  );
}
