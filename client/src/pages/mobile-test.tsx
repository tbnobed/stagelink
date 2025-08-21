import { useMobile } from '@/hooks/use-mobile';
import { MobileNav } from '@/components/mobile-nav';
import { Button } from '@/components/ui/button';

export default function MobileTest() {
  const { isMobile, isLandscape, screenSize } = useMobile();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Debug Panel */}
      <div className="p-4 bg-white dark:bg-gray-800 border-b">
        <h1 className="text-2xl font-bold mb-4">Mobile Detection Test</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 border rounded">
            <h3 className="font-semibold">Mobile Status</h3>
            <p className={`text-lg ${isMobile ? 'text-green-600' : 'text-red-600'}`}>
              {isMobile ? '✓ Mobile' : '✗ Desktop'}
            </p>
          </div>
          <div className="p-3 border rounded">
            <h3 className="font-semibold">Orientation</h3>
            <p className="text-lg">
              {isLandscape ? 'Landscape' : 'Portrait'}
            </p>
          </div>
          <div className="p-3 border rounded">
            <h3 className="font-semibold">Screen Size</h3>
            <p className="text-lg">
              {screenSize.width} × {screenSize.height}
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Test */}
      <MobileNav
        title="Mobile Test"
        onBack={() => console.log('Back clicked')}
        showChatButton={true}
        showFullscreenButton={true}
        chatEnabled={true}
        onToggleChat={() => console.log('Chat toggled')}
        onToggleFullscreen={() => console.log('Fullscreen toggled')}
      />

      {/* Content Area */}
      <div className={`p-4 ${isMobile ? 'mobile-layout' : ''}`}>
        <div className="max-w-md mx-auto space-y-4">
          <h2 className="text-xl font-semibold">Test Content</h2>
          
          <div className="mobile-only bg-green-100 dark:bg-green-900 p-4 rounded">
            <p className="text-green-800 dark:text-green-200">
              ✓ This shows only on mobile devices
            </p>
          </div>
          
          <div className="desktop-only bg-blue-100 dark:bg-blue-900 p-4 rounded">
            <p className="text-blue-800 dark:text-blue-200">
              ✓ This shows only on desktop
            </p>
          </div>
          
          <Button className="btn-touch w-full">
            Touch-Optimized Button
          </Button>

          <div className="p-4 border rounded">
            <h3 className="font-semibold mb-2">CSS Classes Applied:</h3>
            <ul className="text-sm space-y-1">
              {isMobile && <li className="text-green-600">• mobile-layout</li>}
              {isMobile && <li className="text-green-600">• swipe-container</li>}
              {!isMobile && <li className="text-blue-600">• desktop layout</li>}
            </ul>
          </div>

          <div className="p-4 border rounded">
            <h3 className="font-semibold mb-2">Body Classes:</h3>
            <p className="text-sm font-mono">
              {document.body.className || 'No classes'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}