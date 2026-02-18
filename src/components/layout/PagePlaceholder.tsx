import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";

type PagePlaceholderProps = {
  title: string;
  description: string;
};

export async function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <AppShell>
      <Card className="max-w-3xl p-6">
        <h1 className="text-2xl font-semibold text-zinc-100">{title}</h1>
        <p className="mt-2 text-zinc-400">{description}</p>
      </Card>
    </AppShell>
  );
}
