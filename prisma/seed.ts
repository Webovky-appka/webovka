import {
  PrismaClient,
  ClientStatus,
  MessageKind,
  AuthorType,
  UserRole,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";
import "dotenv/config";

import { DEFAULT_PHASES } from "../src/lib/phases";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** Kolik fází od začátku je u ukázkové zakázky hotových. */
type DemoProject = {
  name: string;
  completedPhases: number;
  portalNote?: string;
  previewUrl?: string;
};

async function seedTemplate() {
  // Předloha je globální, proto ji přepisujeme celou.
  await prisma.phaseTemplate.deleteMany();

  for (const [index, phase] of DEFAULT_PHASES.entries()) {
    await prisma.phaseTemplate.create({
      data: {
        name: phase.name,
        position: index,
        tasks: {
          create: phase.tasks.map((title, taskIndex) => ({
            title,
            position: taskIndex,
          })),
        },
      },
    });
  }
}

async function createDemoProject(clientId: string, demo: DemoProject) {
  const project = await prisma.project.create({
    data: {
      clientId,
      name: demo.name,
      portalNote: demo.portalNote,
      previewUrl: demo.previewUrl,
    },
    select: { id: true },
  });

  for (const [index, phase] of DEFAULT_PHASES.entries()) {
    const isCompleted = index < demo.completedPhases;

    await prisma.projectPhase.create({
      data: {
        projectId: project.id,
        name: phase.name,
        position: index,
        completedAt: isCompleted ? new Date() : null,
        tasks: {
          create: phase.tasks.map((title, taskIndex) => ({
            projectId: project.id,
            title,
            position: taskIndex,
            // Úkoly hotových fází jsou odškrtané, jinak by zakázka nedávala smysl.
            done: isCompleted,
          })),
        },
      },
    });
  }

  return project.id;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@web-appka.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";
  const devEmail = process.env.SEED_DEV_EMAIL ?? "vyvojar@web-appka.local";
  const devPassword = process.env.SEED_DEV_PASSWORD ?? "vyvojar1234";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Majitel studia",
      passwordHash: await argon2.hash(adminPassword),
      role: UserRole.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: devEmail },
    update: {},
    create: {
      email: devEmail,
      name: "Vývojář",
      passwordHash: await argon2.hash(devPassword),
      role: UserRole.DEVELOPER,
    },
  });

  await seedTemplate();

  const existingClients = await prisma.client.count();
  if (existingClients === 0) {
    const pekarna = await prisma.client.create({
      data: {
        companyName: "Pekárna U Nováků",
        contactPerson: "Jana Nováková",
        email: "jana@pekarnaunovaku.cz",
        phone: "+420 601 234 567",
        website: "https://pekarnaunovaku.cz",
        status: ClientStatus.ACTIVE,
        internalNote:
          "Platí spolehlivě, ale podklady dodává pozdě. Připomínat týden dopředu.",
      },
    });

    const pekarnaProject = await createDemoProject(pekarna.id, {
      name: "Nový web pekárny",
      completedPhases: 2,
      portalNote:
        "Připravili jsme grafický návrh homepage. Prosíme o schválení, nebo o připomínky, ať můžeme začít programovat.",
      previewUrl: "https://navrh.pekarnaunovaku.cz",
    });

    const truhlarstvi = await prisma.client.create({
      data: {
        companyName: "Truhlářství Dvořák",
        contactPerson: "Petr Dvořák",
        email: "info@truhlarstvidvorak.cz",
        phone: "+420 774 111 222",
        website: "https://truhlarstvidvorak.cz",
        status: ClientStatus.ACTIVE,
      },
    });

    const truhlarstviProject = await createDemoProject(truhlarstvi.id, {
      name: "Prezentační web a fotogalerie",
      completedPhases: 2,
      portalNote:
        "Programujeme fotogalerii. Do konce týdne pošleme odkaz na testovací verzi.",
    });

    await prisma.message.createMany({
      data: [
        {
          clientId: pekarna.id,
          projectId: pekarnaProject,
          authorType: AuthorType.USER,
          authorId: admin.id,
          kind: MessageKind.CALL,
          body: "Telefonát: prošli jsme rozsah webu. Klientka chce navíc sekci s denní nabídkou pečiva.",
        },
        {
          clientId: pekarna.id,
          projectId: pekarnaProject,
          authorType: AuthorType.USER,
          authorId: admin.id,
          kind: MessageKind.EMAIL,
          body: "Odeslán grafický návrh homepage ke schválení.",
        },
        {
          clientId: truhlarstvi.id,
          projectId: truhlarstviProject,
          authorType: AuthorType.USER,
          authorId: admin.id,
          kind: MessageKind.NOTE,
          body: "Dodal fotky výrobků, ale v nízkém rozlišení. Vyžádat originály.",
        },
      ],
    });
  }

  console.log("Seed hotový.");
  console.log(`  Admin:    ${adminEmail} / ${adminPassword}`);
  console.log(`  Vývojář:  ${devEmail} / ${devPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
