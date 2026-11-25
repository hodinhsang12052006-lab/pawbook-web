import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const [out, ...files] = process.argv.slice(2);
const PW = 760, PH = 380, cols = 2;
const ims = await Promise.all(files.map((f) => sharp(f).resize(PW, PH, { fit: "contain", background: "#111" }).toBuffer()));
await sharp({ create: { width: cols * (PW + 6), height: Math.ceil(ims.length / cols) * (PH + 6), channels: 3, background: "#000" } }).composite(ims.map((input, i) => ({ input, left: (i % cols) * (PW + 6), top: Math.floor(i / cols) * (PH + 6) }))).jpeg({ quality: 86 }).toFile(out);
