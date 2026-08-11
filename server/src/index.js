import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import { registerGracefulShutdown } from './config/shutdown.js';
import { getHelmetOptions } from './config/security.js';
import { startScraperCron } from './scheduler/cron.js';
import { healthRouter, jobsRouter, scholarshipsRouter, admissionsRouter, blogsRouter, foreignStudiesRouter, authRouter, adminRouter, trendingRouter, newsletterRouter, notificationsRouter, monetizationRouter, usersRouter, v1Router, examsRouter, internshipsRouter, chatbotRouter, webinarsRouter, intlScholarshipsRouter, badgesRouter, seoRouter, resumesRouter, employerRouter, publicProfilesRouter, careerArticlesRouter, resumeTemplatesRouter, cmsRouter, contactRouter, feedbackRouter, institutionsRouter, supportRouter, userInboxRouter, formsRouter, dynamicContentRouter, searchRouter, analyticsRouter, talentRouter, opportunityApplicationsRouter, timelineRouter, documentsRouter, credentialsRouter, careerDashboardRouter, migrationRouter, scoringRouter, assessmentsRouter, employerIntelligenceRouter, organizationVerificationRouter, testsRouter, personalizationRouter, actionEngineRouter, vaultRouter, agentRouter, consultationRouter, caseRouter, professionalTrustRouter, commerceRouter, marketplacePaymentsRouter, institutionPortalRouter, copilotRouter, budgetRouter, skillClaimsRouter, privacyRouter } from './routes/index.js';import { registerCareerTimelineHandlers } from './services/career/careerEventHandlers.js';
import { registerCareerNotificationHandlers } from './services/career/careerNotificationBridge.js';
import { registerCareerScoringHandlers } from './services/career/careerScoringBridge.js';
import { getSitemap, getRobots } from './controllers/seoController.js';
import { stripeWebhook } from './controllers/paymentsController.js';
import { marketplaceWebhook } from './controllers/marketplacePaymentController.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { getCorsOptions } from './config/cors.js';
import { validateProductionEnv } from './config/validateEnv.js';
import { configureTrustProxy } from './config/proxy.js';
import { logger } from './utils/logger.js';
import { createMongoSanitizeOptions } from './services/jobWriteBoundary.js';

validateProductionEnv();

registerCareerTimelineHandlers();
registerCareerNotificationHandlers();
registerCareerScoringHandlers();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

// Must run before any express-rate-limit middleware (Render sets X-Forwarded-For).
configureTrustProxy(app);

if (process.env.SENTRY_DSN) {
  import('@sentry/node')
    .then((Sentry) => {
      Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development' });
      logger.info('Sentry initialized');
    })
    .catch(() => logger.warn('Sentry DSN set but @sentry/node not installed'));
}

app.use(helmet(getHelmetOptions()));
app.use(compression());

// Stripe webhook requires raw body — must be before express.json()
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);
app.post('/api/webhooks/stripe-marketplace', express.raw({ type: 'application/json' }), marketplaceWebhook);

app.use(cors(getCorsOptions()));
app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize(createMongoSanitizeOptions()));
app.use(requestLogger);
app.use('/api', apiLimiter);

app.use('/uploads', (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '../uploads'), {
  dotfiles: 'deny',
  index: false,
}));

app.get('/sitemap.xml', getSitemap);
app.get('/robots.txt', getRobots);

// Operator-friendly probes (browsers hit these; API has no HTML UI)
app.get('/', (_req, res) => {
  res.json({
    service: 'Strideto API',
    status: 'ok',
    health: '/api/health',
    hint: 'JSON API — use paths under /api/* (e.g. POST /api/auth/login)',
  });
});
app.get('/api', (_req, res) => {
  res.json({
    service: 'Strideto API',
    status: 'ok',
    health: '/api/health',
    auth: {
      login: 'POST /api/auth/login',
      register: 'POST /api/auth/register',
      me: 'GET /api/auth/me',
    },
  });
});
// Alias for Render health checks misconfigured as /health
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Strideto API', full: '/api/health' });
});

