import { Router, Request, Response } from 'express';
import { GreenhouseDatabase } from '../db/database';

export function createDataRouter(db: GreenhouseDatabase): Router {
  const router = Router();

  router.get('/current', (req: Request, res: Response) => {
    try {
      const data = db.getLatestDataPoint();
      if (!data) {
        return res.status(404).json({ error: 'No data found' });
      }
      res.json(data);
    } catch (error) {
      console.error('Error fetching current data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/:timestamp', (req: Request, res: Response) => {
    try {
      const timestamp = parseInt(req.params.timestamp, 10);
      if (isNaN(timestamp)) {
        return res.status(400).json({ error: 'Invalid timestamp' });
      }

      const data = db.getDataPointByTimestamp(timestamp);
      if (!data) {
        return res.status(404).json({ error: 'No data found for timestamp' });
      }
      res.json(data);
    } catch (error) {
      console.error('Error fetching data by timestamp:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

