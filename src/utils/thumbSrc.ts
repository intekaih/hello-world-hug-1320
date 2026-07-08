export function thumbSrc(url: string, opts?: { w?: number; q?: number }): string {
  if (!url) return "/placeholder.jpg";
  let u = url;
  if (u.startsWith("http://")) u = u.replace("http://", "https://");
  const w = opts?.w ?? 400;
  const q = opts?.q ?? 75;
  return `https://wsrv.nl/?url=${encodeURIComponent(u)}&w=${w}&q=${q}&output=webp`;
}
