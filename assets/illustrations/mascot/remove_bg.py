"""Regenerates transparent/ from raw/. Requires: pip install rembg[cpu]

rembg (bria-rmbg-2.0 model, its default) cuts the character cleanly but on
mascot-cover.png and mascot-search.png it also kept a soft cast-shadow wedge
extending from the right leg toward the tail (bounding roughly y=780-845,
x>865 in the 1024x1024 source) because that shadow is directly connected to
the leg silhouette. mascot-chart.png didn't have this problem. u2net and
isnet-general-use were tried as alternative models -- both worse (jagged
edges / whole-body translucency).

The fix is a feathered fade-out of that region rather than a hard alpha=0
rectangle: an earlier version did a flat cut, which a design QA pass caught
as a visibly straight, unaliased edge (no antialiasing gradient, unlike the
rest of the character's outline). If this script is ever re-run for new
mascot images, check the transparent output against a checkerboard
background for the same kind of stray shadow before trusting it as-is.
"""

from rembg import remove
from PIL import Image
import numpy as np
import os

FILES = ["mascot-cover.png", "mascot-search.png", "mascot-chart.png"]

# (filename, y0, y1, x_cut) -- alpha fades from unchanged to 0 across
# [x_cut-FEATHER, x_cut), then is fully 0 for x >= x_cut. Only
# mascot-cover/search need this; mascot-chart is left alone.
SHADOW_FIXES = [
    ("mascot-cover.png", 780, 845, 865),
    ("mascot-search.png", 780, 845, 865),
]
FEATHER = 10  # px at this 1024x1024 source; ~1-2px at actual render sizes

for name in FILES:
    src = os.path.join("raw", name)
    dst = os.path.join("transparent", name)
    print(f"Processing {name}...")
    with open(src, "rb") as f:
        output_bytes = remove(f.read())
    with open(dst, "wb") as f:
        f.write(output_bytes)

for name, y0, y1, x_cut in SHADOW_FIXES:
    dst = os.path.join("transparent", name)
    arr = np.array(Image.open(dst).convert("RGBA")).astype(np.float32)

    xs = np.arange(x_cut - FEATHER, x_cut)
    t = (xs - (x_cut - FEATHER)) / FEATHER
    falloff = 1.0 - (3 * t**2 - 2 * t**3)  # smoothstep, 1 -> 0

    arr[y0:y1, x_cut:, 3] = 0
    for i, x in enumerate(xs):
        arr[y0:y1, x, 3] *= falloff[i]

    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA").save(dst)
    print(f"Feathered residual shadow on {name}")

print("Done.")
