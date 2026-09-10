/* ============================================================
   charts.js — thin Chart.js toolkit shared by every page
   Requires: Chart.js 4 (UMD global) and data.js loaded first.
   ============================================================ */

(function (global) {
"use strict";

const css = (name, fallback) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

/* A brand-neutral categorical palette: distinguishable in both
   themes and for the common forms of colour blindness. */
const PALETTE = ['#1a5b73', '#b4531f', '#4a7c4e', '#7a5ea7', '#a8863c', '#8c8c8c'];
const PALETTE_DARK = ['#6bb6d0', '#e5915c', '#86bf8b', '#b39ddb', '#d6b45e', '#a8a8a8'];

function palette() {
  const dark = global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches;
  return dark ? PALETTE_DARK : PALETTE;
}

function themeColors() {
  return {
    ink:   css('--ink', '#1c1b19'),
    soft:  css('--ink-soft', '#55524d'),
    faint: css('--ink-faint', '#8b8781'),
    rule:  css('--rule', '#e2ded7'),
    panel: css('--bg-panel', '#ffffff')
  };
}

/* Shade date ranges (recessions, say) behind a category-axis chart.
   Registered once; activated per chart through opts.bands. */
const bandsPlugin = {
  id: 'mbBands',
  beforeDatasetsDraw(chart) {
    const cfg = chart.options.plugins && chart.options.plugins.mbBands;
    if (!cfg || !cfg.bands || !cfg.bands.length) return;
    const labels = chart.data.labels || [];
    if (!labels.length) return;
    const { ctx, chartArea, scales } = chart;
    ctx.save();
    ctx.fillStyle = cfg.color || 'rgba(128,128,128,0.13)';
    for (const b of cfg.bands) {
      let i0 = labels.findIndex(l => l >= b.from);
      if (i0 < 0) continue;
      let i1 = labels.findIndex(l => l >= b.to);
      if (i1 < 0) i1 = labels.length - 1;
      const x0 = scales.x.getPixelForValue(i0);
      const x1 = scales.x.getPixelForValue(i1);
      ctx.fillRect(x0, chartArea.top, Math.max(1, x1 - x0), chartArea.bottom - chartArea.top);
    }
    ctx.restore();
  }
};
if (global.Chart) Chart.register(bandsPlugin);

/* Peak-to-trough months of U.S. business cycle contractions as dated by
   the National Bureau of Economic Research. */
const RECESSIONS = [
  { from: '1948-11', to: '1949-10' }, { from: '1953-07', to: '1954-05' },
  { from: '1957-08', to: '1958-04' }, { from: '1960-04', to: '1961-02' },
  { from: '1969-12', to: '1970-11' }, { from: '1973-11', to: '1975-03' },
  { from: '1980-01', to: '1980-07' }, { from: '1981-07', to: '1982-11' },
  { from: '1990-07', to: '1991-03' }, { from: '2001-03', to: '2001-11' },
  { from: '2007-12', to: '2009-06' }, { from: '2020-02', to: '2020-04' }
];

/* Show a message in place of a chart. */
function setStatus(fig, msg, isError) {
  const box = fig.querySelector('.chart-status');
  if (!box) return;
  box.textContent = msg || '';
  box.style.display = msg ? 'flex' : 'none';
  box.classList.toggle('err', !!isError);
}

/* Thin out x-axis labels so a 70-year monthly series stays readable. */
function tickCallback(labels) {
  return function (value, index) {
    const step = Math.max(1, Math.round(labels.length / 8));
    if (index % step !== 0) return null;
    const p = labels[index];
    return /^\d{4}/.test(p) ? p.slice(0, 4) : p;
  };
}

/* Build (or rebuild) a line chart on a canvas. */
function line(canvas, labels, datasets, opts) {
  opts = opts || {};
  const t = themeColors();
  const pal = palette();

  if (canvas._mbChart) canvas._mbChart.destroy();

  const hasY2 = datasets.some(d => d.axis === 'y2');

  const ds = datasets.map((d, i) => Object.assign({
    yAxisID: d.axis === 'y2' ? 'y2' : 'y',
    borderColor: d.color || pal[i % pal.length],
    backgroundColor: d.fill
      ? (d.color || pal[i % pal.length]) + (opts.fillAlpha || '33')
      : (d.color || pal[i % pal.length]),
    borderWidth: d.width || 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.15,
    spanGaps: true,
    fill: d.fill || false
  }, d));

  const fmt = opts.format || (v => v);

  const scales = {
    x: {
      grid: { display: false },
      border: { color: t.rule },
      ticks: {
        color: t.faint, font: { size: 11 }, maxRotation: 0, autoSkip: false,
        callback: tickCallback(labels)
      },
      title: opts.xTitle
        ? { display: true, text: opts.xTitle, color: t.faint, font: { size: 11 } }
        : undefined
    },
    y: {
      type: opts.log ? 'logarithmic' : 'linear',
      grid: { color: t.rule, drawTicks: false },
      border: { display: false },
      ticks: { color: t.faint, font: { size: 11 }, padding: 8, callback: v => fmt(v) },
      title: opts.yTitle
        ? { display: true, text: opts.yTitle, color: t.faint, font: { size: 11 } }
        : undefined
    }
  };

  /* Only declare the right-hand axis when a dataset actually uses it —
     Chart.js rejects a scale entry set to undefined. */
  if (hasY2) {
    scales.y2 = {
      position: 'right',
      grid: { drawOnChartArea: false },
      border: { display: false },
      ticks: {
        color: t.faint, font: { size: 11 }, padding: 8,
        callback: v => (opts.format2 || fmt)(v)
      },
      title: opts.y2Title
        ? { display: true, text: opts.y2Title, color: t.faint, font: { size: 11 } }
        : undefined
    };
  }

  const chartPlugins = {
    legend: {
      display: datasets.length > 1 || opts.forceLegend,
      position: 'top',
      align: 'end',
      labels: {
        boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded',
        color: t.soft, font: { size: 12 }, padding: 14
      }
    },
    tooltip: {
      backgroundColor: t.panel,
      titleColor: t.ink,
      bodyColor: t.soft,
      borderColor: t.rule,
      borderWidth: 1,
      padding: 10,
      displayColors: true,
      callbacks: {
        title: items => global.MBData.prettyPeriod(items[0].label),
        label: item => {
          const f = item.dataset.yAxisID === 'y2' && opts.format2 ? opts.format2 : fmt;
          return ` ${item.dataset.label}: ${f(item.parsed.y)}`;
        }
      }
    }
  };
  if (opts.bands) chartPlugins.mbBands = { bands: opts.bands, color: opts.bandColor };

  canvas._mbChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets: ds },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 350 },
      layout: { padding: { top: 4 } },
      plugins: chartPlugins,
      scales
    }
  });
  return canvas._mbChart;
}

