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
}

function VideoPlayer({ streamUrl, streamName, assignedUser, assignedGuest }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [connectionState, setConnectionState] = useState<string>('new');
  const [error, setError] = useState<string | null>(null);

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
    <div className="relative h-full w-full">
      <div className="relative h-full w-full bg-black rounded-lg overflow-hidden">
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
    </div>
  );
}

export default function RoomFullscreen() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showChat, setShowChat] = useState(false);
  const queryClient = useQueryClient();

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


  const getGridClass = () => {
    const streamCount = Math.max(whepUrls.length, 1);
    // Full-screen optimized grid layouts with proper rows
    if (streamCount === 1) return "grid-cols-1 grid-rows-1";
    if (streamCount === 2) return "grid-cols-2 grid-rows-1";
    if (streamCount === 3) return "grid-cols-3 grid-rows-1";
    if (streamCount === 4) return "grid-cols-2 grid-rows-2";
    if (streamCount <= 6) return "grid-cols-3 grid-rows-2";
    if (streamCount <= 9) return "grid-cols-3 grid-rows-3";
    return "grid-cols-4 grid-rows-3";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      {/* Main content */}
      <div className="h-full">
        <div className="h-full">
          {whepUrls.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-white/70">
                <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-medium mb-2">No Streams Configured</h3>
                <p>No stream assignments have been set up for this room yet.</p>
              </div>
            </div>
          ) : (
            <div className={`grid gap-1 h-full w-full ${getGridClass()}`} data-testid="video-grid-fullscreen">
              {whepUrls
                .sort((a, b) => a.position - b.position)
                .map((stream) => (
                  <VideoPlayer
                    key={stream.streamName}
                    streamUrl={stream.url}
                    streamName={stream.streamName}
                    position={stream.position}
                    assignedUser={stream.assignedUser}
                    assignedGuest={stream.assignedGuest}
                  />
                ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}