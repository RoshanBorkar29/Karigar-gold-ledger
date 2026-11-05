"""Generate synthetic scale and karat meter sample images with ground truth labels.

Generates 15 test images into samples/images/ and labels into samples/labels.json.
Images test:
- 4 clear scale readings
- 2 glare or dim conditions
- 2 tilted or blurry conditions
- 1 hard decimal point
- 1 partly covered
- 1 wrong unit (ct)
- 1 unreadable / heavily obscured
- 3 karat-meter printouts (91.60%, 75.00%, 99.90%)
"""

import json
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont


def get_font(size: int, mono: bool = True) -> ImageFont.ImageFont:
    """Attempt to load a clean system font or fallback to default."""
    font_candidates = [
        "C:/Windows/Fonts/consola.ttf",
        "C:/Windows/Fonts/lucon.ttf",
        "C:/Windows/Fonts/cour.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for path in font_candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def render_scale_display(
    value_text: str,
    unit_text: str = "g",
    width: int = 500,
    height: int = 240,
    dim: bool = False,
    hard_decimal: bool = False,
) -> Image.Image:
    """Create an authentic digital scale LCD panel display."""
    # Background: dark LCD green-black
    bg_color = (15, 25, 20) if not dim else (10, 15, 12)
    img = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(img)

    # Scale outer bezel
    bezel_color = (60, 65, 60) if not dim else (35, 38, 35)
    draw.rectangle([0, 0, width - 1, height - 1], outline=bezel_color, width=8)

    # Subtitle header
    header_font = get_font(16)
    draw.text((25, 18), "PRECISION ELECTRONIC BALANCE  Max: 500g  d=0.001g", fill=(70, 120, 80), font=header_font)

    # Digital weight digits (Fluorescent LCD green)
    text_color = (60, 240, 90) if not dim else (25, 80, 35)
    digit_font = get_font(72)
    unit_font = get_font(36)

    if hard_decimal and "." in value_text:
        whole, frac = value_text.split(".", 1)
        draw.text((60, 80), whole, fill=text_color, font=digit_font)
        # Faint / tiny decimal point
        draw.text((220, 105), ".", fill=(30, 70, 40), font=get_font(30))
        draw.text((245, 80), frac, fill=text_color, font=digit_font)
    else:
        draw.text((60, 80), value_text, fill=text_color, font=digit_font)

    draw.text((390, 115), unit_text, fill=text_color, font=unit_font)

    # Status indicators
    draw.text((30, 190), "STABLE [●]    TARE [0]", fill=(60, 140, 80) if not dim else (20, 50, 30), font=header_font)
    return img


def render_karatmeter_printout(
    purity_text: str,
    width: int = 420,
    height: int = 340,
) -> Image.Image:
    """Create a realistic thermal XRF karatmeter assay printout."""
    # Thermal receipt paper: pale off-white
    img = Image.new("RGB", (width, height), (245, 244, 238))
    draw = ImageDraw.Draw(img)

    # Receipt border perforation line
    draw.line([(15, 20), (width - 15, 20)], fill=(180, 180, 180), width=1)
    draw.line([(15, height - 20), (width - 15, height - 20)], fill=(180, 180, 180), width=1)

    title_font = get_font(20)
    body_font = get_font(16)
    highlight_font = get_font(32)

    ink_color = (20, 20, 25)
    draw.text((50, 35), "PRECISION XRF GOLD ANALYZER", fill=ink_color, font=title_font)
    draw.text((50, 65), "Coimbatore Assay Lab - Station #04", fill=(80, 80, 85), font=get_font(14))
    draw.line([(50, 90), (width - 50, 90)], fill=(120, 120, 120), width=1)

    draw.text((50, 105), "Sample ID:    AS-2026-X99", fill=ink_color, font=body_font)
    draw.text((50, 130), "Test Method:  Energy Dispersive XRF", fill=ink_color, font=body_font)
    draw.text((50, 155), "Element:      Au (Gold)", fill=ink_color, font=body_font)

    draw.line([(50, 185), (width - 50, 185)], fill=(120, 120, 120), width=1)

    draw.text((50, 200), "GOLD PURITY:", fill=ink_color, font=title_font)
    draw.text((210, 192), f"{purity_text} %", fill=(10, 40, 140), font=highlight_font)

    draw.text((50, 250), "Status: VERIFIED & SEALED", fill=(20, 120, 40), font=body_font)
    draw.text((50, 275), "Calibrated against NIST Gold Std.", fill=(100, 100, 105), font=get_font(12))

    return img


def add_glare(img: Image.Image) -> Image.Image:
    """Simulate bright camera flash glare across screen."""
    glare = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glare)
    # Diagonal bright white sheen
    draw.polygon([(100, 0), (320, 0), (220, img.height), (0, img.height)], fill=(255, 255, 255, 140))
    img = img.convert("RGBA")
    combined = Image.alpha_composite(img, glare).convert("RGB")
    return combined


def add_partly_covered(img: Image.Image) -> Image.Image:
    """Simulate an object or finger partly covering scale digits."""
    draw = ImageDraw.Draw(img)
    # Opaque dark sticker covering rightmost fraction digits
    draw.rectangle([280, 70, 420, 170], fill=(70, 65, 60))
    draw.text((290, 100), "[COVERED]", fill=(180, 180, 180), font=get_font(18))
    return img


