import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { startPlayback, initializeStreaming } from "@/lib/streaming";

// Global variables for SRS SDK
declare global {
  interface Window {
    SrsRtcWhipWhepAsync: any;
    SrsRtcFormatStats: any;
  }
}

export default function StudioViewer() {
  const [, setLocation] = useLocation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [videoStats, setVideoStats] = useState<any>(null);
  const [chatEnabled, setChatEnabled] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [returnFeed, setReturnFeed] = useState("");
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    const validateTokenAndInitialize = async () => {
      // Get parameters from URL
      const urlParams = new URLSearchParams(window.location.search);
      const returnParam = urlParams.get('return');
      const chatParam = urlParams.get('chat');
      const token = urlParams.get('token');

      if (!returnParam) {
        toast({
          title: "Error",
          description: "No return feed specified",
          variant: "destructive",
        });
        setLocation('/');
        return;
      }

      // Validate session token if provided
      if (token) {
        try {
          const response = await fetch('/api/validate-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
          });

          const result = await response.json();
          
          if (!result.valid) {
            toast({
              title: "Access Denied",
              description: "This viewer link has expired or been used already. Please request a new link.",
              variant: "destructive",
            });
            setLocation('/');
            return;
          }
          
          setTokenValid(true);
        } catch (error) {
          console.error('Token validation failed:', error);
          toast({
            title: "Access Denied",
            description: "Unable to validate session token. Please try again.",
            variant: "destructive",
          });
          setLocation('/');
          return;
        }
      } else {
        // No token provided - deny access
        toast({
          title: "Access Denied",
          description: "This viewer session requires a valid token. Please use the link provided to you.",
          variant: "destructive",
        });
        setLocation('/');
        return;
      }

      setIsValidatingToken(false);
      setReturnFeed(returnParam);
      setChatEnabled(chatParam === 'true');
      setShowChat(chatParam === 'true');
      
      // Initialize streaming configuration
      initializeStreaming({
        app: 'live'
      });
    };

    validateTokenAndInitialize();
  }, [setLocation, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        if ((playerRef.current as any).statsInterval) {
          clearInterval((playerRef.current as any).statsInterval);
        }
        playerRef.current.close();
        playerRef.current = null;
      }
    };
  }, []);

  const startViewing = async () => {
    if (!videoRef.current || !returnFeed) return;
    
    if (!window.SrsRtcWhipWhepAsync) {
      toast({
        title: "Error",
        description: "SRS SDK not loaded. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    setIsPlaying(true);
    setHasError(false);
    
    try {
      // Clean up existing player
      if (playerRef.current) {
        playerRef.current.close();
        playerRef.current = null;
      }
      
      // Use the improved startPlayback function with retry logic
      await startPlayback(videoRef.current, returnFeed);
      
      toast({
        title: "Success",
        description: `Connected to return feed: ${returnFeed}`,
      });

      
    } catch (error) {
      console.error('WHEP playback error:', error);
      setHasError(true);
      setIsPlaying(false);
      
      // Clean up failed connection
      if (playerRef.current) {
        playerRef.current.close();
        playerRef.current = null;
      }
      
      toast({
        title: "Connection Failed",
        description: `Could not connect to ${returnFeed}. Please check if the stream is active.`,
        variant: "destructive",
      });
    }
  };

  const stopViewing = () => {
    // Clean up player and intervals
    if (playerRef.current) {
      if ((playerRef.current as any).statsInterval) {
        clearInterval((playerRef.current as any).statsInterval);
      }
      playerRef.current.close();
      playerRef.current = null;
    }
    
    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
    }
    
    setIsPlaying(false);
    setVideoStats(null);
    toast({
      title: "Disconnected",
      description: "Stopped viewing return feed",
    });
  };

  // Show loading state while validating token
  if (isValidatingToken) {
    return (
      <div className="min-h-screen va-bg-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-va-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold va-text-primary mb-2">Validating Access</h2>
          <p className="va-text-secondary">Please wait while we verify your viewer token...</p>
        </div>
      </div>
    );
  }

  // Show access denied state if token is invalid
  if (!tokenValid) {
    return (
      <div className="min-h-screen va-bg-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">🚫</div>
          <h2 className="text-xl font-semibold va-text-primary mb-2">Access Denied</h2>
          <p className="va-text-secondary">This viewer link is no longer valid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold va-text-primary mb-2">Studio Viewer</h1>
            <p className="va-text-secondary">Watch the studio return feed: <span className="va-text-primary font-mono">{returnFeed}</span></p>
          </div>
          <Button 
            onClick={() => setLocation('/')}
            variant="outline"
            className="va-border-dark va-text-secondary hover:va-text-primary"
            data-testid="button-back-home"
          >
            <i className="fas fa-arrow-left mr-2"></i>
            Back to Home
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <div className="va-bg-dark-surface rounded-2xl p-6 border va-border-dark">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold va-text-primary">Return Feed</h2>
                <div className="flex gap-2">
                  {!isPlaying && !hasError && (
                    <Button 
                      onClick={startViewing}
                      className="va-bg-primary hover:va-bg-primary-dark text-va-dark-bg"
                      data-testid="button-start-viewing"
                    >
                      <i className="fas fa-play mr-2"></i>
                      Start Viewing
                    </Button>
                  )}
                  {isPlaying && (
                    <Button 
                      onClick={stopViewing}
                      variant="outline"
                      className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                      data-testid="button-stop-viewing"
                    >
                      <i className="fas fa-stop mr-2"></i>
                      Stop
                    </Button>
                  )}
                  {hasError && (
                    <Button 
                      onClick={startViewing}
                      className="va-bg-primary hover:va-bg-primary-dark text-va-dark-bg"
                      data-testid="button-retry"
                    >
                      <i className="fas fa-redo mr-2"></i>
                      Retry
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-4">
                <video 
                  ref={videoRef}
                  autoPlay 
                  muted 
                  controls 
                  playsInline 
                  className="w-full h-full object-cover"
                  data-testid="video-return-feed"
                />
                {!isPlaying && !hasError && (
                  <div className="absolute inset-0 flex items-center justify-center va-bg-dark-surface-2">
                    <div className="text-center">
                      <i className="fas fa-tv text-6xl text-gray-500 mb-4"></i>
                      <p className="text-lg va-text-primary mb-2">Studio Return Feed</p>
                      <p className="va-text-secondary">Click "Start Viewing" to connect</p>
                    </div>
                  </div>
                )}
                {hasError && (
                  <div className="absolute inset-0 flex items-center justify-center va-bg-dark-surface-2">
                    <div className="text-center">
                      <i className="fas fa-exclamation-triangle text-6xl text-red-500 mb-4"></i>
                      <p className="text-lg text-red-400 mb-2">Connection Failed</p>
                      <p className="va-text-secondary">Check if the studio is streaming</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-sm va-text-secondary">
                <strong>Return Feed:</strong> {returnFeed}
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="lg:col-span-1">
            <div className="va-bg-dark-surface rounded-2xl p-6 border va-border-dark sticky top-8">
              <h3 className="text-xl font-semibold va-text-primary mb-4">Stream Info</h3>
              
              <div className="space-y-4">
                <div className="va-bg-dark-surface-2 rounded-lg p-4">
                  <h4 className="font-medium va-text-primary flex items-center mb-2">
                    <i className="fas fa-satellite-dish mr-2 va-text-green"></i>
                    Connection Status
                  </h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="va-text-secondary">Status:</span>
                      <span className={isPlaying ? "va-text-green" : hasError ? "text-red-400" : "va-text-secondary"}>
                        {isPlaying ? "Connected" : hasError ? "Failed" : "Disconnected"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="va-text-secondary">Return Feed:</span>
                      <span className="va-text-primary font-mono text-xs">{returnFeed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="va-text-secondary">Chat:</span>
                      <span className={chatEnabled ? "va-text-green" : "va-text-secondary"}>
                        {chatEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                </div>

                {videoStats && (
                  <div className="va-bg-dark-surface-2 rounded-lg p-4">
                    <h4 className="font-medium va-text-primary flex items-center mb-2">
                      <i className="fas fa-chart-line mr-2 va-text-blue"></i>
                      Video Stats
                    </h4>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="va-text-secondary">Resolution:</span>
                        <span className="va-text-primary">{videoStats.resolution || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="va-text-secondary">Codec:</span>
                        <span className="va-text-primary">{videoStats.codec || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="va-text-secondary">Bitrate:</span>
                        <span className="va-text-primary">{videoStats.bitrate || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="va-text-secondary">FPS:</span>
                        <span className="va-text-primary">{videoStats.fps || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {chatEnabled && showChat && (
                  <div className="va-bg-dark-surface-2 rounded-lg overflow-hidden">
                    <div className="va-bg-dark-border p-3 border-b va-border-dark">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium va-text-primary flex items-center">
                          <i className="fas fa-comments mr-2 va-text-green"></i>
                          Live Chat
                        </h4>
                        <Button 
                          onClick={() => setShowChat(false)}
                          variant="ghost"
                          size="sm"
                          className="va-text-secondary hover:va-text-primary"
                          data-testid="button-hide-chat"
                        >
                          <i className="fas fa-times"></i>
                        </Button>
                      </div>
                    </div>
                    <div className="h-96">
                      <iframe 
                        src="https://dev.blabb.me/room/pe9gg8" 
                        className="w-full h-full border-none"
                        data-testid="iframe-chat"
                      />
                    </div>
                  </div>
                )}

                {chatEnabled && !showChat && (
                  <div className="text-center">
                    <Button 
                      onClick={() => setShowChat(true)}
                      variant="outline"
                      className="va-bg-dark-surface-2 hover:bg-gray-600 va-text-primary va-border-dark"
                      data-testid="button-show-chat"
                    >
                      <i className="fas fa-comments mr-2"></i>
                      Show Chat
                    </Button>
                  </div>
                )}

                <div className="pt-4 border-t va-border-dark">
                  <h4 className="font-medium va-text-primary mb-2">Quick Actions</h4>
                  <div className="space-y-2">
                    <Button 
                      onClick={() => setLocation('/generator')}
                      variant="outline"
                      size="sm"
                      className="w-full va-border-dark va-text-secondary hover:va-text-primary"
                      data-testid="button-generate-links"
                    >
                      <i className="fas fa-link mr-2"></i>
                      Generate New Links
                    </Button>
                    <Button 
                      onClick={() => setLocation('/links')}
                      variant="outline"
                      size="sm"
                      className="w-full va-border-dark va-text-secondary hover:va-text-primary"
                      data-testid="button-view-links"
                    >
                      <i className="fas fa-list mr-2"></i>
                      View All Links
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}