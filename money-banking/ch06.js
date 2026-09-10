/* ============================================================
   ch06.js — wiring for Chapter 6
   ============================================================ */

(function () {
"use strict";

const D = window.MBData;
const C = window.MBChart;

const pct1 = v => (D.isNum(v) ? v.toFixed(1) + '%' : '—');
const usdT = v => (D.isNum(v) ? '$' + (v / 1e6).toFixed(1) + 'T' : '—');   // BEA values are $ millions

function fail(fig, err) {
  console.error(err);
  C.setStatus(fig, 'Could not reach the data service. Reload the page, or use the FRED links below the chart to download the series directly.', true);
}

/* Recession bands expressed in quarters, for the quarterly charts. */
function quarterBands() {
  return C.RECESSIONS.map(b => ({
    from: b.from.slice(0, 4) + '-Q' + (Math.floor((Number(b.from.slice(5)) - 1) / 3) + 1),
    to:   b.to.slice(0, 4)   + '-Q' + (Math.floor((Number(b.to.slice(5))   - 1) / 3) + 1)
  }));
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
  const tryPut = async (key, fn) => {
    try { await fn(); }
    catch (e) {
      console.error(key, e);
      const el = document.querySelector(`[data-stat="${key}"]`);
      if (el) { el.textContent = 'unavailable'; el.classList.remove('loading'); }
    }
  };

  await tryPut('gdp', async () => {
    const [gdp, pce] = await Promise.all([D.getSeries('GDP'), D.getSeries('PCE')]);
    const g = D.latest(gdp), c = D.latest(pce);
    put('gdp', usdT(g.value), D.prettyPeriod(g.period) + ', annual rate');
    put('cshare', (c.value / g.value * 100).toFixed(1) + '%', 'of GDP');
  });

  await tryPut('rgdp', async () => {
    const r = await D.getSeries('RGDP');
    const g = D.latest(D.yoy(r, 4));
    put('rgdp', pct1(g.value), D.prettyPeriod(g.period) + ', year on year');
  });

  await tryPut('unemp', async () => {
    const u = await D.getSeries('UNEMP');
    const l = D.latest(u);
    put('unemp', pct1(l.value), D.prettyPeriod(l.period));
  });

  await tryPut('cpi', async () => {
    const cpi = await D.getSeries('CPI');
    const l = D.latest(D.yoy(cpi));
    put('cpi', pct1(l.value), D.prettyPeriod(l.period) + ', 12 months');
  });

  await tryPut('m2', async () => {
    const m2 = await D.getSeries('M2');
    const l = D.latest(D.yoy(m2));
    put('m2', pct1(l.value), D.prettyPeriod(l.period) + ', 12 months');
  });
}

/* ---------------------------------------------------------
   6-1b  The components of aggregate demand
   --------------------------------------------------------- */
async function components() {
  const fig  = document.getElementById('fig-components');
  const cv   = document.getElementById('cv-components');
  const note = document.getElementById('components-note');
  let view = 'share', from = '1947-Q1', gdp, parts;

  function draw() {
    const cut = [gdp].concat(parts).map(s => D.since(s, from));
    const m = D.align(cut);
    const labels = ['Consumption', 'Investment', 'Government', 'Net exports'];
    const pal = C.palette();

    if (view === 'share') {
      const shares = [1, 2, 3, 4].map(i => m.periods.map((_, j) =>
        D.isNum(m.columns[i][j]) && D.isNum(m.columns[0][j]) && m.columns[0][j] !== 0
          ? m.columns[i][j] / m.columns[0][j] * 100 : null));
      C.line(cv, m.periods, labels.map((l, i) => ({ label: l, data: shares[i], color: pal[i] })),
        { format: v => (D.isNum(v) ? v.toFixed(0) + '%' : '—'),
          yTitle: 'percent of GDP', bands: quarterBands() });

      const last = shares.map(s => { for (let i = s.length - 1; i >= 0; i--) if (D.isNum(s[i])) return s[i]; return null; });
      note.textContent = `Latest quarter: consumption ${last[0].toFixed(0)}% of GDP, ` +
        `investment ${last[1].toFixed(0)}%, government ${last[2].toFixed(0)}%, ` +
        `net exports ${last[3].toFixed(0)}%. They sum to 100 by construction, which is an identity rather than a finding.`;
    } else {
      C.line(cv, m.periods, labels.map((l, i) => ({ label: l, data: m.columns[i + 1], color: pal[i] })),
        { format: usdT, yTitle: 'trillions of dollars, annual rate', bands: quarterBands() });
      note.textContent = 'On a level scale the components are hard to compare and the growth of the whole dominates. That is why shares are the usual view.';
    }
    C.setStatus(fig, '');
  }

  /* Fill the phrases in the prose that describe this data, so the
     sentences stay true as the releases move. If the fetch fails the
     typed fallback text stays on the page, which is why each span is
     written to read correctly either way. */
  function fillProse() {
    const put = (k, v) => document.querySelectorAll(`[data-live="${k}"]`).forEach(e => { e.textContent = v; });
    const lastOf = s => { const l = D.latest(s); return l ? l.value : null; };
    const g = lastOf(gdp), c = lastOf(parts[0]), i = lastOf(parts[1]);
    if (D.isNum(g) && g !== 0) {
      if (D.isNum(c)) put('cshare', (c / g * 100).toFixed(0) + '%');
      if (D.isNum(i)) put('ishare', (i / g * 100).toFixed(0) + '% of it');
    }
    /* Volatility of year-on-year growth, consumption against investment. */
    const sd = s => {
      const g4 = D.yoy(s, 4).values.filter(D.isNum);
      if (g4.length < 8) return null;
      const m = g4.reduce((a, b) => a + b, 0) / g4.length;
      return Math.sqrt(g4.reduce((a, b) => a + (b - m) * (b - m), 0) / (g4.length - 1));
    };
    const sc = sd(parts[0]), si = sd(parts[1]);
    if (D.isNum(sc) && D.isNum(si) && sc > 0) put('volratio', (si / sc).toFixed(0) + ' times');
  }

  try {
    const got = await Promise.all(['GDP', 'PCE', 'INVEST', 'GOVT', 'NETEX'].map(k => D.getSeries(k)));
    gdp = got[0];
    parts = got.slice(1);
    fillProse();
    C.toggleGroup(fig.querySelector('[data-toggle="view"]'), v => { view = v; draw(); });
    C.toggleGroup(fig.querySelector('[data-toggle="from"]'), v => { from = v; draw(); });
    draw();
  } catch (e) { fail(fig, e); }
}

/* ---------------------------------------------------------
   6-2f  The spending multiplier
   --------------------------------------------------------- */
function multiplier() {
  const inject = document.getElementById('m-inject');
  const mpc    = document.getElementById('m-mpc');
  const rounds = document.getElementById('m-rounds');
  const cv     = document.getElementById('cv-multiplier');
  const money  = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 1 });

  function draw() {
    const inj = Number(inject.value) || 0;
    const c   = Number(mpc.value);
    const n   = Number(rounds.value);

    document.getElementById('m-mpc-out').textContent    = c.toFixed(2);
    document.getElementById('m-rounds-out').textContent = n;

    const each = [], cumul = [];
    let running = 0;
    for (let i = 0; i < n; i++) {
      const v = inj * Math.pow(c, i);
      running += v;
      each.push(v);
      cumul.push(running);
    }
    const total = c >= 1 ? Infinity : inj / (1 - c);

    document.getElementById('m-total').textContent =
      isFinite(total) ? money.format(total) + 'm' : 'unbounded';
    document.getElementById('m-detail').textContent = isFinite(total)
      ? `A multiplier of ${(1 / (1 - c)).toFixed(2)}: every dollar injected becomes ${(1 / (1 - c)).toFixed(2)} dollars of spending.`
      : 'With every dollar passed along in full, the series never converges.';

    const reached = isFinite(total) ? running / total * 100 : 0;
    document.getElementById('m-note').textContent = isFinite(total)
      ? `After ${n} rounds, ${reached.toFixed(0)}% of the total effect has arrived. A larger multiplier is also a slower one, which matters when the policy is meant to help now.`
      : '';

    const pal = C.palette();
    C.bar(cv, each.map((_, i) => String(i + 1)),
      [{ label: 'Spending in this round', data: each, color: pal[0] },
       { label: 'Running total', data: cumul, type: 'line', borderColor: pal[1], backgroundColor: 'transparent',
         borderWidth: 2.4, pointRadius: 0, order: 0 }],
      { format: v => (D.isNum(v) ? money.format(v) + 'm' : '—'),
        xTitle: 'round of spending', yTitle: '$ million' });
  }

  [inject, mpc, rounds].forEach(el => el.addEventListener('input', draw));
  draw();
}

