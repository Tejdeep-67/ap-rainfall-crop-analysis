// AP rainfall data story.
// Charts are drawn with D3 from data/story.json (made by scripts/build_story_data.py).
// Each chart has a draw(step) function; the scroll code below calls it when a text card
// reaches the middle of the screen.

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const DUR = reduceMotion ? 0 : 750;
const COL = {
  coastal: "#2f5d7c", coastal2: "#5b8fb1", sky: "#a9c6d8", rayala: "#c0582f", rayala2: "#e08a5f",
  ochre: "#c98f2e", chilli: "#a8322a", paper: "#f5eee2", ink: "#2a221c", muted: "#8a7a6b", rule: "#dccdb6",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const NICE_NAME = { "Spsr Nellore": "Nellore", "Visakhapatanam": "Visakhapatnam" };
let DATA, GEO;

const $ = (s) => document.querySelector(s);
const isSmall = () => window.innerWidth < 640;

// ---------- small helpers ----------
const tip = $("#tip");
function showTip(e, html) {
  tip.innerHTML = html;
  const x = Math.min(e.clientX + 14, window.innerWidth - 250);
  tip.style.left = x + "px";
  tip.style.top = e.clientY + 14 + "px";
  tip.classList.add("show");
}
function hideTip() { tip.classList.remove("show"); }

function setup(id, margin) {
  const el = document.getElementById(id);
  el.innerHTML = "";
  const w = el.clientWidth, h = el.clientHeight;
  const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img");
  const g = svg.append("g").attr("transform", `translate(${margin.l},${margin.t})`);
  return { svg, g, w: w - margin.l - margin.r, h: h - margin.t - margin.b };
}

function countUp(el) {
  if (el.dataset.done) return;
  el.dataset.done = 1;
  const to = +el.dataset.to, dec = +(el.dataset.dec || 0), suf = el.dataset.suffix || "";
  if (reduceMotion) { el.textContent = to.toFixed(dec) + suf; return; }
  d3.select(el).transition().duration(1100).ease(d3.easeCubicOut)
    .tween("text", () => { const i = d3.interpolateNumber(0, to); return (t) => { el.textContent = i(t).toFixed(dec) + suf; }; });
}

// ---------- Fig 1: monthly pattern ----------
const months = {
  init() {
    const m = { t: 34, r: 8, b: 28, l: 40 };
    const c = setup("g-months", m);
    const regions = ["Coastal AP", "Rayalaseema"];
    const x0 = d3.scaleBand().domain(d3.range(12)).range([0, c.w]).padding(0.18);
    const x1 = d3.scaleBand().domain(regions).range([0, x0.bandwidth()]).padding(0.08);
    const y = d3.scaleLinear().domain([0, 200]).range([c.h, 0]);
    const rows = d3.range(12).flatMap((i) => regions.map((r) => ({ i, r, v: DATA.rain[r].monthly_normal[i] })));

    c.g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(4).tickSize(-c.w).tickFormat(""));
    c.g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(4)).call((a) => a.select(".domain").remove());
    c.g.append("g").attr("class", "axis").attr("transform", `translate(0,${c.h})`)
      .call(d3.axisBottom(x0).tickFormat((i) => (isSmall() ? MONTHS[i][0] : MONTHS[i])).tickSize(0)).call((a) => a.select(".domain").remove())
      .selectAll("text").attr("dy", "1.1em");

    // season bands drawn behind the bars
    const band = (from, to, label) => {
      const gg = c.g.insert("g", ":first-child").attr("class", "season").style("opacity", 0);
      gg.append("rect").attr("x", x0(from) - 4).attr("width", x0(to) + x0.bandwidth() - x0(from) + 8).attr("y", -26).attr("height", c.h + 26).attr("fill", "#e8dcc6").attr("rx", 3);
      gg.append("text").attr("class", "anno").attr("x", x0(from)).attr("y", -10).text(label);
      return gg;
    };
    this.sw = band(5, 8, isSmall() ? "SW monsoon" : "South-west monsoon");
    this.ne = band(9, 11, isSmall() ? "NE monsoon" : "North-east monsoon");

    this.bars = c.g.append("g").selectAll("rect").data(rows).join("rect")
      .attr("x", (d) => x0(d.i) + x1(d.r)).attr("width", x1.bandwidth()).attr("y", c.h).attr("height", 0).attr("rx", 1.5)
      .attr("fill", (d) => (d.r === "Coastal AP" ? COL.coastal : COL.rayala))
      .on("mousemove", (e, d) => showTip(e, `<b>${MONTHS[d.i]}</b> &middot; ${d.r}<br>${d.v.toFixed(0)} mm on average`))
      .on("mouseleave", hideTip);

    const oct = rows.find((d) => d.i === 9 && d.r === "Coastal AP");
    this.octNote = c.g.append("g").style("opacity", 0);
    const ox = x0(9) + x1("Coastal AP") + x1.bandwidth() / 2, oy = y(oct.v);
    this.octNote.append("path").attr("class", "anno-line").attr("d", `M${ox},${oy - 4} L${ox},${oy - 30} L${ox - 30},${oy - 30}`);
    this.octNote.append("text").attr("class", "anno").attr("x", ox - 34).attr("y", oy - 26).attr("text-anchor", "end").text("Oct: 184 mm");
    Object.assign(this, { y, c });
    d3.select("#sw-c").text(DATA.rain["Coastal AP"].sw_share_pct.toFixed(0) + "%");
    d3.select("#sw-r").text(DATA.rain["Rayalaseema"].sw_share_pct.toFixed(0) + "%");
    d3.select("#ne-r").text(DATA.rain["Rayalaseema"].ne_share_pct.toFixed(0) + "%");
  },
  draw(step, dur = DUR) {
    const { y, c } = this;
    const lit = (d) => step === 0 || (step === 1 ? d.i >= 5 && d.i <= 8 : d.i >= 9);
    this.bars.transition().duration(dur).delay((d) => (step === 0 ? d.i * 40 : 0))
      .attr("y", (d) => y(d.v)).attr("height", (d) => c.h - y(d.v)).attr("opacity", (d) => (lit(d) ? 1 : 0.25));
    this.sw.transition().duration(dur).style("opacity", step === 1 ? 1 : 0);
    this.ne.transition().duration(dur).style("opacity", step === 2 ? 1 : 0);
    this.octNote.transition().duration(dur).style("opacity", step === 2 ? 1 : 0);
  },
};

