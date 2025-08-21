import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireAdmin, requireAdminOrEngineer } from "./auth";
import { ChatWebSocketServer } from "./chat-websocket";
import { insertUserSchema, insertShortLinkSchema } from "@shared/schema";
import { generateUniqueShortCode } from "./utils/shortCode";
import { getSRSApiUrl, getSRSConfig, getSRSWhipUrl, getSRSWhepUrl } from "./utils/srs-config";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  // Health check endpoint for Docker health checks
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Session Token Validation API
  app.post('/api/validate-token', async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ valid: false, error: 'Token is required' });
      }

      const result = await storage.validateAndConsumeSessionToken(token);
      if (!result.valid) {
        return res.status(401).json({ valid: false, error: 'Invalid or expired token' });
      }

      res.json(result);
    } catch (error) {
      console.error('Token validation error:', error);
      res.status(500).json({ valid: false, error: 'Token validation failed' });
    }
  });

  // User management routes (Admin only)
  app.get('/api/users', requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const safeUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.post('/api/users', requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const { hashPassword } = await import('./auth');
      const hashedPassword = await hashPassword(userData.password);
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      res.status(201).json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      console.error('Failed to create user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  app.delete('/api/users/:id', requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      
      const success = await storage.deleteUser(userId);
      if (success) {
        res.sendStatus(204);
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // Links API routes (authenticated users)
  app.get('/api/links', requireAuth, async (req, res) => {
    try {
      console.log('Fetching all links...');
      const links = await storage.getAllLinks();
      
      // For each link, try to find corresponding short link
      const linksWithShortLinks = await Promise.all(
        links.map(async (link) => {
          // Find short link with matching parameters
          const shortLink = await storage.getShortLinkByParams(
            link.streamName, 
            link.returnFeed, 
            link.chatEnabled
          );
          
          return {
            ...link,
            shortLink: shortLink ? `/s/${shortLink.id}` : null,
            shortCode: shortLink?.id || null,
          };
        })
      );
      
      console.log('Links fetched successfully:', links.length, 'links');
      res.json(linksWithShortLinks);
    } catch (error) {
      console.error('Failed to fetch links:', error);
      res.status(500).json({ error: 'Failed to fetch links' });
    }
  });

  app.post('/api/links', requireAuth, async (req, res) => {
    try {
      console.log('Creating link with data:', req.body);
      const userId = (req.user as any)?.id;
      
      // Create session token for this link
      const linkExpiry = req.body.expiresAt ? new Date(req.body.expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours default
      const sessionToken = await storage.createSessionToken(req.body.id, 'guest', linkExpiry, userId);
      
      // Add session token to the link data and URL
      const linkData = {
        ...req.body,
        sessionToken: sessionToken.id,
        url: `${req.body.url}&token=${sessionToken.id}` // Add token to URL
      };
      
      const link = await storage.createLink(linkData, userId);
      console.log('Link created successfully with session token:', link);
      res.json(link);
    } catch (error) {
      console.error('Failed to create link:', error);
      res.status(500).json({ error: 'Failed to create link' });
    }
  });

  app.delete('/api/links/:id', requireAuth, async (req, res) => {
    try {
      // TODO: Add ownership check for non-admin users
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

  // Delete short link endpoint
  app.delete('/api/short-links/:code', requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteShortLink(req.params.code);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Short link not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete short link' });
    }
  });

  app.delete('/api/links', requireAdmin, async (req, res) => {
    try {
      const deletedCount = await storage.deleteExpiredLinks();
      res.json({ deletedCount });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete expired links' });
    }
  });

  // Viewer Links API routes (authenticated users)
  app.get('/api/viewer-links', requireAuth, async (req, res) => {
    try {
      console.log('Fetching all viewer links...');
      const links = await storage.getAllViewerLinks();
      
      // For each viewer link, try to find corresponding short viewer link
      const linksWithShortLinks = await Promise.all(
        links.map(async (link) => {
          // Find short viewer link with matching parameters
          const shortLink = await storage.getShortViewerLinkByParams(
            link.returnFeed, 
            link.chatEnabled
          );
          
          return {
            ...link,
            shortLink: shortLink ? `/sv/${shortLink.id}` : null,
            shortCode: shortLink?.id || null,
          };
        })
      );
      
      console.log('Viewer links fetched successfully:', links.length, 'links');
      res.json(linksWithShortLinks);
    } catch (error) {
      console.error('Failed to fetch viewer links:', error);
      res.status(500).json({ error: 'Failed to fetch viewer links' });
    }
  });

  app.post('/api/viewer-links', requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      const { id, returnFeed, chatEnabled, url, expiresAt } = req.body;
      
      // Create session token for this viewer link
      const linkExpiry = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours default
      const sessionToken = await storage.createSessionToken(id, 'viewer', linkExpiry, userId);
      
      // Add session token to the viewer link data and URL
      const viewerLinkData = {
        id,
        returnFeed,
        chatEnabled: chatEnabled ?? false,
        url: `${url}&token=${sessionToken.id}`, // Add token to URL
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        sessionToken: sessionToken.id,
      };
      
      const viewerLink = await storage.createViewerLink(viewerLinkData, userId);
      console.log('Viewer link created successfully with session token:', viewerLink);
      res.json(viewerLink);
    } catch (error) {
      console.error('Failed to create viewer link:', error);
      res.status(500).json({ error: 'Failed to create viewer link' });
    }
  });

  app.delete('/api/viewer-links/:id', requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteViewerLink(req.params.id);
      if (success) {
        res.json({ message: 'Viewer link deleted successfully' });
      } else {
        res.status(404).json({ error: 'Viewer link not found' });
      }
    } catch (error) {
      console.error('Failed to delete viewer link:', error);
      res.status(500).json({ error: 'Failed to delete viewer link' });
    }
  });

  app.delete('/api/viewer-links/expired', requireAuth, async (req, res) => {
    try {
      const deletedCount = await storage.deleteExpiredViewerLinks();
      res.json({ deletedCount, message: `${deletedCount} expired viewer links deleted` });
    } catch (error) {
      console.error('Failed to delete expired viewer links:', error);
      res.status(500).json({ error: 'Failed to delete expired viewer links' });
    }
  });

  // Short viewer link creation
  app.post('/api/short-viewer-links', requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      const { returnFeed, chatEnabled, expiresAt } = req.body;
      
      // Generate unique short code with 'v' prefix for viewer links
      const shortCode = await generateUniqueShortCode(async (code) => {
        const existing = await storage.getShortViewerLink(`v${code}`);
        return !!existing;
      });

      const shortViewerLink = await storage.createShortViewerLink({
        id: `v${shortCode}`,
        returnFeed,
        chatEnabled: chatEnabled ?? false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      }, userId);

      res.json(shortViewerLink);
    } catch (error) {
      console.error('Failed to create short viewer link:', error);
      res.status(500).json({ error: 'Failed to create short viewer link' });
    }
  });

  // Short viewer link resolution
  app.get('/sv/:code', async (req, res) => {
    try {
      const shortViewerLink = await storage.getShortViewerLink(req.params.code);
      if (!shortViewerLink) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Viewer Link Not Found - Virtual Audience Platform</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #0f172a; color: #e2e8f0; }
              .container { max-width: 600px; margin: 0 auto; }
              h1 { color: #ef4444; margin-bottom: 20px; }
              p { margin-bottom: 15px; line-height: 1.6; }
              .code { background: #1e293b; padding: 10px; border-radius: 5px; font-family: monospace; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Viewer Link Not Found</h1>
              <p>The short viewer link <span class="code">/sv/${req.params.code}</span> was not found or has expired.</p>
              <p>This could happen if:</p>
              <ul style="text-align: left; display: inline-block;">
                <li>The link has expired based on its configured duration</li>
                <li>The link was deleted by an administrator</li>
                <li>The link code is invalid or mistyped</li>
              </ul>
              <p>Please contact the person who shared this link for a new one.</p>
            </div>
          </body>
          </html>
        `);
      }

      // Check if the link has expired
      if (shortViewerLink.expiresAt && new Date() > shortViewerLink.expiresAt) {
        // Clean up the expired link
        await storage.deleteShortViewerLink(req.params.code);
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Viewer Link Expired - Virtual Audience Platform</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #0f172a; color: #e2e8f0; }
              .container { max-width: 600px; margin: 0 auto; }
              h1 { color: #f59e0b; margin-bottom: 20px; }
              p { margin-bottom: 15px; line-height: 1.6; }
              .code { background: #1e293b; padding: 10px; border-radius: 5px; font-family: monospace; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Viewer Link Expired</h1>
              <p>The short viewer link <span class="code">/sv/${req.params.code}</span> has expired.</p>
              <p>This link was configured with an expiration time and is no longer valid.</p>
              <p>Please contact the person who shared this link to request a new one.</p>
            </div>
          </body>
          </html>
        `);
      }

      // Find the corresponding viewer link to get the session token
      const viewerLinks = await storage.getAllViewerLinks();
      const matchingViewerLink = viewerLinks.find(link => 
        link.returnFeed === shortViewerLink.returnFeed && 
        link.chatEnabled === shortViewerLink.chatEnabled &&
        (!link.expiresAt || new Date() <= link.expiresAt)
      );

      if (!matchingViewerLink) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Viewer Link Invalid - Virtual Audience Platform</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #0f172a; color: #e2e8f0; }
              .container { max-width: 600px; margin: 0 auto; }
              h1 { color: #ef4444; margin-bottom: 20px; }
              p { margin-bottom: 15px; line-height: 1.6; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Viewer Link Invalid</h1>
              <p>The associated viewer session could not be found or has expired.</p>
              <p>Please request a new viewer link.</p>
            </div>
          </body>
          </html>
        `);
      }

      // Redirect to viewer page with return feed and session token
      const redirectUrl = `/studio-viewer?return=${encodeURIComponent(shortViewerLink.returnFeed)}&chat=${shortViewerLink.chatEnabled}&token=${matchingViewerLink.sessionToken}`;
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Error resolving short viewer link:', error);
      res.status(500).send('Internal server error');
    }
  });

  // Short link creation
  app.post('/api/short-links', requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      const { streamName, returnFeed, chatEnabled, expiresAt } = req.body;
      
      // Generate unique short code
      const shortCode = await generateUniqueShortCode(async (code) => {
        const existing = await storage.getShortLink(code);
        return !!existing;
      });

      const shortLink = await storage.createShortLink({
        id: shortCode,
        streamName,
        returnFeed,
        chatEnabled: chatEnabled ?? false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      }, userId);

      res.json(shortLink);
    } catch (error) {
      console.error('Failed to create short link:', error);
      res.status(500).json({ error: 'Failed to create short link' });
    }
  });

  // Short link resolution
  app.get('/s/:code', async (req, res) => {
    try {
      const shortLink = await storage.getShortLink(req.params.code);
      if (!shortLink) {
        // Return a proper HTML error page for better user experience
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Link Not Found - Virtual Audience Platform</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #0f172a; color: #e2e8f0; }
              .container { max-width: 600px; margin: 0 auto; }
              h1 { color: #ef4444; margin-bottom: 20px; }
              p { margin-bottom: 15px; line-height: 1.6; }
              .code { background: #1e293b; padding: 10px; border-radius: 5px; font-family: monospace; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Link Not Found</h1>
              <p>The short link <span class="code">/s/${req.params.code}</span> was not found or has expired.</p>
              <p>This could happen if:</p>
              <ul style="text-align: left; display: inline-block;">
                <li>The link has expired based on its configured duration</li>
                <li>The link was deleted by an administrator</li>
                <li>The link code is invalid or mistyped</li>
              </ul>
              <p>Please contact the person who shared this link for a new one.</p>
            </div>
          </body>
          </html>
        `);
      }

      // Check if the link has expired
      if (shortLink.expiresAt && new Date() > shortLink.expiresAt) {
        // Clean up the expired link
        await storage.deleteShortLink(req.params.code);
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Link Expired - Virtual Audience Platform</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #0f172a; color: #e2e8f0; }
              .container { max-width: 600px; margin: 0 auto; }
              h1 { color: #f59e0b; margin-bottom: 20px; }
              p { margin-bottom: 15px; line-height: 1.6; }
              .code { background: #1e293b; padding: 10px; border-radius: 5px; font-family: monospace; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Link Expired</h1>
              <p>The short link <span class="code">/s/${req.params.code}</span> has expired and is no longer valid.</p>
              <p>Please contact the person who shared this link for a new one.</p>
            </div>
          </body>
          </html>
        `);
      }

      // Log the access for monitoring
      console.log(`Short link accessed: ${req.params.code} -> stream: ${shortLink.streamName}, return: ${shortLink.returnFeed}`);

      // Find the original link to get its session token
      const allLinks = await storage.getAllLinks();
      const originalLink = allLinks.find(link => 
        link.streamName === shortLink.streamName && 
        link.returnFeed === shortLink.returnFeed &&
        link.chatEnabled === shortLink.chatEnabled
      );

      // If we can't find the original link, it may have been deleted
      if (!originalLink) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Link No Longer Available - Virtual Audience Platform</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #0f172a; color: #e2e8f0; }
              .container { max-width: 600px; margin: 0 auto; }
              h1 { color: #ef4444; margin-bottom: 20px; }
              p { margin-bottom: 15px; line-height: 1.6; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Link No Longer Available</h1>
              <p>The streaming session linked to this short link has been removed or expired.</p>
              <p>Please contact the person who shared this link for a new one.</p>
            </div>
          </body>
          </html>
        `);
      }

      // Redirect to session page with original parameters including session token
      const chatParam = shortLink.chatEnabled ? '&chat=true' : '';
      const tokenParam = originalLink.sessionToken ? `&token=${originalLink.sessionToken}` : '';
      const redirectUrl = `/session?stream=${encodeURIComponent(shortLink.streamName)}&return=${encodeURIComponent(shortLink.returnFeed)}${chatParam}${tokenParam}`;
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Failed to resolve short link:', error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Server Error - Virtual Audience Platform</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #0f172a; color: #e2e8f0; }
            .container { max-width: 600px; margin: 0 auto; }
            h1 { color: #ef4444; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Server Error</h1>
            <p>An internal server error occurred while processing the link. Please try again later.</p>
          </div>
        </body>
        </html>
      `);
    }
  });

  // Change password
  app.post("/api/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = req.user!;

      // Verify current password
      const existingUser = await storage.getUserByUsername(user.username);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Import comparePasswords function from auth module
      const authModule = await import("./auth");
      const isValidPassword = await authModule.comparePasswords(currentPassword, existingUser.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Hash new password and update
      const hashedNewPassword = await authModule.hashPassword(newPassword);
      await storage.updateUserPassword(user.id, hashedNewPassword);

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Chat API Routes - Public access for guests and authenticated users
  app.get('/api/chat/messages/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const messages = await storage.getChatMessages(sessionId, limit);
      res.json(messages);
    } catch (error) {
      console.error('Failed to fetch chat messages:', error);
      res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
  });

  app.get('/api/chat/participants/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const participants = await storage.getChatParticipants(sessionId);
      res.json(participants);
    } catch (error) {
      console.error('Failed to fetch chat participants:', error);
      res.status(500).json({ error: 'Failed to fetch chat participants' });
    }
  });

  app.post('/api/chat/send', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { sessionId, message, messageType } = req.body;

      if (!sessionId || !message?.trim()) {
        return res.status(400).json({ error: 'Session ID and message are required' });
      }

      // Check if user has permission to send messages
      if (!user || (user.role !== 'admin' && user.role !== 'engineer')) {
        return res.status(403).json({ error: 'Insufficient permissions to send messages' });
      }

      // Store the message in database
      const chatMessage = await storage.createChatMessage({
        sessionId,
        senderId: user.id,
        senderName: user.username,
        content: message.trim(),
        messageType: messageType || 'individual',
      });

      // Broadcast the message via WebSocket
      const chatWS = (global as any).chatWebSocketServer;
      if (chatWS) {
        // Send the message to all clients in the session
        const messageToSend = {
          type: 'new_message',
          message: chatMessage,
        };
        
        // Get all clients for this session and send the message
        chatWS.sendToSession(sessionId, messageToSend);
      }

      res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
      console.error('Failed to send chat message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  app.post('/api/chat/broadcast', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { message } = req.body;

      if (!message?.trim()) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Check if user has permission to send broadcast messages
      if (!user || (user.role !== 'admin' && user.role !== 'engineer')) {
        return res.status(403).json({ error: 'Insufficient permissions to send broadcast messages' });
      }

      // Get all active sessions
      const allLinks = await storage.getAllLinks();
      const allViewerLinks = await storage.getAllViewerLinks();
      
      // Extract unique session IDs
      const sessionIds = new Set();
      allLinks.forEach(link => sessionIds.add(link.id));
      allViewerLinks.forEach(link => sessionIds.add(link.id));

      // Store broadcast message for each session
      const broadcastPromises = Array.from(sessionIds).map(async (sessionId: any) => {
        return storage.createChatMessage({
          sessionId,
          senderId: user.id,
          senderName: user.username,
          content: message.trim(),
          messageType: 'broadcast',
        });
      });

      const chatMessages = await Promise.all(broadcastPromises);

      // Broadcast via WebSocket to all sessions
      const chatWS = (global as any).chatWebSocketServer;
      if (chatWS) {
        chatMessages.forEach((chatMessage, index) => {
          const sessionId = Array.from(sessionIds)[index];
          const messageToSend = {
            type: 'new_message',
            message: chatMessage,
          };
          chatWS.sendToSession(sessionId, messageToSend);
        });
      }

      res.json({ 
        success: true, 
        message: 'Broadcast sent successfully',
        sessionsCount: sessionIds.size 
      });
    } catch (error) {
      console.error('Failed to send broadcast message:', error);
      res.status(500).json({ error: 'Failed to send broadcast message' });
    }
  });

  app.delete('/api/chat/cleanup-duplicates/:sessionId', requireAuth, async (req, res) => {
    try {
      await storage.cleanupDuplicateParticipants(req.params.sessionId);
      res.json({ success: true, message: 'Duplicate participants cleaned up' });
    } catch (error) {
      console.error('Error cleaning up duplicate participants:', error);
      res.status(500).json({ error: 'Failed to clean up duplicates' });
    }
  });

  // SRS Server Configuration API
  app.get('/api/srs/config', (req, res) => {
    try {
      const config = getSRSConfig();
      res.json({
        host: config.host,
        whipPort: config.whipPort,
        apiPort: config.apiPort,
        useHttps: config.useHttps,
        // Helper URLs for frontend
        whipBaseUrl: `${config.useHttps ? 'https' : 'http'}://${config.host}:${config.whipPort}/rtc/v1/whip/`,
        whepBaseUrl: `${config.useHttps ? 'https' : 'http'}://${config.host}:${config.whipPort}/rtc/v1/whep/`
      });
    } catch (error) {
      console.error('Error getting SRS config:', error);
      res.status(500).json({ error: 'Failed to get SRS server configuration' });
    }
  });

  // SRS Server Monitoring API
  app.get('/api/srs/stats', async (req, res) => {
    try {
      const srsApiUrl = getSRSApiUrl();
      const response = await fetch(srsApiUrl);
      
      if (!response.ok) {
        throw new Error(`SRS API responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error fetching SRS stats:', error);
      res.status(500).json({ 
        error: 'Failed to fetch SRS server statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  
  // Initialize WebSocket server for chat
  const chatWS = new ChatWebSocketServer(httpServer);
  console.log('Chat WebSocket server initialized on /chat');
  
  // Set global reference for API access
  (global as any).chatWebSocketServer = chatWS;

  return httpServer;
}
