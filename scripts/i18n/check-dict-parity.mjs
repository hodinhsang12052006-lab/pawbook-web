// Bộ từ điển en.json và vi.json phải có CÙNG tập khoá. Thiếu khoá ở en.json thì
// t() rơi về tên khoá (không bao giờ về tiếng Việt cho người dùng EN — xem
// LanguageProvider), nên thiếu khoá = lỗi hiển thị.
//   node scripts/i18n/check-dict-parity.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../lib/i18n/dictionaries");
const load = (l) => JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), "utf8"));

function keys(obj, prefix = "", out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) keys(v, key, out);
    else out.set(key, v);
  }
  return out;
}

const en = keys(load("en"));
const vi = keys(load("vi"));
const missingEn = [...vi.keys()].filter((k) => !en.has(k));
const missingVi = [...en.keys()].filter((k) => !vi.has(k));
const emptyEn = [...en.entries()].filter(([, v]) => typeof v === "string" && !v.trim()).map(([k]) => k);
const VN = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
const viInEn = [...en.entries()].filter(([, v]) => typeof v === "string" && VN.test(v)).map(([k]) => k);

const report = (label, list) => {
  console.log(`${list.length ? "❌" : "✅"} ${label}: ${list.length}`);
  for (const k of list.slice(0, 30)) console.log(`   - ${k}`);
};
report("keys in vi.json missing from en.json", missingEn);
report("keys in en.json missing from vi.json", missingVi);
report("empty strings in en.json", emptyEn);
report("Vietnamese text inside en.json", viInEn);
const fail = missingEn.length + missingVi.length + emptyEn.length + viInEn.length;
console.log(fail ? `\ndictionary parity: FAIL (${fail})` : `\ndictionary parity: PASS (${en.size} keys)`);
process.exit(fail ? 1 : 0);
