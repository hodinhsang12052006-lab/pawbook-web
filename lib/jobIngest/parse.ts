// TÁCH TIN TUYỂN THỢ NAIL từ nguyên văn bài đăng (tiếng Việt / Anh / lẫn lộn):
// SĐT (Mỹ/Úc), tên tiệm, địa chỉ + ZIP/postcode → bang/thành phố, lương, kỹ năng, quyền lợi, tin gấp.
// Thuần hàm (không đụng DB) → dễ kiểm thử: scripts/qa/job_parse_unit.ts

import { anyStateName } from "@/lib/stateNames";

export interface ParsedJob {
  isHiring: boolean;
  market: "US" | "AU" | null;
  phone: string | null; // E.164: +1XXXXXXXXXX / +61XXXXXXXXX
  phoneDisplay: string | null; // (713) 555-0123 / 0412 345 678
  salonName: string | null;
  isSale: boolean; // bài sang / bán tiệm
  address: string | null;
  zip: string | null;
  state: string | null;
  city: string | null;
  salaryType: string;
  salaryAmount: string;
  skills: string[];
  benefits: string[];
  isUrgent: boolean;
  title: string;
}

const US_STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", cali: "CA", colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL",
  georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};
const US_CODES = new Set(Object.values(US_STATE_NAMES).concat(["DC"]));
const AU_STATE_NAMES: Record<string, string> = {
  "new south wales": "NSW", victoria: "VIC", queensland: "QLD", "western australia": "WA", "south australia": "SA", tasmania: "TAS", "northern territory": "NT", "australian capital territory": "ACT",
};
const AU_CODES = new Set(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "NT", "ACT"]);

// Thành phố có nhiều tiệm nail người Việt → bang (khi bài chỉ ghi tên thành phố).
const CITY_STATE: [string, string, "US" | "AU"][] = [
  ["garden grove", "CA", "US"], ["westminster", "CA", "US"], ["santa ana", "CA", "US"], ["fountain valley", "CA", "US"], ["huntington beach", "CA", "US"], ["irvine", "CA", "US"],
  ["anaheim", "CA", "US"], ["los angeles", "CA", "US"], ["san diego", "CA", "US"], ["san jose", "CA", "US"], ["san francisco", "CA", "US"], ["sacramento", "CA", "US"],
  ["oakland", "CA", "US"], ["fresno", "CA", "US"], ["stockton", "CA", "US"], ["riverside", "CA", "US"], ["long beach", "CA", "US"], ["orange county", "CA", "US"],
  ["houston", "TX", "US"], ["dallas", "TX", "US"], ["austin", "TX", "US"], ["san antonio", "TX", "US"], ["fort worth", "TX", "US"], ["arlington", "TX", "US"], ["plano", "TX", "US"],
  ["sugar land", "TX", "US"], ["katy", "TX", "US"], ["pearland", "TX", "US"], ["el paso", "TX", "US"], ["corpus christi", "TX", "US"],
  ["orlando", "FL", "US"], ["tampa", "FL", "US"], ["miami", "FL", "US"], ["jacksonville", "FL", "US"], ["fort lauderdale", "FL", "US"],
  ["atlanta", "GA", "US"], ["seattle", "WA", "US"], ["tacoma", "WA", "US"], ["portland", "OR", "US"], ["phoenix", "AZ", "US"], ["las vegas", "NV", "US"],
  ["denver", "CO", "US"], ["chicago", "IL", "US"], ["new york", "NY", "US"], ["brooklyn", "NY", "US"], ["philadelphia", "PA", "US"], ["boston", "MA", "US"],
  ["charlotte", "NC", "US"], ["raleigh", "NC", "US"], ["nashville", "TN", "US"], ["memphis", "TN", "US"], ["new orleans", "LA", "US"], ["oklahoma city", "OK", "US"],
  ["tulsa", "OK", "US"], ["kansas city", "MO", "US"], ["st louis", "MO", "US"], ["minneapolis", "MN", "US"], ["detroit", "MI", "US"], ["columbus", "OH", "US"],
  ["indianapolis", "IN", "US"], ["louisville", "KY", "US"], ["richmond", "VA", "US"], ["virginia beach", "VA", "US"], ["baltimore", "MD", "US"], ["salt lake city", "UT", "US"],
  ["albuquerque", "NM", "US"], ["omaha", "NE", "US"], ["des moines", "IA", "US"], ["milwaukee", "WI", "US"], ["birmingham", "AL", "US"], ["little rock", "AR", "US"],
  ["sydney", "NSW", "AU"], ["bankstown", "NSW", "AU"], ["cabramatta", "NSW", "AU"], ["parramatta", "NSW", "AU"], ["liverpool", "NSW", "AU"], ["fairfield", "NSW", "AU"],
  ["newcastle", "NSW", "AU"], ["wollongong", "NSW", "AU"], ["melbourne", "VIC", "AU"], ["footscray", "VIC", "AU"], ["springvale", "VIC", "AU"], ["sunshine", "VIC", "AU"],
  ["st albans", "VIC", "AU"], ["geelong", "VIC", "AU"], ["brisbane", "QLD", "AU"], ["gold coast", "QLD", "AU"], ["inala", "QLD", "AU"], ["perth", "WA", "AU"],
  ["adelaide", "SA", "AU"], ["canberra", "ACT", "AU"], ["hobart", "TAS", "AU"], ["darwin", "NT", "AU"],
];

