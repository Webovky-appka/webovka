import { describe, expect, it } from "vitest";

import { parseResearchHooks } from "./research-hooks";

describe("čtení háčků z JSON sloupce", () => {
  it("pustí jen kompletní háček se zdrojem a známou kategorií", () => {
    const hooks = parseResearchHooks({
      hooks: [
        {
          claim: "Recenze z června chválí degustační menu",
          kind: "OBSERVED",
          source: "google.com/maps",
          category: "recenze",
        },
        // Bez zdroje tvrzení neexistuje — stejné pravidlo jako u kontaktů.
        { claim: "Firma roste", kind: "OBSERVED", source: "", category: "nabor" },
        // Neznámá kategorie znamená nevalidovaný výstup modelu.
        { claim: "Něco", kind: "OBSERVED", source: "web", category: "novy-typ" },
        // Neznámý druh evidence by rozbil filtr použitelnosti.
        { claim: "Něco", kind: "JISTOTA", source: "web", category: "jine" },
        "rozbitý záznam",
      ],
    });

    expect(hooks).toHaveLength(1);
    expect(hooks[0].claim).toContain("degustační menu");
  });

  it("nezvaliduje nic z prázdna, špatného tvaru nebo pole", () => {
    expect(parseResearchHooks(null)).toEqual([]);
    expect(parseResearchHooks(undefined)).toEqual([]);
    expect(parseResearchHooks("text")).toEqual([]);
    expect(parseResearchHooks([])).toEqual([]);
    expect(parseResearchHooks({ hooks: "ne-pole" })).toEqual([]);
  });
});
