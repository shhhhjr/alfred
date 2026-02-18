import { AuthForm } from "@/components/auth/AuthForm";
import { getAuthSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await getAuthSession();
  if (session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] px-6">
      <AuthForm />
    </div>
  );
}
