// Đoán BANG từ tên thành phố người dùng gõ — trước đây ô Bang mặc định
// California nên ai ở Houston/Dallas quên đổi sẽ thành "Dallas, California"
// (tin tuyển sai chỗ, thợ nhận chuông việc ở bang khác). Chỉ các thành phố
// đông tiệm nail người Việt; không khớp → giữ nguyên lựa chọn của người dùng.

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const US: Record<string, string> = {
  "los angeles": "CA", "san jose": "CA", "san diego": "CA", "sacramento": "CA", "irvine": "CA", "garden grove": "CA",
  "westminster": "CA", "santa ana": "CA", "anaheim": "CA", "san francisco": "CA", "oakland": "CA", "fresno": "CA",
  "fountain valley": "CA", "huntington beach": "CA", "long beach": "CA", "stockton": "CA", "riverside": "CA",
  "houston": "TX", "dallas": "TX", "austin": "TX", "san antonio": "TX", "fort worth": "TX", "arlington": "TX",
  "plano": "TX", "garland": "TX", "sugar land": "TX", "katy": "TX", "irving": "TX", "frisco": "TX",
  "orlando": "FL", "miami": "FL", "tampa": "FL", "jacksonville": "FL", "fort lauderdale": "FL",
  "new york": "NY", "brooklyn": "NY", "queens": "NY", "bronx": "NY", "manhattan": "NY",
  "seattle": "WA", "tacoma": "WA", "bellevue": "WA", "spokane": "WA",
  "atlanta": "GA", "norcross": "GA", "duluth": "GA", "savannah": "GA",
  "charlotte": "NC", "raleigh": "NC", "greensboro": "NC",
  "richmond": "VA", "virginia beach": "VA", "falls church": "VA", "arlington va": "VA",
  "phoenix": "AZ", "tucson": "AZ", "mesa": "AZ", "chandler": "AZ",
  "chicago": "IL", "naperville": "IL",
};
const AU: Record<string, string> = {
  "sydney": "NSW", "parramatta": "NSW", "bankstown": "NSW", "cabramatta": "NSW", "fairfield": "NSW", "liverpool": "NSW",
  "melbourne": "VIC", "footscray": "VIC", "springvale": "VIC", "sunshine": "VIC", "richmond vic": "VIC", "geelong": "VIC",
  "brisbane": "QLD", "gold coast": "QLD", "inala": "QLD", "cairns": "QLD",
  "perth": "WA", "adelaide": "SA", "canberra": "ACT",
};

/** Mã bang đoán từ thành phố (VD "Houston" → "TX"), hoặc null nếu không chắc. */
export function guessState(market: "US" | "AU", city: string): string | null {
  const key = fold(city);
  if (key.length < 3) return null;
  return (market === "US" ? US : AU)[key] ?? null;
}
