"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/users", label: "Usuarios", icon: "ti-users" },
  { href: "/admin/watermark", label: "Watermark", icon: "ti-watermark" },
  { href: "/admin/settings", label: "Settings", icon: "ti-settings" },
];

export function AdminTabs() {
  const pathname = usePathname() ?? "";

  return (
    <div
      style={{
        background: "rgba(15, 13, 11, 0.85)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--border-subtle)",
        position: "sticky",
        top: 64,
        zIndex: 19,
      }}
    >
      <div
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "0 32px",
          display: "flex",
          gap: 4,
          overflowX: "auto",
        }}
      >
        {TABS.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 16px",
                fontSize: 13.5,
                fontWeight: 500,
                color: active ? "var(--accent)" : "var(--text-secondary)",
                borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                whiteSpace: "nowrap",
                textDecoration: "none",
                transition: "color 150ms",
              }}
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
