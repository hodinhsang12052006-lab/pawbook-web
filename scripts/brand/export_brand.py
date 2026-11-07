"""Dev-only: derive every brand asset from the ONE logo, public/logo_b.jpg (owner decision 2026-11-07:
the neon 'B' is the only PawNail logo; the Shiba mascot is retired from every surface).

    python scripts/brand/export_brand.py

The source file is never modified: every output is a scaled copy (LANCZOS, sRGB, metadata stripped).
Writes
  public/brand/logo-b-{64,128,256}.webp   UI sizes (28-40 px chrome at DPR 2-3, 88-128 px official avatar)
  public/brand/logo-b-512.jpg             social/OG + anything that needs a JPEG
  public/brand/pawnail-official.jpg       legacy URL of the official account avatar (prod rows point here; kept, B content)
  public/brand/pawnail-official-b.jpg     versioned official avatar (lib/brand.ts maps the legacy URL here so a
                                          stale image / service-worker cache can never show the retired mascot)
  public/brand/logo-b-96.png              email header lockup (PNG: Outlook / Gmail do not render WebP)
  public/icons/badge-b-96.png             push badge: white 'B' on transparent (Android masks the badge to its alpha;
                                          a full-colour icon renders as a white square)
  native-shell/offline.html               144 px JPEG data URI inside <div class="logo">
  android/app/src/main/res/drawable*/splash.png, assets/splash.png, iOS Splash.imageset Default@*.png
                                          plum stage + soft key light + the logo tile, same pixel sizes as before
"""
import base64, glob, io, os, re
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "public", "logo_b.jpg")
GROUND = (28, 21, 33)        # #1c1521  v2 canvas
GROUND_TOP = (36, 27, 41)    # #241b29
ACCENT = (219, 39, 119)      # #db2777


def logo(size):
    im = Image.open(SRC).convert("RGB")
    return im.resize((size, size), Image.LANCZOS)


def save_webp(size, name):
    p = os.path.join(ROOT, "public", "brand", name)
    logo(size).save(p, "WEBP", quality=86, method=6)
    return p


def rounded(im, radius):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.size[0] - 1, im.size[1] - 1), radius=radius, fill=255)
    out = Image.new("RGBA", im.size)
    out.paste(im.convert("RGBA"), (0, 0), mask)
    return out


def stage(w, h):
    """Plum ground (top a touch lighter) + one soft accent light behind the tile + a gentle vignette."""
    bg = Image.new("RGB", (w, h), GROUND)
    top = Image.new("RGB", (w, h), GROUND_TOP)
    grad = Image.linear_gradient("L").resize((w, h)).point(lambda v: 255 - v)  # 255 at the top -> 0 at the bottom
    bg = Image.composite(top, bg, grad.point(lambda v: int(v * 0.8)))
    m = min(w, h)
    glow = Image.new("L", (w, h), 0)
    r = int(m * 0.42)
    ImageDraw.Draw(glow).ellipse((w // 2 - r, h // 2 - r, w // 2 + r, h // 2 + r), fill=int(255 * 0.20))
    glow = glow.filter(ImageFilter.GaussianBlur(m * 0.16))
    bg = Image.composite(Image.new("RGB", (w, h), ACCENT), bg, glow)
    vig = Image.new("L", (w, h), 0)
    ImageDraw.Draw(vig).ellipse((-w * 0.25, -h * 0.2, w * 1.25, h * 1.2), fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(m * 0.2)).point(lambda v: int((255 - v) * 0.45))
    bg = Image.composite(Image.new("RGB", (w, h), (12, 7, 14)), bg, vig)
    return bg


def splash(w, h, frac=0.26):
    bg = stage(w, h).convert("RGBA")
    s = max(24, int(min(w, h) * frac))
    tile = rounded(logo(s), int(s * 0.2))
    shadow = Image.new("L", (w, h), 0)
    x, y = (w - s) // 2, (h - s) // 2
    ImageDraw.Draw(shadow).rounded_rectangle((x, y + s * 0.06, x + s, y + s * 1.06), radius=int(s * 0.2), fill=150)
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(2, s * 0.08)))
    bg = Image.composite(Image.new("RGBA", (w, h), (8, 4, 10, 255)), bg, shadow)
    bg.alpha_composite(tile, (x, y))
    return bg.convert("RGB")


def badge(size):
    """Monochrome alpha 'B' (white glyph, transparent ground) for the Android notification badge."""
    from PIL import ImageFont
    scale = 4
    S = size * scale
    font_path = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", "seguibl.ttf")
    font = ImageFont.truetype(font_path, int(S * 0.86))
    m = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(m)
    x0, y0, x1, y1 = d.textbbox((0, 0), "B", font=font)
    d.text(((S - (x1 - x0)) / 2 - x0, (S - (y1 - y0)) / 2 - y0), "B", font=font, fill=255)
    m = m.resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    out.putalpha(m)
    return out


def main():
    os.makedirs(os.path.join(ROOT, "public", "brand"), exist_ok=True)
    for s in (64, 128, 256):
        print(save_webp(s, f"logo-b-{s}.webp"))
    logo(512).save(os.path.join(ROOT, "public", "brand", "logo-b-512.jpg"), "JPEG", quality=86, optimize=True, progressive=True)
    logo(512).save(os.path.join(ROOT, "public", "brand", "pawnail-official.jpg"), "JPEG", quality=86, optimize=True, progressive=True)
    logo(512).save(os.path.join(ROOT, "public", "brand", "pawnail-official-b.jpg"), "JPEG", quality=86, optimize=True, progressive=True)
    logo(96).save(os.path.join(ROOT, "public", "brand", "logo-b-96.png"), "PNG", optimize=True)
    badge(96).save(os.path.join(ROOT, "public", "icons", "badge-b-96.png"), "PNG", optimize=True)

    # native offline page: one self-contained data URI (hosted mode serves only that file from the app bundle)
    p = os.path.join(ROOT, "native-shell", "offline.html")
    html = open(p, encoding="utf-8").read()
    buf = io.BytesIO()
    logo(144).save(buf, "JPEG", quality=82, optimize=True)
    uri = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    html2, n = re.subn(r'data:image/jpeg;base64,[A-Za-z0-9+/=]+', uri, html)
    assert n == 1, n
    open(p, "w", encoding="utf-8", newline="").write(html2)

    targets = glob.glob(os.path.join(ROOT, "android", "app", "src", "main", "res", "drawable*", "splash.png"))
    targets += [os.path.join(ROOT, "assets", "splash.png")]
    targets += glob.glob(os.path.join(ROOT, "ios", "App", "App", "Assets.xcassets", "Splash.imageset", "Default@*.png"))
    for t in targets:
        w, h = Image.open(t).size
        splash(w, h).save(t, "PNG", optimize=True)
        print(t, w, h, os.path.getsize(t))


if __name__ == "__main__":
    main()
