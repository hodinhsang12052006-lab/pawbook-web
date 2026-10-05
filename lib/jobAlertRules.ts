import prisma from "@/lib/prisma";
import { sendPush } from "@/lib/push";

// "Báo việc theo tiêu chí" — thợ lưu tối đa 3 bộ lọc (thị trường + bang +
// kỹ năng, bang/kỹ năng bỏ trống = mọi). Có tin mới khớp → thông báo đẩy.
export const MAX_JOB_ALERTS = 3;
export const ALERT_SKILLS = ["Bột/Acrylic", "Dip/SNS", "Gel-X", "Design", "Chân tay nước", "Wax", "Mi/Lông mày"];
const US = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];
const AU = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

function isMissingTable(err: unknown) {
  return /no such table|does not exist|P2021/i.test(String((err as { message?: string })?.message || err));
}

/** Chuẩn hoá input từ client; null nếu không hợp lệ. */
export function cleanAlert(input: unknown): { market: "US" | "AU"; state: string | null; skill: string | null } | null {
  const b = input as { market?: unknown; state?: unknown; skill?: unknown } | null;
  if (!b || (b.market !== "US" && b.market !== "AU")) return null;
  const state = b.state == null || b.state === "" ? null : String(b.state).toUpperCase();
  if (state && !(b.market === "US" ? US : AU).includes(state)) return null;
  const skill = b.skill == null || b.skill === "" ? null : String(b.skill);
  if (skill && !ALERT_SKILLS.includes(skill)) return null;
  return { market: b.market, state, skill };
}

interface NewJob {
  id: string;
  ownerId: string;
  title: string;
  salonName: string;
  city: string;
  market: string;
  state: string;
  salaryAmount: string;
  skills: string; // "A,B"
}

/** Báo cho người có bộ lọc khớp. `skip` = đã được báo qua kênh khác (VD tin gấp). */
export async function notifyJobAlerts(job: NewJob, skip: Set<string> = new Set()): Promise<string[]> {
  try {
    const skills = job.skills.split(",").map((s) => s.trim()).filter(Boolean);
    const alerts = await prisma.jobAlert.findMany({
      where: {
        market: job.market as "US" | "AU",
        OR: [{ state: null }, { state: job.state }],
        AND: [{ OR: [{ skill: null }, ...(skills.length ? [{ skill: { in: skills } }] : [])] }],
        userId: { not: job.ownerId },
      },
      select: { userId: true },
      take: 5000,
    });
    const ids = [...new Set(alerts.map((a) => a.userId))].filter((id) => !skip.has(id));
    if (ids.length) {
      await sendPush(ids, {
        title: "🔔 Việc mới đúng tiêu chí của bạn",
        body: `${job.salonName} tại ${job.city}: ${job.title} — ${job.salaryAmount}`,
        url: `/jobs/${job.id}`,
        tag: `pn-job-${job.id}`, // trùng tag tin gấp → không bao giờ hiện 2 lần
      });
    }
    return ids;
  } catch (err) {
    if (!isMissingTable(err)) console.error("notifyJobAlerts error:", err);
    return [];
  }
}
