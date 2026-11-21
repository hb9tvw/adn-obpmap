#!/usr/bin/env python3
"""adn-obpmap - creates the app icons (192 and 512 px) from your logo and server number.
Usage: python3 make_icons.py <logo.png> <server id> <output dir>
Needs python3-pil (apt install python3-pil fonts-dejavu-core)."""
import sys
from PIL import Image, ImageDraw, ImageFont

logo, text, out = sys.argv[1], sys.argv[2], sys.argv[3]
src = None
try:
    src = Image.open(logo).convert('RGBA')
except Exception:
    pass
for size in (192, 512):
    im = Image.new('RGBA', (size, size), (8, 17, 31, 255))
    if src:
        w = int(size * 0.92); h = int(src.height * w / src.width)
        lg = src.resize((w, h), Image.LANCZOS)
        im.paste(lg, ((size - w) // 2, int(size * 0.35) - h // 2), lg)
    try:
        f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', int(size * (0.24 if src else 0.30)))
    except Exception:
        f = ImageFont.load_default()
    dr = ImageDraw.Draw(im)
    bb = dr.textbbox((0, 0), text, font=f)
    y = int(size * 0.62) if src else (size - (bb[3] - bb[1])) // 2
    dr.text(((size - (bb[2] - bb[0])) // 2, y), text, font=f, fill=(45, 212, 191, 255))
    im.convert('RGB').save('%s/icon-%d.png' % (out, size))
print('icons written to', out)
