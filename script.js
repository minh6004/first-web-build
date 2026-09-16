const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

function drawRoughDividers() {
  if (typeof rough === "undefined") return;

  const dividerColor =
    getComputedStyle(document.documentElement).getPropertyValue("--color-border").trim() || "#e2e2e2";
  const svgs = document.querySelectorAll(".rough-divider-svg");

  svgs.forEach((svg) => {
    const width = svg.parentElement.clientWidth;
    if (!width) return;

    svg.innerHTML = "";
    svg.setAttribute("viewBox", `0 0 ${width} 12`);

    const rc = rough.svg(svg);
    const y1 = 5 + Math.random() * 2;
    const y2 = 5 + Math.random() * 2;
    const line = rc.line(2, y1, width - 2, y2, {
      stroke: dividerColor,
      strokeWidth: 1.25,
      roughness: 1.7,
      bowing: 1.2,
    });
    svg.appendChild(line);
  });
}

drawRoughDividers();

let roughResizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(roughResizeTimer);
  roughResizeTimer = setTimeout(drawRoughDividers, 150);
});
