import 'reflect-metadata';
import express, {
  Express, NextFunction, Request, Response,
} from 'express';
import { sendNotFound, sendServerError } from '@/lib/response';
import router from '@/routes';
import { AppDataSource } from '@/config/database';
import { env } from '@/config/env';
import morgan from 'morgan';

import settingsRoutes from './routes/settings';

const app: Express = express();
const PORT = env.node.port;

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (dev only)
app.use(morgan('dev'));

// Mount routes
app.use(router);

// 404 handler — must be placed after all routes
app.use((_req: Request, res: Response): void => {
  sendNotFound(res);
});

// Global error handler — must be placed last with 4 parameters
app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error(err.stack);
  sendServerError(res, err.message);
});

AppDataSource.initialize()
  .then(() => {
    console.log('Database connection established.');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT} [${env.node.env}]`);
    });
  })
  .catch((err: Error) => {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  });

export default app;

app.use('/api', settingsRoutes);
