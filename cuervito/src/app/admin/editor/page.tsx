import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

import {
  FoldersShell,
  type FolderRow,
  type ProjectRow,
} from "./folders-shell";
import { NewProjectPicker } from "./new-project-picker";

export default async function AdminEditorPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [all, folders, events] = await Promise.all([
    db.editorProject.findMany({
      where: { ownerId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        sourceKey: true,
        width: true,
        height: true,
        updatedAt: true,
        isTemplate: true,
        folderId: true,
      },
    }),
    db.editorFolder.findMany({
      where: { ownerId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        eventId: true,
        event: { select: { name: true } },
        _count: { select: { projects: true } },
      },
    }),
    db.event.findMany({
      where: { ownerId: session.user.id },
      orderBy: { eventDate: "desc" },
      select: { id: true, name: true },
      take: 200,
    }),
  ]);

  const withThumbs = await Promise.all(
    all.map(async (p) => ({
      ...p,
      thumbUrl: p.sourceKey ? await resolveMediaUrl(p.sourceKey).catch(() => null) : null,
    })),
  );

  const projects: ProjectRow[] = withThumbs.filter((p) => !p.isTemplate);
  const templates: ProjectRow[] = withThumbs.filter((p) => p.isTemplate);

  const folderRows: FolderRow[] = folders.map((f) => ({
    id: f.id,
    name: f.name,
    eventId: f.eventId,
    eventName: f.event?.name ?? null,
    projectCount: f._count.projects,
  }));

  return (
    <FoldersShell
      folders={folderRows}
      projects={projects}
      templates={templates}
      events={events}
    >
      <NewProjectPicker
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          width: t.width,
          height: t.height,
          thumbUrl: t.thumbUrl,
        }))}
      />
    </FoldersShell>
  );
}
