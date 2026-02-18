import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import { env } from "@/lib/env";

const SCOPES = ["Mail.Read", "Mail.Send", "User.Read"];

export async function getOutlookOAuthUrl(state: string, returnTo?: string): Promise<string> {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    throw new Error("Outlook OAuth not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.");
  }
  const redirectUri = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/email/callback/outlook`;
  const msal = new ConfidentialClientApplication({
    auth: {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      authority: "https://login.microsoftonline.com/common",
    },
  });
  const finalState = returnTo ? `${state}|${returnTo}` : state;
  const authUrl = await msal.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri,
    state: finalState,
  });
  return authUrl ?? "";
}

export async function exchangeOutlookCode(
  code: string,
  state?: string
): Promise<{ accessToken: string; refreshToken: string | null; email: string }> {
  void state; // validated by callback route
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    throw new Error("Outlook OAuth not configured.");
  }
  const redirectUri = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/email/callback/outlook`;
  const msal = new ConfidentialClientApplication({
    auth: {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      authority: "https://login.microsoftonline.com/common",
    },
  });
  const result = await msal.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri,
  });
  if (!result?.accessToken) {
    throw new Error("No access token received from Microsoft.");
  }
  const client = Client.init({
    authProvider: (done) => done(null, result.accessToken),
  });
  const user = await client.api("/me").select("mail,userPrincipalName").get();
  const email = (user.mail || user.userPrincipalName) ?? "";
  if (!email) {
    throw new Error("Could not fetch Outlook address.");
  }
  const refreshToken = (result as { refreshToken?: string }).refreshToken ?? null;
  return {
    accessToken: result.accessToken,
    refreshToken,
    email,
  };
}

export function getOutlookGraphClient(accessToken: string) {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}
