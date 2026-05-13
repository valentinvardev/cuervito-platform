import { redirect, notFound } from "next/navigation";

import { env } from "~/env";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getPresignedDownloadUrl } from "~/server/s3";

import {
  archiveEventAction,
  deleteEventAction,
  togglePublishedAction,
  updateEventAction,
} from "../actions";
import { EventDetailShell } from "./event-detail-shell";

export default async function EventDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/dashboard/events/${id}`);

  const event = await db.event.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      discipline: true,
      location: true,
      eventDate: true,
      status: true,
      pricePerPhoto: true,
      isPublished: true,
      ownerId: true,
      coverUrl: true,
      owner: { select: { slug: true } },
      _count: { select: { photos: true, sales: true } },
    },
  });
  if (!event || event.ownerId !== session.user.id) notFound();

  // Resolve cover (stored as S3 key) to a signed URL
  const coverSignedUrl = event.coverUrl
    ? event.coverUrl.startsWith("http")
      ? event.coverUrl
      : await getPresignedDownloadUrl(event.coverUrl, { expiresIn: 60 * 60 * 6 })
    : null;

  // Committed photos only — sign each preview URL briefly until preview pipeline lands
  const rawPhotos = await db.photo.findMany({
    where: { eventId: id, fileSize: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      filename: true,
      fileSize: true,
      bibNumbers: true,
      storageKey: true,
      previewKey: true,
    },
  });
  const photos = await Promise.all(
    rawPhotos.map(async (p) => ({
      id: p.id,
      filename: p.filename,
      fileSize: p.fileSize,
      bibNumbers: p.bibNumbers,
      previewUrl: await getPresignedDownloadUrl(p.previewKey ?? p.storageKey, {
        expiresIn: 60 * 30,
      }),
    })),
  );

  // Public URL — only meaningful when the event is published. For now we expose
  // it always so the share button works in the panel (page may 404 until Fase 4).
  const publicPath =
    event.owner.slug && event.slug ? `/${event.owner.slug}/${event.slug}` : null;

  async function doArchive() {
    "use server";
    await archiveEventAction(id);
  }
  async function doDelete() {
    "use server";
    await deleteEventAction(id);
  }
  async function doTogglePublished() {
    "use server";
    await togglePublishedAction(id);
  }

  return (
    <EventDetailShell
      event={{
        id: event.id,
        name: event.name,
        description: event.description,
        discipline: event.discipline,
        location: event.location,
        eventDate: event.eventDate ? event.eventDate.toISOString() : null,
        status: event.status,
        pricePerPhoto: Number(event.pricePerPhoto),
        coverUrl: coverSignedUrl,
        photosCount: event._count.photos,
        salesCount: event._count.sales,
        isPublished: event.isPublished,
      }}
      publicPath={publicPath}
      photos={photos}
      maxPhotoBytes={env.QUOTA_MAX_PHOTO_BYTES}
      updateAction={updateEventAction.bind(null, id)}
      archiveAction={doArchive}
      deleteAction={doDelete}
      togglePublishedAction={doTogglePublished}
    />
  );
}
