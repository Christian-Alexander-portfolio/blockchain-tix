# Deployment Guide

## Prerequisites
- Railway account + CLI (`railway login`)
- Neon PostgreSQL database (already created)
- Alchemy or QuickNode API key for Polygon
- Braintree sandbox/production account
- Cloudflare R2 bucket
- Resend account for emails
- Google Cloud OAuth app
- EAS account for Expo builds (`eas login`)

---

## Step 1 — Deploy Smart Contracts (Polygon Amoy Testnet)

```bash
cd packages/contracts

# Set up .env
cp .env.example .env
# Fill in: DEPLOYER_PRIVATE_KEY, AMOY_RPC_URL, POLYGONSCAN_API_KEY

# Fund deployer wallet with MATIC (use Polygon faucet for Amoy)
# https://faucet.polygon.technology/

# Deploy
npx hardhat run scripts/deploy.ts --network amoy

# Saves addresses to packages/contracts/deployed-amoy.json
# Copy TICKET_NFT_ADDRESS and TICKET_MARKETPLACE_ADDRESS to Railway env vars
```

---

## Step 2 — Neon Database Migration

```bash
cd apps/api

# Create .env with your Neon DATABASE_URL and DIRECT_URL
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed platform settings (run once)
npx prisma db seed
```

Add to `apps/api/prisma/seed.ts` if missing:
```ts
await prisma.platformSettings.upsert({
  where: { id: 'singleton' },
  update: {},
  create: { id: 'singleton', resaleMarkupMaxBps: 1500, platformFeeBps: 500 },
});
```

---

## Step 3 — Deploy API to Railway

```bash
# Link to Railway project
railway link

# Set environment variables (copy from apps/api/.env.example)
railway variables set DATABASE_URL="..." WALLET_MASTER_KEY="..." # etc.

# Deploy
railway up
```

**Generate secure keys:**
```bash
# 64-char hex = 32 bytes for AES-256-GCM
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Run this twice — once for `WALLET_MASTER_KEY`, once for `QR_MASTER_KEY`.

**Important Railway settings:**
- Root directory: `/` (uses Dockerfile in `apps/api/`)
- Health check path: `/health`
- Add `GET /health` to `apps/api/src/index.ts` if not already present

---

## Step 4 — Build Expo App (EAS)

```bash
cd apps/app

# Configure EAS
eas build:configure

# Set API URL
echo "EXPO_PUBLIC_API_URL=https://your-api.railway.app" > .env

# Build for iOS + Android
eas build --platform all --profile production

# Or for testing (no App Store needed):
eas build --platform all --profile preview
```

**app.json extras to set before building:**
- `ios.bundleIdentifier`: `com.yourname.blockchaintickets`
- `android.package`: `com.yourname.blockchaintickets`
- `ios.usesAppleSignIn`: `true` (already set)
- Braintree URL scheme in `ios.infoPlist.LSApplicationQueriesSchemes`

---

## Step 5 — Mainnet Migration

1. Change `POLYGON_RPC_URL` to mainnet: `https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY`
2. Re-run deploy script with `--network polygon`
3. Update `TICKET_NFT_ADDRESS` and `TICKET_MARKETPLACE_ADDRESS`
4. Change `BRAINTREE_ENVIRONMENT=production`
5. Fund deployer wallet with real MATIC (≈$5 worth covers thousands of transactions)
6. Change `USDC_CONTRACT_ADDRESS` to mainnet USDC: `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`

---

## Quick Security Checklist

- [ ] `WALLET_MASTER_KEY` and `QR_MASTER_KEY` are unique 64-char hex strings, stored only in Railway env vars
- [ ] `DEPLOYER_PRIVATE_KEY` is a dedicated hot wallet, not your personal wallet
- [ ] Neon database IP allowlist restricted to Railway's egress IP range
- [ ] Braintree webhook endpoint `POST /api/payments/braintree-webhook` added to Braintree control panel
- [ ] Rate limiting active on auth routes (already in code)
- [ ] CORS origin set to your app's domain (not `*`)

---

## Local Development

```bash
# Install all deps
pnpm install

# Start local Hardhat node (optional, for contract dev)
cd packages/contracts && npx hardhat node

# Start API
cd apps/api && pnpm dev

# Start Expo app
cd apps/app && pnpm dev
# Scan QR with Expo Go, or press 'w' for web
```
