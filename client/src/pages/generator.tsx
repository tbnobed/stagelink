import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";

export default function Generator() {
  const [streamName, setStreamName] = useState("");
  const [returnFeed, setReturnFeed] = useState("studio1");
  const [enableChat, setEnableChat] = useState(true);
  const [expirationOption, setExpirationOption] = useState("never");
  const [customHours, setCustomHours] = useState("24");
  const [generatedLink, setGeneratedLink] = useState("");
  const [shortLink, setShortLink] = useState("");
  const [showQR, setShowQR] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const generateLink = async () => {
    if (!streamName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a stream name.",
        variant: "destructive",
      });
      return;
    }

    const baseURL = `${window.location.protocol}//${window.location.host}/session`;
    const url = `${baseURL}?stream=${encodeURIComponent(streamName.trim())}&return=${encodeURIComponent(returnFeed)}&chat=${enableChat}`;
    
    // Calculate expiration date
    let expiresAt: Date | undefined = undefined;
    if (expirationOption !== "never") {
      const now = new Date();
      const hours = expirationOption === "custom" ? parseInt(customHours) : parseInt(expirationOption);
      expiresAt = new Date(now.getTime() + (hours * 60 * 60 * 1000));
    }
    
    try {
      // Create both regular link and short link
      const [regularResponse, shortResponse] = await Promise.all([
        // Save regular link
        fetch('/api/links', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: Date.now().toString(),
            streamName: streamName.trim(),
            returnFeed: returnFeed,
            chatEnabled: enableChat,
            url: url,
            expiresAt: expiresAt || null
          }),
        }),
        // Create short link
        fetch('/api/short-links', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            streamName: streamName.trim(),
            returnFeed: returnFeed,
            chatEnabled: enableChat,
            expiresAt: expiresAt || null
          }),
        })
      ]);

      if (!regularResponse.ok || !shortResponse.ok) {
        throw new Error('Failed to save link');
      }

      const shortLinkData = await shortResponse.json();
      const shortUrl = `${window.location.protocol}//${window.location.host}/s/${shortLinkData.id}`;

      setGeneratedLink(url);
      setShortLink(shortUrl);
      setShowQR(false);

      toast({
        title: "Links Generated",
        description: "Both regular and short links created",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save link to server",
        variant: "destructive",
      });
      return;
    }
  };

  const copyToClipboard = async (linkToCopy?: string) => {
    const linkToUse = linkToCopy || shortLink || generatedLink;
    if (!linkToUse) {
      toast({
        title: "Error",
        description: "Please generate a link first.",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(linkToUse);
      toast({
        title: "Success",
        description: "Link copied to clipboard!",
      });
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = linkToUse;
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

  const generateQRCode = async () => {
    const linkForQR = shortLink || generatedLink;
    if (!linkForQR) {
      toast({
        title: "Error",
        description: "Please generate a link first.",
        variant: "destructive",
      });
      return;
    }

    // Wait for next tick to ensure canvas is in DOM
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const canvas = qrCanvasRef.current;
    if (!canvas) {
      toast({
        title: "Error",
        description: "Canvas element not found. Please try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      await QRCode.toCanvas(canvas, linkForQR, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setShowQR(true);
      toast({
        title: "Success",
        description: "QR code generated successfully!",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Error generating QR code",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold va-text-primary mb-2">Guest Link Generator</h1>
          <p className="va-text-secondary">Create custom streaming links for your guests with studio return feeds</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Generator Form */}
          <div className="va-bg-dark-surface rounded-2xl p-8 border va-border-dark">
            <h3 className="text-xl font-semibold va-text-primary mb-6">Configuration</h3>
            
            <div className="space-y-6">
              {/* Guest Stream Name */}
              <div>
                <Label htmlFor="streamName" className="va-text-secondary">
                  Guest Stream Name
                </Label>
                <Input
                  id="streamName"
                  type="text"
                  placeholder="e.g. guest1"
                  value={streamName}
                  onChange={(e) => setStreamName(e.target.value)}
                  className="va-bg-dark-surface-2 va-border-dark va-text-primary placeholder:text-gray-500 focus:ring-va-primary focus:border-transparent mt-2"
                  data-testid="input-stream-name"
                />
              </div>

              {/* Studio Return Feed */}
              <div>
                <Label htmlFor="returnFeed" className="va-text-secondary">
                  Studio Return Feed
                </Label>
                <Select value={returnFeed} onValueChange={setReturnFeed}>
                  <SelectTrigger className="va-bg-dark-surface-2 va-border-dark va-text-primary focus:ring-va-primary focus:border-transparent mt-2" data-testid="select-return-feed">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="va-bg-dark-surface-2 va-border-dark">
                    <SelectItem value="livestream1">Studio 1 (Main)</SelectItem>
                    <SelectItem value="livestream2">Studio 2 (Backup)</SelectItem>
                    <SelectItem value="livestream3">Studio 3 (Guest)</SelectItem>
                    <SelectItem value="livestream5">Studio 4 (Archive)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Chat Toggle */}
              <div className="flex items-center justify-between p-4 va-bg-dark-surface-2 rounded-lg border va-border-dark">
                <div>
                  <Label htmlFor="enableChat" className="va-text-primary">Enable Chat</Label>
                  <p className="text-xs va-text-secondary mt-1">Allow real-time chat during the session</p>
                </div>
                <Switch
                  id="enableChat"
                  checked={enableChat}
                  onCheckedChange={setEnableChat}
                  className="data-[state=checked]:bg-va-primary"
                  data-testid="switch-enable-chat"
                />
              </div>

              {/* Link Expiration */}
              <div>
                <Label className="va-text-secondary">Link Expiration</Label>
                <div className="mt-2 space-y-3">
                  <Select value={expirationOption} onValueChange={setExpirationOption}>
                    <SelectTrigger className="va-bg-dark-surface-2 va-border-dark va-text-primary focus:ring-va-primary focus:border-transparent" data-testid="select-expiration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="va-bg-dark-surface-2 va-border-dark">
                      <SelectItem value="never">Never expires</SelectItem>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="6">6 hours</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="72">3 days</SelectItem>
                      <SelectItem value="168">1 week</SelectItem>
                      <SelectItem value="custom">Custom duration</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {expirationOption === "custom" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="8760"
                        value={customHours}
                        onChange={(e) => setCustomHours(e.target.value)}
                        className="va-bg-dark-surface-2 va-border-dark va-text-primary focus:ring-va-primary focus:border-transparent"
                        placeholder="Hours"
                        data-testid="input-custom-hours"
                      />
                      <span className="va-text-secondary text-sm">hours</span>
                    </div>
                  )}
                  
                  <p className="text-xs va-text-secondary">
                    {expirationOption === "never" 
                      ? "Link will remain active indefinitely" 
                      : `Link will expire ${
                          expirationOption === "custom" 
                            ? `in ${customHours} hours` 
                            : `in ${expirationOption} hour${expirationOption !== "1" ? "s" : ""}`
                        }`
                    }
                  </p>
                </div>
              </div>

              {/* Generate Button */}
              <Button 
                onClick={generateLink}
                className="w-full va-bg-primary hover:va-bg-primary-dark text-va-dark-bg font-semibold"
                data-testid="button-generate-link"
              >
                <i className="fas fa-link mr-2"></i>
                Generate Link
              </Button>
            </div>
          </div>

          {/* Generated Output */}
          <div className="va-bg-dark-surface rounded-2xl p-8 border va-border-dark">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold va-text-primary">Generated Link</h3>
              <a 
                href="/links" 
                className="text-sm va-text-green hover:underline flex items-center"
                data-testid="link-view-all"
              >
                <i className="fas fa-list mr-2"></i>
                View All Links
              </a>
            </div>
            
            <div className="space-y-6">
              {/* Short Link Output */}
              {shortLink && (
                <div>
                  <Label htmlFor="shortLink" className="va-text-secondary">
                    Short Link (Recommended)
                  </Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="shortLink"
                      readOnly
                      value={shortLink}
                      className="va-bg-dark-bg va-border-dark va-text-green font-mono text-sm focus:ring-va-primary/50"
                      data-testid="input-short-link"
                    />
                    <Button 
                      onClick={() => copyToClipboard(shortLink)}
                      variant="outline"
                      size="sm"
                      className="border-va-primary va-text-green hover:va-bg-primary hover:text-va-dark-bg"
                      data-testid="button-copy-short-link"
                    >
                      <i className="fas fa-copy"></i>
                    </Button>
                  </div>
                </div>
              )}

              {/* Full Link Output */}
              <div>
                <Label htmlFor="generatedLink" className="va-text-secondary">
                  {shortLink ? 'Full Link (Debug)' : 'Guest Session URL'}
                </Label>
                <Textarea
                  id="generatedLink"
                  rows={shortLink ? 3 : 4}
                  readOnly
                  value={generatedLink}
                  placeholder="Generated link will appear here..."
                  className="va-bg-dark-bg va-border-dark va-text-green font-mono text-sm placeholder:text-gray-500 focus:ring-va-primary/50 resize-none mt-2"
                  data-testid="textarea-generated-link"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <Button 
                  onClick={() => copyToClipboard()}
                  variant="outline"
                  className="flex-1 border-va-primary va-text-green hover:va-bg-primary hover:text-va-dark-bg"
                  data-testid="button-copy-link"
                >
                  <i className="fas fa-copy mr-2"></i>
                  Copy {shortLink ? 'Short' : ''} Link
                </Button>
                <Button 
                  onClick={generateQRCode}
                  variant="outline"
                  className="flex-1 va-bg-dark-surface-2 hover:bg-gray-600 va-text-primary va-border-dark"
                  data-testid="button-generate-qr"
                >
                  <i className="fas fa-qrcode mr-2"></i>
                  QR Code
                </Button>
              </div>

              {/* QR Code Display */}
              <div className="text-center" data-testid="qr-code-container">
                <div className="bg-white p-4 rounded-lg inline-block" style={{ display: showQR ? 'inline-block' : 'none' }}>
                  <canvas ref={qrCanvasRef}></canvas>
                </div>
                {showQR && (
                  <p className="va-text-secondary text-sm mt-2">Scan to open guest session</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
