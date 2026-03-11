# PWA Icons

This directory contains the app icons for the Progressive Web App.

## Current Status

The icons are currently placeholders. The following PNG files need to be generated from the base `icon.svg`:

- icon-72x72.png
- icon-96x96.png  
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

## Generating Icons

To generate the PNG icons from the SVG:

1. Install sharp: `npm install --save-dev sharp`
2. Create a script to convert SVG to PNG at different sizes
3. Or use online tools like https://realfavicongenerator.net/

## Design Notes

- Base color: #6366f1 (indigo-500)
- Icon: Calendar emoji 📅
- Rounded corners: 80px radius on 512px canvas
- White icon on indigo background

The current SVG serves as a placeholder until proper icons are designed.