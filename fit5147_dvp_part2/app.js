// app.js — Section 1 + Section 2 only

// ══════════════════════════════════════════════════════════════════════════════
// SHARED STATE
// ══════════════════════════════════════════════════════════════════════════════
const priceData = new Map();
const medianData = new Map();
let   geoData   = null;

const tooltip = d3.select("#map-tooltip");

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — CHOROPLETH MAP
// (your original code, unchanged, just wrapped in init/update functions)
// ══════════════════════════════════════════════════════════════════════════════
let paths, legendG;
let selectedYear = 2025;
let selectedFT   = "ALL";
let tooltipTimeout, lastHovered;
let exploreMode  = false;   // true after step 5
let selectedTown = null;    // town clicked in explore mode

// ── Section 3 state ──
const affordData  = new Map(); // year -> { max_price_25_29, max_price_30_34 }
let s3Age = "25-29";
let s3FT  = "ALL";
let s3Town = "ALL";
let coolingData = [];
const incomeData = new Map();


const colorScale = d3.scaleSequential().interpolator(d3.interpolateOrRd);
const flatTypes  = ["ALL", "2 ROOM", "3 ROOM", "4 ROOM", "5 ROOM", "EXECUTIVE"];
const flatLabels = ["ALL", "2RM",    "3RM",    "4RM",    "5RM",    "EXEC"];
const flatTypesNoAll  = flatTypes.slice(1);
const flatLabelsNoAll = flatLabels.slice(1);

function updateColorScale() {
  const values = [];
  priceData.forEach((pct, key) => {
    if (key.endsWith("|" + selectedFT + "|" + selectedYear)) values.push(pct);
  });
  colorScale.domain(d3.extent(values));
}

function getFill(d) {
  const key = d.properties.PLN_AREA_N + "|" + selectedFT + "|" + selectedYear;
  const pct = priceData.get(key);
  if (pct === undefined || isNaN(pct)) return "#d4d4d4";
  return colorScale(pct);
}

function drawLegend() {
  if (legendG) legendG.remove();
  const svg = d3.select("#map-svg");
  const w   = +svg.attr("width") || 600;
  legendG = svg.append("g")
    .attr("transform", `translate(${w - 220}, 150)`)
    .append(() => buildLegend(colorScale, {
      title: "% Price Change from 2020",
      width: 200
    }));
}

function buildPills() {
  const container = document.getElementById("ft-selector");
  flatTypes.forEach((ft, i) => {
    const btn = document.createElement("button");
    btn.textContent = flatLabels[i];
    btn.dataset.ft  = ft;
    if (ft === selectedFT) btn.classList.add("active");
    btn.addEventListener("click", function() {
      selectedFT = ft;
      container.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.ft === ft));
      updateColorScale();
      drawLegend();
      if (paths) paths.transition().duration(250).attr("fill", getFill);
      if (exploreMode) {
        if (selectedTown) drawExplorCharts(selectedTown);
        else drawDefaultCharts();
        showScrollCue();
      }
    });
    container.appendChild(btn);
  });
}

function attachSlider() {
  const slider = document.getElementById("year-slider");
  slider.addEventListener("input", function() {
    selectedYear = +this.value;
    const pct = (selectedYear - 2021) / (2025 - 2021) * 100;
    this.style.background = `linear-gradient(to right, #67000d ${pct}%, #ddd ${pct}%)`;
    document.querySelectorAll(".year-tick").forEach(el => {
      const on = +el.dataset.year === selectedYear;
      el.classList.toggle("active", on);
    });
    updateColorScale();
    drawLegend();
    if (paths) paths.transition().duration(250).attr("fill", getFill);
    if (exploreMode) {
        if (selectedTown) drawExplorCharts(selectedTown);
        else drawDefaultCharts();
        showScrollCue();
    }
  });
}

