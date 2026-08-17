import "~/styles/prototype/styles.css";
import "~/styles/prototype/panel-anim.css";
import "~/styles/prototype/descarga.css";
import "~/styles/prototype/lightbox.css";
import "~/styles/tienda-encontrate.css";
import "~/styles/entrega-encontrate.css";

export default function DescargaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/*
        Marca el documento como "recién pagado" ANTES del primer pintado.

        Es la mitad que arregla el bug de la animación. Next dibuja loading.tsx
        mientras resuelve el componente de servidor, y ese esqueleto copia la
        galería final: el comprador que venía de Mercado Pago veía armarse la
        entrega y DESPUÉS le preguntábamos si el pago había salido. El velo de
        confirmación llega con el JS, o sea tarde por definición.

        Con esta marca puesta desde el cuadro cero, el CSS esconde el esqueleto
        y no se ve nada de la galería hasta que la animación termina. El script
        va inline y sin defer a propósito: cualquier cosa que corra después del
        primer pintado llega tarde para esto.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{if(location.search.indexOf('fresh=1')>-1)" +
            "document.documentElement.dataset.pago='confirmando';}catch(e){}})();",
        }}
      />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
      />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.5.0/dist/tabler-icons.min.css"
      />
      {children}
    </>
  );
}
