"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/users", label: "Usuarios", icon: "ti-users", tip: "Fotógrafos registrados: rol, cuotas y actividad" },
  { href: "/admin/sales", label: "Ventas", icon: "ti-shopping-cart", tip: "Todas las ventas de la plataforma" },
  { href: "/admin/metricas", label: "Métricas", icon: "ti-chart-bar", tip: "Conversión por fotógrafo: ventas por cada 1.000 fotos" },
  { href: "/admin/watermark", label: "Watermark", icon: "ti-watermark", tip: "Marca de agua global aplicada a las previews" },
  { href: "/admin/editor", label: "Editor", icon: "ti-color-swatch", tip: "Editor de plantillas y posts (admin only)" },
  { href: "/admin/settings", label: "Settings", icon: "ti-settings", tip: "Configuración global de la plataforma" },
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
              data-tip={t.tip}
              data-tip-side="bottom"
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
