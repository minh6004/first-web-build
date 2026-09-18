const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

const eventListEl = document.querySelector(".event-list");

if (eventListEl) {
  eventListEl.addEventListener("click", (event) => {
    const button = event.target.closest(".event-summary");
    if (!button) return;

    const detail = document.getElementById(button.getAttribute("aria-controls"));
    if (!detail) return;

    const isOpen = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!isOpen));
    detail.classList.toggle("is-open", !isOpen);
    detail.inert = isOpen;
  });
}

const coverEl = document.getElementById("cover");
const enterMainBtn = document.getElementById("enterMainBtn");
const pullHandleEl = document.getElementById("pullHandle");
const siteHeaderEl = document.getElementById("siteHeader");
const mainEl = document.getElementById("main");
const siteFooterEl = document.getElementById("siteFooter");

enterMainBtn.addEventListener("click", () => {
  if (enterMainBtn.disabled) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // unhides header/main/footer so they're already laid out behind the (still
  // fully covering) cover screen before it rolls away -- no white flash
  const showMainContent = () => {
    siteHeaderEl.hidden = false;
    mainEl.hidden = false;
    siteFooterEl.hidden = false;
  };

  const finish = () => {
    coverEl.hidden = true;
    redrawAllRough(); // rough-box/divider sizes were 0 while main was display:none
  };

  if (reduceMotion) {
    showMainContent();
    finish();
    return;
  }

  enterMainBtn.disabled = true;
  pullHandleEl.classList.add("is-pulled"); // stage 1: handle gets tugged down

  setTimeout(() => {
    showMainContent();
    coverEl.classList.add("is-hiding"); // stage 2: whole cover rolls up and away
    setTimeout(finish, 460);
  }, 150);
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

function drawRoughArrows() {
  const color = roughColor();

  document.querySelectorAll(".event-arrow-svg").forEach((svg) => {
    svg.innerHTML = "";
    svg.setAttribute("viewBox", "0 0 20 20");

    const rc = rough.svg(svg);
    const path = rc.linearPath(
      [
        [4, 7],
        [10, 14],
        [16, 7],
      ],
      {
        stroke: color,
        strokeWidth: 2,
        roughness: ROUGH_ROUGHNESS,
        bowing: ROUGH_BOWING,
      }
    );
    svg.appendChild(path);
  });
}

function drawRoughPullString() {
  const svg = document.querySelector(".pull-string-svg");
  if (!svg) return;

  const width = svg.clientWidth;
  const height = svg.clientHeight;
  if (!width || !height) return;

  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const rc = rough.svg(svg);
  const x1 = width / 2 + (Math.random() - 0.5) * 2;
  const x2 = width / 2 + (Math.random() - 0.5) * 2;
  const line = rc.line(x1, 1, x2, height - 1, {
    stroke: roughColor(),
    strokeWidth: 1.5,
    roughness: ROUGH_ROUGHNESS,
    bowing: ROUGH_BOWING,
  });
  svg.appendChild(line);
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
  drawRoughArrows();
  drawRoughInnerAll();
  drawRoughPullString();
}

redrawAllRough();

let roughResizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(roughResizeTimer);
  roughResizeTimer = setTimeout(redrawAllRough, 150);
});
