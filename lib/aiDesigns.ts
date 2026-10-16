import { v2 as cloudinary } from "cloudinary";
import prisma from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { judgeImage, type Verdict } from "@/lib/imageJudge";
import { activeThemes, THEMES } from "@/lib/contentEngine";
import { getSignals } from "@/lib/trendSignals";
import { geminiEnabled, geminiImage, geminiJson } from "@/lib/gemini";
import { SAMPLE_DESIGNS } from "@/lib/designSamples";
import { generateEngineDesigns, generateOccasionBatch, PATTERN_IDS, type EngineDesign } from "@/lib/designEngine";
import { cfDailyImages, cfImage, cfImageEnabled } from "@/lib/cfImage";

// "Mẫu nail AI mỗi ngày":
//   1. Bối cảnh THẬT: dịp lễ đang/ sắp diễn ra (lịch Studio), hashtag đang lên,
//      tiêu đề mẫu đã ra gần đây (để không lặp).
//   2. Gemini viết N mẫu song ngữ: mô tả, kỹ năng, độ khó, thời gian, giá gợi
//      ý, VẬT TƯ cần chuẩn bị, các bước làm, và mô tả để vẽ ảnh.
//   3. Gemini vẽ ảnh cận cảnh bàn tay → lưu Cloudinary → bản NHÁP.
//   4. Admin duyệt trong Phòng nội dung mới hiện cho người dùng.
// Giới hạn: AI_DESIGNS_DAILY_LIMIT mẫu/ngày (mặc định 8) — chặn chi phí.

// Giai đoạn đầu: mẫu lên THẲNG trang Mẫu nail, không chờ admin duyệt (ảnh vẽ bù sau vài phút,
// trong lúc chờ hiện hình minh hoạ). Khi người dùng đông: Admin → Studio → Mẫu nail → bật
// "Duyệt mẫu trước khi đăng" (cài đặt designs_review, xem lib/settings.ts).
export const designsNeedReview = async () => (await getSetting("designs_review")) === "1";
const publishState = async () => ((await designsNeedReview()) ? { status: "draft" } : { status: "published", publishedAt: new Date() });

export const SKILLS = ["Bột/Acrylic", "Dip/SNS", "Gel-X", "Design", "Chân tay nước"];
const DAY_MS = 86_400_000;
const today = () => new Date().toISOString().slice(0, 10);
// AI_DESIGNS_TEXT_ONLY=1: chỉ dùng Gemini viết chữ (gói MIỄN PHÍ) — minh hoạ do
// app tự vẽ từ bảng màu/dáng/hiệu ứng. Không có cờ này mà vẽ ảnh lỗi (chưa bật
// thanh toán, hết hạn mức) → mẫu vẫn được lưu, chỉ thiếu ảnh.
export const textOnly = () => process.env.AI_DESIGNS_TEXT_ONLY === "1";
export const SHAPES = ["almond", "coffin", "square", "oval", "stiletto"] as const;
export const FINISHES = ["glossy", "matte", "chrome", "cateye", "glitter"] as const;
const HEX = /^#[0-9a-f]{6}$/i;
const cleanPalette = (p: unknown) => (Array.isArray(p) ? p : []).map((c) => String(c).trim()).filter((c) => HEX.test(c)).slice(0, 5);
export const dailyLimit = () => Math.max(1, Math.min(50, Number(process.env.AI_DESIGNS_DAILY_LIMIT) || 8));

export type { Bi } from "@/lib/designEngine";
import type { Bi } from "@/lib/designEngine";
interface DesignIdea {
  title: Bi;
  description: Bi;
  occasion: string;
  skills: string[];
  difficulty: number;
  minutes: number;
  priceHint: string;
  materials: (Bi & { qty: string })[];
  steps: Bi[];
  imagePrompt: string;
  palette: string[];
  shape: string;
  finish: string;
  pattern?: string;
}

const bi = { type: "OBJECT", properties: { vi: { type: "STRING" }, en: { type: "STRING" } }, required: ["vi", "en"] };
const SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      title: bi,
      description: bi,
      occasion: { type: "STRING" },
      skills: { type: "ARRAY", items: { type: "STRING", enum: SKILLS } },
      difficulty: { type: "INTEGER" },
      minutes: { type: "INTEGER" },
      priceHint: { type: "STRING" },
      materials: { type: "ARRAY", items: { type: "OBJECT", properties: { vi: { type: "STRING" }, en: { type: "STRING" }, qty: { type: "STRING" } }, required: ["vi", "en", "qty"] } },
      steps: { type: "ARRAY", items: bi },
      imagePrompt: { type: "STRING" },
      palette: { type: "ARRAY", items: { type: "STRING" } },
      shape: { type: "STRING", enum: ["almond", "coffin", "square", "oval", "stiletto"] },
      finish: { type: "STRING", enum: ["glossy", "matte", "chrome", "cateye", "glitter"] },
      pattern: { type: "STRING", enum: PATTERN_IDS },
    },
    required: ["title", "description", "occasion", "skills", "difficulty", "minutes", "priceHint", "materials", "steps", "imagePrompt", "palette", "shape", "finish"],
  },
};

