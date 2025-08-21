import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { startPlayback } from "@/lib/streaming";
import { MobileNav } from "@/components/mobile-nav";
import { MobileVideoControls } from "@/components/mobile-video-controls";
import { useMobile, useSwipeGestures } from "@/hooks/use-mobile";

export default function Viewer() {
  const [streamName, setStreamName] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { isMobile } = useMobile();

  useEffect(() => {
    // Get stream name from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const stream = urlParams.get('stream');
    
    if (stream) {
      setStreamName(stream);
      startStream(stream);
    } else {
      toast({
        title: "Error",
        description: "No stream specified in URL",
        variant: "destructive",
      });
    }

    // Handle fullscreen changes
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Mobile swipe gestures
  useSwipeGestures(
    undefined, // No left swipe action
    undefined, // No right swipe action
    () => {
      // Swipe up - toggle fullscreen
      if (isMobile) {
        toggleFullscreen();
      }
    }
  );

  const startStream = async (stream: string) => {
    if (!videoRef.current) return;

    try {
      await startPlayback(videoRef.current, stream);
      setIsConnected(true);
      toast({
        title: "Stream Connected",
        description: `Now viewing: ${stream}`,
      });
    } catch (error) {
      toast({
        title: "Connection Error",
        description: `Failed to connect to stream: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      toast({
        title: "Fullscreen Error",
        description: "Could not toggle fullscreen mode",
        variant: "destructive",
      });
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const goBack = () => {
    window.close();
    // Fallback if window.close() doesn't work
    setTimeout(() => {
      window.history.back();
    }, 100);
  };

  return (
    <div 
      ref={containerRef}
      className={`${isFullscreen ? 'fixed inset-0 z-50' : 'min-h-screen'} ${isMobile ? 'mobile-layout swipe-container' : ''} bg-va-dark-bg text-va-text-primary font-inter`}
      data-testid="viewer-container"
    >
      
      {/* Mobile Navigation */}
      {isMobile && !isFullscreen && (
        <MobileNav
          title={`${streamName || 'Stream'} - Viewer`}
          onBack={() => window.history.back()}
          onToggleFullscreen={toggleFullscreen}
          showFullscreenButton={true}
          isFullscreen={isFullscreen}
        />
      )}

      {/* Desktop Header - Hidden in fullscreen and mobile */}
      {!isFullscreen && !isMobile && (
        <div className="va-bg-dark-surface border-b va-border-dark p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                onClick={goBack}
                variant="outline"
                size="sm"
                className="va-bg-dark-surface-2 hover:bg-gray-600 va-text-primary va-border-dark"
                data-testid="button-back"
              >
                <i className="fas fa-arrow-left mr-2"></i>
                Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold va-text-primary">Stream Viewer</h1>
                <p className="text-sm va-text-secondary">
                  Viewing: <span className="va-text-green font-mono">{streamName}</span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1 rounded-full text-sm ${
                isConnected 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`} data-testid="status-connection">
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
              <Button 
                onClick={toggleFullscreen}
                variant="outline"
                size="sm"
                className="border-va-primary va-text-green hover:va-bg-primary hover:text-va-dark-bg"
                data-testid="button-fullscreen"
              >
                <i className="fas fa-expand mr-2"></i>
                Fullscreen
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Video Container */}
      <div className={`${isFullscreen ? 'h-full' : 'h-[calc(100vh-80px)]'} relative bg-black`}>
        <video 
          ref={videoRef}
          autoPlay 
          muted 
          controls 
          playsInline 
          className="w-full h-full object-contain"
          data-testid="video-main"
        />
        
        {/* Mobile Controls Overlay */}
        {isMobile && (
          <MobileVideoControls
            isConnected={isConnected}
            onToggleFullscreen={toggleFullscreen}
            onToggleMute={toggleMute}
            isMuted={isMuted}
            streamName={streamName || 'Stream'}
            showPublishingControls={false}
          />
        )}

        {/* Desktop Fullscreen Controls Overlay */}
        {isFullscreen && !isMobile && (
          <div className="absolute top-4 right-4 z-10">
            <Button 
              onClick={toggleFullscreen}
              variant="outline"
              size="sm"
              className="bg-black/50 border-white/20 text-white hover:bg-white/10"
              data-testid="button-exit-fullscreen"
            >
              <i className="fas fa-compress mr-2"></i>
              Exit Fullscreen
            </Button>
          </div>
        )}

        {/* Loading/Error State */}
        {!isConnected && (
          <div className="absolute inset-0 flex items-center justify-center bg-va-dark-surface/80">
            <div className="text-center">
              <i className="fas fa-circle-notch fa-spin text-4xl va-text-green mb-4"></i>
              <h3 className="text-xl font-semibold va-text-primary mb-2">Connecting to Stream</h3>
              <p className="va-text-secondary">
                Attempting to connect to: <span className="va-text-green font-mono">{streamName}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info - Hidden in fullscreen */}
      {!isFullscreen && (
        <div className="va-bg-dark-surface-2 border-t va-border-dark p-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="va-text-secondary">Stream Name:</span>
                <span className="va-text-primary font-mono ml-2">{streamName}</span>
              </div>
              <div>
                <span className="va-text-secondary">Protocol:</span>
                <span className="va-text-primary ml-2">WHEP (WebRTC)</span>
              </div>
              <div>
                <span className="va-text-secondary">Status:</span>
                <span className={`ml-2 ${isConnected ? 'va-text-green' : 'text-red-400'}`}>
                  {isConnected ? 'Live' : 'Connecting...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}