// ZIP Mỹ (3 số đầu) → bang. Gọn theo khoảng.
const ZIP3: [number, number, string][] = [
  [10, 27, "MA"], [28, 29, "RI"], [30, 38, "NH"], [39, 49, "ME"], [50, 59, "VT"], [60, 69, "CT"], [70, 89, "NJ"], [100, 149, "NY"], [150, 196, "PA"], [197, 199, "DE"],
  [200, 205, "DC"], [206, 219, "MD"], [220, 246, "VA"], [247, 268, "WV"], [270, 289, "NC"], [290, 299, "SC"], [300, 319, "GA"], [320, 349, "FL"], [350, 369, "AL"],
  [370, 385, "TN"], [386, 397, "MS"], [398, 399, "GA"], [400, 427, "KY"], [430, 459, "OH"], [460, 479, "IN"], [480, 499, "MI"], [500, 528, "IA"], [530, 549, "WI"],
  [550, 567, "MN"], [570, 577, "SD"], [580, 588, "ND"], [590, 599, "MT"], [600, 629, "IL"], [630, 658, "MO"], [660, 679, "KS"], [680, 693, "NE"], [700, 715, "LA"],
  [716, 729, "AR"], [730, 749, "OK"], [750, 799, "TX"], [800, 816, "CO"], [820, 831, "WY"], [832, 838, "ID"], [840, 847, "UT"], [850, 865, "AZ"], [870, 884, "NM"],
  [889, 898, "NV"], [900, 961, "CA"], [967, 968, "HI"], [970, 979, "OR"], [980, 994, "WA"], [995, 999, "AK"],
];
const usStateFromZip = (zip: string) => { const n = Number(zip.slice(0, 3)); return ZIP3.find(([a, b]) => n >= a && n <= b)?.[2] ?? null; };
const auStateFromPostcode = (pc: string) => {
  const n = Number(pc);
  if ((n >= 2600 && n <= 2618) || (n >= 2900 && n <= 2920)) return "ACT";
  if (n >= 2000 && n <= 2999) return "NSW";
  if (n >= 3000 && n <= 3999) return "VIC";
  if (n >= 4000 && n <= 4999) return "QLD";
  if (n >= 5000 && n <= 5999) return "SA";
  if (n >= 6000 && n <= 6999) return "WA";
  if (n >= 7000 && n <= 7999) return "TAS";
  if (n >= 800 && n <= 999) return "NT";
  return null;
};

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
const titleCase = (s: string) => s.replace(/\s+/g, " ").trim().replace(/\b([a-z])/g, (m) => m.toUpperCase());

