import Link from "next/link";

import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
  const hello = await api.event.hello({ text: "cuervito" });
  const session = await auth();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0F0D0B] text-[#F0EBE3]">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            cuervito<span className="text-[#F5820A]">.</span>app
          </h1>
          <p className="max-w-xl text-center text-lg text-[#A89880]">
            Sports & event photography marketplace. Find your photos by bib
            number or selfie. T3 stack scaffold ready.
          </p>

          <p className="font-mono text-sm text-[#F5820A]">{hello.greeting}</p>

          <Link
            href={session ? "/api/auth/signout" : "/api/auth/signin"}
            className="rounded-md bg-[#F5820A] px-6 py-3 font-medium text-[#0F0D0B] transition hover:bg-[#FF9A2E]"
          >
            {session ? `Sign out (${session.user?.name ?? "user"})` : "Sign in"}
          </Link>
        </div>
      </main>
    </HydrateClient>
  );
}
