import {
  type LucideIcon,
  LayoutDashboard,
  Siren,
  Radio,
  Truck,
  Wrench,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
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
      { href: "/dispatch", label: "Dispatch", icon: Radio },
      { href: "/apparatus", label: "Apparatus", icon: Truck },
      { href: "/equipment", label: "Equipment", icon: Wrench },
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
  { href: "/dispatch", label: "Dispatch", icon: Radio },
  { href: "/apparatus", label: "Apparatus", icon: Truck },
  { href: "/equipment", label: "Equipment", icon: Wrench },
];
