import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Edit, Save, Users, Video, MessageCircle, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const editRoomSchema = z.object({
  name: z.string().min(1, "Room name is required"),
  description: z.string().optional(),
  maxParticipants: z.number().min(1).max(50),
  chatEnabled: z.boolean(),
  isActive: z.boolean(),
});

type EditRoomData = z.infer<typeof editRoomSchema>;

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

function EditRoomDialog({ 
  room, 
  open, 
  onOpenChange 
}: { 
  room: Room;
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditRoomData>({
    resolver: zodResolver(editRoomSchema),
    defaultValues: {
      name: room.name,
      description: room.description || '',
      maxParticipants: room.maxParticipants,
      chatEnabled: room.chatEnabled,
      isActive: room.isActive,
    },
  });

  const editRoomMutation = useMutation({
    mutationFn: (data: EditRoomData) => apiRequest('PUT', `/api/rooms/${room.id}`, data),
    onSuccess: () => {
      toast({ title: "Room updated successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/rooms/${room.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to update room",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Room</DialogTitle>
          <DialogDescription>
            Update room settings and configuration.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => editRoomMutation.mutate(data))}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Room Name</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Enter room name"
                data-testid="edit-room-name-input"
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
                data-testid="edit-room-description-input"
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
                data-testid="edit-max-participants-input"
              />
              {errors.maxParticipants && (
                <p className="text-sm text-red-600 mt-1">{errors.maxParticipants.message}</p>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="chatEnabled"
                {...register("chatEnabled")}
                data-testid="edit-chat-enabled-switch"
              />
              <Label htmlFor="chatEnabled">Enable Chat</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                {...register("isActive")}
                data-testid="edit-room-active-switch"
              />
              <Label htmlFor="isActive">Room Active</Label>
            </div>
          </div>
          
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="cancel-edit-room"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={editRoomMutation.isPending}
              data-testid="save-room-changes"
            >
              {editRoomMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StreamAssignmentCard({ assignment }: { assignment: StreamAssignment }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const removeAssignmentMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', `/api/rooms/${assignment.roomId}/streams/${assignment.id}`),
    onSuccess: () => {
      toast({ title: "Stream assignment removed" });
      queryClient.invalidateQueries({ queryKey: [`/api/rooms/${assignment.roomId}/streams`] });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove assignment",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{assignment.streamName}</div>
            <div className="text-sm text-muted-foreground">
              {assignment.assignedGuestName || `User ${assignment.assignedUserId}`}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeAssignmentMutation.mutate()}
            disabled={removeAssignmentMutation.isPending}
            data-testid={`remove-assignment-${assignment.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RoomManage() {
  const { id: roomId } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Check permissions
  const canManage = user?.role === 'admin' || user?.role === 'engineer';

  const { data: room, isLoading, error } = useQuery<Room>({
    queryKey: [`/api/rooms/${roomId}`],
    enabled: !!roomId && canManage,
  });

  const { data: assignments } = useQuery<StreamAssignment[]>({
    queryKey: [`/api/rooms/${roomId}/streams`],
    enabled: !!roomId && canManage,
    refetchInterval: 3000,
  });

  const { data: participants } = useQuery({
    queryKey: [`/api/rooms/${roomId}/participants`],
    enabled: !!roomId && canManage,
    refetchInterval: 3000,
  });

  if (!canManage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Access Denied</CardTitle>
            <CardDescription>
              You are not allowed to edit this page in the room.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/rooms')} data-testid="back-to-rooms">
              Back to Rooms
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  if (error || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Room Not Found</CardTitle>
            <CardDescription>
              The requested room could not be found.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/rooms')} data-testid="back-to-rooms">
              Back to Rooms
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const participantCount = Array.isArray(participants) ? participants.length : 0;
  const assignmentCount = Array.isArray(assignments) ? assignments.length : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => setLocation('/rooms')}
            data-testid="back-to-rooms"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Rooms
          </Button>
          <div>
            <h1 className="text-3xl font-bold" data-testid="manage-room-title">
              Manage Room: {room.name}
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure room settings and manage participants
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowEditDialog(true)}
          data-testid="edit-room-button"
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit Room
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Room Information */}
        <Card>
          <CardHeader>
            <CardTitle>Room Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-lg font-semibold">{assignmentCount}</div>
                <div className="text-xs text-muted-foreground">/{room.maxParticipants} slots</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Video className="w-4 h-4 text-green-600" />
                </div>
                <div className="text-lg font-semibold">{participantCount}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <MessageCircle className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-lg font-semibold">{room.chatEnabled ? "On" : "Off"}</div>
                <div className="text-xs text-muted-foreground">Chat</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Status:</span>
                {room.isActive ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
              {room.description && (
                <div>
                  <span className="text-sm font-medium">Description:</span>
                  <p className="text-sm text-muted-foreground mt-1">{room.description}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => setLocation(`/room/${room.id}`)}
              data-testid="view-room"
            >
              <Video className="w-4 h-4 mr-2" />
              View Room
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => setLocation(`/room/${room.id}/fullscreen`)}
              data-testid="fullscreen-view"
            >
              <Video className="w-4 h-4 mr-2" />
              Fullscreen View
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => setShowEditDialog(true)}
              data-testid="edit-settings"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Settings
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Stream Assignments */}
      {assignments && assignments.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Stream Assignments</CardTitle>
            <CardDescription>
              Manage individual stream assignments in this room
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {assignments.map((assignment) => (
                <StreamAssignmentCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Room Dialog */}
      {showEditDialog && (
        <EditRoomDialog
          room={room}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}
    </div>
  );
}