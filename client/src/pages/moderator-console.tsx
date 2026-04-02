import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, Radio, Users, Search, MessageSquare } from 'lucide-react';

type ParticipantStatus = 'live' | 'waiting' | 'offline';
type StatusFilter = ParticipantStatus | 'all';

interface Participant {
  id: string;
  streamName: string;
  guestName: string | null;
  guestEmail: string | null;
  status: ParticipantStatus;
  position?: number;
  linkStatus: 'active' | 'expired';
}

interface ChatMessage {
  id: number;
  sessionId: string;
  senderName: string;
  senderId: number | null;
  content: string;
  messageType: 'individual' | 'broadcast' | 'system';
  createdAt: string;
}

interface ParticipantsResponse {
  production: { id: string; name: string; maxParticipants: number };
  participants: Participant[];
}

function statusDotClass(status: ParticipantStatus) {
  if (status === 'live') return 'bg-green-500';
  if (status === 'waiting') return 'bg-yellow-500';
  return 'bg-gray-500';
}

function statusBadgeClass(status: ParticipantStatus) {
  if (status === 'live') return 'border-green-500 text-green-400';
  if (status === 'waiting') return 'border-yellow-500 text-yellow-400';
  return 'border-gray-600 text-gray-400';
}

function statusLabel(status: ParticipantStatus) {
  if (status === 'live') return 'Live';
  if (status === 'waiting') return 'Waiting';
  return 'Offline';
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ModeratorConsole() {
  const { id: productionId } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedGuest, setSelectedGuest] = useState<Participant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [chatInput, setChatInput] = useState('');
  const [broadcastInput, setBroadcastInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);

  const { data: participantsData } = useQuery<ParticipantsResponse>({
    queryKey: ['/api/productions', productionId, 'participants'],
    queryFn: async () => {
      const r = await fetch(`/api/productions/${productionId}/participants`);
      if (!r.ok) throw new Error('Failed to fetch participants');
      return r.json();
    },
    refetchInterval: 5000,
    enabled: !!productionId,
  });

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ['/api/chat/messages', selectedGuest?.id],
    queryFn: async () => {
      const r = await fetch(`/api/chat/messages/${selectedGuest!.id}?limit=100`);
      if (!r.ok) throw new Error('Failed to fetch messages');
      return r.json();
    },
    refetchInterval: 3000,
    enabled: !!selectedGuest,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedGuest && participantsData) {
      const updated = participantsData.participants.find(p => p.id === selectedGuest.id);
      if (updated && updated.status !== selectedGuest.status) {
        setSelectedGuest(updated);
      }
    }
  }, [participantsData]);

  const filteredGuests = useMemo(() => {
    const all = participantsData?.participants ?? [];
    return all.filter(p => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        (p.guestName ?? '').toLowerCase().includes(q) ||
        (p.guestEmail ?? '').toLowerCase().includes(q) ||
        p.streamName.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [participantsData, searchQuery, statusFilter]);

  const sendMutation = useMutation({
    mutationFn: async (msg: string) => {
      const r = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedGuest!.id, message: msg, messageType: 'individual' }),
      });
      if (!r.ok) throw new Error('Failed to send');
      return r.json();
    },
    onSuccess: () => {
      setChatInput('');
      queryClient.invalidateQueries({ queryKey: ['/api/chat/messages', selectedGuest?.id] });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' }),
  });

  const broadcastMutation = useMutation({
    mutationFn: async (msg: string) => {
      const r = await fetch(`/api/productions/${productionId}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      if (!r.ok) throw new Error('Failed to broadcast');
      return r.json();
    },
    onSuccess: (data) => {
      setBroadcastInput('');
      toast({
        title: 'Broadcast Sent',
        description: `Message delivered to ${data.sent} guest${data.sent !== 1 ? 's' : ''}`,
      });
      if (selectedGuest) {
        queryClient.invalidateQueries({ queryKey: ['/api/chat/messages', selectedGuest.id] });
      }
    },
    onError: () => toast({ title: 'Error', description: 'Failed to broadcast', variant: 'destructive' }),
  });

  const handleSend = () => {
    const msg = chatInput.trim();
    if (!msg || !selectedGuest || sendMutation.isPending) return;
    sendMutation.mutate(msg);
  };

  const handleBroadcast = () => {
    const msg = broadcastInput.trim();
    if (!msg || broadcastMutation.isPending) return;
    broadcastMutation.mutate(msg);
  };

  const production = participantsData?.production;
  const allParticipants = participantsData?.participants ?? [];
  const liveCount = allParticipants.filter(p => p.status === 'live').length;
  const waitingCount = allParticipants.filter(p => p.status === 'waiting').length;
  const totalCount = allParticipants.length;

  const statusFilterCounts: Record<StatusFilter, number> = {
    all: totalCount,
    live: liveCount,
    waiting: waitingCount,
    offline: allParticipants.filter(p => p.status === 'offline').length,
  };

  return (
    <div className="flex h-[calc(100vh-60px)] bg-gray-900 overflow-hidden">

      {/* ── LEFT SIDEBAR: Guest list ── */}
      <div className="w-72 border-r border-gray-700 flex flex-col shrink-0 bg-gray-900">

        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={() => window.location.href = '/productions'}
            className="inline-flex items-center gap-1 text-gray-400 hover:text-white text-xs mb-3 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Productions
          </button>
          <div className="flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-white font-semibold text-sm leading-tight truncate">
                {production?.name ?? 'Loading…'}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">Moderator Console</p>
            </div>
          </div>
          <div className="flex gap-4 mt-3 text-xs">
            <span className="text-green-400 font-medium">{liveCount} live</span>
            <span className="text-yellow-400 font-medium">{waitingCount} waiting</span>
            <span className="text-gray-500">{totalCount} total</span>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-500" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search guests…"
              className="pl-8 h-8 bg-gray-800 border-gray-700 text-white text-xs placeholder:text-gray-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1 px-3 pb-2 border-b border-gray-700 flex-wrap">
          {(['all', 'live', 'waiting', 'offline'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-2 py-0.5 rounded-full capitalize transition-colors ${statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700'
                }`}
            >
              {s} {statusFilterCounts[s] > 0 && <span className="opacity-70">({statusFilterCounts[s]})</span>}
            </button>
          ))}
        </div>

        {/* Guest list */}
        <div className="flex-1 overflow-y-auto">
          {filteredGuests.length === 0 && (
            <div className="p-6 text-center text-gray-500 text-xs">
              {searchQuery ? 'No guests match your search' : 'No guests in this production'}
            </div>
          )}
          {filteredGuests.map(guest => (
            <button
              key={guest.id}
              onClick={() => { setSelectedGuest(guest); setChatInput(''); }}
              className={`w-full text-left px-4 py-3 border-b border-gray-800/60 hover:bg-gray-800 transition-colors ${selectedGuest?.id === guest.id
                  ? 'bg-gray-800 border-l-2 border-l-blue-500'
                  : 'border-l-2 border-l-transparent'
                }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass(guest.status)}`} />
                <span className="text-white text-xs font-medium truncate flex-1">
                  {guest.guestName || guest.streamName}
                </span>
                <span className={`text-xs shrink-0 ${guest.status === 'live' ? 'text-green-400' : guest.status === 'waiting' ? 'text-yellow-400' : 'text-gray-600'}`}>
                  {guest.status === 'waiting' && guest.position != null ? `#${guest.position}` : statusLabel(guest.status)}
                </span>
              </div>
              {guest.guestEmail && (
                <p className="text-gray-500 text-xs mt-0.5 ml-4 truncate">{guest.guestEmail}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── RIGHT: Chat area ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-950">

        {/* Broadcast bar (always visible) */}
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-900/80">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 shrink-0">
              <Radio className="w-4 h-4 text-orange-400" />
              <span className="text-orange-400 text-xs font-semibold uppercase tracking-wide">Broadcast</span>
            </div>
            <Input
              value={broadcastInput}
              onChange={e => setBroadcastInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleBroadcast()}
              placeholder={`Send to all ${totalCount} guests in this production…`}
              className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 h-9 text-sm focus:border-orange-500"
            />
            <Button
              onClick={handleBroadcast}
              disabled={!broadcastInput.trim() || broadcastMutation.isPending}
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white shrink-0"
            >
              <Radio className="w-3.5 h-3.5 mr-1.5" />
              {broadcastMutation.isPending ? 'Sending…' : 'Send to All'}
            </Button>
          </div>
        </div>

        {selectedGuest ? (
          <>
            {/* Selected guest header */}
            <div className="px-5 py-3 border-b border-gray-800 bg-gray-900/40 flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full ${statusDotClass(selectedGuest.status)}`} />
              <div className="min-w-0 flex-1">
                <h2 className="text-white font-semibold text-sm truncate">
                  {selectedGuest.guestName || selectedGuest.streamName}
                </h2>
                {selectedGuest.guestEmail && (
                  <p className="text-gray-400 text-xs truncate">{selectedGuest.guestEmail}</p>
                )}
              </div>
              <Badge variant="outline" className={`text-xs shrink-0 ${statusBadgeClass(selectedGuest.status)}`}>
                {statusLabel(selectedGuest.status)}
                {selectedGuest.status === 'waiting' && selectedGuest.position != null && ` #${selectedGuest.position}`}
              </Badge>
            </div>

            {/* Messages */}
            <div ref={chatPanelRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center pt-12">
                  <MessageSquare className="w-10 h-10 text-gray-700 mb-3" />
                  <p className="text-gray-500 text-sm">No messages yet</p>
                  <p className="text-gray-600 text-xs mt-1">Send a message below to start the conversation</p>
                </div>
              )}
              {messages.map(msg => {
                const fromModerator = msg.senderId !== null;
                const isBroadcast = msg.messageType === 'broadcast';
                return (
                  <div key={msg.id} className={`flex ${fromModerator ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[72%] rounded-2xl px-4 py-2.5 ${fromModerator
                        ? isBroadcast
                          ? 'bg-orange-600/90 text-white rounded-br-sm'
                          : 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                      }`}>
                      {!fromModerator && (
                        <p className="text-xs text-gray-400 font-medium mb-1">{msg.senderName}</p>
                      )}
                      {fromModerator && isBroadcast && (
                        <div className="flex items-center gap-1 text-xs text-orange-200 font-medium mb-1">
                          <Radio className="w-3 h-3" /> Broadcast
                        </div>
                      )}
                      <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                      <div className={`text-xs mt-1 ${fromModerator ? 'text-white/50 text-right' : 'text-gray-500'}`}>
                        {fromModerator && <span className="mr-1">{msg.senderName}</span>}
                        {formatTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Private message input */}
            <div className="p-4 border-t border-gray-800 bg-gray-900/40">
              <div className="flex gap-2 items-center">
                <Input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder={`Private message to ${selectedGuest.guestName || 'guest'}…`}
                  className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500"
                />
                <Button
                  onClick={handleSend}
                  disabled={!chatInput.trim() || sendMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-600 mt-1.5">
                Only <span className="text-gray-400">{selectedGuest.guestName || 'this guest'}</span> will see this message
              </p>
            </div>
          </>
        ) : (
          /* No guest selected */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-gray-600" />
            </div>
            <h3 className="text-gray-300 font-medium mb-1">Select a guest to chat privately</h3>
            <p className="text-gray-600 text-sm max-w-xs">
              Click any guest in the sidebar to open their private chat. Use the broadcast bar above to message everyone.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
