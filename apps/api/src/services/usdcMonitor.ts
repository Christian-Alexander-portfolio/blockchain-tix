import { ethers } from 'ethers';
import { prisma } from '../lib/prisma';
import { getUsdcContract } from '../lib/blockchain';
import { mintTicketForOrder } from './mintService';

let isRunning = false;

export function startUsdcMonitor(): void {
  if (isRunning) return;
  isRunning = true;

  const usdc = getUsdcContract();

  usdc.on(
    'Transfer',
    async (from: string, to: string, value: bigint, eventLog: ethers.EventLog) => {
      try {
        // Find a pending USDC session for this recipient address
        const session = await prisma.usdcPaymentSession.findFirst({
          where: {
            toAddress: to.toLowerCase(),
            fulfilled: false,
            expiresAt: { gt: new Date() },
          },
        });

        if (!session) return;

        // Verify the amount matches (USDC has 6 decimals)
        const expectedRaw = ethers.parseUnits(session.expectedUsdc, 6);
        if (value < expectedRaw) return; // under-payment

        // Wait for 2 confirmations
        const receipt = await eventLog.getTransaction();
        if (!receipt) return;

        // Create an order and mint the ticket
        const order = await prisma.order.create({
          data: {
            buyerId: session.userId,
            ticketId: 'pending',
            amountCents: session.amountCents,
            paymentMethod: 'USDC_POLYGON',
            usdcTxHash: eventLog.transactionHash,
          },
        });

        if (session.tierId) {
          await mintTicketForOrder({
            userId: session.userId,
            tierId: session.tierId,
            orderId: order.id,
          });
        }

        await prisma.usdcPaymentSession.update({
          where: { id: session.id },
          data: { fulfilled: true, txHash: eventLog.transactionHash },
        });
      } catch (err: any) {
        console.error('[USDC Monitor] Error processing transfer:', err.message);
      }
    },
  );

  console.log('[USDC Monitor] Listening for USDC transfers...');
}

export function stopUsdcMonitor(): void {
  if (!isRunning) return;
  getUsdcContract().removeAllListeners('Transfer');
  isRunning = false;
}
