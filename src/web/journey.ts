/** Scroll follows the reader; it never captures wheel/touch input or delays the app. */
export function setupJourney(): () => void {
  const section = document.getElementById("how-it-works");
  if (!section) return () => {};
  const track = section.querySelector<HTMLElement>(".journey-track")!;
  const chapters = [...section.querySelectorAll<HTMLElement>("[data-journey-step]")];
  const scenes = [...section.querySelectorAll<HTMLElement>("[data-journey-scene]")];
  const sceneParent = section.querySelector<HTMLElement>(".journey-scenes")!;
  const stage = section.querySelector<HTMLElement>(".journey-stage")!;
  const links = [...section.querySelectorAll<HTMLAnchorElement>(".journey-steps a")];
  const progress = document.getElementById("journey-progress") as HTMLProgressElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const small = matchMedia("(max-width: 720px), (max-height: 660px)");
  let active = 0, frame = 0, fits = true, measureNeeded = true, disposed = false;
  const show = (index: number) => {
    active = index;
    const enhanced = !reduced.matches && !small.matches && fits;
    section.dataset.enhanced = String(enhanced);
    section.dataset.step = String(index);
    scenes.forEach((scene, i) => {
      const parent = enhanced ? sceneParent : chapters[i]!;
      if (scene.parentElement !== parent) parent.append(scene);
      scene.classList.toggle("is-active", i === index);
      if (enhanced && i !== index) scene.setAttribute("aria-hidden", "true");
      else scene.removeAttribute("aria-hidden");
    });
    links.forEach((link, i) => { if (i === index) link.setAttribute("aria-current", "step"); else link.removeAttribute("aria-current"); });
  };
  const update = () => {
    frame = 0;
    if (document.hidden || !section.getClientRects().length) return;
    if (measureNeeded) {
      // Measure the grid's tallest scene with the real font and available height.
      // Inline fallback must not prevent a later resize from trying sticky again.
      fits = true; show(active);
      if (section.dataset.enhanced === "true" && stage.getBoundingClientRect().height > window.innerHeight - 48) { fits = false; show(active); }
      measureNeeded = false;
    }
    const viewport = window.innerHeight, bounds = track.getBoundingClientRect();
    if (bounds.bottom < 0 || bounds.top > viewport) return;
    let closest = 0, distance = Infinity;
    chapters.forEach((chapter, i) => {
      const rect = chapter.getBoundingClientRect();
      const delta = Math.abs(rect.top + rect.height / 2 - viewport / 2);
      if (delta < distance) { closest = i; distance = delta; }
    });
    show(closest);
    progress.value = Math.max(0, Math.min(1, (viewport / 2 - bounds.top) / Math.max(1, bounds.height - viewport / 2)));
  };
  const schedule = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(update); };
  const resize = () => { measureNeeded = true; schedule(); };
  const preference = () => { measureNeeded = true; show(active); schedule(); };
  const jump = (event: Event) => {
    const index = links.indexOf(event.currentTarget as HTMLAnchorElement);
    if (index < 0) return;
    event.preventDefault(); show(index);
    chapters[index]!.scrollIntoView({ behavior: reduced.matches ? "instant" : "smooth", block: "center" });
    const heading = chapters[index]!.querySelector<HTMLElement>("h3")!;
    heading.tabIndex = -1; heading.focus({ preventScroll: true });
  };
  links.forEach(link => link.addEventListener("click", jump));
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", schedule);
  document.addEventListener("aklik-deployer:viewchange", resize);
  reduced.addEventListener("change", preference); small.addEventListener("change", preference);
  show(0); update();
  void document.fonts?.ready.then(() => { if (!disposed) resize(); }, () => {});
  return () => {
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule); window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", schedule);
    document.removeEventListener("aklik-deployer:viewchange", resize);
    reduced.removeEventListener("change", preference); small.removeEventListener("change", preference);
    links.forEach(link => link.removeEventListener("click", jump));
  };
}
