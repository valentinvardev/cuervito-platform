import type { Metadata } from "next";

import "~/styles/prototype/styles.css";
import "~/styles/prototype/panel-anim.css";
import "~/styles/prototype/comparativa.css";

// La página es un componente cliente, así que sus metadatos van acá.
export const metadata: Metadata = {
  title: "Comparativa · encontrate.app",
  description: "Misma comisión que las demás plataformas de fotos deportivas, y mejor todo lo demás: búsqueda por cara y dorsal, cobro directo en tu Mercado Pago, tu marca.",
  alternates: { canonical: "/comparativa" },
};

export default function ComparativaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.5.0/dist/tabler-icons.min.css"
      />
      {children}
    </>
  );
}
