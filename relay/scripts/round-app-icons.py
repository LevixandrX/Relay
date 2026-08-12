"""Relay icons: rounded tile with true alpha (clean corners, no blue/black fill)."""
from __future__ import annotations

import math
import struct
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(r"G:\Notion 2\relay\desktop")
ICONS = ROOT / "src-tauri" / "icons"
WEB_PUBLIC = Path(r"G:\Notion 2\relay\public")

BLUE = (29, 78, 216, 255)
WHITE = (255, 255, 255, 255)
RADIUS_RATIO = 0.22
SS = 8  # supersample factor


def _draw_glyph(draw: ImageDraw.ImageDraw, s: int) -> None:
    node = int(s * 0.22)
    node_r = max(2, int(node * 0.28))
    bl = (int(s * 0.32 - node / 2), int(s * 0.62 - node / 2))
    tr = (int(s * 0.68 - node / 2), int(s * 0.38 - node / 2))
    c1 = (bl[0] + node / 2, bl[1] + node / 2)
    c2 = (tr[0] + node / 2, tr[1] + node / 2)
    thickness = int(s * 0.11)
    dx, dy = c2[0] - c1[0], c2[1] - c1[1]
    length = math.hypot(dx, dy) or 1.0
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    half = thickness / 2
    inset = node * 0.15
    a = (c1[0] + ux * inset, c1[1] + uy * inset)
    b = (c2[0] - ux * inset, c2[1] - uy * inset)
    draw.polygon(
        [
            (a[0] + px * half, a[1] + py * half),
            (b[0] + px * half, b[1] + py * half),
            (b[0] - px * half, b[1] - py * half),
            (a[0] - px * half, a[1] - py * half),
        ],
        fill=WHITE,
    )
    draw.rounded_rectangle((bl[0], bl[1], bl[0] + node, bl[1] + node), radius=node_r, fill=WHITE)
    draw.rounded_rectangle((tr[0], tr[1], tr[0] + node, tr[1] + node), radius=node_r, fill=WHITE)


def draw_mark(size: int) -> Image.Image:
    s = size * SS
    # Opaque content (blue + glyph)
    content = Image.new("RGBA", (s, s), BLUE)
    _draw_glyph(ImageDraw.Draw(content), s)

    # Soft alpha mask for rounded square
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, s - 1, s - 1),
        radius=int(s * RADIUS_RATIO),
        fill=255,
    )
    # Slight blur before downscale = smoother curve
    mask = mask.filter(ImageFilter.GaussianBlur(radius=SS * 0.35))

    content = content.resize((size, size), Image.Resampling.LANCZOS)
    mask = mask.resize((size, size), Image.Resampling.LANCZOS)
    content.putalpha(mask)

    # Under alpha=0 keep brand blue RGB — avoids black Desktop fringes on Windows
    px = content.load()
    br, bg, bb = BLUE[:3]
    for y in range(size):
        for x in range(size):
            r, g, b, a = px[x, y]
            if a == 0:
                px[x, y] = (br, bg, bb, 0)
            elif a < 255:
                t = a / 255.0
                px[x, y] = (
                    int(br * (1 - t) + r * t),
                    int(bg * (1 - t) + g * t),
                    int(bb * (1 - t) + b * t),
                    a,
                )
    return content


def png_bytes(im: Image.Image) -> bytes:
    buf = BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def write_ico(path: Path, images: list[Image.Image]) -> None:
    frames = [png_bytes(im) for im in images]
    count = len(frames)
    offset = 6 + 16 * count
    header = bytearray(struct.pack("<HHH", 0, 1, count))
    blob = bytearray()
    for im, data in zip(images, frames):
        w, h = im.size
        wb = 0 if w >= 256 else w
        hb = 0 if h >= 256 else h
        header += struct.pack("<BBBBHHII", wb, hb, 0, 0, 1, 32, len(data), offset + len(blob))
        blob += data
    path.write_bytes(bytes(header) + bytes(blob))


def main() -> None:
    named = {
        "icon.png": 512,
        "icon-512.png": 512,
        "icon-256.png": 256,
        "icon-128.png": 128,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "icon-32.png": 32,
        "32x32.png": 32,
    }
    for name, size in named.items():
        draw_mark(size).save(ICONS / name)

    draw_mark(128).save(ROOT / "public" / "icon.png")
    if WEB_PUBLIC.exists():
        draw_mark(256).save(WEB_PUBLIC / "icon.png")

    ico_sizes = [256, 128, 64, 48, 32, 24, 16]
    frames = [draw_mark(s) for s in ico_sizes]
    write_ico(ICONS / "icon.ico", frames)

    c = frames[0].getpixel((0, 0))
    assert c[3] == 0 and c[:3] == BLUE[:3], c
    print("ok", ICONS / "icon.ico")


if __name__ == "__main__":
    main()
