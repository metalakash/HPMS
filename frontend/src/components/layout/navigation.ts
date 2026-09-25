import {
  Banknote,
  FolderKanban,
  LayoutDashboard,
  LineChart,
  Settings,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** False until the backend exposes REST routes for this area. */
  available: boolean;
  roles?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, available: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban, available: true },
  { to: '/loans', label: 'Loan accounts', icon: Banknote, available: true },
  { to: '/compliance', label: 'Compliance', icon: ShieldCheck, available: false },
  { to: '/analytics', label: 'Analytics', icon: LineChart, available: false },
  { to: '/maintenance', label: 'Maintenance', icon: Wrench, available: false },
  { to: '/admin', label: 'Admin', icon: Settings, available: false, roles: ['admin'] },
];

export function visibleNavItems(roles: string[] | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.some((r) => roles?.includes(r)));
}
