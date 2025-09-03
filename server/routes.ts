import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireAdmin, requireAdminOrEngineer } from "./auth";
import { ChatWebSocketServer } from "./chat-websocket";
import { insertUserSchema, insertShortLinkSchema, insertRoomSchema, insertRoomParticipantSchema, insertRoomStreamAssignmentSchema } from "@shared/schema";
import { generateUniqueShortCode } from "./utils/shortCode";
import { getSRSApiUrl, getSRSConfig, getSRSWhipUrl, getSRSWhepUrl } from "./utils/srs-config";
import { sendStreamingInvite, sendViewerInvite } from "./email-service";

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
        api: config.api,
        
        // Helper URLs for frontend
        whipBaseUrl: `${config.whip.useHttps ? 'https' : 'http'}://${config.whip.host}:${config.whip.port}/rtc/v1/whip/`,
        whepBaseUrl: `${config.whep.useHttps ? 'https' : 'http'}://${config.whep.host}:${config.whep.port}/rtc/v1/whep/`,
        apiBaseUrl: `${config.api.useHttps ? 'https' : 'http'}://${config.api.host}:${config.api.port}/api/v1/`
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
  app.get('/api/rooms/:id/streams', requireAuth, async (req, res) => {
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

      res.json({
        room,
        participants,
        assignments,
        whepUrls: assignments.map(assignment => ({
          streamName: assignment.streamName,
          url: getSRSWhepUrl('live', assignment.streamName),
          position: assignment.position,
          assignedUser: assignment.assignedUserId,
          assignedGuest: assignment.assignedGuestName,
        })),
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

      res.json({
        room,
        participants,
        assignments,
        whepUrls: assignments.map(assignment => ({
          streamName: assignment.streamName,
          url: getSRSWhepUrl('live', assignment.streamName),
          position: assignment.position,
          assignedUser: assignment.assignedUserId,
          assignedGuest: assignment.assignedGuestName,
        })),
      });
    } catch (error) {
      console.error('Failed to join room:', error);
      res.status(500).json({ error: 'Failed to join room' });
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
