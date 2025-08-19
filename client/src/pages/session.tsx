import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { initializeStreaming, startPublishing, stopPublishing, startPlayback } from "@/lib/streaming";

export default function Session() {
  const [isPublishing, setIsPublishing] = useState(false);
  const [sessionId, setSessionId] = useState("Not connected");
  const [audioCodec, setAudioCodec] = useState("-");
  const [videoCodec, setVideoCodec] = useState("-");
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{id: number, user: string, message: string, timestamp: Date}>>([]);
  const [newMessage, setNewMessage] = useState("");
  const [username, setUsername] = useState("Guest");
  const publisherVideoRef = useRef<HTMLVideoElement>(null);
  const playerVideoRef = useRef<HTMLVideoElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const stream = urlParams.get('stream');
    const returnStream = urlParams.get('return');
    const chatEnabled = urlParams.get('chat') === 'true';

    if (chatEnabled) {
      setShowChat(true);
      // Add welcome message
      setChatMessages([
        {
          id: 1,
          user: "System",
          message: "Welcome to the live chat! Share your thoughts and questions here.",
          timestamp: new Date()
        }
      ]);
    }

    // Initialize streaming
    initializeStreaming({
      stream: stream || 'obed2',
      returnStream: returnStream || stream || 'obed2',
      app: 'live'
    });

    // Start playback immediately
    if (playerVideoRef.current) {
      startPlayback(playerVideoRef.current, returnStream || stream || 'obed2');
    }
  }, []);

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

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    
    const message = {
      id: Date.now(),
      user: username,
      message: newMessage.trim(),
      timestamp: new Date()
    };
    
    setChatMessages(prev => [...prev, message]);
    setNewMessage("");
    
    // Auto-scroll to bottom
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

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
              <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm" data-testid="status-player">
                Connected
              </span>
            </div>

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
                
                {/* Chat Messages */}
                <div 
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto p-3 space-y-3 h-72"
                  style={{ maxHeight: '280px' }}
                >
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="flex flex-col">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`text-sm font-medium ${
                          msg.user === 'System' ? 'va-text-green' : 'text-blue-400'
                        }`}>
                          {msg.user}
                        </span>
                        <span className="text-xs va-text-secondary">
                          {msg.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="va-text-primary text-sm bg-va-dark-bg rounded px-3 py-2">
                        {msg.message}
                      </div>
                    </div>
                  ))}
                  {chatMessages.length === 0 && (
                    <div className="text-center va-text-secondary py-8">
                      <i className="fas fa-comments text-2xl mb-2"></i>
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  )}
                </div>
                
                {/* Chat Input */}
                <div className="p-3 border-t va-border-dark">
                  <div className="flex space-x-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Type a message..."
                      className="flex-1 va-bg-dark-bg va-border-dark va-text-primary placeholder:text-gray-500 focus:ring-va-primary focus:border-transparent"
                      data-testid="input-chat-message"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                      className="va-bg-primary hover:va-bg-primary-dark text-va-dark-bg px-4"
                      data-testid="button-send-message"
                    >
                      <i className="fas fa-paper-plane"></i>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Chat Toggle */}
            {!showChat && (
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
