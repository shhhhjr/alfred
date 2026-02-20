"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, CheckCircle2, GraduationCap, Mail, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Step = number;

const TOTAL_STEPS = 6;

export function OnboardingModal({ userName }: { userName?: string | null }) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  // Step 2 — location + travel
  const [homeAddress, setHomeAddress] = useState("");
  const [travelMode, setTravelMode] = useState("drive");

  // Step 3 — school
  const [school, setSchool] = useState("");
  const [firstCourse, setFirstCourse] = useState("");

  // Step 4 — work hours
  const [workStart, setWorkStart] = useState("9");
  const [workEnd, setWorkEnd] = useState("17");

  function next() {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    }
  }

  function back() {
    if (step > 0) {
      setStep((s) => s - 1);
    }
  }

  async function finish() {
    setSaving(true);
    const payload: Record<string, unknown> = { hasCompletedOnboarding: true };
    if (homeAddress.trim()) payload.homeAddress = homeAddress.trim();
    if (travelMode) payload.travelMode = travelMode;
    if (school.trim()) payload.school = school.trim();
    if (workStart) payload.workHoursStart = parseInt(workStart);
    if (workEnd) payload.workHoursEnd = parseInt(workEnd);

    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (firstCourse.trim()) {
      await fetch("/api/school/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: firstCourse.trim() }),
      });
    }

    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  const stepLabels = ["Welcome", "Location", "School", "Work Hours", "Email", "Done"];

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-800 bg-[#0A0A0F] p-0 shadow-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Progress bar */}
          <div className="h-1 w-full rounded-t-xl bg-zinc-800">
            <div
              className="h-1 rounded-tl-xl bg-[#6C63FF] transition-all duration-300"
              style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </div>

          <div className="p-8">
            {/* Step indicator */}
            <div className="mb-6 flex items-center gap-1.5">
              {stepLabels.map((label, i) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition ${
                      i < step
                        ? "bg-[#6C63FF] text-white"
                        : i === step
                        ? "border-2 border-[#6C63FF] text-[#6C63FF]"
                        : "bg-zinc-800 text-zinc-600"
                    }`}
                  >
                    {i < step ? <CheckCircle2 size={12} /> : i + 1}
                  </div>
                  {i < stepLabels.length - 1 && (
                    <div className={`h-0.5 w-6 rounded-full ${i < step ? "bg-[#6C63FF]" : "bg-zinc-800"}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step content */}
            {step === 0 && (
              <div>
                <h2 className="text-2xl font-bold text-zinc-100">
                  Welcome to ALFRED{userName ? `, ${userName.split(" ")[0]}` : ""}
                </h2>
                <p className="mt-3 text-zinc-400 leading-relaxed">
                  Your personal AI operations assistant. Alfred helps you stay on top of your tasks, calendar, emails, job search, and more — all in one place.
                </p>
                <p className="mt-3 text-zinc-400 leading-relaxed">
                  Let&apos;s take 60 seconds to set things up so Alfred can start working for you right away.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: "Smart scheduling", desc: "AI plans your day" },
                    { label: "Email intelligence", desc: "Summarise and prioritise" },
                    { label: "Job tracking", desc: "Applications & contacts" },
                    { label: "School planner", desc: "Courses & assignments" },
                  ].map((f) => (
                    <div key={f.label} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                      <p className="font-medium text-zinc-200">{f.label}</p>
                      <p className="text-xs text-zinc-500">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#6C63FF]/20">
                  <MapPin size={20} className="text-[#6C63FF]" />
                </div>
                <h2 className="text-xl font-bold text-zinc-100">Where are you based?</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Alfred uses this to calculate commute times and schedule travel blocks.
                </p>
                <div className="mt-5 space-y-3">
                  <Input
                    placeholder="Home address or city"
                    value={homeAddress}
                    onChange={(e) => setHomeAddress(e.target.value)}
                    className="bg-zinc-900 border-zinc-700"
                  />
                  <div>
                    <p className="mb-2 text-sm text-zinc-400">How do you usually travel?</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "drive", label: "🚗 Drive" },
                        { value: "transit", label: "🚇 Transit" },
                        { value: "walk", label: "🚶 Walk" },
                        { value: "bicycling", label: "🚲 Bike" },
                      ].map((m) => (
                        <button
                          key={m.value}
                          onClick={() => setTravelMode(m.value)}
                          className={`rounded-lg border px-4 py-2 text-sm transition ${
                            travelMode === m.value
                              ? "border-[#6C63FF] bg-[#6C63FF]/20 text-[#6C63FF]"
                              : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#6C63FF]/20">
                  <GraduationCap size={20} className="text-[#6C63FF]" />
                </div>
                <h2 className="text-xl font-bold text-zinc-100">Are you a student?</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Alfred can track your courses, assignments, and deadlines. Skip if not applicable.
                </p>
                <div className="mt-5 space-y-3">
                  <Input
                    placeholder="School or university name (optional)"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    className="bg-zinc-900 border-zinc-700"
                  />
                  <Input
                    placeholder="First course name (optional)"
                    value={firstCourse}
                    onChange={(e) => setFirstCourse(e.target.value)}
                    className="bg-zinc-900 border-zinc-700"
                  />
                  <p className="text-xs text-zinc-500">
                    You can add more courses and upload syllabuses in the School section later.
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#6C63FF]/20">
                  <Clock size={20} className="text-[#6C63FF]" />
                </div>
                <h2 className="text-xl font-bold text-zinc-100">When do you work?</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Alfred schedules tasks and events within your working hours.
                </p>
                <div className="mt-5 flex items-center gap-4">
                  <div>
                    <p className="mb-1 text-xs text-zinc-400">Start time</p>
                    <select
                      value={workStart}
                      onChange={(e) => setWorkStart(e.target.value)}
                      className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
                    >
                      {Array.from({ length: 13 }, (_, i) => i + 6).map((h) => (
                        <option key={h} value={String(h)}>
                          {h === 12 ? "12:00 PM" : h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-zinc-500 mt-5">to</span>
                  <div>
                    <p className="mb-1 text-xs text-zinc-400">End time</p>
                    <select
                      value={workEnd}
                      onChange={(e) => setWorkEnd(e.target.value)}
                      className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 13).map((h) => (
                        <option key={h} value={String(h)}>
                          {h === 24 ? "12:00 AM" : h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#6C63FF]/20">
                  <Mail size={20} className="text-[#6C63FF]" />
                </div>
                <h2 className="text-xl font-bold text-zinc-100">Connect your email</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Alfred reads and summarises your emails, flags important messages, and can draft replies.
                </p>
                <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
                  <p>Connect your Gmail, Outlook, or iCloud email in Settings to unlock:</p>
                  <ul className="mt-2 space-y-1 text-zinc-400">
                    <li>• Daily email digests on your dashboard</li>
                    <li>• AI-powered email summaries</li>
                    <li>• Priority inbox filtering</li>
                  </ul>
                </div>
                <Button
                  variant="outline"
                  className="mt-4 w-full border-zinc-700 text-zinc-300"
                  onClick={() => {
                    setOpen(false);
                    router.push("/settings?tab=email");
                  }}
                >
                  Go to Email Settings
                </Button>
                <p className="mt-2 text-center text-xs text-zinc-500">Or skip and connect later</p>
              </div>
            )}

            {step === 5 && (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#6C63FF]/20">
                  <CheckCircle2 size={32} className="text-[#6C63FF]" />
                </div>
                <h2 className="text-2xl font-bold text-zinc-100">You&apos;re all set!</h2>
                <p className="mt-3 text-zinc-400 leading-relaxed">
                  Alfred is ready to help. Head to the dashboard to see your daily briefing, or open Chat to start giving Alfred commands.
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Tip: Try asking Alfred to &ldquo;plan my day&rdquo; in the Chat tab.
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={back}
                disabled={step === 0}
                className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 disabled:opacity-0 transition"
              >
                <ChevronLeft size={16} />
                Back
              </button>

              {step < TOTAL_STEPS - 1 ? (
                <Button
                  onClick={next}
                  className="bg-[#6C63FF] hover:bg-[#5b53e8] text-white px-6"
                >
                  Continue
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={finish}
                  disabled={saving}
                  className="bg-[#6C63FF] hover:bg-[#5b53e8] text-white px-6"
                >
                  {saving ? "Saving..." : "Get started"}
                </Button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
