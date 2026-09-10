# Money & Banking with Live Data

A course companion for money, banking and financial markets. Each chapter
pairs plain-language explanations with charts that pull the current official
release every time the page loads, and with step-by-step Excel walkthroughs so
a reader can rebuild every figure themselves.

**Chapters 2, 3, 4 and 6 are complete.** Chapters 1 and 5 are outlined and
being written.

To publish this, follow **[SETUP-GITHUB.md](SETUP-GITHUB.md)** — it assumes no
prior experience with Git or GitHub.

---

## What is in the box

```
index.html            Landing page and chapter map
chapter-01.html       Introduction (outline)
chapter-02.html       Money, Money Supply, and Interest (complete)
chapter-03.html       Bonds and Loanable Funds (complete)
chapter-04.html       Interest Rates in More Detail (complete)
chapter-05.html       Financial Markets through Time (outline)
chapter-06.html       Aggregate Supply and Aggregate Demand (complete)
.nojekyll             Tells GitHub Pages to serve the files as they are
assets/
  css/style.css       All styling, light and dark
  js/data.js          Fetches and transforms the live series
  js/charts.js        A thin wrapper over Chart.js: lines, bars, scatters,
                      supply-and-demand diagrams, recession shading
  js/ch02.js          Wiring for Chapter 2
  js/ch03.js          Wiring for Chapter 3
  js/ch04.js          Wiring for Chapter 4
  js/ch06.js          Wiring for Chapter 6
  js/chart.umd.js     Chart.js 4.4.1, bundled so the site needs no CDN
```

There is no build step and no dependencies to install. Every file is served
exactly as it sits in the repository.

---

## Where the data comes from

Charts fetch live from three public services. None needs an account or a key.

| Source | Supplies |
| --- | --- |
| [DBnomics](https://db.nomics.world/) | Federal Reserve H.6 (money stock), H.15 (interest rates, the whole Treasury curve and TIPS), BEA national accounts |
| [BLS public API](https://www.bls.gov/developers/) | Consumer Price Index and unemployment rate, most recent three years |
| [Treasury Fiscal Data](https://fiscaldata.treasury.gov/) | Federal debt held by the public, daily since 1997 |
| — | Long CPI and unemployment histories come through the DBnomics BLS mirror and are spliced with the BLS API for recent months |

Two series used in Chapter 4 — Moody's Aaa and Baa corporate bond yields — are
not carried by any of these, so the credit-spread exercise there is a
download-and-build one with instructions rather than a live chart.

### Why not FRED?

FRED would be the obvious choice, and every chart links to its FRED page so a
reader can download the underlying series in one click. But FRED's API cannot
be used from inside a web page: it requires an API key, which would have to
sit in plain text in `data.js` where anyone could take it, and its servers do
not send the CORS headers a browser needs to allow a cross-site request. The
request fails before it leaves the reader's machine.

DBnomics mirrors the same official releases, allows browser requests, and
needs no key — so the page fetches from the mirror and points the reader at
FRED.

---

## Adding a chart

`assets/js/data.js` holds the series catalogue. Add an entry:

```js
UNRATE: { id: 'BLS/ln/LNS14000000', label: 'Unemployment rate', unit: '%', fred: 'UNRATE' },
```

The `id` is a DBnomics path in the form `PROVIDER/DATASET/SERIES`. To find one,
search <https://db.nomics.world>, open the series, and read the code from its
page.

Then in the chapter's HTML add a figure:

```html
<figure class="chart" id="fig-unemployment">
  <figcaption>Unemployment</figcaption>
  <div class="sub">Percent of the labour force, monthly.</div>
  <div class="canvas-box">
    <canvas id="cv-unemployment"></canvas>
    <div class="chart-status">Loading live data…</div>
  </div>
</figure>
```

And in the chapter's JS:

```js
const s = await MBData.getSeries('UNRATE');
MBChart.line(document.getElementById('cv-unemployment'), s.periods,
  [{ label: 'Unemployment rate', data: s.values }],
  { format: v => v.toFixed(1) + '%', yTitle: 'percent' });
MBChart.setStatus(document.getElementById('fig-unemployment'), '');
```

Useful transformations in `MBData`: `yoy(series)`, `growthOver(series, months)`,
`shiftMonths(series, k)`, `since(series, 'YYYY-MM')`, `align([a, b])`,
`subtract(a, b)`, `latest(series)`, `isNum(v)`.

Chart helpers in `MBChart`: `line()` (with `axis: 'y2'` for a second scale and
`bands:` for shaded date ranges), `bar()`, `scatter()` (with an optional
least-squares fit), `diagram()` for supply-and-demand style figures,
`toggleGroup()` to wire a row of buttons, and `RECESSIONS` for NBER dates.

---

## Working on it locally

Opening the HTML files by double-clicking mostly works, but browsers apply
stricter rules to `file://` pages, so it is more reliable to serve the folder:

```bash
cd money-banking-site
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Any Python 3 install has this built in;
nothing else is needed.

---

## Editing the text

Everything is plain HTML. A paragraph is `<p>…</p>`, a heading is `<h3>…</h3>`,
and the call-out boxes are:

```html
<div class="box excel">   <!-- green: an Excel walkthrough -->
<div class="box note">    <!-- amber: an aside or caution -->
<div class="box data">    <!-- blue: a list of data sources -->
```

Numbered instructions use `<ol class="steps">`. Nothing else is needed to keep
a new section looking like the existing ones.

---

## Licence and attribution

Explanations, charts and exercises are original work written for this site.
Chapter and section headings follow the standard organisation of an
undergraduate money-and-banking course so the material can be read alongside
any textbook; no textbook text is reproduced.

Charts are drawn with [Chart.js](https://www.chartjs.org/), MIT licensed.
