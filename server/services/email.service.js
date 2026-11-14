import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { formatDateTime, formatMoneyPlain } from '../utils/format.js';
import { renderTicketPdf } from './ticket.service.js';

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = env.smtp.host
      ? nodemailer.createTransport({
          host: env.smtp.host,
          port: env.smtp.port,
          secure: env.smtp.port === 465,
          auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
        })
      : nodemailer.createTransport({ jsonTransport: true }); // no SMTP configured: log instead of sending
  }
  return transporter;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function sendBookingConfirmation(bookingDto, toEmail) {
  const pdf = await renderTicketPdf(bookingDto);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
      <h2 style="color:#e11d2e;margin-bottom:4px">Booking confirmed</h2>
      <p>Your tickets for <strong>${esc(bookingDto.movie?.title)}</strong> are ready.</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:6px 0;color:#666">Booking ID</td><td><strong>${esc(bookingDto.bookingCode)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666">Cinema</td><td>${esc(bookingDto.cinema?.name)}, ${esc(bookingDto.cinema?.city)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Screen</td><td>${esc(bookingDto.screen?.name)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Show time</td><td>${esc(formatDateTime(bookingDto.show.startTime))}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Seats</td><td>${esc(bookingDto.seatIds.join(', '))}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Amount paid</td><td>${esc(formatMoneyPlain(bookingDto.totalAmount))}</td></tr>
      </table>
      <p style="margin-top:20px">Your e-ticket with the QR code is attached as a PDF.</p>
    </div>`;

  const info = await getTransporter().sendMail({
    from: env.smtp.from,
    to: toEmail,
    subject: `Your tickets for ${bookingDto.movie?.title} (${bookingDto.bookingCode})`,
    html,
    attachments: [{ filename: `ticket-${bookingDto.bookingCode}.pdf`, content: pdf, contentType: 'application/pdf' }],
  });
  if (!env.smtp.host) logger.info(`[email] (no SMTP configured) confirmation for ${bookingDto.bookingCode} to ${toEmail}`);
  return info;
}