/* ---------------------------------------------------------
   6-4b  The AD-AS diagram
   ---------------------------------------------------------
   Straight lines in (output, price level) space:
     AD    : P = adIntercept - adSlope * Y
     SRAS  : P = srasIntercept + srasSlope * Y
     LRAS  : Y = potential (vertical)
   The baseline is calibrated so that AD and SRAS cross exactly on
   LRAS at a price level of 100.
   --------------------------------------------------------- */
function adAs() {
  const fig  = document.getElementById('fig-adas');
  const cv   = document.getElementById('cv-adas');
  const text = document.getElementById('adas-text');

  const POT = 100, P0 = 100, AD_SLOPE = 1.6, SRAS_SLOPE = 1.4;
  const AD_INT   = P0 + AD_SLOPE * POT;      // so AD passes through (100, 100)
  const SRAS_INT = P0 - SRAS_SLOPE * POT;    // so SRAS passes through (100, 100)

  const SHOCKS = {
    none:       { ad: 0,   sras: 0,  pot: 0 },
    demandUp:   { ad: 22,  sras: 0,  pot: 0,
      text: '<strong>Demand rises.</strong> Households feel wealthier, firms see projects worth funding, or the government spends more. The AD curve shifts right. In the short run both output and the price level rise and the economy runs above potential.' },
    demandDown: { ad: -22, sras: 0,  pot: 0,
      text: '<strong>Demand collapses.</strong> Confidence falls and spending with it. AD shifts left, output falls below potential and the price level falls. Unemployment rises above its sustainable rate. This is the shape of an ordinary recession.' },
    money:      { ad: 18,  sras: 0,  pot: 0,
      text: '<strong>The money supply expands.</strong> Lower interest rates raise investment and interest-sensitive consumption, so AD shifts right. This is the only shock on this list that a central bank controls directly, and it reaches output through exactly the mechanism Chapters 3 and 4 built.' },
    supplyShock:{ ad: 0,   sras: 26, pot: 0,
      text: '<strong>An oil price shock.</strong> Production costs rise at every level of output, so SRAS shifts up and left. Output falls <em>and</em> the price level rises at the same time: stagflation. Notice that no demand policy fixes both. Pushing AD right restores output but adds to inflation, and pulling it left does the reverse. This is the case that broke the simple framework in the 1970s.' },
    productivity:{ ad: 0,  sras: -18, pot: 14,
      text: '<strong>Productivity improves.</strong> The economy can produce more with the same inputs, so LRAS shifts right and SRAS shifts down. Output rises and the price level falls, with no policy involved. Supply-side improvements are the only way to raise output permanently.' }
  };

  function draw(key, horizon) {
    const sh = SHOCKS[key] || SHOCKS.none;
    const base = SHOCKS.none;

    const pot = POT + sh.pot;
    let srasShift = sh.sras;
    let adjusted = false;

    /* Letting it adjust: wages and expectations move until the short-run
       curve crosses AD on the long-run curve. */
    if (horizon === 'long') {
      srasShift = (AD_INT + sh.ad) - AD_SLOPE * pot - (SRAS_INT + SRAS_SLOPE * pot);
      adjusted = true;
    }

    const adInt   = AD_INT + sh.ad;
    const srasInt = SRAS_INT + srasShift;

    // Equilibrium where AD meets SRAS
    const yStar = (adInt - srasInt) / (AD_SLOPE + SRAS_SLOPE);
    const pStar = adInt - AD_SLOPE * yStar;

    const yMin = 60, yMax = 140;
    const line = (f) => [{ x: yMin, y: f(yMin) }, { x: yMax, y: f(yMax) }];
    const pal = C.palette();

    const series = [
      { label: 'Aggregate demand', color: pal[0], points: line(y => adInt - AD_SLOPE * y) },
      { label: 'Short-run supply', color: pal[1], points: line(y => srasInt + SRAS_SLOPE * y) },
      { label: 'Long-run supply', color: pal[2], width: 2, points: [{ x: pot, y: 40 }, { x: pot, y: 170 }] }
    ];

    if (key !== 'none') {
      if (sh.ad !== 0) series.push({ label: '_ad0', color: pal[0], dashed: true, width: 1.4,
        points: line(y => AD_INT - AD_SLOPE * y) });
      if (srasShift !== 0) series.push({ label: '_sras0', color: pal[1], dashed: true, width: 1.4,
        points: line(y => SRAS_INT + SRAS_SLOPE * y) });
      if (sh.pot !== 0) series.push({ label: '_lras0', color: pal[2], dashed: true, width: 1.4,
        points: [{ x: POT, y: 40 }, { x: POT, y: 170 }] });
      series.push({ label: '_start', color: pal[5], point: true, points: [{ x: POT, y: P0 }] });
    }
    series.push({ label: `Output ${yStar.toFixed(1)}, prices ${pStar.toFixed(1)}`,
                  color: pal[3], point: true, points: [{ x: yStar, y: pStar }] });

    C.diagram(cv, series, {
      xMin: yMin, xMax: yMax, yMin: 55, yMax: 155,
      xTitle: 'real output  (potential = 100 at the start)',
      yTitle: 'price level  (100 at the start)',
      format: v => v.toFixed(0)
    });

    const gap = yStar - pot;
    const gapWord = Math.abs(gap) < 0.5 ? 'exactly at potential'
                  : gap > 0 ? `${gap.toFixed(1)} above potential (an inflationary gap)`
                  : `${Math.abs(gap).toFixed(1)} below potential (a recessionary gap)`;

    if (key === 'none') {
      text.innerHTML = 'The starting point: output at potential, price level 100. Pick a shock, then switch to ' +
        '<em>Let it adjust</em> to see where the economy settles once wages and expectations catch up.';
    } else {
      text.innerHTML = sh.text +
        (adjusted
          ? '<br><br><strong>After adjustment.</strong> Wages and expected prices have moved until the short-run curve crosses demand on the long-run curve. Output is back at potential and only the price level is permanently different — which is what "money is neutral in the long run" means in practice.'
          : '') +
        `<br><br><span style="color:var(--ink-soft)">Output ${yStar.toFixed(1)} against potential ${pot.toFixed(1)}: ${gapWord}. ` +
        `Price level ${pStar.toFixed(1)}, against 100 at the start.</span>`;
    }
  }

  let shock = 'none', horizon = 'short';
  C.toggleGroup(fig.querySelector('[data-toggle="shock"]'), v => { shock = v; draw(shock, horizon); });
  C.toggleGroup(fig.querySelector('[data-toggle="horizon"]'), v => { horizon = v; draw(shock, horizon); });
  draw('none', 'short');
}