// ---------- Fig 2: 117 years ----------
const years = {
  init() {
    const m = { t: 20, r: 12, b: 28, l: 44 };
    const c = setup("g-years", m);
    const all = DATA.rain["Coastal AP"].years;
    const x = d3.scaleBand().domain(all.map((d) => d.year)).range([0, c.w]).padding(0.18);
    const max = d3.max(["Coastal AP", "Rayalaseema"], (r) => d3.max(DATA.rain[r].years, (d) => d.annual));
    const y = d3.scaleLinear().domain([0, max * 1.05]).nice().range([c.h, 0]);
    c.g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-c.w).tickFormat(""));
    c.g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5)).call((a) => a.select(".domain").remove());
    c.g.append("g").attr("class", "axis").attr("transform", `translate(0,${c.h})`)
      .call(d3.axisBottom(x).tickValues(all.map((d) => d.year).filter((yr) => yr % (isSmall() ? 40 : 20) === 0)).tickSize(0))
      .call((a) => a.select(".domain").remove()).selectAll("text").attr("dy", "1.1em");

    this.bars = c.g.append("g").selectAll("rect").data(all, (d) => d.year).join("rect")
      .attr("x", (d) => x(d.year)).attr("width", x.bandwidth()).attr("y", c.h).attr("height", 0).attr("fill", COL.sky)
      .on("mousemove", (e, d) => showTip(e, `<b>${d.year}</b> &middot; ${this.region}<br>${d.annual.toFixed(0)} mm (${d.dep > 0 ? "+" : ""}${d.dep.toFixed(0)}% vs normal)<br>${d.cat}`))
      .on("mouseleave", hideTip);
    this.roll = c.g.append("path").attr("fill", "none").attr("stroke", COL.coastal).attr("stroke-width", 2.5);
    this.trend = c.g.append("path").attr("fill", "none").attr("stroke", COL.ink).attr("stroke-width", 1.5).attr("stroke-dasharray", "6 5");
    this.trendLbl = c.g.append("text").attr("class", "anno").attr("text-anchor", "end");
    this.meanLine = c.g.append("line").attr("stroke", COL.ink).attr("stroke-width", 1).attr("stroke-dasharray", "3 3").attr("x1", 0).attr("x2", c.w);
    this.meanLbl = c.g.append("text").attr("class", "anno").attr("x", c.w).attr("text-anchor", "end");
    Object.assign(this, { x, y, c, region: "Coastal AP" });

    const rc = DATA.rain["Coastal AP"], rr = DATA.rain["Rayalaseema"];
    d3.select("#trend-c").text((rc.trend_mm_per_decade > 0 ? "+" : "") + rc.trend_mm_per_decade.toFixed(1));
    d3.select("#trend-cp").text(rc.trend_p.toFixed(2));
    d3.select("#trend-r").text((rr.trend_mm_per_decade > 0 ? "+" : "") + rr.trend_mm_per_decade.toFixed(1));
    d3.select("#trend-rp").text(rr.trend_p.toFixed(2));
  },
  draw(step, dur = DUR) {
    const { x, y, c } = this;
    const region = step >= 2 ? "Rayalaseema" : "Coastal AP";
    this.region = region;
    const R = DATA.rain[region];
    const rows = R.years;
    const byYear = new Map(rows.map((d) => [d.year, d]));
    d3.select("#years-title").text("Annual rainfall, " + region);

    const fill = (d) => {
      if (step === 3) return d.cat === "Deficient" ? COL.rayala : d.cat === "Excess" ? COL.coastal : "#e3d6c2";
      return region === "Coastal AP" ? COL.sky : "#ecc2ab";
    };
    this.bars.data(rows, (d) => d.year).transition().duration(dur).delay((d, i) => (step === 0 ? i * 6 : 0))
      .attr("y", (d) => y(d.annual)).attr("height", (d) => c.h - y(d.annual)).attr("fill", fill);

    const showLines = step === 1 || step === 2;
    const line = d3.line().defined((d) => d.roll10 != null).x((d) => x(d.year) + x.bandwidth() / 2).y((d) => y(d.roll10)).curve(d3.curveMonotoneX);
    this.roll.attr("stroke", region === "Coastal AP" ? COL.coastal : COL.rayala).transition().duration(dur)
      .attr("d", line(rows)).style("opacity", showLines ? 1 : 0);

    // straight trend line from a least squares fit (same as scipy linregress in the notebook)
    const xs = rows.map((d) => d.year), ys = rows.map((d) => d.annual);
    const mx = d3.mean(xs), my = d3.mean(ys);
    const slope = d3.sum(xs, (v, i) => (v - mx) * (ys[i] - my)) / d3.sum(xs, (v) => (v - mx) ** 2);
    const y0 = my + slope * (xs[0] - mx), y1 = my + slope * (xs[xs.length - 1] - mx);
    const tx0 = x(xs[0]), tx1 = x(xs[xs.length - 1]) + x.bandwidth();
    this.trend.transition().duration(dur).attr("d", `M${tx0},${y(y0)} L${tx1},${y(y1)}`).style("opacity", showLines ? 1 : 0);
    this.trendLbl.transition().duration(dur).attr("x", tx1).attr("y", y(y1) - (isSmall() ? 34 : 40)).style("opacity", showLines ? 1 : 0)
      .text(`trend ${R.trend_mm_per_decade > 0 ? "+" : ""}${R.trend_mm_per_decade.toFixed(1)} mm/decade, p = ${R.trend_p.toFixed(2)}`);
    this.meanLine.transition().duration(dur).attr("y1", y(R.mean_annual)).attr("y2", y(R.mean_annual)).style("opacity", step === 3 ? 0.8 : 0);
    this.meanLbl.text(`normal ${R.mean_annual.toFixed(0)} mm`).transition().duration(dur).attr("y", y(R.mean_annual * 1.3)).style("opacity", step === 3 ? 1 : 0);

    const lg = d3.select("#years-legend");
    if (step === 3) {
      lg.html(`<span><span class="key" style="background:${COL.rayala}"></span>Deficient: ${R.counts.Deficient}</span>
        <span><span class="key" style="background:#e3d6c2"></span>Normal: ${R.counts.Normal}</span>
        <span><span class="key" style="background:${COL.coastal}"></span>Excess: ${R.counts.Excess}</span>`);
    } else if (showLines) {
      lg.html(`<span><span class="key" style="background:${region === "Coastal AP" ? COL.coastal : COL.rayala};height:3px"></span>10-year average</span><span>- - - linear trend</span>`);
    } else {
      lg.html(`<span>mean ${R.mean_annual.toFixed(0)} mm &middot; varies by ${R.cv_pct.toFixed(0)}% (coefficient of variation)</span>`);
    }
  },
};

