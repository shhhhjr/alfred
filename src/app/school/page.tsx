import { AppShell } from "@/components/layout/AppShell";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { SchoolClient } from "@/components/school/SchoolClient";

export default async function SchoolPage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const rawCourses = await prisma.course.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: {
      assignments: {
        orderBy: { dueDate: "asc" },
      },
    },
  });

  // Serialize dates to strings for the client component
  const courses = rawCourses.map((c) => ({
    ...c,
    color: c.color ?? "#6C63FF",
    syllabusText: c.syllabusText,
    assignments: c.assignments.map((a) => ({
      ...a,
      dueDate: a.dueDate ? a.dueDate.toISOString() : null,
    })),
  }));

  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-zinc-100">School</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Manage your courses, assignments, and grades. Upload a syllabus to auto-extract assignments.
        </p>
      </div>
      <SchoolClient initialCourses={courses} />
    </AppShell>
  );
}
