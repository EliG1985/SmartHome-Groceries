import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { inventoryRouter } from './routes/inventoryRoutes.js';
import { reportRouter } from './routes/reportRoutes.js';
import { collaborationRouter } from './routes/collaborationRoutes.js';
import { storeRouter } from './routes/storeRoutes.js';
import { paymentRouter } from './routes/paymentRoutes.js';
import { requireAuth } from './middleware/authMiddleware.js';

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'smarthome-backend' });
});

app.use('/api/inventory', requireAuth, inventoryRouter);
app.use(
  '/api/reports',
  (req, res, next) => {
    if (req.path === '/nearby-supermarkets') {
      return next();
    }
    return requireAuth(req, res, next);
  },
  reportRouter,
);
app.use('/api/collaboration', requireAuth, collaborationRouter);
app.use('/api/store', requireAuth, storeRouter);
app.use(
  '/api/payments',
  (req, res, next) => {
    if (req.path.startsWith('/webhooks/')) return next();
    return requireAuth(req, res, next);
  },
  paymentRouter,
);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  res.status(500).json({ error: message });
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