// Phong cách ảnh chung: cận cảnh, ánh sáng studio, KHÔNG chữ/logo (tránh vi phạm thương hiệu).
// Khung ảnh: phải trông như ẢNH CHỤP THẬT ở tiệm (thợ nhìn là biết làm được), không phải ảnh 3D
// bóng loáng; 1 bàn tay đặt tự nhiên (ít lỗi thừa ngón hơn kiểu "giơ tay"), không chữ/logo.
// KHÔNG nhắc giới tính / da / màu da: bộ lọc NSFW của Cloudflare chặn nhầm (12/10/2026 thêm
// "woman's hand" + "skin texture" → cả lượt vẽ trượt hết). Bối cảnh xoay vòng theo mẫu.
// 16/10/2026: FLUX KHÔNG hiểu câu phủ định ("no text", "no extra fingers" lại gợi ra đúng thứ đó) → khung
// ảnh chỉ mô tả điều MUỐN có; ảnh lỗi (thừa ngón, có chữ) do "AI chấm ảnh" (lib/imageJudge) loại bỏ.
const IMAGE_STYLE =
  "Professional nail salon portfolio photograph, macro close-up. One elegant relaxed hand, fingers gently spread, " +
  "four slender fingers and one thumb with natural proportions and soft knuckle creases, neat clean cuticles. " +
  "The manicure is the sharp focal point: flawless and evenly applied on every nail. " +
  "Soft diffused window daylight, gentle shadows, true-to-life colors, shallow depth of field, 100mm macro lens, " +
  "minimal uncluttered background, high-end editorial photo realism.";
// Bối cảnh KHÔNG có chữ: ly cà phê / chai sơn làm AI tự "viết" nhãn chữ vô nghĩa ("Cgf ICED…",
// "O·AL LIGUSE" — 12/10/2026) → bỏ. Chỉ giữ nền vải / gỗ / đá / hoa, dáng tay đơn giản.
const SCENES = [
  "hand resting flat on a plain white salon towel",
  "hand resting on a light oak wooden table near a window",
  "fingers gently curled over a soft beige knit sweater sleeve",
  "hand resting on a plain white marble tabletop",
  "hand resting on smooth pale pink linen fabric",
  "hand lightly holding a single fresh flower, soft blurred background",
];
/** Khung ảnh theo mẫu: cùng mẫu → cùng bối cảnh (vẽ lại vẫn nhất quán), mẫu khác → khác bối cảnh. */
function photoStyle(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `${IMAGE_STYLE} Scene: ${SCENES[h % SCENES.length]}. Square 1:1.`;
}

const cut = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);
const clean = (b: Partial<Bi> | undefined, n: number): Bi => ({ vi: cut(b?.vi, n), en: cut(b?.en, n) });

export function upcomingThemes(market: "US" | "AU", now: Date) {
  // Dịp đang diễn ra + dịp bắt đầu trong 21 ngày tới (thợ cần chuẩn bị vật tư trước).
  const ids = new Set<string>();
  const out: { id: string; title: string; emoji: string; ideas: string[]; startsIn: number }[] = [];
  for (let d = 0; d <= 21; d += 3) {
    for (const t of activeThemes(new Date(now.getTime() + d * DAY_MS), market)) {
      if (ids.has(t.id)) continue;
      ids.add(t.id);
      out.push({ id: t.id, title: t.title, emoji: t.emoji, ideas: t.ideas, startsIn: d });
    }
  }
  return out.slice(0, 4);
}

/** Có chỗ lưu ảnh chưa (Cloudinary; hoặc data URL khi test local). */
export const storageReady = () =>
  !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) || process.env.AI_DESIGNS_ALLOW_DATA_URL === "1";

async function store(img: { mimeType: string; base64: string }): Promise<string> {
  const dataUri = `data:${img.mimeType};base64,${img.base64}`;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET });
    const r = await cloudinary.uploader.upload(dataUri, { folder: "pawbook/designs", resource_type: "image" });
    return r.secure_url;
  }
  // Không có Cloudinary: chỉ cho phép ở máy local (ảnh ~1MB không được nhét vào DB production).
  if (process.env.AI_DESIGNS_ALLOW_DATA_URL === "1") return dataUri;
  throw new Error("Cần cấu hình Cloudinary để lưu ảnh mẫu AI.");
}

