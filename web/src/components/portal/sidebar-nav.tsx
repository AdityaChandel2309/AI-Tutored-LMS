"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Award,
  BarChart3,
  BookMarked,
  BookOpen,
  Bot,
  Building2,
  ClipboardList,
  FileSearch,
  GraduationCap,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { BRAND_NAME } from "@/lib/brand";

type NavItem = { label: string; href: string; icon: LucideIcon };
type NavSection = { title: string; items: NavItem[]; roles?: string[] };

const NAV_SECTIONS: NavSection[] = [
  { title: "", items: [{ label: "Home", href: "/dashboard", icon: Home }] },
  { title: "Learning", items: [
    { label: "Courses", href: "/dashboard/courses", icon: BookOpen },
    { label: "My Courses", href: "/dashboard/my-courses", icon: GraduationCap },
    { label: "Certificates", href: "/dashboard/certificates", icon: Award },
  ]},
  { title: "People", items: [
    { label: "Employees", href: "/dashboard/employees", icon: Users },
    { label: "Organization", href: "/dashboard/organization", icon: Building2 },
  ], roles: ["admin", "instructor"] },
  { title: "Projects", items: [
    { label: "Projects", href: "/dashboard/projects", icon: ClipboardList },
  ]},
  { title: "Knowledge", items: [
    { label: "Knowledge Base", href: "/dashboard/knowledge", icon: BookMarked },
    { label: "AI Assistant", href: "/dashboard/assistant", icon: Bot },
  ]},
  { title: "Admin", items: [
    { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    { label: "Activity", href: "/dashboard/activity", icon: Activity },
    { label: "Audit Logs", href: "/dashboard/audit", icon: FileSearch },
  ], roles: ["admin"] },
];

// Button-consistent keyboard focus ring (matches the ui/Button primitive).
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2";

export function SidebarNav({ roles, collapsed, onToggle, onNavigate }: { roles: string[]; collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) {
  const pathname = usePathname();

  const visibleSections = NAV_SECTIONS.filter((s) => !s.roles || s.roles.some((r) => roles.includes(r)));

  return (
    <aside className={`${collapsed ? "w-16" : "w-56"} border-r bg-[var(--color-card)] h-full flex flex-col transition-all duration-200`}>
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[calc(var(--radius)-8px)] bg-[linear-gradient(135deg,var(--color-primary),color-mix(in_oklch,var(--color-primary)_60%,var(--color-accent)))] text-[11px] font-bold text-[var(--color-primary-foreground)] shadow-[0_6px_16px_-6px_var(--color-primary)]"
          >
            {BRAND_NAME.slice(0, 2).toUpperCase()}
          </span>
          {!collapsed && (
            <span className="truncate font-semibold text-sm tracking-tight text-[var(--color-foreground)]">
              {BRAND_NAME}
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className={`hidden md:inline-flex items-center justify-center rounded-[calc(var(--radius)-10px)] p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] ${FOCUS_RING}`}
        >
          {collapsed ? <PanelLeftOpen aria-hidden className="h-4 w-4" /> : <PanelLeftClose aria-hidden className="h-4 w-4" />}
        </button>
        {onNavigate && (
          <button
            onClick={onNavigate}
            aria-label="Close menu"
            className={`md:hidden inline-flex items-center justify-center rounded-[calc(var(--radius)-10px)] p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] ${FOCUS_RING}`}
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {visibleSections.map((section, i) => (
          <div key={i} className="mb-2">
            {section.title && !collapsed && <p className="px-4 py-1 text-xs font-semibold text-[var(--color-muted-foreground)] uppercase">{section.title}</p>}
            {section.items.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-label={item.label}
                  title={item.label}
                  className={`group relative flex items-center gap-2 mx-2 px-2 py-1.5 text-sm rounded-[calc(var(--radius)-8px)] transition-colors duration-150 ${collapsed ? "justify-center" : ""} ${FOCUS_RING} ${active ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-medium" : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-x-1 -translate-y-1/2 rounded-full bg-[var(--color-primary)]"
                    />
                  )}
                  <Icon aria-hidden className="h-4 w-4 shrink-0" />
                  <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
