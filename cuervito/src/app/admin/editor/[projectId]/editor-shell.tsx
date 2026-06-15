"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";

import {
  emptyDoc,
  layerLabel,
  makeEllipseLayer,
  makeRectLayer,
  makeTextLayer,
  type EditorDoc,
  type Layer,
} from "~/lib/editor-types";

import { renameProject, saveProjectDoc } from "../actions";

// Konva needs the DOM — load the canvas only in the browser.
const EditorCanvas = dynamic(() => import("./editor-canvas"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-tertiary)",
        fontSize: 14,
      }}
    >
      Cargando canvas…
    </div>
  ),
});

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function EditorShell({
  projectId,
  projectName,
  initialDoc,
  initialSourceUrl,
}: {
  projectId: string;
  projectName: string;
  initialDoc: EditorDoc;
  initialSourceUrl: string | null;
}) {
  const [doc, setDoc] = useState<EditorDoc>(initialDoc);
  const [sourceUrl, setSourceUrl] = useState<string | null>(initialSourceUrl);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState(projectName);
  const [savedName, setSavedName] = useState(projectName);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);

  // Debounced autosave.
  useEffect(() => {
    if (saveState === "saving") return;
    if (doc === initialDoc) return;
    setSaveState("dirty");
    const t = setTimeout(async () => {
      setSaveState("saving");
      const res = await saveProjectDoc(projectId, doc).catch(() => ({
        error: "Error al guardar",
      }));
      if (res.error) {
        setSaveState("error");
      } else {
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  // Keyboard shortcuts: Delete/Backspace to remove selected layer.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      // Don't intercept while typing in inputs.
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteLayer(selectedId);
      }
      if (e.key === "Escape") setSelectedId(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selected: Layer | null = useMemo(
    () => doc.layers.find((l) => l.id === selectedId) ?? null,
    [doc.layers, selectedId],
  );

  // ── Mutations ────────────────────────────────────────────────────────────
  const updateLayer = useCallback((id: string, patch: Partial<Layer>) => {
    setDoc((d) => ({
      ...d,
      layers: d.layers.map((l) =>
        l.id === id ? ({ ...l, ...patch } as Layer) : l,
      ),
    }));
  }, []);

  function addLayer(layer: Layer) {
    setDoc((d) => ({ ...d, layers: [...d.layers, layer] }));
    setSelectedId(layer.id);
  }

  function deleteLayer(id: string) {
    setDoc((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== id) }));
    setSelectedId(null);
  }

  function moveLayer(id: string, dir: "up" | "down") {
    setDoc((d) => {
      const idx = d.layers.findIndex((l) => l.id === id);
      if (idx === -1) return d;
      const swap = dir === "up" ? idx + 1 : idx - 1;
      if (swap < 0 || swap >= d.layers.length) return d;
      const next = [...d.layers];
      [next[idx], next[swap]] = [next[swap]!, next[idx]!];
      return { ...d, layers: next };
    });
  }

  function toggleVisible(id: string) {
    updateLayer(id, { visible: !doc.layers.find((l) => l.id === id)?.visible });
  }

  async function handleNameBlur() {
    if (name === savedName) return;
    const res = await renameProject(projectId, name);
    if (res.error) {
      setName(savedName);
    } else {
      setSavedName(name);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", projectId);
      const res = await fetch("/api/admin/editor/upload", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        sourceKey?: string;
        url?: string;
        width?: number;
        height?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Subida fallida");
      }
      setSourceUrl(data.url ?? null);
      setDoc((d) => ({
        ...d,
        sourceKey: data.sourceKey ?? null,
        width: data.width ?? d.width,
        height: data.height ?? d.height,
      }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setUploading(false);
    }
  }

  function exportPng() {
    if (!stageRef.current) return;
    const stage = stageRef.current;
    // Bake at native resolution: pixelRatio = 1 / current scale.
    const ratio = doc.width / stage.width();
    const dataUrl = stage.toDataURL({ pixelRatio: ratio, mimeType: "image/png" });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${name.replace(/[^\w-]+/g, "-") || "editor-export"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function resetCanvas() {
    if (!confirm("¿Vaciar el canvas? Se pierden todos los layers (la foto fuente se conserva).")) return;
    setDoc((d) => ({ ...emptyDoc(d.width, d.height), sourceKey: d.sourceKey }));
    setSelectedId(null);
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 64 + 49, // admin top + tabs
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-base)",
      }}
    >
      {/* Toolbar */}
      <header
        style={{
          height: 52,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 16px",
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <Link
          href="/admin/editor"
          aria-label="Volver a la lista"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 8,
            color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <i className="ti ti-arrow-left" />
        </Link>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
          placeholder="Nombre del proyecto"
          style={{
            background: "transparent",
            border: "1px solid transparent",
            color: "var(--text-primary)",
            fontSize: 14,
            fontWeight: 500,
            padding: "6px 10px",
            borderRadius: 8,
            outline: "none",
            minWidth: 200,
          }}
        />
        <SaveBadge state={saveState} />

        <div style={{ flex: 1 }} />

        {/* Add layer buttons */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleUpload(f);
            e.target.value = "";
          }}
        />
        <ToolButton
          icon="ti-photo-up"
          label={uploading ? "Subiendo…" : sourceUrl ? "Cambiar foto" : "Subir foto"}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        />
        <ToolButton
          icon="ti-typography"
          label="Texto"
          onClick={() => addLayer(makeTextLayer(doc.width, doc.height))}
        />
        <ToolButton
          icon="ti-square"
          label="Rectángulo"
          onClick={() => addLayer(makeRectLayer(doc.width, doc.height))}
        />
        <ToolButton
          icon="ti-circle"
          label="Elipse"
          onClick={() => addLayer(makeEllipseLayer(doc.width, doc.height))}
        />

        <span
          style={{
            width: 1,
            height: 24,
            background: "var(--border-subtle)",
            margin: "0 4px",
          }}
        />

        <ToolButton icon="ti-eraser" label="Vaciar" onClick={resetCanvas} />
        <button
          type="button"
          className="btn btn-primary"
          onClick={exportPng}
          style={{ height: 34, padding: "0 14px", fontSize: 13 }}
        >
          <i className="ti ti-download" />
          Exportar PNG
        </button>
      </header>

      {uploadError && (
        <div
          style={{
            padding: "6px 16px",
            background: "rgba(224,85,85,0.08)",
            borderBottom: "1px solid rgba(224,85,85,0.4)",
            color: "var(--error)",
            fontSize: 12.5,
            flexShrink: 0,
          }}
        >
          <i className="ti ti-alert-circle" /> {uploadError}
        </div>
      )}

      {/* Body: left layers panel · canvas · right properties panel */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <LayersPanel
          layers={doc.layers}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDelete={deleteLayer}
          onMove={moveLayer}
          onToggleVisible={toggleVisible}
        />

        <EditorCanvas
          doc={doc}
          sourceUrl={sourceUrl}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUpdateLayer={updateLayer}
          stageRef={stageRef}
        />

        <PropertiesPanel
          layer={selected}
          onChange={(patch) => selected && updateLayer(selected.id, patch)}
        />
      </div>
    </div>
  );
}

// ── Save badge ──────────────────────────────────────────────────────────────
function SaveBadge({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const map: Record<SaveState, { label: string; color: string; icon: string } | null> = {
    idle: null,
    dirty: { label: "Sin guardar", color: "var(--text-tertiary)", icon: "ti-circle-dot" },
    saving: { label: "Guardando…", color: "var(--text-secondary)", icon: "ti-loader-2" },
    saved: { label: "Guardado", color: "var(--success)", icon: "ti-check" },
    error: { label: "Error al guardar", color: "var(--error)", icon: "ti-alert-circle" },
  };
  const data = map[state];
  if (!data) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        color: data.color,
      }}
    >
      <i className={`ti ${data.icon}`} />
      {data.label}
    </span>
  );
}

// ── Toolbar button ──────────────────────────────────────────────────────────
function ToolButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 34,
        padding: "0 12px",
        borderRadius: 8,
        background: "transparent",
        border: "1px solid var(--border-subtle)",
        color: "var(--text-primary)",
        fontSize: 12.5,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 14 }} />
      <span className="hide-when-narrow">{label}</span>
      <style>{`
        @media (max-width: 1000px) {
          .hide-when-narrow { display: none; }
        }
      `}</style>
    </button>
  );
}

