import { LayoutGrid, UploadCloud } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { cn } from "../lib/utils";
import { BrandMark } from "./BrandMark";
import { BrandWord } from "./BrandWord";
import { Button } from "./ui/button";

const navItems = [
  { to: "/channels", label: "频道", icon: LayoutGrid },
  { to: "/submit", label: "投稿", icon: UploadCloud }
];

export function PublicLayout() {
  return (
    <div className="min-h-[100dvh] text-[var(--nya-text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--nya-border)] bg-[color:var(--nya-bg)]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 font-bold text-[var(--nya-text)]">
            <BrandMark />
            <BrandWord />
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex h-10 items-center gap-2 rounded-[var(--nya-radius-md)] px-3 text-sm font-semibold transition",
                      isActive
                        ? "bg-[var(--nya-surface)] text-[var(--nya-primary-strong)] shadow-[var(--nya-shadow-sm)]"
                        : "text-[var(--nya-text-secondary)] hover:bg-[var(--nya-surface-subtle)] hover:text-[var(--nya-text)]"
                    )
                  }
                >
                  <Icon className="size-4" />
                  {item.label}
                </NavLink>
              );
            })}
            <Button asChild size="sm" className="ml-2 hidden sm:inline-flex">
              <Link to="/admin/submissions">管理后台</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
