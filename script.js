import { initNavAuth } from "./nav-auth.js";

initNavAuth();

const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

const eventGridEl = document.querySelector(".event-grid");
const eventBackdropEl = document.getElementById("eventLightboxBackdrop");

function closeEventLightbox() {
  const openCard = document.querySelector(".event-card.is-expanded");
  if (!openCard) return;

  const button = openCard.querySelector(".event-zoom");
  const detail = openCard.querySelector(".event-detail-wrap");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", "자세히 보기");
  detail.classList.remove("is-open");
  detail.inert = true;
  openCard.classList.remove("is-expanded");
  openCard.removeAttribute("role");
  openCard.removeAttribute("aria-modal");
  eventBackdropEl.classList.remove("is-visible");
  button.focus();
}

if (eventGridEl && eventBackdropEl) {
  eventGridEl.addEventListener("click", (event) => {
    const button = event.target.closest(".event-zoom");
    if (!button) return;

    const isOpen = button.getAttribute("aria-expanded") === "true";
    if (isOpen) {
      closeEventLightbox();
      return;
    }

    const card = button.closest(".event-card");
    const detail = document.getElementById(button.getAttribute("aria-controls"));
    if (!card || !detail) return;

    closeEventLightbox(); // only one card open at a time

    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", "닫기");
    detail.classList.add("is-open");
    detail.inert = false;
    card.classList.add("is-expanded");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    eventBackdropEl.classList.add("is-visible");
  });

  eventBackdropEl.addEventListener("click", closeEventLightbox);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeEventLightbox();
  });
}

const coverEl = document.getElementById("cover");
const enterMainBtn = document.getElementById("enterMainBtn");
const siteHeaderEl = document.getElementById("siteHeader");
const mainEl = document.getElementById("main");
const siteFooterEl = document.getElementById("siteFooter");

enterMainBtn.addEventListener("click", () => {
  if (enterMainBtn.disabled) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // unhides header/main/footer so they're already laid out behind the (still
  // fully covering) cover screen before it fades away -- no white flash
  const showMainContent = () => {
    siteHeaderEl.hidden = false;
    mainEl.hidden = false;
    siteFooterEl.hidden = false;
  };

  const finish = () => {
    coverEl.hidden = true;
  };

  if (reduceMotion) {
    showMainContent();
    finish();
    return;
  }

  enterMainBtn.disabled = true;
  showMainContent();
  // showMainContent() just triggered a big layout (the whole main screen).
  // Starting the fade in the same tick makes that layout/paint compete with
  // the animation's first frames and stutter -- wait two rAFs so the (still
  // hidden behind the cover) layout settles first.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      coverEl.classList.add("is-hiding"); // fade + scale down and out
      setTimeout(finish, 350);
    });
  });
});
