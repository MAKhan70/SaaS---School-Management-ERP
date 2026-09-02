import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PlatformClientAdmin } from "@/components/platform-client-admin";
import { PlatformAdminService } from "@/modules/platform-admin/application/platform-admin-service";
import { requireSession } from "@/server/auth/session";
import { prisma } from "@/server/database/prisma";

export const metadata: Metadata = { title: "Client administration" };

export default async function PlatformClientsPage() {
  const context = await requireSession("/platform/clients");
  try {
    const clients = await new PlatformAdminService(prisma).listClients(context);
    return (
      <main className="page-content">
        <PlatformClientAdmin clients={clients} />
      </main>
    );
  } catch {
    redirect("/access-denied");
  }
}
