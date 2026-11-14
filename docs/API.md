# API reference

Base URL: `http://localhost:5000/api` (in development the web app proxies `/api` to it).
Auth is two httpOnly cookies set by login/register (`access_token`, 15 min; `refresh_token`, 7 days). `Authorization: Bearer <access token>` also works for scripts.
Errors look like `{ "message": "...", "errors": [{ "field", "message" }], "details": {...} }`. Money is always an integer in **paise**.
State-changing requests from a browser must come from an origin listed in `CLIENT_URL`.

Legend: 🔓 public, 👤 logged in, 🛡 admin.

## Auth
| Method | Path | Access | Body / notes |
|---|---|---|---|
| POST | `/auth/register` | 🔓 | `name, email, password (8+, letter+number), phone?`. Always creates a customer. |
| POST | `/auth/login` | 🔓 | `email, password` |
| POST | `/auth/logout` | 🔓 | Revokes all tokens for the user |
| POST | `/auth/refresh` | cookie | Issues a new access token from the refresh cookie |
| GET | `/auth/me` | 👤 | Current user |
| PUT | `/auth/profile` | 👤 | `name?, phone?` |
| PUT | `/auth/password` | 👤 | `currentPassword, newPassword` (logs out other devices) |

## Movies
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/movies` | 🔓 | Query: `q, genre, language, status (now_showing, upcoming, archived, all), minRating, featured, sort (newest, rating, title), page, limit`. Default excludes archived. |
| GET | `/movies/:id` | 🔓 | |
| POST | `/movies` | 🛡 | `title, language, durationMin, releaseDate` + optional `description, genres[], poster, banner, trailerUrl, cast[], crew[], rating, certification (U/UA/A/S), status, featured` |
| PUT | `/movies/:id` | 🛡 | Any of the above |
| DELETE | `/movies/:id` | 🛡 | 409 if the movie has shows |

## Cinemas and screens
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/cinemas` | 🔓 | Query `city`. Response includes `cities[]` |
| GET | `/cinemas/:id` | 🔓 | With its screens |
| POST / PUT / DELETE | `/cinemas[/:id]` | 🛡 | `name, city, location?, address?`. Delete blocked while screens exist |
| GET | `/screens`, `/screens/:id` | 🛡 | `?cinemaId=`. The detail view includes the generated `seats[]` |
| POST | `/screens` | 🛡 | `cinemaId, name, numRows (1-26), seatsPerRow, aisleAfter?, goldRows?, premiumRows?`. Seats are generated; premium rows are at the back, gold in front of them, regular at the front |
| PUT / DELETE | `/screens/:id` | 🛡 | Layout cannot change, and screens cannot be deleted, while shows exist |

## Shows and seats
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/shows` | 🔓 | Query: `movieId, cinemaId, city, from, to (ISO), page, limit`. Customers see only upcoming, scheduled shows. Admins can add `all=true`. Each show includes `availableSeats` and `totalSeats` |
| GET | `/shows/:id` | 🔓 | |
| GET | `/shows/:id/seats` | 🔓 | Seat map. When logged in, seats you hold have `mine: true`. Expired holds are reported as available |
| POST | `/shows` | 🛡 | `movieId, screenId, startTime, priceByCategory {REGULAR, GOLD, PREMIUM}` (paise). 409 if it overlaps another show on that screen |
| PUT | `/shows/:id` | 🛡 | `priceByCategory?` (applies to seats not yet booked), `status?` (`CANCELLED` refunds every confirmed booking) |
| DELETE | `/shows/:id` | 🛡 | 409 if the show has bookings |

## Seat locks
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/seat-locks` | 👤 | `{ showId, seatIds: ["A1","A2"] }` (max 10). 201 → `{ lock: { lockId, seatIds, expiresAt } }`. 409 → `details.unavailable` lists the seats that were taken, nothing is held |
| DELETE | `/seat-locks/:lockId` | 👤 | Releases your own hold |

## Bookings
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/bookings` | 👤 | `{ lockId, idempotencyKey? }`. Totals are computed server-side. 410 if the hold expired |
| GET | `/bookings/my-bookings` | 👤 | `?bucket=upcoming|past|cancelled` |
| GET | `/bookings/:id` | 👤 | Owner or admin only (404 otherwise) |
| GET | `/bookings/:id/ticket` | 👤 | PDF, confirmed bookings only |
| POST | `/bookings/:id/cancel` | 👤 | Customers: until `CANCEL_CUTOFF_HOURS` before the show. Admins: any time. Refunds the payment |

Booking statuses: `PENDING_PAYMENT → CONFIRMING → CONFIRMED`, or `FAILED`, `EXPIRED`, `CANCELLED`. `refundStatus`: `NONE`, `PENDING`, `REFUNDED`.

## Payments
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/payments/create-order` | 👤 | `{ bookingId }` → `{ order: { orderId, amount, currency, provider, keyId? } }`. Reuses an open order |
| POST | `/payments/verify` | 👤 | `{ bookingId, orderId, paymentId, signature }`. Verifies the HMAC signature, then confirms. Idempotent |
| POST | `/payments/fail` | 👤 | `{ bookingId }`. Marks the payment failed and releases the seats |
| POST | `/payments/webhook` | provider | Raw body, signature header (`x-razorpay-signature`, or `x-mock-signature` in mock mode). De-duplicated by event id |
| POST | `/payments/mock/complete` | 👤 | Mock mode only: returns `{ orderId, paymentId, signature }` like a gateway would |
| GET | `/payments/:id` | 👤 | Owner or admin |

## Admin
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/dashboard` | `totalRevenue, totalBookings, totalUsers, totalMovies, activeShows, occupancyPercent` |
| GET | `/admin/analytics` | `revenueByDay` (last 30 days), `popularMovies` (top 5) |
| GET | `/admin/bookings` | `?status=&q=<booking id>&page=&limit=` |
| GET | `/admin/users` | `?q=&page=&limit=` with booking counts and spend |
| GET | `/admin/payments` | `?status=&page=&limit=` |
| POST | `/admin/payments/:id/refund` | Retry a `REFUND_PENDING` refund |

## Real-time (Socket.IO)
Client emits `show:join` / `show:leave` with a show id. Server emits to that room:

```json
seats:update  { "showId": "…", "seatIds": ["A1","A2"], "status": "HELD" | "AVAILABLE" | "BOOKED" }
```
