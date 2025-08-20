import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { ChatMessage } from '@shared/schema';
import { format } from 'date-fns';

interface GuestChatProps {
  sessionId: string;
  enabled: boolean;
  guestUser: {
    id: number;
    username: string;
    role: string;
  };
  className?: string;
}

export function GuestChat({ sessionId, enabled, guestUser, className = '' }: GuestChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Connect to WebSocket when enabled
  useEffect(() => {
    if (!enabled || !guestUser || !sessionId) return;

    const connect = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/chat`;
        
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('Guest Chat WebSocket connected');
          setIsConnected(true);
          setError(null);

          // Send join message
          wsRef.current?.send(JSON.stringify({
            type: 'join',
            sessionId,
            userId: guestUser.id,
            username: guestUser.username,
            role: guestUser.role,
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

        wsRef.current.onclose = () => {
          console.log('Guest Chat WebSocket disconnected');
          setIsConnected(false);
        };

        wsRef.current.onerror = (error) => {
          console.error('Guest Chat WebSocket error:', error);
          setError('Connection error');
        };
      } catch (err) {
        console.error('Failed to connect to chat:', err);
        setError('Failed to connect');
      }
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [enabled, guestUser, sessionId]);

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
    // Guest users can see broadcast messages and public messages
    if (message.messageType === 'broadcast' || message.messageType === 'system') {
      return true;
    }
    
    // For individual messages, show if user is sender or intended recipient
    // Also show messages that don't have a specific recipient (public to session)
    return message.senderId === guestUser.id || 
           message.recipientId === guestUser.id || 
           (!message.recipientId && message.messageType === 'individual');
  };

  if (!enabled) {
    return null;
  }

  return (
    <div className={`va-bg-dark-surface-2 rounded-lg overflow-hidden flex flex-col ${className}`} data-testid="container-guest-chat">
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
          {messages.filter(shouldShowMessage).map((message) => (
            <div
              key={message.id}
              className={`p-3 rounded-lg ${
                message.senderId === guestUser.id
                  ? 'va-bg-primary/20 ml-4'
                  : 'va-bg-dark-surface mr-4'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium va-text-primary text-sm">
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
                <span className="text-xs va-text-secondary">
                  {format(new Date(message.createdAt), 'HH:mm')}
                </span>
              </div>
              <p className="va-text-primary text-sm leading-relaxed">{message.content}</p>
            </div>
          ))}
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
              data-testid="input-guest-chat-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="va-bg-primary hover:va-bg-primary-dark text-va-dark-bg"
              data-testid="button-send-guest-message"
            >
              <i className="fas fa-paper-plane"></i>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}