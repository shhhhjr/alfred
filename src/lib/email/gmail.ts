import { google } from "googleapis";
import { env } from "@/lib/env";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];

export function getGmailOAuthUrl(state: string, returnTo?: string): string {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Gmail OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/email/callback/gmail`;
  const oauth2 = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri);
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: returnTo ? `${state}|${returnTo}` : state,
  });
  return authUrl;
}

export async function exchangeGmailCode(
  code: string,
  state?: string
): Promise<{ accessToken: string; refreshToken: string | null; email: string }> {
  void state; // validated by callback route
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Gmail OAuth not configured.");
  }
  const redirectUri = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/email/callback/gmail`;
  const oauth2 = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri);
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.access_token) {
    throw new Error("No access token received from Google.");
  }
  oauth2.setCredentials(tokens);
  const gmail = google.gmail({ version: "v1", auth: oauth2 });
  const profile = await gmail.users.getProfile({ userId: "me" });
  const email = profile.data.emailAddress ?? "";
  if (!email) {
    throw new Error("Could not fetch Gmail address.");
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    email,
  };
}

export async function getGmailClient(accessToken: string, refreshToken: string | null) {
  const oauth2 = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID!, env.GOOGLE_CLIENT_SECRET!);
  oauth2.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
  });
  return google.gmail({ version: "v1", auth: oauth2 });
}
