import { useState } from "react";
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
    mutationFn: (data: CreateRoomData) => apiRequest('/api/rooms', 'POST', data),
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
  });

  const { data: assignments } = useQuery({
    queryKey: [`/api/rooms/${room.id}/streams`],
  });

  const deleteRoomMutation = useMutation({
    mutationFn: () => apiRequest(`/api/rooms/${room.id}`, 'DELETE'),
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
  const activeStreams = Array.isArray(participants) ? participants.filter((p: any) => p.isStreaming).length : 0;

  const canManage = user?.role === 'admin' || user?.role === 'engineer';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg" data-testid={`room-title-${room.id}`}>
              {room.name}
            </CardTitle>
            {room.description && (
              <CardDescription className="mt-1">{room.description}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            {room.isActive ? (
              <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteRoomMutation.mutate()}
                disabled={deleteRoomMutation.isPending}
                data-testid={`delete-room-${room.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-lg font-semibold">{participantCount}</div>
              <div className="text-xs text-muted-foreground">/{room.maxParticipants}</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Video className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-lg font-semibold">{activeStreams}</div>
              <div className="text-xs text-muted-foreground">/{streamCount} slots</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <MessageCircle className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-lg font-semibold">{room.chatEnabled ? "On" : "Off"}</div>
              <div className="text-xs text-muted-foreground">Chat</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => setLocation(`/room/${room.id}`)}
              data-testid={`join-room-${room.id}`}
            >
              Join Room
            </Button>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/room/${room.id}/manage`)}
                data-testid={`manage-room-${room.id}`}
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Rooms() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { user } = useAuth();

  const { data: rooms, isLoading, error } = useQuery<Room[]>({
    queryKey: ['/api/rooms'],
  });

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

      {/* Active Rooms */}
      {activeRooms.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Active Rooms</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="active-rooms-grid">
            {activeRooms.map(room => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </div>
      )}

      {/* Inactive Rooms */}
      {inactiveRooms.length > 0 && canCreateRooms && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Inactive Rooms</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="inactive-rooms-grid">
            {inactiveRooms.map(room => (
              <RoomCard key={room.id} room={room} />
            ))}
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