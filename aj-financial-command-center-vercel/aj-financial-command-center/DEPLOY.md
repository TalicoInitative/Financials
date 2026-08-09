# Deploying to Vercel

Static site. No build step, no environment variables, no backend.

```
aj-financial-command-center/
├── public/                     ← the only folder that deploys
│   ├── index.html              ← the entire app (312 KB)
│   ├── sw.js                   ← offline support
│   ├── manifest.webmanifest    ← installable on phone
│   └── icon.svg
├── vercel.json                 ← output dir, no-build, security headers
├── .vercelignore               ← keeps tests out of the upload
├── package.json                ← test scripts only
└── *.mjs                       ← 29 test suites
```

## Fastest route — CLI

```bash
npm i -g vercel        # once
cd aj-financial-command-center
vercel                 # preview URL
vercel --prod          # production URL
```

When it asks *"In which directory is your code located?"* answer `./`. Accept every other default — `vercel.json` already pins the output directory (`public`), disables the build step, and sets the headers.

## Or via GitHub (better if you'll keep editing)

```bash
git init
git add -A
git commit -m "AJ Financial Command Center"
git branch -M main
git remote add origin https://github.com/<you>/aj-finance.git
git push -u origin main
```

Then vercel.com → **Add New → Project** → import the repo → **Deploy**. No configuration needed. Every push to `main` redeploys.

## Or drag and drop

vercel.com/new → drag the whole folder onto the page.

---

## Do these three things right after it deploys

1. **Open the URL and confirm it loads dark with an empty ledger.** The top strip should read Actual C$0.00 / Calculated C$0.00 / Difference C$0.00.

2. **Link your auto-save file.** Data → Import / export → **Link a file on this PC**. Pick somewhere inside your normal backup path (Documents, OneDrive, Dropbox). Every change then writes there as well as to the browser.
   *This is the step that could not work in the chat preview* — browsers block file dialogs inside embedded frames. On your real deployed URL it works.

3. **Export one JSON backup** so you have a second copy before entering anything real.

## Worth knowing

- **The URL is public, your data is not.** Anyone with the link gets the app; nobody gets your numbers, because nothing is ever uploaded. For a private link, Project → Settings → Deployment Protection (Vercel Pro), or just use an unguessable project name.
- **Data lives per browser, per device.** Your laptop and phone hold separate ledgers. Move between them with Export → Restore.
- **Clearing browser data wipes it** — unless you linked a file, which survives.
- **Updating later:** replace `public/index.html`, bump `CACHE = 'ajfin-v7'` to `v8` in `public/sw.js`, push. The service worker is network-first so browsers pick up changes on the next online load either way. The app also carries a build stamp: if your saved copy is older and you have no real data, it silently adopts the new version; if you do have data, it keeps it and offers a refresh button.
- **Custom domain:** Project → Settings → Domains. Works on the free tier.
- **Install it on your phone:** open the URL → Share → Add to Home Screen. Runs standalone and offline.

## Tests

```bash
npm install         # jsdom, for the headless suites
npm run test:all    # all 29 suites
npm run test:safety # data-loss, memory and layout audits only
```
