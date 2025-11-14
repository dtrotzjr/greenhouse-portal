import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { GreenhouseDatabase } from './db/database';
import { createDataRouter } from './routes/data';
import { createImagesRouter } from './routes/images';
import { createDatesRouter } from './routes/dates';

// Load .env file - try project root first, then server directory
// This works both in development (from src/) and production (from dist/)
// Environment variables from systemd/service file will override .env values
// dotenv.config() won't override existing env vars and won't fail if file doesn't exist
const projectRootEnv = path.join(__dirname, '../../.env');
const serverEnv = path.join(__dirname, '../.env');
dotenv.config({ path: projectRootEnv });
dotenv.config({ path: serverEnv });

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/greenhouse_data.sqlite');
const IMAGE_BASE_DIR = process.env.IMAGE_BASE_DIR || '/mnt/GreenhouseData/imgs';

// Initialize database
const db = new GreenhouseDatabase(DB_PATH);

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/data', createDataRouter(db));
app.use('/api/images', createImagesRouter(IMAGE_BASE_DIR));
app.use('/api/dates', createDatesRouter(db));

// Serve static files from client dist directory
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// Serve index.html for all non-API routes (SPA fallback)
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  db.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  console.log(`Image base directory: ${IMAGE_BASE_DIR}`);
});

