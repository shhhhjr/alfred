import { AppShell } from "@/components/layout/AppShell";
import { JobsClient } from "@/components/jobs/JobsClient";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";

export default async function JobsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const jobs = await prisma.job.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Job Search & Applications</h1>
        <JobsClient
          initialJobs={jobs.map((j) => ({
            id: j.id,
            title: j.title,
            company: j.company,
            location: j.location,
            url: j.url,
            source: j.source,
            matchScore: j.matchScore,
            status: j.status,
            customResume: j.customResume,
            customCover: j.customCover,
            contactName: j.contactName,
            contactEmail: j.contactEmail,
            contactTitle: j.contactTitle,
            notes: j.notes,
            createdAt: j.createdAt.toISOString(),
          }))}
        />
      </div>
    </AppShell>
  );
}
