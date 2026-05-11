import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const eventRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => ({ greeting: `Hello ${input.text}` })),

  list: publicProcedure
    .input(
      z
        .object({
          city: z.string().optional(),
          take: z.number().min(1).max(50).default(12),
        })
        .optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.event.findMany({
        where: input?.city ? { city: input.city } : undefined,
        orderBy: { startsAt: "desc" },
        take: input?.take ?? 12,
      }),
    ),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.event.findUnique({
        where: { slug: input.slug },
        include: { photographers: true },
      }),
    ),
});
