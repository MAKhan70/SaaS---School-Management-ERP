import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();
const demoTrustId = "trust_saraswati_demo";

try {
  const platformAdminEmail =
    process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();

  if (!platformAdminEmail) {
    throw new Error(
      "PLATFORM_ADMIN_EMAIL is required for starter verification",
    );
  }

  const [platformAdmin, schoolAdmin] = await Promise.all([
    prisma.user.findUnique({
      where: { email: platformAdminEmail },
      select: { id: true, passwordHash: true },
    }),
    prisma.user.findUnique({
      where: { email: "school-admin@demo.nasaq.test" },
      select: { id: true, passwordHash: true },
    }),
  ]);

  if (!platformAdmin?.passwordHash || !schoolAdmin?.passwordHash) {
    throw new Error("Starter administrator credentials were not seeded");
  }

  const [trustCount, schoolCount, campusCount] = await prisma.$transaction(
    async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${demoTrustId}, true)`;
      return Promise.all([
        transaction.trust.count({ where: { id: demoTrustId } }),
        transaction.school.count({ where: { trustId: demoTrustId } }),
        transaction.campus.count({ where: { trustId: demoTrustId } }),
      ]);
    },
  );

  if (trustCount < 1 || schoolCount < 2 || campusCount < 4) {
    throw new Error("Starter organization hierarchy is incomplete");
  }

  console.log(
    "Starter seed verified: two logins and demo hierarchy are ready.",
  );
} finally {
  await prisma.$disconnect();
}
