import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Users, Video, MessageCircle, Plus, Settings, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const createRoomSchema = z.object({
  name: z.string().min(1, "Room name is required"),
  description: z.string().optional(),
  maxParticipants: z.number().min(1).max(50).default(10),
  chatEnabled: z.boolean().default(true),
});

type CreateRoomData = z.infer<typeof createRoomSchema>;

interface Room {
  id: string;
  name: string;
  description?: string;
  maxParticipants: number;
  chatEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  createdBy?: number;
}

interface StreamAssignment {
  id: number;
  roomId: string;
  streamName: string;
  assignedUserId?: number;
  assignedGuestName?: string;
  position: number;
  url?: string;
  whepUrl?: string;
}

// A single stream tile inside the room preview card
function StreamTile({ url, guestName }: { url: string; guestName?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(window as any).SrsRtcWhipWhepAsync) return;
      try {
        const player = new (window as any).SrsRtcWhipWhepAsync();
        playerRef.current = player;
        player.pc?.addEventListener('connectionstatechange', () => {
          if (!cancelled) setConnected(player.pc?.connectionState === 'connected');
        });
        await player.play(url);
        if (!cancelled && videoRef.current) {
          videoRef.current.srcObject = player.stream;
          await videoRef.current.play().catch(() => {});
          setConnected(true);
        }
      } catch { /* stream may not be live yet */ }
    })();
    return () => {
      cancelled = true;
      if (playerRef.current) { try { playerRef.current.close(); } catch {} playerRef.current = null; }
      if (videoRef.current) {
        if (videoRef.current.srcObject instanceof MediaStream) {
          (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        }
        videoRef.current.srcObject = null;
      }
    };
  }, [url]);

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`w-full h-full object-cover transition-opacity duration-500 ${connected ? 'opacity-100' : 'opacity-0'}`}
      />
      {!connected && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {/* Name overlay — mirrors the full room page header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-1.5 py-1 bg-gradient-to-b from-black/70 to-transparent">
        <span className="text-white text-[10px] font-medium truncate leading-tight">
          {guestName || '—'}
        </span>
        {connected && (
          <Badge className="bg-green-500/90 text-white text-[9px] px-1 py-0 border-0 leading-tight shrink-0 ml-1">Live</Badge>
        )}
      </div>
    </div>
  );
}

function getPreviewGridClass(count: number): string {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-3';
  if (count === 4) return 'grid-cols-2';
  if (count <= 6) return 'grid-cols-3';
  if (count <= 8) return 'grid-cols-4';
  return 'grid-cols-5';
}

function RoomPreviewCard({ room }: { room: Room }) {
  const { data: roomData } = useQuery<{ whepUrls: StreamAssignment[] }>({
    queryKey: [`/api/rooms/${room.id}/public`],
    refetchInterval: 10000,
  });

  const streams = (roomData?.whepUrls ?? []).sort((a, b) => a.position - b.position);

  return (
    <div
      className="va-bg-dark-surface rounded-xl border va-border-dark hover:border-va-primary/60 transition-all duration-200 cursor-pointer group overflow-hidden"
      onClick={() => window.open(`/room/${room.id}`, '_blank')}
    >
      <div className="relative bg-black aspect-video overflow-hidden">
        {streams.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <i className="fas fa-users text-3xl text-gray-500 mb-1"></i>
              <p className="text-xs text-gray-500">No streams</p>
            </div>
          </div>
        ) : (
          <div className={`w-full h-full grid gap-px ${getPreviewGridClass(streams.length)}`}>
            {streams.map((s, i) => (
              <div key={s.streamName ?? i} className="relative overflow-hidden min-h-0">
                <StreamTile url={s.url!} guestName={s.assignedGuestName} />
              </div>
            ))}
          </div>
        )}
        <div className="absolute bottom-2 left-2">
          {room.isActive ? (
            <Badge className="bg-green-500/90 text-white text-[10px] px-1.5 py-0.5 border-0">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-white mr-1 animate-pulse"></span>
              LIVE
            </Badge>
          ) : (
            <Badge className="bg-gray-700/90 text-gray-300 text-[10px] px-1.5 py-0.5 border-0">OFFLINE</Badge>
          )}
        </div>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-black/60 rounded-md px-2 py-1 text-xs text-white flex items-center gap-1">
            <i className="fas fa-external-link-alt text-[10px]"></i>
            Open
          </div>
        </div>
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold va-text-primary text-sm truncate group-hover:va-text-green transition-colors">
            {room.name}
          </h3>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <i className="fas fa-video text-[10px]"></i>
              {streams.length}/{room.maxParticipants}
            </span>
            {room.chatEnabled && (
              <i className="fas fa-comments text-blue-400 text-[10px]" title="Chat enabled"></i>
            )}
          </div>
        </div>
        {room.description && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{room.description}</p>
        )}
      </div>
    </div>
  );
}

function CreateRoomDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateRoomData>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      maxParticipants: 10,
      chatEnabled: true,
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: (data: CreateRoomData) => apiRequest('POST', '/api/rooms', data),
    onSuccess: () => {
      toast({ title: "Room created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to create room",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Room</DialogTitle>
          <DialogDescription>
            Create a new room for multiple participants to stream together.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => createRoomMutation.mutate(data))}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Room Name</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Enter room name"
                data-testid="room-name-input"
              />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Room description..."
                data-testid="room-description-input"
              />
            </div>
            
            <div>
              <Label htmlFor="maxParticipants">Max Participants</Label>
              <Input
                id="maxParticipants"
                type="number"
                min="1"
                max="50"
                {...register("maxParticipants", { valueAsNumber: true })}
                data-testid="max-participants-input"
              />
              {errors.maxParticipants && (
                <p className="text-sm text-red-600 mt-1">{errors.maxParticipants.message}</p>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="chatEnabled"
                {...register("chatEnabled")}
                data-testid="chat-enabled-switch"
              />
              <Label htmlFor="chatEnabled">Enable Chat</Label>
            </div>
          </div>
          
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="cancel-create-room"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createRoomMutation.isPending}
              data-testid="create-room-button"
            >
              {createRoomMutation.isPending ? "Creating..." : "Create Room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RoomCard({ room }: { room: Room }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: participants } = useQuery({
    queryKey: [`/api/rooms/${room.id}/participants`],
    refetchInterval: 3000, // Refresh every 3 seconds
    staleTime: 1000,
    refetchOnWindowFocus: true,
  });

  const { data: assignments } = useQuery({
    queryKey: [`/api/rooms/${room.id}/streams`],
    refetchInterval: 3000, // Refresh every 3 seconds  
    staleTime: 1000,
    refetchOnWindowFocus: true,
  });

  const deleteRoomMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', `/api/rooms/${room.id}`),
    onSuccess: () => {
      toast({ title: "Room deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete room",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const participantCount = Array.isArray(participants) ? participants.length : 0;
  const streamCount = Array.isArray(assignments) ? assignments.length : 0;
  const assignedSlots = Array.isArray(assignments) ? assignments.length : 0;
  const activeStreams = Array.isArray(participants) ? participants.filter((p: any) => p.isStreaming).length : 0;

  const canManage = user?.role === 'admin' || user?.role === 'engineer';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-1">
          <div className="min-w-0">
            <CardTitle className="text-sm truncate" data-testid={`room-title-${room.id}`}>
              {room.name}
            </CardTitle>
            {room.description && (
              <CardDescription className="text-[11px] truncate">{room.description}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {room.isActive ? (
              <Badge variant="default" className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0">Active</Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inactive</Badge>
            )}
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => deleteRoomMutation.mutate()}
                disabled={deleteRoomMutation.isPending}
                data-testid={`delete-room-${room.id}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-2.5 pt-0">
        <div className="space-y-2">
          {/* Stats */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 text-blue-600" />
              {assignedSlots}/{room.maxParticipants}
            </span>
            <span className="flex items-center gap-1">
              <Video className="w-3 h-3 text-green-600" />
              {assignedSlots}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3 text-purple-600" />
              {room.chatEnabled ? "On" : "Off"}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => window.open(`/room/${room.id}`, '_blank')}
              data-testid={`join-room-${room.id}`}
            >
              <i className="fas fa-external-link-alt mr-1 text-[10px]"></i>
              Open
            </Button>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => window.open(`/room/${room.id}/manage`, '_blank')}
                data-testid={`manage-room-${room.id}`}
              >
                <Settings className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RoomTableRow({ room }: { room: Room }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: assignments } = useQuery({
    queryKey: [`/api/rooms/${room.id}/streams`],
    refetchInterval: 5000,
    staleTime: 2000,
  });

  const deleteRoomMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', `/api/rooms/${room.id}`),
    onSuccess: () => {
      toast({ title: "Room deleted" });
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete room",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const assignedSlots = Array.isArray(assignments) ? assignments.length : 0;
  const canManage = user?.role === 'admin' || user?.role === 'engineer';

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-3 py-2">
        <div className="font-medium text-sm" data-testid={`room-title-${room.id}`}>{room.name}</div>
        {room.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{room.description}</div>}
      </td>
      <td className="px-3 py-2">
        {room.isActive ? (
          <Badge variant="default" className="bg-green-100 text-green-800 text-[10px] px-1.5">Active</Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px] px-1.5">Inactive</Badge>
        )}
      </td>
      <td className="px-3 py-2 text-center text-xs text-muted-foreground">
        <span className="flex items-center justify-center gap-1">
          <Users className="w-3 h-3" />
          {assignedSlots}/{room.maxParticipants}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        {room.chatEnabled
          ? <MessageCircle className="w-3.5 h-3.5 text-blue-500 mx-auto" />
          : <span className="text-xs text-muted-foreground">—</span>
        }
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => window.open(`/room/${room.id}`, '_blank')}
            data-testid={`join-room-${room.id}`}
          >
            <i className="fas fa-external-link-alt mr-1 text-[10px]"></i>
            Open
          </Button>
          {canManage && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => window.open(`/room/${room.id}/manage`, '_blank')}
                data-testid={`manage-room-${room.id}`}
                title="Manage room"
              >
                <Settings className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                onClick={() => deleteRoomMutation.mutate()}
                disabled={deleteRoomMutation.isPending}
                data-testid={`delete-room-${room.id}`}
                title="Delete room"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function Rooms() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: rooms, isLoading, error } = useQuery<Room[]>({
    queryKey: ['/api/rooms'],
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 2000, // Consider data stale after 2 seconds
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Add visibility change listener for immediate updates when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Invalidate all room-related queries when tab becomes visible
        queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
        rooms?.forEach(room => {
          queryClient.invalidateQueries({ queryKey: [`/api/rooms/${room.id}/participants`] });
          queryClient.invalidateQueries({ queryKey: [`/api/rooms/${room.id}/streams`] });
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [queryClient, rooms]);

  const canCreateRooms = user?.role === 'admin' || user?.role === 'engineer';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p>Loading rooms...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Rooms</CardTitle>
            <CardDescription>
              Failed to load rooms. Please try again later.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const activeRooms = rooms?.filter(room => room.isActive) || [];
  const inactiveRooms = rooms?.filter(room => !room.isActive) || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="rooms-title">Rooms</h1>
          <p className="text-muted-foreground mt-1">
            Join or manage multi-participant streaming rooms
          </p>
        </div>
        {canCreateRooms && (
          <Button
            onClick={() => setShowCreateDialog(true)}
            data-testid="create-room-button"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Room
          </Button>
        )}
      </div>

      {/* Preview Grid — all rooms, hover to preview stream */}
      {rooms && rooms.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-semibold">All Rooms</h2>
            {activeRooms.length > 0 && (
              <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 text-xs">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse"></span>
                {activeRooms.length} active
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
            {rooms.map(room => (
              <RoomPreviewCard key={room.id} room={room} />
            ))}
          </div>
          <p className="text-xs text-gray-500">Live streams play automatically in each card. Click a card to open the full room view.</p>
        </div>
      )}

      {/* Management Section — admin/engineer only */}
      {canCreateRooms && rooms && rooms.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Room Management</h2>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-3 py-2 text-left">Room</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-center">Slots</th>
                  <th className="px-3 py-2 text-center">Chat</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map(room => (
                  <RoomTableRow key={room.id} room={room} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!rooms || rooms.length === 0) && (
        <Card className="text-center py-12">
          <CardContent>
            <Video className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Rooms Available</h3>
            <p className="text-muted-foreground mb-6">
              {canCreateRooms 
                ? "Create your first room to get started with multi-participant streaming."
                : "No rooms have been created yet. Contact an admin to create rooms."
              }
            </p>
            {canCreateRooms && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Room
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <CreateRoomDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
      />
    </div>
  );
}