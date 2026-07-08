export function computeAcademicRetirementDateIso(birthDateIso: string): string | null {
  const trimmed = birthDateIso.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("-");
  if (parts.length < 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;

  const turn60Year = y + 60;
  const oct1Turn60Year = new Date(turn60Year, 9, 1);
  const birthday60 = new Date(turn60Year, m - 1, d);
  const retireYear = birthday60 >= oct1Turn60Year ? turn60Year + 1 : turn60Year;
  return `${retireYear}-09-30`;
}

export function computeAcademicRetirementDateIsoFromDb(birth: Date): string | null {
  const iso = birth.toISOString().slice(0, 10);
  return computeAcademicRetirementDateIso(iso);
}
