# Marquee: Cinema Hall Ticket Booking System

A full-stack booking platform: browse movies, pick exact seats on a live seat map, pay (test mode), and get a QR ticket by email and PDF. Customers and admins each have their own interface.

**Stack:** React 18 (Vite, JavaScript) + Tailwind CSS + React Router + Axios + Context API, Node.js + Express, MongoDB + Mongoose, Socket.IO, JWT (httpOnly cookies) + bcrypt, Zod validation, Razorpay (or a built-in mock gateway), QRCode, PDFKit, Nodemailer.

---

## Quick start

You need **Node 18.18+** and **MongoDB** (local install, Atlas, or `docker compose up -d` using the included file).

```bash
npm install                      # root: installs the "run both" helper
npm run setup                    # installs server and client dependencies
cp server/.env.example server/.env
npm run seed                     # demo data: movies, cinemas, screens, shows, two users
npm run dev                      # API on :5000, web app on :5173
```

Open **http://localhost:5173**.

| Account  | Email              | Password    |
|----------|--------------------|-------------|
| Customer | user@cinema.test   | User@1234   |
| Admin    | admin@cinema.test  | Admin@1234  |

Payments default to a **mock gateway** that needs no keys, so the whole flow works immediately. Confirmation emails are printed to the server log until you configure SMTP.

Prefer two terminals? `cd server && npm run dev` and `cd client && npm run dev`.

> `npm run seed` wipes the configured database first. Shows are created for the next 5 days at 10:00, 14:00 and 18:30 server-local time; slots already in the past are skipped.

---

## Try the interesting part

With the API running and seeded:

```bash
cd server && npm run smoke
```

It walks the whole booking flow, tries a forged payment signature, cancels for a refund, then has 12 different users grab **the same seat at the same instant**. Exactly one wins. Open a seat page in two browsers (as two different users) to watch holds appear live.

---

## Scripts

| Where | Command | What it does |
|---|---|---|
| root | `npm run dev` | API + web app together |
| root | `npm test` | server and client test suites |
| root | `npm run build` | production build of the client into `client/dist` |
| server | `npm run seed` | reset and fill the database with demo data |
| server | `npm run smoke` | end-to-end check against a running server |
| server | `npm test` | 51 tests (API, concurrency, payments, sockets) |
| client | `npm test` | component and utility tests |

**Server tests** use `MONGO_URI_TEST` if set (for example `mongodb://127.0.0.1:27017`), otherwise they download and start an in-memory MongoDB the first time (needs internet). Each test file uses its own throwaway database.

---

## Configuration (`server/.env`)

See `server/.env.example`, every variable is commented. The important ones:

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `CLIENT_URL` | Allowed browser origin(s), used for CORS and the CSRF origin check |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | **Must** be long random strings in production (the server refuses to start otherwise) |
| `SEAT_HOLD_SECONDS` | How long a seat hold lasts (default 300 = 5 minutes) |
| `CONVENIENCE_FEE_PER_TICKET`, `TAX_PERCENT` | Pricing rules. Money is stored in **paise** (INR x 100) as integers |
| `CANCEL_CUTOFF_HOURS` | Customers can cancel until this many hours before the show |
| `PAYMENT_PROVIDER` | `mock` (default) or `razorpay` |
| `SMTP_*` | Real email. Without `SMTP_HOST`, emails are logged instead of sent |

`client/.env.example` is only needed if the API is hosted on a different origin.

### Using Razorpay test mode

1. Create test keys in the Razorpay dashboard and set `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
2. For webhooks (recommended: it rescues payments when a customer closes the tab after paying), expose the server (for example with a tunnel), add a webhook for `payment.captured` and `payment.failed` pointing to `https://<your-host>/api/payments/webhook`, and set `RAZORPAY_WEBHOOK_SECRET` to the secret you chose.
3. Use Razorpay's published test card/UPI details in the checkout popup.

The Razorpay integration follows the official order → checkout → signature-verify flow, and shares one code path with the mock gateway (the mock signs orders and webhooks with the same HMAC scheme). It has not been exercised against Razorpay's live test environment in this build, so do a test payment before relying on it.