// ── Layers panel (left) ─────────────────────────────────────────────────────
function LayersPanel({
  layers,
  selectedId,
  onSelect,
  onDelete,
  onMove,
  onToggleVisible,
}: {
  layers: Layer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: "up" | "down") => void;
  onToggleVisible: (id: string) => void;
}) {
  // Render top-to-bottom (top of list = top of stack).
  const reversed = [...layers].reverse();
  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-subtle)",
        overflowY: "auto",
        padding: "10px 8px",
      }}
    >
      <div
        style={{
          padding: "4px 8px 10px",
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        Layers
      </div>
      {layers.length === 0 ? (
        <div
          style={{
            padding: 18,
            fontSize: 12,
            color: "var(--text-tertiary)",
            textAlign: "center",
            border: "1px dashed var(--border-subtle)",
            borderRadius: 10,
            margin: "8px",
          }}
        >
          Sin layers. Agregá texto o formas desde la toolbar.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {reversed.map((layer) => {
            const active = layer.id === selectedId;
            return (
              <div
                key={layer.id}
                onClick={() => onSelect(layer.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 8px",
                  borderRadius: 8,
                  background: active ? "var(--accent-deep)" : "transparent",
                  border: active
                    ? "1px solid var(--border-accent)"
                    : "1px solid transparent",
                  cursor: "pointer",
                  fontSize: 12.5,
                  color: active ? "var(--accent)" : "var(--text-primary)",
                }}
              >
                <i
                  className={`ti ${
                    layer.type === "text"
                      ? "ti-typography"
                      : layer.type === "rect"
                        ? "ti-square"
                        : "ti-circle"
                  }`}
                  style={{ fontSize: 14, opacity: 0.7 }}
                />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {layerLabel(layer)}
                </span>
                <button
                  type="button"
                  aria-label="Visibilidad"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisible(layer.id);
                  }}
                  style={iconBtnStyle}
                >
                  <i className={`ti ${layer.visible ? "ti-eye" : "ti-eye-off"}`} />
                </button>
                <button
                  type="button"
                  aria-label="Subir"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(layer.id, "up");
                  }}
                  style={iconBtnStyle}
                >
                  <i className="ti ti-chevron-up" />
                </button>
                <button
                  type="button"
                  aria-label="Bajar"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(layer.id, "down");
                  }}
                  style={iconBtnStyle}
                >
                  <i className="ti ti-chevron-down" />
                </button>
                <button
                  type="button"
                  aria-label="Eliminar"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(layer.id);
                  }}
                  style={{ ...iconBtnStyle, color: "var(--error)" }}
                >
                  <i className="ti ti-trash" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 5,
  background: "transparent",
  border: "none",
  color: "var(--text-tertiary)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  fontSize: 13,
  flexShrink: 0,
};

