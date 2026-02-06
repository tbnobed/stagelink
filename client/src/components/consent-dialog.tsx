import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Video, Radio, FileText, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface ConsentDialogProps {
  streamName: string;
  guestIdentifier?: string;
  onConsentGranted: () => void;
  onConsentDenied: () => void;
}

export function ConsentDialog({
  streamName,
  guestIdentifier,
  onConsentGranted,
  onConsentDenied,
}: ConsentDialogProps) {
  const [cameraConsent, setCameraConsent] = useState(false);
  const [broadcastConsent, setBroadcastConsent] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const allConsented = cameraConsent && broadcastConsent && privacyConsent;

  const handleSubmit = async () => {
    if (!allConsented) return;

    setIsSubmitting(true);
    try {
      const consentTypes = ['camera_microphone', 'recording', 'broadcast', 'privacy_policy'];

      await apiRequest("POST", "/api/consent", {
        guestIdentifier,
        consentTypes,
        streamName,
      });

      toast({
        title: "Consent Recorded",
        description: "Your consent has been securely recorded. You may now begin streaming.",
      });

      onConsentGranted();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record consent. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-lg bg-[hsl(0,0%,10%)] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="p-2 rounded-full bg-[hsl(159,100%,41%)]/10">
            <Shield className="h-5 w-5 text-[hsl(159,100%,41%)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Consent Required</h2>
            <p className="text-sm text-white/40">Please review and accept before streaming</p>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <p className="text-amber-300 text-sm leading-relaxed">
              This streaming session may be broadcast on live television and streaming platforms in the United States. 
              By proceeding, you acknowledge and consent to the following terms.
            </p>
          </div>

          <label className="flex items-start gap-3 p-4 rounded-xl border border-white/10 hover:border-white/20 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={cameraConsent}
              onChange={(e) => setCameraConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded accent-[hsl(159,100%,41%)]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Video className="h-4 w-4 text-[hsl(159,100%,41%)]" />
                <span className="text-sm font-medium text-white">Camera & Microphone Access</span>
              </div>
              <p className="text-xs text-white/40 leading-relaxed">
                I consent to the use of my camera and microphone for live video and audio streaming. 
                I understand my video and audio will be captured and transmitted in real-time to the production team.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 rounded-xl border border-white/10 hover:border-white/20 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={broadcastConsent}
              onChange={(e) => setBroadcastConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded accent-[hsl(159,100%,41%)]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Radio className="h-4 w-4 text-[hsl(159,100%,41%)]" />
                <span className="text-sm font-medium text-white">Live Broadcast & Recording</span>
              </div>
              <p className="text-xs text-white/40 leading-relaxed">
                I consent to my video and audio being broadcast on live television, streaming platforms, and related 
                media in the United States. I understand this content may be recorded, stored, and redistributed 
                for broadcast purposes. I release the producer and platform operator from claims related to the 
                use of my likeness and voice in connection with this broadcast.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 rounded-xl border border-white/10 hover:border-white/20 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={privacyConsent}
              onChange={(e) => setPrivacyConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded accent-[hsl(159,100%,41%)]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-[hsl(159,100%,41%)]" />
                <span className="text-sm font-medium text-white">Privacy Policy</span>
              </div>
              <p className="text-xs text-white/40 leading-relaxed">
                I have read and agree to the{" "}
                <Link href="/privacy" className="text-[hsl(159,100%,41%)] underline hover:text-[hsl(159,100%,50%)]" target="_blank">
                  Privacy Policy
                </Link>
                . I understand how my personal data, video, audio, IP address, and device information 
                will be collected, used, and stored in accordance with applicable US laws.
              </p>
            </div>
          </label>

          <div className="bg-white/5 rounded-xl p-4 text-xs text-white/30 leading-relaxed">
            <p className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(159,100%,41%)]" />
              <span className="text-white/50 font-medium">Verification Record</span>
            </p>
            Your consent will be recorded with a timestamp, your IP address, and device information 
            for compliance and verification purposes. This record serves as proof of your informed 
            consent and may be referenced for legal and regulatory compliance.
          </div>
        </div>

        <div className="p-6 border-t border-white/10 flex gap-3">
          <Button
            variant="outline"
            onClick={onConsentDenied}
            className="flex-1 border-white/10 text-white/60 hover:text-white hover:bg-white/5 rounded-xl"
          >
            Decline
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!allConsented || isSubmitting}
            className="flex-1 bg-[hsl(159,100%,41%)] hover:bg-[hsl(159,100%,35%)] text-black font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Shield className="mr-2 h-4 w-4" />
            )}
            I Agree & Continue
          </Button>
        </div>
      </div>
    </div>
  );
}