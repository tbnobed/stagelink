import { useState } from 'react';
import { Play, Pause, Volume2, VolumeX, MessageCircle, Maximize, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAutoHideControls } from '@/hooks/use-mobile';

interface MobileVideoControlsProps {
  isPublishing?: boolean;
  isConnected?: boolean;
  onTogglePublishing?: () => void;
  onToggleChat?: () => void;
  onToggleFullscreen?: () => void;
  onToggleMute?: () => void;
  chatEnabled?: boolean;
  isMuted?: boolean;
  streamName?: string;
  showPublishingControls?: boolean;
}

export function MobileVideoControls({
  isPublishing = false,
  isConnected = false,
  onTogglePublishing,
  onToggleChat,
  onToggleFullscreen,
  onToggleMute,
  chatEnabled = false,
  isMuted = false,
  streamName = "",
  showPublishingControls = false
}: MobileVideoControlsProps) {
  const { showControls, showAndHideControls, keepControlsVisible } = useAutoHideControls(4000);

  return (
    <div 
      className={`mobile-controls ${!showControls ? 'hidden' : ''}`}
      onTouchStart={showAndHideControls}
      onMouseMove={showAndHideControls}
      onMouseEnter={keepControlsVisible}
      onClick={showAndHideControls}
    >
      {/* Left side - Stream info */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-white text-sm font-medium truncate" data-testid="text-stream-name">
            {streamName || 'Stream'}
          </span>
        </div>
        {isPublishing && (
          <div className="flex items-center gap-1 px-2 py-1 bg-red-600 rounded-full">
            <Radio className="w-3 h-3 text-white" />
            <span className="text-white text-xs font-medium">LIVE</span>
          </div>
        )}
      </div>

      {/* Right side - Controls */}
      <div className="flex items-center gap-2">
        {onToggleMute && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMute}
            className="btn-touch p-2 text-white hover:bg-white/20"
            data-testid="button-toggle-mute"
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </Button>
        )}

        {chatEnabled && onToggleChat && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleChat}
            className="btn-touch p-2 text-white hover:bg-white/20"
            data-testid="button-open-chat"
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
        )}

        {showPublishingControls && onTogglePublishing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onTogglePublishing}
            className="btn-touch p-2 text-white hover:bg-white/20"
            data-testid="button-toggle-publishing"
          >
            {isPublishing ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </Button>
        )}

        {onToggleFullscreen && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleFullscreen}
            className="btn-touch p-2 text-white hover:bg-white/20"
            data-testid="button-fullscreen"
          >
            <Maximize className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}