import express from 'express';
import dotenv from 'dotenv';
import functions from '@google-cloud/functions-framework';
import cors from 'cors';
import sessionRoutes from './routes/session.routes.js';
import { requestMetrics } from './middleware/request-metrics.middleware.js';
import logger from './config/logger.js';

// Load environment variables in local development
if (!process.env.K_SERVICE && !process.env.FUNCTION_TARGET) {
    dotenv.config();
    logger.info('🔧 Running in LOCAL DEV mode - .env loaded');
}

const lacApp = express();

lacApp.use(cors());
lacApp.use(express.json());
lacApp.use(requestMetrics);

lacApp.use("/api", sessionRoutes);

lacApp.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

functions.http('lacApp', lacApp);