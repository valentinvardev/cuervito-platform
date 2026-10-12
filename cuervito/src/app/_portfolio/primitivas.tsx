"use client";

/**
 * Las piezas editables que usan todas las plantillas: un nodo (texto o
 * imagen) que en el editor se puede seleccionar y en el sitio público es un
 * elemento común, sin nada del editor encima.
 *
 * Vienen de photo-saas (components/editor/canvas/primitives.tsx). Lo que
 * cambia es de dónde leen: el store por sitio de ./store, no uno global.
 */

import { useRef } from "react";

import { srcDeImagen, useEditorStore } from "./store";
import type { ImageCrop } from "./tipos";

/** "50% 40%" → [50, 40]. Lo que no se entiende es el centro. */
function posicionDe(s: string | undefined): [number, number] {
  const m = /^(-?[\d.]+)%\s+(-?[\d.]+)%$/.exec(s ?? "");
  return m ? [Number(m[1]), Number(m[2])] : [50, 50];
}

const limitar = (n: number) => Math.min(100, Math.max(0, n));

/** Lo que hace falta para mover una foto dentro de su recuadro con el mouse. */
type Arrastre = {
  x: number;
  y: number;
  px: number;
  py: number;
  /** Cuánto sobra de la foto en cada eje con object-fit: cover; 0 = no se mueve. */
  sobraX: number;
  sobraY: number;
  nx: number;
  ny: number;
  movio: boolean;
  img: HTMLImageElement;
};

/**
 * El logo como imagen, con el recorte opcional del panel. El ancho es el de
 * logo.width; el alto sale de la proporción del recorte (o de la imagen).
 */
export function LogoImage({
  src,
  alt,
  width,
  crop,
  style,
}: {
  src: string;
  alt?: string;
  width: number;
  crop?: ImageCrop;
  style?: React.CSSProperties;
}) {
  // El filtro lo pone el sitio (--ed-logo-filtro): invierte el logo cuando su
  // tono no contrasta con el fondo de la plantilla.
  const filtro = "var(--ed-logo-filtro, none)";
  if (!crop) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt ?? ""} style={{ width, height: "auto", objectFit: "contain", display: "block", filter: filtro, ...style }} />;
  }
  return (
    <div style={{ width, aspectRatio: crop.aspectRatio, overflow: "hidden", position: "relative", display: "block", ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ""}
        style={{
          position: "absolute",
          left: `${(-crop.x / crop.w) * 100}%`,
          top: `${(-crop.y / crop.h) * 100}%`,
          width: `${(100 / crop.w) * 100}%`,
          height: `${(100 / crop.h) * 100}%`,
          maxWidth: "none",
          filter: filtro,
        }}
      />
    </div>
  );
}

