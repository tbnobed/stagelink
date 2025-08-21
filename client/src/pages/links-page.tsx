import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InviteDialog } from "@/components/invite-dialog";
import { useToast } from "@/hooks/use-toast";
import { useMobile } from "@/hooks/use-mobile";
import {
  Loader2,
  Link,
  Mail,
  Trash2,
  Eye,
  Copy,
  Calendar,
  MessageSquare,
  Video,
  Monitor,
  ExternalLink,
  Clock
} from "lucide-react";

interface StreamingLink {
  id: string;
  streamName: string;
  returnFeed: string;
  chatEnabled: boolean;
  url: string;
  sessionToken: string | null;
  createdAt: string;
  expiresAt: string | null;
  createdBy: number | null;
  shortLink: string | null;
  shortCode: string | null;
}

interface ViewerLink {
  id: string;
  returnFeed: string;
  chatEnabled: boolean;
  url: string;
  sessionToken: string | null;
  createdAt: string;
  expiresAt: string | null;
  createdBy: number | null;
  shortLink: string | null;
  shortCode: string | null;
}

interface ShortLink {
  id: string;
  streamName: string;
  returnFeed: string;
  chatEnabled: boolean;
  sessionToken: string | null;
  createdAt: string;
  expiresAt: string | null;
  createdBy: number | null;
}

