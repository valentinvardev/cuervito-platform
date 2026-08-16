"use client";

import { CircleAlert, CircleCheck, CloudUpload } from "lucide-react";
import { useRef, useState } from "react";

import { ACEPTADOS, useSubida } from "~/app/dashboard/events/[id]/usar-subida";

/**
 * Soltar fotos, arriba de la grilla del evento.
 *
 * Es la primera cosa que hace un fotógrafo cuando entra a un evento suyo, así
 * que va primero y ocupa lugar. En el panel viejo estaba, pero al portar la
 * pantalla se me quedó afuera y el evento quedaba siendo sólo de lectura: se
 * veían las fotos y no había manera de agregar ninguna.
 *
 * La subida es la MISMA de siempre (useSubida): firmado por lotes, cola de diez
 * y commit contra los endpoints que ya existen. Acá sólo cambia el dibujo.
 *
 * Mientras sube no se muestra una celda por foto como en el panel viejo. Con
 * cuatrocientas fotos esa grilla de miniaturas es lo más pesado de la pantalla
 * justo cuando el navegador está ocupado subiendo. Una barra y tres números
 * dicen lo mismo: cuántas van, cuántas fallaron, cuánto falta.
 */
export function Soltador({ eventId, maxBytes }: { eventId: string; maxBytes: number }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const [afuera, setAfuera] = useState(0);
  const [grandes, setGrandes] = useState(0);

  // Sin miniaturas: esta pantalla muestra una barra y tres números, no una
  // celda por foto. Pedirlas sería leer cada archivo entero a base64 para
  // tirarlo.
  const { total, hechas, fallidas, cerrado, fase, pct, agregar, limpiar } = useSubida(eventId, {
    miniaturas: 0,
    maxBytes,
  });

  async function recibir(lista: FileList | File[]) {
    const r = await agregar(lista);
    setAfuera(r?.afuera ?? 0);
    setGrandes(r?.grandes ?? 0);
  }

  if (fase !== "idle") {
    const todoMal = cerrado && fallidas === total;
    return (
      <section className="card">
        <div className="proc">
          <div className={`etapa ${cerrado ? "" : "lenta"}`}>
            <div className="etapa-t">
              <b>
                <span className="et-i">
                  {todoMal ? <CircleAlert /> : cerrado ? <CircleCheck /> : <CloudUpload />}
                </span>
                {cerrado ? "Listo" : "Subiendo tus fotos"}
              </b>
              <span className="cuenta">
                {hechas} de {total}
              </span>
            </div>

            <div className="pista-b">
              <i style={{ width: `${pct}%` }} />
            </div>

            <div className="detalle">
              {cerrado ? (
                fallidas > 0 ? (
                  <>
                    {fallidas === total
                      ? "No se pudo subir ninguna."
                      : `${fallidas} no se pudieron subir.`}{" "}
                    Suele ser la conexión: probá de nuevo con esas.
                  </>
                ) : (
                  <>
                    Ya están arriba. El reconocimiento corre solo y las fotos van apareciendo abajo a
                    medida que termina.
                  </>
                )
              ) : (
                <>No cierres esta pestaña hasta que termine.</>
              )}
            </div>
          </div>

          {cerrado && (
            <div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={limpiar}>
                Subir más fotos
              </button>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <>
      <div
        className={`soltar ${encima ? "encima" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => entrada.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            entrada.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          if (e.dataTransfer.files.length) void recibir(e.dataTransfer.files);
        }}
      >
        <input
          ref={entrada}
          type="file"
          accept={ACEPTADOS}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void recibir(e.target.files);
            // Se limpia para que elegir el mismo archivo dos veces vuelva a
            // disparar el change.
            e.target.value = "";
          }}
        />
        <span className="soltar-i">
          <CloudUpload />
        </span>
        <b>Arrastrá tus fotos acá</b>
        <span>JPG o PNG. Podés soltar la carpeta entera del evento.</span>
      </div>

      {afuera > 0 && (
        <div className="porque">
          <CircleAlert />
          <span>
            {afuera === 1 ? "Un archivo quedó" : `${afuera} archivos quedaron`} afuera por el
            formato. Se aceptan JPG, PNG y WebP; el HEIC del iPhone no, así que conviene exportarlas
            antes.
          </span>
        </div>
      )}

      {/* Se avisa acá y las demás suben igual. La API rechaza el pedido entero
          si una sola foto se pasa del tope, así que antes una de 40 MB en el
          medio se llevaba puestas a las otras cuarenta y nueve de su tanda. */}
      {grandes > 0 && (
        <div className="porque">
          <CircleAlert />
          <span>
            {grandes === 1 ? "Una foto pesa" : `${grandes} fotos pesan`} más de{" "}
            {Math.round(maxBytes / 1024 / 1024)} MB y {grandes === 1 ? "quedó" : "quedaron"} afuera.
            El resto se está subiendo igual.
          </span>
        </div>
      )}
    </>
  );
}
