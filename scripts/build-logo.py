"""Builds transparent logo / mark / app icons from the source logo (cream background)."""
import os, sys
import numpy as np
from PIL import Image

src = sys.argv[1]
im = np.asarray(Image.open(src).convert("RGB")).astype(float)
bg = np.array([249, 245, 240.0])
green = np.array([28, 68, 48.0])      # #1C4430
terra = np.array([202, 130, 111.0])   # #CA826F
d_bg = np.linalg.norm(im - bg, axis=2)
use_t = np.linalg.norm(im - terra, axis=2) < np.linalg.norm(im - green, axis=2)
fg = np.where(use_t[..., None], terra, green)
alpha = np.clip(d_bg / np.linalg.norm(fg - bg, axis=2), 0, 1)
alpha[alpha < 0.06] = 0
full = Image.fromarray(np.dstack([fg, alpha * 255]).astype(np.uint8), "RGBA")

cols = np.where((alpha > 0.2).any(axis=0))[0]
gap = next(a for a, b in zip(cols[:-1], cols[1:]) if b - a > 25)
logo = full.crop(full.getbbox())
mark = full.crop((0, 0, gap + 1, full.height))
mark = mark.crop(mark.getbbox())

def resize_h(img, h):
    return img.resize((round(img.width * h / img.height), h), Image.LANCZOS)

os.makedirs("public/brand", exist_ok=True)
resize_h(logo, 160).save("public/brand/logo.png", optimize=True)
white = np.asarray(resize_h(logo, 160)).copy()
is_green = white[..., 1] < 100  # terracotta diamonds keep their colour
white[is_green, :3] = 255
Image.fromarray(white, "RGBA").save("public/brand/logo-white.png", optimize=True)
resize_h(mark, 256).save("public/brand/mark.png", optimize=True)

def icon(size, pad=0.16, bgc=(249, 245, 240, 255)):
    c = Image.new("RGBA", (size, size), bgc)
    m = mark.copy()
    inner = int(size * (1 - 2 * pad))
    m.thumbnail((inner, inner), Image.LANCZOS)
    c.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return c

icon(512).save("public/brand/icon-512.png", optimize=True)
icon(192).save("public/brand/icon-192.png", optimize=True)
icon(180).convert("RGB").save("src/app/apple-icon.png", optimize=True)
icon(64, pad=0.06, bgc=(0, 0, 0, 0)).save("src/app/icon.png", optimize=True)
print("logo", logo.size, "mark", mark.size)
