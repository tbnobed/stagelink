import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireAdmin, requireAdminOrEngineer } from "./auth";
import { ChatWebSocketServer } from "./chat-websocket";
import { insertUserSchema, insertShortLinkSchema, insertRoomSchema, insertRoomParticipantSchema, insertRoomStreamAssignmentSchema, insertProductionSchema, type ReturnFeed } from "@shared/schema";
import { generateUniqueShortCode } from "./utils/shortCode";
import { getSRSApiUrl, getSRSConfig, getSRSWhipUrl, getSRSWhepUrl, getNextWhipServer, formatServerAddress, getWhipServerList, buildServerWhepUrl, parseServerAddress } from "./utils/srs-config";
import { sendStreamingInvite, sendViewerInvite } from "./email-service";

// Round-robin counter for WHEP server pool assignment
let whepRoundRobinIndex = 0;

async function getNextWhepServers(): Promise<{ primary: string | null; fallback: string | null }> {
  const servers = await storage.getActiveWhepServers();
  if (!servers.length) return { primary: null, fallback: null };
  const primaryIdx = whepRoundRobinIndex % servers.length;
  const fallbackIdx = (whepRoundRobinIndex + 1) % servers.length;
  whepRoundRobinIndex++;
  return {
    primary: servers[primaryIdx].address,
    fallback: servers.length > 1 ? servers[fallbackIdx].address : null,
  };
}

async function getNextWhepServerAddress(): Promise<string | null> {
  return (await getNextWhepServers()).primary;
}

