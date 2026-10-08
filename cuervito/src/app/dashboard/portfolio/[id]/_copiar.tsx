"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopiarUrl({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copiar la dirección"
      data-tip={copiado ? "Copiada" : "Copiar la dirección"}
      onClick={() => {
        void navigator.clipboard.writeText(url).then(() => {
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1600);
        });
      }}
    >
      {copiado ? <Check /> : <Copy />}
    </button>
  );
}
