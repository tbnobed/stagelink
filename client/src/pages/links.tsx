import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { startPlayback } from "@/lib/streaming";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

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
  const [previewingLink, setPreviewingLink] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

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

    // Set the previewing link first so the video element gets rendered
    setPreviewingLink(linkId);

    // Wait for the video element to be rendered
    await new Promise(resolve => setTimeout(resolve, 100));

    if (!previewVideoRef.current) {
      console.error('Video element not found after setting preview link');
      setPreviewingLink(null);
      return;
    }

    console.log('Video element:', previewVideoRef.current);

    try {
      console.log('Calling startPlayback...');
      await startPlayback(previewVideoRef.current, streamName);
      console.log('Preview started successfully');
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
      setPreviewingLink(null);
    }
  };

  const stopPreview = () => {
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
    setPreviewingLink(null);
  };

  const deleteLink = (linkId: string, linkType: 'guest' | 'viewer') => {
    if (previewingLink === linkId) {
      stopPreview();
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
    // Delete all links one by one
    links.forEach((link: GeneratedLink) => deleteLink(link.id, link.type));
    stopPreview();
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

  return (
    <div className="min-h-screen py-6 px-6">
      <div className="w-full max-w-none">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold va-text-primary mb-2">Generated Links</h1>
            <p className="va-text-secondary">View and preview all your generated streaming links</p>
          </div>
          {links.length > 0 && (
            <div className="flex gap-2">
              <Button 
                onClick={removeExpiredLinks}
                variant="outline"
                className="border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white"
                data-testid="button-remove-expired"
              >
                <i className="fas fa-clock mr-2"></i>
                Remove Expired
              </Button>
              <Button 
                onClick={clearAllLinks}
                variant="outline"
                className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                data-testid="button-clear-all"
              >
                <i className="fas fa-trash mr-2"></i>
                Clear All
              </Button>
            </div>
          )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {links.map((link: GeneratedLink) => (
              <div key={link.id} className="va-bg-dark-surface rounded-lg border va-border-dark hover:border-va-primary/50 transition-all duration-200 hover:shadow-lg overflow-hidden">
                {/* Preview Window */}
                <div className="relative bg-black aspect-video">
                  {previewingLink === link.id ? (
                    <video 
                      ref={previewingLink === link.id ? previewVideoRef : undefined}
                      autoPlay 
                      muted 
                      controls 
                      playsInline 
                      className="w-full h-full object-cover"
                      data-testid={`video-preview-${link.id}`}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center va-bg-dark-surface-2">
                      <div className="text-center">
                        <i className="fas fa-eye text-3xl text-gray-500 mb-2"></i>
                        <p className="va-text-secondary text-sm">Preview Window</p>
                        {link.type === 'guest' && link.streamName && (
                          <Button 
                            onClick={() => previewStream(link.streamName!, link.id)}
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
                  {previewingLink === link.id && (
                    <Button 
                      onClick={stopPreview}
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                      data-testid={`button-stop-preview-${link.id}`}
                    >
                      <i className="fas fa-stop"></i>
                    </Button>
                  )}
                </div>

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

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    {/* Primary Actions Row */}
                    <div className="flex gap-1">
                      <Button 
                        onClick={() => copyToClipboard(
                          link.shortLink 
                            ? `${window.location.origin}${link.shortLink}` 
                            : link.url
                        )}
                        variant="outline"
                        size="sm"
                        className="flex-1 border-va-primary va-text-green hover:va-bg-primary hover:text-va-dark-bg text-xs"
                        data-testid={`button-copy-${link.id}`}
                      >
                        <i className="fas fa-copy mr-1"></i>
                        Copy
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
                        className="flex-1 border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white text-xs"
                        data-testid={`button-open-${link.id}`}
                      >
                        <i className="fas fa-external-link-alt mr-1"></i>
                        Open
                      </Button>
                    </div>
                    
                    {/* Secondary Actions Row */}
                    <div className="flex gap-1">
                      {link.type === 'guest' && link.streamName && (
                        <Button 
                          onClick={() => copyIngestLink(link.streamName!)}
                          variant="outline"
                          size="sm"
                          className="flex-1 border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white text-xs"
                          data-testid={`button-copy-ingest-${link.id}`}
                        >
                          <i className="fas fa-broadcast-tower mr-1"></i>
                          Ingest
                        </Button>
                      )}
                      <Button 
                        onClick={() => deleteLink(link.id, link.type)}
                        variant="outline"
                        size="sm"
                        className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white text-xs"
                        data-testid={`button-delete-${link.id}`}
                      >
                        <i className="fas fa-trash mr-1"></i>
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}