import { Router } from 'express';
import { authenticate, authorize, optionalAuth, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter, holdLimiter, paymentLimiter } from '../middleware/security.js';
import * as v from '../validators/index.js';
import * as auth from '../controllers/auth.controller.js';
import * as movie from '../controllers/movie.controller.js';
import * as cinema from '../controllers/cinema.controller.js';
import * as screen from '../controllers/screen.controller.js';
import * as show from '../controllers/show.controller.js';
import * as seat from '../controllers/seat.controller.js';
import * as booking from '../controllers/booking.controller.js';
import * as payment from '../controllers/payment.controller.js';
import * as admin from '../controllers/admin.controller.js';

const router = Router();

// ---- Auth ----
router.post('/auth/register', authLimiter, validate({ body: v.registerSchema }), auth.register);
router.post('/auth/login', authLimiter, validate({ body: v.loginSchema }), auth.login);
router.post('/auth/logout', optionalAuth, auth.logout);
router.post('/auth/refresh', auth.refresh);
router.get('/auth/me', authenticate, auth.me);
router.put('/auth/profile', authenticate, validate({ body: v.profileSchema }), auth.updateProfile);
router.put('/auth/password', authenticate, authLimiter, validate({ body: v.passwordSchema }), auth.changePassword);

// ---- Movies ----
router.get('/movies', validate({ query: v.movieListQuery }), movie.listMovies);
router.get('/movies/:id', validate({ params: v.idParams }), movie.getMovie);
router.post('/movies', ...requireAdmin, validate({ body: v.movieSchema }), movie.createMovie);
router.put('/movies/:id', ...requireAdmin, validate({ params: v.idParams, body: v.movieUpdateSchema }), movie.updateMovie);
router.delete('/movies/:id', ...requireAdmin, validate({ params: v.idParams }), movie.deleteMovie);

// ---- Cinemas ----
router.get('/cinemas', validate({ query: v.cinemaListQuery }), cinema.listCinemas);
router.get('/cinemas/:id', validate({ params: v.idParams }), cinema.getCinema);
router.post('/cinemas', ...requireAdmin, validate({ body: v.cinemaSchema }), cinema.createCinema);
router.put('/cinemas/:id', ...requireAdmin, validate({ params: v.idParams, body: v.cinemaUpdateSchema }), cinema.updateCinema);
router.delete('/cinemas/:id', ...requireAdmin, validate({ params: v.idParams }), cinema.deleteCinema);

// ---- Screens (admin) ----
router.get('/screens', ...requireAdmin, validate({ query: v.screenListQuery }), screen.listScreens);
router.get('/screens/:id', ...requireAdmin, validate({ params: v.idParams }), screen.getScreen);
router.post('/screens', ...requireAdmin, validate({ body: v.screenSchema }), screen.createScreen);
router.put('/screens/:id', ...requireAdmin, validate({ params: v.idParams, body: v.screenUpdateSchema }), screen.updateScreen);
router.delete('/screens/:id', ...requireAdmin, validate({ params: v.idParams }), screen.deleteScreen);

// ---- Shows + seats ----
router.get('/shows', optionalAuth, validate({ query: v.showListQuery }), show.listShows);
router.get('/shows/:id', validate({ params: v.idParams }), show.getShow);
router.get('/shows/:id/seats', optionalAuth, validate({ params: v.idParams }), show.showSeats);
router.post('/shows', ...requireAdmin, validate({ body: v.showCreateSchema }), show.createShowHandler);
router.put('/shows/:id', ...requireAdmin, validate({ params: v.idParams, body: v.showUpdateSchema }), show.updateShowHandler);
router.delete('/shows/:id', ...requireAdmin, validate({ params: v.idParams }), show.deleteShowHandler);

router.post('/seat-locks', authenticate, holdLimiter, validate({ body: v.seatLockSchema }), seat.createSeatLock);
router.delete('/seat-locks/:lockId', authenticate, validate({ params: v.lockParams }), seat.deleteSeatLock);

// ---- Bookings ----
router.post('/bookings', authenticate, holdLimiter, validate({ body: v.bookingCreateSchema }), booking.create);
router.get('/bookings/my-bookings', authenticate, validate({ query: v.myBookingsQuery }), booking.myBookings);
router.get('/bookings/:id', authenticate, validate({ params: v.idParams }), booking.getOne);
router.get('/bookings/:id/ticket', authenticate, validate({ params: v.idParams }), booking.ticketPdf);
router.post('/bookings/:id/cancel', authenticate, validate({ params: v.idParams }), booking.cancel);

// ---- Payments (the webhook route is mounted in app.js, before the JSON parser) ----
router.post('/payments/create-order', authenticate, paymentLimiter, validate({ body: v.createOrderSchema }), payment.createOrder);
router.post('/payments/verify', authenticate, paymentLimiter, validate({ body: v.verifyPaymentSchema }), payment.verify);
router.post('/payments/fail', authenticate, paymentLimiter, validate({ body: v.failPaymentSchema }), payment.fail);
router.post('/payments/mock/complete', authenticate, paymentLimiter, validate({ body: v.mockCompleteSchema }), payment.mockComplete);
router.get('/payments/:id', authenticate, validate({ params: v.idParams }), payment.getPayment);

// ---- Admin ----
const adminOnly = [authenticate, authorize('admin')];
router.get('/admin/dashboard', ...adminOnly, admin.dashboard);
router.get('/admin/analytics', ...adminOnly, admin.analytics);
router.get('/admin/bookings', ...adminOnly, validate({ query: v.adminListQuery }), admin.listBookings);
router.get('/admin/users', ...adminOnly, validate({ query: v.adminListQuery }), admin.listUsers);
router.get('/admin/payments', ...adminOnly, validate({ query: v.adminListQuery }), admin.listPayments);
router.post('/admin/payments/:id/refund', ...adminOnly, validate({ params: v.idParams }), admin.refundPayment);

export default router;
