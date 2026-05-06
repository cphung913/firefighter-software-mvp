import {
  type LucideIcon,
  BarChart3,
  LayoutDashboard,
  Siren,
  Radio,
  Truck,
  Wrench,
  Settings,
  Users,
  CalendarDays,
  GraduationCap,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  adminOnly?: boolean;
};

export type NavGroup = {
  label: string;
  beta?: boolean;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/incidents", label: "Incidents", icon: Siren },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/dispatch", label: "Dispatch", icon: Radio },
      { href: "/apparatus", label: "Apparatus", icon: Truck },
      { href: "/equipment", label: "Equipment", icon: Wrench },
    ],
  },
  {
    label: "Personnel",
    items: [
      { href: "/roster", label: "Roster", icon: Users },
      { href: "/schedule", label: "Schedule", icon: CalendarDays },
      { href: "/training", label: "Training", icon: GraduationCap },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap((g) => g.items),
  { href: "/settings", label: "Settings", icon: Settings },
];

export const MOBILE_PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/incidents", label: "Incidents", icon: Siren },
  { href: "/roster", label: "Roster", icon: Users },
  { href: "/apparatus", label: "Apparatus", icon: Truck },
  { href: "/training", label: "Training", icon: GraduationCap },
];
