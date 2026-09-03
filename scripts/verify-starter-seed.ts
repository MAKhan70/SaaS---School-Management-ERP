import { PrismaClient } from "../src/generated/prisma/client";

const demoTrustId = "trust_saraswati_demo";

async function verifyStarterSeed() {
  const prisma = new PrismaClient();

  try {
    const platformAdminEmail =
      process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();

    if (!platformAdminEmail) {
      throw new Error(
        "PLATFORM_ADMIN_EMAIL is required for starter verification",
      );
    }

    const verification = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.platform_admin', 'true', true)`;
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${demoTrustId}, true)`;

      const platformAdmin = await transaction.user.findUnique({
        where: { email: platformAdminEmail },
        select: { id: true, passwordHash: true },
      });
      const schoolAdmin = await transaction.user.findUnique({
        where: { email: "school-admin@demo.nasaq.test" },
        select: { id: true, passwordHash: true },
      });
      const trustCount = await transaction.trust.count({
        where: { id: demoTrustId },
      });
      const schoolCount = await transaction.school.count({
        where: { trustId: demoTrustId },
      });
      const campusCount = await transaction.campus.count({
        where: { trustId: demoTrustId },
      });

      return {
        platformAdmin,
        schoolAdmin,
        trustCount,
        schoolCount,
        campusCount,
      };
    });

    if (
      !verification.platformAdmin?.passwordHash ||
      !verification.schoolAdmin?.passwordHash
    ) {
      throw new Error("Starter administrator credentials were not seeded");
    }

    if (
      verification.trustCount < 1 ||
      verification.schoolCount < 2 ||
      verification.campusCount < 4
    ) {
      throw new Error(
        `Starter organization hierarchy is incomplete: trusts=${verification.trustCount}, schools=${verification.schoolCount}, campuses=${verification.campusCount}`,
      );
    }

    console.log(
      "Starter seed verified: two logins and demo hierarchy are ready.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

void verifyStarterSeed();
