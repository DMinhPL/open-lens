"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/core/utils";
import { useAppSelector } from "@/core/store/hooks";
import { useMode } from "@/core/mode-context";
import { useSidebar } from "@/core/sidebar-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LayoutDashboard, Ticket, Users, FolderKanban, Settings, Telescope, GitBranch, Workflow, Timer, Gauge, X } from "lucide-react";

const MEMBER_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/gantt", label: "Gantt", icon: Timer },
  { href: "/hierarchy", label: "Hierarchy", icon: GitBranch },
  { href: "/workload", label: "Workload", icon: Users },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/workflow-instructions", label: "Meeting → Tasks", icon: Workflow },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Project Manager mode's nav — team-wide pages only; single-user pages (Tickets/Gantt/...) don't apply here. */
const MANAGER_NAV_ITEMS = [
  { href: "/pm", label: "Team Overview", icon: Gauge },
  { href: "/workload", label: "Workload", icon: Users },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const currentUser = useAppSelector((state) => state.user.info);
  const { mode } = useMode();
  const { isOpen, close } = useSidebar();
  const navItems = mode === "manager" ? MANAGER_NAV_ITEMS : MEMBER_NAV_ITEMS;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "glass-sidebar fixed inset-y-0 left-0 z-50 flex h-screen w-56 shrink-0 flex-col overflow-y-auto border-r border-r-transparent text-sidebar-foreground transition-transform duration-200 md:sticky md:top-0 md:z-0 md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Telescope className="size-5" />
          <span className="font-semibold">OpenLens</span>
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="ml-auto rounded-md p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:hidden"
          >
            <X className="size-4" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {currentUser && (
          <div className="flex items-center gap-2 border-t px-4 py-3">
            <Avatar size="sm">
              <AvatarImage src={currentUser.avatar ?? undefined} alt={currentUser.name} />
              <AvatarFallback>{currentUser.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-medium">{currentUser.name}</span>
          </div>
        )}
      </aside>
    </>
  );
}
