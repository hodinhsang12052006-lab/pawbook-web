// One helper for "where does this picture come from" chips (hero, auth, GuestDiscover teaser, catalog).
// Honesty rule: generated pictures always say so; only real work by a real member says "Real work".
export type ImageSource = "flow" | "gemini_api" | "ai" | "render" | "engine" | "photo";

export function imageLabel(source: ImageSource, lang: "en" | "vi", handle?: string | null): string {
  if (source === "render" || source === "engine") return lang === "vi" ? "Minh hoạ thử mẫu" : "Try-on preview";
  if (source === "photo") {
    const h = handle ? ` · @${handle.replace(/^@/, "")}` : "";
    return (lang === "vi" ? "Tác phẩm thật" : "Real work") + h;
  }
  return lang === "vi" ? "Ảnh minh hoạ AI" : "AI illustration";
}

/** One chip / caption for a whole group of pictures from the same source (hero stack, auth plate, phone strips). */
export function clusterLabel(source: ImageSource, lang: "en" | "vi"): string {
  if (source === "render" || source === "engine") return lang === "vi" ? "Minh hoạ thử mẫu" : "Try-on previews";
  if (source === "photo") return lang === "vi" ? "Tác phẩm thật" : "Real work";
  return lang === "vi" ? "Ảnh minh hoạ AI" : "AI illustrations";
}