// ── Properties panel (right) ────────────────────────────────────────────────
function PropertiesPanel({
  layer,
  onChange,
}: {
  layer: Layer | null;
  onChange: (patch: Partial<Layer>) => void;
}) {
  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-subtle)",
        overflowY: "auto",
        padding: 14,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          marginBottom: 12,
        }}
      >
        Propiedades
      </div>
      {!layer ? (
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>
          Seleccioná un layer para editarlo.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {layer.type === "text" && (
            <>
              <Field label="Texto">
                <textarea
                  value={layer.text}
                  onChange={(e) => onChange({ text: e.target.value })}
                  rows={3}
                  style={inputStyle}
                />
              </Field>
              <Field label="Color">
                <ColorInput
                  value={layer.color}
                  onChange={(v) => onChange({ color: v })}
                />
              </Field>
              <Row>
                <Field label="Tamaño" small>
                  <input
                    type="number"
                    value={Math.round(layer.fontSize)}
                    min={8}
                    max={400}
                    onChange={(e) => onChange({ fontSize: Number(e.target.value) || 12 })}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Peso" small>
                  <select
                    value={layer.fontWeight}
                    onChange={(e) =>
                      onChange({
                        fontWeight: Number(e.target.value) as
                          | 400
                          | 500
                          | 600
                          | 700
                          | 800,
                      })
                    }
                    style={inputStyle}
                  >
                    <option value={400}>Normal</option>
                    <option value={500}>Medium</option>
                    <option value={600}>Semibold</option>
                    <option value={700}>Bold</option>
                    <option value={800}>Black</option>
                  </select>
                </Field>
              </Row>
              <Field label="Alineación">
                <select
                  value={layer.align}
                  onChange={(e) =>
                    onChange({ align: e.target.value as "left" | "center" | "right" })
                  }
                  style={inputStyle}
                >
                  <option value="left">Izquierda</option>
                  <option value="center">Centro</option>
                  <option value="right">Derecha</option>
                </select>
              </Field>
            </>
          )}
          {(layer.type === "rect" || layer.type === "ellipse") && (
            <>
              <Field label="Relleno">
                <ColorInput
                  value={layer.fill}
                  onChange={(v) => onChange({ fill: v })}
                />
              </Field>
              <Field label="Borde">
                <ColorInput
                  value={layer.stroke ?? "#000000"}
                  onChange={(v) => onChange({ stroke: v })}
                  allowNull
                  isNull={!layer.stroke}
                  onClear={() => onChange({ stroke: null, strokeWidth: 0 })}
                />
              </Field>
              {layer.stroke && (
                <Field label="Grosor borde" small>
                  <input
                    type="number"
                    value={layer.strokeWidth}
                    min={0}
                    max={100}
                    onChange={(e) => onChange({ strokeWidth: Number(e.target.value) || 0 })}
                    style={inputStyle}
                  />
                </Field>
              )}
              {layer.type === "rect" && (
                <Field label="Border radius" small>
                  <input
                    type="number"
                    value={layer.cornerRadius}
                    min={0}
                    max={500}
                    onChange={(e) =>
                      onChange({ cornerRadius: Number(e.target.value) || 0 })
                    }
                    style={inputStyle}
                  />
                </Field>
              )}
            </>
          )}

          <hr
            style={{
              border: "none",
              borderTop: "1px solid var(--border-subtle)",
              margin: "4px 0",
            }}
          />

          <Row>
            <Field label="X" small>
              <input
                type="number"
                value={Math.round(layer.x)}
                onChange={(e) => onChange({ x: Number(e.target.value) || 0 })}
                style={inputStyle}
              />
            </Field>
            <Field label="Y" small>
              <input
                type="number"
                value={Math.round(layer.y)}
                onChange={(e) => onChange({ y: Number(e.target.value) || 0 })}
                style={inputStyle}
              />
            </Field>
          </Row>

          <Row>
            <Field label="Rotación" small>
              <input
                type="number"
                value={Math.round(layer.rotation)}
                onChange={(e) => onChange({ rotation: Number(e.target.value) || 0 })}
                style={inputStyle}
              />
            </Field>
            <Field label="Opacidad" small>
              <input
                type="number"
                value={Math.round(layer.opacity * 100)}
                min={0}
                max={100}
                onChange={(e) =>
                  onChange({
                    opacity: Math.max(0, Math.min(1, Number(e.target.value) / 100)),
                  })
                }
                style={inputStyle}
              />
            </Field>
          </Row>
        </div>
      )}
    </aside>
  );
}

function Field({
  label,
  small,
  children,
}: {
  label: string;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: small ? 1 : undefined }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 8 }}>{children}</div>;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-base)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
  padding: "7px 10px",
  borderRadius: 8,
  fontFamily: "inherit",
  fontSize: 12.5,
  outline: "none",
};

function ColorInput({
  value,
  onChange,
  allowNull,
  isNull,
  onClear,
}: {
  value: string;
  onChange: (hex: string) => void;
  allowNull?: boolean;
  isNull?: boolean;
  onClear?: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="color"
        value={isNull ? "#000000" : value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 36,
          height: 30,
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          padding: 2,
          background: "var(--bg-base)",
          cursor: "pointer",
        }}
      />
      <input
        type="text"
        value={isNull ? "Sin color" : value.toUpperCase()}
        readOnly={isNull}
        onChange={(e) => {
          const v = e.target.value;
          if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v);
        }}
        style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
      />
      {allowNull && onClear && !isNull && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Quitar"
          style={iconBtnStyle}
        >
          <i className="ti ti-x" />
        </button>
      )}
    </div>
  );
}
