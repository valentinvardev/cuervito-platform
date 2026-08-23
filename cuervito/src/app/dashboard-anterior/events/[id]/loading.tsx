/**
 * Skeleton de la página de evento.
 *
 * Espeja la estructura real (portada → banner de publicación → 3 tabs
 * de navegación → galería) para que al resolverse no haya salto de
 * layout. La onda de carga vive dentro de cada bloque y se escalona por
 * posición, de modo que se lee como un frente que baja por la página sin
 * pintar los huecos entre tarjetas.
 */
export default function Loading() {
  return (
    <main className="wrap" aria-busy="true" aria-label="Cargando evento">
      {/* Portada */}
      <div className="ev-skel-cover" />

      {/* Banner de publicación */}
      <div className="ev-skel-banner">
        <div className="ev-skel-banner-text">
          <span className="ev-skel-bar w-52" />
          <span className="ev-skel-bar w-72 sm" />
        </div>
        <span className="ev-skel-btn" />
      </div>

      {/* Tabs de navegación */}
      <div className="ev-skel-tabs">
        {[0, 1, 2].map((i) => (
          <div key={i} className="ev-skel-tab">
            <span className="ev-skel-chip" />
            <div className="ev-skel-tab-text">
              <span className="ev-skel-bar w-58" />
              <span className="ev-skel-bar w-84 sm" />
            </div>
          </div>
        ))}
      </div>

      {/* Zona de subida */}
      <div className="ev-skel-upload">
        <span className="ev-skel-chip lg" />
        <span className="ev-skel-bar w-40" />
        <span className="ev-skel-bar w-64 sm" />
      </div>

      {/* Grilla de fotos */}
      <div className="ev-skel-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="ev-skel-photo" />
        ))}
      </div>
    </main>
  );
}
