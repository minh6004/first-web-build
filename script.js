const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

const ROUGH_ROUGHNESS = 2.2; // same value used for section dividers, kept in sync for the box/inner-divider extension
const ROUGH_BOWING = 2;

function roughColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--color-divider-rough").trim() || "#a8a8a8";
}

function drawRoughDividers() {
  const color = roughColor();
  const svgs = document.querySelectorAll(".rough-divider > .rough-divider-svg");

  svgs.forEach((svg) => {
    const width = svg.parentElement.clientWidth;
    if (!width) return;

    svg.innerHTML = "";
    svg.setAttribute("viewBox", `0 0 ${width} 12`);

    const rc = rough.svg(svg);
    const y1 = 4 + Math.random() * 4;
    const y2 = 4 + Math.random() * 4;
    const line = rc.line(2, y1, width - 2, y2, {
      stroke: color,
      strokeWidth: 2,
      roughness: ROUGH_ROUGHNESS,
      bowing: ROUGH_BOWING,
    });
    svg.appendChild(line);
  });
}

function drawRoughBoxes() {
  const color = roughColor();

  document.querySelectorAll(".rough-box").forEach((box) => {
    let svg = box.querySelector(":scope > .rough-box-svg");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "rough-box-svg");
      svg.setAttribute("aria-hidden", "true");
      box.insertBefore(svg, box.firstChild);
    }

    const width = box.clientWidth;
    const height = box.clientHeight;
    if (!width || !height) return;

    svg.innerHTML = "";
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const rc = rough.svg(svg);
    const rect = rc.rectangle(2, 2, width - 4, height - 4, {
      stroke: color,
      strokeWidth: 1.5,
      roughness: ROUGH_ROUGHNESS,
      bowing: ROUGH_BOWING,
      fill: "none",
    });
    svg.appendChild(rect);
  });
}

// Draws hand-drawn lines under every item except the last, inside `containerEl`
// (which must be position:relative). `widthEl` (defaults to containerEl) supplies
// the line length -- e.g. the actual <table>, which can be wider than its
// scrollable wrapper on mobile.
function drawRoughInnerDividers(containerEl, items, widthEl, includeAfterLast) {
  if (!containerEl || items.length < 2) return;

  let overlay = containerEl.querySelector(":scope > .rough-inner-dividers");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "rough-inner-dividers";
    overlay.setAttribute("aria-hidden", "true");
    containerEl.appendChild(overlay);
  }
  overlay.innerHTML = "";

  const containerRect = containerEl.getBoundingClientRect();
  const width = (widthEl || containerEl).offsetWidth;
  if (!width) return;
  const color = roughColor();

  items.forEach((item, i) => {
    if (i === items.length - 1 && !includeAfterLast) return;

    const itemRect = item.getBoundingClientRect();
    const y = itemRect.bottom - containerRect.top;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "rough-divider-svg");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = `${y - 5}px`;
    svg.style.width = `${width}px`;
    svg.style.height = "10px";
    svg.setAttribute("viewBox", `0 0 ${width} 10`);
    overlay.appendChild(svg);

    const rc = rough.svg(svg);
    const y1 = 4 + Math.random() * 2;
    const y2 = 4 + Math.random() * 2;
    const line = rc.line(0, y1, width, y2, {
      stroke: color,
      strokeWidth: 1.5,
      roughness: ROUGH_ROUGHNESS,
      bowing: 1.5,
    });
    svg.appendChild(line);
  });
}

function drawRoughInnerAll() {
  document.querySelectorAll(".table-scroll").forEach((wrap) => {
    const table = wrap.querySelector(".ranking-table");
    if (table) drawRoughInnerDividers(wrap, Array.from(table.querySelectorAll("tr")), table, true);
  });
}

function redrawAllRough() {
  if (typeof rough === "undefined") return;
  document.documentElement.classList.add("rough-ready");
  drawRoughDividers();
  drawRoughBoxes();
  drawRoughInnerAll();
}

redrawAllRough();

let roughResizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(roughResizeTimer);
  roughResizeTimer = setTimeout(redrawAllRough, 150);
});
