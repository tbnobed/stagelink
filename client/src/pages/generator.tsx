import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";
import { InviteDialog } from "@/components/invite-dialog";

export default function Generator() {
  // Guest Session Link States
  const [streamName, setStreamName] = useState("");
  const [returnFeed, setReturnFeed] = useState("studio1");
  const [enableChat, setEnableChat] = useState(true);
  const [expirationOption, setExpirationOption] = useState("never");
  const [customHours, setCustomHours] = useState("24");
  const [generatedLink, setGeneratedLink] = useState("");
  const [shortLink, setShortLink] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [latestLinkId, setLatestLinkId] = useState<string>("");
  
  // Viewer Link States
  const [viewerReturnFeed, setViewerReturnFeed] = useState("studio1");
  const [viewerEnableChat, setViewerEnableChat] = useState(false);
  const [viewerExpirationOption, setViewerExpirationOption] = useState("never");
  const [viewerCustomHours, setViewerCustomHours] = useState("24");
  const [viewerGeneratedLink, setViewerGeneratedLink] = useState("");
  const [viewerShortLink, setViewerShortLink] = useState("");
  const [viewerShowQR, setViewerShowQR] = useState(false);
  const [latestViewerLinkId, setLatestViewerLinkId] = useState<string>("");
  
  // Link Type Toggle
  const [linkType, setLinkType] = useState<"guest" | "viewer">("guest");
  
  // Invite Dialog State
  const [inviteDialog, setInviteDialog] = useState<{
    open: boolean;
    type: 'streaming' | 'viewer' | 'short-link';
    linkId?: string;
    shortCode?: string;
    linkDetails: any;
  }>({
    open: false,
    type: 'streaming',
    linkDetails: {}
  });
  
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const viewerQrCanvasRef = useRef<HTMLCanvasElement>(null);
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

      const regularLinkData = await regularResponse.json();
      const shortLinkData = await shortResponse.json();
      const shortUrl = `${window.location.protocol}//${window.location.host}/s/${shortLinkData.id}`;

      // Use the URL with session token from the server response
      setLatestLinkId(regularLinkData.id);
      setGeneratedLink(regularLinkData.url);
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

  const generateViewerLink = async () => {
    const baseURL = `${window.location.protocol}//${window.location.host}/studio-viewer`;
    const url = `${baseURL}?return=${encodeURIComponent(viewerReturnFeed)}&chat=${viewerEnableChat}`;
    
    // Calculate expiration date
    let expiresAt: Date | undefined = undefined;
    if (viewerExpirationOption !== "never") {
      const now = new Date();
      const hours = viewerExpirationOption === "custom" ? parseInt(viewerCustomHours) : parseInt(viewerExpirationOption);
      expiresAt = new Date(now.getTime() + (hours * 60 * 60 * 1000));
    }
    
    try {
      // Create both regular viewer link and short viewer link
      const [regularResponse, shortResponse] = await Promise.all([
        // Save regular viewer link
        fetch('/api/viewer-links', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: Date.now().toString(),
            returnFeed: viewerReturnFeed,
            chatEnabled: viewerEnableChat,
            url: url,
            expiresAt: expiresAt || null
          }),
        }),
        // Create short viewer link
        fetch('/api/short-viewer-links', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            returnFeed: viewerReturnFeed,
            chatEnabled: viewerEnableChat,
            expiresAt: expiresAt || null
          }),
        })
      ]);

      if (!regularResponse.ok || !shortResponse.ok) {
        throw new Error('Failed to create viewer link');
      }

      const regularViewerData = await regularResponse.json();
      const shortData = await shortResponse.json();
      const shortUrl = `${window.location.protocol}//${window.location.host}/sv/${shortData.id}`;

      // Use the URL with session token from the server response
      setLatestViewerLinkId(regularViewerData.id);
      setViewerGeneratedLink(regularViewerData.url);
      setViewerShortLink(shortUrl);
      
      // Generate QR code for the short link
      if (viewerQrCanvasRef.current) {
        try {
          await QRCode.toCanvas(viewerQrCanvasRef.current, shortUrl, {
            width: 200,
            margin: 2,
            color: {
              dark: '#ffffff',
              light: '#0f172a'
            }
          });
          setViewerShowQR(true);
        } catch (error) {
          console.error('Failed to generate QR code:', error);
        }
      }

      toast({
        title: "Viewer Link Generated!",
        description: `Link created for return feed: ${viewerReturnFeed}`,
      });
    } catch (error) {
      console.error('Error generating viewer link:', error);
      toast({
        title: "Error",
        description: "Failed to generate viewer link. Please try again.",
        variant: "destructive",
      });
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

  const copyViewerToClipboard = async (linkToCopy?: string) => {
    const linkToUse = linkToCopy || viewerShortLink || viewerGeneratedLink;
    if (!linkToUse) {
      toast({
        title: "Error",
        description: "Please generate a viewer link first.",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(linkToUse);
      toast({
        title: "Success",
        description: "Viewer link copied to clipboard!",
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
        description: "Viewer link copied to clipboard!",
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
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold va-text-primary mb-2">Link Generator</h1>
          <p className="va-text-secondary">Generate custom streaming links for guests or return feed viewers</p>
        </div>

        {/* Link Type Toggle */}
        <div className="max-w-md mx-auto mb-6">
          <div className="va-bg-dark-surface rounded-2xl p-2 border va-border-dark">
            <div className="grid grid-cols-2 gap-1">
              <Button
                onClick={() => setLinkType("guest")}
                variant={linkType === "guest" ? "default" : "ghost"}
                className={linkType === "guest" ? "va-bg-primary text-va-dark-bg" : "va-text-secondary hover:va-text-primary"}
                data-testid="button-link-type-guest"
              >
                <i className="fas fa-microphone mr-2"></i>
                Guest Session
              </Button>
              <Button
                onClick={() => setLinkType("viewer")}
                variant={linkType === "viewer" ? "default" : "ghost"}
                className={linkType === "viewer" ? "va-bg-primary text-va-dark-bg" : "va-text-secondary hover:va-text-primary"}
                data-testid="button-link-type-viewer"
              >
                <i className="fas fa-eye mr-2"></i>
                Return Feed Viewer
              </Button>
            </div>
          </div>
          <p className="text-xs va-text-secondary text-center mt-2">
            {linkType === "guest" 
              ? "Links for guests to publish their own streams" 
              : "Links to watch studio return feeds"
            }
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Generator Form */}
          <div className="va-bg-dark-surface rounded-2xl p-6 border va-border-dark">
            <h3 className="text-xl font-semibold va-text-primary mb-6">
              {linkType === "guest" ? "Guest Session Configuration" : "Viewer Link Configuration"}
            </h3>
            
            <div className="space-y-5">
              {/* Guest Stream Name - Only for Guest Sessions */}
              {linkType === "guest" && (
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
              )}

              {/* Studio Return Feed */}
              <div>
                <Label htmlFor="returnFeed" className="va-text-secondary">
                  {linkType === "guest" ? "Studio Return Feed" : "Studio Feed to Watch"}
                </Label>
                <Select 
                  value={linkType === "guest" ? returnFeed : viewerReturnFeed} 
                  onValueChange={linkType === "guest" ? setReturnFeed : setViewerReturnFeed}
                >
                  <SelectTrigger className="va-bg-dark-surface-2 va-border-dark va-text-primary focus:ring-va-primary focus:border-transparent mt-2" data-testid="select-return-feed">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="va-bg-dark-surface-2 va-border-dark">
                    <SelectItem value="studio1">Studio 1 (Main)</SelectItem>
                    <SelectItem value="livestream1">Studio 1 Legacy (livestream1)</SelectItem>
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
                  <p className="text-xs va-text-secondary mt-1">
                    {linkType === "guest" 
                      ? "Allow real-time chat during the session" 
                      : "Enable chat for viewers watching the return feed"
                    }
                  </p>
                </div>
                <Switch
                  id="enableChat"
                  checked={linkType === "guest" ? enableChat : viewerEnableChat}
                  onCheckedChange={linkType === "guest" ? setEnableChat : setViewerEnableChat}
                  className="data-[state=checked]:bg-va-primary"
                  data-testid="switch-enable-chat"
                />
              </div>

              {/* Link Expiration */}
              <div>
                <Label className="va-text-secondary">Link Expiration</Label>
                <div className="mt-2 space-y-3">
                  <Select 
                    value={linkType === "guest" ? expirationOption : viewerExpirationOption} 
                    onValueChange={linkType === "guest" ? setExpirationOption : setViewerExpirationOption}
                  >
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
                  
                  {((linkType === "guest" && expirationOption === "custom") || (linkType === "viewer" && viewerExpirationOption === "custom")) && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="8760"
                        value={linkType === "guest" ? customHours : viewerCustomHours}
                        onChange={(e) => linkType === "guest" ? setCustomHours(e.target.value) : setViewerCustomHours(e.target.value)}
                        className="va-bg-dark-surface-2 va-border-dark va-text-primary focus:ring-va-primary focus:border-transparent"
                        placeholder="Hours"
                        data-testid="input-custom-hours"
                      />
                      <span className="va-text-secondary text-sm">hours</span>
                    </div>
                  )}
                  
                  <p className="text-xs va-text-secondary">
                    {((linkType === "guest" && expirationOption === "never") || (linkType === "viewer" && viewerExpirationOption === "never"))
                      ? "Link will remain active indefinitely" 
                      : `Link will expire ${
                          ((linkType === "guest" && expirationOption === "custom") || (linkType === "viewer" && viewerExpirationOption === "custom"))
                            ? `in ${linkType === "guest" ? customHours : viewerCustomHours} hours` 
                            : `in ${linkType === "guest" ? expirationOption : viewerExpirationOption} hour${((linkType === "guest" ? expirationOption : viewerExpirationOption) !== "1" ? "s" : "")}`
                        }`
                    }
                  </p>
                </div>
              </div>

              {/* Generate Button */}
              <Button 
                onClick={linkType === "guest" ? generateLink : generateViewerLink}
                className="w-full va-bg-primary hover:va-bg-primary-dark text-va-dark-bg font-semibold"
                data-testid="button-generate-link"
              >
                <i className={linkType === "guest" ? "fas fa-microphone mr-2" : "fas fa-eye mr-2"}></i>
                Generate {linkType === "guest" ? "Guest Session" : "Viewer"} Link
              </Button>
            </div>
          </div>

          {/* Generated Output */}
          <div className="va-bg-dark-surface rounded-2xl p-6 border va-border-dark">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold va-text-primary">
                Generated {linkType === "guest" ? "Guest Session" : "Viewer"} Link
              </h3>
              <a 
                href="/links" 
                className="text-sm va-text-green hover:underline flex items-center"
                data-testid="link-view-all"
              >
                <i className="fas fa-list mr-2"></i>
                View All Links
              </a>
            </div>
            
            <div className="space-y-4">
              {/* Short Link Output */}
              {(linkType === "guest" ? shortLink : viewerShortLink) && (
                <div>
                  <Label htmlFor="shortLink" className="va-text-secondary">
                    Short Link (Recommended)
                  </Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="shortLink"
                      readOnly
                      value={linkType === "guest" ? shortLink : viewerShortLink}
                      className="va-bg-dark-bg va-border-dark va-text-green font-mono text-sm focus:ring-va-primary/50"
                      data-testid="input-short-link"
                    />
                    <Button 
                      onClick={() => linkType === "guest" ? copyToClipboard(shortLink) : copyViewerToClipboard(viewerShortLink)}
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
                  {(linkType === "guest" ? shortLink : viewerShortLink) 
                    ? 'Full Link (Debug)' 
                    : linkType === "guest" 
                      ? 'Guest Session URL' 
                      : 'Viewer URL'
                  }
                </Label>
                <Textarea
                  id="generatedLink"
                  rows={(linkType === "guest" ? shortLink : viewerShortLink) ? 3 : 4}
                  readOnly
                  value={linkType === "guest" ? generatedLink : viewerGeneratedLink}
                  placeholder="Generated link will appear here..."
                  className="va-bg-dark-bg va-border-dark va-text-green font-mono text-sm placeholder:text-gray-500 focus:ring-va-primary/50 resize-none mt-2"
                  data-testid="textarea-generated-link"
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-3">
                <Button 
                  onClick={() => linkType === "guest" ? copyToClipboard() : copyViewerToClipboard()}
                  variant="outline"
                  className="border-va-primary va-text-green hover:va-bg-primary hover:text-va-dark-bg"
                  data-testid="button-copy-link"
                >
                  <i className="fas fa-copy mr-2"></i>
                  Copy {(linkType === "guest" ? shortLink : viewerShortLink) ? 'Short' : ''} Link
                </Button>
                <Button 
                  onClick={() => {
                    if (linkType === "guest") {
                      generateQRCode();
                    } else {
                      // Generate QR for viewer links
                      const linkForQR = viewerShortLink || viewerGeneratedLink;
                      if (linkForQR && viewerQrCanvasRef.current) {
                        QRCode.toCanvas(viewerQrCanvasRef.current, linkForQR, {
                          width: 200,
                          margin: 2,
                          color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                          }
                        }).then(() => {
                          setViewerShowQR(true);
                          toast({
                            title: "Success",
                            description: "QR code generated successfully!",
                          });
                        }).catch((error) => {
                          console.error(error);
                          toast({
                            title: "Error",
                            description: "Error generating QR code",
                            variant: "destructive",
                          });
                        });
                      }
                    }
                  }}
                  variant="outline"
                  className="va-bg-dark-surface-2 hover:bg-gray-600 va-text-primary va-border-dark"
                  data-testid="button-generate-qr"
                >
                  <i className="fas fa-qrcode mr-2"></i>
                  QR Code
                </Button>
                <Button
                  onClick={() => {
                    const linkId = linkType === "guest" ? latestLinkId : latestViewerLinkId;
                    if (!linkId) {
                      toast({
                        title: "Error",
                        description: "Please generate a link first before sending an invite.",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    // Calculate expiration date based on user selection
                    const getExpirationDate = () => {
                      const currentExpOption = linkType === "guest" ? expirationOption : viewerExpirationOption;
                      const currentCustomHours = linkType === "guest" ? customHours : viewerCustomHours;
                      
                      if (currentExpOption === "never") return null;
                      
                      let hours;
                      if (currentExpOption === "custom") {
                        hours = parseInt(currentCustomHours) || 24;
                      } else {
                        hours = parseInt(currentExpOption);
                      }
                      
                      const expiration = new Date();
                      expiration.setHours(expiration.getHours() + hours);
                      return expiration;
                    };

                    setInviteDialog({
                      open: true,
                      type: linkType === "guest" ? "streaming" : "viewer",
                      linkId: linkId,
                      linkDetails: {
                        streamName: linkType === "guest" ? streamName : undefined,
                        returnFeed: linkType === "guest" ? returnFeed : viewerReturnFeed,
                        chatEnabled: linkType === "guest" ? enableChat : viewerEnableChat,
                        expiresAt: getExpirationDate()
                      }
                    });
                  }}
                  variant="outline"
                  className="va-bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700"
                  data-testid="button-email-invite"
                >
                  <i className="fas fa-envelope mr-2"></i>
                  Email Invite
                </Button>
              </div>

              {/* QR Code Display */}
              <div className="text-center" data-testid="qr-code-container">
                {linkType === "guest" ? (
                  <>
                    <div className="bg-white p-4 rounded-lg inline-block" style={{ display: showQR ? 'inline-block' : 'none' }}>
                      <canvas ref={qrCanvasRef}></canvas>
                    </div>
                    {showQR && (
                      <p className="va-text-secondary text-sm mt-2">Scan to open guest session</p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="bg-white p-4 rounded-lg inline-block" style={{ display: viewerShowQR ? 'inline-block' : 'none' }}>
                      <canvas ref={viewerQrCanvasRef}></canvas>
                    </div>
                    {viewerShowQR && (
                      <p className="va-text-secondary text-sm mt-2">Scan to open return feed viewer</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Invite Dialog */}
      <InviteDialog
        open={inviteDialog.open}
        onOpenChange={(open) => setInviteDialog(prev => ({ ...prev, open }))}
        inviteType={inviteDialog.type}
        linkId={inviteDialog.linkId}
        shortCode={inviteDialog.shortCode}
        linkDetails={inviteDialog.linkDetails}
      />
    </div>
  );
}
