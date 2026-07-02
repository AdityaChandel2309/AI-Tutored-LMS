"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { useMe } from "@/lib/api/me";
import { BRAND_NAME } from "@/lib/brand";

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const { data } = useMe();
  // Read roles from the UNWRAPPED `/me` shape (`data.roles`, not `data.data.roles`).
  // Default to [] until the query resolves so role-gated sections stay hidden while loading.
  const roles = data?.roles ?? [];
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[color:color-mix(in_oklch,var(--color-foreground)_30%,transparent)] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile unless open */}
      <div className={`fixed inset-y-0 left-0 z-50 md:relative md:z-auto transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        <SidebarNav roles={roles} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} onNavigate={() => setMobileOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex items-center gap-3 border-b bg-[var(--color-card)] px-4 py-2 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-[var(--color-muted-foreground)] rounded-[var(--radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <span className="font-bold text-sm">{BRAND_NAME}</span>
        </header>

        <main className="flex-1 overflow-y-auto bg-[var(--color-background)]">
          {children}
        </main>
      </div>
    </div>
  );
}
