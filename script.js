const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

function drawRoughDividers() {
  if (typeof rough === "undefined") return;

  const dividerColor =
    getComputedStyle(document.documentElement).getPropertyValue("--color-divider-rough").trim() || "#a8a8a8";
  const svgs = document.querySelectorAll(".rough-divider-svg");

  svgs.forEach((svg) => {
    const width = svg.parentElement.clientWidth;
    if (!width) return;

    svg.innerHTML = "";
    svg.setAttribute("viewBox", `0 0 ${width} 12`);

    const rc = rough.svg(svg);
    const y1 = 4 + Math.random() * 4;
    const y2 = 4 + Math.random() * 4;
    const line = rc.line(2, y1, width - 2, y2, {
      stroke: dividerColor,
      strokeWidth: 2,
      roughness: 2.2,
      bowing: 2,
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
