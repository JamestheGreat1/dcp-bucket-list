# DCP Bucket List

Private source repository for James' Disney College Program completionist bucket list.

## App
- Responsive desktop/mobile checklist
- PWA manifest and home-screen install support
- Offline app-shell caching
- Progress saved in browser local storage
- Export/import progress backup
- Main Quest, Side Quest, Rare, Legendary, and 2027 Watch tiers

## Install on iPhone
Once the site is hosted over HTTPS:

1. Open the site in Safari.
2. Tap **Share**.
3. Tap **Add to Home Screen**.
4. Tap **Add**.


## Backup and offline verification

Progress is saved **only in this browser's local storage**. A different browser, device, or reinstalled PWA will not automatically have the same progress. Export a JSON backup periodically, and keep the downloaded file somewhere safe (such as Files/iCloud Drive).

A safe manual test on iPhone after installing the PWA:

1. Open the Home Screen app **online** once, then check one clearly identifiable unfinished quest.
2. Turn on Airplane Mode, fully close the Home Screen app, and reopen it. Confirm the checklist still loads and your checked quest remains complete.
3. Turn Airplane Mode off. Use **Export** and save the JSON file to Files. Confirm the file exists and contains `completed`, `unlocks`, and `categoryHistory` fields.
4. Check another test quest, then **Import** the saved JSON backup. Confirm the app warns that importing replaces current progress; accept only when you want to restore the earlier save.
5. Confirm the first quest and your earlier achievements were restored and the second test quest is no longer checked. Re-export if you want a fresh backup.

**Do not press Reset just to test backups.** Importing replaces the current save, and the app has no server-side history or automatic cloud recovery.

The dependency-free regression suite can be run locally with Node.js 24+:

```bash
node --test tests/*.test.mjs
```

## Files
- `index.html` — app
- `manifest.webmanifest` — PWA metadata
- `sw.js` — offline service worker
- `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — install icons

> Personal/unofficial project. Not affiliated with The Walt Disney Company.
