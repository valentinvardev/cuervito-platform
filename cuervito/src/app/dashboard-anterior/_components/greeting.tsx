"use client";

import { useEffect, useState } from "react";

// Elegimos el saludo según la hora local del navegador. Renderizamos
// primero el que corresponde a la hora del servidor (Argentina, UTC-3
// aproximado) y después el useEffect lo corrige a la hora del cliente.
// Si divergen, hay un swap silencioso que casi no se nota.
function pickSalutation(hour: number): string {
  if (hour >= 5 && hour < 12) return "Buen día";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function Greeting({
  name,
  serverHour,
}: {
  name: string;
  serverHour: number;
}) {
  const [salutation, setSalutation] = useState(() => pickSalutation(serverHour));

  useEffect(() => {
    setSalutation(pickSalutation(new Date().getHours()));
  }, []);

  return (
    <h1>
      {salutation}, {name}.
    </h1>
  );
}
