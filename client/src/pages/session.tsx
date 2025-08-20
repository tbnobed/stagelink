import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { initializeStreaming, startPublishing, stopPublishing, startPlayback } from "@/lib/streaming";

export default function Session() {
  const [isPublishing, setIsPublishing] = useState(false);
  const [sessionId, setSessionId] = useState("Not connected");
  const [audioCodec, setAudioCodec] = useState("-");
  const [videoCodec, setVideoCodec] = useState("-");
  const [showChat, setShowChat] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [returnFeedStatus, setReturnFeedStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed' | 'retrying'>('disconnected');
  const [isReturnFeedStarted, setIsReturnFeedStarted] = useState(false);
  const publisherVideoRef = useRef<HTMLVideoElement>(null);
  const playerVideoRef = useRef<HTMLVideoElement>(null);
  const initializationRef = useRef(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (initializationRef.current) return; // Prevent multiple initializations
    initializationRef.current = true;
    
    const validateTokenAndInitialize = async () => {
      // Parse URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const stream = urlParams.get('stream');
      const returnStream = urlParams.get('return');
      const chatEnabledParam = urlParams.get('chat') === 'true';

      // Store chat enabled state
      setChatEnabled(chatEnabledParam);

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
              description: "This link has expired or been used already. Please request a new link.",
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
          description: "This session requires a valid token. Please use the link provided to you.",
          variant: "destructive",
        });
        setLocation('/');
        return;
      }

      setIsValidatingToken(false);

      if (chatEnabledParam) {
        setShowChat(true);
      }

      // Initialize streaming
      initializeStreaming({
        stream: stream || 'obed2',
        returnStream: returnStream || stream || 'obed2',
        app: 'live'
      });

      // Don't auto-start return feed, let user start it manually
      setReturnFeedStatus('disconnected');
    };

    validateTokenAndInitialize();
  }, [toast, setLocation]); // Proper dependencies

  // Add debugging for status changes
  useEffect(() => {
    console.log('Return feed status changed to:', returnFeedStatus);
  }, [returnFeedStatus]);

  const startReturnFeed = async () => {
    if (!playerVideoRef.current) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const returnStream = urlParams.get('return');
    const stream = urlParams.get('stream');
    const feedStream = returnStream || stream || 'obed2';
    
    setReturnFeedStatus('connecting');
    setIsReturnFeedStarted(true);
    
    try {
      await startPlayback(playerVideoRef.current, feedStream);
      setReturnFeedStatus('connected');
      toast({
        title: "Return Feed Connected",
        description: `Connected to return feed: ${feedStream}`,
      });
    } catch (error) {
      console.error('Return feed connection failed:', error);
      setReturnFeedStatus('failed');
      setIsReturnFeedStarted(false);
      toast({
        title: "Connection Failed",
        description: `Could not connect to return feed: ${feedStream}`,
        variant: "destructive",
      });
    }
  };

  const stopReturnFeed = () => {
    setReturnFeedStatus('disconnected');
    setIsReturnFeedStarted(false);
    if (playerVideoRef.current) {
      playerVideoRef.current.srcObject = null;
    }
    toast({
      title: "Return Feed Disconnected",
      description: "Return feed has been stopped",
    });
  };

  const togglePublishing = async () => {
    if (!isPublishing) {
      try {
        const result = await startPublishing(publisherVideoRef.current);
        setIsPublishing(true);
        setSessionId(result.sessionId || 'Connected');
        setAudioCodec('opus/48000/2');
        setVideoCodec('h264/720p@30fps');
        
        toast({
          title: "Success",
          description: "Stream started successfully",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: `Publishing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: "destructive",
        });
      }
    } else {
      stopPublishing();
      setIsPublishing(false);
      setSessionId('Not connected');
      setAudioCodec('-');
      setVideoCodec('-');
      
      toast({
        title: "Info",
        description: "Stream stopped",
      });
    }
  };

  const toggleChat = () => {
    setShowChat(!showChat);
  };

  // Show loading state while validating token
  if (isValidatingToken) {
    return (
      <div className="min-h-screen va-bg-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-va-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold va-text-primary mb-2">Validating Session</h2>
          <p className="va-text-secondary">Please wait while we verify your access...</p>
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
          <p className="va-text-secondary">This session link is no longer valid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold va-text-primary mb-2">Live Session</h1>
          <p className="va-text-secondary">Publish your stream and view the studio return feed</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Publisher Section */}
          <div className="va-bg-dark-surface rounded-2xl p-6 border va-border-dark">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold va-text-primary">Publisher</h3>
              <span className={`px-3 py-1 rounded-full text-sm ${
                isPublishing 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`} data-testid="status-publisher">
                {isPublishing ? 'Live' : 'Offline'}
              </span>
            </div>
            
            {/* Welcome Alert */}
            <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <i className="fas fa-info-circle text-blue-400 mt-1 mr-3"></i>
                <div>
                  <p className="text-blue-400 font-medium">Welcome to Virtual Audience</p>
                  <p className="text-blue-300 text-sm mt-1">Click <strong>Start Stream</strong> and allow video/audio access to begin broadcasting</p>
                </div>
              </div>
            </div>

            {/* Stream Control */}
            <Button 
              onClick={togglePublishing}
              className={`w-full font-semibold mb-4 ${
                isPublishing
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'va-bg-primary hover:va-bg-primary-dark text-va-dark-bg'
              }`}
              data-testid="button-toggle-stream"
            >
              <i className={`fas ${isPublishing ? 'fa-stop' : 'fa-video'} mr-2`}></i>
              {isPublishing ? 'Stop Stream' : 'Start Stream'}
            </Button>

            {/* Video Element */}
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-4">
              <video 
                ref={publisherVideoRef}
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover"
                style={{ display: isPublishing ? 'block' : 'none' }}
                data-testid="video-publisher"
              />
              {!isPublishing && (
                <div className="absolute inset-0 flex items-center justify-center va-bg-dark-surface-2">
                  <div className="text-center">
                    <i className="fas fa-video text-4xl text-gray-500 mb-4"></i>
                    <p className="va-text-secondary">Click Start Stream to begin</p>
                  </div>
                </div>
              )}
            </div>

            {/* Session Statistics */}
            <div className="va-bg-dark-surface-2 rounded-lg p-4 space-y-3">
              <h4 className="font-medium va-text-primary flex items-center">
                <i className="fas fa-chart-line mr-2 va-text-green"></i>
                Session Statistics
              </h4>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="va-text-secondary">Session ID:</span>
                  <span className="va-text-primary font-mono" data-testid="text-session-id">{sessionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="va-text-secondary">Audio Codec:</span>
                  <span className="va-text-primary font-mono" data-testid="text-audio-codec">{audioCodec}</span>
                </div>
                <div className="flex justify-between">
                  <span className="va-text-secondary">Video Codec:</span>
                  <span className="va-text-primary font-mono" data-testid="text-video-codec">{videoCodec}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Player Section */}
          <div className="va-bg-dark-surface rounded-2xl p-6 border va-border-dark">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold va-text-primary">Studio Return Feed</h3>
              <span 
                className={`px-3 py-1 rounded-full text-sm ${
                  returnFeedStatus === 'connected' 
                    ? 'bg-green-500/20 text-green-400'
                    : returnFeedStatus === 'connecting' || returnFeedStatus === 'retrying'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
                data-testid="status-player"
              >
                {returnFeedStatus === 'connected' && 'Connected'}
                {returnFeedStatus === 'connecting' && 'Connecting...'}
                {returnFeedStatus === 'retrying' && 'Retrying...'}
                {returnFeedStatus === 'failed' && 'Connection Failed'}
                {returnFeedStatus === 'disconnected' && 'Disconnected'}
              </span>
            </div>

            {/* Return Feed Control Button */}
            <Button 
              onClick={isReturnFeedStarted ? stopReturnFeed : startReturnFeed}
              className={`w-full font-semibold mb-4 ${
                isReturnFeedStarted
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'va-bg-primary hover:va-bg-primary-dark text-va-dark-bg'
              }`}
              data-testid="button-toggle-return-feed"
              disabled={returnFeedStatus === 'connecting'}
            >
              <i className={`fas ${isReturnFeedStarted ? 'fa-stop' : 'fa-play'} mr-2`}></i>
              {isReturnFeedStarted ? 'Stop Return Feed' : 'Start Return Feed'}
            </Button>

            {/* Return Video Element */}
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-4">
              <video 
                ref={playerVideoRef}
                autoPlay 
                muted 
                controls 
                playsInline 
                className="w-full h-full object-cover"
                data-testid="video-player"
              />
            </div>

            {/* Chat Container */}
            {showChat && (
              <div className="va-bg-dark-surface-2 rounded-lg overflow-hidden h-96" data-testid="container-chat">
                <div className="va-bg-dark-border p-3 border-b va-border-dark">
                  <h4 className="font-medium va-text-primary flex items-center">
                    <i className="fas fa-comments mr-2 va-text-green"></i>
                    Live Chat
                  </h4>
                </div>
                <iframe 
                  src="https://dev.blabb.me/room/pe9gg8" 
                  className="w-full h-full border-none"
                />
              </div>
            )}

            {/* Chat Toggle - only show if chat is enabled for this link */}
            {chatEnabled && !showChat && (
              <div className="text-center">
                <Button 
                  onClick={toggleChat}
                  variant="outline"
                  className="va-bg-dark-surface-2 hover:bg-gray-600 va-text-primary va-border-dark"
                  data-testid="button-show-chat"
                >
                  <i className="fas fa-comments mr-2"></i>
                  Show Chat
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
