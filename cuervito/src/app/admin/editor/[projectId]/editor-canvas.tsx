"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Stage,
  Layer as KonvaLayer,
  Image as KonvaImage,
  Rect,
  Ellipse,
  Text,
  Transformer,
} from "react-konva";
import useImage from "use-image";
import Konva from "konva";

import {
  applyPlaceholders,
  type EditorDoc,
  type ImageLayer,
  type Layer,
  type ProjectMetadata,
  type SourceFilters,
  type TextLayer,
} from "~/lib/editor-types";

type Props = {
  doc: EditorDoc;
  sourceUrl: string | null;
  metadata: ProjectMetadata;
  projectName: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
  stageRef: React.MutableRefObject<Konva.Stage | null>;
};

/**
 * Pick which Konva filters need to run given the current SourceFilters state.
 * Only enable the ones that are actually doing something so we skip work when
 * the image is unmodified.
 */
function activeFilterPipeline(f: SourceFilters): unknown[] {
  const out: unknown[] = [];
  if (f.brightness !== 0) out.push(Konva.Filters.Brighten);
  if (f.contrast !== 0) out.push(Konva.Filters.Contrast);
  if (f.saturation !== 0 || f.hue !== 0) out.push(Konva.Filters.HSL);
  if (f.blur > 0) out.push(Konva.Filters.Blur);
  if (f.grayscale) out.push(Konva.Filters.Grayscale);
  if (f.sepia) out.push(Konva.Filters.Sepia);
  if (f.invert) out.push(Konva.Filters.Invert);
  return out;
}

// ── Image layer renderer (loads its own image via use-image) ─────────────────
function ImageLayerNode({
  layer,
  commonProps,
}: {
  layer: ImageLayer;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  commonProps: any;
}) {
  const [img] = useImage(layer.url ?? "", "anonymous");
  if (!img) return null;
  return (
    <KonvaImage
      {...commonProps}
      image={img}
      width={layer.width}
      height={layer.height}
      offsetX={layer.width / 2}
      offsetY={layer.height / 2}
    />
  );
}

