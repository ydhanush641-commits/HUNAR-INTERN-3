import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Activity,
  Skull,
  HeartPulse,
  Flame,
  Download,
  Globe2,
  TrendingUp,
  Search,
} from "lucide-react";
import {
  COVID_DATA,
  COUNTRY_LIST,
  REGION_LIST,
  DATE_LIST,
  activeCases,
  type CovidRow,
} from "@/lib/covid-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pandemic Command Center — COVID-19 Global Intelligence" },
      {
        name: "description",
        content:
          "An interactive COVID-19 intelligence dashboard with global metrics, country comparisons, growth rates, and time-series analytics.",
      },
      { property: "og:title", content: "Pandemic Command Center" },
      {
        property: "og:description",
        content: "Interactive COVID-19 global intelligence dashboard.",
      },
    ],
  }),
  component: Dashboard,
});

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function fmt(n: number) {
  if (n >= 1_000_000_000) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1e3).toFixed(1) + "K";
  return Math.round(n).toString();
}
function pct(n: number) {
  return (n * 100).toFixed(2) + "%";
}
function fmtPct(n: number) {
  const v = n * 100;
  if (Math.abs(v) >= 1000) return fmt(v) + "%";
  return v.toFixed(1) + "%";
}


function Dashboard() {
  const [region, setRegion] = useState<string>("All");
  const [country, setCountry] = useState<string>("All");
  const [startDate, setStartDate] = useState<string>(DATE_LIST[0]);
  const [endDate, setEndDate] = useState<string>(DATE_LIST[DATE_LIST.length - 1]);
  const [compare, setCompare] = useState<string[]>(["United States", "India", "Brazil"]);
  const [search, setSearch] = useState("");

  const filtered = useMemo<CovidRow[]>(
    () =>
      COVID_DATA.filter((r) => {
        if (region !== "All" && r.region !== region) return false;
        if (country !== "All" && r.country !== country) return false;
        if (r.date < startDate || r.date > endDate) return false;
        return true;
      }),
    [region, country, startDate, endDate],
  );

  const latestPerCountry = useMemo(() => {
    const map = new Map<string, CovidRow>();
    for (const r of filtered) {
      const ex = map.get(r.country);
      if (!ex || r.date > ex.date) map.set(r.country, r);
    }
    return Array.from(map.values());
  }, [filtered]);

  const firstPerCountry = useMemo(() => {
    const map = new Map<string, CovidRow>();
    for (const r of filtered) {
      const ex = map.get(r.country);
      if (!ex || r.date < ex.date) map.set(r.country, r);
    }
    return map;
  }, [filtered]);

  const kpis = useMemo(() => {
    const confirmed = latestPerCountry.reduce((s, r) => s + r.confirmed, 0);
    const deaths = latestPerCountry.reduce((s, r) => s + r.deaths, 0);
    const recovered = latestPerCountry.reduce((s, r) => s + r.recovered, 0);
    const active = latestPerCountry.reduce((s, r) => s + activeCases(r), 0);
    const startConfirmed = Array.from(firstPerCountry.values()).reduce(
      (s, r) => s + r.confirmed,
      0,
    );
    const growth = startConfirmed > 0 ? (confirmed - startConfirmed) / startConfirmed : 0;
    return {
      confirmed,
      deaths,
      recovered,
      active,
      mortality: confirmed > 0 ? deaths / confirmed : 0,
      recovery: confirmed > 0 ? recovered / confirmed : 0,
      growth,
    };
  }, [latestPerCountry, firstPerCountry]);

  const trend = useMemo(() => {
    const byDate = new Map<
      string,
      { confirmed: number; deaths: number; recovered: number; active: number }
    >();
    for (const r of filtered) {
      const c = byDate.get(r.date) ?? { confirmed: 0, deaths: 0, recovered: 0, active: 0 };
      c.confirmed += r.confirmed;
      c.deaths += r.deaths;
      c.recovered += r.recovered;
      c.active += activeCases(r);
      byDate.set(r.date, c);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date: date.slice(0, 7), ...v }));
  }, [filtered]);

  const topCountries = useMemo(
    () =>
      [...latestPerCountry]
        .sort((a, b) => b.confirmed - a.confirmed)
        .slice(0, 10)
        .map((r) => ({ country: r.country, confirmed: r.confirmed, deaths: r.deaths })),
    [latestPerCountry],
  );

  const regionDist = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of latestPerCountry) {
      map.set(r.region, (map.get(r.region) ?? 0) + r.confirmed);
    }
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0) || 1;
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        share: value / total,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }));
  }, [latestPerCountry]);

  const comparison = useMemo(() => {
    const dates = Array.from(new Set(COVID_DATA.map((r) => r.date))).sort();
    return dates
      .filter((d) => d >= startDate && d <= endDate)
      .map((d) => {
        const row: Record<string, string | number> = { date: d.slice(0, 7) };
        for (const c of compare) {
          const match = COVID_DATA.find((r) => r.date === d && r.country === c);
          row[c] = match?.confirmed ?? 0;
        }
        return row;
      });
  }, [compare, startDate, endDate]);

  const availableCountries = useMemo(() => {
    const base =
      region === "All"
        ? COUNTRY_LIST
        : COUNTRY_LIST.filter(
            (c) => COVID_DATA.find((r) => r.country === c)?.region === region,
          );
    if (!search) return base;
    return base.filter((c) => c.toLowerCase().includes(search.toLowerCase()));
  }, [region, search]);

  const tableRows = useMemo(
    () =>
      [...latestPerCountry]
        .sort((a, b) => b.confirmed - a.confirmed)
        .filter((r) => !search || r.country.toLowerCase().includes(search.toLowerCase())),
    [latestPerCountry, search],
  );

  function exportCSV() {
    const headers = ["date", "country", "region", "confirmed", "deaths", "recovered", "active"];
    const rows = filtered.map((r) =>
      [r.date, r.country, r.region, r.confirmed, r.deaths, r.recovered, activeCases(r)].join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `covid-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleCompare(c: string) {
    setCompare((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : prev.length >= 5 ? prev : [...prev, c],
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Ambient glow background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 grid-bg" />
      <div
        aria-hidden
        className="glow-orb float"
        style={{ top: -120, left: -120, width: 500, height: 500, background: "var(--gradient-cyan)" }}
      />
      <div
        aria-hidden
        className="glow-orb float"
        style={{ top: 200, right: -150, width: 460, height: 460, background: "var(--gradient-magenta)", animationDelay: "-2s" }}
      />
      <div
        aria-hidden
        className="glow-orb float"
        style={{ top: 900, left: "30%", width: 400, height: 400, background: "var(--gradient-amber)", animationDelay: "-4s", opacity: 0.3 }}
      />

      <div className="relative z-10">
        {/* Hero */}
        <header className="border-b border-border/50">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="fade-up flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span className="relative flex h-2 w-2 items-center justify-center">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 pulse-ring text-primary" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Live Intelligence Feed · 2020–2023
            </div>
            <h1 className="fade-up mt-4 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
              Pandemic <span className="text-gradient">Command Center</span>
            </h1>
            <p className="fade-up mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              A visual intelligence layer over global COVID-19 telemetry. Compare countries, track waves,
              and surface mortality, recovery, and growth signals in real time.
            </p>
            <div className="fade-up mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={exportCSV}
                className="group inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground hover:shadow-[var(--shadow-glow-cyan)]"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-xs font-mono text-muted-foreground">
                <Globe2 className="h-3.5 w-3.5" />
                {COUNTRY_LIST.length} countries · {DATE_LIST.length} months
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          {/* Filters */}
          <section
            aria-label="Filters"
            className="glass fade-up rounded-2xl p-4 sm:p-5"
          >
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              Filters
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Region">
                <select
                  value={region}
                  onChange={(e) => {
                    setRegion(e.target.value);
                    setCountry("All");
                  }}
                  className={selectCls}
                >
                  <option value="All">All regions</option>
                  {REGION_LIST.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="Country">
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={selectCls}
                >
                  <option value="All">All countries</option>
                  {availableCountries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="From">
                <select value={startDate} onChange={(e) => setStartDate(e.target.value)} className={selectCls}>
                  {DATE_LIST.map((d) => <option key={d} value={d}>{d.slice(0, 7)}</option>)}
                </select>
              </Field>
              <Field label="To">
                <select value={endDate} onChange={(e) => setEndDate(e.target.value)} className={selectCls}>
                  {DATE_LIST.map((d) => <option key={d} value={d}>{d.slice(0, 7)}</option>)}
                </select>
              </Field>
              <Field label="Search">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Find country…"
                    className={selectCls + " pl-9"}
                  />
                </div>
              </Field>
            </div>
          </section>

          {/* KPIs */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KpiCard icon={<Activity className="h-4 w-4" />} label="Confirmed" value={fmt(kpis.confirmed)} sub={kpis.confirmed.toLocaleString()} gradient="var(--gradient-cyan)" />
            <KpiCard icon={<Flame className="h-4 w-4" />} label="Active" value={fmt(kpis.active)} sub={kpis.active.toLocaleString()} gradient="var(--gradient-amber)" />
            <KpiCard icon={<HeartPulse className="h-4 w-4" />} label="Recovered" value={fmt(kpis.recovered)} sub={pct(kpis.recovery) + " rate"} gradient="linear-gradient(135deg, oklch(0.78 0.2 145), oklch(0.6 0.2 160))" />
            <KpiCard icon={<Skull className="h-4 w-4" />} label="Deaths" value={fmt(kpis.deaths)} sub={pct(kpis.mortality) + " CFR"} gradient="var(--gradient-coral)" />
            <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Growth" value={fmtPct(kpis.growth)} sub="vs. window start" gradient="var(--gradient-magenta)" />
            <KpiCard icon={<Globe2 className="h-4 w-4" />} label="Countries" value={latestPerCountry.length.toString()} sub="in view" gradient="linear-gradient(135deg, oklch(0.7 0.15 250), oklch(0.5 0.18 280))" />
          </section>

          {/* Trend area + Radial */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="glass glass-hover rounded-2xl p-5 lg:col-span-2">
              <SectionTitle title="Pandemic timeline" subtitle="Cumulative case dynamics across the selected window" />
              <div className="h-80 w-full">
                <ResponsiveContainer>
                  <AreaChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gConfirmed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.7} />
                        <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gRecovered" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickFormatter={fmt} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="confirmed" stroke="var(--color-chart-1)" fill="url(#gConfirmed)" strokeWidth={2} />
                    <Area type="monotone" dataKey="recovered" stroke="var(--color-chart-2)" fill="url(#gRecovered)" strokeWidth={2} />
                    <Area type="monotone" dataKey="active" stroke="var(--color-chart-3)" fill="url(#gActive)" strokeWidth={2} />
                    <Area type="monotone" dataKey="deaths" stroke="var(--color-chart-5)" fill="transparent" strokeWidth={2} strokeDasharray="4 3" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass glass-hover rounded-2xl p-5">
              <SectionTitle title="Outcome rates" subtitle="Share of confirmed by outcome" />
              <div className="space-y-5 pt-2">
                {[
                  { name: "Recovered", value: kpis.recovery, color: "oklch(0.75 0.2 145)", gradient: "linear-gradient(90deg, oklch(0.78 0.2 145), oklch(0.6 0.2 160))" },
                  { name: "Active", value: kpis.active / Math.max(kpis.confirmed, 1), color: "oklch(0.78 0.2 60)", gradient: "var(--gradient-amber)" },
                  { name: "Mortality (CFR)", value: kpis.mortality, color: "oklch(0.7 0.22 25)", gradient: "var(--gradient-coral)" },
                ].map((r) => (
                  <div key={r.name}>
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="text-sm font-medium" style={{ color: r.color }}>{r.name}</span>
                      <span className="font-display text-2xl font-bold tabular-nums">
                        {(r.value * 100).toFixed(2)}<span className="text-sm text-muted-foreground">%</span>
                      </span>
                    </div>
                    <div className="relative h-2.5 overflow-hidden rounded-full bg-muted/60">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(r.value * 100, 100)}%`, background: r.gradient, boxShadow: `0 0 16px -2px ${r.color}` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="mt-4 rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
                  <span className="font-mono text-foreground">CFR</span> = Case Fatality Ratio — deaths ÷ confirmed cases in the selected window.
                </div>
              </div>
            </div>
          </section>

          {/* Comparison */}
          <section className="glass glass-hover fade-up rounded-2xl p-5">
            <SectionTitle
              title="Country comparison"
              subtitle="Pick up to 5 countries to overlay confirmed-case trajectories"
            />
            <div className="mb-4 flex flex-wrap gap-2">
              {COUNTRY_LIST.map((c) => {
                const active = compare.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleCompare(c)}
                    className={
                      "rounded-full border px-3 py-1 text-xs font-medium transition " +
                      (active
                        ? "border-primary bg-primary/15 text-primary shadow-[0_0_20px_-5px_var(--primary-glow)]"
                        : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground")
                    }
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer>
                <LineChart data={comparison} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickFormatter={fmt} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {compare.map((c, i) => (
                    <Line
                      key={c}
                      type="monotone"
                      dataKey={c}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2.2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Top + Region */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="glass glass-hover rounded-2xl p-5 lg:col-span-3">
              <SectionTitle title="Top countries" subtitle="Ranked by confirmed cases at end of window" />
              <div className="h-80 w-full">
                <ResponsiveContainer>
                  <BarChart data={topCountries} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <defs>
                      <linearGradient id="barC" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="var(--color-chart-1)" />
                        <stop offset="100%" stopColor="var(--color-chart-4)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickFormatter={fmt} />
                    <YAxis dataKey="country" type="category" tick={{ fontSize: 11, fill: "var(--color-foreground)" }} width={120} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="confirmed" fill="url(#barC)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass glass-hover rounded-2xl p-5 lg:col-span-2">
              <SectionTitle title="Regional share" subtitle="Distribution of cases by region" />
              <ul className="space-y-3">
                {regionDist.map((r) => (
                  <li key={r.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{r.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {fmt(r.value)} · {(r.share * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${r.share * 100}%`, background: r.fill }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Table */}
          <section className="glass rounded-2xl p-5">
            <SectionTitle title="Country breakdown" subtitle="Latest snapshot in current window" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 pr-3 font-semibold">#</th>
                    <th className="py-3 pr-3 font-semibold">Country</th>
                    <th className="py-3 pr-3 font-semibold">Region</th>
                    <th className="py-3 pr-3 text-right font-semibold">Confirmed</th>
                    <th className="py-3 pr-3 text-right font-semibold">Active</th>
                    <th className="py-3 pr-3 text-right font-semibold">Recovered</th>
                    <th className="py-3 pr-3 text-right font-semibold">Deaths</th>
                    <th className="py-3 pr-3 text-right font-semibold">CFR</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r, i) => (
                    <tr key={r.country} className="border-b border-border/40 transition hover:bg-primary/5">
                      <td className="py-3 pr-3 font-mono text-xs text-muted-foreground">{i + 1}</td>
                      <td className="py-3 pr-3 font-medium">{r.country}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{r.region}</td>
                      <td className="py-3 pr-3 text-right font-mono tabular-nums">{r.confirmed.toLocaleString()}</td>
                      <td className="py-3 pr-3 text-right font-mono tabular-nums text-[oklch(0.78_0.2_60)]">{activeCases(r).toLocaleString()}</td>
                      <td className="py-3 pr-3 text-right font-mono tabular-nums text-[oklch(0.75_0.2_145)]">{r.recovered.toLocaleString()}</td>
                      <td className="py-3 pr-3 text-right font-mono tabular-nums text-[oklch(0.7_0.22_25)]">{r.deaths.toLocaleString()}</td>
                      <td className="py-3 pr-3 text-right font-mono tabular-nums text-muted-foreground">
                        {((r.deaths / Math.max(r.confirmed, 1)) * 100).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                  {tableRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        No countries match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="pb-10 pt-4 text-center text-xs text-muted-foreground">
            Synthetic dataset · Built for visualization &amp; analytics demonstration · Not real epidemiological data.
          </footer>
        </main>
      </div>
    </div>
  );
}

const selectCls =
  "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

const tooltipStyle: React.CSSProperties = {
  background: "oklch(0.18 0.045 265 / 0.95)",
  border: "1px solid oklch(1 0 0 / 0.1)",
  borderRadius: 12,
  fontSize: 12,
  color: "oklch(0.97 0.01 250)",
  boxShadow: "0 10px 40px -10px oklch(0 0 0 / 0.5)",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  gradient,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  gradient: string;
}) {
  return (
    <div className="glass glass-hover relative overflow-hidden rounded-2xl p-4">
      <div
        aria-hidden
        className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-30 blur-2xl"
        style={{ background: gradient }}
      />
      <div className="relative flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span
          className="grid h-6 w-6 place-items-center rounded-md text-primary-foreground"
          style={{ background: gradient }}
        >
          {icon}
        </span>
        {label}
      </div>
      <div className="relative mt-2 font-display text-2xl font-bold tabular-nums sm:text-3xl">
        {value}
      </div>
      <div className="relative mt-0.5 font-mono text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}
