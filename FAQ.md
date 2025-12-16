# FAQ & Troubleshooting

## Frequently Asked Questions

### General Questions

**Q: Is this extension free?**  
A: Yes, completely free and open source.

**Q: Does it work on mobile Firefox?**  
A: Yes! The extension works on Firefox for Android.

**Q: Will my highlights sync across devices?**  
A: Currently no. Highlights are stored locally in each browser. This is a potential future feature.

**Q: Can I export my highlights?**  
A: Not in the current version, but this is planned for a future release.

**Q: How much data can I store?**  
A: Firefox's local storage is quite generous (typically several MB). You can store thousands of highlights without issues.

**Q: Are my highlights private?**  
A: Yes! Everything is stored locally in your browser. Nothing is sent to any server.

### Usage Questions

**Q: Can I highlight text in PDFs?**  
A: Not currently. This extension works on HTML web pages only.

**Q: What happens if I highlight the same text twice?**  
A: You'll create two separate highlights. The second one will overlap or wrap the first.

**Q: Can I change a highlight's color after creating it?**  
A: Currently no, but you can delete it and re-highlight with a different color.

**Q: How do I search through my annotations?**  
A: Currently there's no built-in search. You can use Firefox DevTools (F12) to search the page source for your text.

**Q: Can I highlight across multiple paragraphs?**  
A: Yes, select text spanning multiple elements and highlight normally.

**Q: What's the maximum length for annotations?**  
A: There's no hard limit, but keep them reasonable (under 1000 characters) for best performance.

**Q: Can I highlight images or other media?**  
A: No, only text content can be highlighted.

**Q: Do highlights work in iframes?**  
A: Not currently. The extension works on the main page content only.

### Technical Questions

**Q: Why do some highlights disappear?**  
A: If a website heavily modifies its DOM structure (like single-page apps), the XPath references can break. The extension works best on static or server-rendered pages.

**Q: Can I use this on any website?**  
A: Yes, it works on any website. However, some sites with very strict Content Security Policies might have limitations.

**Q: How does the XPath storage work?**  
A: The extension stores the "path" to each text node in the page structure. When you return, it follows that path to recreate the highlight.

**Q: What happens if page content changes?**  
A: If the text is still there but moved, highlights may not restore. If the exact structure is preserved, highlights will work fine.

**Q: Does this affect page load speed?**  
A: No noticeable impact. The extension loads after the page and processes highlights efficiently.

**Q: How big is the extension?**  
A: Very small - under 50KB total.

## Troubleshooting

### Highlights Don't Appear

**Problem**: I created highlights but they don't show up after refreshing.

**Solutions**:
1. Check if you're on the exact same URL (including query parameters)
2. Open Firefox DevTools (F12) → Console → Look for errors
3. Try creating a new highlight to test if storage is working
4. Check Firefox's privacy settings - make sure local storage is enabled
5. Try disabling other extensions that might conflict

**Problem**: Highlights disappeared after page update.

**Solution**: If the website changed its HTML structure, the XPath references break. Unfortunately, there's no automatic fix for this. You'll need to recreate the highlights.

### Toolbar Doesn't Appear

**Problem**: I select text but the toolbar doesn't show.

**Solutions**:
1. Make sure you actually selected text (it should be highlighted blue)
2. Check if the page has JavaScript restrictions
3. Try refreshing the page
4. Reinstall the extension
5. Check browser console for errors

**Problem**: Toolbar appears in the wrong position.

**Solution**: This is normal - the toolbar positions itself near your selection but adjusts to stay on screen. You can still use all functions.

### Bookmarks/Anchors Issues

**Problem**: Bookmarks don't appear.

**Solutions**:
1. Check if highlights are visible (click extension icon)
2. Look for the 🔖 emoji - it might be small
3. Try creating a new bookmark to test
4. Refresh the page

**Problem**: Bookmark is in the wrong location.

**Solution**: Delete it (click → Delete) and create a new one at the correct position.

### Link Sharing Problems

**Problem**: Shared link doesn't jump to the highlight.

**Solutions**:
1. Make sure the full URL including the # fragment is copied
2. Recipient must have the extension installed
3. The page must load completely before jumping
4. Try manually scrolling to see if the highlight exists

