// Realistic sample COVID-19 dataset (aggregated monthly totals per country)
// Columns equivalent to: Date, Country, Confirmed, Deaths, Recovered

export type CovidRow = {
  date: string; // YYYY-MM-DD
  country: string;
  region: string;
  confirmed: number;
  deaths: number;
  recovered: number;
};

const COUNTRIES: { name: string; region: string; scale: number }[] = [
  { name: "United States", region: "Americas", scale: 1.0 },
  { name: "India", region: "Asia", scale: 0.85 },
  { name: "Brazil", region: "Americas", scale: 0.75 },
  { name: "France", region: "Europe", scale: 0.55 },
  { name: "Germany", region: "Europe", scale: 0.5 },
  { name: "United Kingdom", region: "Europe", scale: 0.48 },
  { name: "Italy", region: "Europe", scale: 0.42 },
  { name: "Russia", region: "Europe", scale: 0.6 },
  { name: "South Africa", region: "Africa", scale: 0.22 },
  { name: "Japan", region: "Asia", scale: 0.35 },
  { name: "Australia", region: "Oceania", scale: 0.18 },
  { name: "Canada", region: "Americas", scale: 0.28 },
];

// Deterministic pseudo-random for reproducible data
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generate(): CovidRow[] {
  const rows: CovidRow[] = [];
  // Monthly from 2020-01 to 2023-06
  const months: string[] = [];
  for (let y = 2020; y <= 2023; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === 2023 && m > 6) break;
      months.push(`${y}-${String(m).padStart(2, "0")}-01`);
    }
  }

  for (const c of COUNTRIES) {
    const rand = seeded(c.name.length * 137 + c.scale * 1000);
    let cumulative = 0;
    let deaths = 0;
    let recovered = 0;
    months.forEach((date, i) => {
      // Wave pattern peaking around months 10-12 (late 2020) and 22-26 (late 2021/early 2022)
      const wave =
        Math.exp(-Math.pow(i - 11, 2) / 30) * 1.8 +
        Math.exp(-Math.pow(i - 24, 2) / 25) * 2.2 +
        Math.exp(-Math.pow(i - 36, 2) / 40) * 0.9;
      const monthly = Math.round(
        (200000 + rand() * 400000) * c.scale * wave + 5000 * c.scale,
      );
      const monthlyDeaths = Math.round(monthly * (0.008 + rand() * 0.015));
      const monthlyRecovered = Math.round(monthly * (0.7 + rand() * 0.2));
      cumulative += monthly;
      deaths += monthlyDeaths;
      recovered += monthlyRecovered;
      rows.push({
        date,
        country: c.name,
        region: c.region,
        confirmed: cumulative,
        deaths,
        recovered,
      });
    });
  }
  return rows;
}

export const COVID_DATA: CovidRow[] = generate();

export const COUNTRY_LIST = Array.from(
  new Set(COVID_DATA.map((r) => r.country)),
).sort();
export const REGION_LIST = Array.from(
  new Set(COVID_DATA.map((r) => r.region)),
).sort();
export const DATE_LIST = Array.from(
  new Set(COVID_DATA.map((r) => r.date)),
).sort();

export function activeCases(row: CovidRow) {
  return Math.max(0, row.confirmed - row.deaths - row.recovered);
}
