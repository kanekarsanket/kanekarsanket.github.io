/* ============================================================
   ch03.js — wiring for Chapter 3
   ============================================================ */

(function () {
"use strict";

const D = window.MBData;
const C = window.MBChart;

const pct  = (v, dp) => (D.isNum(v) ? v.toFixed(dp == null ? 2 : dp) + '%' : '—');
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fail(fig, err) {
  console.error(err);
  C.setStatus(fig, 'Could not reach the data service. Reload the page, or use the FRED links below the chart to download the series directly.', true);
}

/* ---------------------------------------------------------
   Bond arithmetic
   --------------------------------------------------------- */

/* Price of a bond paying an annual coupon, discounted at ytm
   (both rates as decimals). */
function bondPrice(face, couponRate, years, ytm) {
  const c = face * couponRate;
  if (Math.abs(ytm) < 1e-9) return c * years + face;
  const disc = Math.pow(1 + ytm, -years);
  return c * (1 - disc) / ytm + face * disc;
}

/* The payment a holder receives in each year of the bond's life. */
function cashFlows(face, couponRate, years) {
  const c = face * couponRate;
  const out = [];
  for (let t = 1; t <= years; t++) out.push(t === years ? c + face : c);
  return out;
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
    const [t2, t10, t30, tips] = await Promise.all([
      D.getSeries('T2Y'), D.getSeries('T10Y'), D.getSeries('T30Y'), D.getSeries('TIPS10')
    ]);
    const l2 = D.latest(t2), l10 = D.latest(t10), l30 = D.latest(t30), lt = D.latest(tips);
    put('t2',   pct(l2.value),   D.prettyPeriod(l2.period));
    put('t10',  pct(l10.value),  D.prettyPeriod(l10.period));
    put('t30',  pct(l30.value),  D.prettyPeriod(l30.period));
    put('tips', pct(lt.value),   D.prettyPeriod(lt.period) + ' · TIPS');

    const be = D.subtract(t10, tips);
    const lbe = D.latest(be);
    put('be', pct(lbe.value), '10-year, from market prices');

    window.__t10 = l10;                    // seeds the bond builder
  } catch (e) {
    console.error(e);
    ['t2','t10','t30','tips','be'].forEach(k => {
      const el = document.querySelector(`[data-stat="${k}"]`);
      if (el) { el.textContent = 'unavailable'; el.classList.remove('loading'); }
    });
  }

  try {
    const debt = await D.getSeries('DEBT');
    const l = D.latest(debt);
    const el = document.querySelector('[data-stat="debt"]');
    const m  = document.querySelector('[data-stat="debt-meta"]');
    if (el) { el.textContent = '$' + (l.value / 1000).toFixed(1) + 'T'; el.classList.remove('loading'); }
    if (m) m.textContent = D.prettyPeriod(l.period);
  } catch (e) {
    const el = document.querySelector('[data-stat="debt"]');
    if (el) { el.textContent = 'unavailable'; el.classList.remove('loading'); }
  }
}

/* ---------------------------------------------------------
   3-1 / 3-2  Bond builder
   --------------------------------------------------------- */
function bondBuilder() {
  const face   = document.getElementById('b-face');
  const coupon = document.getElementById('b-coupon');
  const years  = document.getElementById('b-years');
  const ytm    = document.getElementById('b-ytm');
  const cv     = document.getElementById('cv-builder');
  const fig    = document.getElementById('fig-builder');
  let view = 'flows';

  function draw() {
    const F = Number(face.value) || 1000;
    const c = Number(coupon.value) / 100;
    const n = Number(years.value);
    const y = Number(ytm.value) / 100;

    document.getElementById('b-coupon-out').textContent = Number(coupon.value).toFixed(2) + '%';
    document.getElementById('b-years-out').textContent  = n;
    document.getElementById('b-ytm-out').textContent    = Number(ytm.value).toFixed(1) + '%';

    const price = bondPrice(F, c, n, y);
    document.getElementById('b-price').textContent = usd2.format(price);

    const gap = price - F;
    const verdict = Math.abs(gap) < 0.5
      ? 'At par: the coupon matches what the market demands.'
      : gap > 0
        ? `A premium of ${usd2.format(gap)}: the coupon beats the market, so buyers pay above face.`
        : `A discount of ${usd2.format(-gap)}: the coupon lags the market, so it only sells below face.`;
    document.getElementById('b-verdict').textContent = verdict;

    const currentYield = (F * c) / price * 100;
    document.getElementById('b-detail').innerHTML =
      `Annual coupon <strong>${usd0.format(F * c)}</strong> &middot; total promised over ${n} year${n === 1 ? '' : 's'} ` +
      `<strong>${usd0.format(F * c * n + F)}</strong><br>` +
      `Current yield (coupon ÷ price) <strong>${currentYield.toFixed(2)}%</strong>, against a yield to maturity of ` +
      `<strong>${Number(ytm.value).toFixed(1)}%</strong>.`;

    if (view === 'flows') {
      const flows = cashFlows(F, c, n);
      const pal = C.palette();
      C.bar(cv, flows.map((_, i) => String(i + 1)),
        [{ label: 'Payment received', data: flows,
           colors: flows.map((_, i) => (i === flows.length - 1 ? pal[1] : pal[0]) + 'cc') }],
        { format: v => usd0.format(v), xTitle: 'year', yTitle: 'dollars paid to the holder' });
    } else {
      const xs = [], ps = [];
      for (let r = 0; r <= 15; r += 0.25) { xs.push(r.toFixed(2)); ps.push(bondPrice(F, c, n, r / 100)); }
      C.line(cv, xs, [{ label: 'Price', data: ps, fill: true }], {
        format: v => usd0.format(v), forceLegend: false,
        xTitle: 'market yield, percent', yTitle: 'price'
      });
    }
    C.setStatus(fig, '');
  }

  [face, coupon, years, ytm].forEach(el => el.addEventListener('input', draw));
  C.toggleGroup(fig.querySelector('[data-toggle="view"]'), v => { view = v; draw(); });

  const seed = setInterval(() => {
    if (window.__t10) {
      clearInterval(seed);
      ytm.value = window.__t10.value.toFixed(1);
      document.getElementById('b-ytm-note').textContent =
        `Starting point: the 10-year Treasury yield in ${D.prettyPeriod(window.__t10.period)} was ${window.__t10.value.toFixed(2)}%.`;
      draw();
    }
  }, 250);
  setTimeout(() => clearInterval(seed), 15000);

  draw();
}

/* ---------------------------------------------------------
   3-2c  Price and yield are the same fact
   --------------------------------------------------------- */
async function seesaw() {
  const fig = document.getElementById('fig-seesaw');
  const cv  = document.getElementById('cv-seesaw');
  let from = '1990-01', t10;

  function draw() {
    const s = D.since(t10, from);
    const prices = s.values.map(v => (D.isNum(v) ? bondPrice(1000, 0.04, 10, v / 100) : null));
    C.line(cv, s.periods,
      [{ label: '10-year Treasury yield', data: s.values },
       { label: 'Price of a 4% ten-year bond', data: prices, axis: 'y2' }],
      {
        format:  v => (D.isNum(v) ? v.toFixed(1) + '%' : '—'),
        format2: v => (D.isNum(v) ? usd0.format(v) : '—'),
        yTitle: 'yield, percent',
        y2Title: 'price of the bond'
      });
    C.setStatus(fig, '');
  }

  try {
    t10 = await D.getSeries('T10Y');
    C.toggleGroup(fig.querySelector('[data-toggle="from"]'), v => { from = v; draw(); });
    draw();
  } catch (e) { fail(fig, e); }
}

/* ---------------------------------------------------------
   3-2d  Interest-rate risk by maturity
   --------------------------------------------------------- */
function rateRisk() {
  const slider = document.getElementById('r-shock');
  const out    = document.getElementById('r-shock-out');
  const note   = document.getElementById('risk-note');
  const cv     = document.getElementById('cv-risk');
  const MATS   = [2, 5, 10, 30];
  const BASE   = 0.04;

  function draw() {
    const shock = Number(slider.value);
    out.textContent = (shock >= 0 ? '+' : '') + shock.toFixed(2) + ' points';

    const pal = C.palette();
    const changes = MATS.map(m => {
      const p0 = bondPrice(1000, BASE, m, BASE);
      const p1 = bondPrice(1000, BASE, m, BASE + shock / 100);
      return (p1 / p0 - 1) * 100;
    });

    C.bar(cv, MATS.map(m => m + '-year'),
      [{ label: 'Change in price', data: changes,
         colors: changes.map(v => (v < 0 ? pal[1] : pal[2]) + 'cc') }],
      { format: v => (v >= 0 ? '+' : '') + v.toFixed(1) + '%',
        xTitle: 'years to maturity', yTitle: 'change in price' });

    const worst = changes[changes.length - 1];
    note.textContent = shock === 0
      ? 'With yields unchanged, every bond still trades at par. Move the slider.'
      : `A ${Math.abs(shock).toFixed(2)}-point ${shock > 0 ? 'rise' : 'fall'} in market yields changes the two-year bond's price by ` +
        `${changes[0] >= 0 ? '+' : ''}${changes[0].toFixed(1)}% and the thirty-year bond's by ${worst >= 0 ? '+' : ''}${worst.toFixed(1)}% — ` +
        `roughly ${Math.abs(worst / changes[0]).toFixed(0)} times as much, from identical news.`;
  }

  slider.addEventListener('input', draw);
  draw();
}

/* ---------------------------------------------------------
   3-3 / 3-4  Twin market diagram
   ---------------------------------------------------------
   Everything is computed in the loanable funds panel, where the
   interest rate is the vertical axis, and then translated into
   the bond market panel using the price of a perpetuity paying
   $50 a year: P = 5000 / i (i in percent). At i = 5%, P = $1,000.
   That keeps the two panels exactly consistent instead of merely
   telling the reader that they are.
   --------------------------------------------------------- */
function twinMarkets() {
  const fig  = document.getElementById('fig-market');
  const cvB  = document.getElementById('cv-bond');
  const cvL  = document.getElementById('cv-lf');
  const text = document.getElementById('shock-text');

  const BASE_I = 5, BASE_Q = 100, SLOPE = 14;   // quantity per percentage point

  const SHOCKS = {
    none:      { dS: 0,   dD: 0,   label: 'no shock' },
    deficit:   { dS: 0,   dD: 30,
      text: '<strong>The government borrows more.</strong> A deficit has to be financed by selling bonds, so the supply of bonds shifts right — equivalently, the demand for loanable funds shifts right. Bond prices fall and the interest rate rises. Private borrowers who would have funded projects at the old rate now do not: this is crowding out, and this diagram is where the argument lives.' },
    inflation: { dS: -25, dD: 25,
      text: '<strong>Expected inflation rises.</strong> Borrowers like the idea of repaying in cheaper dollars, so they issue more bonds and demand more funds. Lenders dislike it for the same reason, so they buy fewer bonds and supply fewer funds. The two shifts reinforce each other on price and cancel on quantity, which is why the interest rate does nearly all the adjusting. Push this far enough and you have the Fisher effect in section 3-5a.' },
    wealth:    { dS: 30,  dD: 0,
      text: '<strong>Savers get wealthier.</strong> More wealth means more of every asset bought, bonds included, so the demand for bonds shifts right and the supply of loanable funds shifts right. Bond prices rise and the interest rate falls. More borrowing happens, at a lower cost.' },
    recession: { dS: 15,  dD: -25,
      text: '<strong>A recession.</strong> Firms see fewer projects worth funding and stop issuing, so bond supply and funds demand shift left. Savers simultaneously want safety, so bond demand and funds supply shift right. Both moves push the interest rate down, which is why rates fall in slumps without anyone deciding that they should. Quantity falls because the demand shift is the larger one.' },
    risk:      { dS: -30, dD: 0,
      text: '<strong>These bonds become likelier to default.</strong> Lenders retreat: bond demand shifts left, funds supply shifts left. Bond prices fall and the yield rises. Note carefully what this is not — nothing has changed about the payments the bond promises, only the chance of receiving them. Chapter 4 turns this gap into the risk structure of interest rates.' }
  };

  function equilibrium(sh) {
    // Qs = BASE_Q + SLOPE*(i - BASE_I) + dS ; Qd = BASE_Q - SLOPE*(i - BASE_I) + dD
    const i = BASE_I + (sh.dD - sh.dS) / (2 * SLOPE);
    const q = BASE_Q + SLOPE * (i - BASE_I) + sh.dS;
    return { i, q };
  }

  const priceOf = i => 5000 / i;

  function draw(key) {
    const sh   = SHOCKS[key] || SHOCKS.none;
    const base = SHOCKS.none;
    const eq   = equilibrium(sh);
    const eq0  = equilibrium(base);
    const pal  = C.palette();

    const grid = [];
    for (let i = 3.3; i <= 7.7001; i += 0.1) grid.push(Number(i.toFixed(2)));

    const supplyQ = (i, s) => BASE_Q + SLOPE * (i - BASE_I) + s.dS;
    const demandQ = (i, s) => BASE_Q - SLOPE * (i - BASE_I) + s.dD;

    /* ---- loanable funds panel: interest rate on the vertical axis ---- */
    const lfSeries = [
      { label: 'Supply of funds', color: pal[0], points: grid.map(i => ({ x: supplyQ(i, sh), y: i })) },
      { label: 'Demand for funds', color: pal[1], points: grid.map(i => ({ x: demandQ(i, sh), y: i })) }
    ];
    if (key !== 'none') {
      if (sh.dS !== 0) lfSeries.push({ label: '_s0', color: pal[0], dashed: true, width: 1.4,
        points: grid.map(i => ({ x: supplyQ(i, base), y: i })) });
      if (sh.dD !== 0) lfSeries.push({ label: '_d0', color: pal[1], dashed: true, width: 1.4,
        points: grid.map(i => ({ x: demandQ(i, base), y: i })) });
      lfSeries.push({ label: '_old', color: pal[5], point: true, points: [{ x: eq0.q, y: eq0.i }] });
    }
    lfSeries.push({ label: `Equilibrium: ${eq.i.toFixed(2)}%`, color: pal[3], point: true,
                    points: [{ x: eq.q, y: eq.i }] });

    C.diagram(cvL, lfSeries, {
      xMin: 40, xMax: 175, yMin: 3.3, yMax: 7.7,
      xTitle: 'quantity of loanable funds', yTitle: 'interest rate',
      format: v => v.toFixed(1) + '%'
    });

    /* ---- bond panel: bond price on the vertical axis ---- */
    const pGrid = grid.map(priceOf);
    const bondSeries = [
      { label: 'Demand for bonds', color: pal[0], points: grid.map(i => ({ x: supplyQ(i, sh), y: priceOf(i) })) },
      { label: 'Supply of bonds',  color: pal[1], points: grid.map(i => ({ x: demandQ(i, sh), y: priceOf(i) })) }
    ];
    if (key !== 'none') {
      if (sh.dS !== 0) bondSeries.push({ label: '_bd0', color: pal[0], dashed: true, width: 1.4,
        points: grid.map(i => ({ x: supplyQ(i, base), y: priceOf(i) })) });
      if (sh.dD !== 0) bondSeries.push({ label: '_bs0', color: pal[1], dashed: true, width: 1.4,
        points: grid.map(i => ({ x: demandQ(i, base), y: priceOf(i) })) });
      bondSeries.push({ label: '_oldb', color: pal[5], point: true, points: [{ x: eq0.q, y: priceOf(eq0.i) }] });
    }
    bondSeries.push({ label: `Equilibrium: ${usd0.format(priceOf(eq.i))}`, color: pal[3], point: true,
                      points: [{ x: eq.q, y: priceOf(eq.i) }] });

    C.diagram(cvB, bondSeries, {
      xMin: 40, xMax: 175, yMin: Math.min(...pGrid), yMax: Math.max(...pGrid),
      xTitle: 'quantity of bonds', yTitle: 'price of a bond',
      format: v => usd0.format(v)
    });

    if (key === 'none') {
      text.innerHTML = 'The starting point: an interest rate of 5.00% and a bond price of $1,000. ' +
        'Pick a shock and both panels move together, because they are two descriptions of one market. ' +
        'Dashed lines mark where the curves were, and the grey dot the equilibrium they used to produce.';
    } else {
      const dI = eq.i - eq0.i;
      const dP = priceOf(eq.i) - priceOf(eq0.i);
      text.innerHTML = sh.text +
        `<br><br><span style="color:var(--ink-soft)">Result: the interest rate moves from ${eq0.i.toFixed(2)}% to ` +
        `<strong>${eq.i.toFixed(2)}%</strong> (${dI >= 0 ? '+' : ''}${dI.toFixed(2)} points) and the bond price from ` +
        `${usd0.format(priceOf(eq0.i))} to <strong>${usd0.format(priceOf(eq.i))}</strong> ` +
        `(${dP >= 0 ? '+' : ''}${usd0.format(dP)}).</span>`;
    }
  }

  C.toggleGroup(fig.querySelector('[data-toggle="shock"]'), draw);
  draw('none');
}

/* ---------------------------------------------------------
   3-3b  Government borrowing and the long rate
   --------------------------------------------------------- */
async function debtChart() {
  const fig = document.getElementById('fig-debt');
  const cv  = document.getElementById('cv-debt');
  try {
    const [debt, t10] = await Promise.all([D.getSeries('DEBT'), D.getSeries('T10Y')]);
    const m = D.align([D.since(debt, '1997-09'), D.since(t10, '1997-09')]);
    C.line(cv, m.periods,
      [{ label: 'Debt held by the public', data: m.columns[0] },
       { label: '10-year Treasury yield', data: m.columns[1], axis: 'y2' }],
      {
        format:  v => (D.isNum(v) ? '$' + (v / 1000).toFixed(0) + 'T' : '—'),
        format2: v => (D.isNum(v) ? v.toFixed(1) + '%' : '—'),
        yTitle: 'debt outstanding', y2Title: 'yield, percent'
      });
    C.setStatus(fig, '');
  } catch (e) { fail(fig, e); }
}

/* ---------------------------------------------------------
   3-5a  The Fisher equation in market prices
   --------------------------------------------------------- */
async function fisher() {
  const fig = document.getElementById('fig-fisher');
  const cv  = document.getElementById('cv-fisher');
  let view = 'all', nominal, real, breakeven;

  function draw() {
    const m = D.align([nominal, real, breakeven]);
    const fmt = v => (D.isNum(v) ? v.toFixed(2) + '%' : '—');
    if (view === 'all') {
      C.line(cv, m.periods,
        [{ label: 'Nominal 10-year yield', data: m.columns[0] },
         { label: 'Real 10-year yield (TIPS)', data: m.columns[1] },
         { label: 'Breakeven inflation', data: m.columns[2], width: 2.5 }],
        { format: fmt, yTitle: 'percent per year' });
    } else {
      C.line(cv, m.periods,
        [{ label: 'Breakeven inflation, 10-year', data: m.columns[2], fill: true, color: C.palette()[2] }],
        { format: fmt, forceLegend: true, yTitle: 'percent per year' });
    }
    C.setStatus(fig, '');
  }

  try {
    const [n, r] = await Promise.all([D.getSeries('T10Y'), D.getSeries('TIPS10')]);
    real = D.since(r, '2003-01');
    nominal = D.since(n, '2003-01');
    breakeven = D.subtract(nominal, real);
    C.toggleGroup(fig.querySelector('[data-toggle="view"]'), v => { view = v; draw(); });
    draw();
  } catch (e) { fail(fig, e); }
}

/* ---------------------------------------------------------
   3-5b  The term spread, with recessions marked
   --------------------------------------------------------- */
async function spread() {
  const fig = document.getElementById('fig-spread');
  const cv  = document.getElementById('cv-spread');
  try {
    const [t10, t2] = await Promise.all([D.getSeries('T10Y'), D.getSeries('T2Y')]);
    const s = D.since(D.subtract(t10, t2), '1976-06');
    C.line(cv, s.periods,
      [{ label: '10-year minus 2-year Treasury yield', data: s.values, fill: true }],
      {
        format: v => (D.isNum(v) ? (v >= 0 ? '+' : '') + v.toFixed(1) + '%' : '—'),
        forceLegend: true,
        yTitle: 'percentage points',
        bands: C.RECESSIONS
      });
    C.setStatus(fig, '');
  } catch (e) { fail(fig, e); }
}

/* ---------------------------------------------------------
   Go
   --------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  statStrip();
  bondBuilder();
  seesaw();
  rateRisk();
  twinMarkets();
  debtChart();
  fisher();
  spread();
});

})();
