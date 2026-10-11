// POST /api/jobs/sync (định dạng tool) + chống trùng (bump, repost_count) + GET /api/jobs?state=&q=
// Dữ liệu HƯ CẤU (555-01xx). CHỈ chạy với server local.   node scripts/qa/jobs_sync_test.mjs
import { createClient } from "@libsql/client";
import { BASE_URL, Results } from "./lib.mjs";

const R = new Results("Đồng bộ tin từ tool (/api/jobs/sync)");
const db = createClient({ url: "file:prisma/dev.db" });
const KEY = "test-ingest-key-0123456789abcdef";
const sync = (body, headers = { authorization: `Bearer ${KEY}` }) => fetch(BASE_URL + "/api/jobs/sync", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));
const t = String(Date.now()).slice(-5);
const PH = `(832) 555-0${t.slice(-3)}`;
const FB = `https://www.facebook.com/profile.php?id=1000${t}`;
const base = {
  title: `Cần tuyển Thợ Bột / Acrylic, Chân Tay Nước - Houston, TX 77083 #${t}`,
  salon_name: `Diamond Nails ${t}`,
  phone: PH,
  facebook_url: FB,
  location: "Houston, TX 77083",
  state: "TX",
  salary: "$1,500/tuần",
  skills: ["Thợ Bột / Acrylic", "Chân Tay Nước"],
  content: `Tiệm Diamond Nails ${t} khu Alief cần thợ bột và chân tay nước, bao lương $1,500/tuần. Gọi ${PH}`,
  post_url: `https://facebook.com/groups/g/posts/${t}1`,
  country: "Mỹ (USA)",
};
const row = async (id) => (await db.execute({ sql: `SELECT title, salonName, phone, city, state, zip, salaryAmount, skills, description, repostCount, lastRepostedAt, sourceFbHash, sourceUrl, createdAt FROM "Job" WHERE id = ?`, args: [id] })).rows[0];

