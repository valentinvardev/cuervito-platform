import { notFound } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";
import {
  buildGoogleFontsHref,
  parseFilters,
  parseLayers,
  parseMetadata,
  type EditorDoc,
  type ImageLayer,
  type Layer,
} from "~/lib/editor-types";

import { EditorShell } from "./editor-shell";

export default async function EditorProjectPage(props: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await props.params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const project = await db.editorProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      name: true,
      sourceKey: true,
      layers: true,
      filters: true,
      metadata: true,
      isTemplate: true,
      width: true,
      height: true,
    },
  });
  if (!project || project.ownerId !== session.user.id) notFound();

  const sourceUrl = project.sourceKey
    ? await resolveMediaUrl(project.sourceKey).catch(() => null)
    : null;

  // Resolve URLs for any image layers (the key is persisted, URL is transient).
  const rawLayers = parseLayers(project.layers);
  const layers: Layer[] = await Promise.all(
    rawLayers.map(async (l) => {
      if (l.type !== "image") return l;
      const img = l as ImageLayer;
      try {
        const url = await resolveMediaUrl(img.sourceKey);
        return { ...img, url };
      } catch {
        return img;
      }
    }),
  );

  const doc: EditorDoc = {
    width: project.width,
    height: project.height,
    sourceKey: project.sourceKey,
    layers,
    filters: parseFilters(project.filters),
  };

  return (
    <>
      {/* Google Fonts — only on the editor route so other admin pages stay light. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={buildGoogleFontsHref()} />

      <EditorShell
        projectId={project.id}
        projectName={project.name}
        isTemplate={project.isTemplate}
        initialDoc={doc}
        initialSourceUrl={sourceUrl}
        initialMetadata={parseMetadata(project.metadata)}
      />
    </>
  );
}
