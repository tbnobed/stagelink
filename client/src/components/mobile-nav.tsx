import { ArrowLeft, MessageCircle, Settings, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileNavProps {
  title: string;
  onBack?: () => void;
  onToggleChat?: () => void;
  onToggleFullscreen?: () => void;
  showChatButton?: boolean;
  showFullscreenButton?: boolean;
  isFullscreen?: boolean;
  chatEnabled?: boolean;
}

export function MobileNav({ 
  title, 
  onBack, 
  onToggleChat, 
  onToggleFullscreen,
  showChatButton = false,
  showFullscreenButton = false,
  isFullscreen = false,
  chatEnabled = false 
}: MobileNavProps) {
  return (
    <div className="mobile-nav mobile-only" style={{ display: 'flex' }}>
      <div className="flex items-center gap-3">
        {onBack && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            className="btn-touch p-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold truncate" data-testid="text-title">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {showChatButton && chatEnabled && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onToggleChat}
            className="btn-touch p-2"
            data-testid="button-toggle-chat"
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
        )}
        
        {showFullscreenButton && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onToggleFullscreen}
            className="btn-touch p-2"
            data-testid="button-toggle-fullscreen"
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5" />
            ) : (
              <Maximize className="w-5 h-5" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}