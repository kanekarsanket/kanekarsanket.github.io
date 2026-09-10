/* ============================================================
   data.js — live economic data for the browser
   ------------------------------------------------------------
   WHY NOT FRED DIRECTLY?
   The FRED API (api.stlouisfed.org) does not send CORS headers,
   so a page served from GitHub Pages cannot call it from
   JavaScript — the request is blocked by the browser before it
   ever reaches St. Louis. It also requires an API key, which
   would have to be pasted into this file in plain sight.

   So the charts pull the SAME underlying official series from
   two sources that do allow browser requests and need no key:

     * DBnomics (api.db.nomics.world) mirrors the Federal
       Reserve's H.6 (money stock) and H.15 (selected interest
       rates) releases and BEA's national accounts.
     * The BLS public API (api.bls.gov) supplies the most recent
       three years of the Consumer Price Index.
     * The U.S. Treasury's Fiscal Data service supplies federal
       debt held by the public.

   Every chart still links to the matching FRED page so a reader
   can download the series themselves.
   ============================================================ */

(function (global) {
"use strict";

const DBNOMICS = 'https://api.db.nomics.world/v22/series/';
const BLS_API  = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';

/* Series catalogue. Keys are used throughout the pages. */
const SERIES = {
  M1:        { id: 'FED/H6_H6_M1/M1.M',            label: 'M1',                    unit: '$B', fred: 'M1SL'    },
  M2:        { id: 'FED/H6_H6_M2/M2.M',            label: 'M2',                    unit: '$B', fred: 'M2SL'    },
  CURRENCY:  { id: 'FED/H6_H6_M2/MCU.M',           label: 'Currency in circulation', unit: '$B', fred: 'CURRSL' },
  DEPOSITS:  { id: 'FED/H6_H6_M2/MDD.M',           label: 'Demand deposits',       unit: '$B', fred: 'DEMDEPSL' },
  FEDFUNDS:  { id: 'FED/H15/RIFSPFF_N.M',          label: 'Federal funds rate',    unit: '%',  fred: 'FEDFUNDS' },
  T3M:       { id: 'FED/H15/RIFLGFCM03_N.M',       label: '3-month Treasury',      unit: '%',  fred: 'GS3M'    },
  T2Y:       { id: 'FED/H15/RIFLGFCY02_N.M',       label: '2-year Treasury',       unit: '%',  fred: 'GS2'     },
  T10Y:      { id: 'FED/H15/RIFLGFCY10_N.M',       label: '10-year Treasury',      unit: '%',  fred: 'GS10'    },
  T30Y:      { id: 'FED/H15/RIFLGFCY30_N.M',       label: '30-year Treasury',      unit: '%',  fred: 'GS30'    },
  PRIME:     { id: 'FED/H15/RIFSPBLP_N.M',         label: 'Bank prime loan rate',  unit: '%',  fred: 'MPRIME'  },
  GDP:       { id: 'BEA/NIPA-T10105/A191RC-Q',     label: 'Nominal GDP',           unit: '$M', fred: 'GDP'     },
  T1M:       { id: 'FED/H15/RIFLGFCM01_N.M',       label: '1-month Treasury',      unit: '%',  fred: 'GS1M'    },
  T6M:       { id: 'FED/H15/RIFLGFCM06_N.M',       label: '6-month Treasury',      unit: '%',  fred: 'GS6M'    },
  T1Y:       { id: 'FED/H15/RIFLGFCY01_N.M',       label: '1-year Treasury',       unit: '%',  fred: 'GS1'     },
  T3Y:       { id: 'FED/H15/RIFLGFCY03_N.M',       label: '3-year Treasury',       unit: '%',  fred: 'GS3'     },
  T5Y:       { id: 'FED/H15/RIFLGFCY05_N.M',       label: '5-year Treasury',       unit: '%',  fred: 'GS5'     },
  T7Y:       { id: 'FED/H15/RIFLGFCY07_N.M',       label: '7-year Treasury',       unit: '%',  fred: 'GS7'     },
  T20Y:      { id: 'FED/H15/RIFLGFCY20_N.M',       label: '20-year Treasury',      unit: '%',  fred: 'GS20'    },
  RGDP:      { id: 'BEA/NIPA-T10106/A191RX-Q',     label: 'Real GDP',              unit: '$M', fred: 'GDPC1'   },
  PCE:       { id: 'BEA/NIPA-T10105/DPCERC-Q',     label: 'Consumption',           unit: '$M', fred: 'PCEC'    },
  INVEST:    { id: 'BEA/NIPA-T10105/A006RC-Q',     label: 'Investment',            unit: '$M', fred: 'GPDI'    },
  GOVT:      { id: 'BEA/NIPA-T10105/A822RC-Q',     label: 'Government',            unit: '$M', fred: 'GCE'     },
  NETEX:     { id: 'BEA/NIPA-T10105/A019RC-Q',     label: 'Net exports',           unit: '$M', fred: 'NETEXP'  },
  UNEMP_HIST:{ id: 'BLS/ln/LNS14000000',           label: 'Unemployment rate',     unit: '%',  fred: 'UNRATE'  },
  TIPS10:    { id: 'FED/H15/RIFLGFCY10_XII_N.M',   label: '10-year TIPS (real)',   unit: '%',  fred: 'FII10'   },
  TIPS5:     { id: 'FED/H15/RIFLGFCY05_XII_N.M',   label: '5-year TIPS (real)',    unit: '%',  fred: 'FII5'    },
  CPI_HIST:  { id: 'BLS/cu/CUSR0000SA0',           label: 'CPI-U, all items (SA)', unit: 'index', fred: 'CPIAUCSL' }
};

/* U.S. Treasury, Fiscal Data — "Debt to the Penny". Daily since 1993;
   the field for debt held by the public begins in September 1997. */
const TREASURY_DEBT =
  'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny' +
  '?fields=record_date,debt_held_public_amt&sort=record_date&page[size]=10000';

/* ---------- small helpers ---------- */

/* DBnomics hands back periods like "1959-01-31" or "2026-Q2".
   Everything monthly gets normalised to "YYYY-MM" so series from
   different providers can be lined up. */
function normPeriod(p) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p.slice(0, 7);
  return p;
}

/* True only for a usable number. Note that isFinite(null) is true,
   so null has to be excluded explicitly. */
function isNum(v) { return typeof v === 'number' && isFinite(v); }

function periodToDate(p) {
  const q = /^(\d{4})-Q(\d)$/.exec(p);
  if (q) return new Date(Number(q[1]), (Number(q[2]) - 1) * 3, 1);
  const m = /^(\d{4})-(\d{2})/.exec(p);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return new Date(p);
}

function prettyPeriod(p) {
  const q = /^(\d{4})-Q(\d)$/.exec(p);
  if (q) return `${q[1]} Q${q[2]}`;
  const m = /^(\d{4})-(\d{2})/.exec(p);
  if (!m) return p;
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[Number(m[2]) - 1]} ${m[1]}`;
}

const cache = new Map();

/* Fetch one DBnomics series -> { periods:[], values:[] } with nulls preserved. */
async function fetchDbnomics(id) {
  const res = await fetch(`${DBNOMICS}${id}?observations=1`);
  if (!res.ok) throw new Error(`DBnomics returned ${res.status} for ${id}`);
  const json = await res.json();
  const doc = json.series && json.series.docs && json.series.docs[0];
  if (!doc) throw new Error(`No observations found for ${id}`);
  const periods = [], values = [];
  for (let i = 0; i < doc.period.length; i++) {
    const v = doc.value[i];
    periods.push(normPeriod(doc.period[i]));
    values.push(isNum(v) ? v : null);
  }
  return { periods, values };
}

/* The BLS public API returns the last three years without a key.
   Used to extend the CPI history past the mirror's last update. */
async function fetchBls(seriesId) {
  const res = await fetch(`${BLS_API}${seriesId}`);
  if (!res.ok) throw new Error(`BLS returned ${res.status}`);
  const json = await res.json();
  const rows = json.Results && json.Results.series && json.Results.series[0].data;
  if (!rows) throw new Error('BLS returned no rows');
  const out = [];
  for (const r of rows) {
    if (!/^M(0[1-9]|1[0-2])$/.test(r.period)) continue;  // skip M13 annual average
    const v = Number(r.value);
    if (!isNum(v)) continue;                          // skip suppressed or blank values
    out.push([`${r.year}-${r.period.slice(1)}`, v]);
  }
  out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return { periods: out.map(r => r[0]), values: out.map(r => r[1]) };
}

/* Debt held by the public, thinned from daily to one observation per
   month so it lines up with the monthly interest-rate series.
   Returned in billions of dollars. */
async function fetchTreasuryDebt() {
  const res = await fetch(TREASURY_DEBT);
  if (!res.ok) throw new Error(`Treasury Fiscal Data returned ${res.status}`);
  const json = await res.json();
  const rows = json.data || [];
  const byMonth = new Map();
  for (const r of rows) {
    const v = Number(r.debt_held_public_amt);
    if (!isNum(v)) continue;                      // the field is blank before Sept 1997
    byMonth.set(r.record_date.slice(0, 7), v / 1e9);
  }
  const periods = [...byMonth.keys()].sort();
  return { periods, values: periods.map(p => byMonth.get(p)) };
}

/* Splice two versions of the same series, preferring the later one. */
function splice(base, extra) {
  const map = new Map();
  base.periods.forEach((p, i) => map.set(p, base.values[i]));
  extra.periods.forEach((p, i) => map.set(p, extra.values[i]));
  const periods = [...map.keys()].sort();
  return { periods, values: periods.map(p => map.get(p)) };
}

/* Public: get one catalogued series, cached for the page's lifetime. */
async function getSeries(key) {
  if (cache.has(key)) return cache.get(key);
  const spec = SERIES[key];
  if (!spec) throw new Error(`Unknown series key: ${key}`);

  const p = (async () => {
    if (key === 'DEBT') return fetchTreasuryDebt();

    /* Two BLS series come from the mirror for their long history and
       from the BLS API for the most recent months, then get spliced. */
    const SPLICED = { CPI: ['CPI_HIST', 'CUSR0000SA0'], UNEMP: ['UNEMP_HIST', 'LNS14000000'] };
    if (SPLICED[key]) {
      const [histKey, blsId] = SPLICED[key];
      const hist = await fetchDbnomics(SERIES[histKey].id);
      try {
        return splice(hist, await fetchBls(blsId));
      } catch (e) {
        console.warn('BLS extension unavailable, using mirrored history only:', e.message);
        return hist;
      }
    }
    return fetchDbnomics(spec.id);
  })();

  cache.set(key, p);
  return p;
}

/* Assembled or externally sourced series get their own catalogue entries. */
SERIES.CPI  = { id: 'spliced',  label: 'CPI-U, all items (SA)', unit: 'index', fred: 'CPIAUCSL' };
SERIES.DEBT  = { id: 'treasury', label: 'Federal debt held by the public', unit: '$B', fred: 'FYGFDPUN' };
SERIES.UNEMP = { id: 'spliced',  label: 'Unemployment rate', unit: '%', fred: 'UNRATE' };

/* ---------- transformations ---------- */

/* Year-over-year percent change. lag = 12 for monthly, 4 for quarterly. */
function yoy(series, lag = 12) {
  const values = series.values.map((v, i) => {
    const past = series.values[i - lag];
    if (i < lag || !isNum(v) || !isNum(past) || past === 0) return null;
    return ((v / past) - 1) * 100;
  });
  return { periods: series.periods, values };
}

/* Annualised growth over an arbitrary window, in months.
   growthOver(s, 12) is the 12-month rate; growthOver(s, 120) is the
   average annual rate over the past decade. */
function growthOver(series, months) {
  const values = series.values.map((v, i) => {
    const past = series.values[i - months];
    if (i < months || !isNum(v) || !isNum(past) || past <= 0 || v <= 0) return null;
    const g = (Math.pow(v / past, 12 / months) - 1) * 100;
    return isNum(g) ? g : null;
  });
  return { periods: series.periods, values };
}

/* Move a monthly series forward in time by k months, so that a value
   observed at t is plotted at t + k. Used to line up leads and lags. */
function shiftMonths(series, k) {
  if (!k) return series;
  const periods = series.periods.map(p => {
    const m = /^(\d{4})-(\d{2})$/.exec(p);
    if (!m) return p;
    let y = Number(m[1]), mo = Number(m[2]) + k;
    y += Math.floor((mo - 1) / 12);
    mo = ((mo - 1) % 12) + 1;
    return `${y}-${String(mo).padStart(2, '0')}`;
  });
  return { periods, values: series.values.slice() };
}

/* Keep only observations on or after a given period string. */
function since(series, from) {
  const out = { periods: [], values: [] };
  for (let i = 0; i < series.periods.length; i++) {
    if (series.periods[i] >= from) {
      out.periods.push(series.periods[i]);
      out.values.push(series.values[i]);
    }
  }
  return out;
}

/* Align several series onto one shared list of periods. */
function align(seriesList) {
  const sets = seriesList.map(s => {
    const m = new Map();
    s.periods.forEach((p, i) => m.set(p, s.values[i]));
    return m;
  });
  const periods = [...new Set(seriesList.flatMap(s => s.periods))].sort();
  return { periods, columns: sets.map(m => periods.map(p => (m.has(p) ? m.get(p) : null))) };
}

/* Difference two aligned series (a - b). */
function subtract(a, b) {
  const { periods, columns } = align([a, b]);
  return {
    periods,
    values: periods.map((_, i) =>
      !isNum(columns[0][i]) || !isNum(columns[1][i]) ? null : columns[0][i] - columns[1][i])
  };
}

/* Latest non-null observation. */
function latest(series) {
  for (let i = series.values.length - 1; i >= 0; i--) {
    if (isNum(series.values[i])) return { period: series.periods[i], value: series.values[i] };
  }
  return null;
}

/* ---------- formatting ---------- */

function fmtMoney(billions) {
  if (billions == null) return '—';
  if (billions >= 1000) return `$${(billions / 1000).toFixed(2)}T`;
  return `$${billions.toFixed(0)}B`;
}
function fmtPct(x, dp = 2) { return x == null ? '—' : `${x.toFixed(dp)}%`; }

function fredUrl(key) {
  const spec = SERIES[key];
  return spec && spec.fred ? `https://fred.stlouisfed.org/series/${spec.fred}` : null;
}


  /* ---------- expose ---------- */
  global.MBData = {
    SERIES: SERIES,
    getSeries: getSeries,
    yoy: yoy,
    growthOver: growthOver,
    shiftMonths: shiftMonths,
    since: since,
    align: align,
    subtract: subtract,
    latest: latest,
    fmtMoney: fmtMoney,
    fmtPct: fmtPct,
    fredUrl: fredUrl,
    isNum: isNum,
    prettyPeriod: prettyPeriod,
    periodToDate: periodToDate
  };
})(window);
