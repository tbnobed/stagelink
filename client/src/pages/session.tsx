import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { initializeStreaming, startPublishing, stopPublishing, startPlayback } from "@/lib/streaming";
import { Chat } from "@/components/chat";
import { GuestChat } from "@/components/guest-chat";
import { MobileNav } from "@/components/mobile-nav";
import { MobileVideoControls } from "@/components/mobile-video-controls";
import { ConsentDialog } from "@/components/consent-dialog";
import { useMobile, useSwipeGestures } from "@/hooks/use-mobile";

type ProductionStatus = 'idle' | 'live' | 'waiting' | 'promoted';

export default function Session() {
  const [isPublishing, setIsPublishing] = useState(false);
  const [sessionId, setSessionId] = useState("Not connected");
  const [streamName, setStreamName] = useState<string | null>(null);
  const [audioCodec, setAudioCodec] = useState("-");
  const [videoCodec, setVideoCodec] = useState("-");
  const [showChat, setShowChat] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [returnFeedStatus, setReturnFeedStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed' | 'retrying'>('disconnected');
  const [isReturnFeedStarted, setIsReturnFeedStarted] = useState(false);
  const [guestUser, setGuestUser] = useState<any>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [consentGranted, setConsentGranted] = useState(false);
  // Production capacity management state
  const [productionId, setProductionId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [productionStatus, setProductionStatus] = useState<ProductionStatus>('idle');
  const [waitingPosition, setWaitingPosition] = useState<number>(0);
  const productionWsRef = useRef<WebSocket | null>(null);
  const publisherVideoRef = useRef<HTMLVideoElement>(null);
  const playerVideoRef = useRef<HTMLVideoElement>(null);
  // Separate ref for the return feed video inside the waiting room overlay
  const waitingReturnFeedRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isMobile } = useMobile();

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
      const assignedServer = urlParams.get('server');

      setStreamName(stream);
      setChatEnabled(chatEnabledParam);
      console.log('Stream name from URL:', stream);
      console.log('Chat enabled from URL:', chatEnabledParam);
      if (assignedServer) {
        console.log('Assigned WHIP server from URL:', assignedServer);
      }
      
      // Show chat by default if enabled
      if (chatEnabledParam) {
        setShowChat(true);
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
              description: "This link has expired or been used already. Please request a new link.",
              variant: "destructive",
            });
            setLocation('/');
            return;
          }
          
          setTokenValid(true);
          setLinkId(result.linkId);

          // Store production info if available
          if (result.productionId) {
            setProductionId(result.productionId);
          }
          const displayName = result.guestName || `Guest_${stream || 'User'}`;
          if (result.guestName) {
            setGuestName(result.guestName);
          }
          
          // Create a guest user context for chat
          setGuestUser({
            id: null, // Guest users don't have database IDs
            username: displayName,
            role: 'user'
          });
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

      initializeStreaming({
        stream: stream || 'obed2',
        returnStream: returnStream || stream || 'obed2',
        app: 'live',
        ...(assignedServer ? { assignedServer } : {}),
      });

      // Don't auto-start return feed, let user start it manually
      setReturnFeedStatus('disconnected');
    };

    validateTokenAndInitialize();
  }, [toast, setLocation]); // Proper dependencies

  // Production capacity management via WebSocket
  useEffect(() => {
    if (!productionId || !linkId || !consentGranted) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/chat`;
    const ws = new WebSocket(wsUrl);
    productionWsRef.current = ws;

    ws.onopen = () => {
      const sessionToken = new URLSearchParams(window.location.search).get('token');
      ws.send(JSON.stringify({
        type: 'production_join',
        productionId,
        linkId,
        guestName: guestName || 'Guest',
        sessionId: `prod-${productionId}`,
        ...(sessionToken ? { token: sessionToken } : {}),
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'production_status') {
          if (msg.status === 'live') {
            // Granted a live slot — update state and let the user manually start the stream.
            // The normal manual-start flow (togglePublishing) applies here. Auto-start only
            // happens when the server sends 'promoted' (waiting → live by admin action).
            setProductionStatus('live');
            setWaitingPosition(0);
          } else if (msg.status === 'waiting') {
            setProductionStatus('waiting');
            setWaitingPosition(msg.position || 0);
            // Flag that return feed should auto-start; effect below watches productionStatus
            // and fires startReturnFeed when status transitions to 'waiting'
          } else if (msg.status === 'promoted') {
            setProductionStatus('live');
            setWaitingPosition(0);
            toast({ title: "You're Live!", description: "A spot opened up — your stream is starting!" });
            // Auto-start WHIP publishing when promoted from waiting
            if (publisherVideoRef.current) {
              startPublishing(publisherVideoRef.current).then(result => {
                setIsPublishing(true);
                setSessionId(result.sessionId || 'Connected');
                setAudioCodec('opus/48000/2');
                setVideoCodec('h264/720p@30fps');
              }).catch(err => {
                console.error('Auto-publish on promotion failed:', err);
                toast({
                  title: "Stream Error",
                  description: "You were promoted but stream failed to start. Please click 'Start Stream' manually.",
                  variant: "destructive"
                });
              });
            }
          } else if (msg.status === 'signed_off') {
            // Server confirmed sign-off; guest is no longer tracked as live or waiting.
            // Set to 'idle' so they can re-enter the queue by clicking Start Stream again.
            setProductionStatus('idle');
            setWaitingPosition(0);
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      console.log('Production WS closed');
    };

    return () => {
      ws.close();
      productionWsRef.current = null;
    };
  }, [productionId, linkId, consentGranted, guestName, toast]);


  // Auto-start return feed when entering the waiting room
  useEffect(() => {
    if (productionStatus === 'waiting' && returnFeedStatus === 'disconnected') {
      startReturnFeed();
    }
    // On promotion (waiting → live), the overlay unmounts removing waitingReturnFeedRef.
    // Re-attach playback to the main playerVideoRef so the return feed remains audible/visible.
    if (productionStatus === 'live' && isReturnFeedStarted && playerVideoRef.current) {
      startReturnFeed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productionStatus]);

  const startReturnFeed = async () => {
    const targetRef = (productionId && productionStatus === 'waiting')
      ? waitingReturnFeedRef
      : playerVideoRef;
    if (!targetRef.current) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const returnStream = urlParams.get('return');
    const stream = urlParams.get('stream');
    const feedStream = returnStream || stream || 'obed2';
    
    setReturnFeedStatus('connecting');
    setIsReturnFeedStarted(true);
    
    try {
      await startPlayback(targetRef.current, feedStream);
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
    if (waitingReturnFeedRef.current) {
      waitingReturnFeedRef.current.srcObject = null;
    }
    if (playerVideoRef.current) {
      playerVideoRef.current.srcObject = null;
    }
    toast({
      title: "Return Feed Disconnected",
      description: "Return feed has been stopped",
    });
  };

  const handleConsentGranted = async () => {
    setConsentGranted(true);
    toast({
      title: "Authorization Accepted",
      description: "You may now access the session. Click Start Stream when ready.",
    });
  };

  const handleConsentDenied = () => {
    toast({
      title: "Authorization Required",
      description: "You must accept the Adult Likeness Authorization and Release to access this session.",
      variant: "destructive",
    });
    setLocation('/');
  };

  const togglePublishing = async () => {
    // Hard-block publishing when waiting for a production slot — covers all UI paths (desktop + mobile)
    if (productionId && productionStatus === 'waiting') {
      toast({
        title: "In Waiting Room",
        description: "You'll be moved to live automatically when a slot opens up.",
      });
      return;
    }
    if (!isPublishing) {
      // Block publishing until server grants a 'live' slot; enter/re-enter the queue otherwise
      if (productionId && productionStatus !== 'live') {
        if (productionWsRef.current?.readyState === WebSocket.OPEN) {
          const sessionToken = new URLSearchParams(window.location.search).get('token');
          productionWsRef.current.send(JSON.stringify({
            type: 'production_join',
            productionId,
            linkId,
            guestName: guestName || 'Guest',
            sessionId: `prod-${productionId}`,
            ...(sessionToken ? { token: sessionToken } : {}),
          }));
        } else {
          toast({
            title: "Connecting…",
            description: "Establishing production connection, please try again in a moment.",
          });
        }
        return;
      }
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

      // Notify production server that this guest has signed off (releases live slot)
      if (productionId && productionWsRef.current && productionWsRef.current.readyState === WebSocket.OPEN) {
        productionWsRef.current.send(JSON.stringify({
          type: 'production_leave_live',
          productionId,
          linkId,
          sessionId: `prod-${productionId}`,
        }));
      }
      
      toast({
        title: "Info",
        description: "Stream stopped",
      });
    }
  };

  const toggleChat = () => {
    console.log('Toggling chat, current showChat:', showChat);
    setShowChat(!showChat);
  };

  const toggleMute = () => {
    if (publisherVideoRef.current) {
      publisherVideoRef.current.muted = !publisherVideoRef.current.muted;
      setIsMuted(publisherVideoRef.current.muted);
    }
    if (playerVideoRef.current) {
      playerVideoRef.current.muted = !playerVideoRef.current.muted;
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.warn('Fullscreen error:', error);
    }
  };

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Mobile swipe gestures
  useSwipeGestures(
    () => {
      // Swipe left - toggle chat if enabled
      if (chatEnabled && isMobile) {
        setShowChat(true);
      }
    },
    () => {
      // Swipe right - close chat
      if (showChat && isMobile) {
        setShowChat(false);
      }
    },
    () => {
      // Swipe up - toggle fullscreen
      if (isMobile) {
        toggleFullscreen();
      }
    }
  );
  
  // Debug effect to log chat states
  useEffect(() => {
    console.log('Chat states - enabled:', chatEnabled, 'showChat:', showChat);
  }, [chatEnabled, showChat]);

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

  // Gate: show consent dialog as full-page blocker before any session content
  if (!consentGranted) {
    return (
      <div className="min-h-screen va-bg-dark">
        <ConsentDialog
          streamName={streamName || 'unknown'}
          guestIdentifier={guestUser?.username || undefined}
          onConsentGranted={handleConsentGranted}
          onConsentDenied={handleConsentDenied}
        />
      </div>
    );
  }

  const isInWaitingRoom = productionId !== null && productionStatus === 'waiting';

  return (
    <div ref={containerRef} className={`relative h-screen va-bg-dark flex flex-col swipe-container ${isMobile ? 'mobile-layout' : ''}`}>

      {/* Waiting Room Overlay — rendered on top when capacity is full; session layout stays mounted */}
      {isInWaitingRoom && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="text-center max-w-lg w-full">
            <div className="relative mx-auto w-24 h-24 mb-6">
              <div className="absolute inset-0 rounded-full bg-yellow-500/20 animate-ping" />
              <div className="relative rounded-full bg-yellow-500/10 border-2 border-yellow-500/50 w-full h-full flex items-center justify-center">
                <svg className="w-10 h-10 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold va-text-primary mb-2">You're in the waiting room</h2>
            <p className="va-text-secondary mb-4">
              {guestName ? `Hi ${guestName}!` : 'Hi there!'} The live session is currently full.
            </p>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
              <p className="text-yellow-300 text-sm font-medium">Your position in queue</p>
              <p className="text-5xl font-bold text-yellow-400 mt-1">#{waitingPosition}</p>
            </div>
            <p className="va-text-secondary text-sm mb-6">
              You'll automatically go live when a spot opens up. Keep this page open.
            </p>
            {/* Return feed shown prominently while waiting — uses dedicated ref separate from main player */}
            <div className="rounded-xl overflow-hidden border va-border-dark mb-3" style={{ aspectRatio: '16/9' }}>
              <video
                ref={waitingReturnFeedRef}
                autoPlay
                playsInline
                muted={isMuted}
                className="w-full h-full object-cover bg-black"
              />
            </div>
            {!isReturnFeedStarted && (
              <Button
                variant="outline"
                size="sm"
                onClick={startReturnFeed}
              >
                Watch Return Feed While You Wait
              </Button>
            )}
            {isReturnFeedStarted && (
              <p className="text-sm text-green-400 mt-1">Return feed is playing</p>
            )}
          </div>
        </div>
      )}

      {/* Mobile Navigation */}
      <MobileNav
        title={`Live Session - ${streamName || 'Stream'}`}
        onBack={() => setLocation('/')}
        onToggleChat={chatEnabled ? toggleChat : undefined}
        onToggleFullscreen={toggleFullscreen}
        showChatButton={chatEnabled}
        showFullscreenButton={true}
        isFullscreen={isFullscreen}
        chatEnabled={chatEnabled}
      />

      {/* Desktop Header */}
      <div className="desktop-only px-4 py-3 border-b va-border-dark flex items-center justify-center bg-va-dark-bg/50 backdrop-blur shrink-0">
        <div className="text-center">
          <h1 className="text-xl font-bold va-text-primary">Live Session</h1>
          <p className="va-text-secondary text-sm">Publish your stream and view the studio return feed</p>
        </div>
      </div>

      {/* Main Content - Full Height */}
      <div className={`flex-1 ${isMobile ? 'p-2' : 'p-4'}`}>
        <div className={`${isMobile ? 'flex flex-col gap-2' : 'grid lg:grid-cols-2 gap-4'} h-full`}>
          {/* Publisher Section */}
          <div className="va-bg-dark-surface rounded-xl border va-border-dark h-full flex flex-col">
            <div className={`flex items-center justify-between ${isMobile ? 'p-3' : 'p-4'} border-b va-border-dark desktop-only`}>
              <h3 className="text-lg font-semibold va-text-primary">Publisher</h3>
              <span className={`px-3 py-1 rounded-full text-sm ${
                isPublishing 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`} data-testid="status-publisher">
                {isPublishing ? 'Live' : 'Offline'}
              </span>
            </div>
            
            <div className={`flex-1 ${isMobile ? 'p-2' : 'p-4'} flex flex-col`}>
              {/* Mobile Video View */}
              {isMobile ? (
                <div className="mobile-video-container flex-1">
                  <video 
                    ref={publisherVideoRef} 
                    autoPlay 
                    muted 
                    playsInline
                    className="w-full h-full"
                    style={{ display: isPublishing ? 'block' : 'none' }}
                    data-testid="video-publisher"
                  />
                  {!isPublishing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                      <div className="text-center">
                        <i className="fas fa-video text-4xl text-gray-500 mb-4"></i>
                        <p className="va-text-secondary">Tap Start Stream to begin</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Mobile Controls Overlay */}
                  <MobileVideoControls
                    isPublishing={isPublishing}
                    isConnected={isPublishing}
                    onTogglePublishing={togglePublishing}
                    onToggleChat={chatEnabled ? toggleChat : undefined}
                    onToggleFullscreen={toggleFullscreen}
                    onToggleMute={toggleMute}
                    chatEnabled={chatEnabled}
                    isMuted={isMuted}
                    streamName={streamName || 'Publisher'}
                    showPublishingControls={true}
                  />
                </div>
              ) : (
                <>
                  {/* Desktop Welcome Alert */}
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
                    disabled={isInWaitingRoom}
                    title={isInWaitingRoom ? 'Waiting for an open slot in the production' : undefined}
                    className={`w-full font-semibold mb-4 ${
                      isPublishing
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'va-bg-primary hover:va-bg-primary-dark text-va-dark-bg'
                    }`}
                    data-testid="button-toggle-stream"
                  >
                    <i className={`fas ${isPublishing ? 'fa-stop' : 'fa-video'} mr-2`}></i>
                    {isInWaitingRoom ? 'Waiting for Slot...' : isPublishing ? 'Stop Stream' : 'Start Stream'}
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
                </>
              )}
            </div>
          </div>

          {/* Player Section */}
          <div className="va-bg-dark-surface rounded-xl border va-border-dark h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b va-border-dark">
              <h3 className="text-lg font-semibold va-text-primary">Studio Return Feed</h3>
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
            
            <div className="flex-1 p-4 flex flex-col">
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

              {/* Return Video Element - Takes remaining height */}
              <div className="relative bg-black rounded-lg overflow-hidden flex-1 min-h-0 mb-4">
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
            {showChat && linkId && guestUser && (
              <GuestChat 
                sessionId={linkId}
                enabled={showChat}
                guestUser={guestUser}
                className="h-96"
              />
            )}

            {/* Chat Toggle - only show if chat is enabled for this link */}
            {chatEnabled && !showChat && (
              <div className="text-center p-4 border-2 border-green-500">
                <p className="text-green-400 mb-2">Chat Available</p>
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
            
            {/* Chat hide button when showing */}
            {chatEnabled && showChat && (
              <div className="text-center mb-4">
                <Button 
                  onClick={toggleChat}
                  variant="outline"
                  size="sm"
                  className="va-bg-dark-surface-2 hover:bg-gray-600 va-text-primary va-border-dark"
                  data-testid="button-hide-chat"
                >
                  <i className="fas fa-times mr-2"></i>
                  Hide Chat
                </Button>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
