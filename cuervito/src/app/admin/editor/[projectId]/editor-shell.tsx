"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type Konva from "konva";

import {
  duplicateLayer,
  emptyDoc,
  emptyFilters,
  FILTER_PRESETS,
  filtersToCss,
  FONTS,
  layerLabel,
  makeEllipseLayer,
  makeImageLayer,
  makeRectLayer,
  makeTextLayer,
  PLACEHOLDER_GROUPS,
  type EditorDoc,
  type Layer,
  type ProjectMetadata,
  type SourceFilters,
  type TextLayer,
} from "~/lib/editor-types";

import {
  renameProject,
  saveAsTemplate,
  saveProjectDoc,
  updateProjectMetadata,
} from "../actions";

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
const HISTORY_CAP = 80;

export function EditorShell({
  projectId,
  projectName,
  isTemplate,
  initialDoc,
  initialSourceUrl,
  initialMetadata,
}: {
  projectId: string;
  projectName: string;
  isTemplate: boolean;
  initialDoc: EditorDoc;
  initialSourceUrl: string | null;
  initialMetadata: ProjectMetadata;
}) {
  // ── History ─────────────────────────────────────────────────────────────
  const [hist, setHist] = useState<{ stack: EditorDoc[]; idx: number }>({
    stack: [initialDoc],
    idx: 0,
  });
  const doc = hist.stack[hist.idx]!;
  const canUndo = hist.idx > 0;
  const canRedo = hist.idx < hist.stack.length - 1;

  const commitDoc = useCallback(
    (updater: EditorDoc | ((d: EditorDoc) => EditorDoc)) => {
      setHist((h) => {
        const current = h.stack[h.idx]!;
        const next = typeof updater === "function" ? updater(current) : updater;
        if (next === current) return h;
        const cut = h.stack.slice(0, h.idx + 1);
        cut.push(next);
        const trimmed =
          cut.length > HISTORY_CAP ? cut.slice(cut.length - HISTORY_CAP) : cut;
        return { stack: trimmed, idx: trimmed.length - 1 };
      });
    },
    [],
  );

  const undo = useCallback(() => {
    setHist((h) => (h.idx > 0 ? { ...h, idx: h.idx - 1 } : h));
  }, []);
  const redo = useCallback(() => {
    setHist((h) => (h.idx < h.stack.length - 1 ? { ...h, idx: h.idx + 1 } : h));
  }, []);

  // ── UI state ───────────────────────────────────────────────────────────
  const [sourceUrl, setSourceUrl] = useState<string | null>(initialSourceUrl);
  const [metadata, setMetadata] = useState<ProjectMetadata>(initialMetadata);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState(projectName);
  const [savedName, setSavedName] = useState(projectName);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [tplModalOpen, setTplModalOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplSaving, setTplSaving] = useState(false);
  const shapeMenuRef = useRef<HTMLDivElement | null>(null);

  const sourceInputRef = useRef<HTMLInputElement>(null);
  const layerImgInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const lastSavedRef = useRef<EditorDoc>(initialDoc);

  useEffect(() => {
    if (!shapeMenuOpen) return;
    function onClick(e: MouseEvent) {
      if (!shapeMenuRef.current?.contains(e.target as Node)) setShapeMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [shapeMenuOpen]);

  // ── Autosave ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (doc === lastSavedRef.current) return;
    setSaveState("dirty");
    const t = setTimeout(async () => {
      setSaveState("saving");
      const res = await saveProjectDoc(projectId, doc).catch(() => ({
        error: "Error al guardar",
      }));
      if (res.error) {
        setSaveState("error");
      } else {
        lastSavedRef.current = doc;
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [doc, projectId]);

  // ── Mutations ──────────────────────────────────────────────────────────
  const updateLayer = useCallback(
    (id: string, patch: Partial<Layer>) => {
      commitDoc((d) => ({
        ...d,
        layers: d.layers.map((l) =>
          l.id === id ? ({ ...l, ...patch } as Layer) : l,
        ),
      }));
    },
    [commitDoc],
  );

  function addLayer(layer: Layer) {
    commitDoc((d) => ({ ...d, layers: [...d.layers, layer] }));
    setSelectedId(layer.id);
  }

  function deleteLayer(id: string) {
    commitDoc((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== id) }));
    setSelectedId(null);
  }

  function duplicateSelected() {
    const layer = doc.layers.find((l) => l.id === selectedId);
    if (!layer) return;
    const dup = duplicateLayer(layer);
    commitDoc((d) => ({ ...d, layers: [...d.layers, dup] }));
    setSelectedId(dup.id);
  }

  function moveLayer(id: string, dir: "up" | "down") {
    commitDoc((d) => {
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
    const layer = doc.layers.find((l) => l.id === id);
    if (!layer) return;
    updateLayer(id, { visible: !layer.visible });
  }

  function updateFilters(patch: Partial<SourceFilters>) {
    commitDoc((d) => ({ ...d, filters: { ...d.filters, ...patch } }));
  }

  function applyFilterPreset(filters: SourceFilters) {
    commitDoc((d) => ({ ...d, filters }));
  }

  function resetFilters() {
    commitDoc((d) => ({ ...d, filters: emptyFilters() }));
  }

  async function handleNameBlur() {
    if (name === savedName) return;
    const res = await renameProject(projectId, name);
    if (res.error) setName(savedName);
    else setSavedName(name);
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTextField =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (
        meta &&
        (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
        return;
      }
      if (isTextField) return;

      if (meta && e.key.toLowerCase() === "d" && selectedId) {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteLayer(selectedId);
      }
      if (e.key === "Escape") setSelectedId(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, doc, undo, redo]);

  // ── Uploads ────────────────────────────────────────────────────────────
  async function uploadSource(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", projectId);
      form.append("kind", "source");
      const res = await fetch("/api/admin/editor/upload", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        key?: string;
        url?: string;
        width?: number;
        height?: number;
        metadata?: ProjectMetadata;
        error?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Subida fallida");
      setSourceUrl(data.url ?? null);
      if (data.metadata) setMetadata(data.metadata);
      commitDoc((d) => ({
        ...d,
        sourceKey: data.key ?? null,
        width: data.width ?? d.width,
        height: data.height ?? d.height,
      }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveAsTemplate() {
    const trimmed = tplName.trim() || savedName;
    setTplSaving(true);
    try {
      const res = await saveAsTemplate(projectId, trimmed);
      if (res.error) throw new Error(res.error);
      setTplModalOpen(false);
      setTplName("");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error al guardar plantilla");
    } finally {
      setTplSaving(false);
    }
  }

  async function uploadLayerImage(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const tempLayerId = crypto.randomUUID();
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", projectId);
      form.append("kind", "layer");
      form.append("layerId", tempLayerId);
      const res = await fetch("/api/admin/editor/upload", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        key?: string;
        url?: string;
        width?: number;
        height?: number;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.key || !data.url) {
        throw new Error(data.error ?? "Subida fallida");
      }
      const layer = makeImageLayer(
        doc.width,
        doc.height,
        data.key,
        data.url,
        data.width ?? 600,
        data.height ?? 600,
      );
      addLayer(layer);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setUploading(false);
    }
  }

  function exportPng() {
    if (!stageRef.current) return;
    const stage = stageRef.current;
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
    if (
      !confirm(
        "¿Vaciar el canvas? Se pierden todos los layers y filtros (la foto fuente se conserva).",
      )
    )
      return;
    commitDoc((d) => ({ ...emptyDoc(d.width, d.height), sourceKey: d.sourceKey }));
    setSelectedId(null);
  }

  const selected: Layer | null =
    doc.layers.find((l) => l.id === selectedId) ?? null;

  return (
    <div
      className="editor-root"
      style={{
        position: "fixed",
        top: 64 + 49,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-base)",
      }}
    >
      <EditorChromeStyles />

      {/* Toolbar */}
      <header
        style={{
          height: 52,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 14px",
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <Link href="/admin/editor" aria-label="Volver" style={iconLinkStyle}>
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
            minWidth: 180,
          }}
        />
        <SaveBadge state={saveState} />

        <div style={{ flex: 1 }} />

        <IconBtn
          icon="ti-arrow-back-up"
          title="Deshacer (Ctrl+Z)"
          onClick={undo}
          disabled={!canUndo}
        />
        <IconBtn
          icon="ti-arrow-forward-up"
          title="Rehacer (Ctrl+Shift+Z)"
          onClick={redo}
          disabled={!canRedo}
        />

        <Sep />

        <input
          ref={sourceInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadSource(f);
            e.target.value = "";
          }}
        />
        <input
          ref={layerImgInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadLayerImage(f);
            e.target.value = "";
          }}
        />

        <IconBtn
          icon="ti-photo-up"
          title={uploading ? "Subiendo…" : sourceUrl ? "Cambiar foto fuente" : "Subir foto fuente"}
          onClick={() => sourceInputRef.current?.click()}
          disabled={uploading}
        />

        <IconBtn
          icon="ti-typography"
          title="Agregar texto"
          onClick={() => addLayer(makeTextLayer(doc.width, doc.height))}
        />

        {/* Shape dropdown (rect + ellipse hidden in one menu) */}
        <div ref={shapeMenuRef} style={{ position: "relative" }}>
          <IconBtn
            icon="ti-shape"
            title="Agregar forma"
            onClick={() => setShapeMenuOpen((o) => !o)}
            active={shapeMenuOpen}
          />
          {shapeMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                zIndex: 20,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                borderRadius: 10,
                padding: 4,
                minWidth: 170,
                boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
              }}
            >
              <MenuItem
                icon="ti-square"
                label="Rectángulo"
                onClick={() => {
                  setShapeMenuOpen(false);
                  addLayer(makeRectLayer(doc.width, doc.height));
                }}
              />
              <MenuItem
                icon="ti-circle"
                label="Elipse"
                onClick={() => {
                  setShapeMenuOpen(false);
                  addLayer(makeEllipseLayer(doc.width, doc.height));
                }}
              />
            </div>
          )}
        </div>

        <IconBtn
          icon="ti-photo-plus"
          title="Agregar imagen como capa"
          onClick={() => layerImgInputRef.current?.click()}
          disabled={uploading}
        />

        <IconBtn
          icon="ti-copy"
          title="Duplicar (Ctrl+D)"
          onClick={duplicateSelected}
          disabled={!selected}
        />

        <Sep />
        {!isTemplate && (
          <IconBtn
            icon="ti-template"
            title="Guardar como plantilla"
            onClick={() => {
              setTplName(savedName);
              setTplModalOpen(true);
            }}
          />
        )}
        <IconBtn icon="ti-eraser" title="Vaciar canvas" onClick={resetCanvas} />
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

      {tplModalOpen && (
        <TemplateModal
          name={tplName}
          onChange={setTplName}
          onCancel={() => setTplModalOpen(false)}
          onSave={handleSaveAsTemplate}
          saving={tplSaving}
        />
      )}

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
          metadata={metadata}
          projectName={savedName}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUpdateLayer={updateLayer}
          stageRef={stageRef}
        />

        <PropertiesPanel
          layer={selected}
          filters={doc.filters}
          sourceUrl={sourceUrl}
          metadata={metadata}
          isTemplate={isTemplate}
          onChange={(patch) => selected && updateLayer(selected.id, patch)}
          onUpdateFilters={updateFilters}
          onApplyPreset={applyFilterPreset}
          onResetFilters={resetFilters}
          onSaveMetadata={async (next) => {
            // Update local state immediately so the canvas re-renders with the
            // new values, then persist to the DB.
            setMetadata(next);
            await updateProjectMetadata(projectId, next).catch(() => undefined);
          }}
        />
      </div>
    </div>
  );
}

// ── Toolbar bits ────────────────────────────────────────────────────────────
function SaveBadge({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const map = {
    idle: null,
    dirty: { label: "Sin guardar", color: "var(--text-tertiary)", icon: "ti-circle-dot" },
    saving: { label: "Guardando…", color: "var(--text-secondary)", icon: "ti-loader-2" },
    saved: { label: "Guardado", color: "var(--success)", icon: "ti-check" },
    error: { label: "Error al guardar", color: "var(--error)", icon: "ti-alert-circle" },
  } as const;
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

function IconBtn({
  icon,
  title,
  onClick,
  disabled,
  active,
}: {
  icon: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        width: 34,
        height: 34,
        borderRadius: 8,
        background: active ? "var(--accent-deep)" : "transparent",
        border: active
          ? "1px solid var(--border-accent)"
          : "1px solid var(--border-subtle)",
        color: active ? "var(--accent)" : "var(--text-primary)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
        flexShrink: 0,
      }}
    >
      <i className={`ti ${icon}`} />
    </button>
  );
}

const iconLinkStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 8,
  border: "1px solid var(--border-subtle)",
  color: "var(--text-secondary)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  fontSize: 16,
  flexShrink: 0,
};

function Sep() {
  return (
    <span
      style={{
        width: 1,
        height: 22,
        background: "var(--border-subtle)",
        margin: "0 2px",
        flexShrink: 0,
      }}
    />
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "9px 12px",
        borderRadius: 7,
        background: "transparent",
        border: "none",
        color: "var(--text-primary)",
        fontSize: 13,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <i
        className={`ti ${icon}`}
        style={{ fontSize: 15, color: "var(--text-tertiary)" }}
      />
      {label}
    </button>
  );
}

// ── Layers panel ────────────────────────────────────────────────────────────
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
      <PanelHeader label="Layers" />
      {layers.length === 0 ? (
        <div
          style={{
            padding: 18,
            fontSize: 12,
            color: "var(--text-tertiary)",
            textAlign: "center",
            border: "1px dashed var(--border-subtle)",
            borderRadius: 10,
            margin: 8,
          }}
        >
          Sin layers. Agregá texto, formas o imágenes desde la toolbar.
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
                        : layer.type === "ellipse"
                          ? "ti-circle"
                          : "ti-photo"
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
                <IconAction
                  icon={layer.visible ? "ti-eye" : "ti-eye-off"}
                  onClick={() => onToggleVisible(layer.id)}
                  label="Visibilidad"
                />
                <IconAction
                  icon="ti-chevron-up"
                  onClick={() => onMove(layer.id, "up")}
                  label="Subir"
                />
                <IconAction
                  icon="ti-chevron-down"
                  onClick={() => onMove(layer.id, "down")}
                  label="Bajar"
                />
                <IconAction
                  icon="ti-trash"
                  onClick={() => onDelete(layer.id)}
                  label="Eliminar"
                  danger
                />
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}

function IconAction({
  icon,
  onClick,
  label,
  danger,
}: {
  icon: string;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        width: 22,
        height: 22,
        borderRadius: 5,
        background: "transparent",
        border: "none",
        color: danger ? "var(--error)" : "var(--text-tertiary)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        fontSize: 13,
        flexShrink: 0,
      }}
    >
      <i className={`ti ${icon}`} />
    </button>
  );
}