function initMap() {
  const graphic = document.getElementById("s2-graphic");
  const W = graphic.clientWidth;
  const H = graphic.clientHeight;
  const mapH = H - 120; // leave room for slider + pills

  const svg = d3.select("#map-svg")
    .attr("width",  W)
    .attr("height", mapH);

    const proj    = d3.geoMercator()
        .fitSize([W, mapH], { type: "FeatureCollection", features: geoData.features });

    const [tx, ty] = proj.translate();  
    proj.translate([tx + W * 0.05, ty]);  // shift left 50px, keep vertical position

  const pathGen = d3.geoPath().projection(proj);

  paths = svg.append("g")
    .selectAll("path")
    .data(geoData.features)
    .join("path")
      .attr("d",     pathGen)
      .attr("fill",  getFill)
      .attr("class", "town-path")
      .style("stroke",       "white")
      .style("stroke-width", "1px")
      .style("cursor",       "pointer")

      .on("mouseover", function(event, d) {
        clearTimeout(tooltipTimeout);

        // Skip hover effects on the selected town in explore mode
        if (exploreMode && selectedTown === d.properties.PLN_AREA_N) return;

        if (lastHovered) d3.select(lastHovered).style("stroke", "white").style("stroke-width", "1px");
        lastHovered = this;

        const townName = d.properties.PLN_AREA_N;
        const key = townName + "|" + selectedFT + "|" + selectedYear;
        const pct = priceData.get(key);

        if (pct === undefined || isNaN(pct)) {
          d3.selectAll(".town-path").transition().duration(150).style("opacity", 1).style("stroke", "white").style("stroke-width", "1px");
          tooltip.style("opacity", 0);
          lastHovered = null;
          return;
        }

        if (!exploreMode || !selectedTown) {
            d3.selectAll(".town-path").transition().duration(150).style("opacity", 0.4);
            d3.select(this).transition().duration(150).style("opacity", 1).style("stroke", "#333").style("stroke-width", "1.5px");
        }
        d3.select(this).transition().duration(150).style("opacity", 1).style("stroke", "#333").style("stroke-width", "1.5px");

        tooltip
          .style("opacity", 0.95)
          .style("left", (event.clientX + 15) + "px")
          .style("top",  (event.clientY - 30) + "px")
          const prevYear = selectedYear - 1;
          const prevKey  = townName + "|" + selectedFT + "|" + prevYear;
          const prevPct  = priceData.get(prevKey);
          const yoy      = (prevPct !== undefined && !isNaN(prevPct)) ? pct - prevPct : null;

          const yoyStr = (selectedYear === 2021 || yoy === null)
            ? ""
            : `<br><span style="font-size:0.75rem; color:#666">YoY: <b style="color:${yoy >= 0 ? "#c0392b" : "#2c7bb6"}">${d3.format("+.1f")(yoy)}% from ${prevYear}</b></span>`;

          tooltip
            .style("opacity", 0.95)
            .style("left", (event.clientX + 15) + "px")
            .style("top",  (event.clientY - 30) + "px")
            .html(`<strong style="font-size:14px">${townName}</strong>: <b style="color:#c0392b">${d3.format("+.1f")(pct)}%</b> from 2020${yoyStr}`);
      })

     .on("mouseleave", function() {
        tooltipTimeout = setTimeout(() => {
        tooltip.style("opacity", 0);
        if (lastHovered && !(exploreMode && selectedTown)) {
          d3.select(lastHovered).style("stroke", "white").style("stroke-width", "1px");
        }
        lastHovered = null;

          if (exploreMode && selectedTown) {
          d3.selectAll(".town-path")
            .transition().duration(150)
            .style("opacity", f => f.properties.PLN_AREA_N === selectedTown ? 1 : 0.35)
            .style("stroke",       f => f.properties.PLN_AREA_N === selectedTown ? "#333" : "white")
            .style("stroke-width", f => f.properties.PLN_AREA_N === selectedTown ? "2px" : "1px");
          } else {
            d3.selectAll(".town-path").transition().duration(150)
              .style("opacity", 1).style("stroke", "white").style("stroke-width", "1px");
            }
        }, 300);
      })

      // ── Click handler: only active in explore mode ──
     .on("click", function(event, d) {
        if (!exploreMode) return;
        const townName = d.properties.PLN_AREA_N;
        const hasData  = flatTypesNoAll.some(ft => medianData.has(townName + "|" + ft + "|2020"));
        if (!hasData) return;
 
        selectedTown = townName;
        d3.select("#explore-title").text(townName);
        d3.select("#explore-desc").text("Showing transaction volume and price movement from 2020 to 2025.");
        document.getElementById("explore-reset-btn").style.display = "block";
        d3.select(".explore-hint").text("Click a different town to update"); 
 
        // Highlight selected town on map
        d3.selectAll(".town-path")
          .transition().duration(200)
          .style("opacity", f => f.properties.PLN_AREA_N === townName ? 1 : 0.35)
          .style("stroke",       f => f.properties.PLN_AREA_N === townName ? "#333" : "white")
          .style("stroke-width", f => f.properties.PLN_AREA_N === townName ? "2px"  : "1px");
 
        drawExplorCharts(townName);
        showScrollCue();
      });
  selectedYear = 2025;
  selectedFT = "ALL";
  updateColorScale();
  paths.attr("fill", getFill);
  drawLegend();
  buildPills();
  attachSlider();

  window.addEventListener("resize", () => {
    const newW = graphic.clientWidth;
    const newH = graphic.clientHeight;
    const newMapH = newH - 120;

    d3.select("#map-svg").attr("width", newW).attr("height", newMapH);

    const newProj = d3.geoMercator()
      .fitSize([newW, newMapH], { type: "FeatureCollection", features: geoData.features });
    const [tx, ty] = newProj.translate();
    newProj.translate([tx + newW * 0.05, ty]);

    paths.attr("d", d3.geoPath().projection(newProj));
    updateColorScale();
    drawLegend();

    // Redraw charts if in explore mode
    if (exploreMode) {
        if (selectedTown) drawExplorCharts(selectedTown);
        else drawDefaultCharts();
    } 
  });
}

// Called by scrollama when a step enters view
function updateMap(step) {
  const yearMap = { 0: 2021, 1: 2022, 2: 2023, 3: 2024, 4: 2025 };
  const newYear = yearMap[step] ?? 2025;
  if (newYear === selectedYear) return;
  selectedYear = newYear;

  const slider = document.getElementById("year-slider");
  slider.value = selectedYear;
  const pct = (selectedYear - 2021) / (2025 - 2021) * 100;
  slider.style.background = `linear-gradient(to right, #67000d ${pct}%, #ddd ${pct}%)`;
  document.querySelectorAll(".year-tick").forEach(el => el.classList.toggle("active", +el.dataset.year === selectedYear));

  updateColorScale();
  drawLegend();
  if (paths) paths.transition().duration(700).attr("fill", getFill);
}

// Switch to explore mode
function enterExploreMode() {
  if (exploreMode) return;
  exploreMode = true;
  setTimeout(() => { drawDefaultCharts(); }, 100);
 
  document.getElementById("explore-reset-btn").addEventListener("click", () => {
    selectedTown = null;
    d3.selectAll(".town-path").transition().duration(300)
      .style("opacity", 1).style("stroke", "white").style("stroke-width", "1px");
    d3.select("#explore-title").text("Now it's your turn");
    d3.select("#explore-desc").text("Click any town on the map to explore its transaction volume and price movement over time.");
    document.getElementById("explore-reset-btn").style.display = "none";
    drawDefaultCharts();
  });
}

//Scroll cue to section 3
function showScrollCue() {
  const cue = document.getElementById("explore-scroll-cue");
  if (!cue) return;
  cue.style.display = "block";
  setTimeout(() => cue.classList.add("visible"), 50);
}



// ══════════════════════════════════════════════════════════════════════════════
// EXPLORE MODE — BAR + LINE CHARTS
// ══════════════════════════════════════════════════════════════════════════════

function drawDefaultCharts() {
  const fts  = selectedFT === "ALL" ? flatTypesNoAll : [selectedFT];
  const lbls = selectedFT === "ALL" ? flatLabelsNoAll : [flatLabels[flatTypes.indexOf(selectedFT)]];
  const years = [2020, 2021, 2022, 2023, 2024, 2025];
  const towns = [...new Set([...medianData.keys()].map(k => k.split("|")[0]))];

  function getAgg(ft, yr) {
    const prices = [], vols = [];
    towns.forEach(t => {
      const row = medianData.get(t + "|" + ft + "|" + yr);
      if (row) { prices.push(row.median_price); vols.push(row.volume); }
    });
    return prices.length ? { median_price: Math.round(d3.median(prices)), volume: d3.sum(vols) } : null;
  }

  const volData = years.map(yr => {
    const entry = { year: yr };
    fts.forEach(ft => { const a = getAgg(ft, yr); entry[ft] = a ? a.volume : 0; });
    return entry;
  });

  const priceLineData = {};
  fts.forEach(ft => {
    priceLineData[ft] = years.map(yr => {
      const a = getAgg(ft, yr);
      return a ? { year: yr, price: a.median_price } : null;
    }).filter(Boolean);
  });

  d3.select("#chart-volume").selectAll("*").remove();
  d3.select("#chart-price").selectAll("*").remove();
  drawVolumeBar(d3.select("#chart-volume"), volData, fts, lbls, "Transaction Volume — All Singapore Towns");
  drawPriceLine(d3.select("#chart-price"), priceLineData, fts, lbls, "Median Price — All Singapore Towns (SGD)");
}


