import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { FiltersProvider } from "@/lib/filters-context";
import { UserBootstrap } from "@/components/user-bootstrap";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FiltersProvider>
      <UserBootstrap />
      <div className="flex min-h-screen w-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
        </div>
      </div>
    </FiltersProvider>
  );
}
