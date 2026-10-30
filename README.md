# dk-portfolio

Personal portfolio for **Dhanush Karthik** — Java Backend Engineer.
v2 "Stack Trace": paper sheets laid over a live terminal, with Three.js layers, scroll-driven transitions and an optional hand-gesture mode. Content is managed in a Supabase-backed CMS.

## Live

- **Portfolio**: [dhanushkarthik.com](https://dhanushkarthik.com)
- **CMS**: [dhanushkarthik.com/cms](https://dhanushkarthik.com/cms)
- **Design proposal**: [docs/design/stack-trace-proposal.html](docs/design/stack-trace-proposal.html)

## Tech Stack

| Layer       | Technology                                             |
|-------------|--------------------------------------------------------|
| Framework   | React 18 + Vite 5, prerendered to static HTML per route |
| 3D          | three, @react-three/fiber, @react-three/drei            |
| Motion      | Lenis smooth scroll, GSAP, CSS                          |
| Hand mode   | @mediapipe/tasks-vision Hand Landmarker (on-device)     |
| CMS / DB    | Supabase (PostgreSQL + RLS)                             |
| SEO         | Prerendered HTML, react-helmet-async, JSON-LD graph, generated sitemap |
| Hosting     | Netlify                                                 |

## How the public site is built

- `src/site/` is the public site. Each CMS section is one "sheet" (`src/site/sections/*`); the order and visibility still come from the `section_order` table.
- `src/site/three/` holds the lazy-loaded WebGL scenes: CRT terminal background, 2.5D portrait, skills stack, project card fan. None of them hold content; all text is HTML.
- `src/site/hand/` is hand mode. It turns gestures into ordinary pointer, click and scroll events.
- Visitors on weak devices or with reduced motion get the flat 2D "print" mode; the HUD toggles it.
- `npm run build` = client build → SSR build → `scripts/prerender.mjs`, which fetches content from Supabase and writes `index.html`, `projects/<slug>/index.html`, `404.html`, `app.html` (CMS shell) and `sitemap.xml`.
- The CMS **Publish site** button calls a Netlify build hook, so edits reach the static HTML. Until then, live data is still fetched in the browser.

## Setup

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/dk-portfolio.git
cd dk-portfolio
npm install
```

### 2. Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. Copy your project URL and anon key from **Settings → API**

### 3. Environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_CMS_PASSWORD=your-secret-password
```

### 4. Run locally

```bash
npm run dev
```

Portfolio at `http://localhost:5173`, CMS at `http://localhost:5173/cms`.

### 5. Deploy to Netlify

1. Push to GitHub
2. Connect the repo in [Netlify](https://netlify.com)
3. Build command: `npm run build`, publish directory: `dist`
4. Add all env vars in Netlify's environment settings, including `VITE_NETLIFY_BUILD_HOOK` (create it under Site settings → Build & deploy → Build hooks)

### 6. v2 database migration

Run `supabase/migrations-v2.sql` once in the Supabase SQL editor. It adds project slugs and case-study fields, the hero cutout/depth fields, the `subdomains` table (seeded with blogs.dhanushkarthik.com) and the `network` section.

### 7. Search Console (for "dhanush karthik" and subdomains)

1. Add a **Domain property** for `dhanushkarthik.com` (DNS TXT verification). It covers every subdomain.
2. Submit `https://dhanushkarthik.com/sitemap.xml`; it lists the subdomain homepages too.
3. On each subdomain site: no `noindex`, its own sitemap, a link back to dhanushkarthik.com, and JSON-LD with `"author": {"@id": "https://dhanushkarthik.com/#person"}`.
4. Use the same name, "Dhanush Karthik", on LinkedIn, GitHub and X, and link them back to the site.

## GitHub Workflows

**PR Build** (`pr-build.yml`): Lint + build on every pull request to `main`.

**Release** (`release.yml`): Manually triggered. Enter a tag (e.g., `v1.0.0`) and optional release notes. Builds, tags, and creates a GitHub Release.

Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_CMS_PASSWORD` as repository secrets.

## CMS Usage

1. Navigate to `/cms`
2. Enter the password from `VITE_CMS_PASSWORD`
3. Edit sections: site config, colors, section order, hero, about, skills, experience, education, projects, subdomains, testimonials, social links, contact
4. Press **Publish site** to rebuild the static pages
5. Use the **Section Order** tab to reorder sections and toggle visibility (e.g., hide testimonials until ready)

## License

MIT
