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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMobile } from "@/hooks/use-mobile";
import { InviteDialog } from "@/components/invite-dialog";

interface GeneratedLink {
  id: string;
  streamName?: string; // Only for guest session links
  returnFeed: string;
  chatEnabled: boolean;
  url: string;
  createdAt: string | Date;
  expiresAt?: string | Date | null;
  shortLink?: string | null;
  shortCode?: string | null;
  type: 'guest' | 'viewer'; // Add type to distinguish link types
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
  const previewVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const chatScrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const { toast } = useToast();
  const { user } = useAuth();
  const { isMobile } = useMobile();

  // Function to scroll chat to bottom
  const scrollChatToBottom = (sessionId: string) => {
    const chatElement = chatScrollRefs.current.get(sessionId);
    if (chatElement) {
      chatElement.scrollTop = chatElement.scrollHeight;
    }
  };

  // Auto-scroll when chat history changes
  useEffect(() => {
    if (showChatForLink && chatHistory[showChatForLink]) {
      // Small delay to ensure DOM has updated
      setTimeout(() => {
        scrollChatToBottom(showChatForLink);
      }, 100);
    }
  }, [chatHistory, showChatForLink]);

  // Cleanup WebSocket connections when component unmounts
  useEffect(() => {
    return () => {
      Object.values(chatConnections).forEach(ws => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
    };
  }, [chatConnections]);

  // Fetch both guest session links and viewer links with automatic refresh
  const { data: links = [], isLoading, error, refetch } = useQuery({
    queryKey: ['/api/all-links'],
    queryFn: async () => {
      // Fetch guest session links
      const guestResponse = await fetch('/api/links');
      if (!guestResponse.ok) {
        throw new Error('Failed to fetch guest session links');
      }
      const guestLinks = await guestResponse.json();
      
      // Fetch viewer links
      const viewerResponse = await fetch('/api/viewer-links');
      if (!viewerResponse.ok) {
        throw new Error('Failed to fetch viewer links');
      }
      const viewerLinks = await viewerResponse.json();
      
      // Combine and mark link types
      const allLinks: GeneratedLink[] = [
        ...guestLinks.map((link: any) => ({ ...link, type: 'guest' as const })),
        ...viewerLinks.map((link: any) => ({ ...link, type: 'viewer' as const }))
      ];
      
      // Sort by creation date (newest first)
      return allLinks.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    refetchInterval: 5000, // Automatically refresh every 5 seconds
    refetchOnWindowFocus: true, // Refresh when user returns to tab
    refetchOnMount: true, // Always refresh on component mount
  });

  // Handle restart after chat closes (must be after links declaration)
  useEffect(() => {
    if (restartNeeded && links && links.length > 0) {
      console.log(`Processing restart for ${restartNeeded}`);
      
      // Find the link to get stream name
      const link = links.find(l => l.id === restartNeeded);
      if (link) {
        const streamName = link.type === 'guest' ? link.streamName : link.returnFeed;
        
        if (streamName) {
          console.log(`Restarting preview for stream: ${streamName}`);
          
          // Stop current preview
          stopPreview(restartNeeded);
          
          // Small delay then restart
          setTimeout(() => {
            console.log(`Starting fresh preview for ${streamName}`);
            previewStream(streamName, restartNeeded);
          }, 300);
        }
      }
      
      // Clear the restart flag
      setRestartNeeded(null);
    }
  }, [restartNeeded, links]);

  const isLinkExpired = (link: GeneratedLink): boolean => {
    if (!link.expiresAt) return false;
    return new Date() > new Date(link.expiresAt);
  };

  const getTimeUntilExpiry = (link: GeneratedLink): string => {
    if (!link.expiresAt) return "Never expires";
    
    const now = new Date();
    const diff = new Date(link.expiresAt).getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days !== 1 ? 's' : ''} remaining`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  };

  // Mutations for link operations
  const deleteLinkMutation = useMutation({
    mutationFn: async ({ linkId, linkType }: { linkId: string; linkType: 'guest' | 'viewer' }) => {
      const endpoint = linkType === 'guest' ? `/api/links/${linkId}` : `/api/viewer-links/${linkId}`;
      const response = await fetch(endpoint, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Failed to delete ${linkType} link`);
      }
      return response.json();
    },
    onMutate: async ({ linkId }) => {
      // Cancel any outgoing refetches to avoid race conditions
      await queryClient.cancelQueries({ queryKey: ['/api/all-links'] });
      
      // Get current data
      const previousLinks = queryClient.getQueryData(['/api/all-links']);
      
      // Optimistically remove the link from the UI immediately
      queryClient.setQueryData(['/api/all-links'], (old: any[]) => 
        old ? old.filter((link: any) => link.id !== linkId) : []
      );
      
      // Return context with previous data for rollback
      return { previousLinks };
    },
    onSuccess: () => {
      toast({
        title: "Link Deleted",
        description: "The link has been removed from your list",
      });
    },
    onError: (error: Error, variables, context) => {
      // Rollback optimistic update if the mutation fails
      if (context?.previousLinks) {
        queryClient.setQueryData(['/api/all-links'], context.previousLinks);
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Refetch to ensure data consistency regardless of success/failure
      queryClient.invalidateQueries({ queryKey: ['/api/all-links'] });
      queryClient.invalidateQueries({ queryKey: ['/api/links'] });
      queryClient.invalidateQueries({ queryKey: ['/api/viewer-links'] });
    },
  });

  const deleteExpiredMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/links', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete expired links');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all link-related queries to ensure UI updates immediately  
      queryClient.invalidateQueries({ queryKey: ['/api/all-links'] });
      queryClient.invalidateQueries({ queryKey: ['/api/links'] });
      queryClient.invalidateQueries({ queryKey: ['/api/viewer-links'] });
    },
  });

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Success",
        description: "Link copied to clipboard!",
      });
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      
      toast({
        title: "Success", 
        description: "Link copied to clipboard!",
      });
    }
  };

  const previewStream = async (streamName: string, linkId: string) => {
    console.log(`Starting preview for stream: ${streamName}`);
    console.log('SRS SDK available:', !!window.SrsRtcWhipWhepAsync);

    // Add the link to previewing set
    setPreviewingLinks(prev => new Set(Array.from(prev).concat(linkId)));

    // Wait for the video element to be rendered
    await new Promise(resolve => setTimeout(resolve, 100));

    const videoElement = previewVideoRefs.current.get(linkId);
    if (!videoElement) {
      console.error('Video element not found after setting preview link');
      setPreviewingLinks(prev => {
        const newSet = new Set(prev);
        newSet.delete(linkId);
        return newSet;
      });
      return;
    }

    console.log('Video element:', videoElement);

    try {
      console.log('Calling startPlayback...');
      await startPlayback(videoElement, streamName);
      console.log('Preview started successfully, checking video element stream...');
      
      // Add debugging for video element
      console.log('Video element srcObject:', videoElement.srcObject);
      if (videoElement.srcObject instanceof MediaStream) {
        console.log('Video element video tracks:', videoElement.srcObject.getVideoTracks().length);
      }
      
      toast({
        title: "Preview Started",
        description: `Now previewing stream: ${streamName}`,
      });
    } catch (error) {
      console.error('Preview error:', error);
      toast({
        title: "Preview Error",
        description: `Failed to start preview: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      setPreviewingLinks(prev => {
        const newSet = new Set(prev);
        newSet.delete(linkId);
        return newSet;
      });
    }
  };

  const stopPreview = (linkId: string) => {
    const videoElement = previewVideoRefs.current.get(linkId);
    if (videoElement) {
      console.log(`Stopping preview for link: ${linkId}`);
      // Stop all tracks if there's a stream
      if (videoElement.srcObject && videoElement.srcObject instanceof MediaStream) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
      }
      videoElement.srcObject = null;
    }
    previewVideoRefs.current.delete(linkId);
    setPreviewingLinks(prev => {
      const newSet = new Set(prev);
      newSet.delete(linkId);
      return newSet;
    });
    setVideosReady(prev => {
      const newSet = new Set(prev);
      newSet.delete(linkId);
      return newSet;
    });
  };

  const deleteLink = (linkId: string, linkType: 'guest' | 'viewer') => {
    if (previewingLinks.has(linkId)) {
      stopPreview(linkId);
    }

    deleteLinkMutation.mutate({ linkId, linkType });
  };

  const copyIngestLink = (streamName: string) => {
    const ingestUrl = `rtmp://cdn2.obedtv.live/live/${streamName}`;
    navigator.clipboard.writeText(ingestUrl).then(() => {
      toast({
        title: "Copied!",
        description: "RTMP ingest link copied to clipboard",
      });
    }).catch(() => {
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    });
  };

  const clearAllLinks = () => {
    // Stop all previews first
    Array.from(previewingLinks).forEach(linkId => stopPreview(linkId));
    // Delete all links one by one
    links.forEach((link: GeneratedLink) => deleteLink(link.id, link.type));
  };

  const sendChatMessage = async (sessionId: string, message: string) => {
    if (!message.trim() || !user) return;

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          message: message.trim(),
          messageType: 'individual', // Always individual for chat interface
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Clear the message input
      setChatMessages(prev => ({ ...prev, [sessionId]: '' }));
      
      // Auto-scroll after sending message
      setTimeout(() => scrollChatToBottom(sessionId), 100);
      
      toast({
        title: "Message Sent",
        description: "Message sent to guest",
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Send Failed",
        description: "Could not send message",
        variant: "destructive",
      });
    }
  };

  const sendBroadcastMessage = async () => {
    if (!broadcastMessage.trim() || !user) return;

    try {
      // Send broadcast to all active sessions
      const response = await fetch('/api/chat/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: broadcastMessage.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send broadcast message');
      }

      // Clear the message input and close modal
      setBroadcastMessage('');
      setShowBroadcastModal(false);
      
      toast({
        title: "Broadcast Sent",
        description: "Message sent to all active sessions",
      });
    } catch (error) {
      console.error('Error sending broadcast:', error);
      toast({
        title: "Broadcast Failed",
        description: "Could not send broadcast message",
        variant: "destructive",
      });
    }
  };

  const connectToChatWebSocket = (linkId: string) => {
    if (chatConnections[linkId] || !user) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/chat`;
      
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`Chat WebSocket connected for session ${linkId}`);
        
        // Send join message
        ws.send(JSON.stringify({
          type: 'join',
          sessionId: linkId,
          userId: user.id,
          username: user.username,
          role: user.role,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'new_message':
              if (data.message) {
                setChatHistory(prev => ({
                  ...prev,
                  [linkId]: [...(prev[linkId] || []), data.message]
                }));
                // Auto-scroll after new message
                setTimeout(() => scrollChatToBottom(linkId), 100);
              }
              break;
            case 'message_history':
              if (data.messages) {
                setChatHistory(prev => ({
                  ...prev,
                  [linkId]: data.messages
                }));
                // Auto-scroll after loading history
                setTimeout(() => scrollChatToBottom(linkId), 100);
              }
              break;
            case 'participants_list':
              if (data.participants) {
                setChatParticipants(prev => ({
                  ...prev,
                  [linkId]: data.participants
                }));
              }
              break;
            case 'error':
              toast({
                title: "Chat Error",
                description: data.error || 'Unknown chat error',
                variant: "destructive",
              });
              break;
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log(`Chat WebSocket disconnected for session ${linkId}`);
        setChatConnections(prev => {
          const newConnections = { ...prev };
          delete newConnections[linkId];
          return newConnections;
        });
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error for session ${linkId}:`, error);
      };

      setChatConnections(prev => ({ ...prev, [linkId]: ws }));
    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
    }
  };

  const disconnectFromChatWebSocket = (linkId: string) => {
    const ws = chatConnections[linkId];
    if (ws) {
      ws.close();
      setChatConnections(prev => {
        const newConnections = { ...prev };
        delete newConnections[linkId];
        return newConnections;
      });
    }
  };

  const toggleChatForLink = async (linkId: string) => {
    console.log(`toggleChatForLink called for ${linkId}, current showChatForLink: ${showChatForLink}`);
    
    if (showChatForLink === linkId) {
      console.log(`Closing chat for ${linkId}`);
      setShowChatForLink(null);
      disconnectFromChatWebSocket(linkId);
      
      // Check if this link was being previewed before chat opened
      const wasPreviewingBeforeChat = previewingLinks.has(linkId);
      console.log(`Was previewing before chat: ${wasPreviewingBeforeChat}`);
      
      if (wasPreviewingBeforeChat) {
        console.log(`Need to restart preview for ${linkId}`);
        // Set a flag to restart on next render cycle
        setRestartNeeded(linkId);
      }
    } else {
      // Check if we're switching from another chat
      if (showChatForLink && showChatForLink !== linkId) {
        const previousChatLinkId = showChatForLink;
        console.log(`Switching from chat ${previousChatLinkId} to chat ${linkId}`);
        
        // Disconnect from previous chat
        disconnectFromChatWebSocket(previousChatLinkId);
        
        // Check if the previous link was being previewed and needs restart
        const wasPreviouslyPreviewing = previewingLinks.has(previousChatLinkId);
        if (wasPreviouslyPreviewing) {
          console.log(`Previous chat link ${previousChatLinkId} needs preview restart`);
          setRestartNeeded(previousChatLinkId);
        }
      }
      
      console.log(`Opening chat for ${linkId}`);
      setShowChatForLink(linkId);
      // Load chat history and participants when opening chat
      await loadChatData(linkId);
      // Connect to WebSocket for real-time updates
      connectToChatWebSocket(linkId);
    }
  };

  const loadChatData = async (sessionId: string) => {
    try {
      // Load chat messages
      const messagesResponse = await fetch(`/api/chat/messages/${sessionId}`);
      if (messagesResponse.ok) {
        const messages = await messagesResponse.json();
        setChatHistory(prev => ({ ...prev, [sessionId]: messages }));
      }

      // Load participants
      const participantsResponse = await fetch(`/api/chat/participants/${sessionId}`);
      if (participantsResponse.ok) {
        const participants = await participantsResponse.json();
        setChatParticipants(prev => ({ ...prev, [sessionId]: participants }));
      }
    } catch (error) {
      console.error('Failed to load chat data:', error);
    }
  };

  const removeExpiredLinks = () => {
    deleteExpiredMutation.mutate(undefined, {
      onSuccess: (data: any) => {
        if (data.deletedCount === 0) {
          toast({
            title: "No Expired Links",
            description: "All links are still valid",
          });
        } else {
          toast({
            title: "Expired Links Removed",
            description: `${data.deletedCount} expired link${data.deletedCount !== 1 ? 's' : ''} removed`,
          });
        }
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to remove expired links",
          variant: "destructive",
        });
      },
    });
  };

  const openInviteDialog = (link: GeneratedLink) => {
    const linkType = link.type === 'guest' ? 'streaming' : 'viewer';
    setInviteDialog({
      open: true,
      type: linkType,
      linkId: link.id,
      linkDetails: {
        streamName: link.streamName,
        returnFeed: link.returnFeed,
        chatEnabled: link.chatEnabled,
        expiresAt: link.expiresAt ? new Date(link.expiresAt) : null
      }
    });
  };

  return (
    <div className={`min-h-screen ${isMobile ? 'py-4 px-3' : 'py-6 px-6'}`}>
      <div className="w-full max-w-none">
        <div className={`${isMobile ? 'mb-6' : 'flex items-center justify-between mb-8'}`}>
          <div className={`${isMobile ? 'text-center mb-4' : ''}`}>
            <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold va-text-primary mb-2`}>Generated Links</h1>
            <p className="va-text-secondary">View and preview all your generated streaming links</p>
          </div>
          <div className={`${isMobile ? 'flex flex-col space-y-2' : 'flex gap-2'}`}>
            <Button 
              onClick={() => setShowBroadcastModal(true)}
              variant="outline"
              className={`border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white ${isMobile ? 'btn-touch text-sm' : ''}`}
              data-testid="button-broadcast-message"
            >
              <i className="fas fa-broadcast-tower mr-2"></i>
              {isMobile ? 'Broadcast' : 'Broadcast Message'}
            </Button>
            {links.length > 0 && (
              <>
                <Button 
                  onClick={removeExpiredLinks}
                  variant="outline"
                  className={`border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white ${isMobile ? 'btn-touch text-sm' : ''}`}
                  data-testid="button-remove-expired"
                >
                  <i className="fas fa-clock mr-2"></i>
                  {isMobile ? 'Remove Expired' : 'Remove Expired'}
                </Button>
                <Button 
                  onClick={clearAllLinks}
                  variant="outline"
                  className={`border-red-500 text-red-500 hover:bg-red-500 hover:text-white ${isMobile ? 'btn-touch text-sm' : ''}`}
                  data-testid="button-clear-all"
                >
                  <i className="fas fa-trash mr-2"></i>
                  {isMobile ? 'Clear All' : 'Clear All'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Links Grid - 4 cards per row */}
        {links.length === 0 ? (
          <div className="va-bg-dark-surface rounded-2xl p-12 border va-border-dark text-center">
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
        ) : (
          <div className={`grid gap-6 ${
            isMobile 
              ? 'grid-cols-1' 
              : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
          }`}>
            {links.map((link: GeneratedLink) => (
              <div key={link.id} className="va-bg-dark-surface rounded-lg border va-border-dark hover:border-va-primary/50 transition-all duration-200 hover:shadow-lg overflow-hidden">
                {/* Chat Interface or Preview Window */}
                {showChatForLink === link.id && link.chatEnabled ? (
                  // Chat Interface - Full transformation
                  <div className="va-bg-dark-surface-2 p-4 flex flex-col min-h-[500px]">
                    {/* Chat Header */}
                    <div className="flex items-center justify-between mb-4 pb-2 border-b va-border-dark">
                      <div className="flex items-center">
                        <i className="fas fa-comments text-blue-400 mr-2"></i>
                        <h3 className="font-semibold va-text-primary">Chat: {link.streamName || link.returnFeed}</h3>
                      </div>
                      <Button 
                        onClick={() => toggleChatForLink(link.id)}
                        variant="outline"
                        size="sm"
                        className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                      >
                        <i className="fas fa-times"></i>
                      </Button>
                    </div>

                    {/* Participants List */}
                    {chatParticipants[link.id] && chatParticipants[link.id].length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium va-text-secondary mb-2">
                          Participants ({chatParticipants[link.id].length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {chatParticipants[link.id].map((participant: any) => (
                            <span 
                              key={`participant-${participant.id || `${participant.userId}-${participant.sessionId}`}`}
                              className={`px-2 py-1 rounded-full text-xs ${
                                participant.isOnline 
                                  ? 'bg-green-500/20 text-green-400' 
                                  : 'bg-gray-500/20 text-gray-400'
                              }`}
                            >
                              <i className={`fas fa-circle mr-1 ${participant.isOnline ? 'text-green-400' : 'text-gray-400'}`} style={{fontSize: '6px'}}></i>
                              {participant.username} ({participant.role})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Messages History */}
                    <div 
                      ref={(el) => {
                        if (el) chatScrollRefs.current.set(link.id, el);
                        else chatScrollRefs.current.delete(link.id);
                      }}
                      className="flex-1 va-bg-dark-surface rounded-lg p-3 mb-4 overflow-y-auto max-h-64"
                    >
                      {chatHistory[link.id] && chatHistory[link.id].length > 0 ? (
                        <div className="space-y-3">
                          {chatHistory[link.id].map((message: any, index: number) => {
                            const isMyMessage = message.senderId === user?.id;
                            return (
                              <div 
                                key={`message-${message.id || `temp-${index}`}`} 
                                className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                              >
                                <div className={`max-w-[80%] ${isMyMessage ? 'ml-4' : 'mr-4'}`}>
                                  <div className={`p-3 rounded-lg ${
                                    message.messageType === 'broadcast' 
                                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' 
                                      : isMyMessage 
                                        ? 'va-bg-primary/20 va-text-primary'
                                        : 'va-bg-dark-surface-2 va-text-primary'
                                  }`}>
                                    <div className="flex items-start justify-between mb-1">
                                      <div className="flex items-center space-x-2">
                                        <span className="font-medium text-sm">
                                          {message.senderName}
                                        </span>
                                        {message.messageType === 'broadcast' && (
                                          <i className="fas fa-broadcast-tower text-yellow-400"></i>
                                        )}
                                      </div>
                                      <span className="text-xs va-text-secondary ml-2">
                                        {new Date(message.createdAt).toLocaleTimeString()}
                                      </span>
                                    </div>
                                    <p className="text-sm leading-relaxed">{message.content}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center va-text-secondary py-8">
                          <i className="fas fa-comment-slash text-2xl mb-2"></i>
                          <p>No messages yet</p>
                        </div>
                      )}
                    </div>

                    {/* Message Input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm va-text-secondary">Send Message</span>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={chatMessages[link.id] || ''}
                          onChange={(e) => setChatMessages(prev => ({ ...prev, [link.id]: e.target.value }))}
                          placeholder={`Message ${link.streamName || link.returnFeed}...`}
                          className="flex-1 text-sm va-bg-dark-surface va-border-dark va-text-primary"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              sendChatMessage(link.id, chatMessages[link.id] || '');
                            }
                          }}
                        />
                        <Button
                          onClick={() => sendChatMessage(link.id, chatMessages[link.id] || '')}
                          size="sm"
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4"
                          disabled={!chatMessages[link.id]?.trim()}
                        >
                          <i className="fas fa-paper-plane"></i>
                        </Button>
                      </div>

                    </div>
                  </div>
                ) : (
                  // Preview Window (original functionality)
                  <div className="relative bg-black aspect-video">
                    {previewingLinks.has(link.id) ? (
                        <video 
                          key={`video-${link.id}`}
                          ref={(el) => {
                            if (el) {
                              console.log(`Simple video element set for link: ${link.id}`);
                              previewVideoRefs.current.set(link.id, el);
                            }
                          }}
                          autoPlay 
                          muted 
                          playsInline 
                          className="w-full h-full object-cover bg-black"
                          data-testid={`video-preview-${link.id}`}
                          style={{ display: 'block' }}
                        />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center va-bg-dark-surface-2">
                        <div className="text-center">
                          <i className="fas fa-eye text-3xl text-gray-500 mb-2"></i>
                          <p className="va-text-secondary text-sm">Preview Window</p>
                          {((link.type === 'guest' && link.streamName) || (link.type === 'viewer' && link.returnFeed)) && (
                            <Button 
                              onClick={() => {
                                const streamName = link.type === 'guest' ? link.streamName! : link.returnFeed!;
                                previewStream(streamName, link.id);
                              }}
                              variant="outline"
                              size="sm"
                              className="mt-2 border-va-primary va-text-green hover:va-bg-primary hover:text-va-dark-bg"
                              data-testid={`button-preview-${link.id}`}
                            >
                              <i className="fas fa-play mr-1"></i>
                              Preview
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    {previewingLinks.has(link.id) && (
                      <Button 
                        onClick={() => stopPreview(link.id)}
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                        data-testid={`button-stop-preview-${link.id}`}
                      >
                        <i className="fas fa-stop"></i>
                      </Button>
                    )}
                  </div>
                )}

                {/* Card Content */}
                <div className="p-3">
                  {/* Header */}
                  <div className="mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-semibold va-text-primary truncate" data-testid={`text-stream-${link.id}`}>
                        {link.type === 'guest' ? link.streamName : link.returnFeed || 'Viewer Link'}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      <Badge variant="outline" className={
                        link.type === 'guest' 
                          ? "va-text-green border-va-primary text-xs px-2 py-0.5" 
                          : "bg-purple-500/20 text-purple-400 border-purple-500/50 text-xs px-2 py-0.5"
                      }>
                        {link.type === 'guest' ? 'Guest' : 'Viewer'}
                      </Badge>
                      {link.type === 'guest' && link.returnFeed && (
                        <Badge variant="outline" className="va-text-green border-va-primary text-xs px-2 py-0.5">
                          {link.returnFeed}
                        </Badge>
                      )}
                      {link.chatEnabled && (
                        <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/50 text-xs px-2 py-0.5">
                          Chat
                        </Badge>
                      )}
                      {link.expiresAt && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs px-2 py-0.5 ${
                            isLinkExpired(link) 
                              ? 'bg-red-500/20 text-red-400 border-red-500/50' 
                              : 'bg-orange-500/20 text-orange-400 border-orange-500/50'
                          }`}
                        >
                          <i className="fas fa-clock mr-1"></i>
                          {getTimeUntilExpiry(link)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Link Display */}
                  {link.shortLink && (
                    <div className="va-bg-dark-surface-2 rounded p-2 mb-2">
                      <div className="flex items-center gap-1 mb-1">
                        <i className="fas fa-star text-va-primary text-xs"></i>
                        <span className="text-xs va-text-primary font-medium">Share Link</span>
                      </div>
                      <code className="text-xs va-text-green font-mono break-all" data-testid={`text-short-url-${link.id}`}>
                        {`${window.location.origin}${link.shortLink}`}
                      </code>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="text-xs va-text-secondary mb-2 space-y-1">
                    <div>Created: {new Date(link.createdAt).toLocaleString()}</div>
                    {link.expiresAt && (
                      <div>Expires: {new Date(link.expiresAt).toLocaleString()}</div>
                    )}
                  </div>

                  {/* Action Buttons - Single Row */}
                  <div className="flex gap-1 text-xs">
                    <Button 
                      onClick={() => copyToClipboard(
                        link.shortLink 
                          ? `${window.location.origin}${link.shortLink}` 
                          : link.url
                      )}
                      variant="outline"
                      size="sm"
                      className="px-2 py-1 h-7 border-va-primary va-text-green hover:va-bg-primary hover:text-va-dark-bg text-xs"
                      data-testid={`button-copy-${link.id}`}
                    >
                      <i className="fas fa-copy"></i>
                    </Button>
                    <Button 
                      onClick={() => {
                        if (link.type === 'guest') {
                          window.open(`/viewer?stream=${encodeURIComponent(link.streamName || '')}`, '_blank');
                        } else {
                          window.open(link.url, '_blank');
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="px-2 py-1 h-7 border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white text-xs"
                      data-testid={`button-open-${link.id}`}
                    >
                      <i className="fas fa-external-link-alt"></i>
                    </Button>
                    {link.type === 'guest' && link.streamName && (
                      <Button 
                        onClick={() => copyIngestLink(link.streamName!)}
                        variant="outline"
                        size="sm"
                        className="px-2 py-1 h-7 border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white text-xs"
                        data-testid={`button-copy-ingest-${link.id}`}
                      >
                        <i className="fas fa-broadcast-tower"></i>
                      </Button>
                    )}
                    {/* Email Invite Button */}
                    <Button 
                      onClick={() => openInviteDialog(link)}
                      variant="outline"
                      size="sm"
                      className="px-2 py-1 h-7 border-green-500 text-green-400 hover:bg-green-500 hover:text-white text-xs"
                      data-testid={`button-invite-${link.id}`}
                    >
                      <i className="fas fa-envelope"></i>
                    </Button>
                    {/* Chat Button - Only show for chat-enabled links and if user is admin/engineer */}
                    {link.chatEnabled && user && (user.role === 'admin' || user.role === 'engineer') && (
                      <Button 
                        onClick={() => toggleChatForLink(link.id)}
                        variant="outline"
                        size="sm"
                        className={`px-2 py-1 h-7 border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white text-xs ${
                          showChatForLink === link.id ? 'bg-blue-500 text-white' : ''
                        }`}
                        data-testid={`button-chat-${link.id}`}
                      >
                        <i className="fas fa-comments"></i>
                      </Button>
                    )}
                    <Button 
                      onClick={() => deleteLink(link.id, link.type)}
                      variant="outline"
                      size="sm"
                      className="px-2 py-1 h-7 border-red-500 text-red-500 hover:bg-red-500 hover:text-white text-xs"
                      data-testid={`button-delete-${link.id}`}
                    >
                      <i className="fas fa-trash"></i>
                    </Button>
                  </div>
                </div>
                </div>
            ))}
          </div>
        )}
      </div>

      {/* Broadcast Message Modal */}
      <Dialog open={showBroadcastModal} onOpenChange={setShowBroadcastModal}>
        <DialogContent className="va-bg-dark-surface va-border-dark">
          <DialogHeader>
            <DialogTitle className="va-text-primary flex items-center">
              <i className="fas fa-broadcast-tower mr-2 text-blue-400"></i>
              Send Broadcast Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm va-text-secondary">
              This message will be sent to all users in all active sessions.
            </div>
            <Textarea
              placeholder="Enter your broadcast message..."
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              className="va-bg-dark-surface-2 va-border-dark va-text-primary"
              rows={4}
              data-testid="textarea-broadcast-message"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setBroadcastMessage('');
                  setShowBroadcastModal(false);
                }}
                data-testid="button-cancel-broadcast"
              >
                Cancel
              </Button>
              <Button
                onClick={sendBroadcastMessage}
                disabled={!broadcastMessage.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white"
                data-testid="button-send-broadcast"
              >
                <i className="fas fa-broadcast-tower mr-2"></i>
                Send Broadcast
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
    </div>
  );
}