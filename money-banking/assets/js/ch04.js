/* ============================================================
   ch04.js — wiring for Chapter 4
   ============================================================ */

(function () {
"use strict";

const D = window.MBData;
const C = window.MBChart;

const pct  = (v, dp) => (D.isNum(v) ? v.toFixed(dp == null ? 2 : dp) + '%' : '—');
const sgn  = (v, dp) => (D.isNum(v) ? (v >= 0 ? '+' : '') + v.toFixed(dp == null ? 2 : dp) + '%' : '—');

function fail(fig, err) {
  console.error(err);
  C.setStatus(fig, 'Could not reach the data service. Reload the page, or use the FRED links below the chart to download the series directly.', true);
}

/* Maturities on the Treasury curve, in years, with their series keys. */
const CURVE = [
  { key: 'T1M',  years: 1 / 12, label: '1m'  },
  { key: 'T3M',  years: 0.25,   label: '3m'  },
  { key: 'T6M',  years: 0.5,    label: '6m'  },
  { key: 'T1Y',  years: 1,      label: '1y'  },
  { key: 'T2Y',  years: 2,      label: '2y'  },
  { key: 'T3Y',  years: 3,      label: '3y'  },
  { key: 'T5Y',  years: 5,      label: '5y'  },
  { key: 'T7Y',  years: 7,      label: '7y'  },
  { key: 'T10Y', years: 10,     label: '10y' },
  { key: 'T20Y', years: 20,     label: '20y' },
  { key: 'T30Y', years: 30,     label: '30y' }
];

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
    const [t3m, t2, t10] = await Promise.all([
      D.getSeries('T3M'), D.getSeries('T2Y'), D.getSeries('T10Y')
    ]);
    const l3m = D.latest(t3m), l2 = D.latest(t2), l10 = D.latest(t10);
    put('t3m', pct(l3m.value), D.prettyPeriod(l3m.period));
    put('t2',  pct(l2.value),  D.prettyPeriod(l2.period));
    put('t10', pct(l10.value), D.prettyPeriod(l10.period));

    const s2 = D.latest(D.subtract(t10, t2));
    const s3 = D.latest(D.subtract(t10, t3m));
    put('sp2', sgn(s2.value), D.prettyPeriod(s2.period));
    put('sp3', sgn(s3.value), D.prettyPeriod(s3.period));

    const shape = s2.value < -0.1 ? 'Inverted'
                : s2.value < 0.25 ? 'Flat'
                : s2.value < 1.25 ? 'Upward'
                : 'Steep';
    put('shape', shape, 'by the 10y–2y gap');
  } catch (e) {
    console.error(e);
    ['t3m','t2','t10','sp2','sp3','shape'].forEach(k => {
      const el = document.querySelector(`[data-stat="${k}"]`);
      if (el) { el.textContent = 'unavailable'; el.classList.remove('loading'); }
    });
  }
}

/* ---------------------------------------------------------
   4-1b  Default risk premium calculator
   --------------------------------------------------------- */
function defaultRisk() {
  const safe = document.getElementById('d-safe');
  const pd   = document.getElementById('d-pd');
  const rec  = document.getElementById('d-rec');
  const cv   = document.getElementById('cv-drp');

  function requiredYield(safeR, p, r) {
    // Expected repayment per $1 promised, then the promised yield that
    // makes the expected return equal the safe rate.
    const expected = (1 - p) + p * r;          // fraction of the promise expected
    if (expected <= 0) return null;
    return ((1 + safeR) / expected) - 1;
  }

  function draw() {
    const s = Number(safe.value) / 100;
    const p = Number(pd.value) / 100;
    const r = Number(rec.value) / 100;

    document.getElementById('d-safe-out').textContent = Number(safe.value).toFixed(1) + '%';
    document.getElementById('d-pd-out').textContent   = Number(pd.value).toFixed(1) + '%';
    document.getElementById('d-rec-out').textContent  = Number(rec.value).toFixed(0) + '%';

    const y = requiredYield(s, p, r);
    const premium = y == null ? null : (y - s) * 100;
    document.getElementById('d-yield').textContent = y == null ? '—' : (y * 100).toFixed(2) + '%';
    document.getElementById('d-premium').textContent = premium == null
      ? 'Nothing can compensate for certain total loss.'
      : `A default risk premium of ${premium.toFixed(2)} percentage points over the safe rate.`;

    const expected = ((1 - p) + p * r) * 1000;
    document.getElementById('d-detail').innerHTML =
      `On a $1,000 promise, expected repayment is <strong>$${expected.toFixed(0)}</strong>: ` +
      `$1,000 in the ${((1 - p) * 100).toFixed(1)}% of cases where the borrower pays, and ` +
      `$${(r * 1000).toFixed(0)} in the ${(p * 100).toFixed(1)}% where it does not.`;

    // Premium as the default probability varies, at three recovery rates
    const xs = [];
    for (let q = 0; q <= 30; q += 1) xs.push(q);
    const pal = C.palette();
    const series = [0, 0.4, 0.7].map((rr, i) => ({
      label: `Recovery ${(rr * 100).toFixed(0)}%`,
      data: xs.map(q => {
        const yy = requiredYield(s, q / 100, rr);
        return yy == null ? null : (yy - s) * 100;
      }),
      color: pal[i]
    }));
    C.line(cv, xs.map(String), series, {
      format: v => (D.isNum(v) ? v.toFixed(1) + ' pts' : '—'),
      xTitle: 'chance of default, percent',
      yTitle: 'premium over the safe rate'
    });
  }

  [safe, pd, rec].forEach(el => el.addEventListener('input', draw));

  D.getSeries('T1Y').then(s => {
    const l = D.latest(s);
    safe.value = l.value.toFixed(1);
    document.getElementById('d-safe-note').textContent =
      `Starting point: the 1-year Treasury in ${D.prettyPeriod(l.period)} yielded ${l.value.toFixed(2)}%.`;
    draw();
  }).catch(() => {});

  draw();
}

