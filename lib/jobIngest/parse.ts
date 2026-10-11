// TÁCH TIN TUYỂN THỢ NAIL từ nguyên văn bài đăng (tiếng Việt / Anh / lẫn lộn):
// SĐT (Mỹ/Úc), tên tiệm, địa chỉ + ZIP/postcode → bang/thành phố, lương, kỹ năng, quyền lợi, tin gấp.
// Thuần hàm (không đụng DB) → dễ kiểm thử: scripts/qa/job_parse_unit.ts

export interface ParsedJob {
  isHiring: boolean;
  market: "US" | "AU" | null;
  phone: string | null; // E.164: +1XXXXXXXXXX / +61XXXXXXXXX
  phoneDisplay: string | null; // (713) 555-0123 / 0412 345 678
  salonName: string | null;
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
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
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

export function findSalary(text: string, market: "US" | "AU" | null): { salaryType: string; salaryAmount: string } {
  const t = text.replace(/\s+/g, " ");
  const money = String.raw`\$?\s?\d{1,2}[,.]?\d{3}|\$\s?\d{2,3}`;
  const range = t.match(new RegExp(`(${money})\\s*(?:-|–|đến|to)\\s*(${money}|\\d{2,3}(?:[,.]\\d{3})?)\\s*(?:\\/|một|1|mỗi|per)?\\s*(tuần|tuan|week|wk|tháng|thang|month|giờ|gio|hour|hr|ngày|ngay|day)?`, "i"));
  const single = t.match(new RegExp(`(?:lương|luong|bao|guarantee|từ|tu|min|minimum|salary|pay)?\\s*(${money})\\s*\\+?\\s*(?:\\/|một|1|mỗi|per)\\s*(tuần|tuan|week|wk|tháng|thang|month|giờ|gio|hour|hr|ngày|ngay|day)`, "i"));
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
  if (range) { unit = unitVi(range[3]); amount = `${fmt(range[1])}-${fmt(range[2]).slice(1)}${unit ? `/${unit}` : ""}`; }
  else if (single) { unit = unitVi(single[2]); amount = `${fmt(single[1])}${/\+/.test(single[0]) ? "+" : ""}/${unit}`; }
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

const HIRING = /(c[ầa]n (g[ấa]p )?(th[ợo]|ng[ườu][ờo]i)|tuy[ểe]n (g[ấa]p )?th[ợo]|ki[ếe]m th[ợo]|t[ìi]m th[ợo]|need(ed|ing)? (nail )?tech|hiring|now hiring|looking for (nail )?tech|nail tech wanted|c[ầa]n g[ấa]p)/i;
const SEEKING = /(t[ìi]m vi[ệe]c|c[ầa]n vi[ệe]c|ki[ếe]m vi[ệe]c|xin vi[ệe]c|looking for (a )?job|need (a )?job|b[áa]n ti[ệe]m|sang ti[ệe]m|for sale)/i;

export function parseJobPost(raw: string): ParsedJob {
  const text = String(raw || "").slice(0, 6000);
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
  const isHiring = HIRING.test(text) && !SEEKING.test(text.slice(0, 160));
  const title = `Cần thợ ${skills.length ? skills.slice(0, 2).join("/") : "Nail"}${isUrgent ? " gấp" : ""}`;
  return {
    isHiring, market, phone: ph?.e164 ?? null, phoneDisplay: ph?.display ?? null, salonName, address: addr?.address ?? null, zip: addr?.zip ?? null,
    state, city: place.city ?? addr?.city ?? null, salaryType: sal.salaryType, salaryAmount: sal.salaryAmount, skills, benefits, isUrgent,
    title: title.slice(0, 80),
  };
}
