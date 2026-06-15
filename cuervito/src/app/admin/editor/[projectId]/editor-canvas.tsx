"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer as KonvaLayer, Image as KonvaImage, Rect, Ellipse, Text, Transformer } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";

import type { EditorDoc, Layer } from "~/lib/editor-types";

type Props = {
  doc: EditorDoc;
  sourceUrl: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
  stageRef: React.MutableRefObject<Konva.Stage | null>;
};

/**
 * Konva canvas. Renders the source photo as background + every layer on top.
 * Owns its own DOM sizing (auto-fit container width, preserves aspect via
 * scaling — the underlying stage stays at doc.width × doc.height "world"
 * coordinates so exports are pixel-accurate).
 */
export default function EditorCanvas({
  doc,
  sourceUrl,
  selectedId,
  onSelect,
  onUpdateLayer,
  stageRef,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => {
      if (!wrapRef.current) return;
      setContainerWidth(wrapRef.current.clientWidth);
      setContainerHeight(wrapRef.current.clientHeight);
    });
    ro.observe(wrapRef.current);
    setContainerWidth(wrapRef.current.clientWidth);
    setContainerHeight(wrapRef.current.clientHeight);
    return () => ro.disconnect();
  }, []);

  // Fit canvas to container while preserving doc aspect.
  const fitScale =
    containerWidth > 0 && containerHeight > 0
      ? Math.min(containerWidth / doc.width, containerHeight / doc.height)
      : 0;
  const stageW = doc.width * fitScale;
  const stageH = doc.height * fitScale;

  // Background photo — useImage handles CORS + async load.
  const [bgImg] = useImage(sourceUrl ?? "", "anonymous");

  // Transformer ref so we can attach it to the currently selected node.
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
              // Click on empty stage = deselect.
              if (e.target === e.target.getStage()) onSelect(null);
            }}
            onTouchStart={(e) => {
              if (e.target === e.target.getStage()) onSelect(null);
            }}
          >
            <KonvaLayer>
              {bgImg && (
                <KonvaImage
                  image={bgImg}
                  x={0}
                  y={0}
                  width={doc.width}
                  height={doc.height}
                  listening={false}
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
                    // Reset scale on the node and bake it into the layer.
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
                    } else {
                      onUpdateLayer(layer.id, {
                        x: node.x(),
                        y: node.y(),
                        rotation: node.rotation(),
                        radiusX: Math.max(4, layer.radiusX * scaleX),
                        radiusY: Math.max(4, layer.radiusY * scaleY),
                      });
                    }
                  },
                };

                if (layer.type === "text") {
                  return (
                    <Text
                      {...commonProps}
                      text={layer.text}
                      fontFamily={layer.fontFamily}
                      fontSize={layer.fontSize}
                      fontStyle={layer.fontWeight >= 600 ? "bold" : "normal"}
                      fill={layer.color}
                      align={layer.align}
                      width={layer.width}
                      offsetX={layer.width / 2}
                      offsetY={layer.fontSize / 2}
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
                  // Prevent collapsing to zero size.
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