/* Vertical bar chart, for comparisons rather than time series. */
function bar(canvas, labels, datasets, opts) {
  opts = opts || {};
  const t = themeColors();
  const pal = palette();
  if (canvas._mbChart) canvas._mbChart.destroy();
  const fmt = opts.format || (v => v);

  canvas._mbChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map((d, i) => Object.assign({
        backgroundColor: d.colors || (d.color || pal[i % pal.length]) + 'cc',
        borderColor: d.colors || d.color || pal[i % pal.length],
        borderWidth: 1,
        borderRadius: 4,
        maxBarThickness: opts.maxBarThickness || 70
      }, d))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: opts.horizontal ? 'y' : 'x',
      plugins: {
        legend: {
          display: datasets.length > 1,
          position: 'top', align: 'end',
          labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded',
                    color: t.soft, font: { size: 12 }, padding: 14 }
        },
        tooltip: {
          backgroundColor: t.panel, titleColor: t.ink, bodyColor: t.soft,
          borderColor: t.rule, borderWidth: 1, padding: 10,
          callbacks: { label: item => ` ${item.dataset.label}: ${fmt(opts.horizontal ? item.parsed.x : item.parsed.y)}` }
        }
      },
      scales: {
        x: {
          grid: { display: !!opts.horizontal, color: t.rule, drawTicks: false },
          border: { color: t.rule },
          ticks: { color: t.faint, font: { size: 11 },
                   callback: opts.horizontal ? (v => fmt(v)) : undefined },
          title: opts.xTitle ? { display: true, text: opts.xTitle, color: t.faint, font: { size: 11 } } : undefined
        },
        y: {
          grid: { display: !opts.horizontal, color: t.rule, drawTicks: false },
          border: { display: false },
          ticks: { color: t.faint, font: { size: 11 }, padding: 8,
                   callback: opts.horizontal ? undefined : (v => fmt(v)) },
          title: opts.yTitle ? { display: true, text: opts.yTitle, color: t.faint, font: { size: 11 } } : undefined
        }
      }
    }
  });
  return canvas._mbChart;
}

/* Straight-line supply and demand style diagram on a numeric x axis.
   Each series is {label, points:[{x,y}], color, dashed}. */
