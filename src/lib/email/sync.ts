import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/security/encryption";
import { getGmailClient } from "./gmail";
import { getOutlookGraphClient } from "./outlook";
import { fetchICloudMessages } from "./icloud";
import { normalizeGmail, normalizeOutlook, normalizeICloud, type NormalizedEmail } from "./parser";
import { analyzeEmailsWithAI } from "./ai-analyzer";

export type SyncResult = { syncedAccounts: number; newMessages: number };

export async function syncUserEmails(userId: string): Promise<SyncResult> {
  const accounts = await prisma.emailAccount.findMany({
    where: { userId },
  });

  if (accounts.length === 0) {
    return { syncedAccounts: 0, newMessages: 0 };
  }

  const cutOff = new Date();
  cutOff.setHours(cutOff.getHours() - 24);

  const allNew: NormalizedEmail[] = [];

  for (const acc of accounts) {
    let since = acc.lastSynced ? new Date(acc.lastSynced) : new Date(cutOff);
    if (since.getTime() < cutOff.getTime()) since = cutOff;

    let messages: NormalizedEmail[] = [];

    if (acc.provider === "gmail") {
      if (!acc.accessToken || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) continue;
      const token = decrypt(acc.accessToken);
      const refresh = acc.refreshToken ? decrypt(acc.refreshToken) : null;
      const gmail = await getGmailClient(token, refresh);
      const q = `after:${Math.floor(since.getTime() / 1000)}`;
      const list = await gmail.users.messages.list({ userId: "me", q, maxResults: 100 });
      const ids = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);
      for (const id of ids) {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["From", "To", "Subject", "Date"],
        });
        const payload = msg.data;
        messages.push(
          normalizeGmail(
            {
              id: payload.id ?? undefined,
              snippet: payload.snippet ?? undefined,
              threadId: payload.threadId ?? undefined,
              payload: payload.payload as { headers?: Array<{ name?: string; value?: string }> } | undefined,
              internalDate: payload.internalDate ?? undefined,
              labelIds: payload.labelIds as string[] | undefined,
            },
            acc.id
          )
        );
      }
    } else if (acc.provider === "outlook") {
      if (!acc.accessToken) continue;
      const token = decrypt(acc.accessToken);
      const client = getOutlookGraphClient(token);
      const res = await client
        .api("/me/messages")
        .filter(`receivedDateTime ge ${since.toISOString()}`)
        .select("id,subject,bodyPreview,from,toRecipients,receivedDateTime,isRead")
        .top(100)
        .orderby("receivedDateTime desc")
        .get();
      const items = (res.value ?? []) as Array<Record<string, unknown>>;
      messages = items.map((raw) =>
        normalizeOutlook(
          {
            id: raw.id as string,
            subject: raw.subject as string,
            bodyPreview: raw.bodyPreview as string,
            from: raw.from as { emailAddress?: { address?: string } },
            toRecipients: raw.toRecipients as Array<{ emailAddress?: { address?: string } }>,
            receivedDateTime: raw.receivedDateTime as string,
            isRead: raw.isRead as boolean,
          },
          acc.id
        )
      );
    } else if (acc.provider === "icloud") {
      if (!acc.imapPassword) continue;
      const pass = decrypt(acc.imapPassword);
      const raw = await fetchICloudMessages(acc.email, pass, since);
      messages = raw.map((r) => normalizeICloud(r, acc.id));
    }

    for (const m of messages) {
      const existing = await prisma.emailMessage.findUnique({
        where: {
          emailAccountId_providerId: { emailAccountId: acc.id, providerId: m.id },
        },
      });
      if (!existing) {
        allNew.push(m);
        await prisma.emailMessage.create({
          data: {
            userId,
            emailAccountId: acc.id,
            providerId: m.id,
            fromAddress: m.from,
            subject: m.subject,
            snippet: m.snippet,
            receivedAt: m.date,
            isRead: m.isRead,
          },
        });
      }
    }

    await prisma.emailAccount.update({
      where: { id: acc.id },
      data: { lastSynced: new Date() },
    });
  }

  if (allNew.length > 0) {
    await analyzeEmailsWithAI(userId, allNew);
  }

  await prisma.activityLog.create({
    data: {
      userId,
      action: "email_synced",
      description: `Synced ${accounts.length} account(s), ${allNew.length} new messages.`,
      metadata: { accountCount: accounts.length, newCount: allNew.length },
    },
  });

  return { syncedAccounts: accounts.length, newMessages: allNew.length };
}