---

## How booking works

1. Seat map loads from the database (`ShowSeat` documents: `AVAILABLE`, `HELD` or `BOOKED`).
2. **Continue** calls `POST /api/seat-locks`: one atomic `updateMany` flips the chosen seats to `HELD` for 5 minutes. If any seat was taken in the meantime, the seats already won are given back and the request fails with the list of unavailable seats (all or nothing).
3. `POST /api/bookings` turns the hold into a `PENDING_PAYMENT` booking. **Prices are always recomputed on the server** from the seat records.
4. `POST /api/payments/create-order` creates (or reuses) the gateway order for the server-computed amount.
5. After paying, the browser sends the gateway's payment id and signature to `POST /api/payments/verify`. Only a valid HMAC signature can confirm a booking.
6. Confirmation flips the booking to `CONFIRMED` through an atomic status guard, marks the seats `BOOKED`, generates the QR code, and queues the confirmation email (PDF attached).
7. The gateway webhook can arrive first, last or twice: confirmation is idempotent, so the booking is confirmed exactly once.
8. If payment fails, the hold expires, or the show is cancelled, seats are released (a sweeper runs every 10 seconds and Socket.IO tells every open seat map).

Edge cases that are handled and tested: 50 simultaneous requests for one seat; overlapping multi-seat requests; a late payment after the hold expired (confirmed if the seats are still free, refunded automatically if someone else took them); duplicate and forged webhooks; verify and webhook racing each other; cancellation inside the cutoff window; cancelling a show refunds all its bookings.

---

## Project structure

```
client/
  src/
    components/   Navbar, SeatMap, MovieCard, Modal, ShowtimeList, admin/ResourceManager ...
    pages/        Home, Movies, MovieDetails, ShowSelection, SeatSelection, Checkout,
                  BookingConfirmation, Profile, Cinemas, AuthPages, admin/*
    layouts/      MainLayout, AdminLayout
    context/      AuthContext, ToastContext
    hooks/        useAsync, useCountdown, useDebounce
    services/     api (axios + token refresh), endpoints, socket
    utils/        format, poster, constants
server/
  config/         env, db
  models/         User, Movie, Cinema, Screen, Show, ShowSeat, Booking, Payment, WebhookEvent
  controllers/    thin HTTP handlers
  services/       seatHold, booking, payment, show, pricing, email, ticket, jobs, providers/
  middleware/     auth, validate, security (rate limit, CSRF origin guard), errorHandler
  routes/  validators/  sockets/  utils/  scripts/ (seed, smoke)  tests/
docs/
  API.md          every endpoint
  LEARNING-GUIDE.md   system design concepts and exercises, mapped to this code
```

---

## Notes on the data model

Two models from the original brief are folded into others on purpose:

* **Seat** lives inside `Screen.seats[]`: a layout never changes per show.
* **SeatLock** is `ShowSeat.status = HELD` plus `holdId` and `holdExpiresAt`. One document per seat per show with a unique `(showId, seatId)` index gives you a single source of truth and an atomic place to lock, so no cross-collection coordination is needed.

Other deliberate choices: `bcryptjs` (pure JavaScript, same algorithm as `bcrypt`, no native build step); MongoDB transactions are not required because every critical step is a single-document or conditional atomic update (so a standalone `mongod` works).

## Known limitations

* Built and verified with API/integration tests, a live end-to-end run, component tests and a production build. **The UI has not been looked at in a real browser by the author of this build**, so expect to polish spacing or small visual details.
* One server process: the sweeper, Socket.IO rooms and background email jobs are in-process. To scale out, use the Socket.IO Redis adapter, a Redis lock or queue (BullMQ), and run the sweeper in a single worker. The call sites are isolated (`sockets/`, `services/jobs.js`, `services/seatHold.service.js`) so this is a small change.
* Auth reads the user from MongoDB on each request (so logout and password changes revoke tokens immediately). A cache would remove that query at high load.
* Seat-hold countdowns use the browser clock; the server remains the authority on expiry.
* Admin tables load up to 100-200 rows; add server-side pagination if you need more.
* Refunds are for the full amount including fees.