/* ---------------------------------------------------------
   6-5a  Output and its trend
   --------------------------------------------------------- */
async function outputGap() {
  const fig  = document.getElementById('fig-gap');
  const cv   = document.getElementById('cv-gap');
  const note = document.getElementById('gap-note');
  let view = 'level', periods, actual, trend, gap;

  function draw() {
    if (view === 'level') {
      C.line(cv, periods,
        [{ label: 'Real GDP', data: actual },
         { label: 'Fitted constant-growth trend', data: trend, dashed: true, width: 1.8 }],
        { format: usdT, yTitle: 'trillions of chained dollars, log scale', log: true, bands: quarterBands() });
    } else {
      C.line(cv, periods,
        [{ label: 'Output relative to trend', data: gap, fill: true }],
        { format: v => (D.isNum(v) ? (v >= 0 ? '+' : '') + v.toFixed(1) + '%' : '—'),
          forceLegend: true, yTitle: 'percent above or below trend', bands: quarterBands() });
    }
    C.setStatus(fig, '');
  }

  try {
    const r = await D.getSeries('RGDP');
    const pts = [];
    r.periods.forEach((p, i) => { if (D.isNum(r.values[i]) && r.values[i] > 0) pts.push([i, Math.log(r.values[i]), p, r.values[i]]); });
    const n = pts.length;
    const mx = pts.reduce((a, q) => a + q[0], 0) / n;
    const my = pts.reduce((a, q) => a + q[1], 0) / n;
    let sxy = 0, sxx = 0;
    for (const q of pts) { sxy += (q[0] - mx) * (q[1] - my); sxx += (q[0] - mx) * (q[0] - mx); }
    const slope = sxy / sxx, intercept = my - slope * mx;

    periods = pts.map(q => q[2]);
    actual  = pts.map(q => q[3]);
    trend   = pts.map(q => Math.exp(intercept + slope * q[0]));
    gap     = pts.map((q, i) => (q[3] / trend[i] - 1) * 100);

    const annual = (Math.exp(slope * 4) - 1) * 100;
    const last = gap[gap.length - 1];
    note.textContent = `The fitted trend grows at ${annual.toFixed(2)}% a year across the whole sample, and output is currently ` +
      `${last >= 0 ? '+' : ''}${last.toFixed(1)}% relative to it. ` +
      (Math.abs(last) > 5
        ? 'A gap that large is mostly an artefact of the method rather than a statement about slack: growth was faster in the first half of the sample than the second, so a single constant-growth line sits too high over the recent years. Refit the trend on the last thirty years alone and the gap nearly disappears. That sensitivity is the lesson.'
        : 'It is a description of this particular line, not a measurement of spare capacity.');

    C.toggleGroup(fig.querySelector('[data-toggle="view"]'), v => { view = v; draw(); });
    draw();
  } catch (e) { fail(fig, e); }
}

