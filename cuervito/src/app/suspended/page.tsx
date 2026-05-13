import { signOut } from "~/server/auth";

export default function SuspendedPage() {
  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0F0D0B] px-6 text-[#F0EBE3]">
      <div className="max-w-md text-center">
        <h1 className="mb-3 text-3xl font-extrabold tracking-tight">Cuenta suspendida</h1>
        <p className="mb-6 text-[#A89880]">
          Tu cuenta fue suspendida. Si pensás que es un error, escribinos a{" "}
          <a href="mailto:hola@cuervito.app" className="text-[#F5820A] hover:underline">
            hola@cuervito.app
          </a>
          .
        </p>
        <form action={doSignOut}>
          <button className="rounded-md border border-[#3A2F22] px-5 py-2.5 text-sm transition hover:bg-[#1A1410]">
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