/* ---------------------------------------------------------
   4-2c  Ex ante and ex post real rates
   --------------------------------------------------------- */
async function exAnte() {
  const fig = document.getElementById('fig-exante');
  const cv  = document.getElementById('cv-exante');
  let view = 'all', nominal, exAnteReal, exPostReal, surprise;

  function draw() {
    const m = D.align([nominal, exAnteReal, exPostReal, surprise]);
    const fmt = v => (D.isNum(v) ? v.toFixed(1) + '%' : '—');
    if (view === 'all') {
      C.line(cv, m.periods,
        [{ label: 'Nominal 10-year yield', data: m.columns[0] },
         { label: 'Ex ante real yield (from TIPS)', data: m.columns[1] },
         { label: 'Ex post real yield (after realised inflation)', data: m.columns[2] }],
        { format: fmt, yTitle: 'percent per year' });
    } else {
      C.line(cv, m.periods,
        [{ label: 'Ex post minus ex ante: the inflation surprise', data: m.columns[3], fill: true, color: C.palette()[1] }],
        { format: v => (D.isNum(v) ? (v >= 0 ? '+' : '') + v.toFixed(1) + '%' : '—'),
          forceLegend: true, yTitle: 'percentage points', bands: C.RECESSIONS });
    }
    C.setStatus(fig, '');
  }

  try {
    const [n, tips, cpi] = await Promise.all([
      D.getSeries('T10Y'), D.getSeries('TIPS10'), D.getSeries('CPI')
    ]);
    nominal    = D.since(n, '2003-01');
    exAnteReal = D.since(tips, '2003-01');
    exPostReal = D.subtract(nominal, D.since(D.yoy(cpi), '2003-01'));
    surprise   = D.subtract(exPostReal, exAnteReal);
    C.toggleGroup(fig.querySelector('[data-toggle="view"]'), v => { view = v; draw(); });
    draw();
  } catch (e) { fail(fig, e); }
}

/* ---------------------------------------------------------
   4-3b  Tax-equivalent yield
   --------------------------------------------------------- */
function taxEquivalent() {
  const muni = document.getElementById('t-muni');
  const rate = document.getElementById('t-rate');
  const corp = document.getElementById('t-corp');
  const cv   = document.getElementById('cv-tax');
  const BRACKETS = [0, 12, 22, 24, 32, 35, 37];

  function draw() {
    const m = Number(muni.value);
    const t = Number(rate.value) / 100;
    const c = Number(corp.value);

    document.getElementById('t-muni-out').textContent = m.toFixed(2) + '%';
    document.getElementById('t-rate-out').textContent = (t * 100).toFixed(0) + '%';
    document.getElementById('t-corp-out').textContent = c.toFixed(2) + '%';

    const teq = t >= 1 ? null : m / (1 - t);
    document.getElementById('t-teq').textContent = teq == null ? '—' : teq.toFixed(2) + '%';

    const afterTaxCorp = c * (1 - t);
    const breakeven = c > 0 ? (1 - m / c) * 100 : null;
    document.getElementById('t-verdict').innerHTML = teq == null ? '' :
      (teq > c
        ? `Take the municipal bond. It beats the ${c.toFixed(2)}% taxable bond, which leaves you ${afterTaxCorp.toFixed(2)}% after tax.`
        : `Take the taxable bond. After tax it leaves you ${afterTaxCorp.toFixed(2)}%, against ${m.toFixed(2)}% tax free.`) +
      (breakeven != null && breakeven > 0 && breakeven < 100
        ? ` The two are equal at a tax rate of ${breakeven.toFixed(0)}%.`
        : '');

    const pal = C.palette();
    C.bar(cv, BRACKETS.map(b => b + '%'),
      [{ label: 'Tax-equivalent yield of the muni', data: BRACKETS.map(b => m / (1 - b / 100)),
         colors: BRACKETS.map(b => (Math.abs(b - t * 100) < 3 ? pal[1] : pal[0]) + 'cc') },
       { label: 'The taxable bond on offer', data: BRACKETS.map(() => c), color: pal[2] }],
      { format: v => (D.isNum(v) ? v.toFixed(2) + '%' : '—'),
        xTitle: 'your marginal tax rate', yTitle: 'yield needed to match' });
  }

  [muni, rate, corp].forEach(el => el.addEventListener('input', draw));
  draw();
}

