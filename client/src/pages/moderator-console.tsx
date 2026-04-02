import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, Radio, Users, Search, MessageSquare, ChevronLeft, QrCode, ImageIcon, Upload } from 'lucide-react';
import QRCode from 'qrcode';

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
  guestName?: string | null;
  guestEmail?: string | null;
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

function isImageContent(content: string) {
  return content.startsWith('data:image/') || /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(content);
}

function MessageContent({ content }: { content: string }) {
  if (isImageContent(content)) {
    return (
      <img
        src={content}
        alt="Shared image"
        className="max-w-full rounded-lg mt-1 border border-white/10"
        style={{ maxHeight: 280 }}
      />
    );
  }
  return <p className="text-sm leading-relaxed break-words">{content}</p>;
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
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const allMessagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const { data: allMessages = [] } = useQuery<ChatMessage[]>({
    queryKey: ['/api/productions', productionId, 'messages'],
    queryFn: async () => {
      const r = await fetch(`/api/productions/${productionId}/messages?limit=300`);
      if (!r.ok) throw new Error('Failed to fetch messages');
      return r.json();
    },
    refetchInterval: 3000,
    enabled: !!productionId && !selectedGuest,
  });

  const { data: privateMessages = [] } = useQuery<ChatMessage[]>({
    queryKey: ['/api/chat/messages', selectedGuest?.id],
    queryFn: async () => {
      const r = await fetch(`/api/chat/messages/${selectedGuest!.id}?limit=100`);
      if (!r.ok) throw new Error('Failed to fetch messages');
      return r.json();
    },
    refetchInterval: 3000,
    enabled: !!selectedGuest,
  });

  useEffect(() => { allMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [allMessages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [privateMessages]);

  useEffect(() => {
    if (selectedGuest && participantsData) {
      const updated = participantsData.participants.find(p => p.id === selectedGuest.id);
      if (updated && updated.status !== selectedGuest.status) setSelectedGuest(updated);
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
      setMediaDialogOpen(false);
      setQrPreview(null);
      setQrUrl('');
      setImagePreview(null);
      toast({
        title: 'Broadcast Sent',
        description: `Message delivered to ${data.sent} guest${data.sent !== 1 ? 's' : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/productions', productionId, 'messages'] });
      if (selectedGuest) queryClient.invalidateQueries({ queryKey: ['/api/chat/messages', selectedGuest.id] });
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

  const generateQr = useCallback(async () => {
    if (!qrUrl.trim()) return;
    setIsGeneratingQr(true);
    try {
      const dataUrl = await QRCode.toDataURL(qrUrl.trim(), {
        width: 400,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrPreview(dataUrl);
    } catch {
      toast({ title: 'Error', description: 'Failed to generate QR code', variant: 'destructive' });
    } finally {
      setIsGeneratingQr(false);
    }
  }, [qrUrl]);

  const handleImageFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Image too large', description: 'Please use an image under 2MB', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
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

  const participantLookup = useMemo(() => {
    const map: Record<string, Participant> = {};
    allParticipants.forEach(p => { map[p.id] = p; });
    return map;
  }, [allParticipants]);

  const deduplicatedMessages = useMemo(() => {
    const seen = new Set<string>();
    return allMessages.filter(msg => {
      if (msg.messageType !== 'broadcast') return true;
      const bucket = new Date(msg.createdAt).toISOString().slice(0, 16);
      const key = `${msg.senderId}|${msg.content}|${bucket}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allMessages]);

  return (
    <div className="flex h-[calc(100vh-60px)] bg-gray-900 overflow-hidden">

      {/* ── LEFT SIDEBAR ── */}
      <div className="w-72 border-r border-gray-700 flex flex-col shrink-0 bg-gray-900">
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

        <div className="flex gap-1 px-3 pb-2 border-b border-gray-700 flex-wrap">
          {(['all', 'live', 'waiting', 'offline'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-2 py-0.5 rounded-full capitalize transition-colors ${statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700'}`}
            >
              {s} {statusFilterCounts[s] > 0 && <span className="opacity-70">({statusFilterCounts[s]})</span>}
            </button>
          ))}
        </div>

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
                : 'border-l-2 border-l-transparent'}`}
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

        {/* Broadcast bar */}
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
            {/* QR / Image button */}
            <Button
              onClick={() => setMediaDialogOpen(true)}
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 bg-gray-800 hover:bg-gray-700 shrink-0"
              title="Send QR code or image to all guests"
            >
              <QrCode className="w-4 h-4" />
            </Button>
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
          /* ── PRIVATE CHAT VIEW ── */
          <>
            <div className="px-5 py-3 border-b border-gray-800 bg-gray-900/40 flex items-center gap-3">
              <button
                onClick={() => setSelectedGuest(null)}
                className="text-gray-400 hover:text-white transition-colors mr-1"
                title="Back to all chats"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
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
              <span className="text-gray-500 text-xs">Private Chat</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {privateMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center pt-12">
                  <MessageSquare className="w-10 h-10 text-gray-700 mb-3" />
                  <p className="text-gray-500 text-sm">No messages yet</p>
                  <p className="text-gray-600 text-xs mt-1">Send a message below to start the conversation</p>
                </div>
              )}
              {privateMessages.map(msg => {
                const fromModerator = msg.senderId !== null;
                const isBroadcast = msg.messageType === 'broadcast';
                return (
                  <div key={msg.id} className={`flex ${fromModerator ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[72%] rounded-2xl px-4 py-2.5 ${fromModerator
                      ? isBroadcast ? 'bg-orange-600/90 text-white rounded-br-sm' : 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-800 text-gray-100 rounded-bl-sm'}`}>
                      {fromModerator && isBroadcast && (
                        <div className="flex items-center gap-1 text-xs text-orange-200 font-medium mb-1">
                          <Radio className="w-3 h-3" /> Broadcast
                        </div>
                      )}
                      <MessageContent content={msg.content} />
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
          /* ── UNIFIED ALL-CHATS VIEW ── */
          <>
            <div className="px-5 py-2.5 border-b border-gray-800 bg-gray-900/40 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-gray-300 text-sm font-medium">All Participant Messages</span>
              <span className="text-gray-600 text-xs ml-auto">Click a guest in the sidebar to chat privately</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {deduplicatedMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center pt-12">
                  <MessageSquare className="w-12 h-12 text-gray-700 mb-3" />
                  <p className="text-gray-400 text-base font-medium">No messages yet</p>
                  <p className="text-gray-600 text-sm mt-1 max-w-xs">
                    Guest messages will appear here as participants chat. Use the broadcast bar above to message everyone.
                  </p>
                </div>
              )}
              {deduplicatedMessages.map(msg => {
                const fromModerator = msg.senderId !== null;
                const isBroadcast = msg.messageType === 'broadcast';
                const participant = participantLookup[msg.sessionId];
                const displayName = msg.guestName || participant?.guestName || msg.senderName;

                if (fromModerator) {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[80%] bg-orange-600/90 text-white rounded-2xl rounded-br-sm px-4 py-2.5">
                        <div className="flex items-center gap-1 text-xs text-orange-200 font-medium mb-1">
                          <Radio className="w-3 h-3" /> {isBroadcast ? 'Broadcast to All' : `To ${displayName}`}
                        </div>
                        <MessageContent content={msg.content} />
                        <div className="text-xs mt-1 text-white/50 text-right">
                          {msg.senderName} · {formatTime(msg.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="flex justify-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 shrink-0 mt-0.5">
                      {(displayName || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <button
                          onClick={() => {
                            const p = participant || allParticipants.find(ap => ap.id === msg.sessionId);
                            if (p) { setSelectedGuest(p); setChatInput(''); }
                          }}
                          className="text-xs font-semibold text-blue-300 hover:text-blue-200 transition-colors hover:underline"
                        >
                          {displayName || 'Guest'}
                        </button>
                        {participant && (
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(participant.status)}`} />
                        )}
                        <span className="text-gray-600 text-xs">{formatTime(msg.createdAt)}</span>
                      </div>
                      <div className="bg-gray-800 text-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[500px]">
                        <MessageContent content={msg.content} />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={allMessagesEndRef} />
            </div>
          </>
        )}
      </div>

      {/* ── QR / Image Broadcast Dialog ── */}
      <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-orange-400" />
              Send QR Code or Image to All Guests
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="qr">
            <TabsList className="bg-gray-800 border border-gray-700 w-full">
              <TabsTrigger value="qr" className="flex-1 data-[state=active]:bg-gray-700 data-[state=active]:text-white">
                <QrCode className="w-4 h-4 mr-2" /> QR Code
              </TabsTrigger>
              <TabsTrigger value="image" className="flex-1 data-[state=active]:bg-gray-700 data-[state=active]:text-white">
                <ImageIcon className="w-4 h-4 mr-2" /> Upload Image
              </TabsTrigger>
            </TabsList>

            {/* QR Code tab */}
            <TabsContent value="qr" className="mt-4 space-y-4">
              <div>
                <label className="text-sm text-gray-300 mb-1.5 block">Survey or website URL</label>
                <div className="flex gap-2">
                  <Input
                    value={qrUrl}
                    onChange={e => { setQrUrl(e.target.value); setQrPreview(null); }}
                    onKeyDown={e => e.key === 'Enter' && generateQr()}
                    placeholder="https://your-survey.com/link"
                    className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-orange-500"
                  />
                  <Button
                    onClick={generateQr}
                    disabled={!qrUrl.trim() || isGeneratingQr}
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 shrink-0"
                  >
                    {isGeneratingQr ? 'Generating…' : 'Generate'}
                  </Button>
                </div>
              </div>

              {qrPreview && (
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-white p-3 rounded-xl">
                    <img src={qrPreview} alt="QR Code preview" className="w-48 h-48" />
                  </div>
                  <p className="text-gray-400 text-xs text-center max-w-xs">
                    Guests will see this QR code they can scan to open the survey
                  </p>
                  <Button
                    onClick={() => broadcastMutation.mutate(qrPreview)}
                    disabled={broadcastMutation.isPending}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <Radio className="w-4 h-4 mr-2" />
                    {broadcastMutation.isPending ? 'Sending…' : `Send QR Code to All ${totalCount} Guests`}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Image upload tab */}
            <TabsContent value="image" className="mt-4 space-y-4">
              <div>
                <label className="text-sm text-gray-300 mb-1.5 block">Upload an image (max 2MB)</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleImageFile(file);
                  }}
                  className="border-2 border-dashed border-gray-600 hover:border-gray-400 rounded-xl p-8 text-center cursor-pointer transition-colors"
                >
                  <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Click to browse or drag & drop</p>
                  <p className="text-gray-600 text-xs mt-1">PNG, JPG, GIF, WebP</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleImageFile(file);
                  }}
                />
              </div>

              {imagePreview && (
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-w-full max-h-48 rounded-xl border border-gray-700 object-contain"
                  />
                  <Button
                    onClick={() => broadcastMutation.mutate(imagePreview)}
                    disabled={broadcastMutation.isPending}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <Radio className="w-4 h-4 mr-2" />
                    {broadcastMutation.isPending ? 'Sending…' : `Send Image to All ${totalCount} Guests`}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