function drawExplorCharts(town) {
  const fts  = selectedFT === "ALL" ? flatTypesNoAll : [selectedFT];
  const lbls = selectedFT === "ALL" ? flatLabelsNoAll : [flatLabels[flatTypes.indexOf(selectedFT)]];
  const years = [2020, 2021, 2022, 2023, 2024, 2025];

  const volData = years.map(yr => {
    const entry = { year: yr };
    fts.forEach(ft => { const row = medianData.get(town + "|" + ft + "|" + yr); entry[ft] = row ? row.volume : 0; });
    return entry;
  });

  const priceLineData = {};
  fts.forEach(ft => {
    priceLineData[ft] = years.map(yr => {
      const row = medianData.get(town + "|" + ft + "|" + yr);
      return row ? { year: yr, price: row.median_price } : null;
    }).filter(Boolean);
  });

  d3.select("#chart-volume").selectAll("*").remove();
  d3.select("#chart-price").selectAll("*").remove();
  drawVolumeBar(d3.select("#chart-volume"), volData, fts, lbls, "Transaction Volume — " + town);
  drawPriceLine(d3.select("#chart-price"), priceLineData, fts, lbls, "Median Price — " + town + " (SGD)");
}
 
function drawVolumeBar(container, data, fts, lbls, title) {
  container.selectAll("*").remove();

  const W = container.node().parentNode.getBoundingClientRect().width - 24;
  const H = container.node().getBoundingClientRect().height || window.innerHeight * 0.35;
  const m = { top: 36, right: 16, bottom: 80, left: 56 };
  const iW = W - m.left - m.right;
  const iH = H - m.top  - m.bottom;
  const years = data.map(d => d.year);

  const svg = container.append("svg").attr("width", W).attr("height", H)
    .style("display", "block")
    .append("g").attr("transform", `translate(${m.left},${m.top})`);
    

  svg.append("text").attr("x", iW / 2).attr("y", -18)
    .attr("text-anchor", "middle")
    .attr("font-size", "1rem")
    .attr("font-weight", "700")
    .attr("fill", "#333")
    .text(title);

  const x0     = d3.scaleBand().domain(years).range([0, iW]).paddingInner(0.2);
  const x1     = d3.scaleBand().domain(fts).range([0, x0.bandwidth()]).padding(0.05);
  const maxVol = d3.max(data, d => d3.max(fts, ft => d[ft]));
  const y      = d3.scaleLinear().domain([0, maxVol * 1.1]).range([iH, 0]);

  const color = d3.scaleOrdinal()
    .domain(flatTypesNoAll)
    .range(["#453947","#A4BED5","#476F84","#72874E","#FED789"]);

  const yearGroups = svg.selectAll(".year-group")
    .data(data).join("g")
    .attr("class", "year-group")
    .attr("transform", d => `translate(${x0(d.year)},0)`);

  yearGroups.selectAll("rect")
    .data(d => fts.map(ft => ({ ft, val: d[ft], year: d.year })))
    .join("rect")
      .attr("x",      d => x1(d.ft))
      .attr("y",      d => y(d.val))
      .attr("width",  x1.bandwidth())
      .attr("height", d => iH - y(d.val))
      .attr("fill",   d => color(d.ft))
      .attr("rx", 1)
      .on("mouseover", (event, d) => {
        tooltip.style("opacity", 0.95)
          .style("left", (event.clientX + 12) + "px")
          .style("top",  (event.clientY - 28) + "px")
          .html(`<strong>${lbls[fts.indexOf(d.ft)]}</strong> ${d.year}<br>Volume: <b>${d3.format(",")(d.val)}</b>`);
      })
      .on("mouseleave", () => tooltip.style("opacity", 0));

  svg.append("g").attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x0).tickSize(0))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll("text").attr("font-size", "0.75rem").attr("fill", "#666"));

  svg.append("g").call(d3.axisLeft(y).ticks(4).tickSize(-iW))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line").attr("stroke", "#eee"))
    .call(g => g.selectAll("text").attr("font-size", "0.75rem").attr("fill", "#888"));

  if (fts.length > 1) {
    const legItemW = Math.min(iW / fts.length, 80);
    const leg = svg.append("g").attr("transform", `translate(0,${iH + 38})`);
    fts.forEach((ft, i) => {
        const lx = i * legItemW;
      leg.append("rect").attr("x", lx).attr("y", 0).attr("width", 12).attr("height", 12).attr("fill", color(ft));
      leg.append("text").attr("x", lx + 18).attr("y", 12).attr("font-size", "0.75rem").attr("fill", "#555").text(lbls[i]);
    });
  }
}
 