function PanelHeader({ label }: { label: string }) {
  return (
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
      {label}
    </div>
  );
}

// ── Properties panel ────────────────────────────────────────────────────────
function PropertiesPanel({
  layer,
  filters,
  sourceUrl,
  metadata,
  isTemplate,
  onChange,
  onUpdateFilters,
  onApplyPreset,
  onResetFilters,
  onSaveMetadata,
}: {
  layer: Layer | null;
  filters: SourceFilters;
  sourceUrl: string | null;
  metadata: ProjectMetadata;
  isTemplate: boolean;
  onChange: (patch: Partial<Layer>) => void;
  onUpdateFilters: (patch: Partial<SourceFilters>) => void;
  onApplyPreset: (filters: SourceFilters) => void;
  onResetFilters: () => void;
  onSaveMetadata: (next: ProjectMetadata) => Promise<void> | void;
}) {
  const [metaEditOpen, setMetaEditOpen] = useState(false);

  return (
    <aside
      style={{
        width: 290,
        flexShrink: 0,
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-subtle)",
        overflowY: "auto",
        padding: 14,
      }}
    >
      {!layer ? (
        <>
          <MetadataPreview
            metadata={metadata}
            hasSource={!!sourceUrl}
            onEdit={() => setMetaEditOpen(true)}
          />
          {metaEditOpen && (
            <MetadataEditor
              metadata={metadata}
              onClose={() => setMetaEditOpen(false)}
              onSave={async (next) => {
                await onSaveMetadata(next);
                setMetaEditOpen(false);
              }}
            />
          )}
          <PanelHeader label={sourceUrl ? "Filtros de foto" : "Foto fuente"} />
          {!sourceUrl ? (
            <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>
              {isTemplate
                ? "Esta es una plantilla. Las fotos se aplican al usarla en un proyecto nuevo."
                : "Subí una foto desde la toolbar para acceder a los filtros."}
            </div>
          ) : (
            <FilterControls
              filters={filters}
              sourceUrl={sourceUrl}
              onChange={onUpdateFilters}
              onApplyPreset={onApplyPreset}
              onReset={onResetFilters}
            />
          )}
        </>
      ) : (
        <>
          <PanelHeader label="Propiedades" />
          <LayerProperties layer={layer} onChange={onChange} />
        </>
      )}
    </aside>
  );
}

