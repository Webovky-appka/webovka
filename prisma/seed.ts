import { PrismaClient, Phase, ClientStatus, MessageKind, AuthorType, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const TASK_TEMPLATE = [
  { phase: Phase.BRIEF, titles: ["Podepsat smlouvu", "Získat podklady od klienta", "Získat přístupy k doméně", "Sepsat zadání a odsouhlasit rozsah"] },
  { phase: Phase.DESIGN, titles: ["Navrhnout strukturu stránek", "Připravit grafický návrh homepage", "Odeslat návrh klientovi ke schválení"] },
  { phase: Phase.BUILD, titles: ["Nasadit vývojové prostředí", "Naprogramovat šablony", "Naplnit obsahem", "Nastavit responzivitu a rychlost"] },
  { phase: Phase.REVIEW, titles: ["Projít web s klientem", "Zapracovat připomínky", "Zkontrolovat texty a odkazy"] },
  { phase: Phase.LIVE, titles: ["Převést doménu na produkci", "Nastavit zálohy a monitoring", "Předat přístupy klientovi", "Vystavit koncovou fakturu"] },
];

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

  // Šablona úkolů je globální, proto ji přepisujeme celou.
  await prisma.taskTemplate.deleteMany();
  for (const group of TASK_TEMPLATE) {
    await prisma.taskTemplate.createMany({
      data: group.titles.map((title, position) => ({
        title,
        phase: group.phase,
        position,
      })),
    });
  }

  const existingClients = await prisma.client.count();
  if (existingClients === 0) {
    const pekarna = await prisma.client.create({
      data: {
        companyName: "Pekárna U Nováků",
        contactPerson: "Jana Nováková",
        email: "jana@pekarnaunovaku.cz",
        phone: "+420 601 234 567",
        status: ClientStatus.ACTIVE,
        internalNote: "Platí spolehlivě, ale podklady dodává pozdě. Připomínat týden dopředu.",
        projects: {
          create: {
            name: "Nový web pekárny",
            phase: Phase.DESIGN,
            portalNote:
              "Připravili jsme grafický návrh homepage. Prosíme o schválení, nebo o připomínky, ať můžeme začít programovat.",
            previewUrl: "https://navrh.pekarnaunovaku.cz",
          },
        },
      },
      include: { projects: true },
    });

    const truhlarstvi = await prisma.client.create({
      data: {
        companyName: "Truhlářství Dvořák",
        contactPerson: "Petr Dvořák",
        email: "info@truhlarstvidvorak.cz",
        phone: "+420 774 111 222",
        status: ClientStatus.ACTIVE,
        projects: {
          create: {
            name: "Prezentační web a fotogalerie",
            phase: Phase.BUILD,
            portalNote: "Programujeme fotogalerii. Do konce týdne pošleme odkaz na testovací verzi.",
          },
        },
      },
      include: { projects: true },
    });

    for (const project of [...pekarna.projects, ...truhlarstvi.projects]) {
      const templates = await prisma.taskTemplate.findMany({
        orderBy: [{ phase: "asc" }, { position: "asc" }],
      });

      await prisma.task.createMany({
        data: templates.map((template) => ({
          projectId: project.id,
          title: template.title,
          phase: template.phase,
          position: template.position,
          // Úkoly z již proběhlých fází označíme jako hotové.
          done: phaseRank(template.phase) < phaseRank(project.phase),
        })),
      });
    }

    await prisma.message.createMany({
      data: [
        {
          clientId: pekarna.id,
          projectId: pekarna.projects[0].id,
          authorType: AuthorType.USER,
          authorId: admin.id,
          kind: MessageKind.CALL,
          body: "Telefonát: prošli jsme rozsah webu. Klientka chce navíc sekci s denní nabídkou pečiva.",
        },
        {
          clientId: pekarna.id,
          projectId: pekarna.projects[0].id,
          authorType: AuthorType.USER,
          authorId: admin.id,
          kind: MessageKind.EMAIL,
          body: "Odeslán grafický návrh homepage ke schválení.",
        },
        {
          clientId: truhlarstvi.id,
          projectId: truhlarstvi.projects[0].id,
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

function phaseRank(phase: Phase): number {
  return [Phase.BRIEF, Phase.DESIGN, Phase.BUILD, Phase.REVIEW, Phase.LIVE].indexOf(phase);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
