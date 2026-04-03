import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import type { ChatMessage } from '@shared/schema';

interface ProductionPublicChatProps {
  productionId: string;
  guestUser: {
    id: number | null;
    username: string;
    role: string;
  };
  className?: string;
}

function isImage(content: string) {
  return content.startsWith('data:image/') || /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(content);
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ProductionPublicChat({ productionId, guestUser, className = '' }: ProductionPublicChatProps) {
  const sessionId = `pub-${productionId}`;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    let ws: WebSocket | null = null;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/chat`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);

        ws!.send(JSON.stringify({
          type: 'join',
          sessionId,
          userId: guestUser.id,
          username: guestUser.username,
          role: guestUser.role || 'user',
        }));

        fetch(`/api/chat/messages/${sessionId}?limit=100`)
          .then(r => r.json())
          .then(data => {
            if (mountedRef.current && Array.isArray(data)) {
              setMessages(data);
            }
          })
          .catch(() => {});
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_message' && data.message) {
            setMessages(prev => [...prev, data.message]);
          } else if (data.type === 'message_history' && Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        reconnectRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      ws?.close();
      wsRef.current = null;
    };
  }, [productionId, guestUser.username]);

  const send = () => {
    const msg = input.trim();
    if (!msg || !isConnected || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'message',
      sessionId,
      content: msg,
      messageType: 'individual',
    }));
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      {/* Status dot */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-800 shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-600'}`} />
        <span className="text-xs text-gray-500">{isConnected ? 'Connected' : 'Connecting…'}</span>
      </div>

      {/* Message list */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <p className="text-gray-600 text-xs">No messages yet — be the first to say hi!</p>
          </div>
        )}
        {messages.map(msg => {
          const isMine = msg.senderName === guestUser.username;
          const isBroadcast = msg.messageType === 'broadcast';
          return (
            <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
              {!isMine && (
                <span className="text-xs font-medium text-blue-400 mb-0.5 ml-1 truncate max-w-full">
                  {msg.senderName}
                </span>
              )}
              <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm leading-relaxed ${
                isBroadcast
                  ? 'bg-orange-600/80 text-white rounded-bl-sm'
                  : isMine
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-800 text-gray-100 rounded-bl-sm'
              }`}>
                {isBroadcast && (
                  <span className="text-xs text-orange-200 font-medium block mb-0.5">
                    📢 {msg.senderName}
                  </span>
                )}
                {isImage(msg.content) ? (
                  <img src={msg.content} alt="Shared" className="max-w-full rounded-lg" style={{ maxHeight: 200 }} />
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
              <span className="text-xs text-gray-600 mt-0.5 mx-1">{fmt(msg.createdAt.toString())}</span>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-gray-800 p-2">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={isConnected ? 'Say something…' : 'Connecting…'}
            disabled={!isConnected}
            className="flex-1 h-8 bg-gray-800 border-gray-700 text-white text-sm placeholder:text-gray-600 focus:border-blue-500"
          />
          <Button
            onClick={send}
            disabled={!input.trim() || !isConnected}
            size="sm"
            className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