export interface GenerateResult { created: string[]; skipped: number; errors: string[] }

/** Tạo tối đa `count` mẫu nháp (không vượt giới hạn/ngày). */
export async function generateDesigns(market: "US" | "AU", count: number): Promise<GenerateResult> {
  if (!geminiEnabled()) throw new Error("Chưa cấu hình GEMINI_API_KEY.");
  const wantImages = !textOnly() && storageReady();
  const madeToday = await prisma.nailDesign.count({ where: { day: today() } });
  const n = Math.max(0, Math.min(count, dailyLimit() - madeToday));
  if (n === 0) return { created: [], skipped: count, errors: [`Đã đủ ${dailyLimit()} mẫu hôm nay.`] };

  const now = new Date();
  const [themes, signals, recent] = await Promise.all([
    Promise.resolve(upcomingThemes(market, now)),
    getSignals(market).catch(() => null),
    prisma.nailDesign.findMany({ where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } }, select: { title: true }, take: 60, orderBy: { createdAt: "desc" } }),
  ]);
  const tags = (signals?.risingTags ?? []).slice(0, 6).map((t) => "#" + t.tag);
  const prompt = [
    `Bạn là giám đốc sáng tạo của một tiệm nail cao cấp người Việt tại ${market === "US" ? "Mỹ" : "Úc"}.`,
    `Hôm nay là ${now.toISOString().slice(0, 10)}. Hãy đề xuất ĐÚNG ${n} mẫu nail mới, đang hợp xu hướng, khách sẽ muốn làm NGAY tuần này.`,
    themes.length
      ? `Dịp lễ/mùa đang hoặc sắp diễn ra (ưu tiên, ghi id vào trường occasion): ${themes.map((t) => `${t.id} = ${t.title}${t.startsIn ? ` (bắt đầu sau ~${t.startsIn} ngày)` : " (đang diễn ra)"}; gợi ý: ${t.ideas.join(", ")}`).join(" | ")}.`
      : "Không có dịp lễ đặc biệt — chọn xu hướng theo mùa hiện tại (occasion để trống).",
    tags.length ? `Hashtag đang lên trên app: ${tags.join(" ")}.` : "",
    recent.length ? `KHÔNG lặp lại các mẫu đã ra gần đây: ${recent.map((r) => r.title).join("; ")}.` : "",
    "Đa dạng: ít nhất 1 mẫu dễ (thợ mới làm được, ≤45 phút), 1 mẫu nghệ thuật khó; trộn kỹ năng Gel-X, Dip, Acrylic, vẽ tay.",
    "Mỗi mẫu: title & description có cả tiếng Việt (vi, giọng thợ nail Việt, tự nhiên) và tiếng Anh (en). description 1–2 câu: vì sao đang hot, hợp khách nào.",
    "skills: chọn từ danh sách cho sẵn. difficulty: 1 dễ, 2 vừa, 3 khó. minutes: thời gian làm thực tế. priceHint: khoảng giá tiệm nên báo khách, đơn vị USD (Mỹ) hoặc AUD (Úc), VD \"$45–60\".",
    "materials: 4–8 vật tư CỤ THỂ cần chuẩn bị (màu gel/bột tên gọi phổ biến, top/base, charm, cọ, foil…), mỗi món có qty (VD \"1 lọ\", \"1 bộ\").",
    "steps: 4–6 bước làm ngắn gọn, đúng kỹ thuật.",
    "palette: 2–5 mã màu hex chính của bộ móng (VD \"#7f1d1d\"). shape: dáng móng. finish: hiệu ứng bề mặt (glossy bóng, matte nhám, chrome tráng gương, cateye mắt mèo, glitter nhũ). pattern: hoạ tiết gần nhất trong danh sách cho sẵn (solid = màu trơn).",
    "imagePrompt: tiếng Anh, mô tả CHÍNH XÁC bộ móng để vẽ ảnh (dáng móng, độ dài, màu, hoạ tiết, chất liệu bóng/nhám/chrome). Không nhắc thương hiệu, logo, chữ, người nổi tiếng.",
    "Tuyệt đối không mô phỏng thương hiệu thời trang (Chanel, LV, Gucci…) hay nhân vật có bản quyền.",
  ]
    .filter(Boolean)
    .join("\n");

  const ideas = await geminiJson<DesignIdea[]>(prompt, SCHEMA);
  const list = (Array.isArray(ideas) ? ideas : []).slice(0, n);
  const themeIds = new Set(THEMES.map((t) => t.id));

  const created: string[] = [];
  const errors: string[] = [];
  // Vẽ song song — 1 ảnh ~10–20 giây.
  await Promise.all(
    list.map(async (d) => {
      try {
        const imagePrompt = `${cut(d.imagePrompt, 900)}\n\n${IMAGE_STYLE}`;
        let imageUrl: string | null = null;
        if (wantImages) {
          try {
            imageUrl = await store(await geminiImage(imagePrompt));
          } catch (err) {
            // Không vẽ được (thường do chưa bật thanh toán) → vẫn lưu mẫu, app tự vẽ minh hoạ.
            errors.push(`Không vẽ được ảnh, dùng minh hoạ tự vẽ: ${(err as Error).message.slice(0, 140)}`);
          }
        }
        const row = await prisma.nailDesign.create({
          data: {
            ...(await publishState()),
            day: today(),
            market,
            occasion: themeIds.has(d.occasion) ? d.occasion : null,
            title: cut(d.title?.vi, 80) || "Mẫu mới",
            titleEn: cut(d.title?.en, 80) || "New design",
            description: cut(d.description?.vi, 400),
            descriptionEn: cut(d.description?.en, 400),
            skills: (Array.isArray(d.skills) ? d.skills : []).filter((s) => SKILLS.includes(s)).slice(0, 3).join(","),
            difficulty: Math.min(3, Math.max(1, Math.round(Number(d.difficulty) || 2))),
            minutes: Math.min(240, Math.max(15, Math.round(Number(d.minutes) || 60))),
            priceHint: cut(d.priceHint, 30),
            materials: JSON.stringify((Array.isArray(d.materials) ? d.materials : []).slice(0, 10).map((m) => ({ ...clean(m, 80), qty: cut(m.qty, 30) }))),
            steps: JSON.stringify((Array.isArray(d.steps) ? d.steps : []).slice(0, 8).map((s) => clean(s, 200))),
            imageUrl,
            palette: JSON.stringify(cleanPalette(d.palette).length ? cleanPalette(d.palette) : ["#ec4899", "#a855f7"]),
            shape: (SHAPES as readonly string[]).includes(d.shape) ? d.shape : "almond",
            finish: (FINISHES as readonly string[]).includes(d.finish) ? d.finish : "glossy",
            pattern: d.pattern && PATTERN_IDS.includes(d.pattern) ? d.pattern : "solid",
            provider: "gemini",
            prompt: imagePrompt.slice(0, 2000),
          },
          select: { id: true },
        });
        created.push(row.id);
      } catch (err) {
        errors.push((err as Error).message.slice(0, 200));
      }
    })
  );
  return { created, skipped: count - list.length, errors };
}

