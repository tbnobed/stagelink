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
  userId: number;
  username: string;
  role: 'admin' | 'engineer' | 'user';
  sessionId: string;
}

interface ChatMessage {
  type: 'join' | 'leave' | 'message' | 'participant_update' | 'participants_list';
  sessionId: string;
  userId?: number;
  username?: string;
  role?: 'admin' | 'engineer' | 'user';
  recipientId?: number; // For individual messages
  messageType?: 'individual' | 'broadcast' | 'system';
  content?: string;
  participants?: Array<{
    userId: number;
    username: string;
    role: 'admin' | 'engineer' | 'user';
    isOnline: boolean;
  }>;
}

const messageSchema = z.object({
  type: z.enum(['join', 'leave', 'message']),
  sessionId: z.string(),
  userId: z.number().optional(),
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
      this.wss.clients.forEach((ws: WebSocket & { isAlive?: boolean }) => {
        if (ws.isAlive === false) {
          console.log('Terminating stale WebSocket connection');
          ws.terminate();
          return;
        }
        
        ws.isAlive = false;
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
        const validatedMessage = messageSchema.parse(message);
        await this.handleMessage(ws, validatedMessage);
      } catch (error) {
        console.error('Invalid message received:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format' 
        }));
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`WebSocket closed: ${code} ${reason}`);
      this.handleDisconnection(ws);
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
    }
  }

  private async handleJoin(ws: WebSocket, message: ChatMessage) {
    if (!message.userId || !message.username || !message.role || !message.sessionId) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Missing required fields for join' 
      }));
      return;
    }

    const clientKey = `${message.userId}-${message.sessionId}`;
    
    // Remove existing client if reconnecting
    if (this.clients.has(clientKey)) {
      const existingClient = this.clients.get(clientKey)!;
      existingClient.ws.close();
      this.clients.delete(clientKey);
    }

    const client: ChatClient = {
      ws,
      userId: message.userId,
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

    // Only store participants in database if they have valid user IDs (positive numbers)
    // Guest/viewer users (negative IDs) are handled in-memory only
    if (message.userId > 0) {
      const existingParticipants = await storage.getChatParticipants(message.sessionId);
      const existingParticipant = existingParticipants.find(p => p.userId === message.userId);
      
      if (existingParticipant) {
        // Update existing participant to online
        await storage.updateParticipantStatus(message.sessionId, message.userId, true);
      } else {
        // Add new participant only if they don't exist
        await storage.addChatParticipant({
          sessionId: message.sessionId,
          userId: message.userId,
          username: message.username,
          role: message.role,
          isOnline: true,
        });
      }
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

    // Update participant status in database only for real users
    if (message.userId > 0) {
      await storage.updateParticipantStatus(message.sessionId, message.userId, false);
    }

    // Send updated participant list
    await this.sendParticipantsList(message.sessionId);

    console.log(`User ${message.userId} left session ${message.sessionId}`);
  }

  private handleDisconnection(ws: WebSocket) {
    // Find and remove the client
    for (const [clientKey, client] of Array.from(this.clients.entries())) {
      if (client.ws === ws) {
        this.clients.delete(clientKey);
        
        // Remove from session participants
        if (this.sessionParticipants.has(client.sessionId)) {
          this.sessionParticipants.get(client.sessionId)!.delete(clientKey);
          if (this.sessionParticipants.get(client.sessionId)!.size === 0) {
            this.sessionParticipants.delete(client.sessionId);
          }
        }

        // Update participant status in database
        storage.updateParticipantStatus(client.sessionId, client.userId, false);

        // Send updated participant list
        this.sendParticipantsList(client.sessionId);

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
      // For guest/viewer users (negative IDs), make their messages public (broadcast-like)
      // For authenticated users: admin/engineer -> broadcast, regular users -> individual
      if (senderClient.userId < 0) {
        messageType = 'broadcast'; // Viewer messages are treated as public
      } else {
        messageType = (senderClient.role === 'admin' || senderClient.role === 'engineer') ? 'broadcast' : 'individual';
      }
    }

    // Save message to database only for real users (not guest/viewer users)
    let chatMessage;
    if (senderClient.userId > 0) {
      chatMessage = await storage.createChatMessage({
        sessionId: message.sessionId,
        senderId: senderClient.userId,
        senderName: senderClient.username,
        recipientId: message.recipientId || null,
        messageType,
        content: message.content,
      });
    } else {
      // Create temporary message object for guest/viewer users
      chatMessage = {
        id: Date.now(), // Temporary ID for guest messages
        sessionId: message.sessionId,
        senderId: senderClient.userId,
        senderName: senderClient.username,
        recipientId: message.recipientId || null,
        messageType,
        content: message.content,
        createdAt: new Date(),
      };
    }

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
    // Get database participants (real users)
    const dbParticipants = await storage.getChatParticipants(sessionId);
    const sessionClients = Array.from(this.clients.values()).filter(client => client.sessionId === sessionId);

    // Include database participants with online status
    const participantsData = dbParticipants.map(p => ({
      userId: p.userId,
      username: p.username,
      role: p.role,
      isOnline: sessionClients.some(client => client.userId === p.userId),
    }));

    // Add guest/viewer participants (negative user IDs)
    sessionClients.forEach(client => {
      if (client.userId < 0) {
        participantsData.push({
          userId: client.userId,
          username: client.username,
          role: client.role,
          isOnline: true,
        });
      }
    });

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