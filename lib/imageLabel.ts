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