// Máy tạo mẫu PawNail: miễn phí nên không tính vào giới hạn AI, nhưng vẫn
// chặn số nháp/ngày để Phòng nội dung không bị ngập.
export const ENGINE_DAILY_MAX = 24;

/** Tạo mẫu bằng MÁY TẠO MẪU PAWNAIL (lib/designEngine) — không gọi AI, 0đ. */
export async function generateEngine(market: "US" | "AU", count: number, deadline = Date.now() + 50_000): Promise<GenerateResult> {
  const day = today();
  const madeToday = await prisma.nailDesign.count({ where: { day, provider: "pawnail" } });
  const n = Math.max(0, Math.min(count, ENGINE_DAILY_MAX - madeToday));
  if (n === 0) return { created: [], skipped: count, errors: [`Đã tạo đủ ${ENGINE_DAILY_MAX} mẫu PawNail hôm nay.`] };
  const now = new Date();
  const [signals, recent] = await Promise.all([
    getSignals(market).catch(() => null),
    prisma.nailDesign.findMany({ where: { createdAt: { gte: new Date(now.getTime() - 60 * DAY_MS) } }, select: { title: true }, take: 400 }),
  ]);
  const list = generateEngineDesigns(n, {
    market,
    date: day,
    salt: String(madeToday), // bấm thêm trong ngày → ra mẫu khác
    occasions: upcomingThemes(market, now).map((t) => ({ id: t.id, title: t.title, emoji: t.emoji, startsIn: t.startsIn })),
    risingTags: (signals?.risingTags ?? []).map((t) => t.tag),
    usedTitles: new Set(recent.map((r) => r.title)),
  });
  const errors: string[] = list.length < n ? ["Hết tổ hợp mới cho hôm nay — mai máy sẽ ra mẫu khác."] : [];
  const { created, jobs } = await saveEngineDesigns(list, market);
  await drawImages(jobs, deadline, errors);
  return { created, skipped: count - list.length, errors };
}

