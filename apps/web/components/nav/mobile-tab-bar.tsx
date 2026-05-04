"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MOBILE_PRIMARY } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex md:hidden"
      style={{
        background: "var(--ink)",
        borderTop: "1px solid var(--rule)",
      }}
    >
      {MOBILE_PRIMARY.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 py-3 min-h-[3.25rem]",
              active ? "text-[var(--signal)]" : "text-[var(--bone-dim)]"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]">
              {item.label}
            </span>
            {item.badge != null && (
              <span
                className="absolute top-2 right-[calc(50%-14px)] font-mono text-[9px] leading-none"
                style={{
                  background: "var(--signal)",
                  color: "var(--bone)",
                  padding: "1px 4px",
                  borderRadius: 2,
                  minWidth: 14,
                  textAlign: "center",
                }}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