**Problem**: "Copy Link" doesn't work.

**Solutions**:
1. Make sure clipboard permissions are enabled in Firefox
2. Try clicking the highlight first, then "Copy Link"
3. Check browser console for errors
4. Manually copy the URL and add `#[highlight-id]`

### Storage/Data Issues

**Problem**: Highlights don't persist after browser restart.

**Solutions**:
1. Check Firefox privacy settings
2. Make sure "Delete cookies and site data when Firefox is closed" is OFF
3. Check if you're in Private Browsing mode (highlights won't persist)
4. Verify the extension has storage permissions

**Problem**: Too many highlights making pages slow.

**Solutions**:
1. Use "Clear All" on very busy pages
2. Consider using fewer highlights
3. Toggle visibility when not needed
4. Each page stores independently, so other pages won't be affected

### Extension Not Working

**Problem**: Extension icon is grayed out or not working.

**Solutions**:
1. Check if extension is enabled in `about:addons`
2. Try disabling and re-enabling
3. Uninstall and reinstall the extension
4. Check Firefox version (need 57+)

**Problem**: Extension disappeared after Firefox update.

**Solutions**:
1. Reinstall from `about:debugging`
2. If it was temporary, it was removed (this is normal)
3. Use permanent installation method

### Performance Issues

**Problem**: Page loads slowly with many highlights.

**Solutions**:
1. Reduce number of highlights on the page
2. Use "Hide Highlights" when not needed
3. Consider breaking content across multiple pages

**Problem**: Browser using too much memory.

**Solution**: This is unlikely to be caused by the extension (it's very lightweight), but you can test by disabling it temporarily.

## Common Error Messages

### "Could not get state from content script"

**Meaning**: The popup couldn't communicate with the page content.

**Fix**: Refresh the page and try again. This is usually temporary.

### "Error recreating range"

**Meaning**: The extension couldn't find the original text location.

**Fix**: The page structure changed. Delete and recreate the highlight.

### "Error evaluating XPath"

**Meaning**: The stored path to the text is no longer valid.

**Fix**: Page changed too much. Recreate highlights.

## Best Practices to Avoid Issues

1. **Use on stable pages**: Works best on articles, documentation, and static content
2. **Avoid dynamic SPAs**: Single-page apps that heavily modify the DOM may lose highlights
3. **Regular backups**: Take screenshots of important highlighted pages
4. **Consistent URLs**: Bookmarks use exact URLs - parameters matter
5. **Test sharing**: Verify links work before sharing widely
6. **Toggle visibility**: Hide highlights when printing or taking screenshots
7. **Clean up**: Delete old highlights you don't need anymore
8. **Update extension**: Keep the extension updated for bug fixes

## Getting Help

### Report a Bug

If you encounter a bug:

1. Open Firefox DevTools (F12)
2. Go to Console tab
3. Copy any error messages
4. Note what you were doing when it happened
5. Include your Firefox version
6. Submit via GitHub issues or Firefox Add-ons

### Request a Feature

Have an idea? We'd love to hear it!

1. Check if it's already in the roadmap (see README)
2. Describe the use case
3. Explain how it would work
4. Submit your request

### Community Support

- Check GitHub issues for similar problems
- Search Firefox Add-ons support forum
- Read the full README.md and FEATURES.md

## Known Limitations

Current limitations we're aware of:

1. ❌ No PDF support (HTML only)
2. ❌ No sync across devices
3. ❌ Can't change highlight color after creation
4. ❌ No keyboard shortcuts
5. ❌ No bulk operations
6. ❌ No export/import
7. ❌ Doesn't work in iframes
8. ❌ Breaks on heavy DOM changes
9. ❌ No collaborative features
10. ❌ No search through annotations

Many of these are planned for future versions!

## Tips for Success

✅ **DO:**
- Use on article pages, documentation, and blogs
- Create bookmarks at section starts
- Use color coding consistently
- Keep annotations concise
- Share links with context
- Toggle visibility when presenting

❌ **DON'T:**
- Expect highlights to survive major page redesigns
- Highlight entire pages (be selective)
- Rely on it for critical data (take backups)
- Use in Private Browsing for permanent storage
- Expect it to work on every dynamic webapp

---

Still having issues? Check the console for errors or open an issue on GitHub!
