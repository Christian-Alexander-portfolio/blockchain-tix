import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRouter from './routes/auth';
import eventsRouter from './routes/events';
import ticketsRouter from './routes/tickets';
import listingsRouter from './routes/listings';
import paymentsRouter from './routes/payments';
import scanRouter from './routes/scan';
import adminRouter from './routes/admin';
import organizerRouter from './routes/organizer';
import { errorHandler, notFound } from './middleware/errorHandler';
import { config } from './config';
import { startUsdcMonitor } from './services/usdcMonitor';

const app = express();

// Security & parsing
app.use(helmet());
app.use(
  cors({
    origin: [config.frontendUrl, 'http://localhost:8081', 'http://localhost:19006'],
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(
  '/api/auth',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many requests' } }),
);
app.use(
  '/api',
  rateLimit({ windowMs: 60 * 1000, max: 200, message: { error: 'Too many requests' } }),
);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/scan', scanRouter);
app.use('/api/admin', adminRouter);
app.use('/api/organizer', organizerRouter);

// Dev seed endpoint (only when explicitly enabled — never in production)
if (process.env.ENABLE_DEV_SEED_ENDPOINT === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const devRouter = require('./routes/dev').default;
  app.use('/api/dev', devRouter);
  console.log('[API] ⚠️  Dev seed endpoint enabled at POST /api/dev/seed');
}

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`[API] Running on port ${PORT} (${config.nodeEnv})`);

  // Start USDC payment monitor (WebSocket/event listener)
  if (config.nodeEnv === 'production') {
    startUsdcMonitor();
  }
});

export default app;
