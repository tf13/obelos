# Quick Installation Guide

## Install in Firefox (2 minutes)

### Method 1: Temporary Installation (Development)

1. Open Firefox
2. Type `about:debugging` in the address bar and press Enter
3. Click **"This Firefox"** on the left
4. Click **"Load Temporary Add-on..."**
5. Browse to the `obelos` folder
6. Select `manifest.json`
7. Done! The extension is now active

**Note**: Temporary extensions are removed when Firefox closes.

### Method 2: Permanent Installation

#### Option A: Developer Mode
1. Go to `about:config`
2. Search for `xpinstall.signatures.required`
3. Double-click to set it to `false`
4. Create a ZIP file of the extension folder
5. Rename it to `obelos.xpi`
6. Drag and drop the XPI into Firefox
7. Click "Add" to install

#### Option B: Sign with Mozilla (Recommended for distribution)
1. Create an account at https://addons.mozilla.org/developers/
2. Click "Submit a New Add-on"
3. Choose "On this site"
4. ZIP the extension folder (include all files)
5. Upload the ZIP
6. Wait for automatic validation
7. Get your signed XPI
8. Install the signed XPI in Firefox

## First Use

After installation:

1. Look for the highlighter icon in your Firefox toolbar
2. Visit any webpage
3. Select some text - a toolbar will appear
4. Choose a color and click "✓ Highlight"
5. Your highlight is saved automatically!

## Test It

Try these actions:
- ✅ Select text and highlight it
- ✅ Click a highlight to see the menu (press 1/2/3 for actions)
- ✅ Press 1 to copy link and paste it in a new tab
- ✅ Click the extension icon to toggle visibility
- ✅ Reload the page - highlights persist!
- ✅ Hover over annotated highlights to see tooltips

## Need Help?

See the full README.md for detailed usage instructions and troubleshooting.
