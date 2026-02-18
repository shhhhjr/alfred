"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";

type AuthMode = "login" | "register";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitInProgressRef = useRef(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInProgressRef.current) return;
    submitInProgressRef.current = true;
    setError(null);
    setIsLoading(true);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Please enter email and password.");
      setIsLoading(false);
      submitInProgressRef.current = false;
      return;
    }

    try {
      if (mode === "register") {
        const registerResponse = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim() || undefined,
            email: trimmedEmail,
            password,
          }),
        });

        const body = (await registerResponse.json()) as { error?: string };
        if (!registerResponse.ok) {
          if (registerResponse.status === 409) {
            setError("An account with this email already exists. Use Sign in instead.");
            setMode("login");
            setIsLoading(false);
            submitInProgressRef.current = false;
            return;
          }
          throw new Error(body.error ?? "Failed to create account.");
        }
      }

      const authResult = await signIn("credentials", {
        email: trimmedEmail,
        password,
        redirect: false,
      });

      if (authResult?.error) {
        setError(authResult.error === "CredentialsSignin" ? "Invalid email or password." : authResult.error);
        setIsLoading(false);
        submitInProgressRef.current = false;
        return;
      }

      if (authResult?.ok) {
        router.push("/");
        router.refresh();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong. Try again.");
    } finally {
      setIsLoading(false);
      submitInProgressRef.current = false;
    }
  }

  return (
    <Card className="w-full max-w-md p-6">
      <h1 className="text-2xl font-semibold text-zinc-100">Alfred AI</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {mode === "login" ? "Sign in to continue." : "Create your account to get started."}
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        {mode === "register" && (
          <div className="space-y-1">
            <label htmlFor="name" className="text-sm text-zinc-300">
              Name
            </label>
            <input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none ring-[#6C63FF] focus:ring-2"
              placeholder="Jais"
            />
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm text-zinc-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none ring-[#6C63FF] focus:ring-2"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm text-zinc-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none ring-[#6C63FF] focus:ring-2"
            placeholder="At least 8 characters"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading
            ? "Please wait..."
            : mode === "login"
              ? "Sign in"
              : "Create account and sign in"}
        </Button>
      </form>

      <button
        type="button"
        className="mt-4 text-sm text-zinc-400 hover:text-zinc-200"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError(null);
        }}
      >
        {mode === "login"
          ? "Need an account? Create one."
          : "Already have an account? Sign in."}
      </button>
    </Card>
  );
}
