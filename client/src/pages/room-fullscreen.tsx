import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [connectionState, setConnectionState] = useState<string>('new');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeStream = async () => {
      try {
        if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
        }

        setError(null);
        setConnectionState('connecting');

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
    <Card className="relative h-full">
      <CardHeader className="pb-2 absolute top-0 left-0 right-0 z-10 bg-black/50 text-white">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{getDisplayName()}</CardTitle>
          <div className="flex items-center gap-2">
            {connectionState === 'connected' && <Badge variant="secondary" className="text-xs">Live</Badge>}
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} title={connectionState} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 h-full">
        <div className="relative h-full bg-black rounded-lg overflow-hidden">
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
      </CardContent>
    </Card>
  );
}

export default function RoomFullscreen() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showChat, setShowChat] = useState(false);

  const { data: roomData, isLoading, error } = useQuery<RoomData>({
    queryKey: [`/api/rooms/${id}/join`],
    enabled: !!id,
  });

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
    // Full-screen optimized grid layouts
    if (streamCount === 1) return "grid-cols-1";
    if (streamCount === 2) return "grid-cols-2";
    if (streamCount <= 4) return "grid-cols-2";
    if (streamCount <= 6) return "grid-cols-3";
    if (streamCount <= 9) return "grid-cols-3";
    return "grid-cols-4";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      {/* Overlay controls */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">{room.name}</h1>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Users className="w-4 h-4" />
            <span>{participants.length}/{room.maxParticipants}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {room.chatEnabled && (
            <Button
              variant={showChat ? "default" : "outline"}
              size="sm"
              onClick={() => setShowChat(!showChat)}
              className="bg-black/50 text-white border-gray-600 hover:bg-black/70"
              data-testid="toggle-chat-fullscreen-button"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Chat
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.close()}
            className="bg-black/50 text-white border-gray-600 hover:bg-black/70"
            data-testid="close-fullscreen-button"
          >
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="p-4 pt-16 h-full">
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
            <div className={`grid gap-2 h-full ${getGridClass()}`} data-testid="video-grid-fullscreen">
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

      {/* Chat overlay */}
      {showChat && room.chatEnabled && (
        <div className="absolute right-4 top-16 w-80 h-[calc(100vh-5rem)] z-20">
          <Card className="h-full bg-black/90 border-gray-600">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-white">Room Chat</CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-full">
              <Chat sessionId={room.id} enabled={true} className="h-full" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}