function drawPriceLine(container, lineData, fts, lbls, title) {
  const W = container.node().parentNode.getBoundingClientRect().width - 24;
  const H = container.node().getBoundingClientRect().height || window.innerHeight * 0.35;
  const m = { top: 36, right: 16, bottom: 80, left: 56 };
  const iW = W - m.left - m.right, iH = H - m.top - m.bottom;
 
  const svg = container.append("svg").attr("width", W).attr("height", H)
    .append("g").attr("transform", "translate(" + m.left + "," + m.top + ")");
 
  svg.append("text").attr("x", iW / 2).attr("y", -18)
  .attr("text-anchor", "middle")
  .attr("font-size", "1rem")
  .attr("font-weight", "700")
  .attr("fill", "#333")
  .style("overflow", "hidden")
  .text(title);
 
  const allYears  = [...new Set(fts.flatMap(ft => (lineData[ft]||[]).map(d => d.year)))].sort();
  const allPrices = fts.flatMap(ft => (lineData[ft]||[]).map(d => d.price));
  if (!allPrices.length) return;
 
  const x = d3.scalePoint().domain(allYears).range([0, iW]).padding(0.1);
  const y = d3.scaleLinear().domain([d3.min(allPrices)*0.9, d3.max(allPrices)*1.05]).range([iH, 0]);
  const color = d3.scaleOrdinal().domain(flatTypesNoAll).range(["#453947","#A4BED5","#476F84","#72874E","#FED789"]);
  const lineGen = d3.line().x(d => x(d.year)).y(d => y(d.price)).curve(d3.curveMonotoneX);
 
  svg.append("g").call(d3.axisLeft(y).ticks(4).tickSize(-iW))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line").attr("stroke","#eee"))
    .call(g => g.selectAll("text").attr("font-size","0.75rem").attr("fill","#888")
      .text(d => d >= 1000000 ? "$" + (d/1000000).toFixed(1) + "M" : "$" + Math.round(d/1000) + "k"));;
 
  fts.forEach(ft => {
    const ld = lineData[ft] || [];
    if (!ld.length) return;
    svg.append("path").datum(ld).attr("fill","none").attr("stroke",color(ft)).attr("stroke-width",2).attr("d",lineGen);
    svg.selectAll(".dot-" + ft.replace(/ /g,""))
      .data(ld).join("circle")
      .attr("cx", d => x(d.year)).attr("cy", d => y(d.price))
      .attr("r", 6).attr("fill", color(ft)).attr("stroke","white").attr("stroke-width",1)
      .on("mouseover", (ev, d) => tooltip.style("opacity",0.95)
        .style("left",(ev.clientX+12)+"px").style("top",(ev.clientY-28)+"px")
        .html("<strong>" + lbls[fts.indexOf(ft)] + "</strong> " + d.year + "<br>Median: <b>$" + d3.format(",")(d.price) + "</b>"))
      .on("mouseleave", () => tooltip.style("opacity", 0));
  });
 
  svg.append("g").attr("transform", "translate(0," + iH + ")")
    .call(d3.axisBottom(x).tickSize(0))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll("text").attr("font-size","0.75rem").attr("fill","#666"));
 
  const legItemW = Math.min(iW / fts.length, 80);
  const leg = svg.append("g").attr("transform", `translate(0,${iH + 38})`);
  fts.forEach((ft, i) => {
    const lx = i * legItemW;
    leg.append("rect").attr("x",lx).attr("y",0).attr("width",12).attr("height", 12).attr("fill",color(ft));
    leg.append("text").attr("x",lx+18).attr("y",12).attr("font-size","0.75rem").attr("fill","#555").text(lbls[i]);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// LEGEND UTILITY 
// ══════════════════════════════════════════════════════════════════════════════
function buildLegend(color, {
  title, tickSize=6, width=260, height=60+6,
  marginTop=18, marginRight=0, marginBottom=16+6, marginLeft=0, ticks=5
} = {}) {
  function ramp(fn, n=256) {
    const cv = document.createElement("canvas"); cv.width=n; cv.height=1;
    const ctx = cv.getContext("2d");
    for (let i=0; i<n; i++) { ctx.fillStyle=fn(i/(n-1)); ctx.fillRect(i,0,1,1); }
    return cv;
  }
  const svg = d3.create("svg").attr("width",width).attr("height",height)
    .attr("viewBox",[0,0,width,height]).style("overflow","visible").style("display","block");
  const [dMin,dMax] = color.domain();
  const x = d3.scaleLinear().domain([dMin,dMax]).range([marginLeft, width-marginRight]);
  svg.append("image").attr("x",marginLeft).attr("y",marginTop)
    .attr("width",width-marginLeft-marginRight).attr("height",height-marginTop-marginBottom)
    .attr("preserveAspectRatio","none").attr("href",ramp(color.interpolator()).toDataURL());
  svg.append("g").attr("transform",`translate(0,${height-marginBottom})`)
    .call(d3.axisBottom(x).ticks(ticks).tickSize(tickSize).tickFormat(d=>`${d3.format(".0f")(d)}%`))
    .call(g=>g.select(".domain").remove())
    .call(g=>g.selectAll(".tick line").attr("stroke","white").attr("stroke-width","2px").attr("y1",-(height-marginTop-marginBottom)).attr("y2",0))
    .call(g=>g.selectAll(".tick text").attr("fill","#555").attr("font-size","12px"))
    .call(g=>g.append("text").attr("x",marginLeft).attr("y",marginTop+marginBottom-height-6)
      .attr("fill","#333").attr("text-anchor","start").attr("font-weight","bold").attr("font-size","12px").text(title));
  return svg.node();
}
// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — AFFORDABILITY
// ══════════════════════════════════════════════════════════════════════════════

function initS3() {
  // Populate town dropdown
  const towns = ["ALL", ...new Set([...medianData.keys()].map(k => k.split("|")[0])).values()].sort();
  const sel = document.getElementById("s3-town-dropdown");
  towns.forEach(t => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = t;
    sel.appendChild(opt);
  });

  // Flat type pills
  const ftContainer = document.getElementById("s3-ft-selector");
  flatTypes.forEach((ft, i) => {
    const btn = document.createElement("button");
    btn.textContent = flatLabels[i];
    btn.dataset.ft  = ft;
    if (ft === s3FT) btn.classList.add("active");
    btn.addEventListener("click", () => {
      s3FT = ft;
      ftContainer.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.ft === ft));
      updateS3();
    });
    ftContainer.appendChild(btn);
  });

  // Age band toggle
  document.querySelectorAll(".s3-age-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      s3Age = btn.dataset.age;
      document.querySelectorAll(".s3-age-btn").forEach(b => b.classList.toggle("active", b === btn));
      updateS3();
    });
  });

  // Town dropdown
  sel.addEventListener("change", () => {
    s3Town = sel.value;
    updateS3();
  });

  const observer = new ResizeObserver(entries => {
  for (const entry of entries) {
    if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
      observer.disconnect();
      updateS3();
      requestAnimationFrame(() => alignS3RightColumn());
    }
  }
});
observer.observe(document.getElementById("s3-sankey"));

}

function updateS3() {
  drawS3LineChart();
  drawS3Diverging();
  drawS3Sankey();
}