// ---------- Fig 3: district map ----------
const map = {
  layers: [
    { key: null, title: "The two regions" },
    { key: "rice_share", title: "Share of AP rice production, 1997\u20132014", color: COL.coastal, max: 20 },
    { key: "groundnut_share", title: "Share of AP groundnut production, 1997\u20132014", color: COL.ochre, max: 40 },
    { key: "chilli_share", title: "Share of AP dry chilli production, 1997\u20132014", color: COL.chilli, max: 60 },
  ],
  init() {
    const el = document.getElementById("g-map");
    el.innerHTML = "";
    const w = el.clientWidth, h = el.clientHeight;
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img").attr("aria-label", "Map of Andhra Pradesh districts");
    const proj = d3.geoMercator().fitExtent([[10, 10], [w - 10, h - 10]], GEO);
    const path = d3.geoPath(proj);
    const D = DATA.crops.districts;
    this.paths = svg.append("g").selectAll("path").data(GEO.features).join("path")
      .attr("class", "district").attr("d", path).attr("fill", COL.paper)
      .on("mousemove", (e, f) => {
        const d = D[f.properties.district];
        const nm = NICE_NAME[f.properties.district] || f.properties.district;
        showTip(e, `<b>${nm}</b> &middot; ${d.region}<br>Rice ${d.rice_share}% &middot; Groundnut ${d.groundnut_share}%<br>Chillies ${d.chilli_share}% of AP<br>Biggest crop by area: ${d.top_crop}`);
      })
      .on("mouseleave", hideTip);
    const lbl = svg.append("g");
    this.names = lbl.selectAll("text.dlabel").data(GEO.features).join("text").attr("class", "dlabel")
      .attr("text-anchor", "middle")
      .attr("x", (f) => path.centroid(f)[0]).attr("y", (f) => path.centroid(f)[1])
      .text((f) => NICE_NAME[f.properties.district] || f.properties.district);
    this.values = lbl.selectAll("text.dvalue").data(GEO.features).join("text").attr("class", "dvalue")
      .attr("text-anchor", "middle").attr("x", (f) => path.centroid(f)[0]).attr("y", (f) => path.centroid(f)[1] + 14);
    if (isSmall()) this.names.style("font-size", "9px");
  },
  draw(step, dur = DUR) {
    const L = this.layers[step];
    const D = DATA.crops.districts;
    d3.select("#map-title").text(L.title);
    if (!L.key) {
      this.paths.transition().duration(dur).delay((f, i) => i * 30)
        .attr("fill", (f) => (D[f.properties.district].region === "Rayalaseema" ? COL.rayala2 : COL.coastal2));
      this.values.transition().duration(dur / 2).style("opacity", 0);
      this.names.transition().duration(dur).style("opacity", 1);
      d3.select("#map-legend").html('<span><span class="key coastal" style="background:#5b8fb1"></span>Coastal AP (9 districts)</span><span><span class="key" style="background:#e08a5f"></span>Rayalaseema (4)</span>');
      return;
    }
    const scale = d3.scaleSequential([0, L.max], d3.interpolateRgb("#f3ebdd", L.color));
    this.paths.transition().duration(dur).attr("fill", (f) => scale(D[f.properties.district][L.key]));
    this.values.text((f) => D[f.properties.district][L.key].toFixed(0) + "%").transition().duration(dur).style("opacity", 1);
    this.names.transition().duration(dur).style("opacity", isSmall() ? 0 : 0.8);
    d3.select("#map-legend").html(`<span>0%<span class="ramp" style="background:linear-gradient(90deg,#f3ebdd,${L.color})"></span>${L.max}%+</span><span>hover a district for details</span>`);
  },
};

