import { authOptions } from "@/lib/auth/options";
import { getServerSession } from "next-auth";

export function getAuthSession() {
  return getServerSession(authOptions);
}
