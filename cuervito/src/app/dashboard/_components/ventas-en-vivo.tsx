"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeDollarSign } from "lucide-react";

/**
 * La venta que acaba de entrar, arriba a la derecha.
 *
 * El servidor ya publicaba estas ventas —el webhook de Mercado Pago avisa al
 * bus cuando un pago pasa a PAID, y /api/dashboard/sales-stream las manda por
 * SSE— pero del lado del navegador las dos mitades habían quedado en el panel
 * viejo. Con el panel nuevo el servidor publicaba al vacío: nadie suscripto.
 *
 * Va montado en el Shell y no en la página de inicio. En el panel viejo estaba
 * en la página, así que el aviso sólo llegaba mientras el fotógrafo estaba
 * parado en el inicio; si se iba a Ventas o a un evento —que es donde pasa el
 * rato cuando está trabajando— no se enteraba de nada. Justo al revés de lo
 * que uno querría.
 *
 * EventSource reconecta solo cuando se corta, así que no hay nada que
 * reintentar a mano: alcanza con abrirlo una vez y cerrarlo al desmontar.
 *
 * Y además del cartel dispara router.refresh(), que es lo que hace que se
 * actualice TODO el panel: los importes, las fotos vendidas, la conversión, la
 * curva y la fila nueva en últimas ventas. La página es force-dynamic, así que
 * el refresh vuelve a correr el componente de servidor contra la base y React
 * reconcilia el árbol sin recargar ni perder el scroll.
 *
 * Deliberadamente NO se calcula nada en el navegador con el dato del SSE. Sería
 * más rápido sumarle el importe al total que ya está en pantalla, pero ahí
 * habría dos cuentas para el mismo número —una en el servidor y otra acá— y el
 * día que difieran gana la que el fotógrafo tiene delante, que es la mala. El
 * SSE avisa QUE pasó algo; qué mostrar lo sigue decidiendo la base.
 */

type VentaDelServidor = {
  saleId: string;
  /** En centavos. */
  amount: number;
  itemCount: number;
  eventName: string;
  buyerName: string | null;
  paidAt: string;
};

type Aviso = {
  id: string;
  quien: string;
  detalle: string;
  monto: string;
  yendo: boolean;
};

/** Cuánto se queda en pantalla antes de irse sola. */
const DURACION_MS = 7000;
/** Lo que tarda la animación de salida; tiene que coincidir con panel.css. */
const SALIDA_MS = 260;
/** Cuántas se muestran juntas. Más que esto tapa el panel. */
const MAXIMO = 3;

function pesos(centavos: number): string {
  return `$${(centavos / 100).toLocaleString("es-AR")}`;
}

export function VentasEnVivo() {
  const router = useRouter();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  // Los timers se guardan para poder limpiarlos si el componente se va con
  // avisos todavía en pantalla.
  const relojes = useRef<ReturnType<typeof setTimeout>[]>([]);
  const refresco = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/dashboard/sales-stream");

    es.addEventListener("sale", (e) => {
      let v: VentaDelServidor;
      try {
        v = JSON.parse((e as MessageEvent<string>).data) as VentaDelServidor;
      } catch {
        return;
      }

      const aviso: Aviso = {
        id: v.saleId,
        // Sin nombre es una compra de invitado, que es la mayoría: el atleta
        // compra sin crear cuenta. "Alguien" es la verdad y no un hueco.
        quien: v.buyerName?.trim() ?? "Alguien",
        detalle: `compró ${v.itemCount} ${v.itemCount === 1 ? "foto" : "fotos"} · ${v.eventName}`,
        monto: pesos(v.amount),
        yendo: false,
      };

      setAvisos((prev) => {
        // El webhook de Mercado Pago puede repetir el mismo aviso: reintenta
        // hasta que le contestamos 200, y un aviso duplicado se lee como dos
        // ventas.
        if (prev.some((a) => a.id === aviso.id)) return prev;
        return [...prev, aviso].slice(-MAXIMO);
      });

      // Con dos ventas en el mismo segundo alcanza un refresh para las dos:
      // el segundo pediría el panel entero de nuevo para ver lo que el primero
      // ya trajo.
      if (refresco.current) clearTimeout(refresco.current);
      refresco.current = setTimeout(() => router.refresh(), 250);

      relojes.current.push(
        setTimeout(() => {
          setAvisos((prev) => prev.map((a) => (a.id === aviso.id ? { ...a, yendo: true } : a)));
          relojes.current.push(
            setTimeout(() => {
              setAvisos((prev) => prev.filter((a) => a.id !== aviso.id));
            }, SALIDA_MS),
          );
        }, DURACION_MS),
      );
    });

    return () => {
      es.close();
      for (const r of relojes.current) clearTimeout(r);
      relojes.current = [];
      if (refresco.current) clearTimeout(refresco.current);
    };
  }, [router]);

  if (avisos.length === 0) return null;

  return (
    // aria-live para que un lector de pantalla lo lea al llegar; "polite"
    // porque una venta no interrumpe lo que el fotógrafo esté haciendo.
    <div className="ventas-vivo" aria-live="polite">
      {avisos.map((a) => (
        <div key={a.id} className="venta-viva" data-yendo={a.yendo ? "1" : undefined}>
          <span className="venta-viva-av">
            <BadgeDollarSign />
          </span>
          <span className="venta-viva-t">
            <b>{a.quien}</b>
            <span>{a.detalle}</span>
          </span>
          <span className="venta-viva-m">{a.monto}</span>
        </div>
      ))}
    </div>
  );
}