// ---------- Fig 4: rain vs yield ----------
const yieldChart = {
  init() {
    const m = { t: 20, r: 18, b: 46, l: 52 };
    const c = setup("g-yield", m);
    this.c = c;
    this.gx = c.g.append("g").attr("class", "axis").attr("transform", `translate(0,${c.h})`);
    this.gy = c.g.append("g").attr("class", "axis");
    this.grid = c.g.append("g").attr("class", "grid");
    this.xl = c.g.append("text").attr("class", "lbl").attr("x", c.w).attr("y", c.h + 38).attr("text-anchor", "end");
    c.g.append("text").attr("class", "lbl").attr("x", 0).attr("y", -6).text("yield, tonnes per hectare");
    this.fit = c.g.append("line").attr("stroke-width", 2).attr("stroke-dasharray", "1 0");
    this.dots = c.g.append("g");
    this.labels = c.g.append("g");
    this.rlabel = c.g.append("text").attr("class", "anno-big").attr("x", 6).attr("y", 26);
  },
  draw(step, dur = DUR) {
    const { c } = this;
    const rice = step === 2;
    const S = rice ? DATA.crops.rice : DATA.crops.groundnut;
    const pts = S.points;
    const color = rice ? COL.coastal : COL.rayala;
    d3.select("#yield-title").text(rice ? "Rice yield vs annual rain, coastal districts" : "Groundnut yield vs June\u2013September rain, Rayalaseema");
    const x = d3.scaleLinear().domain(d3.extent(pts, (d) => d.rain)).nice().range([0, c.w]);
    const y = d3.scaleLinear().domain([0, d3.max(pts, (d) => d.yield) * 1.12]).nice().range([c.h, 0]);
    this.gx.transition().duration(dur).call(d3.axisBottom(x).ticks(isSmall() ? 4 : 6)).call((a) => a.select(".domain").attr("stroke", COL.rule));
    this.gy.transition().duration(dur).call(d3.axisLeft(y).ticks(5)).call((a) => a.select(".domain").remove());
    this.grid.transition().duration(dur).call(d3.axisLeft(y).ticks(5).tickSize(-c.w).tickFormat(""));
    this.xl.text(rice ? "annual rainfall, coastal AP (mm)" : "June\u2013September rainfall, Rayalaseema (mm)");

    const [a, b] = x.domain();
    this.fit.transition().duration(dur).attr("stroke", color)
      .attr("x1", x(a)).attr("x2", x(b)).attr("y1", y(S.intercept + S.slope * a)).attr("y2", y(S.intercept + S.slope * b))
      .style("opacity", 0.85);
    const focus = [2006, 2007, 2008];
    this.dots.selectAll("circle").data(pts, (d) => d.year).join(
      (enter) => enter.append("circle").attr("r", 0).attr("cx", (d) => x(d.rain)).attr("cy", (d) => y(d.yield)),
    ).on("mousemove", (e, d) => showTip(e, `<b>${d.year}</b><br>${d.rain.toFixed(0)} mm rain<br>${d.yield.toFixed(2)} t/ha`))
      .on("mouseleave", hideTip)
      .transition().duration(dur).delay((d, i) => (step === 0 ? i * 35 : 0))
      .attr("cx", (d) => x(d.rain)).attr("cy", (d) => y(d.yield)).attr("r", isSmall() ? 5.5 : 7)
      .attr("fill", color).attr("stroke", COL.paper).attr("stroke-width", 1.5)
      .attr("opacity", (d) => (step === 1 && !focus.includes(d.year) ? 0.25 : 0.9));

    this.labels.selectAll("text").data(step === 1 ? pts.filter((d) => focus.includes(d.year)) : [], (d) => d.year)
      .join((en) => en.append("text").attr("class", "anno").style("opacity", 0))
      .attr("x", (d) => x(d.rain) + (d.year === 2007 ? -12 : 12)).attr("y", (d) => y(d.yield) + (d.year === 2006 ? 16 : -10))
      .attr("text-anchor", (d) => (d.year === 2007 ? "end" : "start"))
      .text((d) => `${d.year}: ${d.yield.toFixed(2)} t/ha`)
      .transition().duration(dur).style("opacity", 1);

    this.rlabel.attr("fill", color).text(`r = ${S.r.toFixed(2)}`);
    d3.select("#yield-legend").html(rice
      ? `<span>18 years, 1997\u20132014 &middot; p = ${S.p} (not significant)</span>`
      : `<span>18 years, 1997\u20132014 &middot; p &lt; 0.001 &middot; line = least squares fit</span>`);
  },
};

