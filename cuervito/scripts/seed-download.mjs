#!/usr/bin/env node
/**
 * Quick seeder: creates a fake PAID Sale with a downloadToken for an event,
 * so you can test /descarga/[token] without going through MP.
 *
 * Usage:
 *   node scripts/seed-download.mjs <eventId> [buyerEmail]
 *
 * Picks up to 6 committed photos from the event and bundles them.
 */

import { PrismaClient } from "../generated/prisma/index.js";
import { randomBytes } from "node:crypto";

const eventId = process.argv[2];
const buyerEmail = process.argv[3] ?? "comprador@cuervito.app";

if (!eventId) {
  console.error("Usage: node scripts/seed-download.mjs <eventId> [buyerEmail]");
  process.exit(1);
}

const db = new PrismaClient();

const event = await db.event.findUnique({
  where: { id: eventId },
  select: { id: true, ownerId: true, name: true, pricePerPhoto: true },
});
if (!event) {
  console.error("Event not found:", eventId);
  process.exit(1);
}

const photos = await db.photo.findMany({
  where: { eventId, fileSize: { not: null } },
  take: 6,
  select: { id: true },
});
if (photos.length === 0) {
  console.error("No committed photos in event", eventId);
  process.exit(1);
}

const priceCents = Math.round(Number(event.pricePerPhoto) * 100);
const subtotalCents = priceCents * photos.length;
const platformFeeCents = Math.round(subtotalCents * 0.1);
const sellerNetCents = subtotalCents - platformFeeCents;

const token = randomBytes(24).toString("hex");
const expires = new Date(Date.now() + 72 * 60 * 60 * 1000);

const sale = await db.sale.create({
  data: {
    sellerId: event.ownerId,
    eventId: event.id,
    buyerEmail,
    buyerName: "Comprador Test",
    subtotalCents,
    totalCents: subtotalCents,
    platformFeeCents,
    sellerNetCents,
    status: "PAID",
    paidAt: new Date(),
    downloadToken: token,
    downloadTokenExpires: expires,
    items: { create: photos.map((p) => ({ photoId: p.id, priceCents })) },
  },
});

console.log("Sale created:", sale.id);
console.log("Download URL:");
console.log(`  http://localhost:3000/descarga/${token}`);

await db.$disconnect();
