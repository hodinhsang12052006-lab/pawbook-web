"""Generate the Android status-bar notification icon (ic_stat_pawnail) from the brand logo.

MECHANICAL ONLY - nothing is drawn by hand and the B is not restyled (owner rule: the
neon B in public/logo_b.jpg is the only logo). Android requires a white-on-transparent
silhouette for small notification icons (a coloured icon renders as a white blob/square),
so this script derives that silhouette from the existing logo:

  1. threshold the neon strokes (bright pixels + the orange glow) of public/logo_b.jpg;
  2. flood-fill the dark background from the image corner; everything not reached is
     "inside", the largest such region is the outer outline of the B;
  3. the B's two counters are the solid dark regions enclosed by the inner neon rings
     (each 2-20 % of the B's area); they are cut out as holes;
  4. the result is scaled so its longest side spans 20 of 24 dp, centred, and written as
     white + alpha PNGs for mdpi..xxxhdpi.

It also prints the brand accent colour (median of the saturated neon-orange pixels),
used as @color/pn_notification_accent.

Requires: python 3, numpy, opencv-python.  Run from the repo root:
    python scripts/android/make_notification_icon.py
"""

import os
import sys

import cv2
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "public", "logo_b.jpg")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
SIZES = {"mdpi": 24, "hdpi": 36, "xhdpi": 48, "xxhdpi": 72, "xxxhdpi": 96}
GLYPH_FRACTION = 20.0 / 24.0  # Material: 24dp icon, 20dp live area


def silhouette(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    orange = (hsv[:, :, 0] <= 25) & (hsv[:, :, 1] > 110) & (hsv[:, :, 2] > 120)
    strokes = ((orange | (gray > 140)) * 255).astype(np.uint8)
    strokes = cv2.morphologyEx(strokes, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))

    dark = (strokes == 0).astype(np.uint8)
    _, lab, stats, _ = cv2.connectedComponentsWithStats(dark, connectivity=4)
    outside = lab[0, 0]
    inside = (lab != outside).astype(np.uint8)
    inside = cv2.morphologyEx(inside, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    _, lab2, st2, _ = cv2.connectedComponentsWithStats(inside, connectivity=4)
    big = 1 + int(np.argmax(st2[1:, cv2.CC_STAT_AREA]))
    glyph = (lab2 == big).astype(np.uint8)
    area = float(glyph.sum())

    holes = 0
    for i in range(stats.shape[0]):
        if i == outside:
            continue
        comp = lab == i
        a = float(comp.sum())
        if not (0.02 * area <= a <= 0.20 * area):
            continue
        if glyph[comp].mean() < 0.999:
            continue
        # Fill the counter's outer contour (swallows the small badges drawn inside it).
        cnts, _ = cv2.findContours(comp.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        hole = np.zeros_like(glyph)
        cv2.drawContours(hole, cnts, -1, 1, thickness=cv2.FILLED)
        # A counter is a compact dark pocket that fills most of its bounding box; the thin
        # dark strokes running along the neon tube (spanning the whole letter) are not.
        x, y, w, h = stats[i, :4]
        if a / float(w * h) < 0.5:
            continue
        glyph[hole == 1] = 0
        holes += 1
    if holes != 2:
        sys.exit(f"expected the B's 2 counters, found {holes}; logo changed? not writing icons")
    return glyph


def accent(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    sel = (hsv[:, :, 0] >= 6) & (hsv[:, :, 0] <= 20) & (hsv[:, :, 1] > 170) & (hsv[:, :, 2] > 200)
    rgb = np.median(img[sel][:, ::-1], axis=0).astype(int)
    return "#%02X%02X%02X" % tuple(rgb)


def main():
    img = cv2.imread(SRC)
    if img is None:
        sys.exit(f"cannot read {SRC}")
    glyph = silhouette(img)
    ys, xs = np.nonzero(glyph)
    crop = glyph[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1].astype(np.float32)
    h, w = crop.shape
    canvas = 1024
    scale = canvas * GLYPH_FRACTION / max(h, w)
    nh, nw = int(round(h * scale)), int(round(w * scale))
    big = np.zeros((canvas, canvas), np.float32)
    y0, x0 = (canvas - nh) // 2, (canvas - nw) // 2
    big[y0 : y0 + nh, x0 : x0 + nw] = cv2.resize(crop, (nw, nh), interpolation=cv2.INTER_AREA)
    for density, px in SIZES.items():
        alpha = cv2.resize(big, (px, px), interpolation=cv2.INTER_AREA)
        alpha = np.clip(alpha * 255.0 + 0.5, 0, 255).astype(np.uint8)
        out = np.dstack([np.full_like(alpha, 255)] * 3 + [alpha])  # BGRA, pure white
        d = os.path.join(RES, f"drawable-{density}")
        os.makedirs(d, exist_ok=True)
        cv2.imwrite(os.path.join(d, "ic_stat_pawnail.png"), out, [cv2.IMWRITE_PNG_COMPRESSION, 9])
        print(f"drawable-{density}/ic_stat_pawnail.png {px}x{px}")
    print("accent", accent(img))


if __name__ == "__main__":
    main()
