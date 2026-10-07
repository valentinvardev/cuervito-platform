import { llmsTxt } from "~/server/llms";

// Se arma en el build: lo que dice sale del código y del blog, que sólo
// cambian con un deploy.
export const dynamic = "force-static";

export async function GET() {
  return new Response(await llmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
