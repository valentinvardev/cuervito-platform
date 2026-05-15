/**
 * Minimal loading state for the [slug] segment. Renders just the nav so
 * the page transition feels instant without committing to a specific
 * layout — that way it works as a placeholder whether we end up on the
 * photographer's storefront (/{slug}) or an event coverage page
 * (/{slug}/{eventSlug}), both of which share this segment.
 *
 * The more specific [eventSlug]/loading.tsx kicks in once Next resolves
 * the deeper segment.
 */
export default function Loading() {
  return (
    <>
      <nav className="nav">
        <div className="nav-left">
          <span className="logo" aria-hidden="true">
            cuerv<span className="logo-dot"></span>to
          </span>
        </div>
      </nav>
    </>
  );
}
