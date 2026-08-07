import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { FiltersProvider } from "@/core/filters-context";
import { ModeProvider } from "@/core/mode-context";
import { SidebarProvider } from "@/core/sidebar-context";
import { UserBootstrap } from "@/components/user-bootstrap";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModeProvider>
      <FiltersProvider>
        <SidebarProvider>
          <UserBootstrap />
          <div className="flex min-h-screen w-full">
            <Sidebar />
            <div className="app-layout-main flex min-w-0 flex-1 flex-col">
              <Topbar />
              <main className="main-layout-container flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
            </div>
          </div>
        </SidebarProvider>
      </FiltersProvider>
    </ModeProvider>
  );
}
