import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for Docker health checks
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Links API routes
  app.get('/api/links', async (req, res) => {
    try {
      const links = await storage.getAllLinks();
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch links' });
    }
  });

  app.post('/api/links', async (req, res) => {
    try {
      const link = await storage.createLink(req.body);
      res.json(link);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create link' });
    }
  });

  app.delete('/api/links/:id', async (req, res) => {
    try {
      const success = await storage.deleteLink(req.params.id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Link not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete link' });
    }
  });

  app.delete('/api/links', async (req, res) => {
    try {
      const deletedCount = await storage.deleteExpiredLinks();
      res.json({ deletedCount });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete expired links' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
