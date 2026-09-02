import { PrismaClient, RecordStatus } from "@/generated/prisma";
import { SchoolRepository } from "@/modules/institutions/infrastructure/school-repository";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const repository = new SchoolRepository(prisma);

const platformId = "platform_tenant_isolation_test";
const trustA = "trust_isolation_a";
const trustB = "trust_isolation_b";
const schoolA = "school_isolation_a";
const schoolB = "school_isolation_b";

async function schoolsVisibleThroughRls(trustId: string) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe("SET LOCAL ROLE nasaq_app");
    await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${trustId}, true)`;
    return transaction.school.findMany({ orderBy: { id: "asc" } });
  });
}

describe("tenant isolation", () => {
  beforeAll(async () => {
    await prisma.platform.upsert({
      where: { key: "tenant-isolation-test" },
      update: { name: "Tenant Isolation Test Platform" },
      create: {
        id: platformId,
        key: "tenant-isolation-test",
        name: "Tenant Isolation Test Platform",
      },
    });

    for (const [trustId, slug, name] of [
      [trustA, "tenant-isolation-a", "Isolation Trust A"],
      [trustB, "tenant-isolation-b", "Isolation Trust B"],
    ] as const) {
      await prisma.trust.upsert({
        where: { slug },
        update: { name, status: RecordStatus.ACTIVE },
        create: { id: trustId, platformId, slug, name },
      });
    }

    await prisma.school.upsert({
      where: { trustId_code: { trustId: trustA, code: "A" } },
      update: { name: "School A" },
      create: { id: schoolA, trustId: trustA, code: "A", name: "School A" },
    });
    await prisma.school.upsert({
      where: { trustId_code: { trustId: trustB, code: "B" } },
      update: { name: "School B" },
      create: { id: schoolB, trustId: trustB, code: "B", name: "School B" },
    });
  });

  afterAll(async () => prisma.$disconnect());

  it("scopes repository reads to the verified trust context", async () => {
    const schools = await repository.list({
      trustId: trustA,
      correlationId: "integration-repository-isolation",
    });

    expect(schools.map((school) => school.id)).toContain(schoolA);
    expect(schools.map((school) => school.id)).not.toContain(schoolB);
    await expect(
      repository.findById(
        {
          trustId: trustA,
          correlationId: "integration-repository-cross-tenant",
        },
        schoolB,
      ),
    ).resolves.toBeNull();
  });

  it("enforces row-level security even without an application where clause", async () => {
    const schools = await schoolsVisibleThroughRls(trustA);

    expect(schools.map((school) => school.id)).toContain(schoolA);
    expect(schools.map((school) => school.id)).not.toContain(schoolB);
  });
});