// ---------- scroll handling ----------
const CHARTS = { "s-months": months, "s-years": years, "s-map": map, "s-yield": yieldChart };
const current = {};

function activate(section, step) {
  const ch = CHARTS[section.id];
  section.querySelectorAll(".step").forEach((s) => s.classList.toggle("is-active", +s.dataset.step === step));
  section.querySelector(`.step[data-step="${step}"]`).querySelectorAll(".num").forEach(countUp);
  if (current[section.id] === step) return;
  current[section.id] = step;
  ch.draw(step);
}

function setupScroll() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const section = en.target.closest(".scrolly");
      activate(section, +en.target.dataset.step);
    });
  }, { rootMargin: window.innerWidth <= 860 ? "-68% 0px -28% 0px" : "-45% 0px -45% 0px" });
  document.querySelectorAll(".step").forEach((s) => io.observe(s));

  // first step of each chart is drawn as soon as the chart comes on screen
  const io2 = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting && current[en.target.id] === undefined) activate(en.target, 0);
  }), { threshold: 0.25 });
  document.querySelectorAll(".scrolly").forEach((s) => io2.observe(s));

  // generic reveals + counters in the conclusion
  const io3 = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add("in");
    en.target.querySelectorAll(".num").forEach(countUp);
    io3.unobserve(en.target);
  }), { threshold: 0.2 });
  document.querySelectorAll(".intro, .conclusion blockquote, .facts, .methods").forEach((el) => { el.classList.add("reveal"); io3.observe(el); });

  const bar = $("#progress");
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function initCharts() {
  Object.values(CHARTS).forEach((ch) => ch.init());
}

