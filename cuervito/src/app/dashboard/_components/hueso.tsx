/**
 * Las piezas de los esqueletos de carga.
 *
 * Hay un loading.tsx por pantalla y no uno solo para todo /v2. El único que
 * había tenía forma de inicio —tres tarjetas de números y dos columnas— y se
 * mostraba también al entrar a Ventas, a Perfil y a Ayuda: aparecía una
 * estructura, y al llegar los datos la pantalla se reacomodaba entera. Un
 * esqueleto con la forma equivocada es peor que no tener ninguno, porque
 * promete un layout y después lo cambia.
 *
 * La regla de todos: mismas cajas, mismos tamaños y mismos huecos que la
 * pantalla de verdad. Si el esqueleto y la pantalla no coinciden, el salto al
 * cargar se ve igual que si no hubiera esqueleto.
 */
export function Hueso({
  a,
  alto = 12,
  radio,
  arriba,
  bloque,
}: {
  /** Ancho: número de píxeles o cualquier medida CSS ("60%"). */
  a?: number | string;
  alto?: number;
  radio?: number | string;
  arriba?: number;
  bloque?: boolean;
}) {
  return (
    <span
      className="sk"
      style={{
        display: bloque ? "block" : undefined,
        width: a ?? "100%",
        height: alto,
        borderRadius: radio,
        marginTop: arriba,
      }}
    />
  );
}

/** El lienzo con su encabezado, que es igual en las siete pantallas. */
export function Lienzo({
  titulo = 220,
  bajada = 300,
  children,
}: {
  titulo?: number;
  bajada?: number | null;
  children: React.ReactNode;
}) {
  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <Hueso a={titulo} alto={34} />
            {bajada !== null && <Hueso a={bajada} alto={14} arriba={12} bloque />}
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

/** Una tarjeta con título y unas líneas: sirve para casi cualquier bloque. */
export function TarjetaHueso({ lineas = 3, titulo = 130 }: { lineas?: number; titulo?: number }) {
  return (
    <div className="card">
      <div className="card-h">
        <Hueso a={titulo} alto={15} />
      </div>
      {Array.from({ length: lineas }).map((_, i) => (
        <Hueso key={i} a={`${92 - i * 11}%`} alto={12} arriba={i === 0 ? 0 : 14} bloque />
      ))}
    </div>
  );
}

/** Filas de una tabla. El ancho decreciente evita que parezca una grilla. */
export function FilasHueso({ n = 5, clase = "" }: { n?: number; clase?: string }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <div className={`row ${clase}`} key={i} style={{ pointerEvents: "none" }}>
          <Hueso a={34} alto={34} radio="50%" />
          <span style={{ minWidth: 0 }}>
            <Hueso a={`${72 - (i % 3) * 12}%`} alto={13} bloque />
            <Hueso a={`${52 - (i % 3) * 10}%`} alto={10} arriba={6} bloque />
          </span>
          <Hueso a={54} alto={12} />
          <Hueso a={70} alto={12} />
          <Hueso a={78} alto={20} radio={100} />
        </div>
      ))}
    </>
  );
}
