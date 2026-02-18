import type { AutomationLevel } from "@/types";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    automationLevel: AutomationLevel;
  }

  interface Session {
    user: {
      id: string;
      automationLevel: AutomationLevel;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    automationLevel: AutomationLevel;
  }
}
