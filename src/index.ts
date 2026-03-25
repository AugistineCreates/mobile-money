import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { transactionRoutes } from './routes/transactions';
import { errorHandler } from './middleware/errorHandler';
import { connectRedis } from './config/redis';
import { globalTimeout, haltOnTimedout, timeoutErrorHandler } from './middleware/timeout';
import { responseTime } from './middleware/responseTime';

const app = express();
const PORT = process.env.PORT || 3000;

const RATE_LIMIT_WINDOW_MS     = parseInt(process.env.RATE_LIMIT_WINDOW_MS     ?? '900000', 10);
const RATE_LIMIT_MAX_REQUESTS  = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS  ?? '100',    10);

const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS, // 15 minutes
  max: RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(limiter);

// Global timeout configuration
app.use(responseTime);
app.use(globalTimeout);
app.use(haltOnTimedout);

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use('/api/transactions', transactionRoutes);

// Queue dashboard
const queueRouter = createQueueDashboard();
app.use("/admin/queues", queueRouter);

// Error handling
app.use(timeoutErrorHandler);
app.use(errorHandler);

connectRedis()
  .then(() => {
    console.log("Redis initialized");
  })
  .catch((err) => {
    console.error("Failed to connect to Redis:", err);
  });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startJobs();
});
