import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

try {
  const platformAdminEmail =
    process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();

  if (!platformAdminEmail) {
    throw new Error(
      "PLATFORM_ADMIN_EMAIL is required for starter verification",
    );
  }

  const [platformAdmin, schoolAdmin, trustCount, schoolCount, campusCount] =
    await Promise.all([
      prisma.user.findUnique({
        where: { email: platformAdminEmail },
        select: { id: true, passwordHash: true },
      }),
      prisma.user.findUnique({
        where: { email: "school-admin@demo.nasaq.test" },
        select: { id: true, passwordHash: true },
      }),
      prisma.trust.count(),
      prisma.school.count(),
      prisma.campus.count(),
    ]);

  if (!platformAdmin?.passwordHash || !schoolAdmin?.passwordHash) {
    throw new Error("Starter administrator credentials were not seeded");
  }

  if (trustCount < 1 || schoolCount < 2 || campusCount < 4) {
    throw new Error("Starter organization hierarchy is incomplete");
  }

  console.log(
    "Starter seed verified: two logins and demo hierarchy are ready.",
  );
} finally {
  await prisma.$disconnect();
}
