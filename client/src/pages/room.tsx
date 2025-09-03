import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Video, MessageCircle, Settings, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Chat } from "@/components/chat";

interface RoomData {
  room: {
    id: string;
    name: string;
    description?: string;
    maxParticipants: number;
    chatEnabled: boolean;
    isActive: boolean;
    createdAt: string;
  };
  participants: Array<{
    id: number;
    roomId: string;
    userId?: number;
    guestName?: string;
    streamName?: string;
    isStreaming: boolean;
    joinedAt: string;
  }>;
  assignments: Array<{
    id: number;
    roomId: string;
    streamName: string;
    assignedUserId?: number;
    assignedGuestName?: string;
    position: number;
  }>;
  whepUrls: Array<{
    streamName: string;
    url: string;
    position: number;
    assignedUser?: number;
    assignedGuest?: string;
  }>;
}

interface VideoPlayerProps {
  streamUrl: string;
  streamName: string;
  position: number;
  assignedUser?: number;
  assignedGuest?: string;
  onRemove?: () => void;
  canRemove?: boolean;
}

function VideoPlayer({ streamUrl, streamName, assignedUser, assignedGuest, onRemove, canRemove }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [connectionState, setConnectionState] = useState<string>('new');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeStream = async () => {
      if (!videoRef.current || !streamUrl) return;

      try {
        setError(null);
        setConnectionState('connecting');

        // Create RTCPeerConnection
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pcRef.current = pc;

        // Set up connection state monitoring
        pc.onconnectionstatechange = () => {
          if (mounted) {
            setConnectionState(pc.connectionState);
          }
        };

        // Set up remote stream handling
        pc.ontrack = (event) => {
          if (mounted && videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
          }
        };

        // Add transceiver for receiving video
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        // Create offer and set local description
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Send WHEP request
        const response = await fetch(streamUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        });

        if (!response.ok) {
          throw new Error(`WHEP request failed: ${response.status}`);
        }

        const answerSdp = await response.text();
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: 'answer',
          sdp: answerSdp,
        }));

      } catch (err) {
        console.error('Failed to initialize WHEP stream:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to connect to stream');
          setConnectionState('failed');
        }
      }
    };

    initializeStream();

    return () => {
      mounted = false;
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [streamUrl]);

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getDisplayName = () => {
    if (assignedGuest) return assignedGuest;
    if (assignedUser) return `User ${assignedUser}`;
    return streamName;
  };

  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{getDisplayName()}</CardTitle>
          <div className="flex items-center gap-2">
            {connectionState === 'connected' && <Badge variant="secondary" className="text-xs">Live</Badge>}
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} title={connectionState} />
            {canRemove && onRemove && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={onRemove}
                title={`Remove ${getDisplayName()} from room`}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative aspect-video bg-black rounded-b-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
            data-testid={`video-player-${streamName}`}
          />
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
              <div className="text-white text-center p-4">
                <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}
          {connectionState === 'connecting' && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
              <div className="text-white text-center p-4">
                <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-sm">Connecting...</p>
              </div>
            </div>
          )}
          {connectionState !== 'connected' && connectionState !== 'connecting' && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
              <div className="text-white text-center p-4">
                <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Stream offline</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Room() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showChat, setShowChat] = useState(false);

  const { data: roomData, isLoading, error } = useQuery<RoomData>({
    queryKey: [`/api/rooms/${id}/join`],
    enabled: !!id,
    refetchInterval: 3000, // Refetch every 3 seconds for real-time participant updates
    staleTime: 1000, // Consider data stale after 1 second
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  const { data: user } = useQuery<{ role: string }>({
    queryKey: ["/api/user"],
    retry: false,
  });

  const queryClient = useQueryClient();

  const removeGuestMutation = useMutation({
    mutationFn: async (data: { guestName: string; streamName: string; hasGuestAssignment: boolean }) => {
      try {
        // Get the current assignments
        const response = await apiRequest('GET', `/api/rooms/${id}/streams`);
        const assignments = await response.json();
        
        // Check if assignments is actually an array
        if (!Array.isArray(assignments)) {
          throw new Error(`API returned non-array response: ${JSON.stringify(assignments)}`);
        }
        
        const assignment = assignments.find((a: any) => a.streamName === data.streamName);
        if (assignment) {
          await apiRequest('DELETE', `/api/rooms/${id}/streams/${assignment.id}`);
        } else {
          throw new Error(`No assignment found for stream ${data.streamName}`);
        }
      } catch (error: any) {
        // Re-throw with more context
        console.error('Guest removal error:', error);
        throw new Error(`Failed to remove guest: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rooms/${id}/join`] });
      toast({
        title: "Guest removed",
        description: "The guest has been successfully removed from the room.",
      });
    },
    onError: (error) => {
      console.error('Failed to remove guest:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Check if it's an authentication error
      if (error.message && (error.message.includes('401') || error.message.includes('403'))) {
        toast({
          title: "Authentication required",
          description: "Your session has expired. Redirecting to login...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 1500);
        return;
      }
      
      toast({
        title: "Failed to remove guest",
        description: `Error: ${error.message || 'Unknown error removing guest'}`,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p>Loading room...</p>
        </div>
      </div>
    );
  }

  if (error || !roomData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Room Not Found</CardTitle>
            <CardDescription>
              The room you're looking for doesn't exist or you don't have access to it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/')} className="w-full">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { room, participants, whepUrls } = roomData;
  // Count streams that have assignments (these are potentially active)
  const activeStreams = whepUrls;


  const getGridClass = () => {
    const streamCount = Math.max(whepUrls.length, 1);
    if (streamCount === 1) return "grid-cols-1";
    if (streamCount === 2) return "grid-cols-1 lg:grid-cols-2";
    if (streamCount <= 4) return "grid-cols-1 md:grid-cols-2";
    if (streamCount <= 6) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
    return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" data-testid="room-title">{room.name}</h1>
              {room.description && (
                <p className="text-muted-foreground mt-1">{room.description}</p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{participants.length}/{room.maxParticipants}</span>
              </div>
              {room.chatEnabled && (
                <Button
                  variant={showChat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowChat(!showChat)}
                  data-testid="toggle-chat-button"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Chat
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Open full-screen room in new tab
                  const fullscreenUrl = `${window.location.origin}/room/${id}/fullscreen`;
                  window.open(fullscreenUrl, '_blank', 'noopener,noreferrer');
                }}
                data-testid="toggle-fullscreen-button"
              >
                <i className="fas fa-external-link-alt mr-2"></i>
                Open Fullscreen
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation('/')}
                data-testid="leave-room-button"
              >
                Leave Room
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Main video grid */}
          <div className="flex-1">
            {whepUrls.length === 0 ? (
              <Card className="h-96">
                <CardContent className="h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No Streams Configured</h3>
                    <p>No stream assignments have been set up for this room yet.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className={`grid gap-4 ${getGridClass()}`} data-testid="video-grid">
                {whepUrls
                  .sort((a, b) => a.position - b.position)
                  .map((stream) => {
                    const participant = participants.find(p => p.streamName === stream.streamName);
                    
                    // Determine if this stream belongs to a guest (only check actual assignments/participants)
                    const hasGuestAssignment = Boolean(stream.assignedGuest);
                    const hasGuestParticipant = Boolean(participant?.guestName);
                    const isGuestStream = hasGuestAssignment || hasGuestParticipant;
                    
                    // Allow admins to remove ANY stream assignment (guest or otherwise)
                    const canRemoveGuest = Boolean(user?.role === 'admin' || user?.role === 'engineer');
                    
                    // For removal, prefer assignedGuest, then participant guestName, then stream name as fallback
                    const guestNameForRemoval = stream.assignedGuest || participant?.guestName || stream.streamName;
                    
                    return (
                      <VideoPlayer
                        key={stream.streamName}
                        streamUrl={stream.url}
                        streamName={stream.streamName}
                        position={stream.position}
                        assignedUser={stream.assignedUser}
                        assignedGuest={stream.assignedGuest}
                        canRemove={canRemoveGuest}
                        onRemove={canRemoveGuest && guestNameForRemoval ? () => removeGuestMutation.mutate({
                          guestName: guestNameForRemoval,
                          streamName: stream.streamName,
                          hasGuestAssignment: hasGuestAssignment
                        }) : undefined}
                      />
                    );
                  })}
              </div>
            )}

            {/* Stream status summary */}
            <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Stream Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{activeStreams.length}</div>
                      <div className="text-sm text-muted-foreground">Active Streams</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{whepUrls.length}</div>
                      <div className="text-sm text-muted-foreground">Total Slots</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{participants.length}</div>
                      <div className="text-sm text-muted-foreground">Participants</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Chat sidebar */}
          {showChat && room.chatEnabled && (
            <div className="w-80 flex-shrink-0">
              <Card className="h-[600px]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Room Chat</CardTitle>
                </CardHeader>
                <CardContent className="p-0 h-full">
                  <Chat sessionId={room.id} enabled={true} className="h-full" />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}