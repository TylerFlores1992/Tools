# Tent mockup for Still Water (owner's ask, 2026-10-07): a small A-frame tent on the left shore, at the
# base of the mountain, with its reflection upside down in the lake like the rest of the design, and a
# lit doorway (a knockout on the one-ink print, mist ink on the three-ink). Draws onto the 300 dpi kit
# renders; the vector print files are untouched until the owner picks it.
# args: in.png out.png ink-hex door-hex|knockout [reflection-hex]
import sys
import numpy as np
from PIL import Image, ImageDraw

src, out, ink_hex, door = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
refl_hex = sys.argv[5] if len(sys.argv) > 5 else ink_hex
hexrgb = lambda h: tuple(int(h.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
INK, REFL = hexrgb(ink_hex) + (255,), hexrgb(refl_hex) + (255,)

im = Image.open(src).convert("RGBA")
A = np.asarray(im).astype(int)
H, W = A.shape[:2]
ink = (A[..., 3] > 128) & (np.abs(A[..., :3] - np.array(INK[:3])).sum(-1) < 60)

# The waterline: the band of rows that run solid ink across the middle of the design.
cov = ink[:, int(W * .45):int(W * .55)].mean(1)
rows = [y for y in range(int(H * .3), int(H * .55)) if cov[y] > .9]
top, bot = rows[0], rows[-1]
# The left treeline ends where the shore opens up, just above the line.
r = ink[top - 20]
x = int(W * .2)
while x < W // 2 and r[x]: x += 1          # end of the left treeline run
shore = x
cx = shore + 310                            # tent center: clear of the trees, under the high part of the slope

tw, th = 260, 151                           # about 0.87 x 0.5 in at 300 dpi (30% up, owner's call)
# The tent and its reflection go on their own layers (so the ripples cut only the reflection); the
# doorway is cleared from the finished image, so a knockout shows the shirt through it.
dw, dh = 83, 96
def tent(layer, base_y, sign, colour):
    """sign = -1 draws upward from the shore, +1 draws the reflection downward."""
    d = ImageDraw.Draw(layer)
    apex = (cx, base_y + sign * th)
    d.polygon([(cx - tw // 2, base_y), apex, (cx + tw // 2, base_y)], fill=colour)
    # no ridge pole: at this size its tip met the mountain slope above (and its reflection below)
def doorway(base_y, sign):
    return [(cx - dw // 2, base_y), (cx, base_y + sign * dh), (cx + dw // 2, base_y)]

# both halves dip 8 px into the waterline, so its wavy edge leaves no hairline gap against the tent
up = Image.new("RGBA", im.size, (0, 0, 0, 0)); tent(up, top + 8, -1, INK)
down = Image.new("RGBA", im.size, (0, 0, 0, 0)); tent(down, bot - 7, 1, REFL)
dd = ImageDraw.Draw(down)
# a water ripple across the reflection: one horizontal break, 14 px (1.2 mm) tall (two left a stray Y at the tip)
for k in (0.45,):
    y = int(bot + 1 + th * k)
    dd.rectangle([cx - tw // 2 - 30, y, cx + tw // 2 + 30, y + 13], fill=(0, 0, 0, 0))
im.alpha_composite(up); im.alpha_composite(down)
d = ImageDraw.Draw(im)
for door_poly in (doorway(top, -1), doorway(bot + 1, 1)):
    d.polygon(door_poly, fill=(0, 0, 0, 0) if door == "knockout" else hexrgb(door) + (255,))
im.save(out)
print(f"waterline {top}-{bot}, shore at x {shore}, tent at x {cx}")