export default function EditorCanvas({
  doc,
  sourceUrl,
  metadata,
  projectName,
  selectedId,
  onSelect,
  onUpdateLayer,
  stageRef,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(0);
  const [ch, setCh] = useState(0);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => {
      if (!wrapRef.current) return;
      setCw(wrapRef.current.clientWidth);
      setCh(wrapRef.current.clientHeight);
    });
    ro.observe(wrapRef.current);
    setCw(wrapRef.current.clientWidth);
    setCh(wrapRef.current.clientHeight);
    return () => ro.disconnect();
  }, []);

  const fitScale =
    cw > 0 && ch > 0 ? Math.min(cw / doc.width, ch / doc.height) : 0;
  const stageW = doc.width * fitScale;
  const stageH = doc.height * fitScale;

  const [bgImg] = useImage(sourceUrl ?? "", "anonymous");

  // Transformer setup.
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Record<string, Konva.Node>>({});

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    if (!selectedId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = nodeRefs.current[selectedId];
    if (node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
    }
  }, [selectedId, doc.layers]);

  // Background image filter caching. Cache the node whenever filters change so
  // Konva re-runs the pipeline. Without `.cache()` filters are no-ops.
  const bgImgRef = useRef<Konva.Image | null>(null);
  const filterPipeline = useMemo(
    () => activeFilterPipeline(doc.filters),
    [doc.filters],
  );

  useEffect(() => {
    const node = bgImgRef.current;
    if (!node || !bgImg) return;
    if (filterPipeline.length === 0) {
      node.clearCache();
      node.filters([]);
      node.getLayer()?.batchDraw();
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node.filters(filterPipeline as any);
    node.cache();
    node.getLayer()?.batchDraw();
  }, [bgImg, filterPipeline, doc.filters]);

  return (
    <div
      ref={wrapRef}
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg-base)",
        backgroundImage:
          "linear-gradient(45deg, rgba(255,255,255,0.025) 25%, transparent 25%), " +
          "linear-gradient(-45deg, rgba(255,255,255,0.025) 25%, transparent 25%), " +
          "linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.025) 75%), " +
          "linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.025) 75%)",
        backgroundSize: "20px 20px",
        backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
      }}
    >
      {fitScale > 0 && (
        <div
          style={{
            background: "#000",
            boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
            borderRadius: 6,
            overflow: "hidden",
            width: stageW,
            height: stageH,
          }}
        >
          <Stage
            ref={stageRef}
            width={stageW}
            height={stageH}
            scaleX={fitScale}
            scaleY={fitScale}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) onSelect(null);
            }}
            onTouchStart={(e) => {
              if (e.target === e.target.getStage()) onSelect(null);
            }}
          >
            <KonvaLayer>
              {bgImg && (
                <KonvaImage
                  ref={(node) => {
                    bgImgRef.current = node;
                  }}
                  image={bgImg}
                  x={0}
                  y={0}
                  width={doc.width}
                  height={doc.height}
                  listening={false}
                  brightness={doc.filters.brightness}
                  contrast={doc.filters.contrast}
                  saturation={doc.filters.saturation}
                  hue={doc.filters.hue}
                  blurRadius={doc.filters.blur}
                />
              )}

              {doc.layers.map((layer) => {
                if (!layer.visible) return null;

                const commonProps = {
                  key: layer.id,
                  id: layer.id,
                  x: layer.x,
                  y: layer.y,
                  rotation: layer.rotation,
                  opacity: layer.opacity,
                  draggable: !layer.locked,
                  onClick: () => onSelect(layer.id),
                  onTap: () => onSelect(layer.id),
                  ref: (node: Konva.Node | null) => {
                    if (node) nodeRefs.current[layer.id] = node;
                    else delete nodeRefs.current[layer.id];
                  },
                  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
                    onUpdateLayer(layer.id, {
                      x: e.target.x(),
                      y: e.target.y(),
                    });
                  },
                  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
                    const node = e.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    node.scaleX(1);
                    node.scaleY(1);

                    if (layer.type === "text") {
                      onUpdateLayer(layer.id, {
                        x: node.x(),
                        y: node.y(),
                        rotation: node.rotation(),
                        width: Math.max(40, layer.width * scaleX),
                        fontSize: Math.max(8, layer.fontSize * scaleY),
                      });
                    } else if (layer.type === "rect") {
                      onUpdateLayer(layer.id, {
                        x: node.x(),
                        y: node.y(),
                        rotation: node.rotation(),
                        width: Math.max(8, layer.width * scaleX),
                        height: Math.max(8, layer.height * scaleY),
                      });
                    } else if (layer.type === "ellipse") {
                      onUpdateLayer(layer.id, {
                        x: node.x(),
                        y: node.y(),
                        rotation: node.rotation(),
                        radiusX: Math.max(4, layer.radiusX * scaleX),
                        radiusY: Math.max(4, layer.radiusY * scaleY),
                      });
                    } else {
                      onUpdateLayer(layer.id, {
                        x: node.x(),
                        y: node.y(),
                        rotation: node.rotation(),
                        width: Math.max(20, layer.width * scaleX),
                        height: Math.max(20, layer.height * scaleY),
                      });
                    }
                  },
                };

                if (layer.type === "text") {
                  const t = layer as TextLayer;
                  // Konva builds the canvas font shorthand from fontStyle + fontVariant
                  // + fontSize + fontFamily. We pack numeric weight (and italic) into
                  // fontStyle so the browser actually picks the right Google Font.
                  const styleParts: string[] = [];
                  if (t.italic) styleParts.push("italic");
                  styleParts.push(String(t.fontWeight));
                  // Substitute {{ciudad}}, {{fecha}}, ... with the project's
                  // extracted metadata so templates render with live data.
                  const renderedText = applyPlaceholders(t.text, metadata, projectName);
                  return (
                    <Text
                      {...commonProps}
                      text={renderedText}
                      fontFamily={t.fontFamily}
                      fontSize={t.fontSize}
                      fontStyle={styleParts.join(" ")}
                      fill={t.color}
                      align={t.align}
                      width={t.width}
                      letterSpacing={t.letterSpacing}
                      lineHeight={t.lineHeight}
                      offsetX={t.width / 2}
                      offsetY={(t.fontSize * t.lineHeight) / 2}
                    />
                  );
                }
                if (layer.type === "rect") {
                  return (
                    <Rect
                      {...commonProps}
                      width={layer.width}
                      height={layer.height}
                      fill={layer.fill}
                      stroke={layer.stroke ?? undefined}
                      strokeWidth={layer.strokeWidth}
                      cornerRadius={layer.cornerRadius}
                      offsetX={layer.width / 2}
                      offsetY={layer.height / 2}
                    />
                  );
                }
                if (layer.type === "ellipse") {
                  return (
                    <Ellipse
                      {...commonProps}
                      radiusX={layer.radiusX}
                      radiusY={layer.radiusY}
                      fill={layer.fill}
                      stroke={layer.stroke ?? undefined}
                      strokeWidth={layer.strokeWidth}
                    />
                  );
                }
                // image layer
                return (
                  <ImageLayerNode
                    key={layer.id}
                    layer={layer}
                    commonProps={commonProps}
                  />
                );
              })}

              <Transformer
                ref={transformerRef}
                rotateEnabled
                anchorSize={10}
                borderStroke="#F5820A"
                anchorStroke="#F5820A"
                anchorFill="#0F0D0B"
                anchorCornerRadius={3}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 8 || newBox.height < 8) return oldBox;
                  return newBox;
                }}
              />
            </KonvaLayer>
          </Stage>
        </div>
      )}
    </div>
  );
}
