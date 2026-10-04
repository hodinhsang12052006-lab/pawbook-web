// Trích các chuỗi tiếng Việt HIỂN THỊ trong file .tsx (bỏ qua chú thích):
//   node scripts/i18n/extract.mjs <file...>  → in JSON { file: [{ kind, text }] }
// kind: "jsx" (chữ giữa thẻ JSX) | "str" (chuỗi "…") | "tpl" (template `…`)
import fs from "node:fs";

const VN = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/;

export function scan(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  let segStart = -1; // bắt đầu đoạn chữ JSX tiềm năng
  const flushSeg = (end) => {
    if (segStart < 0) return;
    const raw = src.slice(segStart, end);
    if (VN.test(raw) && !/[;=]|\bconst\b|\breturn\b/.test(raw.trim().slice(0, 12))) out.push({ kind: "jsx", text: raw, start: segStart, end });
    segStart = -1;
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { flushSeg(i); while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { flushSeg(i); const e = src.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'") {
      flushSeg(i);
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") { if (src[j] === "\\") j++; j++; }
      const text = src.slice(i + 1, j);
      if (VN.test(text) && c === '"') out.push({ kind: "str", text, start: i, end: j + 1 });
      i = j + 1;
      continue;
    }
    if (c === "`") {
      flushSeg(i);
      let j = i + 1, depth = 0;
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue; }
        if (depth === 0 && src[j] === "`") break;
        if (src[j] === "$" && src[j + 1] === "{") { depth++; j += 2; continue; }
        if (depth > 0 && src[j] === "}") { depth--; j++; continue; }
        j++;
      }
      const text = src.slice(i + 1, j);
      if (VN.test(text.replace(/\$\{[^}]*\}/g, ""))) out.push({ kind: "tpl", text, start: i, end: j + 1 });
      i = j + 1;
      continue;
    }
    if (c === ">" || c === "}") { flushSeg(i); segStart = i + 1; i++; continue; }
    if (c === "<" || c === "{") { flushSeg(i); i++; continue; }
    if (segStart < 0 && VN.test(c)) {
      // chữ Việt ngoài chuỗi/chú thích mà chưa có đoạn mở → lùi tới dấu > hoặc } gần nhất
      let k = i;
      while (k > 0 && !">}".includes(src[k - 1]) && src[k - 1] !== "\n") k--;
      segStart = k;
    }
    i++;
  }
  return out;
}

if (process.argv[1]?.endsWith("extract.mjs")) {
  const res = {};
  for (const f of process.argv.slice(2)) {
    const items = scan(fs.readFileSync(f, "utf8"));
    const seen = new Set();
    res[f] = items
      .map((it) => ({ kind: it.kind, text: it.kind === "jsx" ? it.text.trim() : it.text }))
      .filter((it) => it.text && !seen.has(it.kind + it.text) && seen.add(it.kind + it.text));
  }
  console.log(JSON.stringify(res, null, 1));
}
