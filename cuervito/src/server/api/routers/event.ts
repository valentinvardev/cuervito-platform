import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const eventRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          location: z.string().optional(),
          take: z.number().min(1).max(50).default(12),
        })
        .optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.event.findMany({
        where: {
          isPublished: true,
          ...(input?.location ? { location: { contains: input.location, mode: "insensitive" } } : {}),
        },
        orderBy: { eventDate: "desc" },
        take: input?.take ?? 12,
      }),
    ),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.event.findUnique({
        where: { slug: input.slug },
        include: { owner: { select: { id: true, name: true, slug: true, image: true } } },
      }),
    ),
});
