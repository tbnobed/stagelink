import { useState, useEffect, useRef } from 'react';
import { X, Send, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMobile, useSwipeGestures } from '@/hooks/use-mobile';

interface MobileChatProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Array<{
    id: string;
    username: string;
    message: string;
    timestamp: Date;
    isGuest?: boolean;
  }>;
  onSendMessage: (message: string) => void;
  currentUsername?: string;
  participantCount?: number;
}

export function MobileChat({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  currentUsername = 'You',
  participantCount = 0
}: MobileChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [currentHeight, setCurrentHeight] = useState(60); // vh
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useMobile();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle swipe down to close
  useSwipeGestures(
    undefined,
    undefined,
    undefined,
    () => {
      if (isOpen && isMobile) {
        onClose();
      }
    }
  );

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Touch handlers for drag resize
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setDragStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const currentY = e.touches[0].clientY;
    const diff = dragStartY - currentY;
    const heightChange = (diff / window.innerHeight) * 100;
    
    const newHeight = Math.max(30, Math.min(80, currentHeight + heightChange));
    setCurrentHeight(newHeight);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  if (!isMobile) return null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Chat Container */}
      <div
        ref={chatRef}
        className={`mobile-chat ${isOpen ? 'open' : ''}`}
        style={{ height: `${currentHeight}vh` }}
        data-testid="mobile-chat"
      >
        {/* Drag Handle */}
        <div
          className="w-full h-1 bg-gray-300 dark:bg-gray-600 cursor-grab active:cursor-grabbing flex justify-center items-start pt-2"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1 bg-gray-400 rounded-full" />
        </div>

        {/* Chat Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-lg" data-testid="text-chat-title">
              Live Chat
            </h3>
            <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
              {participantCount} online
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="btn-touch p-2"
            data-testid="button-close-chat"
          >
            <ChevronDown className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white dark:bg-gray-900">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col gap-1 ${
                  msg.username === currentUsername ? 'items-end' : 'items-start'
                }`}
                data-testid={`message-${msg.id}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl ${
                    msg.username === currentUsername
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {msg.username !== currentUsername && (
                    <div className="text-xs font-medium mb-1 opacity-70">
                      {msg.isGuest ? `👤 ${msg.username}` : msg.username}
                    </div>
                  )}
                  <div className="text-sm break-words">{msg.message}</div>
                </div>
                <div className="text-xs text-gray-400 px-1">
                  {formatTime(msg.timestamp)}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex gap-2 items-end">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-full px-4 py-2"
              maxLength={500}
              data-testid="input-chat-message"
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim()}
              className="btn-touch bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3"
              data-testid="button-send-message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}