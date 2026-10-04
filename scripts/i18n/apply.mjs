// Áp bản dịch: node scripts/i18n/apply.mjs scripts/i18n/maps/*.json
// Mỗi map: { "file": "components/x.tsx", "map": { "<chuỗi Việt y như trong code>": "<English>" } }
// • chữ JSX  →  {tr("…", "…")}     • attr="…" →  attr={tr("…", "…")}
// • "…" trong code → tr("…", "…")    • `…${x}…` → tr(`…${x}…`, `…${x}…`)
// Rồi chèn import + `useTr();` vào đầu mỗi component (để render lại khi đổi VI/EN).
// Chuỗi không có trong map giữ nguyên (VD: giá trị dữ liệu lưu DB).
import fs from "node:fs";
import { scan } from "./extract.mjs";

const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”").replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

let total = 0;
for (const mapFile of process.argv.slice(2)) {
  const { file, map } = JSON.parse(fs.readFileSync(mapFile, "utf8"));
  let src = fs.readFileSync(file, "utf8");
  const crlf = src.includes("\r\n");
  src = src.replace(/\r\n/g, "\n");
  const items = scan(src).sort((a, b) => b.start - a.start); // thay từ cuối file lên
  const used = new Set();
  let count = 0;
  for (const it of items) {
    if (it.kind === "jsx") {
      const raw = it.text;
      const core = raw.trim();
      const en = map[core];
      if (en === undefined) continue;
      const lead = raw.match(/^\s*/)[0];
      const trail = raw.match(/\s*$/)[0];
      const inLead = lead.includes("\n") ? "" : lead;
      const inTrail = trail.includes("\n") ? "" : trail;
      const outLead = lead.includes("\n") ? lead : "";
      const outTrail = trail.includes("\n") ? trail : "";
      const vi = decode(inLead + core + inTrail);
      const enFull = inLead + en + inTrail;
      src = src.slice(0, it.start) + outLead + `{tr(${JSON.stringify(vi)}, ${JSON.stringify(enFull)})}` + outTrail + src.slice(it.end);
      used.add(core);
      count++;
    } else if (it.kind === "str") {
      const en = map[it.text];
      if (en === undefined) continue;
      // giá trị attr="…" (JSX) → attr={…}
      const before = src.slice(0, it.start).replace(/\s+$/, "");
      const isAttr = before.endsWith("=") && /[A-Za-z-]=$/.test(before);
      const call = `tr(${JSON.stringify(it.text.replace(/\\"/g, '"'))}, ${JSON.stringify(en)})`;
      src = src.slice(0, it.start) + (isAttr ? `{${call}}` : call) + src.slice(it.end);
      used.add(it.text);
      count++;
    } else if (it.kind === "tpl") {
      const en = map[it.text];
      if (en === undefined) continue;
      const before = src.slice(0, it.start).replace(/\s+$/, "");
      const isAttr = /[A-Za-z-]=$/.test(before);
      const call = `tr(\`${it.text}\`, \`${en}\`)`;
      src = src.slice(0, it.start) + (isAttr ? `{${call}}` : call) + src.slice(it.end);
      used.add(it.text);
      count++;
    }
  }
  const missing = Object.keys(map).filter((k) => !used.has(k));
  if (missing.length) console.warn(`⚠ ${file}: ${missing.length} chuỗi trong map không tìm thấy:\n   ` + missing.slice(0, 8).join("\n   "));

  if (count) {
    // import
    if (!/from "@\/lib\/i18n\/tr"/.test(src)) {
      const lines = src.split("\n");
      let last = 0;
      lines.forEach((l, i) => { if (/^import .* from /.test(l) && i < 80) last = i; });
      lines.splice(last + 1, 0, 'import { tr } from "@/lib/i18n/tr";', 'import { useTr } from "@/lib/i18n/useTr";');
      src = lines.join("\n");
    } else if (!/import \{ useTr \}/.test(src)) {
      src = src.replace(/(import \{ tr \} from "@\/lib\/i18n\/tr";)/, `$1\nimport { useTr } from "@/lib/i18n/useTr";`);
    }
    // useTr() ở đầu mỗi component có thân hàm { … }
    const compRe = /\n((?:export (?:default )?)?function ([A-Z][A-Za-z0-9]*)\s*\([\s\S]*?\)\s*(?::\s*[^{]+)?\{)\n/g;
    src = src.replace(compRe, (m, head, name) => {
      return `\n${head}\n  useTr(); // render lại khi đổi VI/EN\n`;
    });
    const arrowRe = /\n((?:export )?const ([A-Z][A-Za-z0-9]*)\s*=\s*\([^)]*\)\s*(?::\s*[^=]+)?=>\s*\{)\n/g;
    src = src.replace(arrowRe, (m, head) => `\n${head}\n  useTr(); // render lại khi đổi VI/EN\n`);
    // tránh chèn trùng nếu chạy lại
    src = src.replace(/(\n  useTr\(\); \/\/ render lại khi đổi VI\/EN)(\n  useTr\(\); \/\/ render lại khi đổi VI\/EN)+/g, "$1");
  }
  if (crlf) src = src.replace(/\n/g, "\r\n");
  fs.writeFileSync(file, src);
  total += count;
  console.log(`✓ ${file}: ${count} chỗ`);
}
console.log("Tổng:", total);