function alignS3RightColumn() {
  const linechartBottom = document.getElementById("s3-linechart").getBoundingClientRect().bottom;
  const explainerMid    = document.getElementById("s3-affordability-explainer").getBoundingClientRect().top + 20;
  const divergingBottom = document.getElementById("s3-diverging").getBoundingClientRect().bottom;
  const s3Top           = document.getElementById("s3").getBoundingClientRect().top;

  const assumptionsHeight = linechartBottom - s3Top - 12;
  const sankeyHeight      = divergingBottom - explainerMid;

  document.getElementById("s3-assumptions").style.height = assumptionsHeight + "px";
  document.getElementById("s3-assumptions").style.flex   = "none";
  document.getElementById("s3-sankey").style.height      = sankeyHeight + "px";
  document.getElementById("s3-sankey").style.flex        = "none";
  document.getElementById("s3-sankey").style.marginTop = (explainerMid - linechartBottom - 20) + "px";

  requestAnimationFrame(() => drawS3Sankey());
}

// ── Line chart: median price vs max purchasing power ──────────────────────────
function drawS3LineChart() {
  const container = d3.select("#s3-linechart");
  container.selectAll("*").remove();

  const years = [2020, 2021, 2022, 2023, 2024, 2025];
  const fts   = s3FT === "ALL" ? flatTypesNoAll : [s3FT];
  const ageKey = s3Age === "25-29" ? "max_25_29" : "max_30_34";

  // Median price series — average across flat types if ALL, else single ft
  const priceSeries = years.map(yr => {
    if (s3Town === "ALL") {
      const towns = [...new Set([...medianData.keys()].map(k => k.split("|")[0]))];
      const prices = [];
      fts.forEach(ft => {
        towns.forEach(t => {
          const row = medianData.get(t + "|" + ft + "|" + yr);
          if (row) prices.push(row.median_price);
        });
      });
      return { year: yr, price: prices.length ? Math.round(d3.median(prices)) : null };
    } else {
      const prices = [];
      fts.forEach(ft => {
        const row = medianData.get(s3Town + "|" + ft + "|" + yr);
        if (row) prices.push(row.median_price);
      });
      return { year: yr, price: prices.length ? Math.round(d3.median(prices)) : null };
    }
  }).filter(d => d.price !== null);

  // Purchasing power series
  const ppSeries = years.map(yr => {
    const row = affordData.get(yr);
    return row ? { year: yr, price: Math.round(row[ageKey]) } : null;
  }).filter(Boolean);

  const W = document.getElementById("s3-linechart").getBoundingClientRect().width || 400;
  const H = document.getElementById("s3-linechart").getBoundingClientRect().height || 200;
  const m = { top: 24, right: 16, bottom: 48, left: 64 };
  const iW = W - m.left - m.right;
  const iH = H - m.top  - m.bottom;

  const svg = container.append("svg").attr("width", W).attr("height", H)
    .append("g").attr("transform", `translate(${m.left},${m.top})`);

    // Chart title
  svg.append("text")
    .attr("x", -m.left).attr("y", -8)
    .attr("text-anchor", "start")
    .attr("font-family", "Georgia, serif")
    .attr("font-size", "0.85rem")
    .attr("font-weight", "700")
    .attr("fill", "#67000d")
    .text("Price vs Purchasing Power over time");


  const allPrices = [...priceSeries, ...ppSeries].map(d => d.price);
  const x = d3.scalePoint().domain(years).range([0, iW]).padding(0.1);
  const y = d3.scaleLinear().domain([d3.min(allPrices) * 0.85, d3.max(allPrices) * 1.1]).range([iH, 0]);
  const lineGen = d3.line().x(d => x(d.year)).y(d => y(d.price)).curve(d3.curveMonotoneX);

  // Grid
  svg.append("g").call(d3.axisLeft(y).ticks(4).tickSize(-iW))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line").attr("stroke", "#eee"))
    .call(g => g.selectAll("text").attr("font-size", "12px").attr("fill", "#888")
    .text(d => d >= 1000000 ? "$" + (d/1000000).toFixed(1) + "M" : "$" + Math.round(d/1000) + "k"));

  svg.append("g").attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x).tickSize(0))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll("text").attr("font-size", "12px").attr("fill", "#666"));

  // Median price line (solid red)
  svg.append("path").datum(priceSeries)
    .attr("fill", "none").attr("stroke", "#C48329").attr("stroke-width", 2)
    .attr("d", lineGen);

  // Purchasing power line (dotted grey)
  svg.append("path").datum(ppSeries)
    .attr("fill", "none").attr("stroke", "#666").attr("stroke-width", 2)
    .attr("stroke-dasharray", "6,4")
    .attr("d", lineGen);

  // Legend
  const leg = svg.append("g").attr("transform", `translate(0,${iH + 20})`);
  leg.append("line").attr("x1",0).attr("x2",16).attr("y1",8).attr("y2",8).attr("stroke","#C48329").attr("stroke-width",2);
  leg.append("text").attr("x",20).attr("y",12).attr("font-size","12px").attr("fill","#555").text("Median resale price");
  leg.append("line").attr("x1",140).attr("x2",156).attr("y1",8).attr("y2",8).attr("stroke","#666").attr("stroke-width",2).attr("stroke-dasharray","4,3");
  leg.append("text").attr("x",160).attr("y",12).attr("font-size","12px").attr("fill","#555").text("Max purchasing power (Age " + s3Age + ")");

  function getLineTooltipHtml(yr) {
  const ageKey    = s3Age === "25-29" ? "median_25_29" : "median_30_34";
  const ppAgeKey  = s3Age === "25-29" ? "max_25_29" : "max_30_34";
  const currIncome = incomeData.get(yr);
  const currPP     = affordData.get(yr);
  const prevIncome = incomeData.get(yr - 1);
  const prevPP     = affordData.get(yr - 1);

  if (!currIncome || !currPP) return `<strong>${yr}</strong>`;

  const incomeVal = Math.round(currIncome[ageKey]);
  const ppVal     = Math.round(currPP[ppAgeKey]);

  let html = `<strong>${yr}</strong><br>`;

  const priceRow = priceSeries.find(p => p.year === yr);
  const priceVal = priceRow ? priceRow.price : null;
  const prevPrice = priceSeries.find(p => p.year === yr - 1);

  if (yr === 2020 || !prevIncome || !prevPP) {
    if (priceVal) html += `Median resale price: $${d3.format(",")(priceVal)}<br>`;
    html += `Max purchasing power: $${d3.format(",")(ppVal)}<br>`;
    html += `Median income: $${d3.format(",")(incomeVal)}`;
  } else {
    const prevIncomeVal = Math.round(prevIncome[ageKey]);
    const prevPPVal     = Math.round(prevPP[ppAgeKey]);
    const incomePct     = Math.round((incomeVal - prevIncomeVal) / prevIncomeVal * 100);
    const ppPct         = Math.round((ppVal - prevPPVal) / prevPPVal * 100);
    const sign          = v => v >= 0 ? "+" : "";

    if (priceVal && prevPrice) {
      const pricePct = Math.round((priceVal - prevPrice.price) / prevPrice.price * 100);
      html += `Median resale price: $${d3.format(",")(priceVal)} (${sign(pricePct)}${pricePct}% from ${yr-1})<br>`;
    }
    html += `Max purchasing power: $${d3.format(",")(ppVal)} (${sign(ppPct)}${ppPct}% from ${yr-1})<br>`;
    html += `Median income: $${d3.format(",")(incomeVal)} (${sign(incomePct)}${incomePct}% from ${yr-1})`;
  }
  return html;
 }

  // Tooltip dots
   [{ series: priceSeries, color: "#C48329", label: "Median price" },
   { series: ppSeries,    color: "#666",    label: "Max purchasing power" }]
   .forEach(({ series, color, label }) => {
    svg.selectAll(null).data(series).join("circle")
      .attr("cx", d => x(d.year)).attr("cy", d => y(d.price))
      .attr("r", 4).attr("fill", color).attr("stroke", "white").attr("stroke-width", 1)
      .on("mouseover", (event, d) => {
        tooltip.style("opacity", 0.95)
          .style("left", (event.clientX + 12) + "px")
          .style("top",  (event.clientY - 28) + "px")
          .html(getLineTooltipHtml(d.year));
      })
      .on("mouseleave", () => tooltip.style("opacity", 0));
  });
}