/** Tìm SĐT Mỹ/Úc đầu tiên trong bài. */
export function findPhone(text: string): { e164: string; display: string; market: "US" | "AU" } | null {
  const t = text.replace(/[‐-―]/g, "-");
  // Úc: +61 4xx / 04xx xxx xxx (di động) hoặc 02/03/07/08 xxxx xxxx (bàn)
  const au = t.match(/(?:\+?61[\s.-]?|\b0)([2-478](?:[\s.-]?\d){8})\b/);
  // Mỹ: (713) 555-0123 · 713-555-0123 · 713.555.0123 · 7135550123 · +1 713 555 0123
  const us = t.match(/(?:\+?1[\s.-]?)?\(?\b([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})\b/);
  const pick = (() => {
    if (au && us) return (au.index ?? 0) <= (us.index ?? 0) ? "AU" : "US";
    return au ? "AU" : us ? "US" : null;
  })();
  if (pick === "US" && us) {
    const [a, b, c] = [us[1], us[2], us[3]];
    if (a === "555" && b === "555") return null;
    return { e164: `+1${a}${b}${c}`, display: `(${a}) ${b}-${c}`, market: "US" };
  }
  if (pick === "AU" && au) {
    const d = au[1].replace(/\D/g, "");
    if (d.length !== 9) return null;
    const display = d.startsWith("4") ? `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : `(0${d[0]}) ${d.slice(1, 5)} ${d.slice(5)}`;
    return { e164: `+61${d}`, display, market: "AU" };
  }
  return null;
}

const SALON_WORD = /\b(nails?|spa|salon|beauty|lounge|bar|studio)\b/i;
/** Tên tiệm: "Tiệm Lucky Nails", "Happy Nails & Spa", "LV Nail Lounge"… */
export function findSalonName(text: string): string | null {
  // Chữ in đậm kiểu Facebook ("𝗗𝗼𝗿𝗮𝗱𝗼 𝗡𝗮𝗶𝗹 𝗕𝗮𝗿") → chữ thường (NFKC); dòng VIẾT HOA HẾT ("DORADO NAIL BAR
  // WAXAHACHIE") thêm 1 bản Viết Hoa Chữ Đầu để mẫu tên tiệm (phân biệt hoa/thường) bắt được.
  const raw = String(text || "").normalize("NFKC").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const lines = raw.flatMap((l) => (l.length > 3 && l === l.toUpperCase() && /\p{L}{3}/u.test(l) ? [l, l.toLowerCase().replace(/(^|[\s'&-])\p{L}/gu, (m) => m.toUpperCase())] : [l]));
  const pats = [
    /(?:ti[ệe]m|salon|nail salon|t[ạa]i)\s*[:\-–]?\s*([A-Z0-9][\w'’&.\- ]{1,40}?\s(?:Nail\s+(?:Spa|Salon|Lounge|Bar|Studio)|Nails?(?:\s*(?:&|and)\s*Spa)?|Spa|Salon|Beauty(?:\s+Bar)?|Lounge))\b/,
    /\b([A-Z0-9][\w'’&.\-]*(?:\s+[A-Z0-9&][\w'’&.\-]*){0,4}\s(?:Nail\s+(?:Spa|Salon|Lounge|Bar|Studio)|Nails?(?:\s*(?:&|and)\s*Spa)?|Beauty\s+Bar))\b/,
  ];
  for (const re of pats) {
    for (const l of lines) {
      const m = l.match(re);
      if (m) {
        const name = m[1].replace(/^(?:ti[ệe]m|salon|t[ạa]i)\s+/i, "").replace(/\s+/g, " ").trim();
        if (name.length >= 4 && !/^(c[ầa]n|tuy[ểe]n|th[ợo]|need|hiring|looking)\b/i.test(name) && SALON_WORD.test(name)) return name.slice(0, 60);
      }
    }
  }
  return null;
}

const STREET = "(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Hwy|Highway|Pkwy|Parkway|Ln|Lane|Way|Ct|Court|Pl|Place|Plaza|Cir|Circle|Trl|Trail|Fwy|Freeway|Pike|Sq|Square|Ter|Terrace|Cres|Crescent|Pde|Parade|Hwy)";
/** Địa chỉ đầy đủ (Mỹ: "12345 Main St, Houston, TX 77036" · Úc: "Shop 3/45 Smith St, Fitzroy VIC 3065"). */
export function findAddress(text: string) {
  const t = text.replace(/\s+/g, " ");
  const us = t.match(new RegExp(`\\b(\\d{2,6}\\s+[\\w .'#-]{2,40}?\\b${STREET}\\b\\.?(?:[ ,]+(?:Suite|Ste|Unit|#)\\s*[\\w-]+)?)[ ,]+([A-Za-z .'-]{2,30}?)[ ,]+([A-Z]{2})[ ,]+(\\d{5})(?:-\\d{4})?\\b`));
  if (us && US_CODES.has(us[3])) return { address: `${us[1].trim()}, ${titleCase(us[2])}, ${us[3]} ${us[4]}`, city: titleCase(us[2]), state: us[3], zip: us[4], market: "US" as const };
  const au = t.match(new RegExp(`\\b((?:Shop|Unit|Suite)?\\s*[\\d/A-Za-z-]{1,10}\\s+[\\w .'-]{2,40}?\\b${STREET}\\b\\.?)[ ,]+([A-Za-z .'-]{2,30}?)[ ,]+(NSW|VIC|QLD|WA|SA|TAS|NT|ACT)[ ,]+(\\d{4})\\b`, "i"));
  if (au) return { address: `${au[1].trim()}, ${titleCase(au[2])} ${au[3].toUpperCase()} ${au[4]}`, city: titleCase(au[2]), state: au[3].toUpperCase(), zip: au[4], market: "AU" as const };
  // Chỉ có "Houston, TX 77036" / ZIP đứng riêng
  const cz = t.match(/\b([A-Za-z .'-]{2,30}?),?\s+([A-Z]{2})\s+(\d{5})\b/);
  if (cz && US_CODES.has(cz[2])) return { address: null, city: titleCase(cz[1]), state: cz[2], zip: cz[3], market: "US" as const };
  return null;
}

/** Ô "location" của tool: "Winthrop, MA" · "Senatobia, MS 38668" · "TX 77521" · "Bankstown NSW 2200" · "Houston TX". */
export function parseLocation(loc: string): { city: string | null; state: string | null; zip: string | null; market: "US" | "AU" | null } {
  const t = String(loc || "").replace(/\*+/g, " ").replace(/\s+/g, " ").trim();
  const au = t.match(/^([A-Za-z .'-]{2,40}?)[ ,]+(NSW|VIC|QLD|WA|SA|TAS|NT|ACT)\b(?:[ ,]+(\d{4}))?/i);
  if (au) return { city: titleCase(au[1]), state: au[2].toUpperCase(), zip: au[3] ?? null, market: "AU" };
  const us = t.match(/^([A-Za-z .'-]{2,40}?)\s*,?\s+([A-Z]{2})\b(?:[ ,]+(\d{5}))?/);
  if (us && US_CODES.has(us[2]) && !/^(usa|us|my|mỹ)$/i.test(us[1].trim())) return { city: titleCase(us[1]), state: us[2], zip: us[3] ?? null, market: "US" };
  const sz = t.match(/\b([A-Z]{2})\s+(\d{5})\b/);
  if (sz && US_CODES.has(sz[1])) return { city: null, state: sz[1], zip: sz[2], market: "US" };
  const zip = t.match(/\b(\d{5})\b/);
  if (zip) { const st = usStateFromZip(zip[1]); if (st) return { city: null, state: st, zip: zip[1], market: "US" }; }
  const p = findPlace(t);
  return { city: p.city, state: p.state, zip: null, market: p.market };
}

/** "Tiệm đông khách ở thành phố Billings, bang Montana" / "Thuộc thành phố Minot" / "city of Tulsa" → tên thành phố. */
export function cityFromText(text: string): string | null {
  const m = String(text || "").normalize("NFKC").match(/(?:th[àa]nh ph[ốo]|\btp\.?|city of)\s+([A-Z][\p{L}.'-]+(?:\s[A-Z][\p{L}.'-]+){0,2})/u);
  if (!m) return null;
  const c = m[1].replace(/[.,]+$/, "").trim();
  // Không nhận tên bang ("thành phố New York" vẫn là thành phố — nhưng "bang" đứng ngay sau thì cắt)
  return c.length >= 3 && c.length <= 30 ? titleCase(c.replace(/\s+(bang|state)$/i, "")) : null;
}

/** Bang + thành phố khi không có địa chỉ đầy đủ. */
export function findPlace(text: string): { state: string | null; city: string | null; market: "US" | "AU" | null } {
  const s = ` ${strip(text)} `;
  for (const [city, st, mk] of CITY_STATE) if (s.includes(` ${city} `) || s.includes(` ${city},`) || s.includes(` ${city}.`)) return { city: titleCase(city), state: st, market: mk };
  for (const [name, code] of Object.entries(AU_STATE_NAMES)) if (s.includes(` ${name} `)) return { city: null, state: code, market: "AU" };
  for (const [name, code] of Object.entries(US_STATE_NAMES).sort((a, b) => b[0].length - a[0].length)) if (new RegExp(`\\b${name}\\b`).test(s)) return { city: null, state: code, market: "US" };
  const code = text.match(/\b(?:bang|state|khu|tại|tai)\s+([A-Z]{2,3})\b/);
  if (code && US_CODES.has(code[1])) return { city: null, state: code[1], market: "US" };
  if (code && AU_CODES.has(code[1])) return { city: null, state: code[1], market: "AU" };
  return { state: null, city: null, market: null };
}

const SKILLS: [RegExp, string][] = [
  [/\b(b[ộo]t|acrylic|powder)\b/i, "Bột/Acrylic"], [/\b(dip|sns)\b/i, "Dip/SNS"], [/\bgel[\s-]?x\b/i, "Gel-X"],
  [/\b(design|v[ẽe] m[óo]ng|nail art|v[ẽe])\b/i, "Design"], [/\b(ch[âa]n tay n[ưu][ớo]c|pedi(?:cure)?|mani(?:cure)?|tay ch[âa]n n[ưu][ớo]c)\b/i, "Chân tay nước"],
  [/\bwax(?:ing)?\b/i, "Wax"], [/\b(eyelash|lash|n[ốo]i mi)\b/i, "Nối mi"], [/\b(facial|ch[ăa]m s[óo]c da)\b/i, "Facial"],
];
const BENEFITS: [RegExp, string][] = [
  [/(bao [ăa]n [ởo]|c[óo] ch[ỗo] [ởo]|bao ch[ỗo] [ởo]|ở free|housing|c[óo] nh[àa] [ởo])/i, "Có chỗ ở"],
  [/(bao l[ươu]ơ?ng|bao l[ưu][ơo]ng|guarantee)/i, "Bao lương"], [/(tip cao|tip t[ốo]t|good tips?)/i, "Tip cao"], [/(cash|tr[ảa] cash|ti[ềe]n m[ặa]t)/i, "Trả cash"],
  [/(b[ảa]o hi[ểe]m|insurance)/i, "Bảo hiểm"], [/(ngh[ỉi] ch[ủu] nh[ậa]t|off ch[ủu] nh[ậa]t)/i, "Nghỉ Chủ nhật"],
];

// Bài SANG / BÁN tiệm (không phải tuyển thợ) — tool hay gửi kèm vì có chữ "cần gấp".
const SALE = /(c[ầa]n sang|sang (l[ạa]i )?ti[ệe]m|sang nh[ượư][ợơ]ng|b[áa]n ti[ệe]m|c[ầa]n b[áa]n|gi[áa] sang|nh[ậa]n c[ọo]c|salon for sale|nail salon for sale|business for sale)/i;
const HIRE_EXPLICIT = /(c[ầa]n (g[ấa]p )?(\d+ )?th[ợo]|tuy[ểe]n (g[ấa]p )?th[ợo]|hiring|need(ed)? (nail )?tech)/i;
/** Bài sang / bán tiệm (có thể kèm "cần gấp") — không đưa vào mục Việc làm. */
export const isSalonSale = (text: string) => SALE.test(text) && !HIRE_EXPLICIT.test(text.replace(SALE, ""));

// Bỏ số điện thoại + các khoản KHÔNG phải lương (tiền thuê, giá sang, cọc, diện tích) trước khi tìm lương:
// "bao lương 3343329402" (SĐT dính chữ), "Rent $5430", "Giá sang $120,000" từng bị hiểu là lương.
// Đúng dạng SĐT (Mỹ 3-3-4 / 10–11 số liền, Úc 04xx xxx xxx, +61) — không nuốt "2000-2200 1 tuần".
const PHONEISH = /(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)|(?<!\d)\d{10,11}(?!\d)|(?<!\d)(?:\+?61\s?|0)4\d{2}\s?\d{3}\s?\d{3}(?!\d)/g;
const NOT_PAY = /(rent|thu[êe]|gi[áa] sang|gi[áa] b[áa]n|sang|c[ọo]c|deposit|lease|doanh thu|sqft|sf\b)\s*:?\s*\$?\s?[\d.,]+\s*(k|ngh[ìi]n)?(\s*\/\s*(th[áa]ng|month))?/gi;
const SERVICE_PRICE = /(pedicure|manicure|pedi|mani|full ?set|fill|refill|dip|sns|gel-?x|acrylic|b[ộo]t|ch[âa]n tay n[ưu][ớo]c|wax(?:ing)?|eyebrow|special shape)\s*:?\s*\$\s?\d{1,3}(\s*(?:-|–|đến|to)\s*\$?\s?\d{1,3})?(?![\d,])/gi;
export const payText = (text: string) => text.replace(PHONEISH, " ").replace(NOT_PAY, " ").replace(SERVICE_PRICE, " ");

export function findSalary(text: string, market: "US" | "AU" | null): { salaryType: string; salaryAmount: string } {
  const t = payText(text).replace(/\s+/g, " ");
  const money = String.raw`(?<![\d,.])(?:\$?\s?\d{1,2}[,.]?\d{3}|\$\s?\d{2,3})(?![\d,.]*\d)`;
  const range = t.match(new RegExp(`(${money})\\s*(?:-|–|đến|to)\\s*(${money}|\\d{2,3}(?:[,.]\\d{3})?)\\s*(?:\\/|một|1|mỗi|per)?\\s*(tuần|tuan|week|wk|tháng|thang|month|giờ|gio|hour|hr|ngày|ngay|day)?`, "i"));
  const single = t.match(new RegExp(`(?:lương|luong|bao|guarantee|từ|tu|min|minimum|salary|pay)?\\s*(${money})\\s*\\+?\\s*(?:\\/|một|1|mỗi|per)\\s*(tuần|tuan|week|wk|tháng|thang|month|giờ|gio|hour|hr|ngày|ngay|day)`, "i"));
  const biweekly = t.match(new RegExp(`(${money})\\s*\\+?\\s*(?:\\/|mỗi|per|every)\\s*2\\s*(tuần|tuan|weeks?)`, "i"));
  // "bao lương 1000 and up 1 tuần" / "income đảm bảo 1,200+ mỗi tuần" — chữ lương đứng trước, đơn vị đứng xa sau số
  const payWord = t.match(new RegExp(`(?:bao l[ươ]+ng|l[ươ]+ng|income|thu nh[ậa]p)\\s*(?:từ|tu|đảm bảo|dam bao|tối thiểu)?\\s*(${money})\\s*(\\+|and up|up|trở lên|tro len)?[^$\\d]{0,18}?(?:1\\s*|một\\s*|mỗi\\s*|per\\s*)?(tuần|tuan|week|tháng|thang|month)`, "i"));
  const unitVi = (u?: string) => {
    const x = strip(u || "");
    if (/^(tuan|week|wk)/.test(x)) return "tuần";
    if (/^(thang|month)/.test(x)) return "tháng";
    if (/^(gio|hour|hr)/.test(x)) return "giờ";
    if (/^(ngay|day)/.test(x)) return "ngày";
    return "";
  };
  const fmt = (v: string) => "$" + Number(v.replace(/[^\d]/g, "")).toLocaleString("en-US");
  const split = t.match(/\b([4-7])\s*\/\s*([3-6])\b/);
  let amount = "";
  let unit = "";
  // Khoảng không đơn vị mà cả 2 số < $300 → giá dịch vụ / tip, không phải lương
  const smallRange = !!range && !range[3] && Number(range[1].replace(/[^\d]/g, "")) < 300 && Number(range[2].replace(/[^\d]/g, "")) < 300;
  if (biweekly) { unit = "tuần"; amount = `${fmt(biweekly[1])}/2 tuần`; }
  else if (range && !smallRange) { unit = unitVi(range[3]); amount = `${fmt(range[1])}-${fmt(range[2]).slice(1)}${unit ? `/${unit}` : ""}`; }
  else if (single) { unit = unitVi(single[2]); amount = `${fmt(single[1])}${/\+/.test(single[0]) ? "+" : ""}/${unit}`; }
  else if (payWord) { unit = unitVi(payWord[3]); amount = `${fmt(payWord[1])}${payWord[2] ? "+" : ""}/${unit}`; }
  const aud = market === "AU";
  const type =
    split && !range && !single ? "% Ăn chia" :
    /bao l[ươu]/i.test(t) ? "Bao lương tuần" :
    unit === "giờ" ? (aud ? "Theo giờ AUD" : "Theo giờ") :
    unit === "tuần" ? (aud ? "Theo tuần AUD" : "Bao lương tuần") :
    split ? "% Ăn chia" : aud ? "Theo giờ AUD" : "Thỏa thuận";
  if (!amount && split) amount = `Chia ${split[1]}/${split[2]}`;
  return { salaryType: type, salaryAmount: amount || "Thỏa thuận" };
}

/** Lương tool gửi kèm chỉ dùng khi trông đúng là tiền lương: có $ / đơn vị / chữ lương, số hợp lý,
 *  và không phải mảnh của số điện thoại trong bài. */
export function safeToolSalary(toolSalary: string, text: string): string | null {
  const v = toolSalary.replace(/\s+/g, " ").trim();
  if (!v || /th[ỏo]a thu[ậa]n/i.test(v)) return null;
  const digits = (v.match(/\d[\d,.]*/g) || []).map((x) => x.replace(/[^\d]/g, ""));
  if (!digits.length) return null;
  const phones = (text.match(PHONEISH) || []).map((x) => x.replace(/\D/g, ""));
  if (digits.some((d) => d.length >= 7 || phones.some((ph) => ph.includes(d) && d.length >= 3))) return null;
  if (!digits.every((d) => Number(d) >= 10 && Number(d) <= 20000)) return null;
  if (!/(\$|tu[ầa]n|week|th[áa]ng|month|gi[ờo]|hour|hr|ng[àa]y|day|l[ươu][ơo]?ng|chia|\d\s*\/\s*\d)/i.test(v)) return null;
  const bare = v.match(/^(?:bao\s*l[ươ]+ng|l[ươ]+ng|income)\s*:?\s*\$?\s*(\d[\d,.]*)\s*(\+)?$/i);
  if (bare) return `$${Number(bare[1].replace(/[^\d]/g, "")).toLocaleString("en-US")}${bare[2] ? "+" : ""}`;
  return v.slice(0, 40);
}

/** Tên tiệm hiển thị gọn: bỏ "(tên người đăng)", tên kiểu câu tuyển dụng ("Tiem Ở Alabama Cần Gấp 1 Thợ…")
 *  → "Tiệm nail <thành phố>". */
export function cleanSalonName(name: string | null | undefined, city?: string | null, state?: string | null): string {
  // Không có tên tiệm → "Tiệm nail Largo" / "Tiệm nail ở Minnesota" (không ra "Tiệm nail MN").
  const realCity = cleanCity(city);
  const stateFull = state ? (anyStateName(state) || state.trim()) : "";
  const fallback = realCity ? `Tiệm nail ${realCity}` : stateFull ? `Tiệm nail ở ${stateFull}` : "Tiệm nail";
  let n = String(name || "").replace(/\s+/g, " ").trim();
  n = n.replace(/^(ti[ệe]m (nail|nails)|nail salon)\s*\(([^)]+)\)$/i, "").trim();
  n = n.replace(/\s*\([^)]*\)\s*$/, "").trim();
  // "Tiệm nail . LARGO" (tên tự tạo từ thành phố bẩn) → "Tiệm nail Largo"
  n = n.replace(/^(ti[ệe]m nails?)\s+(.+)$/iu, (_m, a: string, b: string) => `${a} ${cleanCity(b)}`).trim();
  const SALON_WORD = /(nail|spa|salon|beauty|ti[ệe]m|studio|lounge|bar|lash|brow|tips?)/i;
  // Tên người đăng tool gửi kèm: "Thuy Cao", "Kaia Vu", cả tên 1 chữ "Noah" (không có chữ nail / spa / salon…)
  const personLike = !SALON_WORD.test(n) && /^(\p{Lu}[\p{Ll}\p{Lu}]*)(\s\p{Lu}[\p{Ll}\p{Lu}]*){0,3}$/u.test(n);
  // Tên kiểu câu nói: "Tiệm Nails Ở Acworth", "Tiệm Mình Ở York", "Tiệm Em Đông Khách", "Chủ Tiệm Nails USA"
  const sentenceLike = /(\s[ởỞ]\s|^ti[ệe]m\s+(nails?\s+)?[ởỞ]\s|^ti[ệe]m\s+(m[ìi]nh|em|t[ôo]i)\b|^ch[ủu]\s+ti[ệe]m)/i.test(n);
  // Tên kiểu lời khen chứ không phải tên riêng: "Salon Sạch Sẽ", "Tiệm Sang Trọng", "Tiệm Đông Khách"
  const praiseLike = /(s[ạa]ch s[ẽe]|sang tr[ọo]ng|[đd][ôo]ng kh[áa]ch|tr[ẻe] trung|tho[ảa]i m[áa]i|vui v[ẻe]|hi[ềe]n l[àa]nh|uy t[íi]n)/i.test(n);
  if (!n || personLike || sentenceLike || praiseLike || n.split(" ").length > 6 || /(c[ầa]n|tuy[ểe]n|g[ấa]p|th[ợo]|hiring|kh[áa]ch [đd][ôo]ng|c[áa]ch nh[àa]|ở v[ùu]ng)/i.test(n) || /^ti[ệe]m (nail|nails)?$/i.test(n)) return fallback || "Tiệm nail";
  return n.slice(0, 60);
}

/** "I Inverness" → "Inverness" (chữ cái thừa đầu tên thành phố do tool cắt dòng). */
export function cleanCity(c: string | null | undefined): string {
  if (/^\s*[A-Za-z]{2,3}\s*$/.test(String(c || "")) && anyStateName(String(c))) return ""; // "MN" là mã bang, không phải thành phố
  let v = String(c || "").replace(/^[^\p{L}]+/u, "").replace(/^[A-Za-z]\s+(?=[A-Z][a-z])/, "").replace(/\s+/g, " ").trim();
  // ". LARGO" / "SAN FRANCISCO" → "Largo" / "San Francisco" (tool hay gửi chữ in hoa toàn bộ)
  if (v.length > 2 && v === v.toUpperCase() && /\p{L}{3}/u.test(v)) v = v.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());
  return v;
}

const HIRING = /(c[ầa]n (g[ấa]p )?(th[ợo]|ng[ườu][ờo]i)|tuy[ểe]n (g[ấa]p )?th[ợo]|ki[ếe]m th[ợo]|t[ìi]m th[ợo]|need(ed|ing)? (nail )?tech|hiring|now hiring|looking for (nail )?tech|nail tech wanted|c[ầa]n g[ấa]p)/i;
// (bài sang / bán tiệm do isSalonSale lo — có ngoại lệ cho bài ghi rõ "cần thợ")
const SEEKING = /(?<!(?:ai|n[àa]o|th[ợo]|b[ạa]n|c[ầa]u|ch[ịi]|anh)\s)(t[ìi]m vi[ệe]c|c[ầa]n vi[ệe]c|ki[ếe]m vi[ệe]c|xin vi[ệe]c|looking for (a )?job|need (a )?job)/i;
// Bài THỢ TÌM VIỆC (không phải tiệm tuyển) — tool hay gửi kèm vì có chữ "cần thợ" ("chủ shop nào cần thợ để lại sđt"):
// "Góc tìm việc · Em nam phụ cứng… tìm nơi để nâng cao tay nghề" từng hiện thành tin "Cần thợ Nail" (17/10/2026).
const SEEKING_STRONG = /(g[óo]c t[ìi]m vi[ệe]c|(?:^|[\s,.(])(em|m[ìi]nh|t[ôo]i)\s(?:(?:(?!anh ch|ch[ịi] n|n[àa]o |\bai |b[ạa]n n)[^.\n]){0,60}\s)?(?<!(?:ai|n[àa]o|th[ợo]|ti[ệe]m|c[ầa]u)\s)(t[ìi]m|c[ầa]n|ki[ếe]m)\s+(n[ơo]i|ch[ỗo] l[àa]m|vi[ệe]c)(?![\p{L}])|(ch[ủu] (shop|ti[ệe]m)|ti[ệe]m|anh ch[ịi]|c[ôo] ch[úu]) n[àa]o c[ầa]n th[ợo][^.\n]{0,60}(đ[ểe] l[ạa]i|li[êe]n l[ạa]c|\bib\b|inbox|g[ọo]i (cho )?e))/iu;
// QUẢNG CÁO dịch vụ đăng tin / web tuyển thợ khác ("đăng tin cần thợ renew tại Vietnailshelper… muốn trải nghiệm
// dịch vụ, call Annie") — không phải tiệm tuyển thợ (17/10/2026 lọt lên mục Việc làm thành "Cần thợ Nail gấp").
const AD_POST = /(d[ịi]ch v[ụu] [đd][ăa]ng tin|[đd][ăa]ng tin (c[ầa]n th[ợo] )?(renew )?t[ạa]i [A-Z]|tr[ảa]i nghi[ệe]m d[ịi]ch v[ụu]|vietnails?helper|kh[óo]a tin khi)/i;
export const isAdPost = (text: string) => AD_POST.test(String(text || ""));
/** Bài thợ đi tìm việc — không đưa vào mục Việc làm dù có chữ "cần thợ". */
export const isJobSeeking = (text: string) => SEEKING_STRONG.test(String(text || "").slice(0, 400)) || SEEKING.test(String(text || "").slice(0, 160));

export function parseJobPost(raw: string): ParsedJob {
  const text = String(raw || "").slice(0, 6000);
  const sale = isSalonSale(text);
  const ph = findPhone(text);
  const addr = findAddress(text);
  const place = addr ? { state: addr.state, city: addr.city, market: addr.market } : findPlace(text);
  const market = addr?.market ?? ph?.market ?? place.market ?? null;
  let state = place.state;
  if (!state && addr?.zip) state = market === "AU" ? auStateFromPostcode(addr.zip) : usStateFromZip(addr.zip);
  if (!state) {
    const zip = text.match(/\b(\d{5})\b/);
    if (zip && market !== "AU") state = usStateFromZip(zip[1]);
  }
  const skills = SKILLS.filter(([re]) => re.test(text)).map(([, v]) => v);
  const benefits = BENEFITS.filter(([re]) => re.test(text)).map(([, v]) => v);
  const isUrgent = /(g[ấa]p|urgent|asap|ngay|immediately)/i.test(text);
  const sal = findSalary(text, market);
  const salonName = findSalonName(text);
  const isHiring = HIRING.test(text) && !isJobSeeking(text) && !isAdPost(text) && !sale;
  const title = `Cần thợ ${skills.length ? skills.slice(0, 2).join("/") : "Nail"}${isUrgent ? " gấp" : ""}`;
  return {
    isHiring, isSale: sale, market, phone: ph?.e164 ?? null, phoneDisplay: ph?.display ?? null, salonName, address: addr?.address ?? null, zip: addr?.zip ?? null,
    state, city: place.city ?? addr?.city ?? cityFromText(text), salaryType: sal.salaryType, salaryAmount: sal.salaryAmount, skills, benefits, isUrgent,
    title: title.slice(0, 80),
  };
}