/* ---------------------------------------------------------
   4-4a  The yield curve on a date you choose
   --------------------------------------------------------- */
async function yieldCurve() {
  const fig    = document.getElementById('fig-curve');
  const cv     = document.getElementById('cv-curve');
  const slider = document.getElementById('c-date');
  const out    = document.getElementById('c-date-out');
  const note   = document.getElementById('curve-note');
  let loaded = {}, months = [], compare = 'none';

  function curveAt(period) {
    return CURVE.map(m => {
      const s = loaded[m.key];
      const i = s.periods.indexOf(period);
      return { x: m.years, y: i >= 0 && D.isNum(s.values[i]) ? s.values[i] : null, label: m.label };
    }).filter(p => p.y != null);
  }

  function draw() {
    const idx = Math.min(months.length - 1, Math.max(0, Number(slider.value)));
    const period = months[idx];
    out.textContent = D.prettyPeriod(period);

    const pal = C.palette();
    const main = curveAt(period);
    const series = [{ label: D.prettyPeriod(period), color: pal[0], points: main, width: 2.8, markers: true }];

    if (compare !== 'none') {
      let other = null;
      if (compare === 'latest') other = months[months.length - 1];
      if (compare === 'year') {
        const y = Number(period.slice(0, 4)) - 1;
        const cand = y + '-' + period.slice(5);
        if (months.indexOf(cand) >= 0) other = cand;
      }
      if (other && other !== period) {
        series.push({ label: D.prettyPeriod(other), color: pal[1], dashed: true, width: 2,
                      markers: true, points: curveAt(other) });
      }
    }

    const all = series.flatMap(s => s.points.map(p => p.y));
    const lo = Math.min(...all), hi = Math.max(...all);

    C.diagram(cv, series, {
      xMin: 0, xMax: 31,
      yMin: Math.max(0, Math.floor(lo) - 0.5), yMax: Math.ceil(hi) + 0.5,
      xTitle: 'years to maturity',
      yTitle: 'yield, percent',
      format: v => v.toFixed(2) + '%',
      tooltip: true,
      tipTitle: item => {
        const p = item.raw;
        return p && p.label ? p.label + ' maturity' : '';
      },
      xTickValues: [0.25, 1, 2, 3, 5, 7, 10, 20, 30],
      xTicks: v => (v < 1 ? (v * 12).toFixed(0) + 'm' : v + 'y')
    });

    const short = main.find(p => p.label === '2y') || main[0];
    const long  = main.find(p => p.label === '10y') || main[main.length - 1];
    if (short && long) {
      const gap = long.y - short.y;
      const shape = gap < -0.1 ? 'inverted' : gap < 0.25 ? 'flat' : gap < 1.25 ? 'upward sloping' : 'steep';
      note.textContent = `${D.prettyPeriod(period)}: the 2-year yielded ${short.y.toFixed(2)}% and the 10-year ${long.y.toFixed(2)}%, ` +
        `a gap of ${gap >= 0 ? '+' : ''}${gap.toFixed(2)} points. The curve is ${shape}.`;
    }
  }

  try {
    const keys = CURVE.map(m => m.key);
    const got = await Promise.all(keys.map(k => D.getSeries(k)));
    keys.forEach((k, i) => { loaded[k] = got[i]; });

    // Months for which at least the 2-year and 10-year exist.
    const ref = loaded.T10Y;
    const t2set = new Set(loaded.T2Y.periods.filter((p, i) => D.isNum(loaded.T2Y.values[i])));
    months = ref.periods.filter((p, i) => D.isNum(ref.values[i]) && t2set.has(p) && p >= '1985-01');

    slider.min = 0;
    slider.max = months.length - 1;
    slider.value = months.length - 1;
    slider.addEventListener('input', draw);

    C.toggleGroup(fig.querySelector('[data-toggle="compare"]'), v => { compare = v; draw(); });
    const jump = fig.querySelector('[data-toggle="jump"]');
    jump.querySelectorAll('button[data-value]').forEach(b => {
      b.addEventListener('click', () => {
        const i = months.indexOf(b.dataset.value);
        if (i >= 0) { slider.value = i; draw(); }
      });
    });

    C.setStatus(fig, '');
    draw();
  } catch (e) { fail(fig, e); }
}