try {
  const bad = await sync(base, {});
  const viaHeader = await sync({ ...base, phone: "" , content: "x" }, { "x-api-key": KEY });
  R.check("S1", "Không khoá → 401; nhận khoá qua header x-api-key", bad.status === 401 && viaHeader.status !== 401);

  const c = await sync(base);
  const id = c.data.job_id;
  const r1 = await row(id);
  R.check("S2", "Bài mới → tạo tin (201), repost_count = 1; tiêu đề PawNail tự tạo gọn ('Cần thợ Bột/Acrylic/…'); tên tiệm lấy từ bài", c.status === 201 && c.data.status === "created" && c.data.repost_count === 1 && /^Cần thợ Bột\/Acrylic\/Chân tay nước/.test(String(r1.title)) && r1.salonName === "Diamond Nails", JSON.stringify({ d: c.data, title: r1.title, salon: r1.salonName }));
  // Ô location chỉ có "TX 77521" nhưng tiêu đề ghi "- Baytown, TX" → vẫn có thành phố
  const lc = await sync({ ...base, phone: `(281) 555-0${t.slice(-3)}`, facebook_url: `https://facebook.com/lc.${t}`, location: "TX 77521", title: "Cần tuyển Gel-X - Baytown, TX", post_url: `https://facebook.com/groups/g/posts/${t}9`, salon_name: "Kaia Vu", content: `Cần thợ gel-x gấp, gọi (281) 555-0${t.slice(-3)}` });
  const rl = lc.data.job_id ? await row(lc.data.job_id) : null;
  R.check("S2b", "Location 'TX 77521' + tiêu đề '- Baytown, TX' → Baytown, TX 77521; bài không ghi tên tiệm → dùng tên tool gửi", rl?.city === "Baytown" && rl?.state === "TX" && rl?.zip === "77521" && rl?.salonName === "Kaia Vu", JSON.stringify(rl));
  R.check("S3", "Tách location 'Houston, TX 77083'; lương; kỹ năng tool → chuẩn PawNail", r1.city === "Houston" && r1.state === "TX" && r1.zip === "77083" && r1.salaryAmount === "$1,500/tuần" && String(r1.skills).includes("Bột/Acrylic") && String(r1.skills).includes("Chân tay nước"), JSON.stringify(r1));
  R.check("S4", "Facebook người đăng chỉ lưu MÃ BĂM (không lưu link)", /^[0-9a-f]{64}$/.test(String(r1.sourceFbHash)) && !JSON.stringify(r1).includes("profile.php"));

  // Tool gửi lại ĐÚNG bài cũ → chỉ cập nhật, không tính đăng lại
  const same = await sync(base);
  R.check("S5", "Gửi lại đúng bài cũ (cùng post_url) → 'updated', repost_count vẫn 1", same.data.status === "updated" && same.data.repost_count === 1 && same.data.job_id === id, JSON.stringify(same.data));

  // Tiệm ĐĂNG LẠI (bài mới, cùng SĐT) → bump
  await new Promise((r) => setTimeout(r, 1100));
  const again = await sync({ ...base, post_url: `https://facebook.com/groups/g/posts/${t}2`, content: `${base.content}\nCẬP NHẬT: thêm 1 thợ dip.` });
  const r2 = await row(id);
  R.check("S6", "Cùng SĐT đăng bài mới → 'bumped': KHÔNG tạo tin mới, repost_count = 2, last_reposted_at, nội dung mới nhất", again.data.status === "bumped" && again.data.job_id === id && again.data.repost_count === 2 && !!r2.lastRepostedAt && String(r2.description).includes("CẬP NHẬT"), JSON.stringify(again.data));
  const list = await fetch(`${BASE_URL}/api/jobs?market=US&state=TX&n=${t}`).then((r) => r.json());
  R.check("S7", "Tin vừa bump lên ĐẦU danh sách", list[0]?.id === id, list.slice(0, 2).map((j) => j.salonName).join(" | "));

  // Đổi SĐT nhưng cùng Facebook người đăng → vẫn nhận ra cùng tiệm
  const fb = await sync({ ...base, phone: `(713) 555-0${t.slice(-3)}`, post_url: `https://facebook.com/groups/g/posts/${t}3`, content: `Diamond Nails ${t} cần thợ gấp, gọi số mới (713) 555-0${t.slice(-3)}` });
  const cnt = Number((await db.execute({ sql: `SELECT COUNT(*) n FROM "Job" WHERE sourceFbHash = (SELECT sourceFbHash FROM "Job" WHERE id = ?)`, args: [id] })).rows[0].n);
  R.check("S8", "Đổi SĐT nhưng cùng Facebook người đăng → bump (repost 3), vẫn chỉ 1 tin", fb.data.status === "bumped" && fb.data.repost_count === 3 && cnt === 1, JSON.stringify(fb.data));

  // Gửi nhiều bài 1 lần (mảng) + Úc
  const batch = await sync([
    { ...base, salon_name: `Rose Nails ${t}`, phone: `(214) 555-0${t.slice(-3)}`, facebook_url: `https://facebook.com/rose.${t}`, location: "Dallas, TX", post_url: `https://facebook.com/groups/g/posts/${t}4`, content: `Rose Nails cần thợ gel-x ở Dallas, gọi (214) 555-0${t.slice(-3)}` },
    { title: "Cần thợ nail", salon_name: `Lotus Nails ${t}`, phone: `0412 555 ${t.slice(-3)}`, location: "Bankstown NSW 2200", country: "Úc", salary: "$32/giờ", content: `Lotus Nails Bankstown cần thợ, $32/hr. Call 0412 555 ${t.slice(-3)}`, post_url: `https://facebook.com/groups/g/posts/${t}5` },
    { title: "Mình tìm việc", content: "Mình cần tìm việc nail ở Houston", phone: "" },
  ]);
  const au = batch.data.results?.[1]?.job_id ? await row(batch.data.results[1].job_id) : null;
  R.check("S9", "Gửi mảng: 2 tạo mới + 1 bỏ qua; Úc → NSW, Bankstown, +61", batch.data.created === 2 && batch.data.skipped === 1 && au?.state === "NSW" && au?.city === "Bankstown" && String(au?.phone).startsWith("04"), JSON.stringify(batch.data).slice(0, 220));

  // GET /api/jobs?state=&q=
  const q1 = await fetch(`${BASE_URL}/api/jobs?state=TX&q=${encodeURIComponent(`Diamond Nails ${t} cần thợ gấp`)}`).then((r) => r.json());
  const q2 = await fetch(`${BASE_URL}/api/jobs?state=TX&q=khongcotiemnaynhe${t}`).then((r) => r.json());
  const q3 = await fetch(`${BASE_URL}/api/jobs?state=NSW&q=Bankstown`).then((r) => r.json());
  R.check("S10", "GET /api/jobs?state=TX&q=tên tiệm → tìm đúng; từ khoá không có → rỗng; lọc bang NSW + q", q1.length === 1 && q1[0].id === id && q2.length === 0 && q3.some((j) => j.id === batch.data.results?.[1]?.job_id), `${q1.length}/${q2.length}/${q3.length}`);
  R.check("S11", "API công khai KHÔNG lộ link bài / mã băm Facebook", !("sourceUrl" in q1[0]) && !("sourceFbHash" in q1[0]) && !("sourceKey" in q1[0]) && q1[0].repostCount === 3);
} catch (e) {
  R.check("FATAL", String(e?.message || e).slice(0, 200), false);
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
