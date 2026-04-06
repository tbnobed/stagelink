import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Video, Users, X } from "lucide-react";
import { Chat } from "@/components/chat";

interface RoomData {
  room: {
    id: string;
    name: string;
    description?: string;
    maxParticipants: number;
    chatEnabled: boolean;
    backgroundImage?: string | null;
  };
  participants: Array<{
    id: number;
    roomId: string;
    userId?: number;
    guestName?: string;
    streamName: string;
    isStreaming: boolean;
    joinedAt: string;
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
  onFailed?: () => void;
}

function VideoPlayer({ streamUrl, streamName, assignedUser, assignedGuest, onFailed }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [connectionState, setConnectionState] = useState<string>('new');
  const [error, setError] = useState<string | null>(null);
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeStream = async () => {
      if (!videoRef.current || !streamUrl) return;

      if (!window.SrsRtcWhipWhepAsync) {
        console.error('SRS SDK not loaded, cannot initialize room WHEP stream');
        if (mounted) {
          setError('Streaming SDK not loaded');
          setConnectionState('failed');
        }
        return;
      }

      try {
        if (playerRef.current) {
          playerRef.current.close();
          playerRef.current = null;
        }

        setError(null);
        setConnectionState('connecting');

        const player = new window.SrsRtcWhipWhepAsync();
        playerRef.current = player;

        player.pc.addEventListener('connectionstatechange', () => {
          if (mounted) {
            setConnectionState(player.pc.connectionState);
          }
        });

        console.log(`Room Fullscreen WHEP: Connecting to stream ${streamName} at ${streamUrl}`);
        await player.play(streamUrl);

        if (mounted && videoRef.current) {
          videoRef.current.srcObject = player.stream;
          try {
            await videoRef.current.play();
          } catch (playErr) {
            videoRef.current.muted = true;
            await videoRef.current.play().catch(() => {});
          }
        }

        console.log(`Room Fullscreen WHEP: Connected to stream ${streamName}`);
      } catch (err) {
        console.error(`Room Fullscreen WHEP: Failed to connect to stream ${streamName}:`, err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to connect to stream');
          setConnectionState('failed');
        }
      }
    };

    initializeStream();

    return () => {
      mounted = false;
      if (playerRef.current) {
        playerRef.current.close();
        playerRef.current = null;
      }
    };
  }, [streamUrl]);

  // If the stream stays failed for 15 seconds, signal the parent to drop this tile
  useEffect(() => {
    if (failTimerRef.current) {
      clearTimeout(failTimerRef.current);
      failTimerRef.current = null;
    }
    if (connectionState === 'failed' || error) {
      failTimerRef.current = setTimeout(() => {
        onFailed?.();
      }, 15_000);
    }
    return () => {
      if (failTimerRef.current) clearTimeout(failTimerRef.current);
    };
  }, [connectionState, error, onFailed]);

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
    <div className="relative h-full w-full overflow-hidden">
      <div className="relative h-full w-full bg-black overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
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
    </div>
  );
}

export default function RoomFullscreen() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showChat, setShowChat] = useState(false);
  const queryClient = useQueryClient();
  const [locallyFailedStreams, setLocallyFailedStreams] = useState<Set<string>>(new Set());

  const { data: roomData, isLoading, error } = useQuery<RoomData>({
    queryKey: [`/api/rooms/${id}/public`],
    enabled: !!id,
    refetchInterval: 2000, // Refetch every 2 seconds for more real-time updates
    staleTime: 0, // Always consider data stale
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnReconnect: true, // Refetch when connection is restored
  });

  // Add visibility change listener to immediately refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && id) {
        queryClient.invalidateQueries({ queryKey: [`/api/rooms/${id}/public`] });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [id, queryClient]);

  // If the server poll returns a stream we marked locally as failed, trust the server and clear it
  useEffect(() => {
    if (!roomData) return;
    setLocallyFailedStreams(prev => {
      if (prev.size === 0) return prev;
      const serverStreamNames = new Set(roomData.whepUrls.map(s => s.streamName));
      const next = new Set([...prev].filter(name => !serverStreamNames.has(name)));
      return next.size === prev.size ? prev : next;
    });
  }, [roomData]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4" />
          <p>Loading room...</p>
        </div>
      </div>
    );
  }

  if (error || !roomData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Room Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.close()} className="w-full">
              Close Window
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { room, participants, whepUrls } = roomData;

  // Filter out streams the client has confirmed dead (15s failure timeout)
  // When the server poll removes a stream it also disappears naturally
  const visibleStreams = whepUrls.filter(s => !locallyFailedStreams.has(s.streamName));

  const markStreamFailed = (streamName: string) => {
    setLocallyFailedStreams(prev => new Set([...prev, streamName]));
  };

  const getGridLayout = () => {
    const n = Math.max(visibleStreams.length, 1);
    if (n === 1) return { cols: 1, rows: 1 };
    if (n === 2) return { cols: 2, rows: 1 };
    if (n === 3) return { cols: 3, rows: 1 };
    if (n === 4) return { cols: 2, rows: 2 };
    if (n <= 6) return { cols: 3, rows: 2 };
    if (n <= 9) return { cols: 3, rows: 3 };
    if (n <= 12) return { cols: 4, rows: 3 };
    if (n <= 16) return { cols: 4, rows: 4 };
    if (n <= 20) return { cols: 5, rows: 4 };
    if (n <= 25) return { cols: 5, rows: 5 };
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    return { cols, rows };
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black text-white"
      style={room.backgroundImage ? {
        backgroundImage: `url(${room.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      } : undefined}
    >
      {/* Main content */}
      <div className="h-full">
        <div className="h-full">
          {visibleStreams.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-white/70">
                <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-medium mb-2">No Streams Configured</h3>
                <p>No stream assignments have been set up for this room yet.</p>
              </div>
            </div>
          ) : (
            <div
              className="h-full w-full"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${getGridLayout().cols}, 1fr)`,
                gridTemplateRows: `repeat(${getGridLayout().rows}, 1fr)`,
              }}
              data-testid="video-grid-fullscreen"
            >
              {visibleStreams
                .sort((a, b) => a.position - b.position)
                .map((stream) => (
                  <VideoPlayer
                    key={stream.streamName}
                    streamUrl={stream.url}
                    streamName={stream.streamName}
                    position={stream.position}
                    assignedUser={stream.assignedUser}
                    assignedGuest={stream.assignedGuest}
                    onFailed={() => markStreamFailed(stream.streamName)}
                  />
                ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}