/* ---------------------------------------------------------
   4-4c  Implied forward rate
   --------------------------------------------------------- */
function forwardRate() {
  const i1 = document.getElementById('f-i1');
  const i2 = document.getElementById('f-i2');
  const cv = document.getElementById('cv-forward');

  function draw() {
    const a = Number(i1.value) / 100;
    const b = Number(i2.value) / 100;
    document.getElementById('f-i1-out').textContent = Number(i1.value).toFixed(2) + '%';
    document.getElementById('f-i2-out').textContent = Number(i2.value).toFixed(2) + '%';

    const fwd = (Math.pow(1 + b, 2) / (1 + a)) - 1;
    document.getElementById('f-fwd').textContent = (fwd * 100).toFixed(2) + '%';

    const move = fwd - a;
    document.getElementById('f-verdict').textContent =
      Math.abs(move) < 0.0005
        ? 'The market expects the one-year rate to be roughly where it is now.'
        : `The market is pricing in a ${Math.abs(move * 100).toFixed(2)}-point ${move > 0 ? 'rise' : 'fall'} in the one-year rate over the coming year — before any term premium is stripped out.`;

    const start = 100;
    const hold  = [start, start * (1 + b), start * Math.pow(1 + b, 2)];
    const roll  = [start, start * (1 + a), start * (1 + a) * (1 + fwd)];
    C.line(cv, ['now', 'year 1', 'year 2'],
      [{ label: 'Hold a 2-year bond', data: hold },
       { label: 'Roll two 1-year bonds', data: roll, dashed: true, width: 2.4 }],
      { format: v => (D.isNum(v) ? '$' + v.toFixed(2) : '—'),
        yTitle: '$100 invested', forceLegend: true });
  }

  [i1, i2].forEach(el => el.addEventListener('input', draw));

  Promise.all([D.getSeries('T1Y'), D.getSeries('T2Y')]).then(([a, b]) => {
    const la = D.latest(a), lb = D.latest(b);
    i1.value = la.value.toFixed(2);
    i2.value = lb.value.toFixed(2);
    document.getElementById('f-note').textContent =
      `Seeded with ${D.prettyPeriod(lb.period)}: 1-year ${la.value.toFixed(2)}%, 2-year ${lb.value.toFixed(2)}%.`;
    draw();
  }).catch(() => {});

  draw();
}

/* ---------------------------------------------------------
   4-5a  Curve shape and recessions
   --------------------------------------------------------- */
async function spreads() {
  const fig  = document.getElementById('fig-spread');
  const cv   = document.getElementById('cv-spread');
  const note = document.getElementById('spread-note');
  try {
    const [t10, t2, t3m] = await Promise.all([
      D.getSeries('T10Y'), D.getSeries('T2Y'), D.getSeries('T3M')
    ]);
    const s2 = D.since(D.subtract(t10, t2),  '1981-09');
    const s3 = D.since(D.subtract(t10, t3m), '1981-09');
    const m  = D.align([s2, s3]);

    C.line(cv, m.periods,
      [{ label: '10-year minus 2-year', data: m.columns[0] },
       { label: '10-year minus 3-month', data: m.columns[1] }],
      { format: v => (D.isNum(v) ? (v >= 0 ? '+' : '') + v.toFixed(1) + '%' : '—'),
        yTitle: 'percentage points', bands: C.RECESSIONS });

    const inverted = m.columns[0].filter(v => D.isNum(v) && v < 0).length;
    const total = m.columns[0].filter(v => D.isNum(v)).length;
    note.textContent = `Since 1981 the 10-year has been below the 2-year in ${inverted} of ${total} months — ` +
      `about ${(inverted / total * 100).toFixed(0)}% of the time. Inversions are rare, which is why the sample of them is small.`;
    C.setStatus(fig, '');
  } catch (e) { fail(fig, e); }
}

/* ---------------------------------------------------------
   Go
   --------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  statStrip();
  defaultRisk();
  exAnte();
  taxEquivalent();
  yieldCurve();
  forwardRate();
  spreads();
});

})();
