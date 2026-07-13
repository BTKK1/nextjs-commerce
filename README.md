<p align="center">
  <a href="https://bagisto.com/en/headless-ecommerce/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/bagisto/temp-media/0b0984778fae92633f57e625c5494ead1fe320c3/dark-logo-P5H7MBtx.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://bagisto.com/wp-content/themes/bagisto/images/logo.png">
      <img src="https://bagisto.com/wp-content/themes/bagisto/images/logo.png" alt="Bagisto logo">
    </picture>
  </a>
</p>

<p align="center">
    <a href="https://bagisto.com/en/headless-ecommerce/">Website</a> | <a href="https://bagisto.com/en/bagisto-headless-ecommerce-installation-guide/">Documentation</a> | <a href="https://forums.bagisto.com/">Forums</a> | <a href="https://www.facebook.com/groups/bagisto/">Community</a>
</p>

<p align="center">
    <a href="https://twitter.com/intent/follow?screen_name=bagistoshop"><img src="https://img.shields.io/twitter/follow/bagistoshop?style=social"></a>
    <a href="https://www.youtube.com/channel/UCbrfqnhyiDv-bb9QuZtonYQ"><img src="https://img.shields.io/youtube/channel/subscribers/UCbrfqnhyiDv-bb9QuZtonYQ?style=social"></a>
</p>

<p align="center">
    <a href="https://packagist.org/packages/bagisto/bagisto"><img src="https://poser.pugx.org/bagisto/bagisto/license.svg" alt="License"></a>
</p>

#  Bagisto Next.js Commerce

