"""Generate the vibrant Earth range pixel atlas with all 9 facilities across 4 upgrade tiers."""
from PIL import Image, ImageDraw
from pathlib import Path
from random import Random

root = Path(__file__).resolve().parents[1]
out = root / "public/art/site.png"
docs_out = root / "docs/art/site.png"
W, H = 80, 104
# 8 columns x 6 rows = 48 frames:
# 0..7   terrain tiles
# 8..43  9 facilities x 4 tiers (command, pad, refinery, tanks, office, vab, tracking, lab, foundry)
# 44     road lamp
# 45     Tier 2 locked/unbuilt construction pad footprint
atlas = Image.new("RGBA", (W * 8, H * 6))


def frame(index):
    global im, d
    im = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(im)
    return Random(index + 172)


def put(index):
    atlas.paste(im, (index % 8 * W, index // 8 * H))


def iso(x, y, z=0):
    return (round(40 + x - y), round(80 + (x + y) * 0.5 - z))


def face(coords, color):
    d.polygon([iso(*p) for p in coords], fill=color)


def line(a, b, c, w=1):
    d.line((iso(*a), iso(*b)), fill=c, width=w)


def box(x, y, w, h, z, ht, colors):
    a, b = x + w, y + h
    top = z + ht
    face([(x, b, z), (a, b, z), (a, b, top), (x, b, top)], colors[1])
    face([(a, y, z), (a, b, z), (a, b, top), (a, y, top)], colors[2])
    face([(x, y, top), (a, y, top), (a, b, top), (x, b, top)], colors[0])


def tank(x, y, z, w, h, tint="#8fb8c2"):
    cx, cy = iso(x, y, z)
    r = max(2, w // 3)
    d.ellipse((cx - w, cy - r, cx + w, cy + r), fill="#4a707e")
    d.rectangle((cx - w, cy - h, cx + w, cy), fill=tint)
    for k, c in [(1, "#d8f0ec"), (3, "#b7dce0"), (w, "#7aa8b5"), (w * 2 - 2, "#4e7687")]:
        if k < w * 2:
            d.line((cx - w + k, cy - h, cx - w + k, cy), fill=c, width=2)
    for dy in [2, max(3, h - 2)]:
        d.arc((cx - w, cy - dy - r, cx + w, cy - dy + r), 0, 180, fill="#355868")
    d.ellipse((cx - w, cy - h - r, cx + w, cy - h + r), fill="#e8f6f2", outline="#86b8c0")


# Terrain tiles (frames 0..7) — vibrant coastal island meadow & cerulean sea
for i in range(8):
    r = frame(i)
    if i == 7:
        d.line((18, 77, 29, 77, 32, 76, 41, 76), fill="#55b4cf")
        d.line((46, 85, 54, 85), fill="#449cb8")
        put(i)
        continue
    green = ["#5fb36d", "#68be72", "#57ab68", "#6ec375"]
    box(-16, -16, 32, 32, -7, 7, (green[i % 4], "#8f6d4f", "#6e5039"))
    for _ in range(72):
        x = r.randint(-15, 15)
        y = r.randint(-15, 15)
        line(
            (x, y, 0),
            (min(x + 1, 15), y, 0),
            r.choice(["#7ad17c", "#509c5f", "#84d67c", "#4c9459"]),
        )
    if i == 4:
        face([(-16, -10, 0), (16, -10, 0), (16, 10, 0), (-16, 10, 0)], "#4b5863")
        line((-16, 10, 0), (16, 10, 0), "#cfd8d4")
        line((-16, -10, 0), (16, -10, 0), "#cfd8d4")
        for x in range(-16, 16, 9):
            line((x, 0, 0), (x + 4, 0, 0), "#f5c85b")
    if i == 6:
        for x, y, h in [(-6, -6, 17), (5, -4, 20), (-9, 4, 13), (3, 8, 19)]:
            cx, cy = iso(x, y)
            d.line((cx, cy, cx, cy - 8), fill="#6b4b35", width=2)
            for dh in (0, 4, 8):
                width = 7 - dh // 3
                d.polygon(
                    [(cx, cy - h + dh // 2), (cx - width, cy - 5 - dh // 2), (cx + width, cy - 5 - dh // 2)],
                    fill="#2b8456",
                )
                d.polygon(
                    [(cx, cy - h + dh // 2), (cx - width, cy - 5 - dh // 2), (cx - 1, cy - 6 - dh // 2)],
                    fill="#4bc274",
                )
    if i == 5:
        for x, y, w, h in [(-5, -6, 8, 8), (4, 1, 7, 6), (-8, 5, 6, 4)]:
            cx, cy = iso(x, y)
            d.polygon(
                [(cx - w, cy), (cx - w + 2, cy - h), (cx + 2, cy - h - 2), (cx + w, cy - 2), (cx + 3, cy + 1)],
                fill="#c2b69e",
            )
            d.polygon([(cx + 2, cy - h - 2), (cx + w, cy - 2), (cx + 3, cy + 1)], fill="#8a8272")
    put(i)


# 9 Earth facilities x 4 tiers (frames 8..43) — brighter retro-aerospace colors
steel = ("#bcc9cf", "#728fa0", "#4f6a7d")
light = ("#f2ecda", "#c7c3b2", "#9ba39d")
dark = ("#6b7e8d", "#4c6070", "#354757")
warm = ("#f0be7a", "#cc8945", "#965d28")

for typ in range(9):
    for tier in range(4):
        idx = 8 + typ * 4 + tier
        frame(idx)
        box(-13, -13, 26, 26, 0, 2, ("#d6d9cc", "#869da3", "#607780"))

        if typ == 0:  # Mission Control (command)
            box(-11, -10, 22, 20, 2, 8 + tier, steel)
            box(-10, -9, 20, 18, 10 + tier, 2, light)
            box(-8, -8, 14, 15, 12 + tier, 6 + tier, ("#d2ded8", "#7999a3", "#567582"))
            for x in [-8, -4, 0, 4]:
                line((x, 10, 7), (x + 2, 10, 7), "#5be6d4", 2)
            cx, cy = iso(-3, -4, 21 + tier * 2)
            d.line((cx + 2, cy + 5, cx + 1, cy - 1), fill="#546a72", width=3)
            d.polygon([(cx - 8, cy - 5), (cx + 8, cy - 12), (cx + 6, cy - 5), (cx, cy - 1), (cx - 5, cy - 2)], fill="#f6f1e3")
            d.line((cx - 8, cy - 5, cx + 8, cy - 12), fill="#f28c28")

        elif typ == 1:  # Launchpad (pad)
            box(-13, -13, 26, 26, 2, 3, ("#6f7e87", "#50626e", "#3a4b59"))
            for k in [-11, -5, 1, 7]:
                line((k, 11, 5), (k + 3, 11, 5), "#ffae42", 2)
            tower_h = 34 + tier * 4
            x, y = iso(-9, 6, 5)
            d.rectangle((x - 3, y - tower_h, x + 3, y), fill="#4a5e6e")
            for k in range(5, tower_h, 6):
                d.line((x - 3, y - k, x + 3, y - k - 4), fill="#e86f3a")
                d.line((x - 3, y - k - 4, x + 3, y - k - 4), fill="#ff9e52")
            for k in [16, 26]:
                d.line((x, y - k, x + 10, y - k), fill="#c9d1cc", width=2)
            rx, ry = iso(4, -1, 5)
            rh = 34 + tier * 4
            rw = 4 + (1 if tier >= 2 else 0)
            d.polygon(
                [(rx, ry - rh), (rx + rw, ry - rh + 9), (rx + rw, ry - 6), (rx + rw + 3, ry - 1), (rx - rw - 3, ry - 1), (rx - rw, ry - 6), (rx - rw, ry - rh + 9)],
                fill="#f6f1e3",
            )
            d.rectangle((rx + 2, ry - rh + 10, rx + 3, ry - 4), fill="#9cb5ba")
            d.line((rx - rw + 1, ry - rh // 2, rx + rw - 1, ry - rh // 2), fill="#f28c28", width=3)

        elif typ == 2:  # Propellant Refinery (refinery)
            box(-11, -9, 13, 18, 2, 8 + tier, dark)
            tank(5, -5, 2, 5, 16 + tier * 3, "#7cc7d1")
            tank(6, 5, 2, 4, 12 + tier * 2, "#5cb4c2")
            fx, fy = iso(-9, -7, 10 + tier)
            d.line((fx, fy, fx, fy - 18 - tier * 2), fill="#7c9199", width=2)
            d.ellipse((fx - 3, fy - 23 - tier * 2, fx + 3, fy - 17 - tier * 2), fill="#ffae42")
            line((-10, 9, 2), (9, 9, 2), "#4fd1a5", 2)

        elif typ == 3:  # Cryo Tank Farm (tanks)
            positions = [(-7, -5), (6, 1), (-4, 7)] if tier < 2 else [(-7, -6), (6, -5), (-5, 6), (6, 6)]
            for tx, ty in positions:
                tank(tx, ty, 2, 5 if tier >= 2 else 6, 14 + tier * 3)
            line((-10, 10, 2), (8, 10, 2), "#4fd1a5", 2)

        elif typ == 4:  # Contract Office (office)
            box(-11, -10, 22, 18, 2, 10 + tier * 2, warm)
            box(-12, -11, 24, 20, 12 + tier * 2, 2, light)
            for k in [-8, -3, 2, 7]:
                line((k, 8, 7), (k + 2, 8, 7), "#64e3d6", 2)
                if tier >= 1:
                    line((k, 8, 11), (k + 2, 8, 11), "#ffe08a", 2)
            if tier >= 2:
                box(-5, -5, 10, 10, 14 + tier * 2, 3, steel)

        elif typ == 5:  # Vehicle Assembly Building (vab)
            vh = 22 + tier * 4
            box(-11, -11, 22, 22, 2, vh, steel)
            box(-12, -12, 24, 24, 2 + vh, 2, light)
            face([(-6, 11, 2), (4, 11, 2), (4, 11, vh - 2), (-6, 11, vh - 2)], "#223342")
            for stripe in range(6, vh - 3, 5):
                line((-5, 11, stripe), (3, 11, stripe), "#4c6a80", 1)
            line((-11, 11, vh - 1), (11, 11, vh - 1), "#f28c28", 2)

        elif typ == 6:  # Tracking Station (tracking)
            box(-10, -9, 20, 18, 2, 6 + tier, dark)
            cx, cy = iso(-4, -3, 12 + tier)
            d.line((cx, cy + 6, cx, cy), fill="#657a82", width=3)
            d.pieslice((cx - 10, cy - 12, cx + 10, cy + 6), 170, 355, fill="#f6f1e3", outline="#6ca1b0")
            d.line((cx, cy - 3, cx + 4, cy - 11), fill="#f28c28", width=2)
            if tier >= 1:
                cx2, cy2 = iso(6, 4, 11 + tier)
                d.line((cx2, cy2 + 5, cx2, cy2), fill="#657a82", width=2)
                d.pieslice((cx2 - 7, cy2 - 8, cx2 + 7, cy2 + 4), 175, 355, fill="#d9e8e4", outline="#63909e")

        elif typ == 7:  # Research Lab (lab)
            box(-12, -10, 22, 20, 2, 9 + tier, light)
            box(-13, -11, 24, 22, 11 + tier, 2, steel)
            cx, cy = iso(-3, -2, 13 + tier)
            d.pieslice((cx - 9, cy - 13, cx + 9, cy + 9), 180, 360, fill="#8ee3dc", outline="#4a8999")
            d.arc((cx - 4, cy - 12, cx + 4, cy + 9), 180, 360, fill="#ffffff")
            for k in [-8, -3, 2]:
                line((k, 10, 7), (k + 3, 10, 7), "#4fa8b8", 2)

        else:  # Solar Foundry (foundry) — bright cobalt solar arrays + warm amber crucible
            box(-11, -10, 20, 18, 2, 7 + tier, dark)
            box(-5, -5, 10, 10, 9 + tier, 5 + tier, ("#ffcf70", "#f28c28", "#b35b14"))
            for sx in [-11, 4]:
                face([(sx, -11, 5 + tier), (sx + 7, -11, 5 + tier), (sx + 7, 10, 8 + tier), (sx, 10, 8 + tier)], "#2466a8")
                for gy in range(-8, 10, 5):
                    line((sx + 1, gy, 6 + tier), (sx + 6, gy, 6 + tier), "#7cc5ff", 1)
            for k in [-7, -2, 3]:
                line((k, 9, 5), (k + 2, 9, 5), "#ffcf70", 2)

        # Level badge pips (1..4 bright gold pips)
        for i in range(tier + 1):
            box(10 - i * 4, 12, 2, 2, 2, 2, ("#ffe082", "#f28c28", "#a85610"))
        if tier >= 2:
            ax, ay = iso(-11, -9, 2)
            d.line((ax, ay, ax, ay - 26 - tier * 2), fill="#c7d4cf")
            d.point((ax, ay - 27 - tier * 2), fill="#ffae42")
        put(idx)


# Frame 44: Road lamp fixture
frame(44)
cx, cy = iso(0, 0)
d.line((cx, cy, cx, cy - 11), fill="#5b7377", width=2)
d.line((cx, cy - 11, cx + 4, cy - 13), fill="#c7d4cf", width=2)
d.line((cx + 4, cy - 13, cx + 6, cy - 13), fill="#ffe082", width=2)
put(44)

# Frame 45: Tier 2 unbuilt/locked construction pad footprint
frame(45)
box(-12, -12, 24, 24, 0, 1, ("#8ea3a8", "#61777d", "#485c63"))
for px, py in [(-11, -11), (9, -11), (-11, 9), (9, 9)]:
    box(px, py, 2, 2, 1, 3, ("#ffcf70", "#d9822b", "#8f4e14"))
line((-9, 0, 1), (9, 0, 1), "#c4d6d9", 1)
line((0, -9, 1), (0, 9, 1), "#c4d6d9", 1)
put(45)

atlas.save(out)
if docs_out.parent.exists():
    atlas.save(docs_out)
print(f"Generated vibrant {out} ({atlas.size[0]}x{atlas.size[1]})")
