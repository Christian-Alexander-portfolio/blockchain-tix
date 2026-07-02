import { Resend } from 'resend';
import { config } from '../config';

const resend = new Resend(config.resendApiKey);

export async function sendTicketConfirmation(params: {
  to: string;
  name: string;
  eventTitle: string;
  tierName: string;
  ticketId: string;
  eventDate: string;
  venue: string;
}): Promise<void> {
  await resend.emails.send({
    from: config.fromEmail,
    to: params.to,
    subject: `Your ticket for ${params.eventTitle} ✓`,
    html: `
      <h2>You're going to ${params.eventTitle}!</h2>
      <p>Hi ${params.name},</p>
      <p>Your <strong>${params.tierName}</strong> ticket is confirmed.</p>
      <ul>
        <li><strong>Event:</strong> ${params.eventTitle}</li>
        <li><strong>Date:</strong> ${params.eventDate}</li>
        <li><strong>Venue:</strong> ${params.venue}</li>
        <li><strong>Ticket ID:</strong> ${params.ticketId}</li>
      </ul>
      <p>Open the app to view your QR code. See you there!</p>
    `,
  });
}

export async function sendResaleSoldNotification(params: {
  to: string;
  sellerName: string;
  eventTitle: string;
  salePriceCents: number;
}): Promise<void> {
  const amount = (params.salePriceCents / 100).toFixed(2);
  await resend.emails.send({
    from: config.fromEmail,
    to: params.to,
    subject: `Your ticket for ${params.eventTitle} sold!`,
    html: `
      <h2>Your ticket sold!</h2>
      <p>Hi ${params.sellerName},</p>
      <p>Your resale ticket for <strong>${params.eventTitle}</strong> sold for <strong>$${amount}</strong>.</p>
      <p>Proceeds (minus platform fee) will be applied to your account.</p>
    `,
  });
}

export async function sendOrganizerApproved(params: {
  to: string;
  name: string;
  orgName: string;
}): Promise<void> {
  await resend.emails.send({
    from: config.fromEmail,
    to: params.to,
    subject: `Your organizer account has been approved!`,
    html: `
      <h2>Welcome to BlockchainTickets, ${params.orgName}!</h2>
      <p>Hi ${params.name},</p>
      <p>Your organizer account has been approved. You can now create and publish events.</p>
      <p>Log in to the app to get started.</p>
    `,
  });
}
