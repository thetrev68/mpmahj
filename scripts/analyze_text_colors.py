#!/usr/bin/env python3
"""
Analyze text colors in the Mah Jongg card images.
"""

from PIL import Image
import numpy as np
from collections import Counter

def analyze_image_colors(image_path):
    """Analyze and identify distinct text colors in the image."""
    img = Image.open(image_path)
    img_array = np.array(img)

    # Get all pixels
    pixels = img_array.reshape(-1, 3)

    # Filter out light background colors (RGB > 200 on all channels)
    dark_pixels = pixels[(pixels[:, 0] < 200) | (pixels[:, 1] < 200) | (pixels[:, 2] < 200)]

    # Group similar colors (within 30 points)
    color_groups = {}
    for pixel in dark_pixels:
        r, g, b = pixel
        # Skip very light pixels
        if r > 200 and g > 200 and b > 200:
            continue

        # Find if this belongs to an existing group
        found = False
        for key in color_groups:
            kr, kg, kb = key
            if abs(r - kr) < 30 and abs(g - kg) < 30 and abs(b - kb) < 30:
                color_groups[key] += 1
                found = True
                break

        if not found:
            color_groups[tuple(pixel)] = 1

    # Sort by frequency
    sorted_colors = sorted(color_groups.items(), key=lambda x: x[1], reverse=True)

    print(f"\nAnalyzing {image_path}")
    print("Top 10 distinct dark colors found:")
    for i, (color, count) in enumerate(sorted_colors[:10]):
        r, g, b = color
        # Classify the color
        color_name = classify_color(r, g, b)
        print(f"{i+1}. RGB({r:3d}, {g:3d}, {b:3d}) - {color_name:15s} Count: {count:6d}")

def classify_color(r, g, b):
    """Classify a color as red, green, blue, or black."""
    # Pure black or very dark
    if r < 50 and g < 50 and b < 50:
        return "Black/Navy"

    # Reddish
    if r > g + 30 and r > b + 30:
        if r > 120:
            return "Red/Maroon"
        else:
            return "Dark Red"

    # Greenish
    if g > r + 20 and g > b + 20:
        return "Green"

    # Blueish
    if b > r + 20 and b > g + 20:
        return "Blue/Navy"

    # Brownish (similar RGB values, slightly more red)
    if abs(r - g) < 30 and abs(r - b) < 30:
        if r > 80:
            return "Brown/Gray"
        else:
            return "Dark Gray/Navy"

    return "Other"

if __name__ == "__main__":
    for i in range(2, 7):  # Mahj2 through Mahj6 have the patterns
        analyze_image_colors(f"tmp/Mahj{i}.jpeg")
