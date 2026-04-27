import {
  type LucideIcon,
  Boxes,
  ClipboardCheck,
  LayoutDashboard,
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
  { href: "/checklists", label: "Checklists", icon: ClipboardCheck },
  { href: "/incidents", label: "Incidents", icon: Siren },
  { href: "/assets", label: "Assets", icon: Boxes },
  { href: "/settings", label: "Settings", icon: Settings },
];