async function getNextFeedServers(feed: ReturnFeed): Promise<{ primary: string | null; fallback: string | null }> {
  const addrs = [feed.serverAddress, feed.fallbackServerAddress].filter(Boolean) as string[];
  if (addrs.length === 0) return { primary: null, fallback: null };
  if (addrs.length === 1) return { primary: addrs[0], fallback: null };
  // Use the last assigned server in DB to determine which server is next — restart-safe
  const lastServer = await storage.getLastWhepServerForFeed(feed.streamName);
  const idx = lastServer === addrs[0] ? 1 : 0;
  return {
    primary: addrs[idx],
    fallback: addrs[(idx + 1) % addrs.length],
  };
}

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

  // User Invite API (Admin only)
  app.post('/api/users/invite', requireAdmin, async (req, res) => {
    try {
      const { email, role = 'user' } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Check if user already exists by email
      const existingUserByEmail = await storage.getUserByEmail(email);
      if (existingUserByEmail) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      // Generate secure registration token
      const crypto = await import('crypto');
      const registrationToken = crypto.randomBytes(32).toString('hex');
      
      // Token expires in 7 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create registration token
      const inviterUser = req.user as any;
      await storage.createRegistrationToken(
        email,
        role,
        registrationToken,
        expiresAt,
        inviterUser.id
      );

      // Send registration invitation email
      const { sendRegistrationInvite } = await import('./email-service');
      const platformUrl = `${req.protocol}://${req.get('host')}`;
      const registrationUrl = `${platformUrl}/register?token=${registrationToken}`;
      
      const emailSent = await sendRegistrationInvite({
        to: email,
        inviterName: inviterUser.username || 'StageLinq Admin',
        registrationUrl,
        role,
      });

      if (!emailSent) {
        console.error('Failed to send registration invitation email');
        return res.status(500).json({ error: 'Failed to send invitation email' });
      }

      res.status(201).json({
        message: 'Registration invitation sent successfully',
        email,
        role,
        emailSent,
      });
    } catch (error) {
      console.error('Failed to invite user:', error);
      res.status(500).json({ error: 'Failed to invite user' });
    }
  });

  // Registration API (Public)
  app.get('/api/registration/validate-token/:token', async (req, res) => {
    try {
      const { token } = req.params;
      
      const registrationToken = await storage.getRegistrationToken(token);
      if (!registrationToken) {
        return res.status(400).json({ error: 'Invalid or expired registration token' });
      }

      res.json({
        valid: true,
        email: registrationToken.email,
        role: registrationToken.role,
      });
    } catch (error) {
      console.error('Failed to validate registration token:', error);
      res.status(500).json({ error: 'Failed to validate registration token' });
    }
  });

  app.post('/api/registration/complete', async (req, res) => {
    try {
      const { token, username, password } = req.body;
      
      if (!token || !username || !password) {
        return res.status(400).json({ error: 'Token, username, and password are required' });
      }

      // Validate registration token
      const registrationToken = await storage.getRegistrationToken(token);
      if (!registrationToken) {
        return res.status(400).json({ error: 'Invalid or expired registration token' });
      }

      // Check if username is already taken
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: 'Username is already taken' });
      }

      // Check if email is already registered
      const existingEmailUser = await storage.getUserByEmail(registrationToken.email);
      if (existingEmailUser) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      // Hash password
      const { hashPassword } = await import('./auth');
      const hashedPassword = await hashPassword(password);

      // Create user account
      const user = await storage.createUser({
        username,
        email: registrationToken.email,
        password: hashedPassword,
        role: registrationToken.role as 'admin' | 'engineer' | 'user',
      });

      // Mark registration token as used
      await storage.useRegistrationToken(token);

      res.status(201).json({
        message: 'Registration completed successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error('Failed to complete registration:', error);
      res.status(500).json({ error: 'Failed to complete registration' });
    }
  });

  // Password Reset Request API (Public)
  app.post('/api/password-reset/request', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Don't reveal if user exists for security
        return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
      }

      // Generate reset token
      const { randomBytes } = await import('crypto');
      const resetToken = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.createPasswordResetToken(user.id, resetToken, expiresAt);

      // Send password reset email
      const { sendPasswordReset } = await import('./email-service');
      const platformUrl = `${req.protocol}://${req.get('host')}`;
      
      const emailSent = await sendPasswordReset({
        to: email,
        resetToken,
        platformUrl,
      });

      if (!emailSent) {
        console.error('Failed to send password reset email');
      }

      res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    } catch (error) {
      console.error('Failed to process password reset request:', error);
      res.status(500).json({ error: 'Failed to process password reset request' });
    }
  });

  // Password Reset Confirmation API (Public)
  app.post('/api/password-reset/confirm', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required' });
      }

      // Validate reset token
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      // Hash new password
      const { hashPassword } = await import('./auth');
      const hashedPassword = await hashPassword(newPassword);

      // Update user password
      await storage.updateUserPassword(resetToken.userId, hashedPassword);

      // Mark token as used
      await storage.usePasswordResetToken(token);

      res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
      console.error('Failed to reset password:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  // Links API routes (authenticated users)
  // Public endpoint — session page uses this to find the assigned WHIP server for a stream.
  // No auth required: guests don't have accounts.
  app.get('/api/links/assigned-server', async (req, res) => {
    try {
      const streamName = req.query.stream as string;
      if (!streamName) return res.status(400).json({ error: 'stream param required' });
      const link = await storage.getLinkByStreamName(streamName);
      res.json({ assignedServer: link?.assignedServer || null });
    } catch (err) {
      console.error('Error looking up assigned server:', err);
      res.status(500).json({ error: 'Failed to look up assigned server' });
    }
  });

  app.get('/api/links', requireAuth, async (req, res) => {
    try {
      console.log('Fetching all links...');
      const links = await storage.getAllLinks();
      
      // For each link, try to find corresponding short link and room assignments
      const linksWithEnrichments = await Promise.all(
        links.map(async (link) => {
          // Find short link with matching parameters
          const shortLink = await storage.getShortLinkByParams(
            link.streamName, 
            link.returnFeed, 
            link.chatEnabled
          );
          
          // Find room assignments for this stream
          const roomAssignments = await storage.getRoomAssignmentsByStreamName(link.streamName);
          
          return {
            ...link,
            shortLink: shortLink ? `/s/${shortLink.id}` : null,
            shortCode: shortLink?.id || null,
            roomAssignments: roomAssignments || [],
          };
        })
      );
      
      console.log('Links fetched successfully:', links.length, 'links');
      res.json(linksWithEnrichments);
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
      
      const assignedWhipServer = getNextWhipServer();
      const assignedServerAddr = formatServerAddress(assignedWhipServer);

      // Determine WHEP server: per-feed server address override takes priority, then pool round-robin
      const returnFeedName = req.body.returnFeed;
      let assignedWhepServerAddr: string | null = null;
      let assignedWhepFallbackAddr: string | null = null;
      if (returnFeedName) {
        const allFeeds = await storage.getAllReturnFeeds();
        const matchedFeed = allFeeds.find(f => f.streamName === returnFeedName);
        if (matchedFeed?.serverAddress) {
          const feedServers = await getNextFeedServers(matchedFeed);
          assignedWhepServerAddr = feedServers.primary;
          assignedWhepFallbackAddr = feedServers.fallback;
        } else {
          const poolServers = await getNextWhepServers();
          assignedWhepServerAddr = poolServers.primary;
          assignedWhepFallbackAddr = poolServers.fallback;
        }
      } else {
        const poolServers = await getNextWhepServers();
        assignedWhepServerAddr = poolServers.primary;
        assignedWhepFallbackAddr = poolServers.fallback;
      }

      const isAbsoluteUrl = req.body.url.startsWith('http');
      const parsedUrl = new URL(req.body.url, isAbsoluteUrl ? undefined : 'http://placeholder');
      parsedUrl.searchParams.set('token', sessionToken.id);
      parsedUrl.searchParams.set('server', assignedServerAddr);
      if (assignedWhepServerAddr) parsedUrl.searchParams.set('returnServer', assignedWhepServerAddr);
      if (assignedWhepFallbackAddr) parsedUrl.searchParams.set('returnFallbackServer', assignedWhepFallbackAddr);
      const finalUrl = isAbsoluteUrl ? parsedUrl.toString() : `${parsedUrl.pathname}${parsedUrl.search}`;

      const linkData = {
        ...req.body,
        sessionToken: sessionToken.id,
        assignedServer: assignedServerAddr,
        assignedWhepServer: assignedWhepServerAddr,
        url: finalUrl
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

      // Determine WHEP server for return feed delivery
      let assignedWhepServerAddr: string | null = null;
      let assignedWhepFallbackAddr: string | null = null;
      if (returnFeed) {
        const allFeeds = await storage.getAllReturnFeeds();
        const matchedFeed = allFeeds.find(f => f.streamName === returnFeed);
        if (matchedFeed?.serverAddress) {
          const feedServers = await getNextFeedServers(matchedFeed);
          assignedWhepServerAddr = feedServers.primary;
          assignedWhepFallbackAddr = feedServers.fallback;
        } else {
          const poolServers = await getNextWhepServers();
          assignedWhepServerAddr = poolServers.primary;
          assignedWhepFallbackAddr = poolServers.fallback;
        }
      } else {
        const poolServers = await getNextWhepServers();
        assignedWhepServerAddr = poolServers.primary;
        assignedWhepFallbackAddr = poolServers.fallback;
      }

      // Add session token and WHEP server to the viewer link URL
      let finalUrl = `${url}&token=${sessionToken.id}`;
      if (assignedWhepServerAddr) finalUrl += `&server=${encodeURIComponent(assignedWhepServerAddr)}`;
      if (assignedWhepFallbackAddr) finalUrl += `&returnFallbackServer=${encodeURIComponent(assignedWhepFallbackAddr)}`;

      const viewerLinkData = {
        id,
        returnFeed,
        chatEnabled: chatEnabled ?? false,
        url: finalUrl,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        sessionToken: sessionToken.id,
        assignedWhepServer: assignedWhepServerAddr,
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

      // Determine WHEP server for return feed delivery
      let assignedWhepServerAddr: string | null = null;
      let assignedWhepFallbackAddr: string | null = null;
      if (returnFeed) {
        const allFeeds = await storage.getAllReturnFeeds();
        const matchedFeed = allFeeds.find(f => f.streamName === returnFeed);
        if (matchedFeed?.serverAddress) {
          const feedServers = await getNextFeedServers(matchedFeed);
          assignedWhepServerAddr = feedServers.primary;
          assignedWhepFallbackAddr = feedServers.fallback;
        } else {
          const poolServers = await getNextWhepServers();
          assignedWhepServerAddr = poolServers.primary;
          assignedWhepFallbackAddr = poolServers.fallback;
        }
      } else {
        const poolServers = await getNextWhepServers();
        assignedWhepServerAddr = poolServers.primary;
        assignedWhepFallbackAddr = poolServers.fallback;
      }

      const shortViewerLink = await storage.createShortViewerLink({
        id: `v${shortCode}`,
        returnFeed,
        chatEnabled: chatEnabled ?? false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        assignedWhepServer: assignedWhepServerAddr,
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

      // Redirect to viewer page with return feed, session token, and WHEP server
      const whepParam = shortViewerLink.assignedWhepServer ? `&server=${encodeURIComponent(shortViewerLink.assignedWhepServer)}` : '';
      const redirectUrl = `/studio-viewer?return=${encodeURIComponent(shortViewerLink.returnFeed)}&chat=${shortViewerLink.chatEnabled}&token=${matchingViewerLink.sessionToken}${whepParam}`;
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
      const { streamName, returnFeed, chatEnabled, expiresAt, productionId, guestName, guestEmail } = req.body;
      
      // Generate unique short code
      const shortCode = await generateUniqueShortCode(async (code) => {
        const existing = await storage.getShortLink(code);
        return !!existing;
      });

      // Determine WHIP server: prefer the value passed from the frontend (which
      // already created the regular link). If not provided, try to look it up
      // from the regular link that was just created for the same streamName.
      // Only fall back to round-robin if neither source has it.
      let assignedServerAddr: string;
      if (req.body.assignedServer) {
        assignedServerAddr = req.body.assignedServer as string;
      } else {
        const existingLink = await storage.getLinkByStreamName(streamName);
        if (existingLink?.assignedServer) {
          assignedServerAddr = existingLink.assignedServer;
        } else {
          assignedServerAddr = formatServerAddress(getNextWhipServer());
        }
      }

      // Determine WHEP server for return feed delivery
      let assignedWhepServerAddr: string | null = null;
      let assignedWhepFallbackAddr: string | null = null;
      if (returnFeed) {
        const allFeeds = await storage.getAllReturnFeeds();
        const matchedFeed = allFeeds.find(f => f.streamName === returnFeed);
        if (matchedFeed?.serverAddress) {
          const feedServers = await getNextFeedServers(matchedFeed);
          assignedWhepServerAddr = feedServers.primary;
          assignedWhepFallbackAddr = feedServers.fallback;
        } else {
          const poolServers = await getNextWhepServers();
          assignedWhepServerAddr = poolServers.primary;
          assignedWhepFallbackAddr = poolServers.fallback;
        }
      } else {
        const poolServers = await getNextWhepServers();
        assignedWhepServerAddr = poolServers.primary;
        assignedWhepFallbackAddr = poolServers.fallback;
      }

      const shortLink = await storage.createShortLink({
        id: shortCode,
        streamName,
        returnFeed,
        chatEnabled: chatEnabled ?? false,
        assignedServer: assignedServerAddr,
        assignedWhepServer: assignedWhepServerAddr,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        productionId: productionId || null,
        guestName: guestName || null,
        guestEmail: guestEmail || null,
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

      const chatParam = shortLink.chatEnabled ? '&chat=true' : '';
      const tokenParam = originalLink.sessionToken ? `&token=${originalLink.sessionToken}` : '';
      const serverParam = (shortLink.assignedServer || originalLink.assignedServer) ? `&server=${encodeURIComponent(shortLink.assignedServer || originalLink.assignedServer || '')}` : '';
      const returnServerParam = (shortLink.assignedWhepServer || originalLink.assignedWhepServer) ? `&returnServer=${encodeURIComponent(shortLink.assignedWhepServer || originalLink.assignedWhepServer || '')}` : '';
      // Look up fallback server from the return feed at redirect time
      const allFeedsForFallback = await storage.getAllReturnFeeds();
      const feedForFallback = allFeedsForFallback.find(f => f.streamName === shortLink.returnFeed);
      const fallbackAddr = feedForFallback?.fallbackServerAddress;
      const returnFallbackParam = fallbackAddr ? `&returnFallbackServer=${encodeURIComponent(fallbackAddr)}` : '';
      const redirectUrl = `/session?stream=${encodeURIComponent(shortLink.streamName)}&return=${encodeURIComponent(shortLink.returnFeed)}${chatParam}${tokenParam}${serverParam}${returnServerParam}${returnFallbackParam}`;
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

  // Email Invite API Routes
  app.post('/api/invites/streaming', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { email, linkId, message } = req.body;

      if (!email || !linkId) {
        return res.status(400).json({ error: 'Email and link ID are required' });
      }

      // Get the streaming link details
      const link = await storage.getLink(linkId);
      if (!link) {
        return res.status(404).json({ error: 'Streaming link not found' });
      }

      // Try to find existing short link or create a new one
      let shortLink = await storage.getShortLinkByParams(
        link.streamName, 
        link.returnFeed, 
        link.chatEnabled
      );

      if (!shortLink) {
        // Create a new short link with same expiration as the original link
        const checkShortLinkExists = async (code: string) => {
          const existing = await storage.getShortLink(code);
          return existing !== undefined;
        };
        
        const shortCode = await generateUniqueShortCode(checkShortLinkExists);
        shortLink = await storage.createShortLink({
          id: shortCode,
          streamName: link.streamName,
          returnFeed: link.returnFeed,
          chatEnabled: link.chatEnabled,
          expiresAt: link.expiresAt
        }, user.id);
      }

      // Create the professional short URL
      const baseUrl = req.protocol + '://' + req.get('host');
      const streamingUrl = `${baseUrl}/s/${shortLink.id}`;

      // Send the invite email
      const success = await sendStreamingInvite({
        to: email,
        inviterName: user.username,
        streamingLink: streamingUrl,
        linkExpiry: link.expiresAt || undefined,
        message
      });

      if (success) {
        res.json({ success: true, message: 'Streaming invite sent successfully' });
      } else {
        res.status(500).json({ error: 'Failed to send invite email' });
      }
    } catch (error) {
      console.error('Failed to send streaming invite:', error);
      res.status(500).json({ error: 'Failed to send streaming invite' });
    }
  });

  app.post('/api/invites/viewer', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { email, linkId, message } = req.body;

      if (!email || !linkId) {
        return res.status(400).json({ error: 'Email and link ID are required' });
      }

      // Get the viewer link details
      const link = await storage.getViewerLink(linkId);
      if (!link) {
        return res.status(404).json({ error: 'Viewer link not found' });
      }

      // Try to find existing short viewer link or create a new one
      let shortLink = await storage.getShortViewerLinkByParams(
        link.returnFeed, 
        link.chatEnabled
      );

      if (!shortLink) {
        // Create a new short viewer link with same expiration as the original link
        const checkShortViewerLinkExists = async (code: string) => {
          const existing = await storage.getShortViewerLink(code);
          return existing !== undefined;
        };
        
        const shortCode = await generateUniqueShortCode(checkShortViewerLinkExists);
        shortLink = await storage.createShortViewerLink({
          id: shortCode,
          returnFeed: link.returnFeed,
          chatEnabled: link.chatEnabled,
          expiresAt: link.expiresAt
        }, user.id);
      }

      // Create the professional short URL
      const baseUrl = req.protocol + '://' + req.get('host');
      const viewerUrl = `${baseUrl}/v/${shortLink.id}`;

      // Send the invite email
      const success = await sendViewerInvite({
        to: email,
        inviterName: user.username,
        viewerLink: viewerUrl,
        linkExpiry: link.expiresAt || undefined,
        message
      });

      if (success) {
        res.json({ success: true, message: 'Viewer invite sent successfully' });
      } else {
        res.status(500).json({ error: 'Failed to send invite email' });
      }
    } catch (error) {
      console.error('Failed to send viewer invite:', error);
      res.status(500).json({ error: 'Failed to send viewer invite' });
    }
  });

  app.post('/api/invites/short-link', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { email, shortCode, message } = req.body;

      if (!email || !shortCode) {
        return res.status(400).json({ error: 'Email and short code are required' });
      }

      // Get the short link details
      const shortLink = await storage.getShortLink(shortCode);
      if (!shortLink) {
        return res.status(404).json({ error: 'Short link not found' });
      }

      // Create the full URL for the short link
      const baseUrl = req.protocol + '://' + req.get('host');
      const shortUrl = `${baseUrl}/s/${shortCode}`;

      // Send the invite email as a streaming invite since short links redirect to streaming sessions
      const success = await sendStreamingInvite({
        to: email,
        inviterName: user.username,
        streamingLink: shortUrl,
        linkExpiry: shortLink.expiresAt || undefined,
        message
      });

      if (success) {
        res.json({ success: true, message: 'Short link invite sent successfully' });
      } else {
        res.status(500).json({ error: 'Failed to send invite email' });
      }
    } catch (error) {
      console.error('Failed to send short link invite:', error);
      res.status(500).json({ error: 'Failed to send short link invite' });
    }
  });

  // Consent Recording API
  const VALID_CONSENT_TYPES = ['camera_microphone', 'recording', 'broadcast', 'privacy_policy'] as const;
  
  app.post('/api/consent', async (req, res) => {
    try {
      const { consentTypes, streamName, guestIdentifier } = req.body;

      if (!consentTypes || !Array.isArray(consentTypes) || consentTypes.length === 0) {
        return res.status(400).json({ error: 'At least one consent type is required' });
      }

      const invalidTypes = consentTypes.filter((t: string) => !VALID_CONSENT_TYPES.includes(t as any));
      if (invalidTypes.length > 0) {
        return res.status(400).json({ error: `Invalid consent types: ${invalidTypes.join(', ')}` });
      }

      if (!streamName || typeof streamName !== 'string') {
        return res.status(400).json({ error: 'streamName is required' });
      }

      const authenticatedUser = req.isAuthenticated?.() ? req.user as any : null;
      const resolvedUserId = authenticatedUser?.id || null;
      const resolvedGuestIdentifier = !resolvedUserId ? (guestIdentifier || null) : null;

      const ipAddress = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const consentTexts: Record<string, string> = {
        camera_microphone: 'I consent to the use of my camera and microphone for live video and audio streaming. I understand my video and audio will be captured and transmitted in real-time.',
        recording: 'I consent to the recording of my video and audio during this streaming session. I understand this recording may be stored and used for broadcast purposes.',
        broadcast: 'I consent to my video and audio being broadcast on live television, streaming platforms, and related media in the United States. I understand this broadcast may reach a public audience.',
        privacy_policy: 'I have read and agree to the Privacy Policy. I understand how my personal data, video, and audio will be collected, used, and stored.',
      };

      const records = [];
      for (const consentType of consentTypes) {
        const record = await storage.createConsentRecord({
          sessionId: null,
          userId: resolvedUserId,
          guestIdentifier: resolvedGuestIdentifier,
          consentType,
          consentText: consentTexts[consentType] || `Consent granted for: ${consentType}`,
          granted: true,
          ipAddress,
          userAgent,
          streamName,
        });
        records.push(record);
      }

      res.status(201).json({ 
        success: true, 
        records,
        message: 'Consent recorded successfully' 
      });
    } catch (error) {
      console.error('Failed to record consent:', error);
      res.status(500).json({ error: 'Failed to record consent' });
    }
  });

  app.get('/api/consent/records', requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const records = await storage.getAllConsentRecords(limit, offset);
      res.json(records);
    } catch (error) {
      console.error('Failed to fetch consent records:', error);
      res.status(500).json({ error: 'Failed to fetch consent records' });
    }
  });

  app.get('/api/consent/records/:streamName', requireAdmin, async (req, res) => {
    try {
      const records = await storage.getConsentRecordsByStream(req.params.streamName);
      res.json(records);
    } catch (error) {
      console.error('Failed to fetch consent records:', error);
      res.status(500).json({ error: 'Failed to fetch consent records' });
    }
  });

  // SRS Server Configuration API
  app.get('/api/srs/config', (req, res) => {
    try {
      const config = getSRSConfig();
      res.json({
        // Legacy properties for backward compatibility
        host: config.host,
        whipPort: config.whipPort,
        apiPort: config.apiPort,
        useHttps: config.useHttps,
        
        // New separate server configurations
        whip: config.whip,
        whep: config.whep,
        studio: config.studio,
        api: config.api,
        
        whipBaseUrl: `${config.whip.useHttps ? 'https' : 'http'}://${config.whip.host}:${config.whip.port}/rtc/v1/whip/`,
        whepBaseUrl: `${config.whep.useHttps ? 'https' : 'http'}://${config.whep.host}:${config.whep.port}/rtc/v1/whep/`,
        studioWhepBaseUrl: `${config.studio.useHttps ? 'https' : 'http'}://${config.studio.host}:${config.studio.port}/rtc/v1/whep/`,
        apiBaseUrl: `${config.api.useHttps ? 'https' : 'http'}://${config.api.host}:${config.api.port}/api/v1/`,
        
        whipServers: getWhipServerList().map(s => ({
          host: s.host,
          port: s.port,
          useHttps: s.useHttps,
          address: formatServerAddress(s),
        })),
      });
    } catch (error) {
      console.error('Error getting SRS config:', error);
      res.status(500).json({ error: 'Failed to get SRS server configuration' });
    }
  });

  // SRS Server Health Check API
  app.get('/api/srs/health', async (req, res) => {
    try {
      const config = getSRSConfig();
      
      // Health check functions with timeout
      const checkService = async (url: string, name: string) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000); // 3 second timeout
          
          const response = await fetch(url, { 
            signal: controller.signal,
            method: 'HEAD' // Use HEAD to avoid downloading content
          });
          clearTimeout(timeout);
          
          return {
            name,
            status: response.ok ? 'online' : 'error',
            statusCode: response.status,
            url
          };
        } catch (error) {
          return {
            name,
            status: 'offline',
            error: error instanceof Error ? error.message : 'Unknown error',
            url
          };
        }
      };

      // Check all services in parallel
      const [whipHealth, whepHealth, apiHealth] = await Promise.all([
        checkService(`${config.whip.useHttps ? 'https' : 'http'}://${config.whip.host}:${config.whip.port}/`, 'WHIP'),
        checkService(`${config.whep.useHttps ? 'https' : 'http'}://${config.whep.host}:${config.whep.port}/`, 'WHEP'),
        checkService(`${config.api.useHttps ? 'https' : 'http'}://${config.api.host}:${config.api.port}/api/v1/summaries`, 'API')
      ]);

      res.json({
        timestamp: Date.now(),
        services: {
          whip: whipHealth,
          whep: whepHealth,
          api: apiHealth
        }
      });
    } catch (error) {
      console.error('Error checking SRS health:', error);
      res.status(500).json({ 
        error: 'Failed to check SRS server health',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // SRS Server Monitoring API - Multiple Servers
  app.get('/api/srs/stats', async (req, res) => {
    try {
      const config = getSRSConfig();
      
      // Function to fetch stats from a server
      const fetchServerStats = async (serverConfig: any, serverName: string) => {
        try {
          const protocol = serverConfig.useHttps ? 'https' : 'http';
          const statsUrl = `${protocol}://${serverConfig.host}:${serverConfig.port}/api/v1/summaries`;
          
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
          
          const response = await fetch(statsUrl, { 
            signal: controller.signal 
          });
          clearTimeout(timeout);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const data = await response.json();
          return {
            server: serverName,
            status: 'online',
            data
          };
        } catch (error) {
          return {
            server: serverName,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            data: null
          };
        }
      };

      // Fetch stats from each server's API
      const [whipStats, whepStats] = await Promise.all([
        fetchServerStats(config.whip.api, 'WHIP Server'),
        fetchServerStats(config.whep.api, 'WHEP Server')
      ]);

      res.json({
        timestamp: Date.now(),
        servers: {
          whip: whipStats,
          whep: whepStats
        }
      });
    } catch (error) {
      console.error('Error fetching SRS stats:', error);
      res.status(500).json({ 
        error: 'Failed to fetch SRS server statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Room management routes
  app.get('/api/rooms', requireAuth, async (req, res) => {
    try {
      const rooms = await storage.getAllRooms();
      res.json(rooms);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      res.status(500).json({ error: 'Failed to fetch rooms' });
    }
  });

  app.get('/api/rooms/:id', requireAuth, async (req, res) => {
    try {
      const room = await storage.getRoom(req.params.id);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      res.json(room);
    } catch (error) {
      console.error('Failed to fetch room:', error);
      res.status(500).json({ error: 'Failed to fetch room' });
    }
  });

  app.post('/api/rooms', requireAdminOrEngineer, async (req, res) => {
    try {
      const roomData = insertRoomSchema.parse(req.body);
      const user = req.user as any;
      
      const room = await storage.createRoom(roomData, user.id);
      res.status(201).json(room);
    } catch (error) {
      console.error('Failed to create room:', error);
      res.status(500).json({ error: 'Failed to create room' });
    }
  });

  app.put('/api/rooms/:id', requireAdminOrEngineer, async (req, res) => {
    try {
      const roomData = insertRoomSchema.partial().parse(req.body);
      const room = await storage.updateRoom(req.params.id, roomData);
      
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      res.json(room);
    } catch (error) {
      console.error('Failed to update room:', error);
      res.status(500).json({ error: 'Failed to update room' });
    }
  });

  app.delete('/api/rooms/:id', requireAdminOrEngineer, async (req, res) => {
    try {
      const success = await storage.deleteRoom(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Room not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete room:', error);
      res.status(500).json({ error: 'Failed to delete room' });
    }
  });

  // Room participants routes
  app.get('/api/rooms/:id/participants', requireAuth, async (req, res) => {
    try {
      const participants = await storage.getRoomParticipants(req.params.id);
      res.json(participants);
    } catch (error) {
      console.error('Failed to fetch room participants:', error);
      res.status(500).json({ error: 'Failed to fetch room participants' });
    }
  });

  app.post('/api/rooms/:id/participants', requireAuth, async (req, res) => {
    try {
      const participantData = insertRoomParticipantSchema.parse({
        ...req.body,
        roomId: req.params.id,
      });
      
      const participant = await storage.addRoomParticipant(participantData);
      res.status(201).json(participant);
    } catch (error) {
      console.error('Failed to add room participant:', error);
      res.status(500).json({ error: 'Failed to add room participant' });
    }
  });

  app.delete('/api/rooms/:id/participants/:userId', requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      await storage.removeRoomParticipant(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to remove room participant:', error);
      res.status(500).json({ error: 'Failed to remove room participant' });
    }
  });

  // Remove guest participant by name
  app.delete('/api/rooms/:id/participants/guest/:guestName', requireAdminOrEngineer, async (req, res) => {
    try {
      const { id: roomId, guestName } = req.params;
      console.log(`Attempting to remove guest "${guestName}" from room "${roomId}"`);
      
      // Remove guest from room participants
      await storage.removeRoomParticipantByName(roomId, guestName);
      console.log(`Removed guest "${guestName}" from participants table`);
      
      // Also remove any stream assignments for this guest
      const assignments = await storage.getRoomStreamAssignments(roomId);
      const guestAssignments = assignments.filter(a => a.assignedGuestName === guestName);
      console.log(`Found ${guestAssignments.length} assignments for guest "${guestName}"`);
      
      for (const assignment of guestAssignments) {
        console.log(`Deleting assignment ${assignment.id} for stream "${assignment.streamName}"`);
        // Delete the entire assignment instead of just nullifying the guest name
        await storage.deleteRoomStreamAssignment(assignment.id);
      }

      console.log(`Successfully removed guest "${guestName}" and ${guestAssignments.length} assignments`);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to remove guest participant:', error);
      res.status(500).json({ error: 'Failed to remove guest participant' });
    }
  });

  // Room stream assignments routes
  app.get('/api/rooms/:id/streams', requireAdminOrEngineer, async (req, res) => {
    try {
      const assignments = await storage.getRoomStreamAssignments(req.params.id);
      res.json(assignments);
    } catch (error) {
      console.error('Failed to fetch room stream assignments:', error);
      res.status(500).json({ error: 'Failed to fetch room stream assignments' });
    }
  });

  app.post('/api/rooms/:id/streams', requireAdminOrEngineer, async (req, res) => {
    try {
      const assignmentData = insertRoomStreamAssignmentSchema.parse({
        ...req.body,
        roomId: req.params.id,
      });
      const user = req.user as any;
      
      const assignment = await storage.createRoomStreamAssignment(assignmentData, user.id);
      res.status(201).json(assignment);
    } catch (error) {
      console.error('Failed to create room stream assignment:', error);
      res.status(500).json({ error: 'Failed to create room stream assignment' });
    }
  });

  app.put('/api/rooms/:id/streams/:assignmentId', requireAdminOrEngineer, async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      const assignmentData = insertRoomStreamAssignmentSchema.partial().parse(req.body);
      
      const assignment = await storage.updateRoomStreamAssignment(assignmentId, assignmentData);
      if (!assignment) {
        return res.status(404).json({ error: 'Stream assignment not found' });
      }
      
      res.json(assignment);
    } catch (error) {
      console.error('Failed to update room stream assignment:', error);
      res.status(500).json({ error: 'Failed to update room stream assignment' });
    }
  });

  app.delete('/api/rooms/:id/streams/:assignmentId', requireAdminOrEngineer, async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      const success = await storage.deleteRoomStreamAssignment(assignmentId);
      
      if (!success) {
        return res.status(404).json({ error: 'Stream assignment not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete room stream assignment:', error);
      res.status(500).json({ error: 'Failed to delete room stream assignment' });
    }
  });

  // Quick assign route for convenience
  app.post('/api/rooms/:id/assign', requireAuth, async (req, res) => {
    try {
      const assignmentData = insertRoomStreamAssignmentSchema.parse({
        roomId: req.params.id,
        streamName: req.body.streamName,
        assignedGuestName: req.body.assignedGuestName,
        position: req.body.position || 0,
      });
      
      // If assigning a stream, first remove it from any other room assignments
      if (assignmentData.streamName) {
        const allRooms = await storage.getAllRooms();
        
        for (const room of allRooms) {
          if (room.id !== assignmentData.roomId) {
            const roomAssignments = await storage.getRoomStreamAssignments(room.id);
            const streamAssignments = roomAssignments.filter(assignment => 
              assignment.streamName === assignmentData.streamName
            );
            
            // Remove the entire assignment if it's the same stream
            for (const assignment of streamAssignments) {
              await storage.deleteRoomStreamAssignment(assignment.id);
            }
            
            // Also remove the guest from room participants in other rooms
            if (streamAssignments.length > 0 && assignmentData.assignedGuestName) {
              await storage.removeRoomParticipantByName(room.id, assignmentData.assignedGuestName);
            }
          }
        }
      }
      
      const user = req.user as any;
      const assignment = await storage.createRoomStreamAssignment(assignmentData, user.id);
      
      res.status(201).json(assignment);
    } catch (error) {
      console.error('Failed to assign stream to room:', error);
      res.status(500).json({ error: 'Failed to assign stream to room' });
    }
  });

  // Clean up duplicate stream assignments (temporary endpoint to fix existing issues)
  app.post('/api/rooms/cleanup-assignments', requireAdminOrEngineer, async (req, res) => {
    try {
      const allRooms = await storage.getAllRooms();
      const streamAssignmentCounts = new Map<string, Array<{roomId: string, assignmentId: number}>>();
      
      // Collect all stream assignments
      for (const room of allRooms) {
        const assignments = await storage.getRoomStreamAssignments(room.id);
        for (const assignment of assignments) {
          if (!streamAssignmentCounts.has(assignment.streamName)) {
            streamAssignmentCounts.set(assignment.streamName, []);
          }
          streamAssignmentCounts.get(assignment.streamName)!.push({
            roomId: room.id,
            assignmentId: assignment.id
          });
        }
      }
      
      let cleanedCount = 0;
      
      // For each stream that appears in multiple rooms, keep only the most recent assignment
      for (const [streamName, assignments] of Array.from(streamAssignmentCounts.entries())) {
        if (assignments.length > 1) {
          // Sort by assignment ID (newer assignments have higher IDs) and keep the last one
          assignments.sort((a: any, b: any) => a.assignmentId - b.assignmentId);
          const toKeep = assignments.pop()!; // Keep the most recent
          
          // Delete the older duplicates
          for (const assignmentToDelete of assignments) {
            await storage.deleteRoomStreamAssignment(assignmentToDelete.assignmentId);
            cleanedCount++;
          }
        }
      }
      
      res.json({ 
        success: true, 
        cleanedAssignments: cleanedCount,
        message: `Cleaned up ${cleanedCount} duplicate stream assignments`
      });
    } catch (error) {
      console.error('Failed to cleanup assignments:', error);
      res.status(500).json({ error: 'Failed to cleanup assignments' });
    }
  });

  // Public room view for sharing (no auth required)
  app.get('/api/rooms/:id/public', async (req, res) => {
    try {
      const room = await storage.getRoom(req.params.id);
      if (!room || !room.isActive) {
        return res.status(404).json({ error: 'Room not found or inactive' });
      }

      const participants = await storage.getRoomParticipants(req.params.id);
      const assignments = await storage.getRoomStreamAssignments(req.params.id);

      const allLinks = await storage.getAllLinks();
      const whepUrls = assignments.map(assignment => {
        const link = allLinks.find(l => l.streamName === assignment.streamName);
        const server = link?.assignedServer ? parseServerAddress(link.assignedServer) : null;
        return {
          streamName: assignment.streamName,
          url: server ? buildServerWhepUrl(server, 'live', assignment.streamName) : getSRSWhepUrl('live', assignment.streamName),
          position: assignment.position,
          assignedUser: assignment.assignedUserId,
          assignedGuest: assignment.assignedGuestName,
        };
      });

      res.json({
        room,
        participants,
        assignments,
        whepUrls,
      });
    } catch (error) {
      console.error('Failed to get public room:', error);
      res.status(500).json({ error: 'Failed to get room data' });
    }
  });

  // Room access route for joining rooms
  app.get('/api/rooms/:id/join', requireAuth, async (req, res) => {
    try {
      const room = await storage.getRoom(req.params.id);
      if (!room || !room.isActive) {
        return res.status(404).json({ error: 'Room not found or inactive' });
      }

      const participants = await storage.getRoomParticipants(req.params.id);
      const assignments = await storage.getRoomStreamAssignments(req.params.id);

      const allLinks = await storage.getAllLinks();
      const whepUrls = assignments.map(assignment => {
        const link = allLinks.find(l => l.streamName === assignment.streamName);
        const server = link?.assignedServer ? parseServerAddress(link.assignedServer) : null;
        return {
          streamName: assignment.streamName,
          url: server ? buildServerWhepUrl(server, 'live', assignment.streamName) : getSRSWhepUrl('live', assignment.streamName),
          position: assignment.position,
          assignedUser: assignment.assignedUserId,
          assignedGuest: assignment.assignedGuestName,
        };
      });

      res.json({
        room,
        participants,
        assignments,
        whepUrls,
      });
    } catch (error) {
      console.error('Failed to join room:', error);
      res.status(500).json({ error: 'Failed to join room' });
    }
  });

  // ===================== Return Feeds Settings API =====================

  app.get('/api/return-feeds', requireAdminOrEngineer, async (req, res) => {
    try {
      const feeds = await storage.getAllReturnFeeds();
      res.json(feeds);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch return feeds' });
    }
  });

  app.post('/api/return-feeds', requireAdmin, async (req, res) => {
    try {
      const { label, streamName, serverAddress, fallbackServerAddress, sortOrder } = req.body;
      if (!label || !streamName) return res.status(400).json({ error: 'label and streamName are required' });
      const feed = await storage.createReturnFeed({ label, streamName, serverAddress: serverAddress || null, fallbackServerAddress: fallbackServerAddress || null, sortOrder: sortOrder ?? 0 });
      res.status(201).json(feed);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create return feed' });
    }
  });

  app.put('/api/return-feeds/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { label, streamName, serverAddress, fallbackServerAddress, sortOrder } = req.body;
      const feed = await storage.updateReturnFeed(id, { label, streamName, serverAddress: serverAddress || null, fallbackServerAddress: fallbackServerAddress || null, sortOrder });
      if (!feed) return res.status(404).json({ error: 'Return feed not found' });
      res.json(feed);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update return feed' });
    }
  });

  app.delete('/api/return-feeds/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteReturnFeed(id);
      if (!deleted) return res.status(404).json({ error: 'Return feed not found' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete return feed' });
    }
  });

  // WHEP Server Pool — dedicated servers for return feed delivery
  app.get('/api/whep-servers', requireAdminOrEngineer, async (req, res) => {
    try {
      const servers = await storage.getAllWhepServers();
      res.json(servers);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch WHEP servers' });
    }
  });

  app.post('/api/whep-servers', requireAdmin, async (req, res) => {
    try {
      const { label, address, isActive, sortOrder } = req.body;
      if (!label || !address) return res.status(400).json({ error: 'label and address are required' });
      const server = await storage.createWhepServer({ label, address, isActive: isActive ?? true, sortOrder: sortOrder ?? 0 });
      res.status(201).json(server);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create WHEP server' });
    }
  });

  app.put('/api/whep-servers/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { label, address, isActive, sortOrder } = req.body;
      const server = await storage.updateWhepServer(id, { label, address, isActive, sortOrder });
      if (!server) return res.status(404).json({ error: 'WHEP server not found' });
      res.json(server);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update WHEP server' });
    }
  });

  app.delete('/api/whep-servers/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteWhepServer(id);
      if (!deleted) return res.status(404).json({ error: 'WHEP server not found' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete WHEP server' });
    }
  });

  // GET unique return feed stream names (used to populate dropdown in production form)
  app.get('/api/stream-names', requireAdminOrEngineer, async (req, res) => {
    try {
      const feeds = await storage.getUniqueReturnFeeds();
      res.json(feeds);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stream names' });
    }
  });

  // ===================== Productions API =====================

  // GET all productions
  app.get('/api/productions', requireAdminOrEngineer, async (req, res) => {
    try {
      const prods = await storage.getAllProductions();
      res.json(prods);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch productions' });
    }
  });

  // GET single production
  app.get('/api/productions/:id', requireAdminOrEngineer, async (req, res) => {
    try {
      const prod = await storage.getProduction(req.params.id);
      if (!prod) return res.status(404).json({ error: 'Production not found' });
      res.json(prod);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch production' });
    }
  });

  // POST create production
  app.post('/api/productions', requireAdminOrEngineer, async (req, res) => {
    try {
      const data = insertProductionSchema.parse(req.body);
      const prod = await storage.createProduction(data, (req.user as any)?.id);
      res.status(201).json(prod);
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: 'Failed to create production' });
    }
  });

  // PUT update production
  app.put('/api/productions/:id', requireAdminOrEngineer, async (req, res) => {
    try {
      const data = insertProductionSchema.partial().parse(req.body);
      const prod = await storage.updateProduction(req.params.id, data);
      if (!prod) return res.status(404).json({ error: 'Production not found' });
      // If maxLiveParticipants changed, update in-memory WS state
      if (data.maxLiveParticipants !== undefined) {
        const wsServer = (global as any).chatWebSocketServer as InstanceType<typeof ChatWebSocketServer>;
        if (wsServer) wsServer.updateProductionCapacity(req.params.id, data.maxLiveParticipants);
      }
      res.json(prod);
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: 'Failed to update production' });
    }
  });

  // DELETE production
  app.delete('/api/productions/:id', requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteProduction(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Production not found' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete production' });
    }
  });

  // GET participants for a production (DB links + in-memory live/waiting status)
  app.get('/api/productions/:id/participants', requireAdminOrEngineer, async (req, res) => {
    try {
      const prod = await storage.getProduction(req.params.id);
      if (!prod) return res.status(404).json({ error: 'Production not found' });

      const links = await storage.getLinksByProduction(req.params.id);
      const wsServer = (global as any).chatWebSocketServer as InstanceType<typeof ChatWebSocketServer>;
      const liveStatus = wsServer ? wsServer.getProductionLiveStatus(req.params.id) : null;

      const now = new Date();
      const participants = links.map(link => {
        let status: 'offline' | 'live' | 'waiting' = 'offline';
        let position: number | undefined;
        if (liveStatus) {
          if (liveStatus.liveIds.includes(link.id)) {
            status = 'live';
          } else {
            const waiter = liveStatus.waitingIds.find(w => w.linkId === link.id);
            if (waiter) {
              status = 'waiting';
              position = waiter.position;
            }
          }
        }
        // Determine whether the link itself is valid (not expired)
        const linkStatus: 'active' | 'expired' = (!link.expiresAt || new Date(link.expiresAt) > now) ? 'active' : 'expired';
        return { ...link, status, position, linkStatus };
      });

      res.json({ production: prod, participants });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch participants' });
    }
  });

  // POST promote a waiting participant to live
  app.post('/api/productions/:id/participants/:linkId/promote', requireAdminOrEngineer, async (req, res) => {
    try {
      const wsServer = (global as any).chatWebSocketServer as InstanceType<typeof ChatWebSocketServer>;
      if (!wsServer) return res.status(503).json({ error: 'WebSocket server not available' });
      const promoted = wsServer.promoteParticipantByLinkId(req.params.id, req.params.linkId);
      if (!promoted) {
        return res.status(404).json({ error: 'Participant not found in waiting queue' });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to promote participant' });
    }
  });

  // POST add participants (generate links) for a production
  // Body: { guests: [{ guestName, guestEmail }] }
  app.post('/api/productions/:id/participants', requireAdminOrEngineer, async (req, res) => {
    try {
      const prod = await storage.getProduction(req.params.id);
      if (!prod) return res.status(404).json({ error: 'Production not found' });

      const { guests } = req.body as { guests: Array<{ guestName: string; guestEmail: string }> };
      if (!Array.isArray(guests) || guests.length === 0) {
        return res.status(400).json({ error: 'guests array is required' });
      }

      const userId = (req.user as any)?.id;
      const platformUrl = `${req.protocol}://${req.get('host')}`;
      const createdLinks = [];

      // Fetch return feeds once for the whole batch (avoids N+1 queries)
      const returnFeed = prod.returnFeed;
      const allFeedsForProd = await storage.getAllReturnFeeds();
      const matchedFeedForProd = allFeedsForProd.find(f => f.streamName === returnFeed);

      for (const guest of guests) {
        if (!guest.guestEmail || !guest.guestEmail.trim()) continue;

        const linkId = Date.now().toString() + Math.random().toString(36).slice(2, 6);
        const streamName = `prod-${req.params.id.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`;
        const baseUrl = `${platformUrl}/session?stream=${encodeURIComponent(streamName)}&return=${encodeURIComponent(returnFeed)}&chat=true`;

        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
        const sessionToken = await storage.createSessionToken(linkId, 'guest', expiresAt, userId);

        // Round-robin called once per guest; same server used for both
        // the regular link and the short link below.
        const assignedWhipServer = getNextWhipServer();
        const assignedServerAddr = formatServerAddress(assignedWhipServer);

        // Determine WHEP server for return feed delivery (round-robin with fallback)
        let assignedWhepServerAddr: string | null = null;
        let assignedWhepFallbackAddr: string | null = null;
        if (matchedFeedForProd?.serverAddress) {
          const feedServers = await getNextFeedServers(matchedFeedForProd);
          assignedWhepServerAddr = feedServers.primary;
          assignedWhepFallbackAddr = feedServers.fallback;
        } else {
          const poolServers = await getNextWhepServers();
          assignedWhepServerAddr = poolServers.primary;
          assignedWhepFallbackAddr = poolServers.fallback;
        }

        let finalUrl = `${baseUrl}&token=${sessionToken.id}&server=${assignedServerAddr}`;
        if (assignedWhepServerAddr) finalUrl += `&returnServer=${encodeURIComponent(assignedWhepServerAddr)}`;
        if (assignedWhepFallbackAddr) finalUrl += `&returnFallbackServer=${encodeURIComponent(assignedWhepFallbackAddr)}`;

        const linkData = {
          id: linkId,
          streamName,
          returnFeed,
          chatEnabled: true,
          url: finalUrl,
          sessionToken: sessionToken.id,
          assignedServer: assignedServerAddr,
          assignedWhepServer: assignedWhepServerAddr,
          productionId: req.params.id,
          guestName: guest.guestName?.trim() || null,
          guestEmail: guest.guestEmail.trim(),
          expiresAt,
          inviteStatus: 'pending' as const,
        };

        const link = await storage.createLink(linkData, userId);

        // Also create a short link for this participant
        const { randomBytes } = await import('crypto');
        const shortCode = randomBytes(3).toString('hex');
        try {
          await storage.createShortLink({
            id: shortCode,
            streamName,
            returnFeed,
            chatEnabled: true,
            sessionToken: undefined,
            assignedServer: assignedServerAddr,
            assignedWhepServer: assignedWhepServerAddr,
            productionId: req.params.id,
            guestName: guest.guestName?.trim() || null,
            guestEmail: guest.guestEmail.trim(),
            expiresAt,
            inviteStatus: 'pending',
          }, userId);
          createdLinks.push({ ...link, shortCode, shortUrl: `${platformUrl}/s/${shortCode}` });
        } catch (shortLinkErr) {
          console.error(`Failed to create short link for participant ${guest.guestEmail}:`, shortLinkErr);
          createdLinks.push({ ...link, shortCode: null, shortUrl: null });
        }
      }

      res.status(201).json({ created: createdLinks });
    } catch (error) {
      console.error('Failed to add participants:', error);
      res.status(500).json({ error: 'Failed to add participants' });
    }
  });

  // POST send invite emails to participants
  // Body: Array<{ guestName, guestEmail, linkId }> — send to specific links
  //   OR: { linkIds: string[] } — legacy shorthand
  //   OR: empty body — send to all unsent/failed participants
  app.post('/api/productions/:id/invite', requireAdminOrEngineer, async (req, res) => {
    try {
      const prod = await storage.getProduction(req.params.id);
      if (!prod) return res.status(404).json({ error: 'Production not found' });

      const { sendProductionInvite } = await import('./email-service');
      const platformUrl = `${req.protocol}://${req.get('host')}`;

      // Resolve target link IDs from request body
      let targetLinkIds: string[] | null = null;

      if (Array.isArray(req.body)) {
        // Spec-conformant format: [{ guestName, guestEmail, linkId }]
        const items = req.body as Array<{ guestName?: string; guestEmail?: string; linkId: string }>;
        targetLinkIds = items.filter(i => i.linkId).map(i => i.linkId);
      } else if (req.body?.linkIds && Array.isArray(req.body.linkIds)) {
        // Legacy shorthand: { linkIds: string[] }
        targetLinkIds = req.body.linkIds;
      }
      // null = empty body → send to all unsent/failed

      let links = await storage.getLinksByProduction(req.params.id);

      if (targetLinkIds && targetLinkIds.length > 0) {
        links = links.filter(l => targetLinkIds!.includes(l.id));
      } else {
        // Default: only send to unsent (no inviteStatus or status=pending/failed)
        links = links.filter(l => !l.inviteStatus || l.inviteStatus === 'pending' || l.inviteStatus === 'failed');
      }

      const results: Array<{ linkId: string; success: boolean; email?: string; error?: string }> = [];

      for (const link of links) {
        if (!link.guestEmail) {
          results.push({ linkId: link.id, success: false, error: 'No email address' });
          continue;
        }

        // Resolve personal short link for this participant; fall back to full URL
        const shortLink = await storage.getShortLinkByParams(link.streamName, link.returnFeed, link.chatEnabled);
        const joinUrl = shortLink
          ? `${platformUrl}/s/${shortLink.id}`
          : link.url;

        try {
          const sent = await sendProductionInvite({
            to: link.guestEmail,
            guestName: link.guestName || 'Valued Guest',
            productionName: prod.name,
            scheduledAt: prod.scheduledAt,
            description: prod.description,
            joinLink: joinUrl,
          });

          const status = sent ? 'sent' : 'failed';
          await storage.updateLinkInviteStatus(link.id, status, sent ? new Date() : undefined);
          results.push({ linkId: link.id, success: sent, email: link.guestEmail });
        } catch (err) {
          await storage.updateLinkInviteStatus(link.id, 'failed');
          results.push({ linkId: link.id, success: false, email: link.guestEmail, error: 'Send error' });
        }
      }

      const sent = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      res.json({ sent, failed, results });
    } catch (error) {
      console.error('Failed to send invites:', error);
      res.status(500).json({ error: 'Failed to send invites' });
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
