import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

export function createImagesRouter(imageBaseDir: string): Router {
  const router = Router();

  router.get('/*', (req: Request, res: Response) => {
    try {
      // Get the requested path (everything after /api/images/)
      // The path from the client will be the full absolute path from the database
      let requestedPath = req.params[0] || req.path.replace('/api/images', '');
      
      // Remove leading slash if present
      if (requestedPath.startsWith('/')) {
        requestedPath = requestedPath.substring(1);
      }
      
      // Extract the relative path from the absolute path stored in DB
      // Example: /mnt/GreenhouseData/imgs/2023/04/23/img_1682303523_19_32_03.jpg
      // We need to find the 'imgs' part and use everything after it
      const imgsIndex = requestedPath.indexOf('/imgs/');
      let relativePath: string;
      
      if (imgsIndex !== -1) {
        // Extract path after /imgs/
        relativePath = requestedPath.substring(imgsIndex + 6); // +6 to skip '/imgs/'
      } else if (requestedPath.startsWith('imgs/')) {
        // Handle case where path starts with imgs/
        relativePath = requestedPath.substring(5); // Skip 'imgs/'
      } else {
        // If no /imgs/ found, try to use the path as-is (might be relative already)
        relativePath = requestedPath;
      }

      const fullPath = path.join(imageBaseDir, relativePath);
      
      // Security check: ensure the resolved path is within the base directory
      const resolvedPath = path.resolve(fullPath);
      const resolvedBase = path.resolve(imageBaseDir);
      
      if (!resolvedPath.startsWith(resolvedBase)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ error: 'Image not found' });
      }

      // Determine content type based on file extension
      const ext = path.extname(resolvedPath).toLowerCase();
      const contentType = ext === '.jpg' || ext === '.jpeg' 
        ? 'image/jpeg' 
        : ext === '.png' 
        ? 'image/png' 
        : 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.sendFile(resolvedPath);
    } catch (error) {
      console.error('Error serving image:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

