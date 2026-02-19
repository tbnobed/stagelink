import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Video, Radio, FileText, CheckCircle2, Scale } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const [disputeConsent, setDisputeConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const allConsented = cameraConsent && broadcastConsent && privacyConsent && disputeConsent;

  const handleSubmit = async () => {
    if (!allConsented) return;

    setIsSubmitting(true);
    try {
      const consentTypes = ['camera_microphone', 'recording', 'broadcast', 'privacy_policy', 'arbitration_class_waiver'];

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
            <h2 className="text-lg font-semibold text-white">Consent & Release Required</h2>
            <p className="text-sm text-white/70">Trinity Broadcasting Network (TBN) - Please review and accept all terms before streaming</p>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <p className="text-amber-200 text-sm leading-relaxed font-medium">
              NOTICE: This streaming session is operated by Trinity Broadcasting Network ("TBN"). 
              Your participation may be broadcast on live television and streaming platforms in the United States 
              and worldwide. By proceeding, you acknowledge and consent to the following terms and release.
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
              <p className="text-sm text-white/80 leading-relaxed">
                By checking this box and clicking the "I Agree & Continue" button below, I grant Trinity Broadcasting Network (TBN) 
                permission to access and use my camera and microphone for live video and audio streaming. 
                I understand my video and audio will be captured and transmitted in real-time to TBN's production team 
                and that TBN may record, store, reproduce, and use such recordings for any purpose in connection with 
                TBN's programming, promotions, and related media without further notice or compensation to me.
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
                <span className="text-sm font-medium text-white">Live Broadcast, Recording & Release</span>
              </div>
              <p className="text-sm text-white/80 leading-relaxed">
                By checking this box and clicking the "I Agree & Continue" button below, I grant Trinity Broadcasting Network (TBN), 
                its affiliates, successors, assigns, licensees, and designees the irrevocable, perpetual, worldwide right and license 
                to use, broadcast, record, reproduce, distribute, display, and create derivative works from my video, audio, likeness, 
                voice, name, and appearance in any and all media now known or hereafter devised, including but not limited to live television, 
                internet streaming, social media, and promotional materials. I hereby release and discharge TBN and its officers, directors, 
                employees, agents, affiliates, successors, and assigns from any and all claims, demands, actions, causes of action, suits, 
                costs, expenses, and damages arising out of or in connection with the use of my likeness, voice, or participation in this 
                broadcast, including but not limited to claims for defamation, invasion of privacy, right of publicity, or infringement of 
                moral rights. I acknowledge that I will receive no compensation for my participation.
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
              <p className="text-sm text-white/80 leading-relaxed">
                By checking this box and clicking the "I Agree & Continue" button below, I acknowledge that I have read, understand, and agree to 
                TBN's{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-semibold hover:text-blue-300">
                  Privacy Policy
                </a>
                . I understand how my personal data, video, audio, IP address, and device information 
                will be collected, used, stored, and shared by TBN in accordance with applicable US federal and state laws, 
                including the California Consumer Privacy Act (CCPA) and the Illinois Biometric Information Privacy Act (BIPA).
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 rounded-xl border border-white/10 hover:border-white/20 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={disputeConsent}
              onChange={(e) => setDisputeConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded accent-[hsl(159,100%,41%)]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Scale className="h-4 w-4 text-[hsl(159,100%,41%)]" />
                <span className="text-sm font-medium text-white">Dispute Resolution & Class Action Waiver</span>
              </div>
              <p className="text-sm text-white/80 leading-relaxed">
                By checking this box and clicking the "I Agree & Continue" button below, I agree that any dispute, claim, or controversy 
                arising out of or relating to my participation in this broadcast or the use of this platform shall be resolved exclusively 
                through binding arbitration administered by the American Arbitration Association ("AAA") in accordance with its Commercial 
                Arbitration Rules, and judgment on the award rendered by the arbitrator(s) may be entered in any court having jurisdiction 
                thereof. The arbitration shall take place in Orange County, California. I further agree to waive my right to participate in 
                any class action, collective action, or representative proceeding against Trinity Broadcasting Network (TBN), its affiliates, 
                officers, directors, employees, or agents. I agree that any claims must be brought in my individual capacity and not as a 
                plaintiff or class member in any purported class, collective, or representative proceeding. The arbitrator shall not have 
                the authority to consolidate claims or conduct any class, collective, or representative proceeding.
              </p>
            </div>
          </label>

          <div className="bg-white/5 rounded-xl p-4 text-sm text-white/60 leading-relaxed">
            <p className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(159,100%,41%)]" />
              <span className="text-white/70 font-medium">Verification Record</span>
            </p>
            Your consent will be recorded with a timestamp, your IP address, and device information 
            for compliance and verification purposes. This record serves as proof of your informed 
            consent and may be referenced by Trinity Broadcasting Network (TBN) for legal and regulatory compliance. 
            By clicking "I Agree & Continue," you confirm that you are at least 18 years of age, that you have read 
            and understand all of the above terms, and that you voluntarily agree to be bound by them.
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
