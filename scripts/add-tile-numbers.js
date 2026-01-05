#!/usr/bin/env node
/**
 * Add corner numbers to Mahjong SVG tiles and normalize Joker size.
 *
 * This script modifies the Mahjong_*.svg tiles to add red numbers
 * in the top-left corner, and resizes the Joker tile to match.
 *
 * Usage: node scripts/add-tile-numbers.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, '../apps/client/public/assets');
const OUTPUT_DIR = path.join(__dirname, '../apps/client/public/assets/tiles');

// Target dimensions from Mahjong_1m.svg
const TARGET_WIDTH = 44.85;
const TARGET_HEIGHT = 59.772;

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Tile mappings: filename -> corner number
const tileNumbers = {
  // Craks (Mans)
  'Mahjong_1m.svg': '1',
  'Mahjong_2m.svg': '2',
  'Mahjong_3m.svg': '3',
  'Mahjong_4m.svg': '4',
  'Mahjong_5m.svg': '5',
  'Mahjong_6m.svg': '6',
  'Mahjong_7m.svg': '7',
  'Mahjong_8m.svg': '8',
  'Mahjong_9m.svg': '9',

  // Winds
  'Mahjong_E.svg': 'E',
  'Mahjong_S.svg': 'S',
  'Mahjong_W.svg': 'W',
  'Mahjong_N.svg': 'N',
};

/**
 * Add a text element to SVG with number in top-left corner
 */
function addNumberToSVG(svgContent, number) {
  const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
  const [, , , width] = viewBoxMatch
    ? viewBoxMatch[1].split(' ').map(parseFloat)
    : [0, 0, TARGET_WIDTH, TARGET_HEIGHT];

  const x = width * 0.05;
  const y = width * 0.22;
  const fontSize = width * 0.2;

  const textElement = `
  <!-- Corner number added by script -->
  <text
    x="${x}"
    y="${y}"
    font-family="Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="bold"
    fill="#dc2626"
    stroke="none"
  >${number}</text>`;

  return svgContent.replace('</svg>', `${textElement}\n</svg>`);
}

/**
 * Resizes the Joker SVG to match target dimensions
 */
function resizeJoker(svgContent) {
  // Extract original width/height/viewBox if any
  const widthMatch = svgContent.match(/width="([^"]+)"/);
  const heightMatch = svgContent.match(/height="([^"]+)"/);

  const origWidth = widthMatch ? parseFloat(widthMatch[1]) : 74.7;
  const origHeight = heightMatch ? parseFloat(heightMatch[1]) : 95.1;

  // Calculate scales
  const scaleX = TARGET_WIDTH / origWidth;
  const scaleY = TARGET_HEIGHT / origHeight;
  const scale = Math.min(scaleX, scaleY); // Uniform scaling

  // Center it
  const scaledWidth = origWidth * scale;
  const scaledHeight = origHeight * scale;
  const dx = (TARGET_WIDTH - scaledWidth) / 2;
  const dy = (TARGET_HEIGHT - scaledHeight) / 2;

  // Find where the SVG content actually starts (after <svg ...>)
  const svgStart = svgContent.indexOf('<svg');
  if (svgStart === -1) return svgContent;

  const tagEnd = svgContent.indexOf('>', svgStart);
  if (tagEnd === -1) return svgContent;

  const svgEnd = svgContent.lastIndexOf('</svg>');
  if (svgEnd === -1) return svgContent;

  // Extract JUST the inner content
  let innerContent = svgContent.substring(tagEnd + 1, svgEnd);

  // Clean up any potential nested XML headers or comments that might cause issues,
  // though typically they are outside the SVG block.
  // The main issue in the previous attempt was likely not stripping the outer tags correctly.

  const newSvgOpenTag = `<svg xmlns="http://www.w3.org/2000/svg" width="${TARGET_WIDTH}pt" height="${TARGET_HEIGHT}pt" viewBox="0 0 ${TARGET_WIDTH} ${TARGET_HEIGHT}">`;

  const wrappedContent = `
  <g transform="translate(${dx}, ${dy}) scale(${scale})">
    ${innerContent}
  </g>`;

  return `${newSvgOpenTag}${wrappedContent}\n</svg>`;
}

/**
 * Process a single tile file
 */
function processTile(filename) {
  const inputPath = path.join(__dirname, '../apps/client/public/assets', filename);
  const outputPath = path.join(__dirname, '../apps/client/public/assets/tiles', filename);
  const number = tileNumbers[filename];

  try {
    let content = fs.readFileSync(inputPath, 'utf-8');

    if (number) {
      content = addNumberToSVG(content, number);
    } else if (filename === 'U+1F02A_MJjoker.svg') {
      console.log(`📏 Resizing Joker: ${filename}`);
      content = resizeJoker(content);
    }

    fs.writeFileSync(outputPath, content, 'utf-8');
    if (number) console.log(`✅ Processed ${filename} -> ${number}`);
  } catch (error) {
    console.error(`❌ Error processing ${filename}:`, error.message);
  }
}

// Main execution
console.log('🀄 Processing Mahjong tiles...\n');

if (fs.existsSync(ASSETS_DIR)) {
  const files = fs.readdirSync(ASSETS_DIR);
  const svgFiles = files.filter((f) => f.endsWith('.svg'));

  svgFiles.forEach((filename) => {
    processTile(filename);
  });

  console.log(`\n✨ Done! Tiles saved to: ${OUTPUT_DIR}`);
} else {
  console.error(`❌ Assets directory not found: ${ASSETS_DIR}`);
}
