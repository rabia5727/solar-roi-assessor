# ☀ Solar ROI Assessor

**Turn NASA satellite data into a solar sales report for any location in Pakistan.**

Enter a location (or snap an electricity bill) and get:

- **The right system size**: chosen by maximising 25-year value, not just "match the bill"
- **A roof panel layout**: rows spaced so the winter sun never shades the row behind
- **Three options side by side**: On-grid vs Hybrid vs Full backup, each with cost, bill reduction, payback, NPV, IRR and load-shedding backup hours
- **Savings under NEPRA's 2026 net billing**: exported units earn ~Rs 8, imported units cost the full tariff
- **Brand comparison**: panels (JA, Jinko, LONGi, Canadian, Trina, Astronergy), inverters (Growatt, Inverex, GoodWe, Solis, Huawei) and lithium batteries (Pylontech, Dyness, Inverex, GoodWe), with current Pakistan prices. Each brand runs through the full 25-year calculation and the best value is recommended.
- **A consultant summary in English or Urdu**, written by AI from the calculated figures only
- **A branded A4 PDF report** and a **WhatsApp share link** for installers

## How it works

```
Location ─► NASA POWER API ─► Calculation engine ─► AI summary ─► Dashboard + PDF
            (sun + temperature)  (pure formulas)      (explains, never computes)
```

1. **NASA POWER** (`/api/solar`): long-term monthly average sunlight (`ALLSKY_SFC_SW_DWN`) and temperature (`T2M`, `T2M_MAX`) for the exact coordinates. Free, no API key.
2. **Tilt conversion** (`src/lib/solar.ts`): NASA measures sunlight on flat ground. A Liu–Jordan isotropic-sky model converts it to what a south-facing panel tilted at ~latitude actually receives (+40% in winter months).
3. **Losses**: heat loss (−0.34%/°C above 25 °C cell temperature, often −10% in a Pakistani June), dust/smog, inverter, wiring, mismatch.
4. **Energy balance**, month by month for 25 years: self-consumed solar, battery-shifted solar, exports at the buyback rate, remaining grid imports. Includes panel degradation, tariff escalation, maintenance, and inverter and battery replacements.
5. **Finance**: cumulative cash flow, payback, NPV, IRR, CO₂ avoided.
6. **AI** (Gemini): reads bill photos (units, rate, sanctioned load, 12-month history) and writes the summary. **All numbers come from the engine.** The AI is only given pre-calculated facts.

## Prices: automatic + admin (hybrid)

Equipment prices come from three layers, highest priority first:

1. **Admin price**: set in the password-protected admin panel at `/admin`. Always wins.
2. **Live price**: a daily check reads Pakistani dealer price lists (solarrate.pk, jbmssolar.pk, alphasolar.com.pk), takes the median per brand, and rejects anything outside sane limits or more than 35% away from the current price. Used while under 21 days old.
3. **Default**: the built-in catalogue in `src/lib/equipment.ts`, so the app never breaks.

Panel and battery prices are checked automatically. Inverter prices, the NEPRA export rate and installation cost are set in `/admin`, because they vary too much by model or change only with regulation. Every report shows where each price came from ("live market price", "set by admin" or "typical price").

The daily check runs automatically when prices are over a day old. It also runs from the "Run price check now" button in `/admin`, and on Vercel via the schedule in `vercel.json`. To add a price website, add it to `SOURCES` in `src/lib/scraper.ts`.

## Run it

```bash
npm install
cp .env.example .env.local     # then set ADMIN_PASSWORD (and a Gemini key, optional)
npm run dev                    # http://localhost:3000
```

On Windows PowerShell, use `copy .env.example .env.local`.

Get a free Gemini key at https://aistudio.google.com/apikey. Without a key, the app still works: bill reading is turned off and the summary uses a built-in English/Urdu template.

## Deploy

Push to GitHub and import into [Vercel](https://vercel.com). Under Environment Variables add `GEMINI_API_KEY`, `ADMIN_PASSWORD` and `CRON_SECRET`. Then connect a free Upstash Redis database (Vercel → Storage), which adds `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, so admin changes and live prices are saved.

## Tech

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Recharts · React-Leaflet / OpenStreetMap · Gemini API · NASA POWER API

Report links encode the inputs in the URL, so sharing needs no database.

## Project structure

```
src/
  app/
    page.tsx              input form + live dashboard
    report/page.tsx       printable / shareable report
    api/solar/            NASA POWER fetch (cached 30 days)
    api/parse-bill/       AI bill reader (image or PDF)
    api/summary/          AI consultant summary (EN / UR)
  lib/
    calc.ts               calculation engine + assumptions
    solar.ts              solar geometry (tilt transposition)
    summary.ts            AI prompt + template fallback
  components/             form, map, charts, roof layout, report
```

## Limitations

This is a **feasibility estimate**, not a bankable engineering study. NASA POWER solar data is on a ~1° grid, and monthly modelling approximates hourly self-consumption. Prices and NEPRA rules change, so all of them are editable under "Prices & assumptions".

## Roadmap

- Payments (Safepay / PayFast) and installer accounts
- DISCO slab-tariff tables
- Hourly simulation using NASA hourly data
- Saved reports and lead tracking for installers
