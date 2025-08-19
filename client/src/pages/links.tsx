import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { startPlayback } from "@/lib/streaming";

interface GeneratedLink {
  id: string;
  streamName: string;
  returnFeed: string;
  chatEnabled: boolean;
  url: string;
  createdAt: Date;
}

export default function Links() {
  const [links, setLinks] = useState<GeneratedLink[]>([]);
  const [previewingLink, setPreviewingLink] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Load saved links from localStorage
    const savedLinks = localStorage.getItem('virtualAudienceLinks');
    if (savedLinks) {
      try {
        const parsedLinks = JSON.parse(savedLinks).map((link: any) => ({
          ...link,
          createdAt: new Date(link.createdAt)
        }));
        setLinks(parsedLinks);
      } catch (error) {
        console.error('Error loading saved links:', error);
      }
    }
  }, []);

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

  const deleteLink = (linkId: string) => {
    const updatedLinks = links.filter(link => link.id !== linkId);
    setLinks(updatedLinks);
    localStorage.setItem('virtualAudienceLinks', JSON.stringify(updatedLinks));
    
    if (previewingLink === linkId) {
      stopPreview();
    }

    toast({
      title: "Link Deleted",
      description: "The link has been removed from your list",
    });
  };

  const clearAllLinks = () => {
    setLinks([]);
    localStorage.removeItem('virtualAudienceLinks');
    stopPreview();
    
    toast({
      title: "All Links Cleared",
      description: "Your link history has been cleared",
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
            <Button 
              onClick={clearAllLinks}
              variant="outline"
              className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
              data-testid="button-clear-all"
            >
              <i className="fas fa-trash mr-2"></i>
              Clear All
            </Button>
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
                {links.map((link) => (
                  <div key={link.id} className="va-bg-dark-surface rounded-lg p-6 border va-border-dark hover:border-va-primary/50 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold va-text-primary" data-testid={`text-stream-${link.id}`}>
                            {link.streamName}
                          </h3>
                          <Badge variant="outline" className="va-text-green border-va-primary">
                            {link.returnFeed}
                          </Badge>
                          {link.chatEnabled && (
                            <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                              Chat
                            </Badge>
                          )}
                        </div>
                        <p className="va-text-secondary text-sm mb-3">
                          Created: {link.createdAt.toLocaleString()}
                        </p>
                        <div className="va-bg-dark-surface-2 rounded p-3 mb-4">
                          <code className="text-xs va-text-green font-mono break-all" data-testid={`text-url-${link.id}`}>
                            {link.url}
                          </code>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      <Button 
                        onClick={() => copyToClipboard(link.url)}
                        variant="outline"
                        size="sm"
                        className="border-va-primary va-text-green hover:va-bg-primary hover:text-va-dark-bg"
                        data-testid={`button-copy-${link.id}`}
                      >
                        <i className="fas fa-copy mr-2"></i>
                        Copy
                      </Button>
                      <Button 
                        onClick={() => previewStream(link.streamName, link.id)}
                        variant="outline"
                        size="sm"
                        className="va-bg-dark-surface-2 hover:bg-gray-600 va-text-primary va-border-dark"
                        disabled={previewingLink === link.id}
                        data-testid={`button-preview-${link.id}`}
                      >
                        <i className={`fas ${previewingLink === link.id ? 'fa-spinner fa-spin' : 'fa-play'} mr-2`}></i>
                        {previewingLink === link.id ? 'Previewing...' : 'Preview'}
                      </Button>
                      <Button 
                        onClick={() => window.open(`/viewer?stream=${encodeURIComponent(link.streamName)}`, '_blank')}
                        variant="outline"
                        size="sm"
                        className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                        data-testid={`button-open-${link.id}`}
                      >
                        <i className="fas fa-external-link-alt mr-2"></i>
                        Open
                      </Button>
                      <Button 
                        onClick={() => deleteLink(link.id)}
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
                        {links.find(l => l.id === previewingLink)?.streamName}
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