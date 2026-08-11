import { describe, expect, it } from "vitest";

import {
  gradeFor,
  HUMAN_GRADES,
  pickCalibrationExamples,
} from "./human-grades";

describe("známky majitele studia", () => {
  it("je jich sedm, seřazených a s popiskem", () => {
    expect(HUMAN_GRADES).toHaveLength(7);
    for (const [index, grade] of HUMAN_GRADES.entries()) {
      expect(grade.label.length).toBeGreaterThan(3);
      expect(grade.hint.length).toBeGreaterThan(5);
      if (index > 0) {
        expect(grade.score).toBeGreaterThan(HUMAN_GRADES[index - 1].score);
      }
    }
  });

  /** Krajní stupně musí být blízko okrajů, jinak se laťka nikam neposune. */
  it("sahá k oběma koncům škály", () => {
    expect(HUMAN_GRADES[0].score).toBeLessThanOrEqual(15);
    expect(HUMAN_GRADES[HUMAN_GRADES.length - 1].score).toBeGreaterThanOrEqual(
      90,
    );
  });

  it("známku dohledá i k číslu mezi stupni", () => {
    expect(gradeFor(10).label).toBe("Katastrofa");
    expect(gradeFor(57).label).toBe("Průměrný");
    expect(gradeFor(100).label).toBe("Špičkový");
    // Starší hodnocení ze čtyřstupňové škály musí pořád najít nejbližší stupeň.
    expect(gradeFor(75).score).toBe(70);
  });
});

describe("výběr kalibračních vzorů", () => {
  const rated = [55, 10, 95, 40, 70, 25, 85].map((humanWebScore, index) => ({
    id: `lead-${index}`,
    humanWebScore,
  }));

  it("vezme oba konce škály, ne jen střed", () => {
    const picked = pickCalibrationExamples(rated, 4);

    expect(picked).toHaveLength(4);
    expect(picked[0].humanWebScore).toBe(10);
    expect(picked[picked.length - 1].humanWebScore).toBe(95);
    // Mezi krajními hodnotami musí být i něco ze středu.
    expect(picked.some((item) => item.humanWebScore === 40)).toBe(true);
  });

  it("řadí od nejhoršího k nejlepšímu", () => {
    const scores = pickCalibrationExamples(rated, 4).map(
      (item) => item.humanWebScore,
    );
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });

  it("málo vzorů vrátí všechny, žádné nevymýšlí", () => {
    expect(pickCalibrationExamples(rated.slice(0, 2), 4)).toHaveLength(2);
    expect(pickCalibrationExamples([], 4)).toEqual([]);
    expect(pickCalibrationExamples(rated, 0)).toEqual([]);
  });

  it("nikdy nevrátí stejný vzor dvakrát", () => {
    const picked = pickCalibrationExamples(rated, 6);
    expect(new Set(picked.map((item) => item.id)).size).toBe(picked.length);
  });
});