type ImageJob = { id: string; subject: string; prompt: string };

// Lưu mẫu TRƯỚC (luôn có hình minh hoạ), vẽ ảnh thật SAU — lỗi/quá giờ không mất mẫu.
async function saveEngineDesigns(list: EngineDesign[], market: "US" | "AU") {
  const day = today();
  const created: string[] = [];
  const jobs: ImageJob[] = [];
  for (const d of list) {
    const prompt = `${d.imagePrompt}\n\n${IMAGE_STYLE}`.slice(0, 2000);
    const row = await prisma.nailDesign.create({
      data: {
        ...(await publishState()),
        day, market, occasion: d.occasion, title: d.title.vi, titleEn: d.title.en, description: d.description.vi, descriptionEn: d.description.en,
        skills: d.skills.join(","), difficulty: d.difficulty, minutes: d.minutes, priceHint: d.priceHint,
        materials: JSON.stringify(d.materials), steps: JSON.stringify(d.steps), imageUrl: null,
        palette: JSON.stringify(d.palette), shape: d.shape, finish: d.finish, pattern: d.pattern,
        provider: "pawnail",
        // Mô tả ảnh — dùng để vẽ (nếu bật Cloudflare), vẽ bù hoặc vẽ lại sau.
        prompt,
      },
      select: { id: true },
    });
    created.push(row.id);
    jobs.push({ id: row.id, subject: d.imagePrompt, prompt });
  }
  return { created, jobs };
}

// Bộ mẫu theo dịp lễ (VD 100 mẫu Halloween) — miễn phí nên không tính vào giới hạn
// ngày thường, nhưng vẫn chặn trần để Phòng nội dung không bị ngập.
export const OCCASION_BATCH_MAX = 150;

function daysUntil(theme: (typeof THEMES)[number], market: "US" | "AU", now: Date) {
  if (activeThemes(now, market).some((t) => t.id === theme.id)) return 0;
  const d = new Date(Date.UTC(now.getUTCFullYear(), theme.from[0] - 1, theme.from[1]));
  if (d.getTime() < now.getTime()) d.setUTCFullYear(d.getUTCFullYear() + 1);
  return Math.ceil((d.getTime() - now.getTime()) / DAY_MS);
}

/** Tạo CẢ BỘ mẫu cho 1 dịp lễ (xem generateOccasionBatch). Ảnh vẽ dần: lượt này vẽ
 *  được bao nhiêu thì vẽ, phần còn lại các lượt cron sau tự vẽ bù. */
export async function generateOccasion(market: "US" | "AU", occasionId: string, count: number, deadline = Date.now() + 50_000): Promise<GenerateResult> {
  const theme = THEMES.find((t) => t.id === occasionId && (!t.markets || t.markets.includes(market)));
  if (!theme) return { created: [], skipped: count, errors: ["Không có dịp lễ này ở thị trường đã chọn."] };
  const n = Math.max(0, Math.min(count, OCCASION_BATCH_MAX));
  const now = new Date();
  const [recent, already] = await Promise.all([
    prisma.nailDesign.findMany({ where: { createdAt: { gte: new Date(now.getTime() - 365 * DAY_MS) } }, select: { title: true }, take: 3000 }),
    prisma.nailDesign.count({ where: { day: today(), provider: "pawnail", occasion: occasionId } }),
  ]);
  const list = generateOccasionBatch(n, {
    market, date: today(), salt: String(already), risingTags: [],
    occasion: { id: theme.id, title: theme.title, emoji: theme.emoji, startsIn: daysUntil(theme, market, now) },
    usedTitles: new Set(recent.map((r) => r.title)),
  });
  const errors: string[] = list.length < n ? [`Chỉ còn ${list.length} mẫu ${theme.title} chưa trùng — đã tạo hết.`] : [];
  const { created, jobs } = await saveEngineDesigns(list, market);
  await drawImages(jobs, deadline, errors);
  return { created, skipped: count - list.length, errors };
}

/** Vẽ ảnh thật (Cloudflare, gói miễn phí) cho các mẫu: tối đa 2 ảnh cùng lúc (gửi
 *  dồn 6 ảnh một lúc thì Cloudflare xếp hàng → quá giờ), trong hạn mức ảnh/ngày và
 *  trước `deadline` (giới hạn 60 giây của máy chủ). Không kịp → để lần sau vẽ bù. */
