"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/users", label: "Usuarios", icon: "ti-users" },
  { href: "/admin/sales", label: "Ventas", icon: "ti-shopping-cart" },
  { href: "/admin/metricas", label: "Métricas", icon: "ti-chart-bar" },
  { href: "/admin/watermark", label: "Watermark", icon: "ti-watermark" },
  { href: "/admin/editor", label: "Editor", icon: "ti-color-swatch" },
  { href: "/admin/settings", label: "Settings", icon: "ti-settings" },
];

export function AdminTabs() {
  const pathname = usePathname() ?? "";

  return (
    <div className="admin-tabs">
      <div className="admin-tabs-inner">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`admin-tab ${active ? "active" : ""}`}
            >
              <i className={`ti ${t.icon}`} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
