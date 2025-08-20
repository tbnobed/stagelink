import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useViewerChat } from '@/hooks/use-viewer-chat';
import type { ChatMessage } from '@shared/schema';
import { format } from 'date-fns';

interface ViewerChatProps {
  sessionId: string;
  enabled: boolean;
  viewerUsername?: string;
  className?: string;
}

export function ViewerChat({ sessionId, enabled, viewerUsername, className = '' }: ViewerChatProps) {
  const { messages, participants, isConnected, error, sendMessage } = useViewerChat({
    sessionId,
    enabled,
    viewerUsername,
  });
  
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when connected
  useEffect(() => {
    if (isConnected && enabled) {
      inputRef.current?.focus();
    }
  }, [isConnected, enabled]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !isConnected) return;

    sendMessage(newMessage.trim());
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const shouldShowMessage = (message: ChatMessage) => {
    // Viewers can see broadcast messages, system messages, and public messages
    return message.messageType === 'broadcast' || 
           message.messageType === 'system' || 
           !message.recipientId; // Public messages (no specific recipient)
  };

  const getMessageBadgeColor = (message: ChatMessage) => {
    switch (message.messageType) {
      case 'broadcast':
        return 'bg-blue-500/20 text-blue-400';
      case 'system':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getMessageBadgeText = (message: ChatMessage) => {
    switch (message.messageType) {
      case 'broadcast':
        return 'Broadcast';
      case 'system':
        return 'System';
      default:
        return 'Public';
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
            {participants.filter(p => p.isOnline).length} online
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
          {messages.filter(shouldShowMessage).map((message) => (
            <div key={message.id} className="va-bg-dark-surface-2 rounded-lg p-3">
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium va-text-primary text-sm">
                    {message.senderName}
                  </span>
                  <Badge className={`text-xs ${getMessageBadgeColor(message)}`}>
                    {getMessageBadgeText(message)}
                  </Badge>
                </div>
                <span className="text-xs va-text-secondary">
                  {format(new Date(message.createdAt), 'HH:mm')}
                </span>
              </div>
              <p className="va-text-secondary text-sm whitespace-pre-wrap">
                {message.content}
              </p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t va-border-dark">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={isConnected ? `Message as ${viewerUsername}...` : "Connecting..."}
            disabled={!isConnected}
            className="flex-1 text-sm va-bg-dark-surface va-border-dark va-text-primary"
            data-testid="input-viewer-message"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !isConnected}
            size="sm"
            className="va-bg-primary hover:bg-green-600 text-va-dark-bg"
            data-testid="button-send-viewer-message"
          >
            <i className="fas fa-paper-plane"></i>
          </Button>
        </div>
        <p className="text-xs va-text-secondary mt-2">
          Note: As a viewer, you can only see public and broadcast messages.
        </p>
      </div>
    </div>
  );
}