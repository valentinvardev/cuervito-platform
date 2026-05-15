/**
 * Shared <link> tags every layout puts in <head>. Includes preconnect
 * + preload hints so the browser can fetch tabler-icons.css and Google
 * Fonts in parallel with the HTML — without this, the icon font lands
 * after the hero/grid has painted and the layout shifts visibly on the
 * first visit to a route.
 */
export function ExternalStylesheets() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />

      <link
        rel="preload"
        as="style"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.5.0/dist/tabler-icons.min.css"
      />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.5.0/dist/tabler-icons.min.css"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
      />
    </>
  );
}
