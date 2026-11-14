import PDFDocument from 'pdfkit';
import { formatDateTime, formatMoneyPlain } from '../utils/format.js';

/** Renders a booking DTO (see toBookingDto) to a PDF Buffer. */
export function renderTicketPdf(booking) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [420, 660], margin: 28 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const width = 420 - 56;

    doc.rect(0, 0, 420, 92).fill('#e11d2e');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text('E-TICKET', 28, 28);
    doc.fontSize(22).text(booking.movie?.title || 'Movie', 28, 46, { width });

    doc.fillColor('#111111');
    let y = 118;
    const line = (label, value) => {
      doc.font('Helvetica').fontSize(9).fillColor('#777777').text(label, 28, y);
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#111111').text(String(value), 28, y + 12, { width });
      y += 44;
    };

    line('Cinema', `${booking.cinema?.name || ''}${booking.cinema?.city ? `, ${booking.cinema.city}` : ''}`);
    line('Screen', booking.screen?.name || '');
    line('Show time', booking.show?.startTime ? formatDateTime(booking.show.startTime) : '');
    line('Seats', booking.seatIds.join(', '));
    line('Amount paid', formatMoneyPlain(booking.totalAmount));

    doc.moveTo(28, y).lineTo(392, y).dash(4, { space: 4 }).strokeColor('#bbbbbb').stroke().undash();
    y += 14;

    if (booking.qrCode) {
      const png = Buffer.from(booking.qrCode.split(',')[1], 'base64');
      doc.image(png, 28, y, { width: 130 });
    }
    doc.font('Helvetica').fontSize(9).fillColor('#777777').text('Booking ID', 180, y + 8);
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#111111').text(booking.bookingCode, 180, y + 22);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#777777')
      .text('Show this QR code at the entrance.\nPlease arrive 15 minutes early.', 180, y + 56, { width: 210 });

    doc.end();
  });
}
