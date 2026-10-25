import { setupStoryboard } from "./storyboard";

/** App navigation and keyboard access. Work never waits for an animation. */
export function setupExperience(openView: (name: string) => void, inspectExample: () => void): void {
  const menu = document.getElementById("menu-toggle") as HTMLButtonElement;
  const compact = matchMedia("(max-width: 1000px)");
  const input = document.getElementById("search-input") as HTMLTextAreaElement;
  const setMenu = (open: boolean) => {
    document.body.dataset.menuOpen = String(open);
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-label", open ? "Navigation schließen" : "Navigation öffnen");
  };
  const go = (name: string) => {
    setMenu(false); openView(name);
  };
  menu.addEventListener("click", () => setMenu(menu.getAttribute("aria-expanded") !== "true"));
  compact.addEventListener("change", () => setMenu(false));
  for (const button of document.querySelectorAll<HTMLElement>("[data-open-view]")) button.addEventListener("click", () => go(button.dataset.openView!));
  // app.ts owns .nav view changes; this listener supplies focus and menu handling.
  for (const button of document.querySelectorAll<HTMLElement>(".nav")) button.addEventListener("click", () => {
    setMenu(false);
  });
  document.getElementById("story-try")!.addEventListener("click", () => { go("analyze"); inspectExample(); });
  document.getElementById("journey-inspect")!.addEventListener("click", () => { go("analyze"); inspectExample(); });
  document.getElementById("journey-start")!.addEventListener("click", () => {
    go("discover");
    input.focus({ preventScroll: true });
    document.getElementById("search-form")!.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
  });
  setupStoryboard();
  document.getElementById("hero-idea-form")!.addEventListener("submit",event=>{
    event.preventDefault();const idea=(document.getElementById("hero-idea") as HTMLInputElement).value.trim();
    if(idea.length<3)return;input.value=idea;go("discover");(document.getElementById("search-form") as HTMLFormElement).requestSubmit();
  });
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href="#how-it-works"]')) anchor.addEventListener("click", event => {
    event.preventDefault();
    if (document.body.dataset.view !== "home") go("home");
    const section = document.getElementById("how-it-works")!;
    section.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    const title = document.getElementById("journey-title")!; title.tabIndex = -1; title.focus({ preventScroll: true });
  });
  document.getElementById("hero-inspect")!.addEventListener("click", () => { go("analyze"); inspectExample(); });
  document.getElementById("new-search")!.addEventListener("click", () => {
    go("discover"); delete document.body.dataset.searchState;
    document.getElementById("welcome")!.hidden = false;
    document.getElementById("search-results")!.replaceChildren();
    document.getElementById("new-search")!.hidden = true;
    input.focus(); input.select();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") { setMenu(false); menu.focus(); return; }
    if (event.isComposing) return;
    const target = event.target as HTMLElement | null;
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && target === input) {
      event.preventDefault();
      if (!(document.getElementById("search-submit") as HTMLButtonElement).disabled) (document.getElementById("search-form") as HTMLFormElement).requestSubmit();
    }
    const editing = typeof target?.closest === "function" && target.closest("input, textarea, select, [contenteditable]");
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !editing) {
      event.preventDefault(); go("discover"); input.focus();
    }
  });
}
