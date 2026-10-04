// Tìm tr(...) bị gọi NGAY lúc nạp module (hằng số cấp module) — những chỗ này
// không đổi theo VI/EN. node scripts/i18n/check-eager.mjs <file...>
import fs from "node:fs";

for (const f of process.argv.slice(2)) {
  const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
  let inStmt = false, lazy = false, depth = 0, head = "";
  lines.forEach((line, i) => {
    if (!inStmt && /^(export )?(const|let) [A-Za-z_]\w*/.test(line)) {
      inStmt = true;
      head = line;
      lazy = /=>|function\b|=\s*\(\s*\)\s*:/.test(line.split("=").slice(1).join("="));
      depth = 0;
    }
    if (inStmt) {
      if (!lazy && /\btr\(/.test(line)) console.log(`${f}:${i + 1}: ${line.trim().slice(0, 110)}`);
      for (const ch of line) { if ("{[(".includes(ch)) depth++; if ("}])".includes(ch)) depth--; }
      if (depth <= 0 && /[;}\]]\s*;?\s*$/.test(line)) inStmt = false;
    }
  });
}