/* ---------------------------------------------------------
   6-5b  Inflation and unemployment, by decade
   --------------------------------------------------------- */
async function phillips() {
  const fig  = document.getElementById('fig-phillips');
  const cv   = document.getElementById('cv-phillips');
  const note = document.getElementById('phillips-note');
  let decade = 'all', pairs = [];

  function draw() {
    const sel = decade === 'all'
      ? pairs
      : pairs.filter(p => Number(p.period.slice(0, 4)) >= Number(decade) &&
                          Number(p.period.slice(0, 4)) < Number(decade) + 10);
    const res = C.scatter(cv, sel, {
      fit: sel.length > 12,
      xLabel: 'unemployment rate',
      yLabel: 'CPI inflation over 12 months'
    });
    note.textContent = decade === 'all'
      ? `All ${sel.length} months since 1948 on one chart. ${res.fitText ? 'Fitted across everything: ' + res.fitText + '. ' : ''}` +
        'The relationship the theory predicts is buried, because the whole cloud drifts as expected inflation changes. Pick one decade at a time.'
      : (function () {
          const m = /slope = (-?[\d.]+)/.exec(res.fitText || '');
          const sl = m ? Number(m[1]) : null;
          const reading = sl == null ? ''
            : sl < -0.15 ? 'The slope is negative: in this decade, lower unemployment did come with higher inflation, as the trade-off predicts.'
            : sl > 0.15  ? 'The slope is positive: in this decade the trade-off ran backwards, with higher unemployment alongside higher inflation. Expectations were moving.'
            : 'The slope is roughly flat: in this decade there was no usable trade-off to see.';
          return `The ${decade}s: ${sel.length} months. ${res.fitText ? res.fitText + '. ' : ''}${reading}`;
        })();
  }

  try {
    const [u, cpi] = await Promise.all([D.getSeries('UNEMP'), D.getSeries('CPI')]);
    const infl = D.yoy(cpi);
    const m = D.align([u, infl]);
    pairs = m.periods.map((p, i) => ({ x: m.columns[0][i], y: m.columns[1][i], period: p }))
                     .filter(p => D.isNum(p.x) && D.isNum(p.y));
    C.toggleGroup(fig.querySelector('[data-toggle="decade"]'), v => { decade = v; draw(); });
    C.setStatus(fig, '');
    draw();
  } catch (e) { fail(fig, e); }
}

/* ---------------------------------------------------------
   Go
   --------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  statStrip();
  components();
  multiplier();
  adAs();
  outputGap();
  phillips();
});

})();
