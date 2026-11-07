"""Dev-only: export the approved Google Flow hero/auth photos (AI illustrations) to public/hero/.

    python scripts/hero/export_hero.py <flow_ok dir> [qa_rejected.json]

Source: the owner-approved Flow catalog images (Dxxx.jpg, 1024x1024). Crop = 4:5 at full height (819x1024)
starting at x0 = fraction * 1024 (table below = lib/heroImagery.ts HERO_IMAGES crop.x0), LANCZOS resize,
sRGB, metadata stripped. Writes <code>-480/640/800.avif (AVIF q58 speed 4) + <code>-640.webp (q76 method 6).
Every file must stay <= 120 KB. Never uses a code listed in flow/qa_rejected.json.
"""
import json, os, sys
from PIL import Image

CROPS = {  # code: x0 fraction (keep in sync with lib/heroImagery.ts)
    "D130": 0.00, "D149": 0.20, "D047": 0.00, "D033": 0.00, "D021": 0.20, "D058": 0.15,
    "D164": 0.00, "D185": 0.00, "D210": 0.10, "D196": 0.00, "D139": 0.20, "D186": 0.00,
    "D044": 0.00, "D094": 0.10, "D161": 0.00, "D129": 0.20, "D125": 0.00, "D041": 0.00,
    "D019": 0.20, "D063": 0.10, "D025": 0.20, "D110": 0.20, "D034": 0.15, "D090": 0.10,
}
WIDTHS = (480, 640, 800)
LIMIT = 120 * 1024

def main():
    src = sys.argv[1]
    rejected = set()
    if len(sys.argv) > 2:
        rejected = {r["code"] for r in json.load(open(sys.argv[2], encoding="utf-8"))}
    out = os.path.join(os.path.dirname(__file__), "..", "..", "public", "hero")
    os.makedirs(out, exist_ok=True)
    bad = [c for c in CROPS if c in rejected]
    assert not bad, f"rejected codes in the hero table: {bad}"
    total = 0
    for code, frac in CROPS.items():
        im = Image.open(os.path.join(src, f"{code}.jpg")).convert("RGB")
        w, h = im.size
        cw = round(h * 4 / 5)
        x0 = min(round(frac * w), w - cw)
        crop = im.crop((x0, 0, x0 + cw, h))
        base = code.lower()
        for tw in WIDTHS:
            th = tw * 5 // 4
            r = crop.resize((tw, th), Image.LANCZOS)
            p = os.path.join(out, f"{base}-{tw}.avif")
            r.save(p, "AVIF", quality=58, speed=4)
            total += os.path.getsize(p)
            assert os.path.getsize(p) <= LIMIT, (p, os.path.getsize(p))
            if tw == 640:
                p = os.path.join(out, f"{base}-640.webp")
                r.save(p, "WEBP", quality=76, method=6)
                total += os.path.getsize(p)
                assert os.path.getsize(p) <= LIMIT, (p, os.path.getsize(p))
        print(code, "ok")
    print(f"{len(CROPS)} codes, {total / 1024:.0f} KB total")

if __name__ == "__main__":
    main()
