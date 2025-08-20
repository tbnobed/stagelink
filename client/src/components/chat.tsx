import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useChat } from '@/hooks/use-chat';
import { useAuth } from '@/hooks/use-auth';
import type { ChatMessage } from '@shared/schema';
import { format } from 'date-fns';

interface ChatProps {
  sessionId: string;
  enabled: boolean;
  className?: string;
}

export function Chat({ sessionId, enabled, className = '' }: ChatProps) {
  const { user } = useAuth();
  const { messages, participants, isConnected, error, sendMessage, canSendBroadcast } = useChat({
    sessionId,
    enabled,
  });
  
  const [newMessage, setNewMessage] = useState('');
  const [messageType, setMessageType] = useState<'individual' | 'broadcast'>('individual');
  const [selectedRecipient, setSelectedRecipient] = useState<number | undefined>();
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

    const recipientId = messageType === 'individual' ? selectedRecipient : undefined;
    sendMessage(newMessage.trim(), recipientId, messageType);
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getMessageRecipients = (message: ChatMessage) => {
    if (message.messageType === 'broadcast') {
      return 'Everyone';
    }
    if (message.recipientId) {
      const recipient = participants.find(p => p.userId === message.recipientId);
      return recipient ? `@${recipient.username}` : 'Private';
    }
    return 'Public';
  };

  const shouldShowMessage = (message: ChatMessage) => {
    if (message.messageType === 'broadcast' || message.messageType === 'system') {
      return true; // Everyone sees broadcast and system messages
    }
    
    // For individual messages, show if user is sender or recipient
    return message.senderId === user?.id || message.recipientId === user?.id;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500/20 text-red-400';
      case 'engineer':
        return 'bg-blue-500/20 text-blue-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (!enabled) {
    return null;
  }

  return (
    <div className={`va-bg-dark-surface-2 rounded-lg overflow-hidden flex flex-col ${className}`} data-testid="container-chat">
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

      {/* Participants List */}
      {participants.length > 0 && (
        <div className="p-3 border-b va-border-dark">
          <p className="text-xs va-text-secondary mb-2">Online ({participants.filter(p => p.isOnline).length})</p>
          <div className="flex flex-wrap gap-1">
            {participants.filter(p => p.isOnline).map(participant => (
              <Badge
                key={participant.userId}
                variant="outline"
                className={`text-xs ${getRoleColor(participant.role)} border-current`}
              >
                {participant.username}
                {participant.role !== 'user' && (
                  <span className="ml-1 capitalize">({participant.role})</span>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-3">
          {messages.filter(shouldShowMessage).map((message) => (
            <div
              key={message.id}
              className={`p-3 rounded-lg ${
                message.senderId === user?.id
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
                      {getMessageRecipients(message)}
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
        <div className="p-3 border-t va-border-dark space-y-2">
          {/* Message Type Selector for Admin/Engineer */}
          {canSendBroadcast && (
            <div className="flex space-x-2">
              <Select value={messageType} onValueChange={(value: 'individual' | 'broadcast') => setMessageType(value)}>
                <SelectTrigger className="w-32 va-bg-dark-surface va-border-dark va-text-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="va-bg-dark-surface va-border-dark">
                  <SelectItem value="individual" className="va-text-primary">Private</SelectItem>
                  <SelectItem value="broadcast" className="va-text-primary">Broadcast</SelectItem>
                </SelectContent>
              </Select>

              {/* Recipient Selector for Individual Messages */}
              {messageType === 'individual' && (
                <Select value={selectedRecipient?.toString() || ''} onValueChange={(value) => setSelectedRecipient(value ? parseInt(value) : undefined)}>
                  <SelectTrigger className="flex-1 va-bg-dark-surface va-border-dark va-text-primary">
                    <SelectValue placeholder="Select recipient" />
                  </SelectTrigger>
                  <SelectContent className="va-bg-dark-surface va-border-dark">
                    {participants.filter(p => p.isOnline && p.userId !== user?.id).map(participant => (
                      <SelectItem key={participant.userId} value={participant.userId!.toString()} className="va-text-primary">
                        {participant.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Message Input */}
          <div className="flex space-x-2">
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                canSendBroadcast && messageType === 'broadcast'
                  ? 'Send message to everyone...'
                  : canSendBroadcast && messageType === 'individual' && !selectedRecipient
                  ? 'Select a recipient first...'
                  : 'Type a message...'
              }
              disabled={canSendBroadcast && messageType === 'individual' && !selectedRecipient}
              className="flex-1 va-bg-dark-surface va-border-dark va-text-primary placeholder:va-text-secondary"
              data-testid="input-chat-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || (canSendBroadcast && messageType === 'individual' && !selectedRecipient)}
              className="va-bg-primary hover:va-bg-primary-dark text-va-dark-bg"
              data-testid="button-send-message"
            >
              <i className="fas fa-paper-plane"></i>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}