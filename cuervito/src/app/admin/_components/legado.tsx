/**
 * El envoltorio de las pantallas del admin que todavía usan el CSS viejo.
 *
 * Las listas —usuarios, eventos, ventas, métricas, correos— ya están escritas
 * con el vocabulario del panel y no necesitan nada. Las que quedan —la ficha
 * de usuario, la configuración, la marca de agua, el editor— siguen con las
 * clases del prototipo de cuervito, y ese CSS vive anidado bajo `.adm` para
 * que no toque el armazón (ver scripts/envolver-admin-css.mjs).
 *
 * Así que ésta es la lista de lo que falta portar: cada pantalla que deje de
 * usar esto es una menos. El día que ninguna lo importe, se borra junto con
 * admin-cuerpo.css y admin.css.
 */
export function Legado({ children }: { children: React.ReactNode }) {
  return (
    <main className="canvas">
      <div className="canvas-in adm">{children}</div>
    </main>
  );
}
