"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, ClipboardList, ShieldCheck, Trophy, User } from "lucide-react";

const navItems = [
  { href: "/upcoming", label: "Upcoming", icon: CalendarDays, requiresUpcoming: true },
  { href: "/matchday", label: "Matchday", icon: ClipboardList },
  { href: "/standings", label: "Standings", icon: Trophy },
  { href: "/teams", label: "Teams", icon: ShieldCheck },
  { href: "/players", label: "Players", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const [hasUpcomingMatches, setHasUpcomingMatches] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    fetch("/api/navigation", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { has_upcoming_matches?: boolean } | null) => {
        if (isCurrent) setHasUpcomingMatches(Boolean(data?.has_upcoming_matches));
      })
      .catch(() => {
        if (isCurrent) setHasUpcomingMatches(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const visibleNavItems = navItems.filter((item) => !item.requiresUpcoming || hasUpcomingMatches);

  return (
    <aside className="min-h-screen border-r border-slate-600 bg-[#2f3338] px-5 py-6 text-white">
      <div className="mb-4 flex min-h-11 items-center">
        <Image
          src="/assets/bundesliga-logo-sidebar.svg"
          alt="Bundesliga"
          width={200}
          height={40}
          priority
        />
      </div>

      <nav className="grid gap-2" aria-label="Primary">
        {visibleNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "flex min-h-12 items-center gap-3 rounded-lg px-4 text-sm font-semibold transition",
              pathname === item.href
                ? "border border-red-500/45 bg-red-600/25 text-white"
                : "text-slate-300 hover:bg-white/[0.08] hover:text-white",
            ].join(" ")}
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
