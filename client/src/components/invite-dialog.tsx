import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, Send, Loader2 } from "lucide-react";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inviteType: 'streaming' | 'viewer' | 'short-link';
  linkId?: string;
  shortCode?: string;
  linkDetails: {
    streamName?: string;
    returnFeed?: string;
    chatEnabled?: boolean;
    expiresAt?: Date | null;
  };
}

export function InviteDialog({ 
  open, 
  onOpenChange, 
  inviteType, 
  linkId, 
  shortCode, 
  linkDetails 
}: InviteDialogProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; message?: string }) => {
      let endpoint: string;
      let payload: any;

      switch (inviteType) {
        case 'streaming':
          endpoint = '/api/invites/streaming';
          payload = { email: data.email, linkId, message: data.message };
          break;
        case 'viewer':
          endpoint = '/api/invites/viewer';
          payload = { email: data.email, linkId, message: data.message };
          break;
        case 'short-link':
          endpoint = '/api/invites/short-link';
          payload = { email: data.email, shortCode, message: data.message };
          break;
        default:
          throw new Error('Invalid invite type');
      }

      const res = await apiRequest('POST', endpoint, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Invite sent successfully",
        description: `Email invitation has been sent to ${email}`,
      });
      setEmail("");
      setMessage("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send invite",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    inviteMutation.mutate({
      email: email.trim(),
      message: message.trim() || undefined,
    });
  };

  const getDialogTitle = () => {
    switch (inviteType) {
      case 'streaming':
        return 'Invite to Stream Session';
      case 'viewer':
        return 'Invite to Watch Stream';
      case 'short-link':
        return 'Share Short Link';
      default:
        return 'Send Invitation';
    }
  };

  const getDialogDescription = () => {
    switch (inviteType) {
      case 'streaming':
        return 'Send an email invitation for this streaming session. The recipient will be able to publish video to the stream.';
      case 'viewer':
        return 'Send an email invitation to watch the return feed. The recipient will be able to view the studio output.';
      case 'short-link':
        return 'Share this short link via email. The recipient will be redirected to the streaming session.';
      default:
        return 'Send an email invitation for this link.';
    }
  };

  const formatExpiryText = () => {
    if (!linkDetails.expiresAt) return 'This link does not expire.';
    return `Expires on ${linkDetails.expiresAt.toLocaleDateString()} at ${linkDetails.expiresAt.toLocaleTimeString()}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {getDialogTitle()}
          </DialogTitle>
          <DialogDescription>
            {getDialogDescription()}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Link Details */}
          <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
            {linkDetails.streamName && (
              <div>
                <span className="font-medium">Stream:</span> {linkDetails.streamName}
              </div>
            )}
            {linkDetails.returnFeed && (
              <div>
                <span className="font-medium">Return Feed:</span> {linkDetails.returnFeed}
              </div>
            )}
            <div>
              <span className="font-medium">Chat:</span> {linkDetails.chatEnabled ? 'Enabled' : 'Disabled'}
            </div>
            <div>
              <span className="font-medium">Expiry:</span> {formatExpiryText()}
            </div>
            {shortCode && (
              <div>
                <span className="font-medium">Short Code:</span> {shortCode}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter recipient's email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="input-invite-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Personal Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a personal message to the invitation..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              data-testid="textarea-invite-message"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-invite"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!email.trim() || inviteMutation.isPending}
              data-testid="button-send-invite"
            >
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}