"use client";

export function formatThaiBuddhistDate(
  value: Date | string | number | null | undefined
): string {
  if (value == null || value === "") return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  // Force Buddhist calendar and numeric day/month/year.
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