function diagram(canvas, series, opts) {
  opts = opts || {};
  const t = themeColors();
  const pal = palette();
  if (canvas._mbChart) canvas._mbChart.destroy();

  canvas._mbChart = new Chart(canvas.getContext('2d'), {
    type: 'scatter',
    data: {
      datasets: series.map((s, i) => ({
        label: s.label,
        data: s.points,
        borderColor: s.color || pal[i % pal.length],
        backgroundColor: s.color || pal[i % pal.length],
        borderWidth: s.width || 2.4,
        borderDash: s.dashed ? [6, 4] : undefined,
        pointRadius: s.point ? 5 : (s.markers ? 3.5 : 0),
        pointHoverRadius: s.point ? 7 : (s.markers ? 6 : 0),
        showLine: !s.point,
        fill: false
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 450 },
      plugins: {
        legend: {
          display: true, position: 'top', align: 'end',
          labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'line',
                    color: t.soft, font: { size: 11.5 }, padding: 12,
                    filter: item => !/^_/.test(item.text) }
        },
        tooltip: opts.tooltip ? {
          backgroundColor: t.panel, titleColor: t.ink, bodyColor: t.soft,
          borderColor: t.rule, borderWidth: 1, padding: 10,
          callbacks: {
            title: items => (opts.tipTitle ? opts.tipTitle(items[0]) : ''),
            label: item => ` ${item.dataset.label}: ${(opts.format || (v => v))(item.parsed.y)}`
          }
        } : { enabled: false }
      },
      scales: {
        x: {
          min: opts.xMin, max: opts.xMax,
          type: opts.xLog ? 'logarithmic' : 'linear',
          grid: { display: false }, border: { color: t.rule },
          ticks: opts.xTicks
            ? { color: t.faint, font: { size: 11 }, autoSkip: false,
                callback: opts.xTicks, includeBounds: false }
            : { display: false },
          afterBuildTicks: opts.xTickValues
            ? (axis => { axis.ticks = opts.xTickValues.map(v => ({ value: v })); })
            : undefined,
          title: { display: true, text: opts.xTitle || '', color: t.faint, font: { size: 11 } }
        },
        y: {
          min: opts.yMin, max: opts.yMax,
          reverse: !!opts.reverseY,
          grid: { color: t.rule, drawTicks: false }, border: { display: false },
          ticks: { color: t.faint, font: { size: 11 }, padding: 6,
                   callback: opts.format || (v => v) },
          title: { display: true, text: opts.yTitle || '', color: t.faint, font: { size: 11 } }
        }
      }
    }
  });
  return canvas._mbChart;
}

/* Scatter with an optional ordinary-least-squares fit line. */
function scatter(canvas, points, opts) {
  opts = opts || {};
  const t = themeColors();
  const pal = palette();
  if (canvas._mbChart) canvas._mbChart.destroy();

  const clean = points.filter(p => p.x != null && p.y != null && isFinite(p.x) && isFinite(p.y));
  const datasets = [{
    label: opts.label || 'Observations',
    data: clean,
    backgroundColor: pal[0] + '99',
    borderColor: 'transparent',
    pointRadius: 3,
    pointHoverRadius: 6,
    showLine: false
  }];

  let fitText = '';
  if (opts.fit && clean.length > 2) {
    const n = clean.length;
    const sx = clean.reduce((a, p) => a + p.x, 0);
    const sy = clean.reduce((a, p) => a + p.y, 0);
    const sxx = clean.reduce((a, p) => a + p.x * p.x, 0);
    const sxy = clean.reduce((a, p) => a + p.x * p.y, 0);
    const syy = clean.reduce((a, p) => a + p.y * p.y, 0);
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const intercept = (sy - slope * sx) / n;
    const r = (n * sxy - sx * sy) / Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
    const xs = clean.map(p => p.x);
    const lo = Math.min(...xs), hi = Math.max(...xs);
    datasets.push({
      label: 'Line of best fit',
      data: [{ x: lo, y: intercept + slope * lo }, { x: hi, y: intercept + slope * hi }],
      borderColor: pal[1],
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 0,
      showLine: true,
      fill: false
    });
    fitText = `slope = ${slope.toFixed(2)},  correlation r = ${r.toFixed(2)},  n = ${n}`;
  }

  canvas._mbChart = new Chart(canvas.getContext('2d'), {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: t.panel, titleColor: t.ink, bodyColor: t.soft,
          borderColor: t.rule, borderWidth: 1, padding: 10,
          callbacks: {
            label: item => {
              const p = clean[item.dataIndex];
              const when = p && p.period ? global.MBData.prettyPeriod(p.period) + ' — ' : '';
              return ` ${when}${opts.xLabel}: ${item.parsed.x.toFixed(1)}%,  ${opts.yLabel}: ${item.parsed.y.toFixed(1)}%`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: opts.xLabel, color: t.faint, font: { size: 11 } },
          grid: { color: t.rule, drawTicks: false }, border: { display: false },
          ticks: { color: t.faint, font: { size: 11 }, callback: v => v + '%' }
        },
        y: {
          title: { display: true, text: opts.yLabel, color: t.faint, font: { size: 11 } },
          grid: { color: t.rule, drawTicks: false }, border: { display: false },
          ticks: { color: t.faint, font: { size: 11 }, callback: v => v + '%' }
        }
      }
    }
  });
  return { chart: canvas._mbChart, fitText };
}

/* Wire a group of toggle buttons. onPick receives the chosen value. */
function toggleGroup(root, onPick) {
  const buttons = [...root.querySelectorAll('button[data-value]')];
  buttons.forEach(b => {
    b.addEventListener('click', () => {
      buttons.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      onPick(b.dataset.value);
    });
  });
  const active = buttons.find(b => b.getAttribute('aria-pressed') === 'true') || buttons[0];
  if (active) active.setAttribute('aria-pressed', 'true');
  return active ? active.dataset.value : null;
}

global.MBChart = { line, bar, scatter, diagram, setStatus, toggleGroup, palette, RECESSIONS };

})(window);
