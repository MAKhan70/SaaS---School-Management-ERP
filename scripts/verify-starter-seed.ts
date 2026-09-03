import { PrismaClient } from "../src/generated/prisma/client";
import { verifyPassword } from "../src/modules/identity/infrastructure/credential-crypto";

const demoTrustId = "trust_saraswati_demo";
const defaultPlatformAdminEmail = "platform-admin@demo.nasaq.test";

async function verifyStarterSeed() {
  const prisma = new PrismaClient();

  try {
    const platformAdminEmail =
      process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase() ??
      defaultPlatformAdminEmail;

    const verification = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.platform_admin', 'true', true)`;
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${demoTrustId}, true)`;

      const platformAdmin = await transaction.user.findUnique({
        where: { email: platformAdminEmail },
        select: {
          id: true,
          passwordHash: true,
          status: true,
          failedLoginAttempts: true,
          lockedUntil: true,
        },
      });
      const schoolAdmin = await transaction.user.findUnique({
        where: { email: "school-admin@demo.nasaq.test" },
        select: {
          id: true,
          passwordHash: true,
          status: true,
          failedLoginAttempts: true,
          lockedUntil: true,
        },
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
      const signInRateLimitCount = await transaction.authRateLimit.count({
        where: { action: "SIGN_IN" },
      });

      return {
        platformAdmin,
        schoolAdmin,
        trustCount,
        schoolCount,
        campusCount,
        signInRateLimitCount,
      };
    });

    if (
      !verification.platformAdmin?.passwordHash ||
      !verification.schoolAdmin?.passwordHash
    ) {
      throw new Error("Starter administrator credentials were not seeded");
    }

    if (
      verification.platformAdmin.status !== "ACTIVE" ||
      verification.schoolAdmin.status !== "ACTIVE" ||
      verification.platformAdmin.failedLoginAttempts !== 0 ||
      verification.schoolAdmin.failedLoginAttempts !== 0 ||
      verification.platformAdmin.lockedUntil ||
      verification.schoolAdmin.lockedUntil
    ) {
      throw new Error("Starter administrator accounts are not available");
    }

    const platformPassword = process.env.PLATFORM_ADMIN_PASSWORD;
    const schoolPassword = process.env.DEMO_USER_PASSWORD;
    if (
      (platformPassword &&
        !(await verifyPassword(
          platformPassword,
          verification.platformAdmin.passwordHash,
        ))) ||
      (schoolPassword &&
        !(await verifyPassword(
          schoolPassword,
          verification.schoolAdmin.passwordHash,
        )))
    ) {
      throw new Error("Starter administrator password verification failed");
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

    if (
      process.env.RESET_STARTER_SECURITY_STATE === "true" &&
      verification.signInRateLimitCount !== 0
    ) {
      throw new Error("Starter sign-in throttles were not reset");
    }

    console.log(
      "Starter seed verified: two logins and demo hierarchy are ready.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

void verifyStarterSeed();
