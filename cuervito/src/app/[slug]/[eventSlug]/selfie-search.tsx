"use client";

import { useRef, useState } from "react";

const MAX_DIM = 1280; // Resize before sending to avoid huge base64 payloads
const TARGET_QUALITY = 0.85;

async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });

    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas context");
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", TARGET_QUALITY),
    );
    if (!blob) throw new Error("Compression failed");

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") return reject(new Error("read error"));
        // Strip the `data:image/jpeg;base64,` prefix
        resolve(result.split(",", 2)[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type SelfieResult =
  | { kind: "ok"; photoIds: string[] }
  | { kind: "no-face" }
  | { kind: "error"; message: string }
  | { kind: "cancelled" };

export function SelfieSearchButton({
  eventId,
  onResult,
}: {
  eventId: string;
  onResult: (r: SelfieResult) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  async function onPick(file: File) {
    setPending(true);
    try {
      const imageBase64 = await compressImage(file);
      const res = await fetch("/api/face-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64, eventId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        onResult({ kind: "error", message: data.error ?? "Búsqueda fallida" });
        return;
      }
      const data = (await res.json()) as {
        photoIds?: string[];
        noFaceDetected?: boolean;
        imageTooLarge?: boolean;
      };
      if (data.noFaceDetected) {
        onResult({ kind: "no-face" });
        return;
      }
      if (data.imageTooLarge) {
        onResult({
          kind: "error",
          message: "La foto pesa demasiado. Probá otra.",
        });
        return;
      }
      onResult({ kind: "ok", photoIds: data.photoIds ?? [] });
    } catch (err) {
      onResult({
        kind: "error",
        message: err instanceof Error ? err.message : "Error de red",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPick(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className="selfie-btn"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
      >
        {pending ? (
          <>
            <span
              style={{
                width: 14,
                height: 14,
                border: "2px solid currentColor",
                borderTopColor: "transparent",
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin 0.9s linear infinite",
              }}
            />
            <span>Buscando…</span>
          </>
        ) : (
          <>
            <i className="ti ti-face-id" style={{ fontSize: 16 }} />
            <span>Buscar por selfie</span>
          </>
        )}
      </button>
    </>
  );
}
