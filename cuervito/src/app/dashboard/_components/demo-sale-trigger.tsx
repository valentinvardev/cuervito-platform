"use client";

import { useEffect } from "react";

type ServerSalePayload = {
  saleId: string;
  amount: number; // cents
  itemCount: number;
  eventName: string;
  buyerName: string | null;
  paidAt: string;
};

function formatARS(cents: number): string {
  return `$${(cents / 100).toLocaleString("es-AR")}`;
}

/**
 * Subscribes to /api/dashboard/sales-stream and fires the SaleToast every
 * time a real sale is paid. EventSource auto-reconnects on disconnect.
 */
export function DemoSaleTrigger() {
  useEffect(() => {
    const es = new EventSource("/api/dashboard/sales-stream");

    es.addEventListener("sale", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as ServerSalePayload;
        window.cuervitoNotifySale?.({
          amount: formatARS(data.amount),
          detail: `${data.itemCount} ${data.itemCount === 1 ? "foto" : "fotos"} · ${data.eventName}`,
        });
      } catch (err) {
        console.warn("[sales-stream] bad payload:", err);
      }
    });

    es.onerror = () => {
      // EventSource auto-retries; just log once.
      // console.debug("[sales-stream] disconnected, will retry");
    };

    return () => es.close();
  }, []);

  return null;
}
