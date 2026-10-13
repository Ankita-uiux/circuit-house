"""Prepare consistent 800px product packshots (requires Pillow).

Run from the repository root. Originals live in ignored tmp/catalog-originals.
Use --download to retrieve the source URLs recorded in catalog-image-sources.json.
This is an asset preparation tool; it is not needed during a Render build.
"""
import argparse
import json
from pathlib import Path
from urllib.request import urlopen

from PIL import Image, ImageChops, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ORIGINALS = ROOT / "tmp/catalog-originals"
OUTPUT = ROOT / "artifacts/circuit-house/public/catalog"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    products = json.loads((ROOT / "scripts/catalog-image-sources.json").read_text(encoding="utf-8"))
    ORIGINALS.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for product in products:
        original = ORIGINALS / product["id"]
        if args.download:
            with urlopen(product["url"], timeout=30) as response:
                original.write_bytes(response.read())
        with Image.open(original) as source:
            rgba = ImageOps.exif_transpose(source).convert("RGBA")
            image = Image.new("RGBA", rgba.size, "white")
            image.alpha_composite(rgba)
            image = image.convert("RGB")
        # Trim only near-white outer space, preserving the entire product.
        difference = ImageChops.difference(image, Image.new("RGB", image.size, "white"))
        mask = difference.convert("L").point(lambda value: 255 if value > 12 else 0)
        bounds = mask.getbbox()
        if bounds:
            image = image.crop(bounds)
        image = ImageOps.contain(image, (640, 640), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (800, 800), "white")
        canvas.paste(image, ((800 - image.width) // 2, (800 - image.height) // 2))
        canvas.save(OUTPUT / (product["id"] + ".webp"), "WEBP", quality=90, method=6)
    print(f"Prepared {len(products)} square catalog images.")


if __name__ == "__main__":
    main()
