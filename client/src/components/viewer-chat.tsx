import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { ChatMessage } from '@shared/schema';
import { format } from 'date-fns';

interface ViewerChatProps {
  sessionId: string;
  enabled: boolean;
  viewerUsername?: string;
  className?: string;
}

export function ViewerChat({ sessionId, enabled, viewerUsername, className = '' }: ViewerChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const viewerIdRef = useRef<number | null>(null);

  // Generate unique positive viewer ID (based on timestamp + random to avoid conflicts)
  if (!viewerIdRef.current) {
    viewerIdRef.current = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 10000);
  }

  const viewerId = viewerIdRef.current;
  const username = viewerUsername || `Viewer_${sessionId}`;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Connect to WebSocket when enabled
  useEffect(() => {
    if (!enabled || !viewerId || !sessionId) return;

    const connect = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/chat`;
        
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('Viewer Chat WebSocket connected');
          setIsConnected(true);
          setError(null);

          // Send join message
          wsRef.current?.send(JSON.stringify({
            type: 'join',
            sessionId,
            userId: viewerId,
            username: username,
            role: 'user',
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
          
          // Don't auto-reconnect to prevent loops - user can refresh page if needed
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
  }, [enabled, sessionId, viewerId, username]);

  // Focus input when connected
  useEffect(() => {
    if (isConnected && enabled) {
      inputRef.current?.focus();
    }
  }, [isConnected, enabled]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !isConnected || !wsRef.current) return;

    // Send message
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

  if (!enabled) {
    return null;
  }

  return (
    <div className={`va-bg-dark-surface border va-border-dark rounded-lg flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-3 border-b va-border-dark flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium va-text-primary">Chat</h3>
          <Badge variant="outline" className="text-xs">
            Viewer
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <span className="text-xs va-text-secondary">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-500/10 border-b va-border-dark">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium va-text-primary">
                  {message.senderName}
                </span>
                <span className="text-xs va-text-secondary">
                  {format(new Date(message.createdAt), 'h:mm a')}
                </span>
              </div>
              <p className="text-sm va-text-secondary">{message.content}</p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="p-3 border-t va-border-dark">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "Type a message..." : "Connecting..."}
            disabled={!isConnected}
            className="flex-1"
            data-testid="input-chat-message"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !isConnected}
            size="sm"
            data-testid="button-send-message"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}