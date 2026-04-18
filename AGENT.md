# PrintForProfitable - Development Agent Guide

## Project Overview
A self-hosted 3D print pricing calculator that helps print farm owners calculate costs, set profitable prices, and manage their printing business. Hosted on Raspberry Pi via Docker.

## Architecture

### Tech Stack
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript + Prisma ORM
- **Database**: PostgreSQL 16
- **Auth**: Passport.js (Local + Google OAuth + GitHub OAuth)
- **Deployment**: Docker Compose on Raspberry Pi (ARM64)

### Project Structure
```
printForProfitable/
├── frontend/                 # React SPA
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   └── ui/           # Base components (Button, Input, Card)
│   │   ├── contexts/         # React contexts (Auth)
│   │   ├── lib/              # Utilities (api client, cn helper)
│   │   ├── pages/
│   │   │   ├── wizard/       # Setup wizard (4 steps)
│   │   │   └── dashboard/    # Main app with sidebar
│   │   ├── App.tsx           # Router
│   │   └── index.css         # Tailwind theme
│   ├── nginx.conf            # Production proxy config
│   └── Dockerfile
├── backend/
│   ├── src/
│   │   ├── routes/           # API endpoints
│   │   │   ├── auth.ts       # Authentication
│   │   │   ├── wizard.ts     # Setup wizard
│   │   │   ├── farms.ts      # Farm CRUD
│   │   │   └── models.ts     # 3D model management
│   │   ├── middleware/        # Auth middleware
│   │   ├── services/         # Passport config, Prisma client
│   │   └── index.ts          # Express server entry
│   ├── prisma/
│   │   └── schema.prisma     # Database schema
│   └── Dockerfile
├── docker-compose.yml
└── AGENT.md
```

## Database Models

| Model | Purpose |
|-------|---------|
| User | Authentication, profile (supports OAuth + local) |
| Farm | Core entity - electricity rate, labor rate, profit margin |
| TaxRate | Multiple tax rates per farm |
| Printer | 3D printers with brand, model, power consumption |
| Filament | Materials with colors, cost per spool, weight |
| SalesPlatform | Marketplace configs (Etsy, Amazon, Shopify, TikTok, eBay, Custom) |
| ShippingProfile | Shipping cost and delivery estimates |
| Model3D | 3D models with calculated costs and suggested prices |

## Pricing Formula

```
Material Cost = (filament_usage_grams / spool_weight) * cost_per_spool
Electricity Cost = (print_time_hours * printer_watts / 1000) * electricity_rate
Labor Cost = labor_hours * labor_rate
Total Cost = Material + Electricity + Labor
Platform Fees = varies by platform (% of sale + fixed fees)
Tax = Total * sum(tax_rates)
Suggested Price = Total Cost / (1 - target_profit_margin/100) + Platform Fees + Tax
```

## User Flow

1. **Register** → Create account (email or OAuth)
2. **Wizard Step 1** → Farm name, electricity rate, labor rate, tax rates, profit margin
3. **Wizard Step 2** → Add printers and filaments (with color selection)
4. **Wizard Step 3** → Select sales platforms, configure shipping
5. **Wizard Step 4** → Upload first .3mf file or enter model details manually
6. **Dashboard** → View analytics, manage orders, models, equipment, settings

## Design System

- **Primary Color**: #E8622C (orange)
- **Dark Color**: #1a1a2e (navy)
- **Font**: Ubuntu (Google Fonts)
- **Style**: Clean, modern, white cards with subtle borders
- **Layout**: Split layout for wizard (left info, right form), sidebar for dashboard

## Platform Fee Reference

| Platform | Fees |
|----------|------|
| Etsy | Transaction: 6.5% of item + shipping, Payment Processing: 3% + $0.25, Listing: $0.20/unit |
| Amazon | Referral: 15% of order total |
| Shopify | Payment Processing: 2.9% + $0.30 |
| TikTok | Referral: 8%, Payment Processing: 2.9% + $0.30 |
| eBay | Final Value: 13.25% + $0.30 |
| Custom | User-defined |

## Development Commands

```bash
# Local development
cd backend && npm run dev        # API on :3001
cd frontend && npm run dev       # Vite on :5173

# Database
cd backend && npx prisma migrate dev    # Run migrations
cd backend && npx prisma studio         # DB GUI

# Docker (production / Raspberry Pi)
docker compose up -d --build     # Build and start all services
docker compose logs -f           # View logs
docker compose down              # Stop all services
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| DB_USER | No | pfp | PostgreSQL username |
| DB_PASSWORD | Yes | - | PostgreSQL password |
| JWT_SECRET | Yes | - | JWT signing secret |
| SESSION_SECRET | Yes | - | Express session secret |
| GOOGLE_CLIENT_ID | No | - | Google OAuth client ID |
| GOOGLE_CLIENT_SECRET | No | - | Google OAuth client secret |
| GITHUB_CLIENT_ID | No | - | GitHub OAuth client ID |
| GITHUB_CLIENT_SECRET | No | - | GitHub OAuth client secret |

## Raspberry Pi Deployment

1. Install Docker on your Raspberry Pi
2. Clone this repo
3. Copy `.env.example` to `.env` and fill in secrets
4. Run `docker compose up -d --build`
5. Access at `http://<pi-ip-address>`

All Docker images support ARM64 natively (node:20-alpine, postgres:16-alpine, nginx:alpine).

## Future Enhancements

- [ ] .3mf file parser (extract print time, filament usage automatically)
- [ ] Batch pricing for multiple models
- [ ] Order tracking and fulfillment
- [ ] Print queue management
- [ ] Revenue/profit analytics dashboard with charts
- [ ] API integrations with Etsy/Amazon/Shopify
- [ ] Material inventory tracking
- [ ] Multi-currency support
- [ ] Export pricing sheets (PDF/CSV)
