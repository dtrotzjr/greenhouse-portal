import { Router, Request, Response } from 'express';
import { GreenhouseDatabase } from '../db/database';

export function createDatesRouter(db: GreenhouseDatabase): Router {
  const router = Router();

  router.get('/:date/data-points', (req: Request, res: Response) => {
    try {
      // Date format: YYYY-MM-DD
      const dateStr = req.params.date;
      const date = new Date(dateStr + 'T00:00:00');
      
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      }

      const timestamps = db.getDataPointsForDate(date);
      res.json({ timestamps });
    } catch (error) {
      console.error('Error fetching data points for date:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

