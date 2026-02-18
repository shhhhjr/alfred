"use client";

import { Button } from "@/components/ui/button";

type Props = {
  description: string;
  onUndo?: () => void;
};

export function ActionCard({ description, onUndo }: Props) {
  return (
    <div className="my-2 flex items-center justify-between gap-3 rounded-lg border border-[#6C63FF]/40 bg-[#6C63FF]/10 px-3 py-2 text-sm">
      <span className="text-zinc-200">✓ {description}</span>
      <Button size="xs" variant="outline" onClick={onUndo ?? (() => {})}>
        Undo
      </Button>
    </div>
  );
}
