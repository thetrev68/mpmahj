import sys
import os
import glob
from pdf2image import convert_from_path
import pytesseract
from PIL import Image

# Increase the limit to handle high-resolution scans (approx 250MP)
Image.MAX_IMAGE_PIXELS = 250_000_000 

try:
    from natsort import natsorted
except ImportError:
    natsorted = sorted

def extract_images(input_path, output_dir):
    """Step 1: Convert PDFs to Images"""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Find PDFs
    if os.path.isdir(input_path):
        pdf_files = [os.path.join(input_path, f) for f in os.listdir(input_path) if f.lower().endswith('.pdf')]
        pdf_files = natsorted(pdf_files)
    elif os.path.isfile(input_path):
        pdf_files = [input_path]
    else:
        print(f"Error: '{input_path}' not found.")
        return

    if not pdf_files:
        print("No PDF files found.")
        return

    print(f"--- STEP 1: EXTRACT ---")
    print(f"Found {len(pdf_files)} PDF(s). Saving images to '{output_dir}'...")

    count = 0
    for i, pdf_file in enumerate(pdf_files):
        print(f"Processing '{os.path.basename(pdf_file)}'...")
        try:
            # Set DPI to 300 for a good balance of quality and file size
            images = convert_from_path(pdf_file, dpi=300)
            base_name = os.path.splitext(os.path.basename(pdf_file))[0]
            
            for j, image in enumerate(images):
                # Save as high-quality JPEG
                image_name = f"{base_name}_p{j+1:02d}.jpg"
                save_path = os.path.join(output_dir, image_name)
                image.save(save_path, "JPEG", quality=95)
                count += 1
        except Exception as e:
            print(f"Error converting {pdf_file}: {e}")

    print(f"\nDone! Extracted {count} images.")
    print(f"You can now edit these images in: {os.path.abspath(output_dir)}")
    print(f"When ready, run: python scripts/convert_pdf.py ocr {output_dir}")


def ocr_images(input_dir, output_file):
    """Step 2: OCR Images to Text"""
    if not os.path.isdir(input_dir):
        print(f"Error: Directory '{input_dir}' not found.")
        return

    # Find Images (jpg, png, jpeg)
    extensions = ['*.jpg', '*.jpeg', '*.png']
    image_files = []
    for ext in extensions:
        image_files.extend(glob.glob(os.path.join(input_dir, ext)))
    
    image_files = natsorted(image_files)

    if not image_files:
        print(f"No images found in '{input_dir}'.")
        return

    print(f"--- STEP 2: OCR ---")
    print(f"Found {len(image_files)} images. OCRing to '{output_file}'...")

    full_text = []
    for i, img_path in enumerate(image_files):
        print(f"[{i+1}/{len(image_files)}] OCR '{os.path.basename(img_path)}'...")
        try:
            text = pytesseract.image_to_string(img_path)
            full_text.append(f"--- SOURCE: {os.path.basename(img_path)} ---\n")
            full_text.append(text)
            full_text.append("\n\n")
        except Exception as e:
            print(f"Error processing {img_path}: {e}")

    with open(output_file, "w", encoding="utf-8") as f:
        f.writelines(full_text)

    print(f"\nSuccess! Full text saved to: {os.path.abspath(output_file)}")


def main():
    if len(sys.argv) < 3:
        print("Usage:")
        print("  Step 1: python scripts/convert_pdf.py extract [input_pdf_folder] [output_image_folder]")
        print("  Step 2: python scripts/convert_pdf.py ocr     [input_image_folder] [output_text_file]")
        return

    mode = sys.argv[1].lower()
    input_path = sys.argv[2]
    
    # Default output args if not provided
    if mode == 'extract':
        output_path = sys.argv[3] if len(sys.argv) > 3 else "extracted_images"
        extract_images(input_path, output_path)
    elif mode == 'ocr':
        output_path = sys.argv[3] if len(sys.argv) > 3 else "final_rules.txt"
        ocr_images(input_path, output_path)
    else:
        print(f"Unknown mode '{mode}'. Use 'extract' or 'ocr'.")

if __name__ == "__main__":
    main()