app.use('/api', healthRouter);
app.use('/api', contactRouter);
app.use('/api', feedbackRouter);
app.use('/api', institutionsRouter);app.use('/api', supportRouter);
app.use('/api', userInboxRouter);
app.use('/api', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api', jobsRouter);
app.use('/api', scholarshipsRouter);
app.use('/api', admissionsRouter);
app.use('/api', blogsRouter);
app.use('/api', foreignStudiesRouter);
app.use('/api', trendingRouter);
app.use('/api', newsletterRouter);
app.use('/api', notificationsRouter);
app.use('/api', monetizationRouter);
app.use('/api', usersRouter);
app.use('/api', examsRouter);
app.use('/api', internshipsRouter);
app.use('/api', chatbotRouter);
app.use('/api', webinarsRouter);
app.use('/api', intlScholarshipsRouter);
app.use('/api', badgesRouter);
app.use('/api', seoRouter);
app.use('/api', resumesRouter);
app.use('/api', employerRouter);
app.use('/api', publicProfilesRouter);
app.use('/api', careerArticlesRouter);
app.use('/api', resumeTemplatesRouter);
app.use('/api/cms', cmsRouter);
app.use('/api', formsRouter);
app.use('/api', dynamicContentRouter);
app.use('/api', searchRouter);
app.use('/api', analyticsRouter);
app.use('/api', talentRouter);
app.use('/api', opportunityApplicationsRouter);
app.use('/api', timelineRouter);
app.use('/api', documentsRouter);
app.use('/api', credentialsRouter);
app.use('/api', careerDashboardRouter);
app.use('/api', migrationRouter);
app.use('/api', scoringRouter);
app.use('/api', assessmentsRouter);
app.use('/api', employerIntelligenceRouter);
app.use('/api/organizations', organizationVerificationRouter);
app.use('/api', testsRouter);
app.use('/api', personalizationRouter);
app.use('/api', actionEngineRouter);
app.use('/api', vaultRouter);
app.use('/api', agentRouter);
app.use('/api', consultationRouter);
app.use('/api', caseRouter);
app.use('/api', professionalTrustRouter);
app.use('/api', commerceRouter);
app.use('/api', marketplacePaymentsRouter);
app.use('/api', institutionPortalRouter);
app.use('/api', copilotRouter);
app.use('/api', budgetRouter);
app.use('/api', skillClaimsRouter);
app.use('/api', privacyRouter);
app.use('/api/v1', v1Router);

app.use(errorHandler);

connectDB()
  .then(async () => {
    const { seedJobPlans } = await import('./seed/jobPlans.js');
    const jobPlansResult = await seedJobPlans().catch((e) => {
      logger.warn('job_plans_seed_failed', { error: e.message });
      return { error: e.message };
    });
    if (jobPlansResult && !jobPlansResult.error) {
      logger.info('job_plans_seed', jobPlansResult);
    }

    if (process.env.CMS_SEED_ON_START !== '0') {
      const { seedCmsSiteContent } = await import('./seed/cmsSiteContent.js');
      const cmsResult = await seedCmsSiteContent().catch((e) => {
        logger.warn('cms_seed_failed', { error: e.message });
        return { error: e.message };
      });
      if (cmsResult && !cmsResult.error) {
        logger.info('cms_seed', cmsResult);
      }
    } else {
      logger.info('cms_seed_skipped', { reason: 'CMS_SEED_ON_START=0' });
    }

    // Optional: set ADMIN_EMAIL + ADMIN_PASSWORD on Render to bootstrap first admin
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      const { ensureAdminOnBoot } = await import('./seed/ensureAdmin.js');
      await ensureAdminOnBoot().catch((e) => {
        logger.warn('admin_ensure_failed', { error: e.message });
      });
    } else {
      logger.info('admin_ensure_skipped', { reason: 'ADMIN_EMAIL/ADMIN_PASSWORD not set' });
    }

    if (process.env.WORKER_ONLY !== '1') {
      startScraperCron();
    } else {
      logger.info('api_cron_skipped', { reason: 'WORKER_ONLY container handles queue' });
    }
    const PORT_NUM = Number(PORT);
    const server = app.listen(PORT_NUM, () => {
      logger.info('server_started', { port: PORT_NUM });
    });
    registerGracefulShutdown(server);
  })
  .catch((err) => {
    console.error('\n❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
