import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { startPlayback } from "@/lib/streaming";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMobile } from "@/hooks/use-mobile";
import { InviteDialog } from "@/components/invite-dialog";
import { apiRequest } from "@/lib/queryClient";

interface RoomAssignment {
  id: number;
  roomId: string;
  roomName: string;
  streamName: string;
  assignedUserId?: number;
  assignedGuestName?: string;
  position: number;
  createdAt: string | Date;
  createdBy?: number;
}

interface GeneratedLink {
  id: string;
  streamName?: string;
  returnFeed: string;
  chatEnabled: boolean;
  url: string;
  createdAt: string | Date;
  expiresAt?: string | Date | null;
  shortLink?: string | null;
  shortCode?: string | null;
  assignedServer?: string | null;
  assignedWhepServer?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  productionId?: string | null;
  inviteStatus?: string | null;
  type: 'guest' | 'viewer';
  roomAssignments?: RoomAssignment[];
}

export default function Links() {
  const [previewingLinks, setPreviewingLinks] = useState<Set<string>>(new Set());
  const [videosReady, setVideosReady] = useState<Set<string>>(new Set());
  const [showChatForLink, setShowChatForLink] = useState<string | null>(null);
  const [restartNeeded, setRestartNeeded] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{[sessionId: string]: string}>({});
  const [chatHistory, setChatHistory] = useState<{[sessionId: string]: any[]}>({});
  const [chatParticipants, setChatParticipants] = useState<{[sessionId: string]: any[]}>({});
  const [chatConnections, setChatConnections] = useState<{[sessionId: string]: WebSocket}>({});
  const [unreadCounts, setUnreadCounts] = useState<{[sessionId: string]: number}>({});
  const [lastSeenMessageIds, setLastSeenMessageIds] = useState<{[sessionId: string]: number}>({});
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [inviteDialog, setInviteDialog] = useState<{
    open: boolean;
    type: 'streaming' | 'viewer' | 'short-link';
    linkId?: string;
    shortCode?: string;
    linkDetails: any;
  }>({
    open: false,
    type: 'streaming',
    linkDetails: {}
  });
  const [roomAssignDialog, setRoomAssignDialog] = useState<{
    open: boolean;
    linkId?: string;
    streamName?: string;
  }>({
    open: false
  });

  // New state for table redesign
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'guest' | 'viewer'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');
  const [previewModal, setPreviewModal] = useState<GeneratedLink | null>(null);
  const [chatModal, setChatModal] = useState<GeneratedLink | null>(null);

  const previewVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const chatScrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const { toast } = useToast();
  const { user } = useAuth();
  const { isMobile } = useMobile();

  const scrollChatToBottom = (sessionId: string) => {
    const chatElement = chatScrollRefs.current.get(sessionId);
    if (chatElement) {
      chatElement.scrollTop = chatElement.scrollHeight;
    }
  };

  useEffect(() => {
    if (showChatForLink && chatHistory[showChatForLink]) {
      setTimeout(() => scrollChatToBottom(showChatForLink), 100);
    }
  }, [chatHistory, showChatForLink]);

  useEffect(() => {
    return () => {
      Object.values(chatConnections).forEach(ws => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      });
    };
  }, [chatConnections]);

  const { data: links = [], isLoading, error, refetch } = useQuery({
    queryKey: ['/api/all-links'],
    queryFn: async () => {
      const guestResponse = await fetch('/api/links');
      if (!guestResponse.ok) throw new Error('Failed to fetch guest session links');
      const guestLinks = await guestResponse.json();

      const viewerResponse = await fetch('/api/viewer-links');
      if (!viewerResponse.ok) throw new Error('Failed to fetch viewer links');
      const viewerLinks = await viewerResponse.json();

      const allLinks: GeneratedLink[] = [
        ...guestLinks.map((link: any) => ({ ...link, type: 'guest' as const })),
        ...viewerLinks.map((link: any) => ({ ...link, type: 'viewer' as const }))
      ];
      return allLinks.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: rooms = [] } = useQuery<any[]>({
    queryKey: ['/api/rooms'],
    enabled: user?.role === 'admin' || user?.role === 'engineer',
  });

  const notificationWsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!links || !user || (user.role !== 'admin' && user.role !== 'engineer')) return;

    const initializeBaselines = async () => {
      const chatEnabledLinks = links.filter(link => link.chatEnabled);
      for (const link of chatEnabledLinks) {
        try {
          const response = await fetch(`/api/chat/messages/${link.id}`);
          if (response.ok) {
            const messages = await response.json();
            const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : 0;
            if (!lastSeenMessageIds[link.id]) {
              setLastSeenMessageIds(prev => ({ ...prev, [link.id]: lastMessageId }));
              setUnreadCounts(prev => ({ ...prev, [link.id]: 0 }));
            }
          }
        } catch (error) {
          console.error(`Error initializing baseline for ${link.id}:`, error);
        }
      }
    };

    const setupNotificationWebSocket = () => {
      if (notificationWsRef.current?.readyState === WebSocket.OPEN) return;
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/chat`;
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'notification_listener', userId: user.id, username: user.username, role: user.role }));
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'message' && data.message && data.sessionId) {
            if (showChatForLink !== data.sessionId) {
              const messageId = data.message.id;
              const lastSeen = lastSeenMessageIds[data.sessionId] || 0;
              if (messageId > lastSeen) {
                setUnreadCounts(prev => ({ ...prev, [data.sessionId]: (prev[data.sessionId] || 0) + 1 }));
              }
            }
          }
        } catch (error) { console.error('Error processing notification:', error); }
      };
      ws.onclose = () => {
        notificationWsRef.current = null;
        setTimeout(() => { if (links && user) setupNotificationWebSocket(); }, 5000);
      };
      ws.onerror = (error) => { console.error('Notification WebSocket error:', error); };
      notificationWsRef.current = ws;
    };

    initializeBaselines().then(() => setupNotificationWebSocket());
    return () => {
      if (notificationWsRef.current?.readyState === WebSocket.OPEN) notificationWsRef.current.close();
      notificationWsRef.current = null;
    };
  }, [links, user]);

  useEffect(() => {
    if (restartNeeded && links && links.length > 0) {
      const link = links.find(l => l.id === restartNeeded);
      if (link) {
        const streamName = link.type === 'guest' ? link.streamName : link.returnFeed;
        if (streamName) {
          stopPreview(restartNeeded);
          setTimeout(() => previewStream(streamName, restartNeeded, link.assignedServer), 300);
        }
      }
      setRestartNeeded(null);
    }
  }, [restartNeeded, links]);

  const isLinkExpired = (link: GeneratedLink): boolean => {
    if (!link.expiresAt) return false;
    return new Date() > new Date(link.expiresAt);
  };

  const getTimeUntilExpiry = (link: GeneratedLink): string => {
    if (!link.expiresAt) return "No expiry";
    const now = new Date();
    const diff = new Date(link.expiresAt).getTime() - now.getTime();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) { const days = Math.floor(hours / 24); return `${days}d`; }
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const deleteLinkMutation = useMutation({
    mutationFn: async ({ linkId, linkType }: { linkId: string; linkType: 'guest' | 'viewer' }) => {
      const endpoint = linkType === 'guest' ? `/api/links/${linkId}` : `/api/viewer-links/${linkId}`;
      const response = await fetch(endpoint, { method: 'DELETE' });
      if (!response.ok) throw new Error(`Failed to delete ${linkType} link`);
      return response.json();
    },
    onMutate: async ({ linkId }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/all-links'] });
      const previousLinks = queryClient.getQueryData(['/api/all-links']);
      queryClient.setQueryData(['/api/all-links'], (old: any[]) => old ? old.filter((link: any) => link.id !== linkId) : []);
      return { previousLinks };
    },
    onSuccess: () => { toast({ title: "Link Deleted", description: "The link has been removed" }); },
    onError: (error: Error, variables, context) => {
      if (context?.previousLinks) queryClient.setQueryData(['/api/all-links'], context.previousLinks);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/all-links'] });
      queryClient.invalidateQueries({ queryKey: ['/api/links'] });
      queryClient.invalidateQueries({ queryKey: ['/api/viewer-links'] });
    },
  });

  const deleteExpiredMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/links', { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete expired links');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/all-links'] });
      queryClient.invalidateQueries({ queryKey: ['/api/links'] });
      queryClient.invalidateQueries({ queryKey: ['/api/viewer-links'] });
    },
  });

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Copied!", description: "Link copied to clipboard" });
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast({ title: "Copied!", description: "Link copied to clipboard" });
    }
  };

  const previewStream = async (streamName: string, linkId: string, serverAddress?: string | null) => {
    setPreviewingLinks(prev => new Set(Array.from(prev).concat(linkId)));
    await new Promise(resolve => setTimeout(resolve, 100));
    const videoElement = previewVideoRefs.current.get(linkId);
    if (!videoElement) {
      setPreviewingLinks(prev => { const s = new Set(prev); s.delete(linkId); return s; });
      return;
    }
    try {
      await startPlayback(videoElement, streamName, 5, serverAddress || undefined);
      toast({ title: "Preview Started", description: `Now previewing: ${streamName}` });
    } catch (error) {
      toast({ title: "Preview Error", description: `Failed to start preview: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
      setPreviewingLinks(prev => { const s = new Set(prev); s.delete(linkId); return s; });
    }
  };

  const stopPreview = (linkId: string) => {
    const videoElement = previewVideoRefs.current.get(linkId);
    if (videoElement) {
      if (videoElement.srcObject instanceof MediaStream) videoElement.srcObject.getTracks().forEach(t => t.stop());
      videoElement.srcObject = null;
    }
    previewVideoRefs.current.delete(linkId);
    setPreviewingLinks(prev => { const s = new Set(prev); s.delete(linkId); return s; });
    setVideosReady(prev => { const s = new Set(prev); s.delete(linkId); return s; });
  };

  const deleteLink = (linkId: string, linkType: 'guest' | 'viewer') => {
    if (previewingLinks.has(linkId)) stopPreview(linkId);
    deleteLinkMutation.mutate({ linkId, linkType });
  };

  const copyIngestLink = (streamName: string) => {
    navigator.clipboard.writeText(`rtmp://cdn2.obedtv.live/live/${streamName}`).then(() => {
      toast({ title: "Copied!", description: "RTMP ingest link copied" });
    }).catch(() => {
      toast({ title: "Copy Failed", description: "Could not copy to clipboard", variant: "destructive" });
    });
  };

  const clearAllLinks = () => {
    Array.from(previewingLinks).forEach(linkId => stopPreview(linkId));
    links.forEach((link: GeneratedLink) => deleteLink(link.id, link.type));
  };

  const sendChatMessage = async (sessionId: string, message: string) => {
    if (!message.trim() || !user) return;
    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: message.trim(), messageType: 'individual' }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      setChatMessages(prev => ({ ...prev, [sessionId]: '' }));
      setTimeout(() => scrollChatToBottom(sessionId), 100);
      toast({ title: "Message Sent", description: "Message sent to guest" });
    } catch (error) {
      toast({ title: "Send Failed", description: "Could not send message", variant: "destructive" });
    }
  };

  const sendBroadcastMessage = async () => {
    if (!broadcastMessage.trim() || !user) return;
    try {
      const response = await fetch('/api/chat/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastMessage.trim() }),
      });
      if (!response.ok) throw new Error('Failed to send broadcast');
      setBroadcastMessage('');
      setShowBroadcastModal(false);
      toast({ title: "Broadcast Sent", description: "Message sent to all active sessions" });
    } catch {
      toast({ title: "Broadcast Failed", description: "Could not send broadcast message", variant: "destructive" });
    }
  };

  const connectToChatWebSocket = (linkId: string) => {
    if (chatConnections[linkId] || !user) return;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/chat`);
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join', sessionId: linkId, userId: user.id, username: user.username, role: user.role }));
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'new_message':
              if (data.message) {
                setChatHistory(prev => ({ ...prev, [linkId]: [...(prev[linkId] || []), data.message] }));
                setTimeout(() => scrollChatToBottom(linkId), 100);
              }
              break;
            case 'message_history':
              if (data.messages) {
                setChatHistory(prev => ({ ...prev, [linkId]: data.messages }));
                setTimeout(() => scrollChatToBottom(linkId), 100);
              }
              break;
            case 'participants_list':
              if (data.participants) setChatParticipants(prev => ({ ...prev, [linkId]: data.participants }));
              break;
            case 'error':
              toast({ title: "Chat Error", description: data.error || 'Unknown chat error', variant: "destructive" });
              break;
          }
        } catch { }
      };
      ws.onclose = () => {
        setChatConnections(prev => { const n = { ...prev }; delete n[linkId]; return n; });
      };
      ws.onerror = (e) => { console.error(`WebSocket error for session ${linkId}:`, e); };
      setChatConnections(prev => ({ ...prev, [linkId]: ws }));
    } catch (err) { console.error('Failed to create WebSocket connection:', err); }
  };

  const disconnectFromChatWebSocket = (linkId: string) => {
    const ws = chatConnections[linkId];
    if (ws) {
      ws.close();
      setChatConnections(prev => { const n = { ...prev }; delete n[linkId]; return n; });
    }
  };

  const toggleChatForLink = async (linkId: string) => {
    if (showChatForLink === linkId) {
      setShowChatForLink(null);
      disconnectFromChatWebSocket(linkId);
      if (previewingLinks.has(linkId)) setRestartNeeded(linkId);
    } else {
      if (showChatForLink && showChatForLink !== linkId) {
        disconnectFromChatWebSocket(showChatForLink);
        if (previewingLinks.has(showChatForLink)) setRestartNeeded(showChatForLink);
      }
      setShowChatForLink(linkId);
      setUnreadCounts(prev => ({ ...prev, [linkId]: 0 }));
      try {
        const response = await fetch(`/api/chat/messages/${linkId}`);
        if (response.ok) {
          const messages = await response.json();
          setLastSeenMessageIds(prev => ({ ...prev, [linkId]: messages.length > 0 ? messages[messages.length - 1].id : 0 }));
        }
      } catch { }
      await loadChatData(linkId);
      connectToChatWebSocket(linkId);
    }
  };

  const loadChatData = async (sessionId: string) => {
    try {
      const messagesResponse = await fetch(`/api/chat/messages/${sessionId}`);
      if (messagesResponse.ok) {
        const messages = await messagesResponse.json();
        setChatHistory(prev => ({ ...prev, [sessionId]: messages }));
      }
      const participantsResponse = await fetch(`/api/chat/participants/${sessionId}`);
      if (participantsResponse.ok) {
        const participants = await participantsResponse.json();
        setChatParticipants(prev => ({ ...prev, [sessionId]: participants }));
      }
    } catch { }
  };

  const removeExpiredLinks = () => {
    deleteExpiredMutation.mutate(undefined, {
      onSuccess: (data: any) => {
        toast({
          title: data.deletedCount === 0 ? "No Expired Links" : "Expired Links Removed",
          description: data.deletedCount === 0 ? "All links are still valid" : `${data.deletedCount} expired link${data.deletedCount !== 1 ? 's' : ''} removed`,
        });
      },
      onError: () => { toast({ title: "Error", description: "Failed to remove expired links", variant: "destructive" }); },
    });
  };

  const openInviteDialog = (link: GeneratedLink) => {
    setInviteDialog({
      open: true,
      type: link.type === 'guest' ? 'streaming' : 'viewer',
      linkId: link.id,
      linkDetails: { streamName: link.streamName, returnFeed: link.returnFeed, chatEnabled: link.chatEnabled, expiresAt: link.expiresAt ? new Date(link.expiresAt) : null }
    });
  };

  const openRoomAssignDialog = (link: GeneratedLink) => {
    setRoomAssignDialog({ open: true, linkId: link.id, streamName: link.streamName });
  };

  const assignToRoom = useMutation({
    mutationFn: async (data: { roomId: string; streamName: string; guestName?: string }) => {
      return apiRequest('POST', `/api/rooms/${data.roomId}/assign`, { streamName: data.streamName, assignedGuestName: data.guestName || `Guest_${data.streamName}` });
    },
    onSuccess: () => {
      toast({ title: "Assigned to room", description: "Guest stream has been assigned to the room" });
      setRoomAssignDialog({ open: false });
    },
    onError: (error: any) => {
      toast({ title: "Failed to assign to room", description: error.message || "Unknown error occurred", variant: "destructive" });
    }
  });

  // Filtered links for the table
  const filteredLinks = (links as GeneratedLink[]).filter(link => {
    if (filterType !== 'all' && link.type !== filterType) return false;
    if (filterStatus === 'active' && isLinkExpired(link)) return false;
    if (filterStatus === 'expired' && !isLinkExpired(link)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (link.streamName || '').toLowerCase().includes(q) ||
        (link.guestName || '').toLowerCase().includes(q) ||
        (link.guestEmail || '').toLowerCase().includes(q) ||
        (link.returnFeed || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const shortHost = (server?: string | null) => {
    if (!server) return '—';
    try {
      const raw = server.replace(/^https?:\/\//, '');
      return raw.split('/')[0];
    } catch { return server; }
  };

  // Open preview modal
  const openPreviewModal = (link: GeneratedLink) => {
    setPreviewModal(link);
  };

  const closePreviewModal = () => {
    if (previewModal) stopPreview(previewModal.id);
    setPreviewModal(null);
  };

  // Open chat modal
  const openChatModal = async (link: GeneratedLink) => {
    setChatModal(link);
    await toggleChatForLink(link.id);
  };

  const closeChatModal = () => {
    if (chatModal) {
      toggleChatForLink(chatModal.id);
    }
    setChatModal(null);
  };

  return (
    <div className={`min-h-screen ${isMobile ? 'py-4 px-3' : 'py-6 px-6'}`}>
      <div className="w-full max-w-none">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold va-text-primary flex items-center gap-2">
              Generated Links
              {!isLoading && (
                <span className="text-sm font-normal bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                  {links.length}
                </span>
              )}
            </h1>
            <p className="va-text-secondary text-sm">View and manage all streaming links</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setShowBroadcastModal(true)}
              variant="outline"
              size="sm"
              className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
              data-testid="button-broadcast-message"
            >
              <i className="fas fa-broadcast-tower mr-2"></i>
              Broadcast
            </Button>
            {links.length > 0 && (
              <>
                <Button
                  onClick={removeExpiredLinks}
                  variant="outline"
                  size="sm"
                  className="border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white"
                  data-testid="button-remove-expired"
                >
                  <i className="fas fa-clock mr-2"></i>
                  Remove Expired
                </Button>
                <Button
                  onClick={clearAllLinks}
                  variant="outline"
                  size="sm"
                  className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                  data-testid="button-clear-all"
                >
                  <i className="fas fa-trash mr-2"></i>
                  Clear All
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        {links.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <Input
                placeholder="Search by name, guest, email, or feed…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 va-bg-dark-surface va-border-dark va-text-primary h-9 text-sm"
              />
            </div>
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="w-36 h-9 va-bg-dark-surface va-border-dark va-text-primary text-sm">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent className="va-bg-dark-surface va-border-dark">
                <SelectItem value="all" className="va-text-primary">All Types</SelectItem>
                <SelectItem value="guest" className="va-text-primary">Guest Only</SelectItem>
                <SelectItem value="viewer" className="va-text-primary">Viewer Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
              <SelectTrigger className="w-36 h-9 va-bg-dark-surface va-border-dark va-text-primary text-sm">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent className="va-bg-dark-surface va-border-dark">
                <SelectItem value="all" className="va-text-primary">All Status</SelectItem>
                <SelectItem value="active" className="va-text-primary">Active</SelectItem>
                <SelectItem value="expired" className="va-text-primary">Expired</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || filterType !== 'all' || filterStatus !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-gray-400 hover:text-gray-200"
                onClick={() => { setSearchQuery(''); setFilterType('all'); setFilterStatus('all'); }}
              >
                <i className="fas fa-times mr-1"></i>
                Clear
              </Button>
            )}
            {filteredLinks.length !== links.length && (
              <span className="self-center text-xs text-gray-400">
                {filteredLinks.length} of {links.length}
              </span>
            )}
          </div>
        )}

        {/* Empty State */}
        {isLoading ? (
          <div className="va-bg-dark-surface rounded-xl p-12 border va-border-dark text-center">
            <i className="fas fa-spinner fa-spin text-3xl text-gray-500 mb-3"></i>
            <p className="va-text-secondary">Loading links…</p>
          </div>
        ) : links.length === 0 ? (
          <div className="va-bg-dark-surface rounded-xl p-12 border va-border-dark text-center">
            <i className="fas fa-link text-4xl text-gray-500 mb-4"></i>
            <h3 className="text-xl font-semibold va-text-primary mb-2">No Links Generated</h3>
            <p className="va-text-secondary mb-6">Start by creating links in the Link Generator</p>
            <Button
              onClick={() => window.location.href = '/generator'}
              className="va-bg-primary hover:va-bg-primary-dark text-va-dark-bg"
              data-testid="button-go-to-generator"
            >
              <i className="fas fa-plus mr-2"></i>
              Generate Links
            </Button>
          </div>
        ) : filteredLinks.length === 0 ? (
          <div className="va-bg-dark-surface rounded-xl p-10 border va-border-dark text-center">
            <i className="fas fa-filter text-3xl text-gray-500 mb-3"></i>
            <p className="va-text-primary font-medium mb-1">No links match your filters</p>
            <p className="va-text-secondary text-sm">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          /* Links Table */
          <div className="va-bg-dark-surface rounded-xl border va-border-dark overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b va-border-dark bg-black/20">
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-16">Type</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Participant</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">Feed</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-32 hidden md:table-cell">WHIP Server</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Short Link</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24 hidden sm:table-cell">Expires</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y va-border-dark">
                  {filteredLinks.map((link: GeneratedLink) => {
                    const expired = isLinkExpired(link);
                    const displayName = link.type === 'guest' ? (link.guestName || link.streamName || '—') : (link.returnFeed || 'Viewer Link');
                    const subName = link.type === 'guest' && link.guestName ? link.streamName : null;
                    const shortUrl = link.shortLink ? `${window.location.origin}${link.shortLink}` : null;

                    return (
                      <tr
                        key={link.id}
                        className={`hover:bg-white/5 transition-colors ${expired ? 'opacity-60' : ''}`}
                      >
                        {/* Type */}
                        <td className="px-3 py-2.5">
                          <Badge
                            variant="outline"
                            className={`text-xs px-1.5 py-0.5 ${
                              link.type === 'guest'
                                ? 'va-text-green border-va-primary'
                                : 'bg-purple-500/20 text-purple-400 border-purple-500/50'
                            }`}
                          >
                            {link.type === 'guest' ? 'Guest' : 'Viewer'}
                          </Badge>
                        </td>

                        {/* Participant */}
                        <td className="px-3 py-2.5 max-w-[180px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium va-text-primary truncate" data-testid={`text-stream-${link.id}`}>
                              {displayName}
                            </span>
                            {link.chatEnabled && (
                              <i className="fas fa-comments text-blue-400 text-xs flex-shrink-0" title="Chat enabled"></i>
                            )}
                            {link.roomAssignments && link.roomAssignments.length > 0 && (
                              <Badge variant="outline" className="bg-indigo-500/20 text-indigo-400 border-indigo-500/50 text-[10px] px-1 py-0">
                                <i className="fas fa-users mr-0.5"></i>{link.roomAssignments[0].roomName}
                              </Badge>
                            )}
                          </div>
                          {subName && <div className="text-xs text-gray-500 font-mono truncate">{subName}</div>}
                          {link.guestEmail && <div className="text-xs text-gray-500 truncate">{link.guestEmail}</div>}
                        </td>

                        {/* Feed */}
                        <td className="px-3 py-2.5">
                          <span className="text-xs va-text-secondary truncate block max-w-[100px]" title={link.returnFeed}>
                            {link.returnFeed || '—'}
                          </span>
                        </td>

                        {/* WHIP Server */}
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          <span className="text-xs font-mono text-gray-400 truncate block max-w-[120px]" title={link.assignedServer || ''}>
                            {shortHost(link.assignedServer)}
                          </span>
                        </td>

                        {/* Short Link */}
                        <td className="px-3 py-2.5 hidden lg:table-cell">
                          {shortUrl ? (
                            <code className="text-xs va-text-green font-mono truncate block max-w-[200px]" data-testid={`text-short-url-${link.id}`} title={shortUrl}>
                              {shortUrl}
                            </code>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>

                        {/* Expires */}
                        <td className="px-3 py-2.5 hidden sm:table-cell">
                          {link.expiresAt ? (
                            <span className={`text-xs ${expired ? 'text-red-400' : 'text-orange-400'}`}>
                              {getTimeUntilExpiry(link)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {/* Preview */}
                            {((link.type === 'guest' && link.streamName) || link.type === 'viewer') && (
                              <button
                                onClick={() => openPreviewModal(link)}
                                className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                                title="Preview stream"
                                data-testid={`button-preview-${link.id}`}
                              >
                                <i className="fas fa-eye text-xs"></i>
                              </button>
                            )}

                            {/* Copy link */}
                            <button
                              onClick={() => copyToClipboard(shortUrl || link.url)}
                              className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-green-400 hover:bg-green-400/10 transition-colors"
                              title="Copy link"
                              data-testid={`button-copy-${link.id}`}
                            >
                              <i className="fas fa-copy text-xs"></i>
                            </button>

                            {/* Open viewer */}
                            <button
                              onClick={() => {
                                if (link.type === 'guest') {
                                  const serverParam = link.assignedServer ? `&server=${encodeURIComponent(link.assignedServer)}` : '';
                                  window.open(`/viewer?stream=${encodeURIComponent(link.streamName || '')}${serverParam}`, '_blank');
                                } else {
                                  window.open(link.url, '_blank');
                                }
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                              title="Open viewer"
                              data-testid={`button-open-${link.id}`}
                            >
                              <i className="fas fa-external-link-alt text-xs"></i>
                            </button>

                            {/* Copy ingest (guest only) */}
                            {link.type === 'guest' && link.streamName && (
                              <button
                                onClick={() => copyIngestLink(link.streamName!)}
                                className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-purple-400 hover:bg-purple-400/10 transition-colors"
                                title="Copy RTMP ingest link"
                                data-testid={`button-copy-ingest-${link.id}`}
                              >
                                <i className="fas fa-broadcast-tower text-xs"></i>
                              </button>
                            )}

                            {/* Email invite */}
                            <button
                              onClick={() => openInviteDialog(link)}
                              className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-green-400 hover:bg-green-400/10 transition-colors"
                              title="Send email invite"
                              data-testid={`button-invite-${link.id}`}
                            >
                              <i className="fas fa-envelope text-xs"></i>
                            </button>

                            {/* Assign to room */}
                            {link.type === 'guest' && link.streamName && user && (user.role === 'admin' || user.role === 'engineer') && rooms.length > 0 && (
                              <button
                                onClick={() => openRoomAssignDialog(link)}
                                className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-orange-400 hover:bg-orange-400/10 transition-colors"
                                title="Assign to room"
                                data-testid={`button-assign-room-${link.id}`}
                              >
                                <i className="fas fa-video text-xs"></i>
                              </button>
                            )}

                            {/* Chat */}
                            {link.chatEnabled && user && (user.role === 'admin' || user.role === 'engineer') && (
                              <button
                                onClick={() => openChatModal(link)}
                                className="relative w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                                title="Open chat"
                                data-testid={`button-chat-${link.id}`}
                              >
                                <i className="fas fa-comments text-xs"></i>
                                {unreadCounts[link.id] > 0 && (
                                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                                    {unreadCounts[link.id] > 9 ? '9+' : unreadCounts[link.id]}
                                  </span>
                                )}
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              onClick={() => deleteLink(link.id, link.type)}
                              className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                              title="Delete link"
                              data-testid={`button-delete-${link.id}`}
                            >
                              <i className="fas fa-trash text-xs"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <Dialog open={!!previewModal} onOpenChange={(open) => { if (!open) closePreviewModal(); }}>
        <DialogContent className="va-bg-dark-surface va-border-dark max-w-2xl w-full p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="va-text-primary text-sm flex items-center gap-2">
              <i className="fas fa-eye text-blue-400"></i>
              Preview: {previewModal?.type === 'guest' ? previewModal?.streamName : previewModal?.returnFeed}
            </DialogTitle>
          </DialogHeader>
          <div className="relative bg-black aspect-video">
            {previewModal && previewingLinks.has(previewModal.id) ? (
              <>
                <video
                  key={`modal-video-${previewModal.id}`}
                  ref={(el) => {
                    if (el && previewModal) previewVideoRefs.current.set(previewModal.id, el);
                  }}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  data-testid={`video-preview-${previewModal?.id}`}
                />
                <button
                  onClick={() => previewModal && stopPreview(previewModal.id)}
                  className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded bg-red-500/80 hover:bg-red-500 text-white transition-colors"
                  title="Stop preview"
                  data-testid={`button-stop-preview-${previewModal?.id}`}
                >
                  <i className="fas fa-stop text-xs"></i>
                </button>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center va-bg-dark-surface-2">
                <div className="text-center">
                  <i className="fas fa-eye text-3xl text-gray-500 mb-3"></i>
                  <p className="va-text-secondary text-sm mb-3">
                    {previewModal?.type === 'guest' ? previewModal?.streamName : previewModal?.returnFeed}
                  </p>
                  {previewModal && (
                    <Button
                      onClick={() => {
                        const streamName = previewModal.type === 'guest' ? previewModal.streamName! : previewModal.returnFeed!;
                        previewStream(streamName, previewModal.id, previewModal.type === 'guest' ? previewModal.assignedServer : undefined);
                      }}
                      size="sm"
                      className="va-bg-primary hover:va-bg-primary-dark text-va-dark-bg"
                    >
                      <i className="fas fa-play mr-2"></i>
                      Start Preview
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Modal */}
      <Dialog open={!!chatModal} onOpenChange={(open) => { if (!open) closeChatModal(); }}>
        <DialogContent className="va-bg-dark-surface va-border-dark max-w-lg w-full">
          <DialogHeader>
            <DialogTitle className="va-text-primary flex items-center gap-2 text-sm">
              <i className="fas fa-comments text-blue-400"></i>
              Chat: {chatModal?.type === 'guest' ? (chatModal?.guestName || chatModal?.streamName) : chatModal?.returnFeed}
            </DialogTitle>
          </DialogHeader>

          {chatModal && (
            <div className="flex flex-col gap-3">
              {/* Participants */}
              {chatParticipants[chatModal.id] && chatParticipants[chatModal.id].length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {chatParticipants[chatModal.id].map((p: any) => (
                    <span
                      key={`p-${p.id || `${p.userId}-${p.sessionId}`}`}
                      className={`px-2 py-0.5 rounded-full text-xs ${p.isOnline ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}
                    >
                      <i className={`fas fa-circle mr-1 ${p.isOnline ? 'text-green-400' : 'text-gray-400'}`} style={{ fontSize: '6px' }}></i>
                      {p.username}
                    </span>
                  ))}
                </div>
              )}

              {/* Messages */}
              <div
                ref={(el) => {
                  if (el && chatModal) chatScrollRefs.current.set(chatModal.id, el);
                  else if (chatModal) chatScrollRefs.current.delete(chatModal.id);
                }}
                className="va-bg-dark-surface-2 rounded-lg p-3 overflow-y-auto max-h-72 min-h-[8rem]"
              >
                {chatHistory[chatModal.id] && chatHistory[chatModal.id].length > 0 ? (
                  <div className="space-y-2">
                    {chatHistory[chatModal.id].map((message: any, index: number) => {
                      const isMe = message.senderId === user?.id;
                      return (
                        <div key={`msg-${message.id || `temp-${index}`}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] p-2.5 rounded-lg text-sm ${
                            message.messageType === 'broadcast'
                              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                              : isMe
                                ? 'va-bg-primary/20 va-text-primary'
                                : 'bg-gray-700/50 va-text-primary'
                          }`}>
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span className="font-medium text-xs">{message.senderName}</span>
                              <span className="text-[10px] va-text-secondary">{new Date(message.createdAt).toLocaleTimeString()}</span>
                            </div>
                            <p className="leading-snug">{message.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-center va-text-secondary py-6">
                    <div>
                      <i className="fas fa-comment-slash text-xl mb-2"></i>
                      <p className="text-sm">No messages yet</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  value={chatMessages[chatModal.id] || ''}
                  onChange={(e) => setChatMessages(prev => ({ ...prev, [chatModal!.id]: e.target.value }))}
                  placeholder="Type a message…"
                  className="flex-1 text-sm va-bg-dark-surface-2 va-border-dark va-text-primary h-9"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && chatModal) {
                      e.preventDefault();
                      sendChatMessage(chatModal.id, chatMessages[chatModal.id] || '');
                    }
                  }}
                />
                <Button
                  onClick={() => chatModal && sendChatMessage(chatModal.id, chatMessages[chatModal.id] || '')}
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 text-white h-9 px-3"
                  disabled={!chatMessages[chatModal?.id]?.trim()}
                >
                  <i className="fas fa-paper-plane"></i>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Broadcast Modal */}
      <Dialog open={showBroadcastModal} onOpenChange={setShowBroadcastModal}>
        <DialogContent className="va-bg-dark-surface va-border-dark">
          <DialogHeader>
            <DialogTitle className="va-text-primary flex items-center">
              <i className="fas fa-broadcast-tower mr-2 text-blue-400"></i>
              Send Broadcast Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm va-text-secondary">This message will be sent to all users in all active sessions.</div>
            <Textarea
              placeholder="Enter your broadcast message..."
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              className="va-bg-dark-surface-2 va-border-dark va-text-primary"
              rows={4}
              data-testid="textarea-broadcast-message"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setBroadcastMessage(''); setShowBroadcastModal(false); }} data-testid="button-cancel-broadcast">Cancel</Button>
              <Button onClick={sendBroadcastMessage} disabled={!broadcastMessage.trim()} className="bg-blue-500 hover:bg-blue-600 text-white" data-testid="button-send-broadcast">
                <i className="fas fa-broadcast-tower mr-2"></i>Send Broadcast
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Invite Dialog */}
      <InviteDialog
        open={inviteDialog.open}
        onOpenChange={(open) => setInviteDialog(prev => ({ ...prev, open }))}
        inviteType={inviteDialog.type}
        linkId={inviteDialog.linkId}
        shortCode={inviteDialog.shortCode}
        linkDetails={inviteDialog.linkDetails}
      />

      {/* Room Assignment Dialog */}
      <Dialog open={roomAssignDialog.open} onOpenChange={(open) => setRoomAssignDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="va-bg-dark-surface va-border-dark">
          <DialogHeader>
            <DialogTitle className="va-text-primary flex items-center">
              <i className="fas fa-video mr-2 text-orange-400"></i>
              Assign to Room
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm va-text-secondary">
              Assign the stream "{roomAssignDialog.streamName}" to a room for multi-stream viewing.
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium va-text-primary">Select Room:</label>
              <Select onValueChange={(roomId) => {
                if (roomAssignDialog.streamName) {
                  assignToRoom.mutate({ roomId, streamName: roomAssignDialog.streamName, guestName: `Guest_${roomAssignDialog.streamName}` });
                }
              }}>
                <SelectTrigger className="va-bg-dark-surface-2 va-border-dark va-text-primary">
                  <SelectValue placeholder="Choose a room..." />
                </SelectTrigger>
                <SelectContent className="va-bg-dark-surface va-border-dark">
                  {rooms.map((room: any) => (
                    <SelectItem key={room.id} value={room.id} className="va-text-primary hover:va-bg-dark-surface-2">
                      {room.name}
                      {room.description && <span className="text-xs va-text-secondary ml-2">- {room.description}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRoomAssignDialog({ open: false })} data-testid="button-cancel-room-assign">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
