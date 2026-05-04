import {
  type LucideIcon,
  LayoutDashboard,
  Siren,
  Radio,
  Truck,
  Droplets,
  FileText,
  ClipboardCheck,
  Award,
  CalendarDays,
  CreditCard,
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
      { href: "/incidents", label: "Incidents", icon: Siren, badge: 3 },
      { href: "/dispatch", label: "Dispatch", icon: Radio },
      { href: "/apparatus", label: "Apparatus", icon: Truck },
      { href: "/hydrants", label: "Hydrants", icon: Droplets },
    ],
  },
  {
    label: "Records",
    items: [
      { href: "/reports", label: "Reports", icon: FileText },
      { href: "/inspections", label: "Inspections", icon: ClipboardCheck },
      { href: "/training", label: "Training", icon: Award },
    ],
  },
  {
    label: "Scheduling",
    beta: true,
    items: [
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/payroll", label: "Payroll", icon: CreditCard },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap((g) => g.items),
  { href: "/settings", label: "Settings", icon: Settings },
];

export const MOBILE_PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/incidents", label: "Incidents", icon: Siren, badge: 3 },
  { href: "/dispatch", label: "Dispatch", icon: Radio },
  { href: "/apparatus", label: "Apparatus", icon: Truck },
  { href: "/settings", label: "Settings", icon: Settings },
];
