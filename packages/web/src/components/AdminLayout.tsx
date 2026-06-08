import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Activity, ClipboardCheck, LogOut, Settings, Tags, Users } from "lucide-react";
import { clearToken, getRole, getToken } from "../api/client";
import { cn } from "../lib/utils";
import { BrandMark } from "./BrandMark";
import { BrandWord } from "./BrandWord";
import { Button } from "./ui/button";

const navItems = [
  { to: "/admin/submissions", label: "投稿审核", icon: ClipboardCheck, superOnly: false },
  { to: "/admin/channels", label: "频道管理", icon: Activity, superOnly: false },
  { to: "/admin/tags", label: "标签管理", icon: Tags, superOnly: false },
  { to: "/admin/admins", label: "管理员", icon: Users, superOnly: true },
  { to: "/admin/settings", label: "系统设置", icon: Settings, superOnly: true }
];

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  if (!getToken()) return <Navigate to="/admin/login" replace />;
  const role = getRole();

  const logout = () => {
    clearToken();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-[var(--nya-border)] bg-[rgba(255,255,255,0.72)] px-4 py-4 backdrop-blur-xl lg:sticky lg:top-0 lg:h-[100dvh] lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
        <div className="mb-5 flex items-center gap-3">
          <BrandMark />
          <div>
            <BrandWord className="font-black tracking-tight text-[var(--nya-text)]" />
            <div className="text-xs font-medium text-[var(--nya-text-tertiary)]">音频中转控制台</div>
          </div>
        </div>
        <nav className="grid gap-2">
          {navItems
            .filter((item) => !item.superOnly || role === "SUPERADMIN")
            .map((item) => {
              const Icon = item.icon;
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-[var(--nya-radius-md)] px-3 text-sm font-semibold text-[var(--nya-text-secondary)] transition hover:bg-[var(--nya-surface)] hover:text-[var(--nya-text)]",
                    active &&
                      "bg-[var(--nya-primary-fill)] text-[var(--nya-on-primary)] shadow-[var(--nya-shadow-sm)] hover:bg-[var(--nya-primary-fill)] hover:text-[var(--nya-on-primary)]"
                  )}
                  to={item.to}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
        </nav>
        <Button className="mt-6 w-full justify-start" variant="secondary" onClick={logout}>
          <LogOut />
          退出登录
        </Button>
      </aside>
      <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