const imgMark = () => `[img:${today()}]`;
/** Số ảnh đã vẽ HÔM NAY (đếm theo ngày vẽ, kể cả vẽ bù/vẽ lại cho mẫu của ngày trước). */
export const imagesDrawnToday = () => prisma.nailDesign.count({ where: { prompt: { contains: imgMark() } } });

// ---- Vẽ nhiều ảnh, AI chấm, giữ ảnh đẹp nhất (MIỄN PHÍ, trong hạn mức Cloudflare) ----
// AI_IMAGE_CANDIDATES: số ảnh tối đa / mẫu (mặc định 3, dừng sớm khi có ảnh ≥ PASS_SCORE).
// AI_IMAGE_CANDIDATES_DAILY: tổng ảnh ứng viên / ngày (mặc định 40 ≈ 40 × (100 vẽ + ~70 chấm) ≈ 6.800 neuron,
// dưới 10k miễn phí, chừa phần viết bài). Ảnh tốt nhất < KEEP_SCORE → KHÔNG đăng ảnh xấu: mẫu giữ hình
// minh hoạ, mai vẽ lại.
export const PASS_SCORE = 7;
export const KEEP_SCORE = 5;
const candidatesPer = () => Math.max(1, Math.min(4, Number(process.env.AI_IMAGE_CANDIDATES ?? 3) || 3));
const candidatesDaily = () => Math.max(0, Math.min(150, Number(process.env.AI_IMAGE_CANDIDATES_DAILY ?? 40) || 0));
const candKey = () => `img_cand:${today()}`;
const tryMark = () => `[try:${today()}]`;
const QUOTA = /used up your daily free allocation|daily free allocation/i;

/** Giữ 1 lượt vẽ ảnh ứng viên trong hạn mức ngày — đếm thẳng trong bảng AppSetting (KHÔNG qua
 *  getSetting: bộ đệm 30s làm đếm sai giữa các lượt / máy chủ). Bảng chưa có → không chặn. */
async function takeCandidate(): Promise<boolean> {
  const key = candKey();
  try {
    const n = Number((await prisma.appSetting.findUnique({ where: { key } }))?.value) || 0;
    if (n >= candidatesDaily()) return false;
    await prisma.appSetting.upsert({ where: { key }, update: { value: String(n + 1) }, create: { key, value: String(n + 1) } });
  } catch {
    // bảng chưa có (DB cũ) → vẫn vẽ, trần AI_IMAGES_DAILY vẫn giữ
  }
  return true;
}

interface Best { img: { mimeType: string; base64: string }; verdict: Verdict | null; tried: number }
/** Vẽ tối đa `max` ảnh cho 1 mẫu, chấm từng ảnh, trả ảnh đẹp nhất (null: hết hạn mức ứng viên / hết giờ).
 *  Hết lượt miễn phí Cloudflare → ném lỗi (QUOTA) cho nơi gọi dừng hẳn. */
async function drawBest(subject: string, seed: string, deadline: number, max = candidatesPer()): Promise<Best | null> {
  let best: Best | null = null;
  for (let k = 0; k < max; k++) {
    const budget = deadline - Date.now() - 4000;
    if (budget < (k === 0 ? 8000 : 20_000)) break; // ảnh thứ 2+ cần đủ giờ vẽ + chấm
    if (!(await takeCandidate())) break;
    // Mỗi ảnh ứng viên một bối cảnh khác → thêm cơ hội ra ảnh đẹp.
    const img = await cfImage(`${subject}. ${photoStyle(k ? `${seed}:${k}` : seed)}`, Math.min(30_000, budget));
    const verdict = deadline - Date.now() > 9000 ? await judgeImage(img, subject).catch(() => null) : null;
    if (!verdict) return best ?? { img, verdict: null, tried: k + 1 }; // không có AI chấm → giữ cách cũ (nhận ảnh)
    if (!best || !best.verdict || verdict.score > best.verdict.score) best = { img, verdict, tried: k + 1 };
    else best.tried = k + 1;
    if (verdict.score >= PASS_SCORE) break;
  }
  return best;
}

