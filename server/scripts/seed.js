/**
 * Seeds realistic demo data: users, cinemas, screens, movies and shows for the next 5 days.
 * Usage: npm run seed         (wipes the configured database first)
 * Demo logins:
 *   admin@cinema.test / Admin@1234
 *   user@cinema.test  / User@1234
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { Booking, Cinema, Movie, Payment, Screen, Show, ShowSeat, User, WebhookEvent } from '../models/index.js';
import { buildSeatLayout } from '../services/seatLayout.service.js';
import { createShow } from '../services/show.service.js';

if (env.isProd && !process.argv.includes('--force')) {
  console.error('Refusing to wipe a production database. Re-run with --force if you really mean it.');
  process.exit(1);
}

const MOVIES = [
  {
    title: 'Midnight Meridian',
    description: 'A night-shift train dispatcher notices a signal that should not exist, and follows it into a city that only appears after midnight.',
    genres: ['Thriller', 'Mystery'], language: 'English', durationMin: 128, rating: 8.4, certification: 'UA', featured: true,
    cast: ['Ananya Rao', 'Marcus Hale', 'Devika Nair'], crew: ['Director: Ishaan Verma', 'Music: Tara Collins'],
  },
  {
    title: 'The Last Tandoor',
    description: 'Three generations of a Chandigarh family restaurant fight to keep the oven lit when a glossy food-court chain moves in next door.',
    genres: ['Drama', 'Comedy'], language: 'Hindi', durationMin: 141, rating: 8.1, certification: 'U',
    cast: ['Rajveer Sandhu', 'Meera Kapoor', 'Harpreet Gill'], crew: ['Director: Simran Bedi', 'Music: Gaurav Anand'],
  },
  {
    title: 'Orbit of Salt',
    description: 'A salvage crew on a dying space station finds a lifeboat holding the only record of Earth\'s oceans.',
    genres: ['Sci-Fi', 'Adventure'], language: 'English', durationMin: 152, rating: 7.9, certification: 'UA',
    cast: ['Lena Okafor', 'Daniel Reyes', 'Kabir Mehta'], crew: ['Director: Priya Menon'],
  },
  {
    title: 'Jattan Da Jugaad',
    description: 'Four friends with one tractor, one dodgy loan and one weekend to win the biggest village fair in Punjab.',
    genres: ['Comedy', 'Family'], language: 'Punjabi', durationMin: 134, rating: 7.6, certification: 'U',
    cast: ['Gurnoor Dhillon', 'Jasleen Brar', 'Amanpreet Toor'], crew: ['Director: Karan Sidhu'],
  },
  {
    title: 'Ashes of Aravali',
    description: 'A retired forest officer returns to the hills to stop a mining syndicate, with a decades-old promise as his only weapon.',
    genres: ['Action', 'Drama'], language: 'Hindi', durationMin: 147, rating: 8.0, certification: 'UA', featured: true,
    cast: ['Vikram Chauhan', 'Naina Bhatt', 'Zoya Qureshi'], crew: ['Director: Aditya Rathore'],
  },
  {
    title: 'Paper Lanterns',
    description: 'Two strangers swap phones on a Tokyo night train and slowly fall for each other through photos, notes and playlists.',
    genres: ['Romance', 'Drama'], language: 'English', durationMin: 112, rating: 7.4, certification: 'U',
    cast: ['Mei Tanaka', 'Oliver Grant'], crew: ['Director: Yuki Hara'],
  },
  {
    title: 'Nightfall Protocol',
    description: 'A cybersecurity analyst has six hours to find the insider who is draining the national power grid.',
    genres: ['Action', 'Thriller'], language: 'English', durationMin: 119, rating: 7.2, certification: 'A',
    cast: ['Sofia Marin', 'Rohan Dutta'], crew: ['Director: Elena Voss'],
  },
  {
    title: 'Monsoon Mixtape',
    description: 'A college radio club races the rains to broadcast one final show from a flooding campus.',
    genres: ['Drama', 'Music'], language: 'Hindi', durationMin: 126, rating: 7.8, certification: 'U', status: 'upcoming',
    releaseOffsetDays: 14, cast: ['Aarav Malhotra', 'Isha Verma'], crew: ['Director: Neha Banerjee'],
  },
  {
    title: 'The Glass Orchard',
    description: 'An heiress inherits an orchard where every tree is rumoured to hide a secret, and the town wants them all.',
    genres: ['Mystery', 'Drama'], language: 'English', durationMin: 133, rating: 0, certification: 'UA', status: 'upcoming',
    releaseOffsetDays: 28, cast: ['Clara Whitman', 'Arjun Kohli'], crew: ['Director: Margot Lindqvist'],
  },
];

const CINEMAS = [
  { name: 'Aurora Cinemas', city: 'Chandigarh', location: 'Sector 17', address: 'Plaza Road, Sector 17, Chandigarh' },
  { name: 'Skyline Multiplex', city: 'Chandigarh', location: 'Elante', address: 'Industrial Area Phase 1, Chandigarh' },
  { name: 'Northgate Screens', city: 'Panchkula', location: 'Sector 5', address: 'Sector 5, Panchkula, Haryana' },
  { name: 'Marine Drive Picture House', city: 'Mumbai', location: 'Churchgate', address: 'Marine Drive, Mumbai' },
];

const SCREEN_LAYOUTS = [
  { name: 'Screen 1', numRows: 10, seatsPerRow: 14, aisleAfter: 7, goldRows: 4, premiumRows: 2 },
  { name: 'Screen 2', numRows: 8, seatsPerRow: 12, aisleAfter: 6, goldRows: 3, premiumRows: 2 },
];

const PRICES = { REGULAR: 15000, GOLD: 25000, PREMIUM: 35000 }; // paise
const SLOTS = [[10, 0], [14, 0], [18, 30]];

async function main() {
  await connectDB();
  console.log(`Seeding database "${mongoose.connection.name}" ...`);
  await Promise.all([Booking, Cinema, Movie, Payment, Screen, Show, ShowSeat, User, WebhookEvent].map((m) => m.deleteMany({})));
  await mongoose.syncIndexes();

  const hash = (p) => bcrypt.hash(p, env.bcryptRounds);
  await User.create([
    { name: 'Cinema Admin', email: 'admin@cinema.test', passwordHash: await hash('Admin@1234'), role: 'admin', phone: '9000000001' },
    { name: 'Demo Customer', email: 'user@cinema.test', passwordHash: await hash('User@1234'), role: 'customer', phone: '9000000002' },
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const movies = await Movie.insertMany(
    MOVIES.map(({ releaseOffsetDays, ...m }) => {
      const releaseDate = new Date(today);
      releaseDate.setDate(releaseDate.getDate() + (releaseOffsetDays ?? -10));
      return { status: 'now_showing', ...m, releaseDate };
    }),
  );
  const nowShowing = movies.filter((m) => m.status === 'now_showing');

  const cinemas = await Cinema.insertMany(CINEMAS);
  const screens = [];
  for (const cinema of cinemas) {
    for (const layout of SCREEN_LAYOUTS) {
      const seats = buildSeatLayout(layout);
      screens.push(await Screen.create({ ...layout, cinemaId: cinema._id, seats, totalSeats: seats.length }));
    }
  }

  let showCount = 0;
  let i = 0;
  for (let day = 0; day < 5; day += 1) {
    for (const screen of screens) {
      for (const [h, m] of SLOTS) {
        const start = new Date(today);
        start.setDate(start.getDate() + day);
        start.setHours(h, m, 0, 0);
        if (start <= new Date()) continue; // don't create shows in the past
        const movie = nowShowing[i % nowShowing.length];
        i += 1;
        await createShow({ movieId: movie._id, screenId: screen._id, startTime: start, priceByCategory: PRICES });
        showCount += 1;
      }
    }
  }

  console.log(`Created ${movies.length} movies, ${cinemas.length} cinemas, ${screens.length} screens, ${showCount} shows.`);
  console.log('Admin:    admin@cinema.test / Admin@1234');
  console.log('Customer: user@cinema.test  / User@1234');
  await disconnectDB();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDB();
  process.exit(1);
});
