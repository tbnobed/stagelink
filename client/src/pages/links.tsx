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

  // Fetch both guest session links and viewer links
  const { data: links = [], isLoading, error } = useQuery({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/links'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/links'] });
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
    if (!previewVideoRef.current) return;

    try {
      setPreviewingLink(linkId);
      await startPlayback(previewVideoRef.current, streamName);
      toast({
        title: "Preview Started",
        description: `Now previewing stream: ${streamName}`,
      });
    } catch (error) {
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

    deleteLinkMutation.mutate({ linkId, linkType }, {
      onSuccess: () => {
        toast({
          title: "Link Deleted",
          description: "The link has been removed from your list",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to delete link",
          variant: "destructive",
        });
      },
    });
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
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
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

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Links List */}
          <div className="lg:col-span-2">
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
              <div className="space-y-4">
                {links.map((link: GeneratedLink) => (
                  <div key={link.id} className="va-bg-dark-surface rounded-lg p-6 border va-border-dark hover:border-va-primary/50 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold va-text-primary" data-testid={`text-stream-${link.id}`}>
                            {link.type === 'guest' ? link.streamName : link.returnFeed || 'Viewer Link'}
                          </h3>
                          <Badge variant="outline" className={
                            link.type === 'guest' 
                              ? "va-text-green border-va-primary" 
                              : "bg-purple-500/20 text-purple-400 border-purple-500/50"
                          }>
                            {link.type === 'guest' ? 'Guest Session' : 'Return Feed Viewer'}
                          </Badge>
                          {link.type === 'guest' && link.returnFeed && (
                            <Badge variant="outline" className="va-text-green border-va-primary">
                              Return: {link.returnFeed}
                            </Badge>
                          )}
                          {link.chatEnabled && (
                            <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                              Chat
                            </Badge>
                          )}
                          {link.expiresAt && (
                            <Badge 
                              variant="outline" 
                              className={`${
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
                        <div className="text-sm va-text-secondary mb-3 space-y-1">
                          <div>Created: {new Date(link.createdAt).toLocaleString()}</div>
                          {link.expiresAt && (
                            <div>Expires: {new Date(link.expiresAt).toLocaleString()}</div>
                          )}
                        </div>
                        <div className="space-y-3 mb-4">
                          {/* Short Link - Primary Display */}
                          {link.shortLink && (
                            <div className="va-bg-dark-surface-2 rounded p-3 border-l-4 border-va-primary">
                              <div className="flex items-center gap-2 mb-1">
                                <i className="fas fa-star text-va-primary text-xs"></i>
                                <span className="text-xs va-text-primary font-medium">Recommended Share Link</span>
                              </div>
                              <code className="text-sm va-text-green font-mono break-all" data-testid={`text-short-url-${link.id}`}>
                                {`${window.location.origin}${link.shortLink}`}
                              </code>
                            </div>
                          )}
                          {/* Full Link - Secondary Display */}
                          <div className="va-bg-dark-surface-2 rounded p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <i className="fas fa-link text-gray-400 text-xs"></i>
                              <span className="text-xs va-text-secondary font-medium">Full Link</span>
                            </div>
                            <code className="text-xs va-text-secondary font-mono break-all" data-testid={`text-url-${link.id}`}>
                              {link.url}
                            </code>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      <Button 
                        onClick={() => copyToClipboard(
                          link.shortLink 
                            ? `${window.location.origin}${link.shortLink}` 
                            : link.url
                        )}
                        variant="outline"
                        size="sm"
                        className="border-va-primary va-text-green hover:va-bg-primary hover:text-va-dark-bg"
                        data-testid={`button-copy-${link.id}`}
                      >
                        <i className="fas fa-copy mr-2"></i>
                        {link.shortLink ? 'Copy Short Link' : 'Copy'}
                      </Button>
                      {/* Preview Button - Only for guest sessions */}
                      {link.type === 'guest' && link.streamName && (
                        <Button 
                          onClick={() => previewStream(link.streamName!, link.id)}
                          variant="outline"
                          size="sm"
                          className="va-bg-dark-surface-2 hover:bg-gray-600 va-text-primary va-border-dark"
                          disabled={previewingLink === link.id}
                          data-testid={`button-preview-${link.id}`}
                        >
                          <i className={`fas ${previewingLink === link.id ? 'fa-spinner fa-spin' : 'fa-play'} mr-2`}></i>
                          {previewingLink === link.id ? 'Previewing...' : 'Preview'}
                        </Button>
                      )}
                      
                      {/* Open Button - Different logic for guest vs viewer */}
                      <Button 
                        onClick={() => {
                          if (link.type === 'guest') {
                            window.open(`/viewer?stream=${encodeURIComponent(link.streamName || '')}`, '_blank');
                          } else {
                            // For viewer links, open the studio-viewer page directly
                            window.open(link.url, '_blank');
                          }
                        }}
                        variant="outline"
                        size="sm"
                        className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                        data-testid={`button-open-${link.id}`}
                      >
                        <i className="fas fa-external-link-alt mr-2"></i>
                        {link.type === 'guest' ? 'Open Guest Session' : 'Open Viewer'}
                      </Button>
                      
                      {/* Ingest Link - Only for guest sessions */}
                      {link.type === 'guest' && link.streamName && (
                        <Button 
                          onClick={() => copyIngestLink(link.streamName!)}
                          variant="outline"
                          size="sm"
                          className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white"
                          data-testid={`button-copy-ingest-${link.id}`}
                        >
                          <i className="fas fa-broadcast-tower mr-2"></i>
                          Copy Ingest Link
                        </Button>
                      )}
                      
                      <Button 
                        onClick={() => deleteLink(link.id, link.type)}
                        variant="outline"
                        size="sm"
                        className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                        data-testid={`button-delete-${link.id}`}
                      >
                        <i className="fas fa-trash mr-2"></i>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-1">
            <div className="va-bg-dark-surface rounded-2xl p-6 border va-border-dark sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold va-text-primary">Stream Preview</h3>
                {previewingLink && (
                  <Button 
                    onClick={stopPreview}
                    variant="outline"
                    size="sm"
                    className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                    data-testid="button-stop-preview"
                  >
                    <i className="fas fa-stop mr-2"></i>
                    Stop
                  </Button>
                )}
              </div>
              
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-4">
                <video 
                  ref={previewVideoRef}
                  autoPlay 
                  muted 
                  controls 
                  playsInline 
                  className="w-full h-full object-cover"
                  data-testid="video-preview"
                />
                {!previewingLink && (
                  <div className="absolute inset-0 flex items-center justify-center va-bg-dark-surface-2">
                    <div className="text-center">
                      <i className="fas fa-eye text-4xl text-gray-500 mb-4"></i>
                      <p className="va-text-secondary">Select a link to preview</p>
                    </div>
                  </div>
                )}
              </div>

              {previewingLink && (
                <div className="va-bg-dark-surface-2 rounded-lg p-4">
                  <h4 className="font-medium va-text-primary flex items-center mb-2">
                    <i className="fas fa-info-circle mr-2 va-text-green"></i>
                    Preview Info
                  </h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="va-text-secondary">Status:</span>
                      <span className="va-text-green">Live Preview</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="va-text-secondary">Stream:</span>
                      <span className="va-text-primary font-mono text-xs">
                        {links.find((l: GeneratedLink) => l.id === previewingLink)?.streamName}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}