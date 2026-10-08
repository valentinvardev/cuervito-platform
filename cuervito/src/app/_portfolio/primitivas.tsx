"use client";

/**
 * Las piezas editables que usan todas las plantillas: un nodo (texto o
 * imagen) que en el editor se puede seleccionar y en el sitio público es un
 * elemento común, sin nada del editor encima.
 *
 * Vienen de photo-saas (components/editor/canvas/primitives.tsx). Lo que
 * cambia es de dónde leen: el store por sitio de ./store, no uno global.
 */

import { srcDeImagen, useEditorStore } from "./store";
import type { ImageCrop } from "./tipos";

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
  if (!crop) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt ?? ""} style={{ width, height: "auto", objectFit: "contain", display: "block", ...style }} />;
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
  const isTextNode = node?.type === "heading" || node?.type === "paragraph" || node?.type === "logo";

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

  return (
    <El
      data-editor-node=""
      data-node-id={id}
      className={className}
      data-selected={selected ? "true" : undefined}
      data-editing={editing ? "true" : undefined}
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
      style={{ position: "relative", ...style, ...overrides }}
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
