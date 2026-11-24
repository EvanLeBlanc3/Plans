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

---

## ☁️ Calendar & Wallet helper (one-time setup)
iPhone won't let Home Screen web apps open Calendar or Wallet directly. A tiny free Cloudflare Worker passes your plan along as a real link, so iOS shows **Add All** (Calendar) or **Add** (Wallet).

### Part 1: Calendar (free, about 5 minutes)
1. Go to **dash.cloudflare.com → Workers & Pages → Create → Create Worker**.
2. Name it `plans-helper`, then select **Deploy**.
3. Select **Edit code**, delete everything, paste in all of `worker/worker.js`, then select **Deploy**.
4. Copy the Worker URL (something like `https://plans-helper.yourname.workers.dev`).
5. In Plans, go to **⚙️ Settings → Calendar & Wallet helper**, paste the URL, and tap **Save & test**. You should see "✅ Calendar: ready".

### Part 2: Apple Wallet (needs a paid Apple Developer account)
Apple only accepts passes signed with your own Pass Type ID certificate.
1. Go to **developer.apple.com → Certificates, IDs & Profiles → Identifiers → +**. Choose **Pass Type IDs** and create `pass.com.YOURNAME.plans`.
2. Open that Pass Type ID, select **Create Certificate**, and follow the steps. That includes making a Certificate Signing Request on your Mac in **Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority**, saved to disk.
3. Download the certificate and double-click it to add it to Keychain Access.
4. In Keychain Access, right-click the **Pass Type ID** certificate, choose **Export**, and save it as `pass.p12` with a password.
5. Download Apple's **Worldwide Developer Relations - G4** certificate from apple.com/certificateauthority and save it as `AppleWWDRCAG4.cer`.
6. In Terminal, in the folder with those files, run:
   ```
   openssl pkcs12 -in pass.p12 -clcerts -nokeys -out pass-cert.pem -legacy
   openssl pkcs12 -in pass.p12 -nocerts -nodes -out pass-key.pem -legacy
   openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem
   ```
   (If `-legacy` gives an error, run the same commands without it.)
7. In Cloudflare, open your Worker and go to **Settings → Variables and Secrets → Add**. Add these as **Secret** type:
   - `PASS_TYPE_ID`: `pass.com.YOURNAME.plans`
   - `TEAM_ID`: your 10-character Team ID (top right of the Apple developer site)
   - `PASS_CERT`: the whole text of `pass-cert.pem`
   - `PASS_KEY`: the whole text of `pass-key.pem`
   - `WWDR_CERT`: the whole text of `wwdr.pem`
8. Select **Deploy**, then in Plans tap **Save & test**. You should see "✅ Wallet: ready".

Keep `pass-key.pem` private. Never upload it to GitHub.
