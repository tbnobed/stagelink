import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChatMessage, ChatParticipant } from '@shared/schema';

interface UseViewerChatProps {
  sessionId: string;
  enabled: boolean;
  viewerUsername?: string;
}

interface ChatWebSocketMessage {
  type: 'new_message' | 'message_history' | 'participants_list' | 'error';
  message?: ChatMessage;
  messages?: ChatMessage[];
  participants?: Array<{
    userId: number;
    username: string;
    role: 'admin' | 'engineer' | 'user';
    isOnline: boolean;
  }>;
  error?: string;
}

export function useViewerChat({ sessionId, enabled, viewerUsername }: UseViewerChatProps) {
  // Temporarily disabled - using GuestChat instead
  return {
    messages: [],
    participants: [],
    isConnected: false,
    error: null,
    sendMessage: () => {},
    disconnect: () => {},
    canSendBroadcast: false
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const viewerIdRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (!enabled || !sessionId || !viewerUsername) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/chat`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Viewer Chat WebSocket connected');
        setIsConnected(true);
        setError(null);

        // Generate or reuse consistent viewer ID (use smaller number for DB compatibility)
        if (!viewerIdRef.current) {
          // Generate a random negative ID to avoid conflicts with real user IDs
          viewerIdRef.current = -Math.floor(Math.random() * 1000000);
        }

        // Send join message as a viewer (guest user)
        wsRef.current?.send(JSON.stringify({
          type: 'join',
          sessionId,
          userId: viewerIdRef.current,
          username: viewerUsername,
          role: 'user', // Viewers are treated as regular users
        }));
        
        // Fetch existing messages via REST API (same as GuestChat)
        fetch(`/api/chat/messages/${sessionId}`)
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) {
              console.log('Fetched initial messages for viewer:', data.length, 'messages');
              setMessages(data);
            }
          })
          .catch(err => console.error('Failed to fetch initial messages:', err));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data: ChatWebSocketMessage = JSON.parse(event.data);
          console.log('Viewer chat received message:', data);
          
          switch (data.type) {
            case 'new_message':
              if (data.message) {
                console.log('Adding new message to viewer chat:', data.message);
                setMessages(prev => {
                  // Avoid duplicates
                  const exists = prev.some(m => m.id === data.message!.id);
                  if (exists) return prev;
                  return [...prev, data.message!];
                });
              }
              break;
            case 'message_history':
              // Ignore message history from WebSocket since we fetch via REST API
              console.log('Ignoring WebSocket message history - using REST API instead');
              break;
            case 'participants_list':
              if (data.participants) {
                setParticipants(data.participants as ChatParticipant[]);
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

        // Attempt to reconnect after 3 seconds if still enabled
        if (enabled && viewerUsername) {
          console.log('Attempting to reconnect in 3 seconds...');
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Viewer WebSocket error:', error);
        setError('Connection error');
        setIsConnected(false);
      };
    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      setError('Failed to connect to chat');
    }
  }, [enabled, sessionId, viewerUsername]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      // Send leave message before closing
      if (wsRef.current.readyState === WebSocket.OPEN && viewerIdRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'leave',
          sessionId,
          userId: viewerIdRef.current,
        }));
      }
      
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setMessages([]);
    setParticipants([]);
  }, [sessionId]);

  const sendMessage = useCallback((content: string, recipientId?: number, messageType?: 'individual' | 'broadcast') => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to chat');
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'message',
      sessionId,
      content,
      recipientId,
      messageType: messageType || 'individual',
    }));
  }, [sessionId]);

  // Connect when enabled
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    messages,
    participants,
    isConnected,
    error,
    sendMessage,
    disconnect,
    canSendBroadcast: false // Viewers can't send broadcast messages
  };
}