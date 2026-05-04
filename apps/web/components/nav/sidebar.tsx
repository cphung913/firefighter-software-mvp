"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";

import { NAV_GROUPS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  return (
    <aside
      className="hidden w-60 shrink-0 md:flex md:flex-col relative"
      style={{
        background: "var(--ink)",
        borderRight: "1px solid var(--rule)",
      }}
    >
      {/* hazard-stripe right edge */}
      <div
        className="absolute top-0 bottom-0 right-0 w-[3px] pointer-events-none"
        style={{
          background:
            "repeating-linear-gradient(180deg, var(--signal) 0 14px, var(--ink) 14px 28px)",
          opacity: 0.4,
        }}
      />

      {/* brand */}
      <div
        className="flex items-center gap-3 px-[22px] py-[18px]"
        style={{ borderBottom: "1px solid var(--rule)" }}
      >
        <div
          className="grid place-items-center shrink-0 font-display font-bold text-[18px]"
          style={{
            width: 32,
            height: 32,
            background: "var(--bone)",
            color: "var(--ink)",
            clipPath: "polygon(50% 0, 100% 30%, 100% 100%, 0 100%, 0 30%)",
          }}
        >
          H
        </div>
        <span
          className="font-display font-semibold text-[17px] tracking-[0.18em] text-[var(--bone)]"
        >
          HALLIGAN<span style={{ color: "var(--signal)" }}>.</span>
        </span>
      </div>

      {/* nav groups */}
      <nav className="flex-1 overflow-y-auto py-1">
        {NAV_GROUPS.map((group) => {
          const isActive = (href: string) =>
            pathname === href || pathname.startsWith(`${href}/`);

          return (
            <div key={group.label} className="pb-3">
              <div
                className="flex items-center gap-2 px-[22px] pb-2 pt-[14px] font-display text-[11px] tracking-[0.2em] uppercase"
                style={{ color: "#7a786f" }}
              >
                {group.label}
                {group.beta && (
                  <span
                    className="font-display font-semibold text-[9px] tracking-[0.14em] uppercase px-1 py-px"
                    style={{
                      background: "var(--signal)",
                      color: "var(--bone)",
                      borderRadius: 2,
                    }}
                  >
                    BETA
                  </span>
                )}
              </div>
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={cn(
                      "flex items-center gap-3 px-[22px] py-[9px] font-display text-[13px] uppercase tracking-[0.14em] transition-colors",
                      active
                        ? "text-[var(--bone)]"
                        : "text-[var(--bone-dim)] hover:text-[var(--bone)]"
                    )}
                    style={
                      active
                        ? {
                            background: "rgba(200,54,44,0.10)",
                            borderLeft: "2px solid var(--signal)",
                            paddingLeft: "calc(22px - 2px)",
                          }
                        : {
                            borderLeft: "2px solid transparent",
                          }
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge != null && (
                      <span
                        className="font-mono text-[10px]"
                        style={{
                          background: "var(--signal)",
                          color: "var(--bone)",
                          padding: "1px 6px",
                          borderRadius: 2,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* footer */}
      <div
        className="px-[18px] py-[14px] flex flex-col gap-2.5"
        style={{ borderTop: "1px solid var(--rule)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="grid place-items-center shrink-0 rounded-full font-display font-semibold text-[12px] tracking-[0.06em] text-[var(--bone)]"
            style={{
              width: 30,
              height: 30,
              background: "var(--steel-2)",
              border: "1px solid var(--rule-2)",
            }}
          >
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-body text-[13px] font-semibold text-[var(--bone)] leading-tight">
              {session?.user?.name ?? "—"}
            </span>
            <span
              className="font-mono text-[10.5px] tracking-[0.04em] truncate"
              style={{ color: "#7a786f" }}
            >
              {session?.user?.email}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2.5 font-display text-[12px] uppercase tracking-[0.16em] transition-colors py-1"
          style={{ color: "var(--bone-dim)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--signal)")}
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--bone-dim)")
          }
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
