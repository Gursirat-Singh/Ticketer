# Learning guide: system design through this project

This build implements a working answer to the core problem (never sell a seat twice) plus the surrounding production concerns. Use it as a map of where each idea lives, and as a lab: break things on purpose and watch the tests catch it.

## Where each concept lives

| Concept | Where to read | What to notice |
|---|---|---|
| Atomic conditional update (the lock) | `server/services/seatHold.service.js` `holdSeats` | One `updateMany` whose filter is the lock condition. MongoDB applies it atomically per document, so of N racers exactly one matches |
| All-or-nothing multi-seat holds | same file | Each hold has a unique `holdId`. If fewer seats matched than requested, release the ones you got by `holdId` |
| Hold expiry, two layers | `holdSeats` filter + `sweepExpiredHolds` | Lazy: an expired `HELD` seat is claimable immediately. Eager: a sweeper cleans up and notifies clients. Never rely on a timer alone |
| Unique index as a safety net | `models/ShowSeat.js` | `(showId, seatId)` unique: even a bug cannot create a duplicate seat record |
| Server-side pricing | `services/pricing.service.js`, `createBooking` | The client sends seat ids only. Totals come from the database |
| State machine | `models/Booking.js`, `services/booking.service.js` | Transitions use `findOneAndUpdate` with the expected current status, so two requests cannot both win a transition |
| Idempotency | `createBooking` (key + unique indexes), `confirmBooking`, `WebhookEvent` | Retried requests return the same result instead of creating duplicates |
| Payment verification | `services/providers/*`, `payment.controller.js` | HMAC signature with constant-time comparison. Webhooks verify the raw bytes (note the route is mounted before `express.json()` in `app.js`) |
| Race: verify vs webhook | `confirmBooking` + test "confirms once when verify and webhook arrive at the same moment" | The `CONFIRMING` state is a mutex built from a single atomic update |
| Late payment recovery and refunds | `confirmBooking`, `failAndRefund` | Money is never left in limbo: confirm if the seats are still free, otherwise refund automatically |
| Real-time fan-out | `sockets/index.js`, `pages/SeatSelection.jsx` | Rooms per show. Clients re-sync on reconnect because events can be missed |
| Background work | `services/jobs.js` | Retry with exponential backoff. Replace with BullMQ/SQS to survive restarts |
| Security | `middleware/security.js`, `app.js` | Rate limits, helmet, NoSQL sanitising, Zod validation, origin check for cookie auth, ownership checks, tokens revoked by `tokenVersion` |

## Exercises

1. **Watch it break.** In `holdSeats`, delete the `$or: [...]` condition from the filter and run `npm test -- booking -t "50 simultaneous"` in `server/`. With the condition removed, dozens of the 50 users "win" the same seat in a run (27 did when this build was checked). Put it back and it returns to exactly 1. This is the best five-minute lesson in the project.
2. **Compare locking strategies.** The project uses an atomic conditional update. Implement the other approaches on a branch and run the same concurrency test against each: optimistic locking (a `version` field, retry on conflict), a MongoDB transaction around the hold, and a Redis `SET key NX EX 300` hold with MongoDB as the final authority. Write down retry rates, latency, and failure modes.
3. **Kill things mid-flight.** Stop the server between `create-order` and `verify`, then replay the webhook with `curl`. Replay it twice. Check there is one booking and one payment.
4. **Expire on purpose.** Set `SEAT_HOLD_SECONDS=20`, hold seats, wait, and watch another browser's seat map free them live. Then pay late with the checkout page still open (the confirm path accepts it if the seats are still free).
5. **Load test.** Point k6 (or autocannon) at `GET /api/shows/:id/seats` and `POST /api/seat-locks`. Record p95 latency. Find the first bottleneck (usually `getSeatMap` or the per-request user lookup in `middleware/auth.js`) and fix it.

## What is deliberately not here (your next phases)

| Roadmap phase | To add |
|---|---|
| Caching | Cache movie lists and showtimes in Redis (cache-aside, TTL with jitter). Do not cache seat availability as the source of truth |
| Async | Move email and PDF generation to BullMQ with a dead-letter queue. Add an outbox so the DB write and the event publish stay consistent |
| Scaling | Run several API instances behind Nginx or an ALB. Add the Socket.IO Redis adapter. Run the sweeper as a single worker. Add MongoDB read replicas |
| Observability | Structured logs with request ids, metrics, health and readiness checks, alerts on refund failures and webhook errors |
| Advanced | Waiting room for blockbuster openings, search with OpenSearch, splitting Catalog / Booking / Payment into services |

Each phase has a natural seam in the code (see the "Notes" at the bottom of `README.md`), so you can add it without rewriting what exists.

## Interview-style questions this code can answer

* How do you prevent two users booking the same seat? (atomic conditional update, unique index, tests)
* What happens if payment succeeds after the seat hold expired? (late payment recovery or automatic refund)
* How do you make payment webhooks safe? (signature on raw bytes, event-id de-duplication, idempotent confirm, retry on unexpected failure)
* Why not trust the client for price or seat availability? (server recomputes, signature verification)
* How would you scale this to many instances? (see the table above)
