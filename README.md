# dk-portfolio

Personal portfolio for **Dhanush Karthik** — Java Backend Engineer.
Dark-themed, terminal-inspired design with a full CMS dashboard powered by Supabase.

## Live

- **Portfolio**: [dhanushkarthik.dev](https://dhanushkarthik.dev)
- **CMS**: [dhanushkarthik.dev/cms](https://dhanushkarthik.dev/cms)

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Framework   | React 18 + Vite 5                   |
| Styling     | Tailwind CSS 3                      |
| Animation   | Framer Motion                       |
| Icons       | Lucide React                        |
| CMS / DB    | Supabase (PostgreSQL + RLS)         |
| Auth        | ENV-based password (VITE_CMS_PASSWORD) |
| SEO         | react-helmet-async + JSON-LD        |
| Hosting     | Netlify (free tier)                 |
| CI/CD       | GitHub Actions                      |

## Features

- **Java/Terminal aesthetic** — hero styled as a Java class declaration, terminal window UI, monospace code syntax
- **Left-side glass navbar** — unconventional vertical navigation rail with active section tracking and social links
- **Big project cards** — full-width cards with screenshot images, live site iframe preview, tech stack badges, and direct links
- **Fully CMS-driven** — every section editable via `/cms` dashboard
- **Section ordering** — reorder and toggle visibility of portfolio sections from the CMS
- **Color palette configurator** — change the entire site theme from the CMS
- **Education section** — university, degree, grade/CGPA, timeline
- **Testimonials section** — client quotes with toggle visibility from CMS
- **ENV-based auth** — CMS protected by a password set via environment variable (no Supabase Auth needed)
- **SEO optimized** — Open Graph, Twitter Cards, JSON-LD structured data, sitemap, robots.txt, canonical URL
- **Responsive** — mobile-first with hamburger menu fallback on smaller screens
- **Animated** — scroll-triggered reveals, Spring Boot boot sequence loading screen

## Project Structure

```
dk-portfolio/
├── .github/workflows/
│   ├── pr-build.yml          # Build on every PR
│   └── release.yml           # Manual release with tag
├── public/
│   ├── favicon.svg
│   ├── robots.txt
│   ├── sitemap.xml
│   └── structured-data.json
├── src/
│   ├── components/           # UI sections (Hero, About, Skills, Experience,
│   │                         #   Education, Projects, Testimonials, Contact,
│   │                         #   Navbar, Footer, LoadingScreen)
│   ├── hooks/                # usePortfolioData, useInView
│   ├── lib/                  # supabase client, defaults, theme, auth
│   ├── pages/                # Portfolio, CMSLogin, CMSDashboard
│   ├── styles/               # Tailwind + custom CSS
│   ├── App.jsx
│   └── main.jsx
├── supabase/
│   └── schema.sql            # Full DB schema + seed data
├── .env.example
├── netlify.toml
├── tailwind.config.js
├── vite.config.js
└── package.json
```

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
4. Add all three env vars in Netlify's environment settings

## GitHub Workflows

**PR Build** (`pr-build.yml`): Lint + build on every pull request to `main`.

**Release** (`release.yml`): Manually triggered. Enter a tag (e.g., `v1.0.0`) and optional release notes. Builds, tags, and creates a GitHub Release.

Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_CMS_PASSWORD` as repository secrets.

## CMS Usage

1. Navigate to `/cms`
2. Enter the password from `VITE_CMS_PASSWORD`
3. Edit sections: site config, colors, section order, hero, about, skills, experience, education, projects, testimonials, social links, contact
4. Use the **Section Order** tab to reorder sections and toggle visibility (e.g., hide testimonials until ready)

## License

MIT
