from pathlib import Path

from PIL import Image


PROJECT = Path("/home/ubuntu/studymatrix-attendance")
SOURCE = Path("/home/ubuntu/webdev-static-assets/studymatrix-attendance-icon.png")
TARGETS = {
    "assets/images/icon.png": 512,
    "assets/images/splash-icon.png": 512,
    "assets/images/android-icon-foreground.png": 512,
    "assets/images/favicon.png": 192,
}


def main() -> None:
    with Image.open(SOURCE) as original:
        source = original.convert("RGBA")
        for relative_path, dimension in TARGETS.items():
            resized = source.resize((dimension, dimension), Image.Resampling.LANCZOS)
            compressed = resized.convert("P", palette=Image.Palette.ADAPTIVE, colors=256)
            compressed.save(PROJECT / relative_path, format="PNG", optimize=True, compress_level=9)


if __name__ == "__main__":
    main()
