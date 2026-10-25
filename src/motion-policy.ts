import { createHash } from "node:crypto";
import { Internals } from "remotion";
// Authorize only the version-matched Player reset, rather than all inline styles.
export const motionStyleHash = "'sha256-" + createHash("sha256").update(Internals.CSSUtils.makeDefaultPreviewCSS(".aklik-deployer-motion", "#fff")).digest("base64") + "'";
