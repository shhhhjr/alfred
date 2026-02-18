"use client";

type Config = {
  gradientFrom?: string;
  gradientTo?: string;
  text?: string;
  color?: string;
  accent?: string;
} | null;

type Props = {
  kind: "banner" | "title" | "border" | "theme";
  config: Config;
  name: string;
};

export function CosmeticPreview({ kind, config, name }: Props) {
  if (kind === "banner") {
    const from = (config as { gradientFrom?: string } | null)?.gradientFrom ?? "#1a1333";
    const to = (config as { gradientTo?: string } | null)?.gradientTo ?? "#6C63FF";
    return (
      <div
        className="h-16 w-full rounded-lg"
        style={{
          background: `linear-gradient(to right, ${from}, ${to})`,
        }}
      />
    );
  }

  if (kind === "title") {
    const text = (config as { text?: string } | null)?.text ?? name;
    return (
      <div className="flex h-16 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/80">
        <span className="text-sm font-semibold text-[#6C63FF]">{text}</span>
      </div>
    );
  }

  if (kind === "border") {
    const color = (config as { color?: string } | null)?.color ?? "#facc15";
    return (
      <div
        className="flex h-16 items-center justify-center rounded-lg bg-zinc-900/80"
        style={{ boxShadow: `inset 0 0 0 3px ${color}` }}
      >
        <span className="text-xs text-zinc-500">Border preview</span>
      </div>
    );
  }

  if (kind === "theme") {
    const accent = (config as { accent?: string } | null)?.accent ?? "#4f46e5";
    return (
      <div className="flex h-16 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/80 p-2">
        <div
          className="h-6 w-6 shrink-0 rounded"
          style={{ backgroundColor: accent }}
        />
        <span className="text-xs text-zinc-500">Theme accent</span>
      </div>
    );
  }

  return null;
}
