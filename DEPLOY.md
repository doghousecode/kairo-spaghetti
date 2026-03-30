# Kairo Spaghetti Wall — Deploy Guide

## What you need
- GitHub account (you have this ✅)
- Vercel account (free — sign up with GitHub at vercel.com)
- Anthropic API key (from console.anthropic.com — free credits to start)
- Node.js installed (check: run `node -v` in Terminal)

If you don't have Node.js: `brew install node` in Terminal.

---

## Step 1: Get the code on GitHub

Open Terminal and run these one at a time:

```bash
# Go to where you want the project
cd ~/Projects  # or wherever you keep code

# Unzip if you downloaded the zip, otherwise just cd into the folder
cd kairo-spaghetti-wall

# Initialise git
git init

# Create the repo on GitHub (easiest via github.com):
# 1. Go to github.com/new
# 2. Name it "kairo-spaghetti-wall"  
# 3. Set to Private
# 4. DON'T add a README (we already have files)
# 5. Click "Create repository"

# Then back in Terminal, connect and push:
git remote add origin https://github.com/YOUR_USERNAME/kairo-spaghetti-wall.git
git add .
git commit -m "v0.5 — spaghetti wall initial deploy"
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Click **"Add New" → "Project"**
3. Find `kairo-spaghetti-wall` in the list → **Import**
4. Framework Preset should auto-detect as **Vite** ✅
5. Before clicking Deploy, expand **"Environment Variables"** and add:

   | Key | Value |
   |-----|-------|
   | `VITE_ANTHROPIC_API_KEY` | your-anthropic-api-key |

6. Click **Deploy**
7. Wait ~60 seconds. Done.

You'll get a URL like `kairo-spaghetti-wall.vercel.app`

---

## Step 3: Add to iPhone Home Screen (PWA)

1. Open your Vercel URL in Safari on your iPhone
2. Tap the **Share** button (box with arrow)
3. Scroll down → **"Add to Home Screen"**
4. Name it "Spaghetti Wall" or "Kairo"
5. Tap Add

It now opens as a standalone app. No browser chrome. Full screen. 
Voice notes and mic access will work here because it's HTTPS.

---

## Step 4 (Optional): Custom domain

If you want `spaghetti.kairo.ai` or similar:

1. In Vercel project → Settings → Domains
2. Add your domain
3. Update DNS as instructed (usually a CNAME record)

---

## Day-to-day workflow

When you want to update the app:

```bash
cd ~/Projects/kairo-spaghetti-wall
# Make changes (or paste updated files from Claude)
git add .
git commit -m "description of change"
git push
```

Vercel auto-deploys on every push to main. Takes ~30 seconds.

---

## Important notes

- **API key security**: The VITE_ prefix means the key is bundled into the client-side code. This is fine for personal use but DO NOT make the repo public. If you productise later, you'll want a backend proxy.
- **Storage**: Currently uses localStorage (single device). When you want cross-device sync, we swap to Supabase — I can set that up whenever.
- **Voice notes**: Will work on the deployed HTTPS site. Won't work in Claude's preview sandbox.
- **Cost**: Vercel free tier = plenty. Anthropic API = ~$0.003 per idea analysis. You'd need to throw ~3,000 ideas to hit $10.

---

## File structure

```
kairo-spaghetti-wall/
├── index.html          ← entry point with PWA meta tags
├── vite.config.js      ← build config
├── package.json        ← dependencies
├── .env.example        ← copy to .env.local for local dev
├── .gitignore
├── public/
│   ├── manifest.json   ← PWA manifest
│   └── icon-192.svg    ← app icon (replace with proper one later)
└── src/
    ├── main.jsx        ← React mount
    └── SpaghettiWall.jsx  ← the whole app
```
