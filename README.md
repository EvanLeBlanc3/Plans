# Plans 🎉
Make plans the fun way, not the "type into a calendar box" way.

## Install on iPhone (GitHub Pages)
1. On GitHub, create a new **public** repository called `plans`.
2. Select **Add file → Upload files** and drag in everything from this folder: `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`, `README.md`, and the whole `icons` folder. Make sure the files sit at the top level of the repo, not inside an extra folder.
3. Select **Commit changes**.
4. Go to **Settings → Pages**. Under *Build and deployment*, set **Source** to *Deploy from a branch*, **Branch** to `main` and `/ (root)`, then select **Save**.
5. Wait about a minute, then open `https://YOUR-USERNAME.github.io/plans/` in **Safari** on your iPhone.
6. Tap **Share → Add to Home Screen → Add**.

## Updating later
Upload the changed files and overwrite the old ones. If your iPhone keeps showing the old version, close the app fully and open it again. The service worker updates on the next launch.

## Good to know
- **Calendar:** Web apps can't write straight into Apple Calendar. Plans makes a standard `.ics` invite instead, and iOS opens it with **Add All**. It includes the map pin, reminder, and all your details.
- **Location search:** Photon (Komoot), built on OpenStreetMap data. It's free with no API key. Nominatim is the fallback.
- **Storage:** Plans are saved on your device in localStorage. Photos and files are stored in IndexedDB. Use **Settings → Export backup** now and then.
- **Portrait lock:** iOS ignores orientation locks for web apps, so Plans counter-rotates itself in landscape to stay upright.