// ── Diverging bar chart: affordability gap by year ────────────────────────────
function drawS3Diverging() {
  const container = d3.select("#s3-diverging");
  container.selectAll("*").remove();

  const years  = [2020, 2021, 2022, 2023, 2024, 2025];
  const fts    = s3FT === "ALL" ? flatTypesNoAll : [s3FT];
  const ageKey = s3Age === "25-29" ? "max_25_29" : "max_30_34";

  const gapData = years.map(yr => {
    const ppRow = affordData.get(yr);
    if (!ppRow) return null;
    const maxPP = ppRow[ageKey];

    let medianPrice;
    if (s3Town === "ALL") {
      const towns = [...new Set([...medianData.keys()].map(k => k.split("|")[0]))];
      const prices = [];
      fts.forEach(ft => towns.forEach(t => {
        const row = medianData.get(t + "|" + ft + "|" + yr);
        if (row) prices.push(row.median_price);
      }));
      medianPrice = prices.length ? d3.median(prices) : null;
    } else {
      const prices = [];
      fts.forEach(ft => {
        const row = medianData.get(s3Town + "|" + ft + "|" + yr);
        if (row) prices.push(row.median_price);
      });
      medianPrice = prices.length ? d3.median(prices) : null;
    }

    if (medianPrice === null) return null;
    return { year: yr, gap: Math.round(maxPP - medianPrice) };
  }).filter(Boolean);

  const W = document.getElementById("s3-diverging").getBoundingClientRect().width || 400;
  const H = document.getElementById("s3-diverging").getBoundingClientRect().height || 300;
  const m = { top: 16, right: 80, bottom: 16, left: 48 };
  const iW = W - m.left - m.right;
  const iH = H - m.top  - m.bottom;

  const svg = container.append("svg").attr("width", W).attr("height", H)
    .append("g").attr("transform", `translate(${m.left},${m.top})`);

  const maxAbs = d3.max(gapData, d => Math.abs(d.gap));
  const x = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([0, iW]);
  const y = d3.scaleBand().domain(years).range([0, iH]).padding(0.25);
  const mid = x(0);

  // Zero line
  svg.append("line")
    .attr("x1", mid).attr("x2", mid).attr("y1", 0).attr("y2", iH)
    .attr("stroke", "#ccc").attr("stroke-width", 1);

  // Bars
  svg.selectAll(".gap-bar").data(gapData).join("rect")
    .attr("class", "gap-bar")
    .attr("x",      d => d.gap >= 0 ? mid : x(d.gap))
    .attr("y",      d => y(d.year))
    .attr("width",  d => Math.abs(x(d.gap) - mid))
    .attr("height", y.bandwidth())
    .attr("fill",   d => d.gap >= 0 ? "#514A2E" : "#8B3B36")
    .attr("rx", 2)
    .on("mouseover", (event, d) => {
      const label = d.gap >= 0 ? "Affordable by" : "Unaffordable by";
      tooltip.style("opacity", 0.95)
        .style("left", (event.clientX + 12) + "px")
        .style("top",  (event.clientY - 28) + "px")
        .html(`<strong>${d.year}</strong><br>${label}: <b>$${d3.format(",")(Math.abs(d.gap))}</b>`);
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));

  // Year labels
  svg.selectAll(".year-label").data(gapData).join("text")
    .attr("x", d => d.gap >= 0 ? mid - 8 : mid + 8)
    .attr("y", d => y(d.year) + y.bandwidth() / 2)
    .attr("text-anchor", d => d.gap >= 0 ? "end" : "start")
    .attr("dominant-baseline", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "600")
    .attr("fill", d => d.gap >= 0 ? "#514A2E" : "#8B3B36")
    .text(d => d.year);

  // Value labels
  svg.selectAll(".val-label").data(gapData).join("text")
    .attr("x", iW + 8)
    .attr("y", d => y(d.year) + y.bandwidth() / 2)
    .attr("text-anchor", "start")
    .attr("dominant-baseline", "middle")
    .attr("font-size", "12px")
    .attr("fill", d => d.gap >= 0 ? "#514A2E" : "#8B3B36")
    .text(d => (d.gap >= 0 ? "+" : "") + "$" + d3.format(",")(d.gap));
}

