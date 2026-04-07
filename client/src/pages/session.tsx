import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { initializeStreaming, startPublishing, stopPublishing, startPlayback } from "@/lib/streaming";
import { Chat } from "@/components/chat";
import { GuestChat } from "@/components/guest-chat";
import { ProductionPublicChat } from "@/components/production-public-chat";
import { MobileNav } from "@/components/mobile-nav";
import { MobileVideoControls } from "@/components/mobile-video-controls";
import { ConsentDialog } from "@/components/consent-dialog";
import { useMobile, useSwipeGestures } from "@/hooks/use-mobile";
import type { ChatMessage } from "@shared/schema";

type ProductionStatus = 'idle' | 'live' | 'waiting' | 'promoted';

export default function Session() {
  const [isPublishing, setIsPublishing] = useState(false);
  const [sessionId, setSessionId] = useState("Not connected");
  const [streamName, setStreamName] = useState<string | null>(null);
  const [audioCodec, setAudioCodec] = useState("-");
  const [videoCodec, setVideoCodec] = useState("-");
  const [showChat, setShowChat] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(false);
  const [chatTab, setChatTab] = useState<'group' | 'private'>('group');
  const [privateUnread, setPrivateUnread] = useState(0);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [returnFeedStatus, setReturnFeedStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed' | 'retrying'>('disconnected');
  const [isReturnFeedStarted, setIsReturnFeedStarted] = useState(false);
  const [guestUser, setGuestUser] = useState<any>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isWaitingFeedMuted, setIsWaitingFeedMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [consentGranted, setConsentGranted] = useState(false);
  // Production capacity management state
  const [productionId, setProductionId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [productionStatus, setProductionStatus] = useState<ProductionStatus>('idle');
  const [waitingPosition, setWaitingPosition] = useState<number>(0);
  // Gate: production hasn't been started by admin yet
  const [awaitingProductionStart, setAwaitingProductionStart] = useState(false);
  // Gate: production has already ended
  const [productionEnded, setProductionEnded] = useState(false);
  const [productionName, setProductionName] = useState<string | null>(null);
  const productionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const productionWsRef = useRef<WebSocket | null>(null);
  const publisherVideoRef = useRef<HTMLVideoElement>(null);
  const playerVideoRef = useRef<HTMLVideoElement>(null);
  // Separate ref for the return feed video inside the waiting room overlay
  const waitingReturnFeedRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef(false);
  // Looked-up from the database on mount — the WHIP server this stream was assigned to.
  const assignedWhipServerRef = useRef<string | null>(null);
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

      // Look up the assigned WHIP server from the database — this is the
      // authoritative source, not the URL param which may be missing on old links.
      if (stream) {
        try {
          const srvRes = await fetch(`/api/links/assigned-server?stream=${encodeURIComponent(stream)}`);
          if (srvRes.ok) {
            const srvData = await srvRes.json();
            if (srvData.assignedServer) {
              assignedWhipServerRef.current = srvData.assignedServer;
              console.log('Assigned WHIP server (from DB):', srvData.assignedServer);
            }
          }
        } catch (e) {
          // Non-fatal — fall back to URL param if lookup fails
          console.warn('Could not look up assigned WHIP server:', e);
        }
      }
      // URL param fallback for links generated before DB lookup was added
      if (!assignedWhipServerRef.current && assignedServer) {
        assignedWhipServerRef.current = assignedServer;
        console.log('Assigned WHIP server (from URL param):', assignedServer);
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
            // Store production name for waiting screen
            if (result.productionName) setProductionName(result.productionName);
            // Gate guests based on production status
            if (result.productionStatus === 'draft') {
              setAwaitingProductionStart(true);
            } else if (result.productionStatus === 'ended') {
              setProductionEnded(true);
            }
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
          } else if (msg.status === 'kicked') {
            stopPublishing();
            setIsPublishing(false);
            setProductionStatus('idle');
            setWaitingPosition(0);
            toast({
              title: "Disconnected by Admin",
              description: "You have been removed from this production by an administrator.",
              variant: "destructive",
            });
          } else if (msg.status === 'signed_off') {
            // Server confirmed sign-off; guest is no longer tracked as live or waiting.
            // Set to 'idle' so they can re-enter the queue by clicking Start Stream again.
            setProductionStatus('idle');
            setWaitingPosition(0);
          }
        } else if (msg.type === 'production_ended') {
          // Admin ended the production — stop any active stream and show the ended screen
          stopPublishing();
          setIsPublishing(false);
          setProductionStatus('idle');
          setProductionEnded(true);
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


  // Poll production status while the guest is waiting for the production to start.
  // Clears automatically once the production becomes active (or ended).
  useEffect(() => {
    if (!awaitingProductionStart || !productionId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/productions/${productionId}/public-status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'active') {
          setAwaitingProductionStart(false);
          if (data.name) setProductionName(data.name);
        } else if (data.status === 'ended') {
          setAwaitingProductionStart(false);
          setProductionEnded(true);
          if (data.name) setProductionName(data.name);
        }
      } catch {}
    };

    poll(); // immediate first check
    productionPollRef.current = setInterval(poll, 6000);
    return () => {
      if (productionPollRef.current) {
        clearInterval(productionPollRef.current);
        productionPollRef.current = null;
      }
    };
  }, [awaitingProductionStart, productionId]);

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
    const returnServer = urlParams.get('returnServer') || undefined;
    const returnFallbackServer = urlParams.get('returnFallbackServer') || undefined;
    const returnFallbackServer2 = urlParams.get('returnFallbackServer2') || undefined;
    // Use the DB-looked-up assigned WHIP server (stored in ref on mount).
    // Falls back to the URL param for backward compat with old links.
    const assignedServer = assignedWhipServerRef.current || urlParams.get('server') || undefined;
    const serverForPlayback = returnServer || (!returnStream ? assignedServer : undefined);
    console.log('startReturnFeed: assignedServer=', assignedServer, 'returnServer=', returnServer, 'serverForPlayback=', serverForPlayback, 'fallback=', returnFallbackServer, 'fallback2=', returnFallbackServer2);

    setReturnFeedStatus('connecting');
    setIsReturnFeedStarted(true);
    
    try {
      await startPlayback(targetRef.current, feedStream, 5, serverForPlayback, returnFallbackServer, returnFallbackServer2);
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

  const audioCtxRef = useRef<AudioContext | null>(null);
  const playNotificationSound = useCallback(() => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }, []);

  const handlePrivateMessage = useCallback((message: ChatMessage) => {
    const isPrivateTabActive = chatTab === 'private' && showChat;
    if (!isPrivateTabActive) {
      setPrivateUnread(prev => prev + 1);
    }
    playNotificationSound();
    toast({
      title: `Message from ${message.senderName}`,
      description: message.content.length > 80
        ? message.content.slice(0, 80) + '…'
        : message.content,
    });
  }, [chatTab, showChat, playNotificationSound, toast]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (playerVideoRef.current) playerVideoRef.current.muted = next;
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

  // Gate: production has already ended
  if (productionEnded) {
    return (
      <div className="min-h-screen va-bg-dark flex items-center justify-center p-6">
        <div className="text-center max-w-md w-full">
          <div className="relative mx-auto w-24 h-24 mb-6">
            <div className="relative rounded-full bg-slate-500/10 border-2 border-slate-500/40 w-full h-full flex items-center justify-center">
              <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
              </svg>
            </div>
          </div>
          {productionName && (
            <p className="text-slate-400 text-sm font-medium uppercase tracking-widest mb-2">{productionName}</p>
          )}
          <h2 className="text-2xl font-bold va-text-primary mb-3">Production Ended</h2>
          <p className="va-text-secondary">
            This production has concluded. Thank you for participating.
          </p>
        </div>
      </div>
    );
  }

  // Gate: production hasn't been started by admin yet — show holding screen and poll
  if (awaitingProductionStart) {
    return (
      <div className="min-h-screen va-bg-dark flex items-center justify-center p-6">
        <div className="text-center max-w-md w-full">
          <div className="relative mx-auto w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
            <div className="relative rounded-full bg-blue-500/10 border-2 border-blue-500/40 w-full h-full flex items-center justify-center">
              <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              </svg>
            </div>
          </div>
          {productionName && (
            <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-2">{productionName}</p>
          )}
          <h2 className="text-2xl font-bold va-text-primary mb-3">Standby</h2>
          <p className="va-text-secondary mb-6">
            The production hasn't started yet. You'll be let in automatically as soon as it begins — no need to refresh.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm va-text-secondary">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Waiting for production to start…
          </div>
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
          <div className="w-full max-w-5xl flex flex-col lg:flex-row items-center gap-6">

            {/* Left panel: status info */}
            <div className="text-center lg:text-left lg:w-72 flex-shrink-0">
              <div className="relative mx-auto lg:mx-0 w-20 h-20 mb-4">
                <div className="absolute inset-0 rounded-full bg-yellow-500/20 animate-ping" />
                <div className="relative rounded-full bg-yellow-500/10 border-2 border-yellow-500/50 w-full h-full flex items-center justify-center">
                  <svg className="w-9 h-9 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold va-text-primary mb-2">You're in the waiting room</h2>
              <p className="va-text-secondary mb-4 text-sm">
                {guestName ? `Hi ${guestName}!` : 'Hi there!'} The live session is currently full.
              </p>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
                <p className="text-yellow-300 text-sm font-medium">Your position in queue</p>
                <p className="text-5xl font-bold text-yellow-400 mt-1">#{waitingPosition}</p>
              </div>
              <p className="va-text-secondary text-xs">
                You'll automatically go live when a spot opens up. Keep this page open.
              </p>
            </div>

            {/* Right panel: return feed video — 2× larger */}
            <div className="flex-1 w-full min-w-0">
              <div className="rounded-xl overflow-hidden border va-border-dark relative" style={{ aspectRatio: '16/9' }}>
                <video
                  ref={waitingReturnFeedRef}
                  autoPlay
                  playsInline
                  muted={isWaitingFeedMuted}
                  className="w-full h-full object-cover bg-black"
                />
                {isReturnFeedStarted && (
                  <button
                    onClick={() => {
                      const next = !isWaitingFeedMuted;
                      setIsWaitingFeedMuted(next);
                      if (waitingReturnFeedRef.current) waitingReturnFeedRef.current.muted = next;
                    }}
                    className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition"
                    title={isWaitingFeedMuted ? 'Unmute return feed' : 'Mute return feed'}
                  >
                    <i className={`fas ${isWaitingFeedMuted ? 'fa-volume-mute' : 'fa-volume-up'} text-sm`} />
                  </button>
                )}
              </div>
              <div className="mt-2 text-center">
                {!isReturnFeedStarted && (
                  <Button variant="outline" size="sm" onClick={startReturnFeed}>
                    Watch Return Feed While You Wait
                  </Button>
                )}
                {isReturnFeedStarted && (
                  <p className="text-sm text-green-400">Return feed is playing {isWaitingFeedMuted ? '(muted — click 🔇 to unmute)' : ''}</p>
                )}
              </div>
            </div>

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
      <div className={`flex-1 min-h-0 ${isMobile ? 'p-2' : 'p-4'}`}>
        {isMobile ? (
          /* ── MOBILE LAYOUT ── */
          <div className="flex flex-col gap-2 h-full">
            <div className="va-bg-dark-surface rounded-xl border va-border-dark flex flex-col">
              <div className="mobile-video-container flex-1 relative">
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
            </div>
          </div>
        ) : (
          /* ── DESKTOP LAYOUT ── left narrow column + dominant return feed */
          <div className="grid h-full gap-4" style={{ gridTemplateColumns: '320px 1fr' }}>

            {/* ── LEFT COLUMN: Publisher + Stats + Chat ── */}
            <div className="flex flex-col gap-3 min-h-0">

              {/* Publisher block */}
              <div className="va-bg-dark-surface rounded-xl border va-border-dark flex flex-col shrink-0">
                <div className="flex items-center justify-between px-3 py-2 border-b va-border-dark">
                  <h3 className="text-sm font-semibold va-text-primary">Publisher</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${isPublishing ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                    data-testid="status-publisher"
                  >
                    {isPublishing ? 'Live' : 'Offline'}
                  </span>
                </div>

                <div className="p-3 flex flex-col gap-2">
                  {/* Compact personalized welcome */}
                  <p className="text-xs text-blue-300 leading-snug">
                    Welcome, <span className="font-semibold text-blue-200">{guestName || 'Guest'}</span>
                    {' '}— click <strong>Start Stream</strong> to begin broadcasting.
                  </p>

                  {/* Stream control */}
                  <Button
                    onClick={togglePublishing}
                    disabled={isInWaitingRoom}
                    title={isInWaitingRoom ? 'Waiting for an open slot in the production' : undefined}
                    className={`w-full text-sm font-semibold ${isPublishing ? 'bg-red-500 hover:bg-red-600 text-white' : 'va-bg-primary hover:va-bg-primary-dark text-va-dark-bg'}`}
                    data-testid="button-toggle-stream"
                  >
                    <i className={`fas ${isPublishing ? 'fa-stop' : 'fa-video'} mr-2`}></i>
                    {isInWaitingRoom ? 'Waiting for Slot...' : isPublishing ? 'Stop Stream' : 'Start Stream'}
                  </Button>

                  {/* Publisher video (compact) */}
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
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
                          <i className="fas fa-video text-xl text-gray-500 mb-2"></i>
                          <p className="va-text-secondary text-xs">Click Start Stream to begin</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Compact Session Statistics */}
                  <div className="border-t va-border-dark pt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                    <span className="va-text-secondary">Session</span>
                    <span className="va-text-primary font-mono truncate" data-testid="text-session-id">{sessionId}</span>
                    <span className="va-text-secondary">Audio</span>
                    <span className="va-text-primary font-mono" data-testid="text-audio-codec">{audioCodec}</span>
                    <span className="va-text-secondary">Video</span>
                    <span className="va-text-primary font-mono" data-testid="text-video-codec">{videoCodec}</span>
                  </div>
                </div>
              </div>

              {/* Chat section — fills remaining left-column height */}
              {(productionId || chatEnabled) && guestUser && (
                <div className="va-bg-dark-surface rounded-xl border va-border-dark flex-1 flex flex-col min-h-0 overflow-hidden">
                  {/* Tab header */}
                  <div className="flex items-center gap-1 px-2 py-1.5 border-b va-border-dark shrink-0">
                    {productionId && (
                      <button
                        onClick={() => setChatTab('group')}
                        className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
                          chatTab === 'group'
                            ? 'bg-blue-600 text-white'
                            : 'va-text-secondary hover:va-text-primary'
                        }`}
                      >
                        <i className="fas fa-users mr-1"></i>Group Chat
                      </button>
                    )}
                    {chatEnabled && (
                      <button
                        onClick={() => { setChatTab('private'); setPrivateUnread(0); }}
                        className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors relative ${
                          chatTab === 'private'
                            ? 'bg-gray-600 text-white'
                            : 'va-text-secondary hover:va-text-primary'
                        }`}
                      >
                        <i className="fas fa-lock mr-1"></i>Private
                        {privateUnread > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
                            {privateUnread > 99 ? '99+' : privateUnread}
                          </span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Group chat panel */}
                  {chatTab === 'group' && productionId && (
                    <ProductionPublicChat
                      productionId={productionId}
                      guestUser={guestUser}
                      className="flex-1 min-h-0"
                    />
                  )}

                  {/* Private chat panel — always mounted to keep WS alive for notifications */}
                  {chatEnabled && linkId && (
                    <GuestChat
                      sessionId={linkId}
                      enabled={true}
                      guestUser={guestUser}
                      className={`flex-1 min-h-0 ${chatTab !== 'private' ? 'hidden' : ''}`}
                      onNewPrivateMessage={handlePrivateMessage}
                    />
                  )}
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN: Studio Return Feed (dominant) ── */}
            <div className="va-bg-dark-surface rounded-xl border va-border-dark flex flex-col min-h-0">
              <div className="flex items-center justify-between px-4 py-3 border-b va-border-dark shrink-0">
                <h3 className="text-lg font-semibold va-text-primary">Studio Return Feed</h3>
                <div className="flex items-center gap-3">
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
                    {returnFeedStatus === 'failed' && 'Failed'}
                    {returnFeedStatus === 'disconnected' && 'Disconnected'}
                  </span>
                  <Button
                    onClick={isReturnFeedStarted ? stopReturnFeed : startReturnFeed}
                    size="sm"
                    className={`font-semibold ${isReturnFeedStarted ? 'bg-red-500 hover:bg-red-600 text-white' : 'va-bg-primary hover:va-bg-primary-dark text-va-dark-bg'}`}
                    data-testid="button-toggle-return-feed"
                    disabled={returnFeedStatus === 'connecting'}
                  >
                    <i className={`fas ${isReturnFeedStarted ? 'fa-stop' : 'fa-play'} mr-1.5`}></i>
                    {isReturnFeedStarted ? 'Stop' : 'Start Return Feed'}
                  </Button>
                </div>
              </div>

              {/* Return feed video — takes ALL remaining height */}
              <div className="relative bg-black rounded-b-xl overflow-hidden flex-1 min-h-0">
                <video
                  ref={playerVideoRef}
                  autoPlay
                  muted={isMuted}
                  playsInline
                  className="w-full h-full object-contain"
                  data-testid="video-player"
                />
                {!isReturnFeedStarted && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center va-bg-dark-surface-2">
                    <i className="fas fa-tv text-5xl text-gray-600 mb-4"></i>
                    <p className="va-text-secondary text-base">Click <strong>Start Return Feed</strong> to connect</p>
                  </div>
                )}
                <button
                  onClick={toggleMute}
                  className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 transition"
                  title={isMuted ? 'Unmute return feed' : 'Mute return feed'}
                  data-testid="button-toggle-mute"
                >
                  <i className={`fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'}`} />
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
