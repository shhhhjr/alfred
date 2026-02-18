"use client";

import { useEffect, useState } from "react";

const MS_PER_6_HOURS = 6 * 60 * 60 * 1000;

function getNext6HourReset(): Date {
  const now = Date.now();
  const slot = Math.floor(now / MS_PER_6_HOURS);
  return new Date((slot + 1) * MS_PER_6_HOURS);
}

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "0h 0m 0s";
  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((ms % (1000 * 60)) / 1000);
  return `${h}h ${m}m ${s}s`;
}

export function RotatingPicksTimer() {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [nextReset, setNextReset] = useState<Date | null>(null);

  useEffect(() => {
    const next = getNext6HourReset();
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
    <span className="text-xs text-zinc-500">
      Next rotation in {formatTimeLeft(timeLeft)}
    </span>
  );
}