async function drawImages(jobs: ImageJob[], deadline: number, errors: string[]): Promise<number> {
  // (AI_DESIGNS_TEXT_ONLY chỉ dành cho Gemini — không chặn ảnh Cloudflare miễn phí.)
  if (!jobs.length || !cfImageEnabled() || !storageReady()) return 0;
  const imagesToday = await imagesDrawnToday();
  let left = Math.max(0, cfDailyImages() - imagesToday);
  const queue = [...jobs];
  let done = 0;
  const worker = async () => {
    while (queue.length && left > 0) {
      if (deadline - Date.now() - 4000 < 8000) return; // sắp hết giờ → lần chạy sau vẽ bù
      const job = queue.shift()!;
      left--;
      try {
        const best = await drawBest(job.subject, job.id, deadline);
        if (!best) { left++; queue.length = 0; return; } // hết hạn mức ảnh ứng viên hôm nay / hết giờ
        const score = best.verdict?.score;
        if (score !== undefined && score < KEEP_SCORE) {
          // Ảnh tốt nhất vẫn xấu → không đăng; đánh dấu đã thử hôm nay, mai vẽ lại.
          await prisma.nailDesign.update({ where: { id: job.id }, data: { prompt: `${job.prompt}${tryMark()}`.slice(0, 2000) } });
          errors.push(`Ảnh chưa đạt (${score}/10 sau ${best.tried} ảnh: ${best.verdict?.issues.join(", ") || "chất lượng thấp"}) — giữ hình minh hoạ, mai vẽ lại.`);
          continue;
        }
        const imageUrl = await store(best.img);
        const q = score !== undefined ? `[q:${score}]` : "";
        await prisma.nailDesign.update({ where: { id: job.id }, data: { imageUrl, prompt: `${job.prompt.replace(/\[(q|try):[^\]]*\]/g, "")}${q}${imgMark()}`.slice(0, 2000) } });
        done++;
      } catch (err) {
        const msg = (err as Error).message;
        // Hết lượt miễn phí trong ngày (Cloudflare reset 00:00 UTC) → dừng hẳn, mai vẽ bù tiếp.
        if (QUOTA.test(msg)) {
          left = 0;
          queue.length = 0;
          // Kèm nguyên văn lỗi Cloudflare để chẩn đoán (10/2026: báo hết lượt trong khi trang Usage ghi 0/10k).
          errors.push(`Đã hết lượt vẽ ảnh miễn phí hôm nay của Cloudflare — các mẫu còn lại sẽ được vẽ bù ở lượt sau (không tốn tiền). [${msg.slice(0, 220)}]`);
          return;
        }
        left++;
        errors.push(`Không vẽ được ảnh (dùng hình minh hoạ, sẽ vẽ bù): ${msg.slice(0, 140)}`);
      }
    }
  };
  await Promise.all([worker(), worker()]);
  return done;
}

/** Vẽ bù ảnh cho mẫu PawNail nháp (14 ngày gần đây) còn thiếu ảnh — lỗi/quá giờ, hoặc
 *  bộ mẫu lớn đang vẽ dần. Mỗi lượt vẽ được bao nhiêu thì vẽ, trong hạn mức ngày. */
export async function backfillImages(deadline: number): Promise<{ drawn: number; errors: string[] }> {
  const rows = await prisma.nailDesign.findMany({
    where: { provider: "pawnail", imageUrl: null, status: { in: ["draft", "published"] }, createdAt: { gte: new Date(Date.now() - 14 * DAY_MS) } },
    select: { id: true, prompt: true },
    orderBy: { createdAt: "asc" },
    take: 40,
  });
  // Mẫu đã vẽ hôm nay mà ảnh chưa đạt → để mai vẽ lại (không đốt hạn mức miễn phí vào 1 mẫu khó).
  const jobs = rows.filter((r) => !r.prompt.includes(tryMark())).map((r) => ({ id: r.id, subject: subjectOf(r.prompt), prompt: r.prompt })).filter((j) => j.subject);
  const errors: string[] = [];
  const drawn = await drawImages(jobs, deadline, errors);
  return { drawn, errors };
}

export const MAX_REDRAWS = 3;
// Phần mô tả bộ móng (trước khung ảnh và các dấu [redraws:…][img:…]).
const subjectOf = (prompt: string) => prompt.replace(/\[(redraws|img|q|try):[^\]]*\]/g, "").split("\n\n")[0].trim();

/** Admin bấm "Vẽ lại ảnh" (ảnh lỗi tay, sai hoạ tiết…) — tối đa MAX_REDRAWS lần/mẫu.
 *  Luôn dùng khung ảnh MỚI NHẤT (IMAGE_STYLE) với phần mô tả bộ móng đã lưu. */
