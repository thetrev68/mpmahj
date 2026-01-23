#!/usr/bin/env python3
"""
Extract text and colors from NMJL Mah Jongg card images and create a markdown document.
"""

import os
import re
from pathlib import Path
from PIL import Image
import pytesseract
import numpy as np

def get_dominant_color(image, box):
    """Get the dominant text color in a bounding box."""
    left, top, width, height = box['left'], box['top'], box['width'], box['height']

    # Crop to the text region with some padding
    region = image.crop((left, top, left + width, top + height))

    # Sample colors from the region
    pixels = list(region.getdata())
    if not pixels:
        return None

    # Filter out white/light backgrounds (RGB > 200)
    text_colors = [p for p in pixels if isinstance(p, tuple) and len(p) >= 3 and not (p[0] > 200 and p[1] > 200 and p[2] > 200)]

    if not text_colors:
        return None

    # Get average color
    avg_r = sum(p[0] for p in text_colors) / len(text_colors)
    avg_g = sum(p[1] for p in text_colors) / len(text_colors)
    avg_b = sum(p[2] for p in text_colors) / len(text_colors)

    # Determine if it's red/maroon or black
    # Red text typically has R > 100 and R > G+B
    if avg_r > 100 and avg_r > (avg_g + avg_b) * 0.8:
        return f"rgb({int(avg_r)}, {int(avg_g)}, {int(avg_b)})"

    return None  # Default to black


def extract_text_with_colors(image_path):
    """Extract text with color information from an image."""
    pil_image = Image.open(image_path)

    # Convert to RGB if necessary
    if pil_image.mode != 'RGB':
        pil_image = pil_image.convert('RGB')

    # Convert to numpy array for pytesseract
    image_array = np.array(pil_image)

    # Get detailed text data from OCR
    data = pytesseract.image_to_data(image_array, output_type=pytesseract.Output.DICT)

    # Group text by lines
    lines = {}
    for i, text in enumerate(data['text']):
        if text.strip():
            line_num = data['line_num'][i]
            if line_num not in lines:
                lines[line_num] = []

            box = {
                'left': data['left'][i],
                'top': data['top'][i],
                'width': data['width'][i],
                'height': data['height'][i]
            }

            color = get_dominant_color(pil_image, box)

            lines[line_num].append({
                'text': text,
                'color': color,
                'left': data['left'][i]
            })

    # Sort lines by vertical position and words by horizontal position
    sorted_lines = []
    for line_num in sorted(lines.keys()):
        words = sorted(lines[line_num], key=lambda x: x['left'])
        sorted_lines.append(words)

    return sorted_lines


def format_line_as_markdown(words):
    """Format a line of words with colors as markdown with HTML."""
    result = []
    for word in words:
        text = word['text']
        color = word['color']

        if color:
            result.append(f'<span style="color: {color};">{text}</span>')
        else:
            result.append(text)

    return ' '.join(result)


def process_images_to_markdown(input_dir, output_file):
    """Process all JPEG images in a directory and create a markdown document."""
    input_path = Path(input_dir)

    # Get all JPEG files sorted by name
    image_files = sorted(input_path.glob('Mahj*.jpeg'))

    if not image_files:
        print(f"No JPEG files found in {input_dir}")
        return

    markdown_lines = []
    markdown_lines.append("# NMJL Mah Jongg 2025 Card\n")
    markdown_lines.append("*Extracted from official card images*\n")
    markdown_lines.append("---\n")

    for img_file in image_files:
        print(f"Processing {img_file.name}...")
        markdown_lines.append(f"\n## {img_file.stem}\n")

        try:
            lines = extract_text_with_colors(str(img_file))

            for line_words in lines:
                if line_words:
                    formatted_line = format_line_as_markdown(line_words)
                    markdown_lines.append(formatted_line + "  ")  # Two spaces for line break

            markdown_lines.append("\n")  # Paragraph break between images

        except Exception as e:
            print(f"Error processing {img_file.name}: {e}")
            markdown_lines.append(f"*Error processing image: {e}*\n")

    # Write to output file
    output_path = Path(output_file)
    output_path.write_text('\n'.join(markdown_lines))
    print(f"\nMarkdown document created: {output_file}")


if __name__ == "__main__":
    input_directory = "tmp"
    output_markdown = "nmjl_card_2025.md"

    process_images_to_markdown(input_directory, output_markdown)