def make_unreadable(img: Image.Image) -> Image.Image:
    """Simulate extreme noise and corrupted screen."""
    draw = ImageDraw.Draw(img)
    rng = random.Random(42)
    for _ in range(5000):
        x = rng.randint(0, img.width - 1)
        y = rng.randint(0, img.height - 1)
        draw.point((x, y), fill=(rng.randint(0, 255), rng.randint(0, 255), rng.randint(0, 255)))
    draw.rectangle([50, 70, 450, 170], fill=(10, 10, 10))
    draw.text((120, 100), "ERROR 888.888", fill=(180, 30, 30), font=get_font(40))
    return img


def main():
    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "samples", "images")
    labels_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "samples", "labels.json")
    os.makedirs(out_dir, exist_ok=True)

    items = []

    # 1-4. Clear scales
    clear_specs = [
        ("scale_clear_1.jpg", "112.450", "g"),
        ("scale_clear_2.jpg", "103.004", "g"),
        ("scale_clear_3.jpg", "3.023", "g"),
        ("scale_clear_4.jpg", "50.000", "g"),
    ]
    for filename, val, unit in clear_specs:
        im = render_scale_display(val, unit)
        im.save(os.path.join(out_dir, filename), quality=95)
        items.append({
            "image": filename,
            "kind": "scale",
            "true_value": val,
            "unit": unit,
            "expect": "ok",
        })

    # 5. Glare scale
    im = render_scale_display("112.450", "g")
    im = add_glare(im)
    im.save(os.path.join(out_dir, "scale_glare.jpg"), quality=90)
    items.append({
        "image": "scale_glare.jpg",
        "kind": "scale",
        "true_value": "112.450",
        "unit": "g",
        "expect": "ok",
    })

    # 6. Dim scale
    im = render_scale_display("25.500", "g", dim=True)
    im.save(os.path.join(out_dir, "scale_dim.jpg"), quality=85)
    items.append({
        "image": "scale_dim.jpg",
        "kind": "scale",
        "true_value": "25.500",
        "unit": "g",
        "expect": "ok",
    })

    # 7. Tilted scale
    im = render_scale_display("15.750", "g")
    im = im.rotate(12, resample=Image.BICUBIC, expand=True, fillcolor=(30, 30, 30))
    im.save(os.path.join(out_dir, "scale_tilted.jpg"), quality=90)
    items.append({
        "image": "scale_tilted.jpg",
        "kind": "scale",
        "true_value": "15.750",
        "unit": "g",
        "expect": "ok",
    })

    # 8. Blurry scale
    im = render_scale_display("42.120", "g")
    im = im.filter(ImageFilter.GaussianBlur(radius=2.5))
    im.save(os.path.join(out_dir, "scale_blurry.jpg"), quality=85)
    items.append({
        "image": "scale_blurry.jpg",
        "kind": "scale",
        "true_value": "42.120",
        "unit": "g",
        "expect": "ok",
    })

    # 9. Hard decimal point
    im = render_scale_display("10.005", "g", hard_decimal=True)
    im.save(os.path.join(out_dir, "scale_hard_decimal.jpg"), quality=90)
    items.append({
        "image": "scale_hard_decimal.jpg",
        "kind": "scale",
        "true_value": "10.005",
        "unit": "g",
        "expect": "ok",
    })

    # 10. Partly covered
    im = render_scale_display("112.450", "g")
    im = add_partly_covered(im)
    im.save(os.path.join(out_dir, "scale_partly_covered.jpg"), quality=90)
    items.append({
        "image": "scale_partly_covered.jpg",
        "kind": "scale",
        "true_value": "112.450",
        "unit": "g",
        "expect": "unreadable",
    })

    # 11. Wrong unit (ct)
    im = render_scale_display("112.450", "ct")
    im.save(os.path.join(out_dir, "scale_wrong_unit.jpg"), quality=95)
    items.append({
        "image": "scale_wrong_unit.jpg",
        "kind": "scale",
        "true_value": "112.450",
        "unit": "ct",
        "expect": "wrong_unit",
    })

    # 12. Unreadable / broken display
    im = render_scale_display("888.888", "g")
    im = make_unreadable(im)
    im.save(os.path.join(out_dir, "scale_unreadable.jpg"), quality=80)
    items.append({
        "image": "scale_unreadable.jpg",
        "kind": "scale",
        "true_value": None,
        "unit": None,
        "expect": "unreadable",
    })

    # 13-15. Karatmeter printouts
    karat_specs = [
        ("karat_9160.jpg", "91.60"),
        ("karat_7500.jpg", "75.00"),
        ("karat_9990.jpg", "99.90"),
    ]
    for filename, purity in karat_specs:
        im = render_karatmeter_printout(purity)
        im.save(os.path.join(out_dir, filename), quality=95)
        items.append({
            "image": filename,
            "kind": "karat",
            "true_value": purity,
            "unit": "%",
            "expect": "ok",
        })

    with open(labels_file, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2)

    print(f"Successfully generated {len(items)} synthetic sample images into {out_dir}")
    print(f"Saved ground truth metadata to {labels_file}")


if __name__ == "__main__":
    main()
