import { ImapFlow } from "imapflow";

const ICLOUD_IMAP = {
  host: "imap.mail.me.com",
  port: 993,
  secure: true,
};

export async function testICloudConnection(
  email: string,
  appPassword: string
): Promise<{ success: true; email: string }> {
  const client = new ImapFlow({
    ...ICLOUD_IMAP,
    auth: { user: email.trim(), pass: appPassword.trim() },
    logger: false,
    socketTimeout: 20000,
  });
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  lock.release();
  await client.logout();
  return { success: true, email };
}

export type ICloudMessage = {
  id: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: Date;
  isRead: boolean;
};

export async function fetchICloudMessages(
  email: string,
  appPassword: string,
  since?: Date
): Promise<ICloudMessage[]> {
  const client = new ImapFlow({
    ...ICLOUD_IMAP,
    auth: { user: email, pass: appPassword },
    logger: false,
  });
  await client.connect();
  const results: ICloudMessage[] = [];
  const lock = await client.getMailboxLock("INBOX");
  try {
    const range = since ? { since } : "1:*";
    for await (const msg of client.fetch(range, {
      envelope: true,
      source: { start: 0, maxLength: 500 },
      flags: true,
    })) {
      const env = (msg.envelope ?? {}) as Record<string, unknown>;
      const fromArr = env.from as Array<{ address?: string }> | undefined;
      const fromAddr = fromArr?.[0]?.address ?? "";
      const toArr = (env.to ?? []) as Array<{ address?: string }>;
      const toAddrs = toArr.map((a) => a.address ?? "").filter(Boolean).join(", ");
      const subj = env.subject;
      const subject = Array.isArray(subj) ? subj.join(" ") : String(subj ?? "");
      const source = msg.source?.toString() ?? "";
      const snippet = source.slice(0, 300).replace(/\s+/g, " ").trim();
      const flags = msg.flags ?? new Set<string>();
      const isRead = flags.has("\\Seen");
      results.push({
        id: String(msg.uid),
        from: fromAddr,
        to: toAddrs,
        subject,
        snippet,
        date: (env.date as Date) ?? new Date(),
        isRead,
      });
    }
  } finally {
    lock.release();
    await client.logout();
  }
  return results;
}
