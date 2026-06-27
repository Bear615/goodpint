# GoodPint

GoodPint is an Android-first Expo app for bar discovery, loyalty points, QR redemption, wallet passes, prepaid drinks, and group trip planning.

## What is included

- Expo + React Native mobile app in `apps/mobile`
- Local Express API in `packages/api`
- Dark GoodPint visual system inspired by the supplied flow
- Explore, Points, Redeem QR, Plan, Buy a Drink, Wallet, and Profile screens
- Interactive wallet top-ups, drink ordering, point earning, check-ins, and QR redemption state
- Typed seed data for venues, drinks, rewards, passes, trips, and transactions

## Run it

Install dependencies from the project root and each package if needed:

```powershell
npm install
npm --prefix apps/mobile install
npm --prefix packages/api install
```

Start the API and Expo together:

```powershell
npm run dev
```

For Android:

```powershell
npm run android
```

For a browser preview:

```powershell
npm run dev:web
```

The API runs on `http://localhost:4000`. Android emulators use `http://10.0.2.2:4000` by default. For a physical Android device on the same network, set:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL="http://YOUR-LAN-IP:4000"
npm run android
```

## Validate

```powershell
npm run typecheck
npm run build:api
```

Useful API routes:

- `GET /health`
- `GET /api/app-state`
- `GET /api/venues`
- `GET /api/rewards`
- `POST /api/orders`
- `POST /api/redeem`
- `POST /api/wallet/top-up`
- `POST /api/check-ins`