export function EditableNode({
  id,
  children,
  style,
  className,
  tag: Tag = "div",
}: {
  id: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  tag?: "div" | "h1" | "h2" | "h3" | "p" | "span" | "blockquote" | "header" | "section" | "footer";
}) {
  const node = useEditorStore((s) => s.nodes[id]);
  const selected = useEditorStore((s) => s.selectedId === id);
  const editing = useEditorStore((s) => s.editingId === id);
  const readOnly = useEditorStore((s) => s.readOnly);
  const selectNode = useEditorStore((s) => s.selectNode);
  const setEditing = useEditorStore((s) => s.setEditing);
  const updateNode = useEditorStore((s) => s.updateNode);
  const isTextNode = node?.type === "heading" || node?.type === "paragraph" || node?.type === "logo";
  const esImagen = node?.type === "image";
  const arrastre = useRef<Arrastre | null>(null);

  if (node?.hidden) return null;

  const overrides: React.CSSProperties = {};
  if (node?.fontSize) overrides.fontSize = node.fontSize;
  if (node?.fontWeight) overrides.fontWeight = node.fontWeight;
  if (node?.fontStyle) overrides.fontStyle = node.fontStyle;
  if (node?.textAlign) overrides.textAlign = node.textAlign;
  if (node?.color) overrides.color = node.color;
  if (node?.fontFamily) overrides.fontFamily = node.fontFamily;

  const El = Tag as "div";

  // En el sitio público, un elemento común: sin marcas del editor ni
  // manejadores de selección.
  if (readOnly) {
    return (
      <El className={className} style={{ position: "relative", ...style, ...overrides }}>
        {children}
      </El>
    );
  }

  /* Una foto elegida se mueve arrastrándola: el encuadre (object-position)
     sigue al mouse mientras se arrastra, directo sobre el <img> para no pasar
     por el store en cada movimiento, y se guarda una sola vez al soltar. El
     recorrido se calcula con lo que sobra de la foto en cada eje; si no sobra
     nada en un eje, en ese eje no se mueve. */
  const empezarArrastre = (e: React.PointerEvent<HTMLElement>) => {
    if (!esImagen || !selected || e.button !== 0) return;
    const img = e.currentTarget.querySelector("img");
    if (!img?.naturalWidth) return;
    const caja = e.currentTarget.getBoundingClientRect();
    const escala = Math.max(caja.width / img.naturalWidth, caja.height / img.naturalHeight);
    const [px, py] = posicionDe(getComputedStyle(img).objectPosition);
    arrastre.current = {
      x: e.clientX,
      y: e.clientY,
      px,
      py,
      sobraX: img.naturalWidth * escala - caja.width,
      sobraY: img.naturalHeight * escala - caja.height,
      nx: px,
      ny: py,
      movio: false,
      img,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moverArrastre = (e: React.PointerEvent<HTMLElement>) => {
    const a = arrastre.current;
    if (!a) return;
    const dx = e.clientX - a.x;
    const dy = e.clientY - a.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) a.movio = true;
    a.nx = a.sobraX > 1 ? limitar(a.px - (dx / a.sobraX) * 100) : a.px;
    a.ny = a.sobraY > 1 ? limitar(a.py - (dy / a.sobraY) * 100) : a.py;
    a.img.style.objectPosition = `${Math.round(a.nx)}% ${Math.round(a.ny)}%`;
  };
  const soltarArrastre = (e: React.PointerEvent<HTMLElement>) => {
    const a = arrastre.current;
    arrastre.current = null;
    if (!a) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (a.movio) updateNode(id, { objectPosition: `${Math.round(a.nx)}% ${Math.round(a.ny)}%` });
  };

  return (
    <El
      data-editor-node=""
      data-node-id={id}
      data-tipo={node?.type}
      className={className}
      data-selected={selected ? "true" : undefined}
      data-editing={editing ? "true" : undefined}
      onPointerDown={empezarArrastre}
      onPointerMove={moverArrastre}
      onPointerUp={soltarArrastre}
      onPointerCancel={soltarArrastre}
      onClick={(e) => {
        e.stopPropagation();
        if (editing) return;
        // Un toque selecciona, otro toque edita: el doble clic no anda bien en
        // el teléfono. Las imágenes sólo se seleccionan.
        if (selected && isTextNode) setEditing(id);
        else selectNode(id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        selectNode(id);
        setEditing(id);
      }}
      style={{ position: "relative", ...style, ...overrides, ...(esImagen && selected ? { touchAction: "none" } : {}) }}
    >
      {children}
    </El>
  );
}

export function EditableText({
  id,
  style,
  display = "block",
}: {
  id: string;
  style?: React.CSSProperties;
  display?: "block" | "inline" | "inline-block";
}) {
  const content = useEditorStore((s) => s.nodes[id]?.content ?? "");
  // La edición en línea (Tiptap) llega con el editor; hasta entonces el texto
  // se muestra igual en el sitio y en el panel.
  //
  // Es HTML porque los títulos llevan <em> y <br/>. Lo escribe sólo el dueño
  // del portfolio y se sanea al guardar (va con el editor): nunca llega acá
  // HTML escrito por un visitante.
  return <span style={{ display, ...style }} dangerouslySetInnerHTML={{ __html: content }} />;
}

export function EditableImage({ id, imgStyle }: { id: string; imgStyle?: React.CSSProperties }) {
  const node = useEditorStore((s) => s.nodes[id]);
  const src = useEditorStore((s) => srcDeImagen(s.nodes[id]?.src, s.galleryPhotos));
  // Sin foto (un portfolio todavía vacío), nada: un <img src=""> hace que el
  // navegador vuelva a pedir la página entera.
  if (!src) return null;
  const style: React.CSSProperties = { ...imgStyle };
  if (node?.objectFit) style.objectFit = node.objectFit;
  if (node?.objectPosition) style.objectPosition = node.objectPosition;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={node?.alt ?? ""} style={style} />;
}
