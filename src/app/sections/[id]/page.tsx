import { AppShell } from "@/components/layout/AppShell";
import { SectionDetailClient } from "@/components/custom-sections/SectionDetailClient";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: { id: string } };

export default async function SectionDetailPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) return notFound();

  const section = await prisma.customSection.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { entries: true },
  });
  if (!section) return notFound();

  return (
    <AppShell>
      <div className="space-y-4">
        <Link href="/sections" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Back to Sections
        </Link>
        <SectionDetailClient section={section} />
      </div>
    </AppShell>
  );
}