function getCoolingMeasureForYear(yr) {
  const measures = coolingData.filter(d => {
    const date = new Date(d.date);
    return date.getFullYear() === yr;
  });
  if (!measures.length) return null;
  const m = measures[0];
  const date = new Date(m.date);
  const dateStr = date.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
  // find previous ltv
  const allSorted = [...coolingData].sort((a, b) => new Date(a.date) - new Date(b.date));
  const idx = allSorted.findIndex(d => d.date === m.date);
  const prevLTV = idx > 0 ? Math.round(allSorted[idx - 1].ltv * 100) : null;
  const currLTV = Math.round(m.ltv * 100);
  return prevLTV !== null
    ? `${dateStr} — LTV tightened from ${prevLTV}% to ${currLTV}%`
    : `${dateStr} — LTV set to ${currLTV}%`;
}

// Smart tooltip so it positions itself without being cut off by margins
function getTooltipPos(event) {
  const tooltipW = 280;
  const tooltipH = 120;
  const padding  = 12;
  const left = event.clientX + padding + tooltipW > window.innerWidth
    ? event.clientX - tooltipW - padding
    : event.clientX + padding;
  const top = event.clientY + tooltipH > window.innerHeight
    ? event.clientY - tooltipH - padding
    : event.clientY - 28;
  return { left, top };
}

