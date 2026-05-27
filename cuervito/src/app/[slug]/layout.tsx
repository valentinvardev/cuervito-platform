import "~/styles/prototype/styles.css";
import "~/styles/prototype/panel-anim.css";
import "~/styles/prototype/public-event.css";
import "~/styles/prototype/lightbox.css";

import { Suspense } from "react";

import { ExternalStylesheets } from "~/app/_components/external-stylesheets";
import { buildTemplateCSSOverride } from "~/lib/storefront-templates";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

function NavSkeleton({ logoUrl }: { logoUrl: string | null }) {
  return (
    <nav className="nav">
      <div className="nav-left">
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
  );
}

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const user = await db.user.findUnique({
    where: { slug },
    select: { storefrontTemplate: true, storefrontBrandColor: true, logoKey: true },
  });

  const cssOverride = user
    ? buildTemplateCSSOverride(user.storefrontTemplate, user.storefrontBrandColor)
    : "";

  const logoUrl = user?.logoKey
    ? await resolveMediaUrl(user.logoKey)
    : null;

  return (
    <>
      <ExternalStylesheets />
      {cssOverride && (
        <style dangerouslySetInnerHTML={{ __html: cssOverride }} />
      )}
      <Suspense fallback={<NavSkeleton logoUrl={logoUrl} />}>
        {children}
      </Suspense>
    </>
  );
}
