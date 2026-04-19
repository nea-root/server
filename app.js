import 'dotenv/config';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware as apolloMiddleware } from '@apollo/server/express4';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import createError from 'http-errors';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { readFile } from 'node:fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';

import { resolvers } from './resolvers.js';
import { connectDB } from './src/config/database.js';
import { buildContext } from './src/middleware/context.js';
import { initChatSocket } from './src/sockets/chat.socket.js';
import swaggerDefinition from './src/docs/swagger.js';
import indexRouter from './routes/index.js';
import usersRouter from './routes/users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: { origin: process.env.CLIENT_URL || '*', methods: ['GET', 'POST'], credentials: true },
});
initChatSocket(io);

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));

// ─── Stripe webhook needs raw body – mount before express.json() ──────────────
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET,
    );

    const { default: Payment } = await import('./src/models/Payment.js');
    const { default: Subscription } = await import('./src/models/Subscription.js');
    const { default: Appointment } = await import('./src/models/Appointment.js');
    const { default: Notification } = await import('./src/models/Notification.js');

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      await Payment.findOneAndUpdate({ stripePaymentIntentId: intent.id }, { status: 'succeeded' });
      if (intent.metadata?.appointmentId) {
        const appt = await Appointment.findByIdAndUpdate(intent.metadata.appointmentId, {
          status: 'confirmed',
        });
        if (appt) {
          await Notification.create({
            recipient: appt.client,
            type: 'payment_succeeded',
            title: 'Payment Successful',
            body: 'Your appointment payment was successful.',
            data: { appointmentId: appt._id },
          });
        }
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      await Payment.findOneAndUpdate(
        { stripePaymentIntentId: event.data.object.id },
        { status: 'failed' },
      );
    } else if (event.type === 'customer.subscription.deleted') {
      await Subscription.findOneAndUpdate(
        { stripeSubscriptionId: event.data.object.id },
        { status: 'cancelled' },
      );
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).send(`Webhook error: ${err.message}`);
  }
});

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(logger('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use('/graphql', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

// ─── File uploads (REST endpoint – simpler than GraphQL multipart) ────────────
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024 },
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file' });
  res.json({
    success: true,
    url: `/uploads/${req.file.filename}`,
    fileName: req.file.originalname,
  });
});

app.use('/uploads', express.static(path.join(__dirname, uploadDir)));

// ─── View engine (kept for existing routes) ───────────────────────────────────
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

// ─── GraphQL ──────────────────────────────────────────────────────────────────
const typeDefs = await readFile('./schema.graphql', 'utf8');
const apolloServer = new ApolloServer({ typeDefs, resolvers, introspection: true });
await apolloServer.start();

app.use('/graphql', apolloMiddleware(apolloServer, { context: buildContext }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Swagger UI (disabled in production) ──────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  const swaggerUiOptions = {
    customSiteTitle: 'Nevereveralone API Docs',
    customCss: '.swagger-ui .topbar { background-color: #1a1a2e; }',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  };
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition, swaggerUiOptions));
  app.get('/api-docs.json', (_, res) => res.json(swaggerDefinition));
}

// ─── Legacy routes ────────────────────────────────────────────────────────────
app.use('/', indexRouter);
app.use('/users', usersRouter);

// ─── 404 & error handler ─────────────────────────────────────────────────────
app.use((req, res, next) => next(createError(404)));
app.use((err, req, res, _next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

// ─── Connect DB and export ────────────────────────────────────────────────────
await connectDB();

export { app, httpServer };
export default app;
