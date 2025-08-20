import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { ChatMessage } from '@shared/schema';
import { format } from 'date-fns';

// Global connection manager to prevent multiple connections
const connectionManager = {
  connections: new Map<string, WebSocket>(),
  getOrCreate: function(sessionId: string, createFn: () => WebSocket): WebSocket {
    if (this.connections.has(sessionId)) {
      const existing = this.connections.get(sessionId)!;
      if (existing.readyState === WebSocket.OPEN) {
        return existing;
      } else {
        this.connections.delete(sessionId);
      }
    }
    const newWs = createFn();
    this.connections.set(sessionId, newWs);
    return newWs;
  },
  remove: function(sessionId: string) {
    const ws = this.connections.get(sessionId);
    if (ws) {
      ws.close();
      this.connections.delete(sessionId);
    }
  }
};

interface ViewerChatProps {
  sessionId: string;
  enabled: boolean;
  className?: string;
}

export function ViewerChat({ sessionId, enabled, className = '' }: ViewerChatProps) {
  // Temporarily disable all viewer chat functionality to prevent connection loops
  return (
    <div className={`va-bg-dark-surface-2 rounded-lg overflow-hidden flex flex-col ${className}`} data-testid="container-viewer-chat">
      <div className="va-bg-dark-border p-3 border-b va-border-dark flex items-center justify-between">
        <h4 className="font-medium va-text-primary flex items-center">
          <i className="fas fa-comments mr-2 va-text-green"></i>
          Live Chat
        </h4>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-orange-400"></div>
          <span className="text-xs va-text-secondary">Temporarily Disabled</span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm va-text-secondary text-center">
          Chat feature is temporarily disabled for maintenance.<br/>
          Please check back later.
        </p>
      </div>
    </div>
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create viewer user object with unique ID to prevent connection conflicts
  const viewerUserId = useRef(Math.floor(Math.random() * 1000000) + 100000);
  const viewerUser = {
    id: viewerUserId.current, // Stable unique viewer ID
    username: `Viewer_${sessionId}_${viewerUserId.current.toString().slice(-6)}`,
    role: 'user' as const
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Connect to WebSocket when enabled
  useEffect(() => {
    if (!enabled || !viewerUser || !sessionId) return;

    const connect = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/chat`;
        
        // Use connection manager to prevent duplicate connections
        wsRef.current = connectionManager.getOrCreate(sessionId, () => new WebSocket(wsUrl));

        wsRef.current.onopen = () => {
          console.log('Viewer Chat WebSocket connected');
          setIsConnected(true);
          setError(null);

          // Send join message
          wsRef.current?.send(JSON.stringify({
            type: 'join',
            sessionId,
            userId: viewerUser.id,
            username: viewerUser.username,
            role: viewerUser.role,
          }));
          
          // Fetch existing messages
          fetch(`/api/chat/messages/${sessionId}`)
            .then(res => res.json())
            .then(data => {
              if (Array.isArray(data)) {
                setMessages(data);
              }
            })
            .catch(err => console.error('Failed to fetch messages:', err));
        };

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
              case 'new_message':
                if (data.message) {
                  setMessages(prev => [...prev, data.message]);
                }
                break;
              case 'message_history':
                if (data.messages) {
                  setMessages(data.messages);
                }
                break;
              case 'error':
                setError(data.error || 'Unknown error');
                break;
            }
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        wsRef.current.onclose = (event) => {
          console.log(`Viewer Chat WebSocket disconnected: ${event.code} ${event.reason}`);
          setIsConnected(false);
          
          // Don't auto-reconnect to prevent infinite loops
          // User can refresh page to reconnect if needed
        };

        wsRef.current.onerror = (error) => {
          console.error('Viewer Chat WebSocket error:', error);
          setError('Connection error');
        };
      } catch (err) {
        console.error('Failed to connect to chat:', err);
        setError('Failed to connect');
      }
    };

    connect();

    return () => {
      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, viewerUser, sessionId]);

  // Focus input when connected
  useEffect(() => {
    if (isConnected && enabled) {
      inputRef.current?.focus();
    }
  }, [isConnected, enabled]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !isConnected || !wsRef.current) return;

    wsRef.current.send(JSON.stringify({
      type: 'message',
      sessionId,
      content: newMessage.trim(),
      messageType: 'individual',
    }));

    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const shouldShowMessage = (message: ChatMessage) => {
    // Viewer users can see broadcast messages and public messages
    if (message.messageType === 'broadcast' || message.messageType === 'system') {
      return true;
    }
    
    // For individual messages, show if user is sender or intended recipient
    // Also show messages that don't have a specific recipient (public to session)
    return message.senderId === viewerUser.id || 
           message.recipientId === viewerUser.id || 
           (!message.recipientId && message.messageType === 'individual');
  };

  if (!enabled) {
    return null;
  }



  return (
    <div className={`va-bg-dark-surface-2 rounded-lg overflow-hidden flex flex-col ${className}`} data-testid="container-viewer-chat">
      {/* Header */}
      <div className="va-bg-dark-border p-3 border-b va-border-dark flex items-center justify-between">
        <h4 className="font-medium va-text-primary flex items-center">
          <i className="fas fa-comments mr-2 va-text-green"></i>
          Live Chat
        </h4>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <span className="text-xs va-text-secondary">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-500/20 border-b border-red-500/50">
          <p className="text-red-400 text-sm">
            <i className="fas fa-exclamation-triangle mr-2"></i>
            {error}
          </p>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-3">
          {messages.filter(shouldShowMessage).map((message) => {
            const isMyMessage = message.senderId === viewerUser.id;
            return (
              <div 
                key={message.id}
                className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${isMyMessage ? 'ml-4' : 'mr-4'}`}>
                  <div className={`p-3 rounded-lg ${
                    message.messageType === 'broadcast'
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                      : isMyMessage 
                        ? 'va-bg-primary/20 va-text-primary'
                        : 'va-bg-dark-surface va-text-primary'
                  }`}>
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm">
                          {message.senderName}
                        </span>
                        {message.messageType === 'broadcast' && (
                          <Badge variant="outline" className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
                            Broadcast
                          </Badge>
                        )}
                        {message.messageType === 'individual' && message.recipientId && (
                          <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/50">
                            Private
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs va-text-secondary ml-2">
                        {format(new Date(message.createdAt), 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      {isConnected && (
        <div className="p-3 border-t va-border-dark">
          <div className="flex space-x-2">
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 va-bg-dark-surface va-border-dark va-text-primary placeholder:va-text-secondary"
              data-testid="input-viewer-chat-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="va-bg-primary hover:va-bg-primary-dark text-va-dark-bg"
              data-testid="button-send-viewer-message"
            >
              <i className="fas fa-paper-plane"></i>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}