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

// CORS configuration
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:4173', 
    'https://leebert.com'
];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            logger.warn(`Blocked CORS request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400 // 24 hours
};

lacApp.use(cors(corsOptions));
lacApp.use(express.json());
lacApp.use(requestMetrics);

lacApp.use("/api", sessionRoutes);

lacApp.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

functions.http('lacApp', lacApp);