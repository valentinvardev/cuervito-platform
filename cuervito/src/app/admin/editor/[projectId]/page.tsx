import { notFound } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";
import { parseLayers, type EditorDoc } from "~/lib/editor-types";

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
      width: true,
      height: true,
    },
  });
  if (!project || project.ownerId !== session.user.id) notFound();

  const sourceUrl = project.sourceKey
    ? await resolveMediaUrl(project.sourceKey).catch(() => null)
    : null;

  const doc: EditorDoc = {
    width: project.width,
    height: project.height,
    sourceKey: project.sourceKey,
    layers: parseLayers(project.layers),
  };

  return (
    <EditorShell
      projectId={project.id}
      projectName={project.name}
      initialDoc={doc}
      initialSourceUrl={sourceUrl}
    />
  );
}
