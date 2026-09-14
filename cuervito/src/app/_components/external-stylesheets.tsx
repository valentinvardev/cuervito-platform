/**
 * Los <link> que comparten las tiendas viejas: los íconos de Tabler, con
 * preconnect y preload para que la fuente de íconos no aterrice después de que
 * la grilla ya pintó.
 *
 * Acá también se cargaban Bricolage Grotesque y DM Sans de Google. Eran las
 * fuentes de cuervito; las de encontrate (Outfit y Unbounded) las trae
 * next/font desde el layout raíz para TODAS las rutas, así que pedirlas de
 * nuevo a Google era una descarga más para dibujar la marca equivocada.
 */
export function ExternalStylesheets() {
  return (
    <>
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
    </>
  );
}
