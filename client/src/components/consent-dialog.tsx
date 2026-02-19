import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, CheckCircle2 } from "lucide-react";
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
  const [releaseConsent, setReleaseConsent] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const allConsented = releaseConsent && privacyConsent;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      if (atBottom) setHasScrolledToBottom(true);
    };
    el.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

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
        description: "Your authorization and release has been securely recorded. You may now begin streaming.",
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
      <div className="w-full max-w-2xl bg-[hsl(0,0%,10%)] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-white/10 text-center">
          <h2 className="text-lg font-bold text-white tracking-wide uppercase">Adult Likeness Authorization and Release</h2>
          <p className="text-sm text-white/60 mt-1">Trinity Broadcasting Network (TBN)</p>
        </div>

        <div
          ref={scrollRef}
          className="p-6 max-h-[50vh] overflow-y-auto space-y-4 text-sm text-white/80 leading-relaxed"
        >
          <p>
            I hereby grant to Trinity Broadcasting Network ("TBN") and to its affiliated companies, licensees, assignees, and other successors-in-interest the non-exclusive right as set forth herein, and to my appearance, image, likeness, performance, voice and/or name and the results and proceeds thereof ("Likeness") solely in connection with the recording and/or broadcast programming of TBN ("Recording").
          </p>

          <p>
            I hereby authorize TBN to record (on film, tape, digital, electronic or otherwise) my Likeness; to edit my Likeness at TBN's sole discretion and to include it with the performance and/or likeness of others and with special effects, sound effects and music; to make multiple recordings of my Likeness and to use and re-use my Likeness, in whole or in part, in any traditional and non-traditional broadcast formats, worldwide, as well as TBN's print and electronic publications and/or on any of TBN's websites.
          </p>

          <p>
            I authorize TBN to use in whole or in part, to use such recordings for purposes of publicity, advertising and promotion, or other non-commercial purposes; and to use my name, likeness, voice, biographic or other information concerning me in connection with TBN in its sole discretion. I understand and agree that TBN owns all rights and proceeds to the recording rendered in connection therewith.
          </p>

          <p>
            Furthermore, it is expressly understood and agreed by the parties hereto that this release is strictly limited to TBN or its affiliated companies, licensees, assignees, and other successors-in-interest use only on traditional and non-traditional broadcast transmission platforms. TBN shall not make, use, and/or distribute any ancillary products including, without limitation, any physical (other than archival) or electronic or digital copies of the Likeness, or of the Recording embodying the Likeness.
          </p>

          <p>
            I hereby release, discharge, indemnify and hold harmless, TBN, its employees, agents, licensees, successor and assigns from any and all claims, demands or causes of action that I may have, or may have in the future, for defamation, invasion of privacy or right of publicity, infringement of copyright or trademark, or violation of any other right arising out of or relating to any utilization of the rights granted under this agreement.
          </p>

          <p>
            Although I understand and agree that I am to receive no monetary compensation from TBN or its affiliated companies, licensees, assignees, and other successors-in-interest for my appearance or participation in the Recording, I acknowledge that I have received adequate consideration for this Release.
          </p>

          <p>
            All rights, licenses and privileges herein granted to TBN are irrevocable and not subject to rescission, restraint or injunction under any circumstances. Nothing herein shall be construed to obligate TBN to produce, distribute or use any of the rights granted herein.
          </p>

          <p>
            This Authorization and Release shall be construed according to the laws of the State of Texas, where jurisdiction shall lie with venue in the County of Dallas. I hereby waive jurisdiction and venue in any other place. This agreement contains the entire understanding of the parties relating to the subject matter.
          </p>
        </div>

        <div className="px-6 pb-4 space-y-3">
          {!hasScrolledToBottom && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
              <p className="text-amber-200 text-xs font-medium">Please scroll to the bottom to read the full authorization before agreeing.</p>
            </div>
          )}

          <label className={`flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${hasScrolledToBottom ? 'border-white/10 hover:border-white/20' : 'border-white/5 opacity-50 pointer-events-none'}`}>
            <input
              type="checkbox"
              checked={releaseConsent}
              onChange={(e) => setReleaseConsent(e.target.checked)}
              disabled={!hasScrolledToBottom}
              className="mt-0.5 h-4 w-4 rounded accent-[hsl(159,100%,41%)]"
            />
            <p className="text-sm text-white/80 leading-relaxed">
              By checking this box and clicking the "I Agree & Continue" button below, I confirm that I am at least 18 years of age, that I have read and understand the Adult Likeness Authorization and Release above, and that I voluntarily agree to be bound by all of its terms. I grant TBN the rights described herein to my Likeness in connection with TBN's Recording and broadcast programming.
            </p>
          </label>

          <label className="flex items-start gap-3 p-4 rounded-xl border border-white/10 hover:border-white/20 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={privacyConsent}
              onChange={(e) => setPrivacyConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-[hsl(159,100%,41%)]"
            />
            <p className="text-sm text-white/80 leading-relaxed">
              By checking this box and clicking the "I Agree & Continue" button below, I acknowledge that I have read, understand, and agree to TBN's{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-semibold hover:text-blue-300">
                Privacy Policy
              </a>
              , including how my personal data, video, audio, IP address, and device information will be collected, used, stored, and shared in accordance with applicable law.
            </p>
          </label>

          <div className="bg-white/5 rounded-xl p-3 text-xs text-white/50 leading-relaxed">
            <p className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-3 w-3 text-[hsl(159,100%,41%)]" />
              <span className="text-white/60 font-medium">Verification Record</span>
            </p>
            Your authorization will be recorded with a timestamp, IP address, and device information for compliance and verification purposes.
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
