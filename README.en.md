# 💳 Benefits Wallet

**A full-stack system that reminds customers, at the right moment, where their discounts apply, so they stop leaving money on the table.**

[עברית](README.md) · English

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![React Native](https://img.shields.io/badge/React_Native-Expo_54-000020?logo=expo&logoColor=white)
![Tests](https://img.shields.io/badge/tests-136_passing-brightgreen)

<!--
  Screenshots go here. Add the files to docs/screenshots/, then delete this
  comment's opening line and the closing line below the table.

| Mobile: Home | Mobile: My Wallet | Admin dashboard | Review queue |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/mobile-home.png" width="200"> | <img src="docs/screenshots/mobile-wallet.png" width="200"> | <img src="docs/screenshots/dashboard.png" width="300"> | <img src="docs/screenshots/review-queue.png" width="300"> |
-->

## 🧰 Tech stack

| Layer | Technologies |
|---|---|
| **Backend** | Node.js · Express · **TypeScript** · **Prisma 6** · **PostgreSQL** (with `pg_trgm` fuzzy search) · Zod · pino · helmet · node-cron |
| **Admin dashboard** | **React 18** · Vite 6 · React Router · TypeScript · full Hebrew RTL |
| **Mobile app** | **React Native** · **Expo 54** · React Navigation 7 · TanStack Query 5 · AsyncStorage |
| **Browser extension** | **Chrome Extension (Manifest V3)** · TypeScript |
| **AI** | **Google Gemini** (`@google/genai`): semantic duplicate judgment, image verification, categorization, summaries |
| **Storage & infra** | **Cloudflare R2** (S3-compatible image storage) · Nodemailer (alerts) |
| **Quality** | **Vitest**: 136 integration tests against a real Postgres · Zod on every input · clean `tsc --noEmit` in all four apps |
| **Scraper** | axios + cheerio, configuration-driven, with robots.txt, rate limiting and a legal sign-off gate |

---

## 🎯 The problem

Most people hold several credit cards, loyalty clubs and employee clubs. Each grants discounts, some of them large, but:

- **Benefits are scattered.** Discounts come from clubs such as **Hever** and **Shelach**, credit cards, retail chains and employer programs, each with its own site, app and terms.
- **It is hard to keep it all in your head.** A large club gives discounts at dozens or hundreds of stores. Nobody remembers which, least of all at the checkout.
- **A benefit is only worth something if you remember it in time.** After paying, it is too late.
- **The terms are confusing.** Validity periods, minimum purchase, no stacking with other promotions, participating and non-participating branches.
- **The result:** people pay full price for things they could have bought at a discount. They don't lose money, they simply don't know they have a benefit.

## 💡 The solution

**Benefits Wallet** turns all your benefits into one personal, clear list.

1. **Pick once** which cards and clubs you have (a one-minute onboarding).
2. **The app filters for you.** Only benefits that actually apply to you are shown.
3. **Search your way.** By brand ("what do I have at Fox?"), by category, or free text that tolerates typos.
4. **See what is worth the most.** Benefits are ranked by monetary value, and new ones are flagged.
5. **Save favorites** and hide what is irrelevant.

> The product fits especially well for members of large clubs such as **Hever** and **Shelach**, which grant discounts across a huge number of stores that are hard to remember.

The user's selections are stored **on the device only**. There is no account, no password, and no personal data on the server.

---

## 🏗️ Architecture

Four applications around a single server that is the **single source of truth**:

```
┌─────────────────┐   ┌──────────────────┐   ┌───────────────────┐
│  📱 Mobile App  │   │  🖥️ Dashboard    │   │  🧩 Chrome        │
│  (Expo / RN)    │   │  (React + Vite)  │   │  Extension (MV3)  │
│  read-only      │   │  catalog admin   │   │  manual import    │
└────────┬────────┘   └────────┬─────────┘   └─────────┬─────────┘
         │                     │                       │
         └──────────┬──────────┴───────────────────────┘
                    ▼
        ┌───────────────────────────┐        ┌──────────────┐
        │  ⚙️ Backend (Express/TS)  │───────▶│ Gemini (AI)  │
        │  routes → controller →    │        └──────────────┘
        │  service → repository     │        ┌──────────────┐
        └─────────────┬─────────────┘───────▶│ Cloudflare R2│
                      ▼                      └──────────────┘
              ┌───────────────┐
              │  PostgreSQL   │
              └───────────────┘
```

The architecture was designed from day one as a deliberate balance: light enough for one person to understand and maintain, yet careful enough not to skip any of the concerns a real system has. The key decisions:

### 🧠 Data model: a "clean" benefit plus applicability rules
A benefit does not know who it belongs to. The link to a club, brand or store lives in a `BenefitScope` table:
- **One row = AND** across its filled fields. **Several rows = OR** between them. An empty field means "any".
- This expresses "all Hever members at Tel Aviv branches" or "anyone holding a given card at any brand" without duplicating benefits or adding special columns.
- The visibility rule is implemented in **one place** on the server. The app, search and recommendations all use it, so one screen can never show a benefit that another hides.

### 🛡️ Human in the loop: a scraper with a confidence score
Every collected item goes through a decision chain: **match** to an existing benefit → **confidence score** → automatic publishing only above a configured threshold, otherwise a **human review queue**.
- An abnormal change in discount value (say 9x) lowers the score **logarithmically**, so it is never published without a person.
- A **new** benefit is never auto-published unless a default scope was configured in advance.
- A full event log (`ScrapedItem`, `ScraperRun`) lets you reconstruct what happened and when.

### 🔍 Smart search
Fuzzy search with `pg_trgm` (prefix, substring and similarity) over names, tags and keywords. A typo still finds a result. It automatically fetches an extra page when filtering removes most candidates, so a page is not returned empty by mistake.

### 🔐 Security and robustness
- Password-protected dashboard with an **HMAC-signed session** and a protected cookie, without a needless user database.
- **Zod** validation on every input, `helmet`, configured CORS, and uniform error responses.
- **Secrets never enter git.** `.env` is ignored, and a documented `.env.example` is provided.
- **Soft delete** and a separate `isActive` flag, plus an **audit log** of changes.
- Separating `app.ts` from `server.ts` allows testing without a TCP port.

### 🤖 AI only where it belongs
Gemini is used for semantic duplicate judgment, image and category verification, and description summaries. The integration:
- **Degrades gracefully.** Without a key the system keeps working and that step is skipped.
- **Respects quotas.** A shared rate limiter covers every consumer of the key.
- **Is disconnected in tests.** No real model calls in the test environment.

### 🧪 Real tests
136 tests in 15 files, running against a **real Postgres**, not mocks. They cover the visibility rule, scope editing, the auto-publish threshold, item matching, scheduling, search and AI. A safety guard refuses to run tests against any database whose name does not contain `test`.

### 🗂️ Consistency
A uniform pattern for every module (`routes → controller → service → repository → dto`), shared types across layers, uniform API responses and capped pagination. Adding an entity means copying a pattern, not inventing a new one.

---

## 🧗 Challenges

The product depends on information scattered across the sites of many different parties, and that is where most of the real difficulty lies:

| Challenge | How it shows up | How the system copes |
|---|---|---|
| **Every site is built differently** | No two club sites share the same HTML | A **configuration-driven** scraper: adding a source means defining selectors, not touching code |
| **Sites that block automated scraping** | `robots.txt`, rate or User-Agent blocking, anti-bot protection | robots.txt check before every page, delay between requests (`requestDelayMs`), an identifiable User-Agent, and a single failure does not abort a run |
| **JavaScript-rendered sites** | `axios + cheerio` cannot see browser-generated content | A `renderMode` exists in the schema. Only HTTP is implemented today; HEADLESS_BROWSER skips with a clear warning instead of failing silently |
| **Contractual terms of use** | `robots.txt` does not reflect contractual bans | A separate gate: human ToS sign-off (see below) |
| **Bank and card-issuer sites** | Personal data behind a login, high legal and security sensitivity | **No** personal user data is collected. The catalog is built from public benefits, and personal selection stays on the device |
| **A site changes and the scraper "succeeds" with zero results** | A green run that returns nothing is the most dangerous failure | Email alerts on abnormal runs and a full run log |
| **Duplicates and orphaned benefits** | The same benefit appears in several sources with different wording | Deterministic matching, plus Gemini's semantic judgment when the rules are not enough |
| **Wrong automatic publishing** | A confidence-score bug let a 9x value change publish without a person. Found in QA | Proportional logarithmic deduction, plus tests pinned to the boundary |
| **"Who gets what" logic** | Combinations of club, card, brand and branch | The `BenefitScope` (AND/OR) model and a single source of truth for visibility |
| **AI quotas** | Rate limit on Gemini's free tier | A shared module-level rate limiter |

---

## ⚖️ Legal stance

Automated data collection from websites is a sensitive subject, so it is built in as a **design principle**, not an afterthought:

- **No scraping without sign-off.** A new scraper source is always created **inactive**. To activate it, a person must read the site's terms of use and record approval or rejection, **including the reviewer's name**. The server rejects activation without approval (HTTP 422), and the dashboard also disables the button.
- **`robots.txt` is respected.** It is checked before every page, and a disallowed path stops the run.
- **Polite scraping.** A delay between requests, a User-Agent that identifies the tool, and a low frequency (default: one run a day).
- **A person decides.** Anything uncertain goes to a manual review queue, and a new benefit is never published on its own.
- **The browser extension is a manual aid.** It acts only on a click by a logged-in admin, in their own browser, on a page they opened themselves. There is no scheduling and no server-triggered run.
- **No personal data collection.** The system never logs into user accounts, whether bank or card issuer.
- **No sources enabled in code.** The seed defines no scraper source.

**An honest note:** the project was **never run with automated scraping in production**. This was a conscious decision, because a legal review of each site's terms is a precondition for enabling it. The mechanisms exist so that it can be done responsibly; they are not a substitute for legal advice. Future ways to reduce the risk are direct partnerships with benefit providers, or manual entry only.

---

## 📁 Project structure

```
benefits-wallet/
├── apps/
│   ├── backend/          Express + Prisma server and tests (detailed README inside)
│   ├── dashboard/        React admin dashboard (detailed README inside)
│   ├── mobile/           Expo / React Native app (detailed README inside)
│   └── admin-extension/  Chrome admin extension (Manifest V3)
├── docs/                 Guides and documentation
└── README.md
```

## 🚀 Running locally

Requirements: Node.js 20+, PostgreSQL.

```bash
# 1. Backend
cd apps/backend
cp .env.example .env        # then fill in DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET
npm install
npx prisma generate && npx prisma migrate dev && npx prisma db seed
npm run dev                 # http://localhost:4000

# 2. Dashboard (another terminal)
cd apps/dashboard && npm install && npm run dev

# 3. Mobile (another terminal)
cd apps/mobile && npm install && npx expo start

# 4. Chrome extension (optional)
cd apps/admin-extension && npm install && npm run build
# then in chrome://extensions: Load unpacked → the dist folder
```

All environment variables are documented in [`apps/backend/.env.example`](apps/backend/.env.example). Gemini and R2 are optional; without them the system works and those features are skipped.

### Running the tests
```bash
cd apps/backend
npm test            # needs a local PostgreSQL; user and database are set in vitest.config.ts
npm run typecheck
```

## 📚 More documentation

- [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md): detailed code walkthrough (Hebrew; a snapshot from 9 Aug 2026, see the note at its top)
- [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md): guide for the content manager, no technical background needed (Hebrew)

---

TypeScript end to end
