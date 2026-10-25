/** Native adaptation of Container Scroll Animation by Manu Arora (MIT),
 * retrieved through 21st MCP (demo 1081). See THIRD_PARTY_NOTICES.md.
 * Keeps its 20°→0° scroll rotation, with product-specific scale/travel and static fallbacks. */
export function heroTransform(progress: number): string {
  const p = Math.max(0, Math.min(1, progress));
  return `perspective(1000px) rotateX(${(20 * (1 - p)).toFixed(3)}deg) scale(${(.9 + .1 * p).toFixed(4)}) translate3d(0,${(-36 * p).toFixed(3)}px,0)`;
}
export function setupHero(): () => void {
  const section = document.getElementById("hero-scroll"), preview = document.getElementById("hero-preview");
  if (!section || !preview) return () => {};
  const compact = matchMedia("(max-width: 900px), (max-height: 740px)");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0, needsMeasure = true, fits = true, disposed = false;
  const mode = () => {
    const enabled = !compact.matches && !reduced.matches && fits;
    section.dataset.enhanced = String(enabled);
    if (!enabled) { preview.style.transform = "none"; section.dataset.progress = "1"; }
    return enabled;
  };
  const update = () => {
    frame = 0;
    if (document.hidden || !section.getClientRects().length) return;
    if (needsMeasure) { fits = preview.offsetHeight + 140 <= window.innerHeight; needsMeasure = false; }
    if (!mode()) return;
    const bounds = section.getBoundingClientRect();
    if (bounds.bottom < 0 || bounds.top > window.innerHeight) return;
    const p = Math.max(0, Math.min(1, -bounds.top / Math.max(1, bounds.height - window.innerHeight)));
    preview.style.transform = heroTransform(p); section.dataset.progress = p.toFixed(4);
  };
  const schedule = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(update); };
  const resize = () => { needsMeasure = true; mode(); schedule(); };
  window.addEventListener("scroll", schedule, { passive: true }); window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", schedule);
  document.addEventListener("aklik-deployer:viewchange", resize);
  reduced.addEventListener("change", resize); compact.addEventListener("change", resize);
  mode(); update();
  void document.fonts?.ready.then(() => { if (!disposed) resize(); }, () => {});
  return () => {
    disposed = true; if (frame) cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule); window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", schedule); reduced.removeEventListener("change", resize); compact.removeEventListener("change", resize);
    document.removeEventListener("aklik-deployer:viewchange", resize);
  };
}