export async function redrawImage(id: string): Promise<{ imageUrl?: string; error?: string; redraws?: number }> {
  if (!cfImageEnabled() || !storageReady()) return { error: "Chưa bật vẽ ảnh (Cloudflare Workers AI)." };
  const row = await prisma.nailDesign.findUnique({ where: { id }, select: { prompt: true } });
  if (!row) return { error: "Không tìm thấy mẫu." };
  const n = Number(row.prompt.match(/\[redraws:(\d+)\]/)?.[1] ?? 0);
  if (n >= MAX_REDRAWS) return { error: `Mẫu này đã vẽ lại ${MAX_REDRAWS} lần — bỏ mẫu hoặc tạo mẫu mới.` };
  const subject = subjectOf(row.prompt);
  if (!subject) return { error: "Mẫu này không có mô tả ảnh để vẽ." };
  try {
    // Vẽ 2 ảnh, AI chấm, lấy ảnh đẹp hơn; hết hạn mức ảnh ứng viên → vẽ 1 ảnh như cũ.
    const best = await drawBest(subject, `${id}${n}`, Date.now() + 55_000, 2);
    const imageUrl = await store(best?.img ?? (await cfImage(`${subject}. ${photoStyle(id + n)}`)));
    const q = best?.verdict ? `[q:${best.verdict.score}]` : "";
    await prisma.nailDesign.update({ where: { id }, data: { imageUrl, prompt: `${subject}\n\n${IMAGE_STYLE}\n[redraws:${n + 1}]${q}${imgMark()}`.slice(0, 2000) } });
    return { imageUrl, redraws: n + 1 };
  } catch (err) {
    return { error: `Không vẽ được ảnh: ${(err as Error).message.slice(0, 160)}` };
  }
}

/** Mẫu GỢI Ý soạn sẵn (không gọi AI) — ưu tiên dịp lễ sắp tới, không lặp mẫu đã có. */
export async function generateSamples(market: "US" | "AU", count: number): Promise<GenerateResult> {
  const used = new Set((await prisma.nailDesign.findMany({ where: { provider: "sample" }, select: { title: true } })).map((r) => r.title));
  const soon = new Set(upcomingThemes(market, new Date()).map((t) => t.id));
  const pool = SAMPLE_DESIGNS.filter((d) => !used.has(d.title.vi)).sort((a, b) => Number(soon.has(b.occasion ?? "")) - Number(soon.has(a.occasion ?? "")));
  const pick = pool.slice(0, Math.max(0, count));
  const created: string[] = [];
  for (const d of pick) {
    const row = await prisma.nailDesign.create({
      data: {
        ...(await publishState()),
        day: today(), market, occasion: d.occasion, title: d.title.vi, titleEn: d.title.en, description: d.description.vi, descriptionEn: d.description.en,
        skills: d.skills.join(","), difficulty: d.difficulty, minutes: d.minutes, priceHint: d.priceHint,
        materials: JSON.stringify(d.materials), steps: JSON.stringify(d.steps), imageUrl: null,
        palette: JSON.stringify(d.palette), shape: d.shape, finish: d.finish, provider: "sample", prompt: "",
      },
      select: { id: true },
    });
    created.push(row.id);
  }
  return { created, skipped: count - pick.length, errors: pick.length < count ? ["Đã dùng hết bộ mẫu gợi ý — thêm mẫu mới trong lib/designSamples.ts."] : [] };
}

export interface PublicDesign {
  id: string;
  day: string;
  occasion: string | null;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  skills: string[];
  difficulty: number;
  minutes: number;
  priceHint: string;
  materials: (Bi & { qty: string })[];
  steps: Bi[];
  imageUrl: string | null;
  videoUrl: string | null;
  palette: string[];
  shape: string;
  finish: string;
  pattern: string;
  provider: string;
  status: string;
  saves: number;
  saved?: boolean;
  publishedAt: string | null;
}

const parse = <T,>(s: string, fallback: T): T => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

export function toPublic(r: {
  id: string; day: string; occasion: string | null; title: string; titleEn: string; description: string; descriptionEn: string; skills: string;
  difficulty: number; minutes: number; priceHint: string; materials: string; steps: string; imageUrl: string | null; videoUrl: string | null;
  palette?: string; shape?: string; finish?: string; pattern?: string; provider?: string;
  status: string; publishedAt: Date | null; _count?: { saves: number };
}): PublicDesign {
  return {
    id: r.id, day: r.day, occasion: r.occasion, title: r.title, titleEn: r.titleEn, description: r.description, descriptionEn: r.descriptionEn,
    skills: r.skills ? r.skills.split(",").filter(Boolean) : [], difficulty: r.difficulty, minutes: r.minutes, priceHint: r.priceHint,
    materials: parse(r.materials, []), steps: parse(r.steps, []), imageUrl: r.imageUrl, videoUrl: r.videoUrl, status: r.status,
    palette: parse(r.palette ?? "[]", [] as string[]), shape: r.shape ?? "almond", finish: r.finish ?? "glossy", pattern: r.pattern ?? "solid", provider: r.provider ?? "gemini",
    saves: r._count?.saves ?? 0, publishedAt: r.publishedAt?.toISOString() ?? null,
  };
}