function drawS3Sankey() {
  const container = d3.select("#s3-sankey");
  container.selectAll("*").remove();

  const years = [2020, 2021, 2022, 2023, 2024, 2025];
  const fts   = s3FT === "ALL" ? flatTypesNoAll : [s3FT];

  const priceByYear = years.map(yr => {
    const rows = [];
    if (s3Town === "ALL") {
      const towns = [...new Set([...medianData.keys()].map(k => k.split("|")[0]))];
      fts.forEach(ft => towns.forEach(t => {
        const row = medianData.get(t + "|" + ft + "|" + yr);
        if (row) rows.push(row);
      }));
    } else {
      fts.forEach(ft => {
        const row = medianData.get(s3Town + "|" + ft + "|" + yr);
        if (row) rows.push(row);
      });
    }
    const price = rows.length ? d3.median(rows, r => r.median_price) : null;
    const ltv   = rows.length ? d3.median(rows, r => r.ltv) : null;
    return { year: yr, price, ltv };
  }).filter(d => d.price !== null && d.ltv !== null);

  function getTooltipHtml(yr) {
  const yearData  = priceByYear.find(p => p.year === yr);
  const baseData  = priceByYear.find(p => p.year === 2020);
  const cooling   = getCoolingMeasureForYear(yr);

  const loanAmt   = Math.round(yearData.price * yearData.ltv);
  const cashAmt   = Math.round(yearData.price * (1 - yearData.ltv));

  let html = `<strong>Year: ${yr}</strong><br>`;

  if (yr === 2020 || !baseData) {
    html += `Median Price: $${d3.format(",")(Math.round(yearData.price))}<br>`;
    html += `Loan (${Math.round(yearData.ltv * 100)}%): $${d3.format(",")(loanAmt)}<br>`;
    html += `Cash + CPF (${Math.round((1 - yearData.ltv) * 100)}%): $${d3.format(",")(cashAmt)}`;
  } else {
    const baseLoanAmt = Math.round(baseData.price * baseData.ltv);
    const baseCashAmt = Math.round(baseData.price * (1 - baseData.ltv));
    const pricePct    = Math.round((yearData.price - baseData.price) / baseData.price * 100);
    const loanPct     = Math.round((loanAmt - baseLoanAmt) / baseLoanAmt * 100);
    const cashPct     = Math.round((cashAmt - baseCashAmt) / baseCashAmt * 100);
    const sign        = v => v >= 0 ? "+" : "";

    html += `Median Price: $${d3.format(",")(Math.round(yearData.price))} (${sign(pricePct)}${pricePct}% from 2020)<br>`;
    html += `Loan (${Math.round(yearData.ltv * 100)}%): $${d3.format(",")(loanAmt)} (${sign(loanPct)}${loanPct}% from 2020)<br>`;
    html += `Cash + CPF (${Math.round((1 - yearData.ltv) * 100)}%): $${d3.format(",")(cashAmt)} (${sign(cashPct)}${cashPct}% from 2020)`;
  }

  if (cooling) html += `<br><span style="color:#c0392b;font-size:12px">⚠ Cooling measure: ${cooling}</span>`;
  return html;
}

  const W = document.getElementById("s3-sankey").offsetWidth  || 500;
  const H = document.getElementById("s3-sankey").offsetHeight || 500;
  const m = { top: 24, right: 0, bottom: 10, left: 0 };
  const iW = W - m.left - m.right;
  const iH = H - m.top  - m.bottom;

  const svg = container.append("svg")
    .attr("width",  W)
    .attr("height", H)
    .append("g")
    .attr("transform", `translate(${m.left},${m.top})`);
  
  // Chart title
  svg.append("text")
    .attr("x", 0).attr("y", -8)
    .attr("text-anchor", "start")
    .attr("font-family", "Georgia, serif")
    .attr("font-size", "0.85rem")
    .attr("font-weight", "700")
    .attr("fill", "#67000d")
    .text("The Hidden Burden: Cash and CPF Required");

  const graphNodes = [];
  const graphLinks = [];

  priceByYear.forEach(d => {
    graphNodes.push({ name: String(d.year) });
  });
  graphNodes.push({ name: "Loan" });
  graphNodes.push({ name: "Cash + CPF" });

  const loanIdx = graphNodes.findIndex(n => n.name === "Loan");
  const cashIdx = graphNodes.findIndex(n => n.name === "Cash + CPF");

  priceByYear.forEach((d, i) => {
    graphLinks.push({ source: i, target: loanIdx, value: Math.round(d.price * d.ltv),        year: d.year });
    graphLinks.push({ source: i, target: cashIdx,  value: Math.round(d.price * (1 - d.ltv)), year: d.year });
  });

  const sankeyGen = d3.sankey()
    .nodeWidth(20)
    .nodePadding(10)
    .extent([[0, 0], [iW, iH]]);

  const graph = sankeyGen({
    nodes: graphNodes.map(d => Object.assign({}, d)),
    links: graphLinks.map(d => Object.assign({}, d))
  });

  const path = d3.sankeyLinkHorizontal();

  // ── highlight helpers ──
  function highlightYear(yr) {
    link.style("stroke-opacity", d => d.year === yr ? 0.75 : 0.05);
    node.select("rect").style("opacity", d => {
      if (d.name === String(yr)) return 1;
      if (d.name === "Loan" || d.name === "Cash + CPF") return 1;
      return 0.1;
    });
  }

  function resetHighlight() {
    link.style("stroke-opacity", 0.4);
    node.select("rect").style("opacity", 1);
    tooltip.style("opacity", 0);
  }

  // ── Links ──
  const link = svg.append("g").selectAll(".s3-link")
    .data(graph.links)
    .enter().append("path")
    .attr("class", "s3-link")
    .attr("d", path)
    .style("stroke-width", d => Math.max(1, d.width))
    .style("fill", "none")
    .style("stroke", d => d.target.name === "Loan" ? "#CF9860" : "#A2B4B7")
    .style("stroke-opacity", 0.4)
    .on("mouseover", function(event, d) {
      const yr = d.year;
      const yearData = priceByYear.find(p => p.year === yr);
      highlightYear(yr);
      tooltip.style("opacity", 0.95)
        .style("left", getTooltipPos(event).left + "px")
        .style("top",  getTooltipPos(event).top + "px")
        .html(getTooltipHtml(yr));
    })
    .on("mouseleave", resetHighlight);

  // ── Nodes ──
  const node = svg.append("g").selectAll(".s3-node")
    .data(graph.nodes)
    .enter().append("g")
    .attr("class", "s3-node")
    .attr("transform", d => `translate(${d.x0},${d.y0})`);

  node.append("rect")
    .attr("height", d => d.y1 - d.y0)
    .attr("width",  d => d.x1 - d.x0)
    .style("fill",   d => d.name === "Loan" ? "#CF9860" : d.name === "Cash + CPF" ? "#A2B4B7" : "#6B3A2A")
    .style("stroke", d => d3.rgb(d.name === "Loan" ? "#CF9860" : d.name === "Cash + CPF" ? "#A2B4B7" : "#6B3A2A").darker(1))
    .on("mouseover", function(event, d) {
      // if year node, highlight that year; if Loan/Cash node, skip year highlight
      const yr = parseInt(d.name);
      if (!isNaN(yr)) {
        const yearData = priceByYear.find(p => p.year === yr);
        highlightYear(yr);
         tooltip.style("opacity", 0.95)
          .style("left", getTooltipPos(event).left + "px")
          .style("top",  getTooltipPos(event).top + "px")
          .html(getTooltipHtml(yr));
      } else {
         tooltip.style("opacity", 0.95)
        .style("left", getTooltipPos(event).left + "px")
        .style("top",  getTooltipPos(event).top + "px")
        .html(`<strong>${d.name}</strong><br>Total: <b>$${d3.format(",")(d.value)}</b>`);
      }
    })
    .on("mouseleave", resetHighlight);

  node.append("text")
    .attr("x", d => d.x0 < iW / 2 ? (d.x1 - d.x0) + 6 : -6)
    .attr("y", d => (d.y1 - d.y0) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", d => d.x0 < iW / 2 ? "start" : "end")
    .attr("font-size", "16px")
    .attr("fill", "#444")
    .text(d => d.name);
}
// ══════════════════════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════════════════════

Promise.all([
  d3.csv("data/price_change.csv"),
  d3.csv("data/town_median_yearly.csv"),
  d3.json("data/town_geom.json"),
  d3.csv("data/affordability_annual.csv"),
  d3.json("data/cooling_measures.json"),
  d3.csv("data/income_medians.csv"),
]).then(([csv, medianCsv, geo, affordCsv, coolingMeasures, incomeCsv]) => {

  // Load price data (exactly as your original)
  csv.forEach(row => {
    const key = row.town.trim() + "|" + row.flat_type.trim() + "|" + row.year.trim();
    priceData.set(key, +row.pct_change);
  });
 
  medianCsv.forEach(row => {
    const key = row.town.trim() + "|" + row.flat_type.trim() + "|" + row.year.trim();
    medianData.set(key, { median_price: +row.median_price, volume: +row.volume, ltv: +row.ltv });
  });

  affordCsv.forEach(row => {
    affordData.set(+row.year, {
      max_25_29: +row.max_price_25_29,
      max_30_34: +row.max_price_30_34
    });
  });

  coolingData = coolingMeasures;
  
  incomeCsv.forEach(row => {
  incomeData.set(+row.year, {
    median_25_29: +row.median_25_29,
    median_30_34: +row.median_30_34
  });
  });

  // Fix winding order (exactly as your original)
  geo.features.forEach(f => {
    f.geometry.coordinates = f.geometry.coordinates.map(polygon =>
      polygon.map((ring, i) => i === 0 ? ring.slice().reverse() : ring)
    );
  });
  geoData = geo;

  // Init map after layout is ready
  requestAnimationFrame(() => {
    initMap();
    initS3();
  });

  // Scrollama
  const scroller = scrollama();
  scroller.setup({ step: ".step", offset: 0.55 })
    .onStepEnter(({ element }) => {
      document.querySelectorAll(".step").forEach(s => s.classList.remove("is-active"));
      element.classList.add("is-active");
      const sec  = element.dataset.section;
      const step = +element.dataset.step;
      if (sec === "2") {
        if (step <= 4) updateMap(step);
        if (step === 5) enterExploreMode();
      }
    });
  window.addEventListener("resize", () => {
  updateS3();
  requestAnimationFrame(() => alignS3RightColumn());
});

// ── Abbr tooltips using existing D3 tooltip ──
  d3.selectAll("abbr").each(function() {
    const el  = d3.select(this);
    const tip = el.attr("title");
    if (!tip) return;

    el.attr("title", null).attr("data-tip", tip);

    el.on("mouseover", function(event) {
      tooltip
        .style("opacity", 0.95)
        .style("left", (event.clientX + 15) + "px")
        .style("top",  (event.clientY - 30) + "px")
        .html(`<span style="font-size:12px; max-width:220px; display:block">
                 ${el.attr("data-tip")}
               </span>`);
    })
    .on("mousemove", function(event) {
      tooltip
        .style("left", (event.clientX + 15) + "px")
        .style("top",  (event.clientY - 30) + "px");
    })
    .on("mouseleave", function() {
      tooltip.style("opacity", 0);
    });
  });



}).catch(err => {
  console.error("Data load error:", err);
  document.body.innerHTML = `<div style="padding:2rem;color:#c0392b;font-family:sans-serif">
    <h2>Could not load data</h2><p>${err.message}</p>
    <p>Check that <code>data/price_change.csv</code> and <code>data/town_geom.json</code> exist.</p>
  </div>`;
});