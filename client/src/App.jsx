import { Route, Routes } from 'react-router-dom';
import MainLayout from './layouts/MainLayout.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import Movies from './pages/Movies.jsx';
import MovieDetails from './pages/MovieDetails.jsx';
import ShowSelection from './pages/ShowSelection.jsx';
import SeatSelection from './pages/SeatSelection.jsx';
import Checkout from './pages/Checkout.jsx';
import BookingConfirmation from './pages/BookingConfirmation.jsx';
import Profile from './pages/Profile.jsx';
import Cinemas from './pages/Cinemas.jsx';
import { Login, Register } from './pages/AuthPages.jsx';
import NotFound from './pages/NotFound.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import AdminMovies from './pages/admin/AdminMovies.jsx';
import AdminCinemas from './pages/admin/AdminCinemas.jsx';
import AdminScreens from './pages/admin/AdminScreens.jsx';
import AdminShows from './pages/admin/AdminShows.jsx';
import AdminBookings from './pages/admin/AdminBookings.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminPayments from './pages/admin/AdminPayments.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="movies" element={<Movies />} />
        <Route path="movies/:id" element={<MovieDetails />} />
        <Route path="movies/:id/shows" element={<ShowSelection />} />
        <Route path="cinemas" element={<Cinemas />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="shows/:showId/seats" element={<ProtectedRoute><SeatSelection /></ProtectedRoute>} />
        <Route path="checkout/:bookingId" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="bookings/:bookingId/confirmation" element={<ProtectedRoute><BookingConfirmation /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="admin" element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="movies" element={<AdminMovies />} />
        <Route path="cinemas" element={<AdminCinemas />} />
        <Route path="screens" element={<AdminScreens />} />
        <Route path="shows" element={<AdminShows />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="payments" element={<AdminPayments />} />
      </Route>
    </Routes>
  );
}
