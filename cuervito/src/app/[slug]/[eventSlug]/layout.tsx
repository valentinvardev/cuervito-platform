import { Suspense } from "react";

import { db } from "~/server/db";
import { getPresignedDownloadUrl } from "~/server/s3";

function EventSkeleton({ logoUrl }: { logoUrl: string | null }) {
  return (
    <>
      <nav className="nav">
        <div className="nav-left">
          <span className="skel" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <div className="nav-divider" />
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="storefront-logo" />
          ) : (
            <span className="logo" aria-hidden="true">
              cuerv<span className="logo-dot" />to
            </span>
          )}
        </div>
      </nav>

      <header className="hero has-cover">
        <div className="hero-cover" aria-hidden="true" />
        <div className="hero-inner">
          <div className="photog-row">
            <div
              className="photog-avatar"
              style={{
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.18), rgba(255,255,255,0.08))",
                backgroundSize: "200% 100%",
                animation: "skel-shimmer 1.2s ease-in-out infinite",
                color: "transparent",
              }}
            />
            <div className="photog-info">
              <h1 className="photog-name">
                <span className="skel" style={{ width: 180, height: 24, display: "inline-block" }} />
              </h1>
              <div className="photog-meta">
                <span className="skel" style={{ width: 240, height: 13, display: "inline-block" }} />
              </div>
            </div>
          </div>

          <div className="event-strip">
            <div>
              <div className="lbl">Cobertura de</div>
              <div className="nm">
                <span className="skel" style={{ width: 180, height: 16, display: "inline-block" }} />
              </div>
            </div>
          </div>

          <div className="search-card in-hero">
            <div className="input-with-icon">
              <i className="ti ti-search" />
              <span className="skel" style={{ width: "100%", height: 18, display: "block", borderRadius: 4 }} />
            </div>
            <span className="skel" style={{ width: 140, height: 36, borderRadius: 8 }} />
            <span className="skel" style={{ width: 100, height: 36, borderRadius: 8 }} />
          </div>
        </div>
      </header>

      <main className="main">
        <div className="photo-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skel" style={{ aspectRatio: "3/2", borderRadius: 8, opacity: 0.7 }} />
          ))}
        </div>
      </main>
    </>
  );
}

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; eventSlug: string }>;
}) {
  const { slug } = await params;

  const user = await db.user.findUnique({
    where: { slug },
    select: { logoKey: true },
  });

  const logoUrl = user?.logoKey
    ? await getPresignedDownloadUrl(user.logoKey, { expiresIn: 60 * 60 * 6 })
    : null;

  return (
    <Suspense fallback={<EventSkeleton logoUrl={logoUrl} />}>
      {children}
    </Suspense>
  );
}
