# Puts a print onto a shirt photo: follows the folds (displacement from the photo's shading) and takes
# the fabric's light and shadow (multiply by normalized luminance). args: photo art out cx top widthPx [hollow]
import sys, numpy as np
from PIL import Image, ImageFilter
photo, art, out, cx, top, wpx = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6])
P = Image.open(photo).convert("RGB"); A = Image.open(art).convert("RGBA")
h = round(A.height * wpx / A.width); A = A.resize((wpx, h), Image.LANCZOS)
layer = Image.new("RGBA", P.size, (0, 0, 0, 0)); layer.paste(A, (cx - wpx // 2, top))
L = np.asarray(P.convert("L").filter(ImageFilter.GaussianBlur(3)), dtype=np.float32) / 255
x0, x1, y0, y1 = cx - wpx // 2, cx + wpx // 2, top, top + h
avg = float(np.median(L[y0:y1, x0:x1]))
# displacement: shift by the shading gradient (folds bend the print a few pixels)
gy, gx = np.gradient(np.asarray(P.convert("L").filter(ImageFilter.GaussianBlur(15)), dtype=np.float32))
k = 0.35
H, W = L.shape; yy, xx = np.mgrid[0:H, 0:W]
sx = np.clip((xx + gx * k).round().astype(int), 0, W - 1); sy = np.clip((yy + gy * k).round().astype(int), 0, H - 1)
lay = np.asarray(layer, dtype=np.float32)[sy, sx]
shade = np.clip(L / avg, 0.55, 1.25)[..., None]
ink = lay[..., :3] * shade
# ink texture: a little of the fabric weave shows through
weave = np.asarray(P.convert("L"), dtype=np.float32) / 255
alpha = lay[..., 3:4] / 255 * np.clip(0.9 + (weave[..., None] - weave.mean()) * 0.6, 0.75, 1.0)
base = np.asarray(P, dtype=np.float32)
res = base * (1 - alpha) + np.clip(ink, 0, 255) * alpha
Image.fromarray(res.astype(np.uint8)).save(out, quality=92)
print("avg shirt luminance", round(avg, 3))
