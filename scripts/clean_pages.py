# import cv2
import numpy as np
import os

def process_image(image_path, output_path):
    # 1. Load the image in grayscale
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    
    if img is None:
        print(f"Error reading {image_path}")
        return

    # --- STEP 1: DESKEW (Straighten) ---
    # Invert image (white text on black background) for contour detection
    inverted = cv2.bitwise_not(img)
    coords = np.column_stack(np.where(inverted > 0))
    
    # Get the rotation angle
    rect = cv2.minAreaRect(coords)
    angle = rect[-1]
    
    # Correct the angle
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    # --- SANITY CHECK ---
    # Scanned docs are rarely skewed > 10 degrees. 
    # If it detects > 10, it's likely catching a vertical line or border.
    if abs(angle) > 10:
        print(f"  -> Skipping rotation (detected {angle:.2f} deg seems excessive)")
    else:
        (h, w) = img.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        img = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        print(f"  -> Straightened by {angle:.2f} degrees")

    # --- STEP 2: BINARIZATION (Black & White) ---
    # Adaptive thresholding handles shadows and uneven lighting
    processed = cv2.adaptiveThreshold(
        img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 15
    )
    
    # --- STEP 3: NOISE REDUCTION ---
    # Remove small specs (salt and pepper noise)
    kernel = np.ones((1, 1), np.uint8)
    processed = cv2.dilate(processed, kernel, iterations=1)
    processed = cv2.erode(processed, kernel, iterations=1)

    # --- STEP 4: SAVE ---
    cv2.imwrite(output_path, processed)
    print(f"  -> Saved to {output_path}")

# --- MAIN EXECUTION ---
input_folder = "extracted_images"   # From your Step 1
output_folder = "cleaned_images"     # Final input for OCR

os.makedirs(output_folder, exist_ok=True)

image_files = [f for f in os.listdir(input_folder) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
image_files.sort()

for filename in image_files:
    print(f"Cleaning {filename}...")
    process_image(
        os.path.join(input_folder, filename),
        os.path.join(output_folder, filename)
    )

print(f"\nDone! Cleaned images are in '{output_folder}'.")
print(f"Next, run OCR on the clean folder:")
print(f"python scripts/convert_pdf.py ocr cleaned_images final_rules.txt")