// ── Metadata preview ────────────────────────────────────────────────────────
function MetadataPreview({
  metadata,
  hasSource,
  onEdit,
}: {
  metadata: ProjectMetadata;
  hasSource: boolean;
  onEdit: () => void;
}) {
  if (!hasSource) return null;
  const hasAny =
    metadata.city ||
    metadata.region ||
    metadata.country ||
    metadata.takenAt ||
    metadata.camera ||
    metadata.lens ||
    metadata.aperture ||
    metadata.iso !== undefined ||
    metadata.focalLength;
  const date = metadata.takenAt ? new Date(metadata.takenAt) : null;

  // ── No-metadata warning ──
  if (!hasAny) {
    return (
      <>
        <MetadataHeader onEdit={onEdit} />
        <div
          style={{
            padding: "10px 12px",
            background: "rgba(245,182,42,0.08)",
            border: "1px solid rgba(245,182,42,0.4)",
            borderRadius: 8,
            marginBottom: 18,
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "var(--warning)",
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            <i className="ti ti-alert-triangle" />
            Sin EXIF
          </div>
          Esta foto no tiene metadata embebida. Podés{" "}
          <button
            type="button"
            onClick={onEdit}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              color: "var(--accent)",
              cursor: "pointer",
              textDecoration: "underline",
              font: "inherit",
            }}
          >
            cargarla a mano
          </button>{" "}
          o las variables como{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>{"{{ciudad}}"}</code> se
          van a ver como texto literal.
          <div
            style={{
              marginTop: 6,
              fontSize: 10.5,
              color: "var(--text-tertiary)",
            }}
          >
            Tip: las fotos por WhatsApp / Instagram / capturas pierden el EXIF.
            Probá con una del rollo sin pasar por mensajería.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <MetadataHeader onEdit={onEdit} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "10px 12px",
          background: "var(--bg-base)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          marginBottom: 18,
          fontSize: 12,
          color: "var(--text-secondary)",
        }}
      >
        {(metadata.city || metadata.region || metadata.country) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <i className="ti ti-map-pin" style={{ color: "var(--accent)" }} />
            {[metadata.city, metadata.region, metadata.country]
              .filter(Boolean)
              .join(", ")}
          </div>
        )}
        {date && !isNaN(date.getTime()) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <i className="ti ti-calendar" style={{ color: "var(--accent)" }} />
            {date.toLocaleString("es-AR", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
        {metadata.camera && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <i className="ti ti-camera" style={{ color: "var(--accent)" }} />
            {metadata.camera}
            {metadata.lens && (
              <span style={{ color: "var(--text-tertiary)" }}>
                · {metadata.lens}
              </span>
            )}
          </div>
        )}
        {(metadata.aperture ||
          metadata.exposureTime ||
          metadata.iso !== undefined ||
          metadata.focalLength) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-mono)",
            }}
          >
            <i className="ti ti-aperture" style={{ color: "var(--accent)" }} />
            {[
              metadata.exposureTime,
              metadata.aperture,
              metadata.iso !== undefined ? `ISO ${metadata.iso}` : null,
              metadata.focalLength,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}
        <div
          style={{
            fontSize: 10.5,
            color: "var(--text-tertiary)",
            marginTop: 4,
            paddingTop: 6,
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          Insertá variables como{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>{"{{ciudad}}"}</code>{" "}
          o <code style={{ fontFamily: "var(--font-mono)" }}>{"{{exif}}"}</code>{" "}
          en los textos.
        </div>
      </div>
    </>
  );
}

// ── Save-as-template modal ──────────────────────────────────────────────────
function TemplateModal({
  name,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  name: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,6,5,0.72)",
        backdropFilter: "blur(6px)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 14,
          padding: 22,
          width: "100%",
          maxWidth: 380,
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: "-0.015em",
            marginBottom: 4,
          }}
        >
          Guardar como plantilla
        </h3>
        <p
          style={{
            fontSize: 12.5,
            color: "var(--text-tertiary)",
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          Se guarda una copia con los layers + filtros + dimensiones, sin la foto
          fuente. La vas a poder reusar al crear un proyecto nuevo.
        </p>
        <label
          style={{
            display: "block",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
            marginBottom: 5,
          }}
        >
          Nombre
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nombre de la plantilla"
          style={{
            width: "100%",
            padding: "9px 12px",
            background: "var(--bg-base)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            color: "var(--text-primary)",
            fontSize: 13,
            outline: "none",
            marginBottom: 16,
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={saving}
            style={{ height: 32, padding: "0 14px", fontSize: 13 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSave}
            disabled={saving}
            style={{ height: 32, padding: "0 14px", fontSize: 13 }}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterControls({
  filters,
  sourceUrl,
  onChange,
  onApplyPreset,
  onReset,
}: {
  filters: SourceFilters;
  sourceUrl: string;
  onChange: (patch: Partial<SourceFilters>) => void;
  onApplyPreset: (filters: SourceFilters) => void;
  onReset: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PresetGallery
        sourceUrl={sourceUrl}
        currentFilters={filters}
        onApply={onApplyPreset}
      />

      <hr style={{ border: "none", borderTop: "1px solid var(--border-subtle)", margin: 0 }} />

      <Slider
        label="Brillo"
        value={filters.brightness}
        min={-0.5}
        max={0.5}
        step={0.01}
        onChange={(v) => onChange({ brightness: v })}
      />
      <Slider
        label="Contraste"
        value={filters.contrast}
        min={-50}
        max={50}
        step={1}
        onChange={(v) => onChange({ contrast: v })}
      />
      <Slider
        label="Saturación"
        value={filters.saturation}
        min={-1}
        max={3}
        step={0.05}
        onChange={(v) => onChange({ saturation: v })}
      />
      <Slider
        label="Tono"
        value={filters.hue}
        min={-180}
        max={180}
        step={1}
        onChange={(v) => onChange({ hue: v })}
      />
      <Slider
        label="Desenfoque"
        value={filters.blur}
        min={0}
        max={40}
        step={1}
        onChange={(v) => onChange({ blur: v })}
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <FilterChip
          label="B/N"
          active={filters.grayscale}
          onClick={() => onChange({ grayscale: !filters.grayscale })}
        />
        <FilterChip
          label="Sepia"
          active={filters.sepia}
          onClick={() => onChange({ sepia: !filters.sepia })}
        />
        <FilterChip
          label="Invertir"
          active={filters.invert}
          onClick={() => onChange({ invert: !filters.invert })}
        />
      </div>
      <button
        type="button"
        onClick={onReset}
        style={{
          height: 30,
          fontSize: 12,
          background: "transparent",
          border: "1px solid var(--border-subtle)",
          borderRadius: 7,
          color: "var(--text-secondary)",
          cursor: "pointer",
        }}
      >
        <i className="ti ti-rotate" style={{ marginRight: 4 }} />
        Restablecer filtros
      </button>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 10px",
        borderRadius: 6,
        background: active ? "var(--accent-deep)" : "var(--bg-base)",
        border: active
          ? "1px solid var(--border-accent)"
          : "1px solid var(--border-subtle)",
        color: active ? "var(--accent)" : "var(--text-primary)",
        fontSize: 12,
        cursor: "pointer",
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

function LayerProperties({
  layer,
  onChange,
}: {
  layer: Layer;
  onChange: (patch: Partial<Layer>) => void;
}) {
  const activeFont =
    layer.type === "text"
      ? FONTS.find((f) => f.cssFamily === (layer as TextLayer).fontFamily) ?? null
      : null;

  return (
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

          <Field label="Insertar metadata">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {PLACEHOLDER_GROUPS.map((g) => (
                <div key={g.group}>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9.5,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--text-tertiary)",
                      marginBottom: 3,
                    }}
                  >
                    {g.group}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {g.items.map((p) => (
                      <button
                        key={p.token}
                        type="button"
                        onClick={() =>
                          onChange({ text: (layer.text || "") + p.token })
                        }
                        title={`Inserta ${p.token}. Si la foto tiene la metadata correspondiente, se reemplaza automáticamente.`}
                        style={{
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: "var(--bg-base)",
                          border: "1px solid var(--border-subtle)",
                          color: "var(--text-secondary)",
                          fontSize: 11,
                          cursor: "pointer",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Field>

          <Field label="Tipografía">
            <select
              value={activeFont?.family ?? FONTS[0]!.family}
              onChange={(e) => {
                const next = FONTS.find((f) => f.family === e.target.value);
                if (!next) return;
                const closestWeight = next.weights.reduce((a, b) =>
                  Math.abs(b - layer.fontWeight) < Math.abs(a - layer.fontWeight) ? b : a,
                );
                onChange({
                  fontFamily: next.cssFamily,
                  fontWeight: closestWeight,
                  italic: next.italics ? layer.italic : false,
                });
              }}
              style={{ ...inputStyle, fontFamily: layer.fontFamily }}
            >
              {FONTS.map((f) => (
                <option key={f.family} value={f.family} style={{ fontFamily: f.cssFamily }}>
                  {f.family}
                </option>
              ))}
            </select>
          </Field>

          <Row>
            <Field label="Peso" small>
              <select
                value={layer.fontWeight}
                onChange={(e) =>
                  onChange({
                    fontWeight: Number(e.target.value) as TextLayer["fontWeight"],
                  })
                }
                style={inputStyle}
              >
                {(activeFont?.weights ?? [400, 700]).map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </Field>
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
          </Row>

          <Field label="Color">
            <ColorInput value={layer.color} onChange={(v) => onChange({ color: v })} />
          </Field>

          {/* Alineación con iconos (pedido del user) */}
          <Field label="Alineación">
            <SegmentedIcons
              value={layer.align}
              options={[
                { value: "left", icon: "ti-align-left", label: "Izquierda" },
                { value: "center", icon: "ti-align-center", label: "Centro" },
                { value: "right", icon: "ti-align-right", label: "Derecha" },
              ]}
              onChange={(v) => onChange({ align: v as TextLayer["align"] })}
            />
          </Field>

          <Row>
            <Field label="Cursiva" small>
              <button
                type="button"
                onClick={() => activeFont?.italics && onChange({ italic: !layer.italic })}
                disabled={!activeFont?.italics}
                title={
                  activeFont?.italics ? "Cursiva" : "Esta tipografía no tiene cursiva"
                }
                style={{
                  ...inputStyle,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: layer.italic ? "var(--accent-deep)" : "var(--bg-base)",
                  color: layer.italic ? "var(--accent)" : "var(--text-primary)",
                  border: layer.italic
                    ? "1px solid var(--border-accent)"
                    : "1px solid var(--border-subtle)",
                  cursor: activeFont?.italics ? "pointer" : "not-allowed",
                  opacity: activeFont?.italics ? 1 : 0.5,
                }}
              >
                <i className="ti ti-italic" />
              </button>
            </Field>
            <Field label="Tracking" small>
              <input
                type="number"
                value={layer.letterSpacing}
                step={0.1}
                onChange={(e) =>
                  onChange({ letterSpacing: Number(e.target.value) || 0 })
                }
                style={inputStyle}
              />
            </Field>
          </Row>

          <Field label="Line-height" small>
            <input
              type="number"
              step="0.05"
              value={layer.lineHeight}
              onChange={(e) => onChange({ lineHeight: Number(e.target.value) || 1 })}
              style={inputStyle}
            />
          </Field>
        </>
      )}

      {(layer.type === "rect" || layer.type === "ellipse") && (
        <>
          <Field label="Relleno">
            <ColorInput value={layer.fill} onChange={(v) => onChange({ fill: v })} />
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
                onChange={(e) =>
                  onChange({ strokeWidth: Number(e.target.value) || 0 })
                }
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

      {layer.type === "image" && (
        <div
          style={{
            padding: 10,
            background: "var(--bg-base)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--text-tertiary)",
          }}
        >
          Imagen sobrepuesta. Movela / redimensionala desde el canvas.
        </div>
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
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────
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
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        flex: small ? 1 : undefined,
      }}
    >
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
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: "transparent",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i className="ti ti-x" />
        </button>
      )}
    </div>
  );
}

function SegmentedIcons({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; icon: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        gap: 4,
        padding: 3,
        background: "var(--bg-base)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
      }}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => onChange(o.value)}
            style={{
              height: 28,
              borderRadius: 6,
              background: active ? "var(--accent)" : "transparent",
              color: active ? "var(--text-on-accent, #1a0d00)" : "var(--text-primary)",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            <i className={`ti ${o.icon}`} />
          </button>
        );
      })}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
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
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-secondary)",
          }}
        >
          {step >= 1 ? Math.round(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          {
            width: "100%",
            accentColor: "var(--accent)",
            // Tell the CSS gradient where the thumb actually is, so the
            // orange fill on the track ends exactly under the bolita.
            "--fill": `${Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))}%`,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

// ── Preset gallery ──────────────────────────────────────────────────────────
function PresetGallery({
  sourceUrl,
  currentFilters,
  onApply,
}: {
  sourceUrl: string;
  currentFilters: SourceFilters;
  onApply: (f: SourceFilters) => void;
}) {
  const currentCss = filtersToCss(currentFilters);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        Presets
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          padding: "2px 2px 8px",
          scrollbarWidth: "thin",
        }}
      >
        {FILTER_PRESETS.map((preset) => {
          const cssFilter = filtersToCss(preset.filters);
          const isActive = cssFilter === currentCss;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApply(preset.filters)}
              title={preset.name}
              style={{
                flexShrink: 0,
                width: 70,
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 5,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 8,
                  background: `url(${sourceUrl}) center/cover`,
                  filter: cssFilter,
                  border: isActive
                    ? "2px solid var(--accent)"
                    : "2px solid var(--border-subtle)",
                  boxShadow: isActive ? "0 0 0 2px var(--accent-deep)" : "none",
                  transition: "border-color 150ms, box-shadow 150ms",
                }}
              />
              <span
                style={{
                  fontSize: 10.5,
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  fontWeight: isActive ? 600 : 400,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 68,
                }}
              >
                {preset.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Scoped chrome styles for the editor (sliders + scrollbars) ──────────────
function EditorChromeStyles() {
  return (
    <style>{`
      .editor-root input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 20px;
        background: transparent;
        cursor: pointer;
        accent-color: var(--accent);
      }
      .editor-root input[type="range"]::-webkit-slider-runnable-track {
        height: 4px;
        border-radius: 999px;
        background: linear-gradient(
          to right,
          var(--accent) 0%,
          var(--accent) var(--fill, 50%),
          rgba(255, 255, 255, 0.12) var(--fill, 50%),
          rgba(255, 255, 255, 0.12) 100%
        );
      }
      .editor-root input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--accent);
        border: 2px solid #fff;
        margin-top: -5px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5),
          0 0 0 1px rgba(245, 130, 10, 0.4);
        transition: transform 120ms ease;
      }
      .editor-root input[type="range"]::-webkit-slider-thumb:hover {
        transform: scale(1.15);
      }
      .editor-root input[type="range"]::-moz-range-track {
        height: 4px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
      }
      .editor-root input[type="range"]::-moz-range-progress {
        height: 4px;
        border-radius: 999px;
        background: var(--accent);
      }
      .editor-root input[type="range"]::-moz-range-thumb {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--accent);
        border: 2px solid #fff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5),
          0 0 0 1px rgba(245, 130, 10, 0.4);
      }

      /* Scrollbars — thin and on-brand. Applies to every scrollable area
         inside the editor (panels + preset strip). */
      .editor-root *,
      .editor-root {
        scrollbar-width: thin;
        scrollbar-color: rgba(245, 130, 10, 0.45) transparent;
      }
      .editor-root *::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .editor-root *::-webkit-scrollbar-track {
        background: transparent;
      }
      .editor-root *::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 999px;
        border: 2px solid transparent;
        background-clip: padding-box;
        transition: background 150ms;
      }
      .editor-root *::-webkit-scrollbar-thumb:hover {
        background: rgba(245, 130, 10, 0.6);
        background-clip: padding-box;
      }
      .editor-root *::-webkit-scrollbar-corner {
        background: transparent;
      }
    `}</style>
  );
}

// ── Metadata header (small "Editar" link next to the panel title) ───────────
function MetadataHeader({ onEdit }: { onEdit: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "4px 0 10px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        Metadata de la foto
      </span>
      <button
        type="button"
        onClick={onEdit}
        title="Editar a mano. Lo que tipees pisa lo que vino del EXIF."
        style={{
          background: "transparent",
          border: "none",
          color: "var(--accent)",
          fontSize: 11,
          fontWeight: 500,
          cursor: "pointer",
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
        }}
      >
        <i className="ti ti-pencil" />
        Editar
      </button>
    </div>
  );
}

// ── Metadata editor (inline form for manual editing) ────────────────────────
function MetadataEditor({
  metadata,
  onClose,
  onSave,
}: {
  metadata: ProjectMetadata;
  onClose: () => void;
  onSave: (next: ProjectMetadata) => Promise<void> | void;
}) {
  const initialDate = metadata.takenAt
    ? toLocalDateInput(new Date(metadata.takenAt))
    : "";
  const initialTime = metadata.takenAt
    ? toLocalTimeInput(new Date(metadata.takenAt))
    : "";

  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [city, setCity] = useState(metadata.city ?? "");
  const [region, setRegion] = useState(metadata.region ?? "");
  const [country, setCountry] = useState(metadata.country ?? "");
  const [camera, setCamera] = useState(metadata.camera ?? "");
  const [lens, setLens] = useState(metadata.lens ?? "");
  const [aperture, setAperture] = useState(metadata.aperture ?? "");
  const [exposureTime, setExposureTime] = useState(metadata.exposureTime ?? "");
  const [iso, setIso] = useState(
    metadata.iso !== undefined ? String(metadata.iso) : "",
  );
  const [focalLength, setFocalLength] = useState(metadata.focalLength ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    let takenAt: string | undefined;
    if (date) {
      const dt = new Date(`${date}T${time || "00:00"}:00`);
      if (!isNaN(dt.getTime())) takenAt = dt.toISOString();
    }
    const next: ProjectMetadata = {
      ...(takenAt ? { takenAt } : {}),
      ...(city.trim() ? { city: city.trim() } : {}),
      ...(region.trim() ? { region: region.trim() } : {}),
      ...(country.trim() ? { country: country.trim() } : {}),
      ...(camera.trim() ? { camera: camera.trim() } : {}),
      ...(lens.trim() ? { lens: lens.trim() } : {}),
      ...(aperture.trim() ? { aperture: aperture.trim() } : {}),
      ...(exposureTime.trim() ? { exposureTime: exposureTime.trim() } : {}),
      ...(focalLength.trim() ? { focalLength: focalLength.trim() } : {}),
      ...(iso.trim() && !isNaN(Number(iso))
        ? { iso: Math.round(Number(iso)) }
        : {}),
      // Preserve GPS coords — we don't expose them in the form.
      ...(metadata.lat !== undefined ? { lat: metadata.lat } : {}),
      ...(metadata.lon !== undefined ? { lon: metadata.lon } : {}),
    };
    try {
      await onSave(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,6,5,0.72)",
        backdropFilter: "blur(6px)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 14,
          padding: 22,
          width: "100%",
          maxWidth: 460,
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 14,
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 17,
              letterSpacing: "-0.015em",
            }}
          >
            Editar metadata
          </h3>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            aria-label="Cerrar"
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "transparent",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
              cursor: saving ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="ti ti-x" />
          </button>
        </header>

        <p
          style={{
            fontSize: 12,
            color: "var(--text-tertiary)",
            marginBottom: 14,
            lineHeight: 1.5,
          }}
        >
          Lo que tipees acá pisa lo que vino del EXIF. Dejar un campo vacío
          deja la variable sin valor (se ve como token literal).
        </p>

        <MetaSection label="Cuándo">
          <MetaRow>
            <MetaField label="Fecha">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={metaInputStyle}
              />
            </MetaField>
            <MetaField label="Hora">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={metaInputStyle}
              />
            </MetaField>
          </MetaRow>
        </MetaSection>

        <MetaSection label="Dónde">
          <MetaField label="Ciudad">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Córdoba"
              style={metaInputStyle}
            />
          </MetaField>
          <MetaRow>
            <MetaField label="Provincia">
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Córdoba"
                style={metaInputStyle}
              />
            </MetaField>
            <MetaField label="País">
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Argentina"
                style={metaInputStyle}
              />
            </MetaField>
          </MetaRow>
        </MetaSection>

        <MetaSection label="Cámara">
          <MetaField label="Modelo">
            <input
              type="text"
              value={camera}
              onChange={(e) => setCamera(e.target.value)}
              placeholder="Canon EOS R5"
              style={metaInputStyle}
            />
          </MetaField>
          <MetaField label="Lente">
            <input
              type="text"
              value={lens}
              onChange={(e) => setLens(e.target.value)}
              placeholder="RF 70-200mm F2.8 L IS USM"
              style={metaInputStyle}
            />
          </MetaField>
          <MetaRow>
            <MetaField label="Apertura">
              <input
                type="text"
                value={aperture}
                onChange={(e) => setAperture(e.target.value)}
                placeholder="f/2.8"
                style={metaInputStyle}
              />
            </MetaField>
            <MetaField label="Exposición">
              <input
                type="text"
                value={exposureTime}
                onChange={(e) => setExposureTime(e.target.value)}
                placeholder="1/200"
                style={metaInputStyle}
              />
            </MetaField>
          </MetaRow>
          <MetaRow>
            <MetaField label="ISO">
              <input
                type="number"
                value={iso}
                onChange={(e) => setIso(e.target.value)}
                placeholder="400"
                style={metaInputStyle}
              />
            </MetaField>
            <MetaField label="Focal">
              <input
                type="text"
                value={focalLength}
                onChange={(e) => setFocalLength(e.target.value)}
                placeholder="85mm"
                style={metaInputStyle}
              />
            </MetaField>
          </MetaRow>
        </MetaSection>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={saving}
            style={{ height: 32, padding: "0 14px", fontSize: 13 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ height: 32, padding: "0 14px", fontSize: 13 }}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

function MetaRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 8 }}>{children}</div>;
}

function MetaField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        flex: 1,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{label}</span>
      {children}
    </label>
  );
}

const metaInputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-base)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
  padding: "7px 10px",
  borderRadius: 7,
  fontFamily: "inherit",
  fontSize: 12.5,
  outline: "none",
};

function toLocalDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toLocalTimeInput(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
