import { auth, signOut } from "~/server/auth";
import { resolveAvatarUrl } from "~/server/avatar";
import { db } from "~/server/db";

import { AdminTopClient } from "./admin-top-client";
import { AdminDrawer } from "./admin-drawer";
import { SaleToast } from "./sale-toast";

export async function AdminTop() {
  const session = await auth();
  const userName = session?.user?.name ?? "Cuervito";
  const userEmail = session?.user?.email ?? "";
  const initials =
    userName
      .split(" ")
      .map((p) => p[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "C";

  let avatarUrl: string | null = null;
  if (session?.user?.id) {
    const u = await db.user.findUnique({
      where: { id: session.user.id },
      select: { image: true },
    });
    avatarUrl = await resolveAvatarUrl(u?.image);
  }

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <>
      <AdminTopClient
        initials={initials}
        userName={userName}
        userEmail={userEmail}
        avatarUrl={avatarUrl}
        signOutAction={doSignOut}
        showAdminLink={session?.user?.role === "ADMIN"}
      />
      <AdminDrawer />
      <SaleToast />
    </>
  );
}
