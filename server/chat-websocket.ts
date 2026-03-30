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
  type: 'join' | 'leave' | 'message' | 'participant_update' | 'participants_list' | 'production_join' | 'production_leave_live' | 'notification_listener';
  sessionId: string;
  userId?: number | null;
  username?: string;
  role?: 'admin' | 'engineer' | 'user';
  recipientId?: number;
  messageType?: 'individual' | 'broadcast' | 'system';
  content?: string;
  participants?: Array<{
    userId: number | null;
    username: string;
    role: 'admin' | 'engineer' | 'user';
    isOnline: boolean;
  }>;
  // Production join fields
  productionId?: string;
  linkId?: string;
  guestName?: string;
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

interface ProductionState {
  maxLive: number;
  liveParticipants: Map<string, string>; // clientKey -> linkId
  waitingQueue: Array<{ clientKey: string; linkId: string; guestName: string; ws: WebSocket }>;
}

class ChatWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, ChatClient> = new Map(); // key: userId-sessionId
  private sessionParticipants: Map<string, Set<string>> = new Map(); // sessionId -> Set of clientKeys
  private notificationListeners: Map<string, ChatClient> = new Map(); // key: notification-userId
  private productionStates: Map<string, ProductionState> = new Map(); // productionId -> state
  private clientProductionMap: Map<string, { productionId: string; linkId: string }> = new Map(); // clientKey -> {productionId, linkId}
  private wsToProductionClientKey: Map<WebSocket, string> = new Map(); // ws -> production clientKey

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
      case 'production_join':
        await this.handleProductionJoin(ws, message);
        break;
      case 'production_leave_live':
        this.handleProductionLeaveLive(ws, message);
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

    // Handle production-related disconnect first (waiting queue or live slot)
    this.handleProductionDisconnectByWs(ws);
    
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

  private async handleProductionJoin(ws: WebSocket, message: ChatMessage) {
    if (!message.productionId || !message.linkId) {
      ws.send(JSON.stringify({ type: 'error', message: 'Missing productionId or linkId' }));
      return;
    }

    const { productionId, linkId, guestName = 'Guest' } = message;

    // Server-side validation: verify the linkId actually belongs to this productionId
    const links = await storage.getLinksByProduction(productionId);
    const validLink = links.find(l => l.id === linkId);
    if (!validLink) {
      ws.send(JSON.stringify({ type: 'production_status', status: 'error', message: 'Unauthorized: link not found in production' }));
      return;
    }

    // Fetch production config if not already tracked
    if (!this.productionStates.has(productionId)) {
      const production = await storage.getProduction(productionId);
      if (!production) {
        ws.send(JSON.stringify({ type: 'production_status', status: 'error', message: 'Production not found' }));
        return;
      }
      this.productionStates.set(productionId, {
        maxLive: production.maxLiveParticipants,
        liveParticipants: new Map(),
        waitingQueue: [],
      });
    }

    const state = this.productionStates.get(productionId)!;
    const clientKey = `prod-${linkId}`;

    // If already live (reconnect), just re-confirm
    if (state.liveParticipants.has(clientKey)) {
      state.liveParticipants.set(clientKey, linkId);
      this.clientProductionMap.set(clientKey, { productionId, linkId });
      this.wsToProductionClientKey.set(ws, clientKey);
      ws.send(JSON.stringify({ type: 'production_status', status: 'live', position: 0 }));
      return;
    }

    // Remove from waiting queue if already there (re-connect)
    state.waitingQueue = state.waitingQueue.filter(w => w.clientKey !== clientKey);
    this.clientProductionMap.set(clientKey, { productionId, linkId });
    this.wsToProductionClientKey.set(ws, clientKey);

    if (state.liveParticipants.size < state.maxLive) {
      state.liveParticipants.set(clientKey, linkId);
      ws.send(JSON.stringify({ type: 'production_status', status: 'live', position: 0 }));
      console.log(`Production ${productionId}: ${guestName} (${linkId}) is LIVE. ${state.liveParticipants.size}/${state.maxLive}`);
    } else {
      state.waitingQueue.push({ clientKey, linkId, guestName, ws });
      const position = state.waitingQueue.length;
      ws.send(JSON.stringify({ type: 'production_status', status: 'waiting', position }));
      console.log(`Production ${productionId}: ${guestName} (${linkId}) is WAITING at position ${position}.`);
    }
  }

  private handleProductionDisconnectByWs(ws: WebSocket) {
    const clientKey = this.wsToProductionClientKey.get(ws);
    if (!clientKey) return;
    this.wsToProductionClientKey.delete(ws);

    const entry = this.clientProductionMap.get(clientKey);
    if (!entry) return;

    const { productionId } = entry;
    const state = this.productionStates.get(productionId);
    if (!state) return;

    // Remove from waiting queue if present
    const waitingIdx = state.waitingQueue.findIndex(w => w.clientKey === clientKey);
    if (waitingIdx !== -1) {
      const removed = state.waitingQueue.splice(waitingIdx, 1)[0];
      this.clientProductionMap.delete(clientKey);
      state.waitingQueue.forEach((w, i) => {
        if (w.ws.readyState === WebSocket.OPEN) {
          w.ws.send(JSON.stringify({ type: 'production_status', status: 'waiting', position: i + 1 }));
        }
      });
      console.log(`Production ${productionId}: waiter ${removed.guestName} disconnected`);
      return;
    }

    // Remove from live participants and auto-promote next waiter
    if (state.liveParticipants.has(clientKey)) {
      state.liveParticipants.delete(clientKey);
      this.clientProductionMap.delete(clientKey);
      console.log(`Production ${productionId}: live ${entry.linkId} disconnected. ${state.liveParticipants.size}/${state.maxLive} live`);

      while (state.liveParticipants.size < state.maxLive && state.waitingQueue.length > 0) {
        const nextWaiter = state.waitingQueue.shift()!;
        state.liveParticipants.set(nextWaiter.clientKey, nextWaiter.linkId);
        if (nextWaiter.ws.readyState === WebSocket.OPEN) {
          nextWaiter.ws.send(JSON.stringify({ type: 'production_status', status: 'promoted', position: 0 }));
        }
        console.log(`Production ${productionId}: auto-promoted ${nextWaiter.guestName} to live`);
      }

      state.waitingQueue.forEach((w, i) => {
        if (w.ws.readyState === WebSocket.OPEN) {
          w.ws.send(JSON.stringify({ type: 'production_status', status: 'waiting', position: i + 1 }));
        }
      });
    }
  }

  private handleProductionLeaveLive(ws: WebSocket, message: ChatMessage) {
    // Called when a guest stops their stream without closing the page (sign-off, not disconnect)
    const clientKey = this.wsToProductionClientKey.get(ws);
    if (!clientKey) return;

    const entry = this.clientProductionMap.get(clientKey);
    if (!entry) return;

    const { productionId } = entry;
    const state = this.productionStates.get(productionId);
    if (!state) return;

    if (!state.liveParticipants.has(clientKey)) return;

    state.liveParticipants.delete(clientKey);
    // Remove from live tracking; clear wsToProductionClientKey so that:
    // (a) if page closes, no double-processing in handleProductionDisconnectByWs
    // (b) if guest tries to Start again, production_join will re-enter them
    this.wsToProductionClientKey.delete(ws);
    // Also clear clientProductionMap so re-join via production_join works cleanly
    this.clientProductionMap.delete(clientKey);
    console.log(`Production ${productionId}: ${entry.linkId} signed off. ${state.liveParticipants.size}/${state.maxLive} live`);

    // Auto-promote next waiter if any
    while (state.liveParticipants.size < state.maxLive && state.waitingQueue.length > 0) {
      const nextWaiter = state.waitingQueue.shift()!;
      state.liveParticipants.set(nextWaiter.clientKey, nextWaiter.linkId);
      if (nextWaiter.ws.readyState === WebSocket.OPEN) {
        nextWaiter.ws.send(JSON.stringify({ type: 'production_status', status: 'promoted', position: 0 }));
      }
      console.log(`Production ${productionId}: auto-promoted ${nextWaiter.guestName} after sign-off`);
    }

    state.waitingQueue.forEach((w, i) => {
      if (w.ws.readyState === WebSocket.OPEN) {
        w.ws.send(JSON.stringify({ type: 'production_status', status: 'waiting', position: i + 1 }));
      }
    });

    // Send the signed-off guest their new status: idle (they must re-join to get another slot)
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'production_status', status: 'signed_off' }));
    }
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

  // Production management: promote a specific participant from waiting to live
  public promoteParticipantByLinkId(productionId: string, linkId: string): boolean {
    const state = this.productionStates.get(productionId);
    if (!state) return false;

    const clientKey = `prod-${linkId}`;
    const waitingIdx = state.waitingQueue.findIndex(w => w.linkId === linkId);
    if (waitingIdx === -1) return false;

    // Enforce capacity even for manual promotion (admin must free a slot first)
    if (state.liveParticipants.size >= state.maxLive) {
      return false;
    }

    const waiter = state.waitingQueue.splice(waitingIdx, 1)[0];
    state.liveParticipants.set(clientKey, linkId);

    if (waiter.ws.readyState === WebSocket.OPEN) {
      waiter.ws.send(JSON.stringify({ type: 'production_status', status: 'promoted', position: 0 }));
    }

    // Re-notify remaining waiters of their new positions
    state.waitingQueue.forEach((w, i) => {
      if (w.ws.readyState === WebSocket.OPEN) {
        w.ws.send(JSON.stringify({ type: 'production_status', status: 'waiting', position: i + 1 }));
      }
    });

    console.log(`Production ${productionId}: manually promoted ${linkId} to live. ${state.liveParticipants.size}/${state.maxLive}`);
    return true;
  }

  // Get current production state for REST API
  public getProductionLiveStatus(productionId: string): { liveIds: string[]; waitingIds: Array<{ linkId: string; guestName: string; position: number }> } | null {
    const state = this.productionStates.get(productionId);
    if (!state) return null;
    return {
      liveIds: Array.from(state.liveParticipants.values()),
      waitingIds: state.waitingQueue.map((w, i) => ({ linkId: w.linkId, guestName: w.guestName, position: i + 1 })),
    };
  }

  // Update max live participants for a production (e.g., after admin edits it)
  public updateProductionCapacity(productionId: string, maxLive: number) {
    const state = this.productionStates.get(productionId);
    if (state) {
      state.maxLive = maxLive;
      // Promote waiters if capacity increased
      while (state.liveParticipants.size < state.maxLive && state.waitingQueue.length > 0) {
        const waiter = state.waitingQueue.shift()!;
        state.liveParticipants.set(waiter.clientKey, waiter.linkId);
        if (waiter.ws.readyState === WebSocket.OPEN) {
          waiter.ws.send(JSON.stringify({ type: 'production_status', status: 'promoted', position: 0 }));
        }
      }
      // Re-notify remaining waiters
      state.waitingQueue.forEach((w, i) => {
        if (w.ws.readyState === WebSocket.OPEN) {
          w.ws.send(JSON.stringify({ type: 'production_status', status: 'waiting', position: i + 1 }));
        }
      });
    }
  }
}

export { ChatWebSocketServer };