export default function LinksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isMobile } = useMobile();
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

  // Fetch data
  const { data: streamingLinks, isLoading: streamingLoading } = useQuery<StreamingLink[]>({
    queryKey: ["/api/links"],
  });

  const { data: viewerLinks, isLoading: viewerLoading } = useQuery<ViewerLink[]>({
    queryKey: ["/api/viewer-links"],
  });

  const { data: shortLinks, isLoading: shortLoading } = useQuery<ShortLink[]>({
    queryKey: ["/api/short-links"],
  });

  // Delete mutations
  const deleteStreamingMutation = useMutation({
    mutationFn: async (linkId: string) => {
      await apiRequest("DELETE", `/api/links/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/links"] });
      toast({ title: "Streaming link deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete streaming link",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteViewerMutation = useMutation({
    mutationFn: async (linkId: string) => {
      await apiRequest("DELETE", `/api/viewer-links/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/viewer-links"] });
      toast({ title: "Viewer link deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete viewer link",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteShortMutation = useMutation({
    mutationFn: async (shortCode: string) => {
      await apiRequest("DELETE", `/api/short-links/${shortCode}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/short-links"] });
      toast({ title: "Short link deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete short link",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${type} copied to clipboard` });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const openInviteDialog = (
    type: 'streaming' | 'viewer' | 'short-link',
    linkDetails: any,
    linkId?: string,
    shortCode?: string
  ) => {
    setInviteDialog({
      open: true,
      type,
      linkId,
      shortCode,
      linkDetails
    });
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return "Never";
    const date = new Date(expiresAt);
    const now = new Date();
    const isExpired = date < now;
    return (
      <span className={isExpired ? "text-destructive" : "text-foreground"}>
        {date.toLocaleDateString()} {date.toLocaleTimeString()}
      </span>
    );
  };

  const renderStreamingLinks = () => {
    if (streamingLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading streaming links...
        </div>
      );
    }

    if (!streamingLinks?.length) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No streaming links found. Create links from the dashboard to see them here.
        </div>
      );
    }

    if (isMobile) {
      return (
        <div className="space-y-4">
          {streamingLinks.map((link) => (
            <Card key={link.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-primary" />
                  <span className="font-semibold truncate">{link.streamName}</span>
                </div>
                <div className="flex gap-1">
                  {link.chatEnabled && <MessageSquare className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-muted-foreground mb-4">
                <div><span className="font-medium">Return Feed:</span> {link.returnFeed}</div>
                <div><span className="font-medium">Expires:</span> {formatExpiry(link.expiresAt)}</div>
                {link.shortCode && (
                  <div><span className="font-medium">Short Link:</span> /s/{link.shortCode}</div>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(link.url, "Streaming link")}
                  className="flex-1 min-w-0"
                  data-testid={`button-copy-streaming-${link.id}`}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openInviteDialog('streaming', {
                    streamName: link.streamName,
                    returnFeed: link.returnFeed,
                    chatEnabled: link.chatEnabled,
                    expiresAt: link.expiresAt ? new Date(link.expiresAt) : null
                  }, link.id)}
                  className="flex-1 min-w-0"
                  data-testid={`button-invite-streaming-${link.id}`}
                >
                  <Mail className="h-3 w-3 mr-1" />
                  Invite
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(link.url, '_blank')}
                  className="flex-1 min-w-0"
                  data-testid={`button-open-streaming-${link.id}`}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteStreamingMutation.mutate(link.id)}
                  disabled={deleteStreamingMutation.isPending}
                  data-testid={`button-delete-streaming-${link.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Stream Name</TableHead>
            <TableHead>Return Feed</TableHead>
            <TableHead>Chat</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Short Link</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {streamingLinks.map((link) => (
            <TableRow key={link.id}>
              <TableCell className="font-medium">{link.streamName}</TableCell>
              <TableCell className="max-w-48 truncate">{link.returnFeed}</TableCell>
              <TableCell>
                {link.chatEnabled ? (
                  <Badge variant="secondary">Enabled</Badge>
                ) : (
                  <Badge variant="outline">Disabled</Badge>
                )}
              </TableCell>
              <TableCell>{formatExpiry(link.expiresAt)}</TableCell>
              <TableCell>
                {link.shortCode ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(`${window.location.origin}/s/${link.shortCode}`, "Short link")}
                    className="font-mono"
                  >
                    /s/{link.shortCode}
                  </Button>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-1 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(link.url, "Streaming link")}
                    data-testid={`button-copy-streaming-${link.id}`}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openInviteDialog('streaming', {
                      streamName: link.streamName,
                      returnFeed: link.returnFeed,
                      chatEnabled: link.chatEnabled,
                      expiresAt: link.expiresAt ? new Date(link.expiresAt) : null
                    }, link.id)}
                    data-testid={`button-invite-streaming-${link.id}`}
                  >
                    <Mail className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(link.url, '_blank')}
                    data-testid={`button-open-streaming-${link.id}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteStreamingMutation.mutate(link.id)}
                    disabled={deleteStreamingMutation.isPending}
                    data-testid={`button-delete-streaming-${link.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderViewerLinks = () => {
    if (viewerLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading viewer links...
        </div>
      );
    }

    if (!viewerLinks?.length) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No viewer links found. Create viewer links from the dashboard to see them here.
        </div>
      );
    }

    if (isMobile) {
      return (
        <div className="space-y-4">
          {viewerLinks.map((link) => (
            <Card key={link.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-primary" />
                  <span className="font-semibold truncate">Viewer Link</span>
                </div>
                <div className="flex gap-1">
                  {link.chatEnabled && <MessageSquare className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-muted-foreground mb-4">
                <div><span className="font-medium">Return Feed:</span> {link.returnFeed}</div>
                <div><span className="font-medium">Expires:</span> {formatExpiry(link.expiresAt)}</div>
                {link.shortCode && (
                  <div><span className="font-medium">Short Link:</span> /sv/{link.shortCode}</div>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(link.url, "Viewer link")}
                  className="flex-1 min-w-0"
                  data-testid={`button-copy-viewer-${link.id}`}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openInviteDialog('viewer', {
                    returnFeed: link.returnFeed,
                    chatEnabled: link.chatEnabled,
                    expiresAt: link.expiresAt ? new Date(link.expiresAt) : null
                  }, link.id)}
                  className="flex-1 min-w-0"
                  data-testid={`button-invite-viewer-${link.id}`}
                >
                  <Mail className="h-3 w-3 mr-1" />
                  Invite
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(link.url, '_blank')}
                  className="flex-1 min-w-0"
                  data-testid={`button-open-viewer-${link.id}`}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteViewerMutation.mutate(link.id)}
                  disabled={deleteViewerMutation.isPending}
                  data-testid={`button-delete-viewer-${link.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Return Feed</TableHead>
            <TableHead>Chat</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Short Link</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {viewerLinks.map((link) => (
            <TableRow key={link.id}>
              <TableCell className="max-w-48 truncate">{link.returnFeed}</TableCell>
              <TableCell>
                {link.chatEnabled ? (
                  <Badge variant="secondary">Enabled</Badge>
                ) : (
                  <Badge variant="outline">Disabled</Badge>
                )}
              </TableCell>
              <TableCell>{formatExpiry(link.expiresAt)}</TableCell>
              <TableCell>
                {link.shortCode ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(`${window.location.origin}/sv/${link.shortCode}`, "Short viewer link")}
                    className="font-mono"
                  >
                    /sv/{link.shortCode}
                  </Button>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-1 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(link.url, "Viewer link")}
                    data-testid={`button-copy-viewer-${link.id}`}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openInviteDialog('viewer', {
                      returnFeed: link.returnFeed,
                      chatEnabled: link.chatEnabled,
                      expiresAt: link.expiresAt ? new Date(link.expiresAt) : null
                    }, link.id)}
                    data-testid={`button-invite-viewer-${link.id}`}
                  >
                    <Mail className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(link.url, '_blank')}
                    data-testid={`button-open-viewer-${link.id}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteViewerMutation.mutate(link.id)}
                    disabled={deleteViewerMutation.isPending}
                    data-testid={`button-delete-viewer-${link.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderShortLinks = () => {
    if (shortLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading short links...
        </div>
      );
    }

    if (!shortLinks?.length) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No short links found. Create short links from the dashboard to see them here.
        </div>
      );
    }

    if (isMobile) {
      return (
        <div className="space-y-4">
          {shortLinks.map((link) => (
            <Card key={link.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Link className="h-4 w-4 text-primary" />
                  <span className="font-semibold font-mono">/{link.id}</span>
                </div>
                <div className="flex gap-1">
                  {link.chatEnabled && <MessageSquare className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-muted-foreground mb-4">
                <div><span className="font-medium">Stream:</span> {link.streamName}</div>
                <div><span className="font-medium">Return Feed:</span> {link.returnFeed}</div>
                <div><span className="font-medium">Expires:</span> {formatExpiry(link.expiresAt)}</div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(`${window.location.origin}/s/${link.id}`, "Short link")}
                  className="flex-1 min-w-0"
                  data-testid={`button-copy-short-${link.id}`}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openInviteDialog('short-link', {
                    streamName: link.streamName,
                    returnFeed: link.returnFeed,
                    chatEnabled: link.chatEnabled,
                    expiresAt: link.expiresAt ? new Date(link.expiresAt) : null
                  }, undefined, link.id)}
                  className="flex-1 min-w-0"
                  data-testid={`button-invite-short-${link.id}`}
                >
                  <Mail className="h-3 w-3 mr-1" />
                  Invite
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`/s/${link.id}`, '_blank')}
                  className="flex-1 min-w-0"
                  data-testid={`button-open-short-${link.id}`}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteShortMutation.mutate(link.id)}
                  disabled={deleteShortMutation.isPending}
                  data-testid={`button-delete-short-${link.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Short Code</TableHead>
            <TableHead>Stream Name</TableHead>
            <TableHead>Return Feed</TableHead>
            <TableHead>Chat</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shortLinks.map((link) => (
            <TableRow key={link.id}>
              <TableCell className="font-mono">/{link.id}</TableCell>
              <TableCell>{link.streamName}</TableCell>
              <TableCell className="max-w-48 truncate">{link.returnFeed}</TableCell>
              <TableCell>
                {link.chatEnabled ? (
                  <Badge variant="secondary">Enabled</Badge>
                ) : (
                  <Badge variant="outline">Disabled</Badge>
                )}
              </TableCell>
              <TableCell>{formatExpiry(link.expiresAt)}</TableCell>
              <TableCell className="text-right">
                <div className="flex gap-1 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(`${window.location.origin}/s/${link.id}`, "Short link")}
                    data-testid={`button-copy-short-${link.id}`}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openInviteDialog('short-link', {
                      streamName: link.streamName,
                      returnFeed: link.returnFeed,
                      chatEnabled: link.chatEnabled,
                      expiresAt: link.expiresAt ? new Date(link.expiresAt) : null
                    }, undefined, link.id)}
                    data-testid={`button-invite-short-${link.id}`}
                  >
                    <Mail className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`/s/${link.id}`, '_blank')}
                    data-testid={`button-open-short-${link.id}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteShortMutation.mutate(link.id)}
                    disabled={deleteShortMutation.isPending}
                    data-testid={`button-delete-short-${link.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className={`${isMobile ? 'p-4' : 'container mx-auto p-6'}`}>
      <div className={`flex items-center gap-2 ${isMobile ? 'mb-4' : 'mb-6'}`}>
        <Link className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'}`} />
        <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold`}>Link Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage Your Links</CardTitle>
          <CardDescription>
            View, share, and manage all your streaming links, viewer links, and short links with email invites.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="streaming" className="w-full">
            <TabsList className={`${isMobile ? 'w-full' : 'grid w-full grid-cols-3'}`}>
              <TabsTrigger value="streaming" className={isMobile ? 'flex-1' : ''}>
                <Video className="h-4 w-4 mr-2" />
                Streaming
              </TabsTrigger>
              <TabsTrigger value="viewer" className={isMobile ? 'flex-1' : ''}>
                <Monitor className="h-4 w-4 mr-2" />
                Viewer
              </TabsTrigger>
              <TabsTrigger value="short" className={isMobile ? 'flex-1' : ''}>
                <Link className="h-4 w-4 mr-2" />
                Short Links
              </TabsTrigger>
            </TabsList>

            <TabsContent value="streaming" className="mt-6">
              {renderStreamingLinks()}
            </TabsContent>

            <TabsContent value="viewer" className="mt-6">
              {renderViewerLinks()}
            </TabsContent>

            <TabsContent value="short" className="mt-6">
              {renderShortLinks()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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