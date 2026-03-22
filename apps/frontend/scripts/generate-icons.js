/**
 * Icon Generation Script
 * 
 * MANUAL STEP REQUIRED:
 * This script requires the 'sharp' package to convert SVG to PNG.
 * 
 * Installation:
 *   npm install --save-dev sharp
 * 
 * Usage:
 *   node scripts/generate-icons.js
 * 
 * This will generate:
 *   - public/icon-192.png (192x192)
 *   - public/icon-512.png (512x512)
 * 
 * Source: public/icons/icon.svg
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  try {
    // Try to import sharp
    const sharp = require('sharp');
    
    const svgPath = path.join(__dirname, '../public/icons/icon.svg');
    const outputDir = path.join(__dirname, '../public');
    
    if (!fs.existsSync(svgPath)) {
      console.error('❌ Source SVG not found:', svgPath);
      console.log('Expected location: public/icons/icon.svg');
      process.exit(1);
    }
    
    console.log('📦 Generating PNG icons from SVG...');
    
    // Generate 192x192
    await sharp(svgPath)
      .resize(192, 192)
      .png()
      .toFile(path.join(outputDir, 'icon-192.png'));
    console.log('✅ Generated icon-192.png');
    
    // Generate 512x512
    await sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(path.join(outputDir, 'icon-512.png'));
    console.log('✅ Generated icon-512.png');
    
    console.log('✅ All icons generated successfully!');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('❌ sharp package not installed');
      console.log('\nTo generate PNG icons, run:');
      console.log('  npm install --save-dev sharp');
      console.log('  node scripts/generate-icons.js');
      console.log('\nAlternatively, manually create:');
      console.log('  - public/icon-192.png (192x192)');
      console.log('  - public/icon-512.png (512x512)');
      process.exit(1);
    }
    throw error;
  }
}

generateIcons().catch(console.error);
