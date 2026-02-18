import Link from "next/link";
import { Calendar, BriefcaseBusiness, LayoutDashboard, Mail, MessageSquare, Settings, ShoppingBag, SquareCheckBig, UserCircle2, Users } from "lucide-react";
import Image from "next/image";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/tasks", label: "Tasks", icon: SquareCheckBig },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/lead-gen", label: "Lead Gen", icon: Users },
  { href: "/email", label: "Email", icon: Mail },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/account", label: "Account", icon: UserCircle2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-zinc-800 bg-[#0A0A0F] p-5 lg:block">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <Image src="/alfred-logo.svg" alt="ALFRED logo" width={34} height={34} className="rounded-lg" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">ALFRED</h1>
        </div>
      </Link>
      <div className="mb-5">
        <p className="text-sm text-zinc-400">Your personal operations desk</p>
      </div>

      <nav className="space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
