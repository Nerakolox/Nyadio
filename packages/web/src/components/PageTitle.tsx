import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function titleForPath(pathname: string): string {
  if (pathname.startsWith("/admin")) return "Nyadio 管理后台";
  if (pathname === "/") return "Nyadio";
  if (pathname === "/channels") return "频道 - Nyadio";
  if (pathname.startsWith("/channel/")) return "频道详情 - Nyadio";
  if (pathname.startsWith("/tags/")) return "标签频道 - Nyadio";
  if (pathname === "/submit") return "投稿 - Nyadio";
  return "Nyadio";
}

export function PageTitle() {
  const location = useLocation();

  useEffect(() => {
    document.title = titleForPath(location.pathname);
  }, [location.pathname]);

  return null;
}
