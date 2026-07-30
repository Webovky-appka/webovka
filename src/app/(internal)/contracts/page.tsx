import Link from "next/link";

import { ContractBuilder } from "@/components/contracts/contract-builder";
import { aiModel, isAiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { MISSING, supplierFromEnv } from "@/lib/contract-template";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Smlouvy — Stavba webu",
};

export default async function ContractsPage(props: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireUser();
  const { project: projectParam } = await props.searchParams;

  const projects = await prisma.project.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      client: { select: { companyName: true } },
      _count: { select: { phases: true } },
    },
  });

  const selectedId =
    projects.find((item) => item.id === projectParam)?.id ??
    projects[0]?.id ??
    "";

  const contract = selectedId
    ? await prisma.contract.findUnique({
        where: { projectId: selectedId },
        select: { body: true },
      })
    : null;

  const supplier = supplierFromEnv(user.name);
  const missingSupplier = [
    supplier.ico === MISSING ? "IČO" : null,
    supplier.address === MISSING ? "sídlo" : null,
    supplier.bankAccount === MISSING ? "bankovní spojení" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Smlouvy
        </h1>
        <p className="text-sm text-slate-500">
          Smlouva o dílo k zakázce s platbami po milnících.
        </p>
      </div>

      {/* Tohle musí být vidět nad textem, ne někde v dokumentaci. */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-medium text-amber-900">
          Šablonu nechte před prvním použitím projít právníkem.
        </p>
        <p className="mt-1 text-sm text-amber-800">
          Text je sestavený podle běžné praxe, ale není to právní služba. U
          vymáhání peněz a autorských práv rozhoduje formulace.
        </p>
      </div>

      {missingSupplier.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-sm text-slate-700">
            Ve smlouvě budou u vás jako zhotovitele chybět{" "}
            <strong>{missingSupplier.join(", ")}</strong>. Doplňte je do
            proměnných <span className="font-mono">STUDIO_ICO</span>,{" "}
            <span className="font-mono">STUDIO_ADDRESS</span> a{" "}
            <span className="font-mono">STUDIO_BANK_ACCOUNT</span>, nebo je
            napište do textu ručně — v šabloně jsou označené jako{" "}
            <span className="font-mono">{MISSING}</span>.
          </p>
        </div>
      ) : null}

      {projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          Není žádná aktivní zakázka.{" "}
          <Link href="/clients/new" className="text-sky-700 underline">
            Založte klienta a zakázku
          </Link>
          , pak se sem vraťte.
        </p>
      ) : (
        <ContractBuilder
          projects={projects.map((item) => ({
            id: item.id,
            label: `${item.client.companyName} — ${item.name}`,
            phaseCount: item._count.phases,
          }))}
          selectedId={selectedId}
          savedBody={contract?.body ?? null}
          hasSaved={contract !== null}
          aiReady={isAiConfigured()}
          aiModel={aiModel()}
        />
      )}
    </div>
  );
}
