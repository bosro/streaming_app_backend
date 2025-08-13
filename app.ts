import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import dotenv from 'dotenv';

// Import middleware
import { errorHandler } from './src/middleware/errorHandler';
import { rateLimiter } from './src/middleware/rateLimiter';
import { securityMiddleware } from './src/middleware/security';

// Import routes
import authRoutes from './src/routes/auth';
import contentRoutes from './src/routes/content';
import subscriptionRoutes from './src/routes/subscriptions';
import productRoutes from './src/routes/products';
import orderRoutes from './src/routes/orders';
import notificationRoutes from './src/routes/notifications';
import messageRoutes from './src/routes/messages';
import adminRoutes from './src/routes/admin';
import webhookRoutes from './src/routes/webhooks';

// Import configs
import { connectDatabase } from './src/config/database';
import { initializeFirebase } from './src/config/firebase';
import { logger } from './src/utils/logger';

// Load environment variables
dotenv.config();

class App {
  public app: Application;
  public port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '5000', 10);

    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeSwagger();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https:"],
          scriptSrc: ["'self'", "https:"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https:"],
          fontSrc: ["'self'", "https:", "data:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", "https:"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    const corsOptions = {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    };
    this.app.use(cors(corsOptions));

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    if (process.env.NODE_ENV !== 'test') {
      this.app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
    }

    // Rate limiting
    this.app.use(rateLimiter);

    // Custom security middleware
    this.app.use(securityMiddleware);

    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);
  }

  private initializeRoutes(): void {
    const apiVersion = process.env.API_VERSION || 'v1';

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: apiVersion,
        environment: process.env.NODE_ENV,
      });
    });

    // API routes
    this.app.use(`/api/${apiVersion}/auth`, authRoutes);
    this.app.use(`/api/${apiVersion}/content`, contentRoutes);
    this.app.use(`/api/${apiVersion}/subscriptions`, subscriptionRoutes);
    this.app.use(`/api/${apiVersion}/products`, productRoutes);
    this.app.use(`/api/${apiVersion}/orders`, orderRoutes);
    this.app.use(`/api/${apiVersion}/notifications`, notificationRoutes);
    this.app.use(`/api/${apiVersion}/messages`, messageRoutes);
    this.app.use(`/api/${apiVersion}/admin`, adminRoutes);
    this.app.use(`/api/${apiVersion}/webhooks`, webhookRoutes);

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.originalUrl,
      });
    });
  }

  private initializeSwagger(): void {
    const options = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'MyStreamingApp API',
          version: '1.0.0',
          description: 'Backend API for MyStreamingApp - A subscription-based streaming platform',
          contact: {
            name: 'API Support',
            email: 'support@mystreamingapp.com',
          },
        },
        servers: [
          {
            url: `http://localhost:${this.port}/api/v1`,
            description: 'Development server',
          },
          {
            url: 'https://api.mystreamingapp.com/api/v1',
            description: 'Production server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
    };

    const specs = swaggerJsdoc(options);
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Initialize database connection
      await connectDatabase();
      logger.info('Database connected successfully');

      // Initialize Firebase
      await initializeFirebase();
      logger.info('Firebase initialized successfully');

      // Start server
      this.app.listen(this.port, () => {
        logger.info(`🚀 Server running on port ${this.port}`);
        logger.info(`📚 API Documentation available at http://localhost:${this.port}/api-docs`);
        logger.info(`🏥 Health check available at http://localhost:${this.port}/health`);
      });

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Initialize and start the application
const app = new App();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

if (require.main === module) {
  app.start();
}

export default app;