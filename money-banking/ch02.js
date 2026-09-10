/* ============================================================
   ch02.js — wiring for Chapter 2
   ============================================================ */

(function () {
"use strict";

const D = window.MBData;
const C = window.MBChart;

const pctFmt   = v => (v == null ? '—' : v.toFixed(1) + '%');
const moneyFmt = v => (v == null ? '—' : (v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'T' : '$' + Math.round(v) + 'B'));
const shareFmt = v => (v == null ? '—' : v.toFixed(1) + '%');

function fail(fig, err) {
  console.error(err);
  C.setStatus(fig, 'Could not reach the data service. Reload the page, or check the FRED links below the chart to download the series directly.', true);
}

/* ---------------------------------------------------------
   Live stat strip
   --------------------------------------------------------- */
async function statStrip() {
  const put = (key, value, meta) => {
    const v = document.querySelector(`[data-stat="${key}"]`);
    const m = document.querySelector(`[data-stat="${key}-meta"]`);
    if (v) { v.textContent = value; v.classList.remove('loading'); }
    if (m) m.textContent = meta || '';
  };
  try {
    const [m2, cur, cpi, ff, t10] = await Promise.all([
      D.getSeries('M2'), D.getSeries('CURRENCY'), D.getSeries('CPI'),
      D.getSeries('FEDFUNDS'), D.getSeries('T10Y')
    ]);
    const lM2  = D.latest(m2);
    const lCur = D.latest(cur);
    const lM2g = D.latest(D.yoy(m2));
    const lCpi = D.latest(D.yoy(cpi));
    const lFf  = D.latest(ff);
    const lT10 = D.latest(t10);

    put('m2',  D.fmtMoney(lM2.value),  D.prettyPeriod(lM2.period));
    put('cur', D.fmtMoney(lCur.value), `${((lCur.value / lM2.value) * 100).toFixed(1)}% of M2`);
    put('m2g', lM2g.value.toFixed(1) + '%', D.prettyPeriod(lM2g.period));
    put('cpi', lCpi.value.toFixed(1) + '%', D.prettyPeriod(lCpi.period));
    put('ff',  lFf.value.toFixed(2) + '%',  D.prettyPeriod(lFf.period));
    put('t10', lT10.value.toFixed(2) + '%', D.prettyPeriod(lT10.period));

    // Feed the calculator a sensible default discount rate.
    window.__t10 = lT10;
  } catch (e) {
    console.error(e);
    document.querySelectorAll('[data-stat]').forEach(el => {
      if (el.classList.contains('value')) { el.textContent = 'unavailable'; }
    });
  }
}

/* ---------------------------------------------------------
   Money growth and inflation
   --------------------------------------------------------- */
async function moneyInflation() {
  const fig = document.getElementById('fig-money-inflation');
  const cv  = document.getElementById('cv-money-inflation');
  const fitLine = fig.querySelector('[data-fit]');
  let view = 'time', horizon = 12, lag = 0, m2, cpi;

  const horizonName = h => (h === 12 ? '12-month' : (h / 12) + '-year average annual');
  const lagName = k => (k === 0 ? '' : `, shifted forward ${k / 12} year${k === 12 ? '' : 's'}`);

  function draw() {
    const money = D.shiftMonths(D.growthOver(m2, horizon), lag);
    const infl  = D.growthOver(cpi, horizon);
    const m = D.align([money, infl]);

    if (view === 'time') {
      C.line(cv, m.periods,
        [{ label: `M2 growth${lagName(lag)}`, data: m.columns[0] },
         { label: 'CPI inflation', data: m.columns[1] }],
        { format: pctFmt, yTitle: 'annualised percent' });
      const pairs = m.periods
        .map((p, i) => [m.columns[0][i], m.columns[1][i]])
        .filter(([x, y]) => D.isNum(x) && D.isNum(y));
      fitLine.textContent = pairs.length > 2
        ? `${horizonName(horizon)} growth rates${lagName(lag)}: correlation r = ${correlation(pairs).toFixed(2)} across ${pairs.length} months. Switch to the scatter to see the same fact as a cloud of points.`
        : '';
    } else {
      const pts = m.periods.map((p, i) => ({ x: m.columns[0][i], y: m.columns[1][i], period: p }));
      const res = C.scatter(cv, pts, {
        fit: true,
        xLabel: `M2 growth, ${horizonName(horizon)}${lagName(lag)}`,
        yLabel: `CPI inflation, ${horizonName(horizon)}`
      });
      fitLine.textContent = res.fitText
        ? `Least-squares fit: ${res.fitText}. Each point is one month's pair of growth rates.`
        : '';
    }
    C.setStatus(fig, '');
  }

  function correlation(pairs) {
    const n = pairs.length;
    const mx = pairs.reduce((a, p) => a + p[0], 0) / n;
    const my = pairs.reduce((a, p) => a + p[1], 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (const [x, y] of pairs) { const dx = x - mx, dy = y - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    return sxy / Math.sqrt(sxx * syy);
  }

  try {
    [m2, cpi] = await Promise.all([D.getSeries('M2'), D.getSeries('CPI')]);
    C.toggleGroup(fig.querySelector('[data-toggle="view"]'), v => { view = v; draw(); });
    C.toggleGroup(fig.querySelector('[data-toggle="horizon"]'), v => { horizon = Number(v); draw(); });
    C.toggleGroup(fig.querySelector('[data-toggle="lag"]'), v => { lag = Number(v); draw(); });
    draw();
  } catch (e) { fail(fig, e); }
}

/* ---------------------------------------------------------
   How much of the money supply is cash
   --------------------------------------------------------- */
async function cashShare() {
  const fig = document.getElementById('fig-cash');
  const cv  = document.getElementById('cv-cash');
  let view = 'share', cur, m2;

  function draw() {
    const m = D.align([cur, m2]);
    if (view === 'share') {
      const share = m.periods.map((_, i) =>
        !D.isNum(m.columns[0][i]) || !D.isNum(m.columns[1][i]) ? null : (m.columns[0][i] / m.columns[1][i]) * 100);
      C.line(cv, m.periods, [{ label: 'Currency as a share of M2', data: share, fill: true }],
        { format: shareFmt, forceLegend: true, yTitle: 'percent of M2' });
    } else {
      C.line(cv, m.periods,
        [{ label: 'M2', data: m.columns[1] },
         { label: 'Currency in circulation', data: m.columns[0] }],
        { format: moneyFmt, yTitle: 'billions of dollars' });
    }
    C.setStatus(fig, '');
  }

  try {
    [cur, m2] = await Promise.all([D.getSeries('CURRENCY'), D.getSeries('M2')]);
    C.toggleGroup(fig.querySelector('[data-toggle="view"]'), v => { view = v; draw(); });
    draw();
  } catch (e) { fail(fig, e); }
}

/* ---------------------------------------------------------
   M1 and M2 since 1959
   --------------------------------------------------------- */
async function aggregates() {
  const fig = document.getElementById('fig-aggregates');
  const cv  = document.getElementById('cv-aggregates');
  let scale = 'linear', from = '1959-01', m1, m2;

  function draw() {
    const a = D.since(m1, from);
    const b = D.since(m2, from);
    const m = D.align([a, b]);
    C.line(cv, m.periods,
      [{ label: 'M1', data: m.columns[0] },
       { label: 'M2', data: m.columns[1] }],
      { format: moneyFmt, log: scale === 'log', yTitle: 'billions of dollars' });
    C.setStatus(fig, '');
  }

  try {
    [m1, m2] = await Promise.all([D.getSeries('M1'), D.getSeries('M2')]);
    C.toggleGroup(fig.querySelector('[data-toggle="scale"]'), v => { scale = v; draw(); });
    C.toggleGroup(fig.querySelector('[data-toggle="from"]'), v => { from = v; draw(); });
    draw();
  } catch (e) { fail(fig, e); }
}

/* ---------------------------------------------------------
   Interest rates
   --------------------------------------------------------- */
async function rates() {
  const fig = document.getElementById('fig-rates');
  const cv  = document.getElementById('cv-rates');
  let from = '1990-01', loaded;

  function draw() {
    const cut = loaded.map(s => D.since(s, from));
    const m = D.align(cut);
    const labels = ['Federal funds', '3-month Treasury', '2-year Treasury', '10-year Treasury', 'Bank prime rate'];
    C.line(cv, m.periods, labels.map((l, i) => ({ label: l, data: m.columns[i] })),
      { format: v => (v == null ? '—' : v.toFixed(2) + '%'), yTitle: 'percent per year' });
    C.setStatus(fig, '');
  }

  try {
    loaded = await Promise.all(['FEDFUNDS', 'T3M', 'T2Y', 'T10Y', 'PRIME'].map(k => D.getSeries(k)));
    C.toggleGroup(fig.querySelector('[data-toggle="from"]'), v => { from = v; draw(); });
    draw();
  } catch (e) { fail(fig, e); }
}

/* ---------------------------------------------------------
   Nominal, inflation, real
   --------------------------------------------------------- */
async function realRate() {
  const fig = document.getElementById('fig-real');
  const cv  = document.getElementById('cv-real');
  let from = '1990-01', t10, infl, real;

  function draw() {
    const m = D.align([D.since(t10, from), D.since(infl, from), D.since(real, from)]);
    C.line(cv, m.periods,
      [{ label: '10-year Treasury yield (nominal)', data: m.columns[0] },
       { label: 'CPI inflation, 12 months',         data: m.columns[1] },
       { label: 'Realised real yield',              data: m.columns[2], width: 2.5 }],
      { format: v => (v == null ? '—' : v.toFixed(1) + '%'), yTitle: 'percent per year' });
    C.setStatus(fig, '');
  }

  try {
    const [y, cpi] = await Promise.all([D.getSeries('T10Y'), D.getSeries('CPI')]);
    t10 = y;
    infl = D.yoy(cpi);
    real = D.subtract(t10, infl);
    C.toggleGroup(fig.querySelector('[data-toggle="from"]'), v => { from = v; draw(); });
    draw();
  } catch (e) { fail(fig, e); }
}

/* ---------------------------------------------------------
   Present value calculator
   --------------------------------------------------------- */
function presentValue() {
  const fv = document.getElementById('pv-fv');
  const n  = document.getElementById('pv-n');
  const r  = document.getElementById('pv-r');
  const nOut = document.getElementById('pv-n-out');
  const rOut = document.getElementById('pv-r-out');
  const out  = document.getElementById('pv-out');
  const exp  = document.getElementById('pv-explain');
  const note = document.getElementById('pv-r-note');
  const cv   = document.getElementById('cv-pv');
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function draw() {
    const F = Number(fv.value) || 0;
    const N = Number(n.value);
    const R = Number(r.value) / 100;
    const pv = F / Math.pow(1 + R, N);

    nOut.textContent = N === 1 ? '1' : N;
    rOut.textContent = Number(r.value).toFixed(1) + '%';
    out.textContent = money.format(pv);
    exp.textContent = `${money.format(F)} in ${N} year${N === 1 ? '' : 's'} at ${Number(r.value).toFixed(1)}% is worth ${(pv / (F || 1) * 100).toFixed(0)} cents on the dollar today.`;

    const years = [], vals = [];
    const maxN = Math.max(N, 40);
    for (let y = 0; y <= maxN; y++) { years.push(String(y)); vals.push(F / Math.pow(1 + R, y)); }
    C.line(cv, years, [{ label: 'Present value', data: vals, fill: true }], {
      format: v => (v == null ? '—' : money.format(v)),
      forceLegend: false,
      yTitle: 'value today',
      xTitle: 'years until the payment arrives'
    });
  }

  [fv, n, r].forEach(el => el.addEventListener('input', draw));

  // Seed the discount rate with the current 10-year Treasury yield.
  const seed = setInterval(() => {
    if (window.__t10) {
      clearInterval(seed);
      r.value = window.__t10.value.toFixed(1);
      note.textContent = `Starting point: the 10-year Treasury yield in ${D.prettyPeriod(window.__t10.period)} was ${window.__t10.value.toFixed(2)}%.`;
      draw();
    }
  }, 250);
  setTimeout(() => clearInterval(seed), 15000);

  draw();
}

/* ---------------------------------------------------------
   Go
   --------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  statStrip();
  moneyInflation();
  cashShare();
  aggregates();
  rates();
  realRate();
  presentValue();
});

})();
