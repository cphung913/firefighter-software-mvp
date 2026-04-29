import {
  type LucideIcon,
  LayoutDashboard,
  Mic,
  Settings,
  Siren,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/incidents", label: "Incidents", icon: Siren },
  { href: "/voice", label: "Start ride-back log", icon: Mic },
  { href: "/settings", label: "Settings", icon: Settings },
];
