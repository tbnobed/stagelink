import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from './storage';
import { insertChatMessageSchema, insertChatParticipantSchema } from '@shared/schema';
import { z } from 'zod';

// Extend WebSocket interface to include isAlive property
declare module 'ws' {
  interface WebSocket {
    isAlive?: boolean;
  }
}

interface ChatClient {
  ws: WebSocket;
  userId: number | null;
  username: string;
  role: 'admin' | 'engineer' | 'user';
  sessionId: string;
}

interface ChatMessage {
  type: 'join' | 'leave' | 'message' | 'participant_update' | 'participants_list';
  sessionId: string;
  userId?: number | null;
  username?: string;
  role?: 'admin' | 'engineer' | 'user';
  recipientId?: number; // For individual messages
  messageType?: 'individual' | 'broadcast' | 'system';
  content?: string;
  participants?: Array<{
    userId: number | null;
    username: string;
    role: 'admin' | 'engineer' | 'user';
    isOnline: boolean;
  }>;
}

const messageSchema = z.object({
  type: z.enum(['join', 'leave', 'message', 'notification_listener']),
  sessionId: z.string(),
  userId: z.union([z.number(), z.null()]).optional(),
  username: z.string().optional(),
  role: z.enum(['admin', 'engineer', 'user']).optional(),
  recipientId: z.number().optional(),
  messageType: z.enum(['individual', 'broadcast', 'system']).optional(),
  content: z.string().optional(),
});

class ChatWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, ChatClient> = new Map(); // key: userId-sessionId
  private sessionParticipants: Map<string, Set<string>> = new Map(); // sessionId -> Set of clientKeys
  private notificationListeners: Map<string, ChatClient> = new Map(); // key: notification-userId

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/chat',
      // Add ping interval to keep connections alive
      perMessageDeflate: false,
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    
    // Set up periodic ping to keep connections alive and cleanup stale connections
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if ((ws as any).isAlive === false) {
          console.log('Terminating stale WebSocket connection');
          ws.terminate();
          return;
        }
        
        (ws as any).isAlive = false;
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, 30000); // Ping every 30 seconds

    console.log('Chat WebSocket server initialized with keepalive');
  }

  private handleConnection(ws: WebSocket, request: any) {
    console.log('New WebSocket connection');

    // Set up connection keepalive
    (ws as any).isAlive = true;
    
    ws.on('pong', () => {
      (ws as any).isAlive = true;
    });

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('WebSocket message received:', message);
        // Temporarily bypass strict validation for null userId
        await this.handleMessage(ws, message as ChatMessage);
      } catch (error) {
        console.error('Invalid message received:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format' 
        }));
      }
    });

    ws.on('close', async (code, reason) => {
      console.log(`WebSocket closed: ${code} ${reason}`);
      await this.handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleDisconnection(ws);
    });
  }

  private async handleMessage(ws: WebSocket, message: ChatMessage) {
    switch (message.type) {
      case 'join':
        await this.handleJoin(ws, message);
        break;
      case 'leave':
        await this.handleLeave(ws, message);
        break;
      case 'message':
        await this.handleChatMessage(ws, message);
        break;
      case 'notification_listener':
        await this.handleNotificationListener(ws, message);
        break;
    }
  }

  private async handleJoin(ws: WebSocket, message: ChatMessage) {
    if (!message.username || !message.role || !message.sessionId) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Missing required fields for join' 
      }));
      return;
    }

    // Use username for guest users (null userId), userId for authenticated users
    const clientKey = message.userId ? `${message.userId}-${message.sessionId}` : `guest-${message.username}-${message.sessionId}`;
    
    // Remove existing client if reconnecting
    if (this.clients.has(clientKey)) {
      const existingClient = this.clients.get(clientKey)!;
      existingClient.ws.close();
      this.clients.delete(clientKey);
    }

    const client: ChatClient = {
      ws,
      userId: message.userId || null,
      username: message.username,
      role: message.role,
      sessionId: message.sessionId,
    };

    this.clients.set(clientKey, client);

    // Add to session participants
    if (!this.sessionParticipants.has(message.sessionId)) {
      this.sessionParticipants.set(message.sessionId, new Set());
    }
    this.sessionParticipants.get(message.sessionId)!.add(clientKey);

    // Update participant status instead of adding new participant
    const existingParticipants = await storage.getChatParticipants(message.sessionId);
    // For guest users (null userId), match by username; for authenticated users, match by userId
    const existingParticipant = message.userId 
      ? existingParticipants.find(p => p.userId === message.userId)
      : existingParticipants.find(p => p.username === message.username && p.userId === null);
    
    if (existingParticipant) {
      // Update existing participant to online - handle both guest and authenticated users
      if (message.userId) {
        await storage.updateParticipantStatus(message.sessionId, message.userId, true);
      } else {
        // For guest users, update by username since they don't have userId
        await storage.updateParticipantStatusByUsername(message.sessionId, message.username, true);
      }
    } else {
      // Add new participant only if they don't exist
      await storage.addChatParticipant({
        sessionId: message.sessionId,
        userId: message.userId || null, // Explicitly set null for guest users
        username: message.username,
        role: message.role,
        isOnline: true,
      });
    }

    // Send participant list to the new client
    await this.sendParticipantsList(message.sessionId);

    // Send recent messages to the new client
    const recentMessages = await storage.getChatMessages(message.sessionId, 20);
    ws.send(JSON.stringify({
      type: 'message_history',
      messages: recentMessages.reverse(), // Reverse to show oldest first
    }));

    console.log(`User ${message.username} joined session ${message.sessionId}`);
  }

  private async handleLeave(ws: WebSocket, message: ChatMessage) {
    if (!message.userId || !message.sessionId) return;

    const clientKey = `${message.userId}-${message.sessionId}`;
    this.clients.delete(clientKey);

    // Remove from session participants
    if (this.sessionParticipants.has(message.sessionId)) {
      this.sessionParticipants.get(message.sessionId)!.delete(clientKey);
      if (this.sessionParticipants.get(message.sessionId)!.size === 0) {
        this.sessionParticipants.delete(message.sessionId);
      }
    }

    // Update participant status in database
    await storage.updateParticipantStatus(message.sessionId, message.userId, false);

    // Send updated participant list
    await this.sendParticipantsList(message.sessionId);

    console.log(`User ${message.userId} left session ${message.sessionId}`);
  }

  private async handleDisconnection(ws: WebSocket) {
    console.log(`handleDisconnection called - this method is definitely being executed`);
    
    // Check if it's a notification listener
    for (const [listenerKey, listener] of Array.from(this.notificationListeners.entries())) {
      if (listener.ws === ws) {
        console.log(`Notification listener disconnected: ${listener.username}`);
        this.notificationListeners.delete(listenerKey);
        return;
      }
    }
    
    // Find and remove the regular client
    for (const [clientKey, client] of Array.from(this.clients.entries())) {
      if (client.ws === ws) {
        console.log(`Found disconnecting client: ${client.username}, userId: ${client.userId}, sessionId: ${client.sessionId}`);
        this.clients.delete(clientKey);
        
        // Remove from session participants
        if (this.sessionParticipants.has(client.sessionId)) {
          this.sessionParticipants.get(client.sessionId)!.delete(clientKey);
          if (this.sessionParticipants.get(client.sessionId)!.size === 0) {
            this.sessionParticipants.delete(client.sessionId);
          }
        }

        // Handle participant cleanup - authenticated users go offline, guest users are removed
        try {
          if (client.userId) {
            // Authenticated users: mark as offline
            console.log(`Marking authenticated user ${client.username} as offline`);
            await storage.updateParticipantStatus(client.sessionId, client.userId, false);
            console.log(`Successfully marked ${client.username} as offline`);
          } else {
            // Guest users: remove from database completely to prevent accumulation
            console.log(`Removing guest user ${client.username} from database for session ${client.sessionId}`);
            await storage.removeParticipantByUsername(client.sessionId, client.username);
            console.log(`Successfully removed guest user ${client.username} from database`);
          }
        } catch (error) {
          console.error(`Error during participant cleanup for ${client.username}:`, error);
        }

        // Send updated participant list
        await this.sendParticipantsList(client.sessionId);

        console.log(`Client disconnected: ${client.username}`);
        break;
      }
    }
  }

  private async handleChatMessage(ws: WebSocket, message: ChatMessage) {
    if (!message.content || !message.sessionId) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Missing message content or session ID' 
      }));
      return;
    }

    // Find the sender client
    const senderClient = Array.from(this.clients.values()).find(client => client.ws === ws);
    if (!senderClient) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Client not found' 
      }));
      return;
    }

    // Determine message type
    let messageType: 'individual' | 'broadcast' | 'system' = 'individual';
    
    if (message.messageType === 'broadcast' && (senderClient.role === 'admin' || senderClient.role === 'engineer')) {
      messageType = 'broadcast';
    } else if (message.recipientId) {
      messageType = 'individual';
    } else {
      // Default to broadcast for admin/engineer, individual for users
      messageType = (senderClient.role === 'admin' || senderClient.role === 'engineer') ? 'broadcast' : 'individual';
    }

    // Save message to database
    const chatMessage = await storage.createChatMessage({
      sessionId: message.sessionId,
      senderId: senderClient.userId,
      senderName: senderClient.username,
      recipientId: message.recipientId || null,
      messageType,
      content: message.content,
    });

    // Broadcast the message to appropriate recipients
    const recipients = this.getMessageRecipients(message.sessionId, messageType, message.recipientId);
    
    const messageToSend = {
      type: 'new_message',
      message: chatMessage,
    };

    recipients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(messageToSend));
      }
    });

    console.log(`Message sent from ${senderClient.username} in session ${message.sessionId}`);
    
    // Also send notifications to notification listeners for all sessions
    this.sendNotificationToListeners(message.sessionId, chatMessage);
  }

  private async handleNotificationListener(ws: WebSocket, message: ChatMessage) {
    if (!message.username || !message.role || !message.userId) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Missing required fields for notification listener' 
      }));
      return;
    }

    // Create a special notification listener client
    const listenerKey = `notification-${message.userId}`;
    
    // Remove existing listener if reconnecting
    if (this.notificationListeners.has(listenerKey)) {
      const existingListener = this.notificationListeners.get(listenerKey)!;
      existingListener.ws.close();
      this.notificationListeners.delete(listenerKey);
    }

    const listener: ChatClient = {
      ws,
      userId: message.userId,
      username: message.username,
      role: message.role,
      sessionId: 'notification-listener', // Special session ID for listeners
    };

    this.notificationListeners.set(listenerKey, listener);
    console.log(`Notification listener registered for user ${message.username} (${message.userId})`);
    
    ws.send(JSON.stringify({ 
      type: 'notification_listener_ready',
      message: 'Notification listener established'
    }));
  }

  private getMessageRecipients(sessionId: string, messageType: 'individual' | 'broadcast' | 'system', recipientId?: number): ChatClient[] {
    const sessionClients = Array.from(this.clients.values()).filter(client => client.sessionId === sessionId);

    if (messageType === 'broadcast' || messageType === 'system') {
      return sessionClients; // Send to everyone in the session
    }

    if (messageType === 'individual' && recipientId) {
      return sessionClients.filter(client => client.userId === recipientId);
    }

    return sessionClients; // Default to everyone
  }

  private async sendParticipantsList(sessionId: string) {
    const participants = await storage.getChatParticipants(sessionId);
    const sessionClients = Array.from(this.clients.values()).filter(client => client.sessionId === sessionId);

    // Only show online participants to avoid duplicates
    const onlineParticipants = participants.filter(p => p.isOnline);
    
    const participantsData = onlineParticipants.map(p => ({
      userId: p.userId,
      username: p.username,
      role: p.role,
      isOnline: true, // All filtered participants are online
    }));

    const message = {
      type: 'participants_list',
      participants: participantsData,
    };

    sessionClients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  private sendNotificationToListeners(sessionId: string, chatMessage: any) {
    // Send notification to all notification listeners (admin/engineer users on the links page)
    const notificationData = {
      type: 'message',
      sessionId: sessionId,
      message: chatMessage
    };

    this.notificationListeners.forEach((listener) => {
      if (listener.ws.readyState === WebSocket.OPEN && (listener.role === 'admin' || listener.role === 'engineer')) {
        listener.ws.send(JSON.stringify(notificationData));
      }
    });
  }

  // Public methods for sending messages from API
  public sendToSession(sessionId: string, message: any) {
    const sessionClients = Array.from(this.clients.values()).filter(client => client.sessionId === sessionId);
    sessionClients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  public broadcastToAll(message: any) {
    Array.from(this.clients.values()).forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }
}

export { ChatWebSocketServer };