export type NormalizedEmail = {
  id: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: Date;
  isRead: boolean;
  provider: "gmail" | "outlook" | "icloud";
  accountId: string;
};

export function normalizeGmail(
  raw: {
    id?: string;
    snippet?: string;
    threadId?: string;
    payload?: { headers?: Array<{ name?: string; value?: string }> };
    internalDate?: string;
    labelIds?: string[];
  },
  accountId: string
): NormalizedEmail {
  const headers = raw.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
  const from = get("from");
  const to = get("to");
  const subject = get("subject");
  const snippet = raw.snippet ?? "";
  const date = raw.internalDate ? new Date(Number(raw.internalDate)) : new Date();
  const isRead = !(raw.labelIds ?? []).includes("UNREAD");
  return {
    id: raw.id ?? "",
    from,
    to,
    subject,
    snippet,
    date,
    isRead,
    provider: "gmail",
    accountId,
  };
}

export function normalizeOutlook(
  raw: { id?: string; subject?: string; bodyPreview?: string; from?: { emailAddress?: { address?: string } }; toRecipients?: Array<{ emailAddress?: { address?: string } }>; receivedDateTime?: string; isRead?: boolean },
  accountId: string
): NormalizedEmail {
  const from = raw.from?.emailAddress?.address ?? "";
  const to = (raw.toRecipients ?? []).map((r) => r.emailAddress?.address ?? "").filter(Boolean).join(", ");
  return {
    id: raw.id ?? "",
    from,
    to,
    subject: raw.subject ?? "",
    snippet: raw.bodyPreview ?? "",
    date: raw.receivedDateTime ? new Date(raw.receivedDateTime) : new Date(),
    isRead: raw.isRead ?? false,
    provider: "outlook",
    accountId,
  };
}

export function normalizeICloud(
  raw: { id: string; from: string; to: string; subject: string; snippet: string; date: Date; isRead: boolean },
  accountId: string
): NormalizedEmail {
  return {
    ...raw,
    provider: "icloud",
    accountId,
  };
}
