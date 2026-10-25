export function validatePublicUrl(value: string): URL {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      (host.startsWith("[") || /^\d+\.\d+\.\d+\.\d+$/.test(host)) || host === "localhost" || !host.includes(".") ||
      /\.(localhost|local|internal|test|invalid)$/.test(host)) {
    throw new Error("Nur öffentliche HTTPS-Adressen ohne Zugangsdaten und Sonderport sind erlaubt.");
  }
  return url;
}
