import express, {
  Express, NextFunction, Request, Response,
} from 'express';
import { sendNotFound, sendServerError } from '@/lib/response';
import router from '@/routes';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