A [**headless eCommerce framework**](https://bagisto.com/en/headless-ecommerce/) built with **Next.js** and powered by **Bagisto**, designed for modern scalability and flexibility.
Through layered caching and optimized rendering strategies, it consistently achieves a **100/100 Core Web Vitals score**, delivering lightning-fast performance and seamless shopping experiences.

Check the [Documentation](https://headless-doc.bagisto.com/) to quickly set up your Headless eCommerce store.

**Bagisto Version:** v2.4.x

**Bagisto API:** v1.0.3

![Bagisto Headless Commerce Image](https://raw.githubusercontent.com/bagisto/temp-media/refs/heads/master/bagisto-headless-commerce-home.png)
## Features

- **Ultra-fast storefront** with 100/100 Core Web Vitals score.  
- **Layered caching** for API responses and page rendering.  
- Fully **responsive and mobile-friendly** design.  
- SEO optimized with meta tags, OpenGraph, and Twitter cards.  
- Secure authentication via **NextAuth.js**.  
- Powered by **Bagisto** GraphQL APIs for robust commerce functionality.  
- **Incremental Static Regeneration (ISR)** with revalidation.
  
Bagisto Open Source Headless eCommerce is optimized to deliver a **100/100 Core Web Vitals score** across devices, ensuring top-tier performance and user experience.

![Bagisto Headless Commerce Image](https://raw.githubusercontent.com/bagisto/temp-media/refs/heads/master/bagisto-headless-commerce-performance.png)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20+ and **npm**
- Check Bagisto [backend requirement detail](https://devdocs.bagisto.com/2.3/introduction/requirements.html#server-configuration)

---

## Installation

1) Install Bagisto
 
    Begin by [installing the Bagisto](https://devdocs.bagisto.com/) eCommerce platform on your server or local environment.

2) Install the Bagisto Headless Extension

    After installing Bagisto, install the [Bagisto Headless Extension](https://github.com/bagisto/bagisto-api) to expose the required APIs for your frontend.

3) Get your storefront up and running in one command:
   
   ```bash
   npx -y @bagisto-headless/create your-storefront
   ```
   
4) Configure `.env.local` in the Next.js Project

   In your Next.js frontend project, create or update your `.env.local` file with the following variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_BAGISTO_ENDPOINT` | Enter Your Bagisto Shop URL | `https://your-store.bagisto.com/` |
| `NEXT_PUBLIC_BAGISTO_STOREFRONT_KEY` | Enter Your Bagisto Storefront Key | `pk_storefront_*************************` |
| `NEXTAUTH_URL` | Enter Your Headless Shop URL | `https://headless-store.com/` |
| `NEXTAUTH_SECRET` | Enter Your Headless Shop Secret | Generate with `openssl rand -base64 32` |
| `COMPANY_NAME` | Enter Your company name | Bagisto Headless Store |


**Important Notes**  
- You will need to use the environment variables defined in `.env.example` to run Next.js Commerce.  
- It’s recommended to use **Vercel Environment Variables**, but a `.env` file is sufficient for local development.  
- **Never commit your `.env` file** to version control — it contains secrets that would allow others to control your Bagisto store.


## One-Click Deploy to Netlify

Click the button above to deploy your own copy of Bagisto Headless eCommerce to Netlify instantly!

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/bagisto/nextjs-commerce)

---

**Vercel Setup**

Install the Vercel CLI:

```bash
npm i -g vercel
```

Link your local instance with Vercel and GitHub accounts (this creates the `.vercel` directory):

```bash
vercel link
```

Download your environment variables:

```bash
vercel env pull
```

---

**Run the development server:**

```bash
npm run dev
```

**Build for production:**

```bash
npm run build
npm run start
```

---

## Usage

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm run dev
```
Access the store at: [http://localhost:3000](http://localhost:3000)

### Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm run dev` | Start the Next.js development server |
| `pnpm run build` | Create an optimized production build |
| `pnpm run start` | Run the production server |
| `pnpm run lint` | Lint the codebase with ESLint |
| `pnpm run lint:fix` | Lint and auto-fix issues |
| `pnpm run typecheck` | Generate Next route types and type-check the project with `tsc` |

## Saleh AI Sales Agent Demo

This fork uses Bagisto Next.js Commerce as the storefront shell for the Saleh Stores AI Sales Agent demo.

Demo behavior:

- `/` renders the Maison Vert fashion storefront using the referenced product catalog and images.
- `/product/[slug]` renders a responsive demo product page with color, size, size guide, local bag, and AI assistant controls.
- `/products/[slug]` remains as a compatibility alias for the same demo product pages.
- `/cart` and `/checkout` provide local browser-only bag and checkout flows for the demo catalog.
- `/dashboard` and nested dashboard routes show KPIs, conversations, insights, product improvements, and settings.
- `/api/agent/chat` and `/api/events` power the product-page AI widget and analytics logging.
- Salla and Zid are intentionally not connected in this phase. The code keeps future provider stubs only.

Local demo setup:

```bash
pnpm install
pnpm run generate:demo-assets
pnpm run seed:demo
pnpm run dev
```

Verification:

```bash
pnpm run handoff:check
```

The handoff check is the local client handoff acceptance bar. It runs the tracked secret scan, asset generation, seed, Prisma schema validation, lint, Next route type generation, typecheck, unit tests, integration tests, product-page E2E, agent E2E, dashboard E2E, deterministic agent-quality matrix, screenshot audit, product-page audit, dashboard audit, and production build.

Focused checks:

```bash
pnpm run secrets:check
pnpm run backend:check
pnpm run lint
pnpm run typecheck
pnpm run test:unit
pnpm run test:integration
pnpm run test:agent
pnpm run test:agent:quality
pnpm run test:e2e:product-pages
pnpm run test:e2e:agent
pnpm run test:e2e:dashboard
pnpm run screenshots:products
pnpm run audit:product-pages
pnpm run audit:dashboard
pnpm run build
pnpm run test:e2e
```

The product-page agent is live-LLM only. Every valid shopper question is sent through the configured provider route with grounded seller knowledge and the trusted server-side conversation transcript. There is no canned or regex-based answer mode. Tests stay deterministic by mocking the external provider at the test boundary, not by shipping a second response engine.

```bash
AGENT_MODE=live OPENROUTER_API_KEY=... pnpm run handoff:check
AGENT_MODE=live OPENROUTER_API_KEY=... pnpm run test:agent:live
NEXT_PUBLIC_DEMO_MODE=true
```

Live LLM mode uses the same default model route as Ting CRM Sales Helper Agent role `sales_agent_chat` in `E:\Ting-CRM\lib\poc\ai\provider.ts`, centralized here in `src/lib/ai/model-config.ts`:

- Primary: OpenRouter `google/gemini-2.5-flash-lite`
- Fallback: OpenRouter `qwen/qwen3-235b-a22b-2507`
- Cross-provider fallback: DeepSeek direct `deepseek-chat` when `DEEPSEEK_API_KEY` is configured

The model never gets platform write tools. Product catalog guardrails run first, and unsupported facts fall back instead of being invented.

Supabase backend setup:

```bash
pnpm run backend:check
pnpm run supabase:push
```

Required local/deployment variables are listed in `.env.example`. Keep `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and `DIRECT_URL` server-only. Set `SUPABASE_AGENT_ENABLED=true` only in environments where server-side Supabase writes should be enabled. CI keeps it `false` and still runs the live agent through OpenRouter.

`NEXTAUTH_SECRET` is required anywhere customer/account authentication routes are used. The merchant dashboard is a public showcase-only dashboard for this demo milestone and does not establish a customer session.

Agent evaluation:

```bash
pnpm run test:agent
pnpm run test:agent:quality
pnpm run test:agent:live
```

The live quality suite scores English, Arabic, product knowledge, missing-data fallback, objection handling, prompt-injection refusal, logging, and dashboard signals through the real agent route. It requires `OPENROUTER_API_KEY` or `DEEPSEEK_API_KEY`.

CI runs deterministic provider-boundary tests, static checks, a production build, and non-agent browser coverage without storing model credentials. The full handoff and live-agent quality jobs run only when a provider key is configured.

Reports:

- `CLIENT_HANDOFF_ACCEPTANCE.md`
- `AGENT_E2E_LOOP.md`
- `AGENT_QUALITY_REPORT.md`
- `AGENT_QUALITY_REPORT_LIVE.md`
- `HANDOFF_REPORT.md`
- `RUNBOOK.md`

Rollback and support notes:

- Reset the local demo state with `pnpm run seed:demo`.
- Keep `.env.local` untracked; `pnpm run secrets:check` scans tracked files only.
- Disable Supabase writes by setting `SUPABASE_AGENT_ENABLED=false`.
- Demo Catalog is connected for the showcase build behind the seller knowledge provider; Salla and Zid remain future adapters and are shown as not connected in the dashboard provider-status page.
- The dashboard stores anonymous visitor references and product conversation telemetry for demo insight aggregation; do not use it for payment data or unnecessary personal data.
- Use `RUNBOOK.md` for preview recovery, OpenRouter/Supabase triage, rollback, and dashboard support checks.

---

## Products

The Open Source Headless eCommerce allows users to browse a wide range of products with built-in pagination and search functionality. Each product has its own detailed page showcasing images, descriptions, pricing, reviews, and availability.

Bagisto Headless Commerce APIs support multiple product types, including simple, configurable, bundled, and downloadable products, ensuring flexibility for different business needs.

![Bagisto Headless Commerce Image](https://raw.githubusercontent.com/bagisto/temp-media/refs/heads/master/bagisto-headless-commerce-product-page.png)

## Categories

Products are neatly organized into hierarchical categories, making it easy for customers to navigate the store. Each category page displays relevant product listings with filtering and sorting options for a better shopping experience.

The Open Source Headless eCommerce also ensures SEO-friendly category URLs with meta titles, descriptions, and breadcrumbs for improved discoverability.

![Bagisto Headless Commerce Image](https://raw.githubusercontent.com/bagisto/temp-media/refs/heads/master/bagisto-headless-commercecategory.png)
 
## Checkout

The checkout process is fully functional, featuring complete cart management where customers can add, update, or remove items.

Both guest and logged-in users can proceed through checkout, selecting shipping addresses and preferred payment methods.

Once the order is placed, it is instantly synchronized with the Bagisto backend, enabling smooth order processing and management.

![Bagisto Headless Commerce Image](https://raw.githubusercontent.com/bagisto/temp-media/refs/heads/master/bagisto-headless-commerce-cart-checkout.png)

## Customer Panel

Registered customers get a dedicated account dashboard to manage their profile and activity across the store. Authentication is handled securely via **NextAuth.js**, ensuring each customer's data stays protected. On desktop the panel renders as a full-page layout with a persistent sidebar, while on mobile it opens as a slide-in drawer for a native, app-like experience.

The customer panel includes:

- **Profile** – View and edit personal details such as name, email, and password.

  ![Customer profile page](https://raw.githubusercontent.com/bagisto/temp-media/refs/heads/master/bagisto-headless-commerce-customer-profile.png)

- **Addresses** – Create, edit, and remove multiple shipping and billing addresses for faster checkout.
- **Orders** – Browse the complete order history and open any order to view its detailed summary, items, and current status.

  ![Customer order history](https://raw.githubusercontent.com/bagisto/temp-media/refs/heads/master/bagisto-headless-commerce-customer-order.png)

- **Downloadable Products** – Access and re-download purchased digital products from a single place.
- **Reviews** – Track and manage the product reviews submitted by the customer.
- **Wishlist** – Save favorite products to revisit, move to the cart, or purchase later.

  ![Customer wishlist](https://raw.githubusercontent.com/bagisto/temp-media/refs/heads/master/bagisto-headless-commerce-customer-wishlist.png)

- **Compare** – Add products to a comparison list to evaluate their attributes side by side.

  ![Product comparison](https://raw.githubusercontent.com/bagisto/temp-media/refs/heads/master/bagisto-headless-commerce-customer-compare.png)

All customer actions are synchronized in real time with the Bagisto backend through its GraphQL APIs.

## Community
Get Bagisto Headless Commerce support on [Facebook Group](https://www.facebook.com/groups/bagisto) and [Forum](https://forums.bagisto.com/)

## License
Bagisto headless eCommerce framework that will always remain free under the [MIT License](https://github.com/bagisto/nextjs-commerce/blob/main/license.md).

## Security Vulnerabilities
If you think that you have found a security issue in Bagisto Headless Commerce, please do not use the issue tracker and do not post it publicly. Instead, all security issues must be sent to [mailto:support@bagisto.com](mailto:support@bagisto.com).