let lastW = window.innerWidth;
window.addEventListener("resize", () => {
  // phones fire resize when the address bar hides, only redraw on real width changes
  if (Math.abs(window.innerWidth - lastW) < 30) return;
  lastW = window.innerWidth;
  clearTimeout(window._rt);
  window._rt = setTimeout(() => {
    initCharts();
    for (const [id, step] of Object.entries(current)) CHARTS[id].draw(step, 0);
  }, 200);
});

// ---------- hero rain ----------
function rain() {
  const cv = $("#rain");
  if (!cv || reduceMotion) return;
  const ctx = cv.getContext("2d");
  let drops = [], w, h, running = true;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  function size() {
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((w * h) / 9000);
    drops = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, l: 8 + Math.random() * 18, v: 5 + Math.random() * 7, o: 0.15 + Math.random() * 0.45 }));
  }
  function frame() {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;
    for (const d of drops) {
      ctx.strokeStyle = `rgba(214,231,241,${d.o})`;
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * 0.18, d.y + d.l); ctx.stroke();
      d.y += d.v; d.x -= d.v * 0.18;
      if (d.y > h) { d.y = -d.l; d.x = Math.random() * (w + 60); }
    }
    requestAnimationFrame(frame);
  }
  size();
  window.addEventListener("resize", size);
  // stop drawing when the hero is off screen
  new IntersectionObserver(([en]) => { const was = running; running = en.isIntersecting; if (running && !was) frame(); }).observe(cv);
  frame();
}

async function main() {
  rain();
  try {
    [DATA, GEO] = await Promise.all([d3.json("data/story.json"), d3.json("data/ap_districts.geojson")]);
  } catch (e) {
    document.querySelector(".intro").insertAdjacentHTML("beforeend", "<p><em>Could not load the chart data. If you opened the file directly, run a local server in docs/.</em></p>");
    return;
  }
  initCharts();
  setupScroll();
}

main();
