"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";

type Props = {
  initialUrl: string | null;
};

export function ProfileAvatarClient({ initialUrl }: Props) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ title: string; description?: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const showToast = useCallback((title: string, description?: string) => {
    setToast({ title, description });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.ok && data.url) {
        setUrl(data.url);
        router.refresh();
        showToast("Photo updated");
      } else {
        const msg = data.error ?? "Upload failed";
        const [title, desc] = msg.includes(". ") ? msg.split(". ") : [msg, undefined];
        showToast(title, desc);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  },
    [router, showToast]
  );

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Profile picture</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Upload a photo. Max 5MB, JPEG/PNG/WebP/GIF.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div
          className="flex h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-zinc-700 bg-zinc-900"
          style={{ minHeight: 96, minWidth: 96 }}
        >
          {url ? (
            url.startsWith("data:") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <Image
                src={url}
                alt="Profile"
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl text-zinc-500">
              ?
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Choose photo"}
          </Button>
          {url && (
            <Button
              size="sm"
              variant="ghost"
              className="text-zinc-400 hover:text-red-400"
              onClick={async () => {
                const res = await fetch("/api/profile/avatar", {
                  method: "DELETE",
                });
                if (res.ok) {
                  setUrl(null);
                  router.refresh();
                }
              }}
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-800 px-4 py-3 text-sm text-zinc-100 shadow-lg">
          <p className="font-medium">{toast.title}</p>
          {toast.description && <p className="mt-1 text-xs text-zinc-400">{toast.description}</p>}
        </div>
      )}
    </Card>
  );
}
