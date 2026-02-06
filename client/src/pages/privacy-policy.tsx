import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[hsl(0,0%,5%)]">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="mb-8 text-white/40 hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-full bg-[hsl(159,100%,41%)]/10">
            <Shield className="h-6 w-6 text-[hsl(159,100%,41%)]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Privacy Policy</h1>
            <p className="text-white/40 text-sm">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>

        <div className="space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              This Privacy Policy describes how the Virtual Audience Platform ("StageLinq," "we," "us," or "our") 
              collects, uses, discloses, and protects your personal information when you use our live streaming 
              platform and related services. This policy applies to all users, including registered users, 
              guest participants, and viewers accessing our platform.
            </p>
            <p className="mt-3">
              Our platform is designed for live television broadcast and streaming in the United States. 
              By using our services, you agree to the collection and use of information in accordance with 
              this policy and all applicable federal and state laws, including but not limited to the 
              California Consumer Privacy Act (CCPA), the Illinois Biometric Information Privacy Act (BIPA), 
              and applicable FCC regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>
            
            <h3 className="text-lg font-medium text-white/90 mt-4 mb-2">2.1 Account Information</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Username and password (password is stored securely using scrypt hashing)</li>
              <li>Email address (optional, used for account recovery and invitations)</li>
              <li>User role (admin, engineer, or user)</li>
              <li>Account creation and modification timestamps</li>
            </ul>

            <h3 className="text-lg font-medium text-white/90 mt-4 mb-2">2.2 Video & Audio Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Live video feed captured from your camera via WebRTC (WHIP protocol)</li>
              <li>Live audio feed captured from your microphone</li>
              <li>Video resolution settings (up to 1280x720 at 30fps)</li>
              <li>Audio and video codec information</li>
              <li>Stream names and session identifiers</li>
            </ul>

            <h3 className="text-lg font-medium text-white/90 mt-4 mb-2">2.3 Chat & Communication Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Chat messages sent during streaming sessions</li>
              <li>Sender and recipient identifiers</li>
              <li>Message timestamps</li>
              <li>Chat participation status (online/offline)</li>
            </ul>

            <h3 className="text-lg font-medium text-white/90 mt-4 mb-2">2.4 Technical & Device Information</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>IP address</li>
              <li>Browser type and version (User-Agent)</li>
              <li>Device type (desktop, mobile)</li>
              <li>Operating system</li>
              <li>WebRTC connection statistics</li>
              <li>Session tokens and authentication cookies</li>
            </ul>

            <h3 className="text-lg font-medium text-white/90 mt-4 mb-2">2.5 Consent Records</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Timestamp of when consent was granted</li>
              <li>Type of consent granted (camera/microphone, recording, broadcast, privacy policy)</li>
              <li>The full text of what was consented to</li>
              <li>IP address at the time of consent</li>
              <li>Browser/device information at the time of consent</li>
              <li>Associated stream name and session identifier</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong className="text-white/90">Live Streaming:</strong> To transmit your video and audio feed to the production team and broadcast systems using WebRTC WHIP/WHEP protocols.</li>
              <li><strong className="text-white/90">Broadcast:</strong> Your video and audio may be included in live television broadcasts and streaming platform content distributed within the United States.</li>
              <li><strong className="text-white/90">Communication:</strong> To facilitate real-time chat between participants, production staff, and engineers during streaming sessions.</li>
              <li><strong className="text-white/90">Account Management:</strong> To authenticate users, manage roles and permissions, and provide account recovery services.</li>
              <li><strong className="text-white/90">Session Management:</strong> To create and validate access tokens, manage streaming links, and control session expiration.</li>
              <li><strong className="text-white/90">Legal Compliance:</strong> To maintain verifiable consent records as required by applicable US federal and state laws, including FCC broadcast regulations.</li>
              <li><strong className="text-white/90">Platform Security:</strong> To monitor for unauthorized access, protect against abuse, and maintain system integrity.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Live Broadcast Disclosure</h2>
            <p>
              <strong className="text-white/90">Important:</strong> Content streamed through this platform may be broadcast live on 
              television and streaming platforms in the United States. Once broadcast, your video and audio 
              content becomes part of the public broadcast record. While we take reasonable steps to ensure 
              informed consent, please be aware that:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>Live broadcasts cannot be "un-broadcast" once transmitted</li>
              <li>Recordings of broadcasts may be retained by television networks and streaming platforms according to their own retention policies</li>
              <li>Your likeness and voice may appear in promotional materials, replays, or archived content</li>
              <li>FCC regulations may apply to broadcast content</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Data Sharing & Disclosure</h2>
            <p>We may share your information with:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li><strong className="text-white/90">Production Teams:</strong> Video, audio, and chat data are shared with authorized production staff and engineers managing the broadcast.</li>
              <li><strong className="text-white/90">Broadcast Partners:</strong> Video and audio streams are transmitted to television networks and streaming platforms for live broadcast.</li>
              <li><strong className="text-white/90">Service Providers:</strong> We use third-party services including SRS (Simple Realtime Server) for stream processing, PostgreSQL for data storage, and SendGrid for email communications.</li>
              <li><strong className="text-white/90">Legal Obligations:</strong> We may disclose your information if required by law, subpoena, court order, or regulatory request.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Retention</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong className="text-white/90">Account Data:</strong> Retained until the account is deleted by an administrator.</li>
              <li><strong className="text-white/90">Video/Audio Streams:</strong> Live streams are transmitted in real-time and are not stored on our platform servers. Broadcast recordings are managed by the receiving broadcast partners.</li>
              <li><strong className="text-white/90">Chat Messages:</strong> Retained for the duration of the streaming session and stored in our database.</li>
              <li><strong className="text-white/90">Session Tokens & Links:</strong> Automatically expire based on configured durations (default 24 hours) and are cleaned up periodically.</li>
              <li><strong className="text-white/90">Consent Records:</strong> Retained indefinitely as legal compliance records to provide verifiable proof of informed consent.</li>
              <li><strong className="text-white/90">Guest User Data:</strong> Automatically removed from the database upon disconnection from the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Data Security</h2>
            <p>We implement the following security measures to protect your data:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>Passwords are hashed using scrypt with unique salts</li>
              <li>Session management uses secure HTTP-only cookies</li>
              <li>Video and audio streams are transmitted using encrypted WebRTC connections (SRTP/DTLS)</li>
              <li>Database connections are encrypted</li>
              <li>Role-based access control limits data access to authorized personnel</li>
              <li>Session tokens expire automatically and are validated server-side</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Your Rights</h2>
            <p>Depending on your state of residence, you may have the following rights:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li><strong className="text-white/90">Right to Know:</strong> You may request information about the personal data we collect and how we use it.</li>
              <li><strong className="text-white/90">Right to Delete:</strong> You may request deletion of your personal data, subject to certain exceptions (consent records may be retained for legal compliance).</li>
              <li><strong className="text-white/90">Right to Opt-Out:</strong> You may decline consent and choose not to participate in streaming sessions.</li>
              <li><strong className="text-white/90">Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your privacy rights.</li>
            </ul>
            <p className="mt-3">
              <strong className="text-white/90">California Residents (CCPA):</strong> California residents have additional rights under the California Consumer 
              Privacy Act, including the right to know what personal information is collected, the right to delete 
              personal information, and the right to opt-out of the sale of personal information. We do not sell 
              your personal information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Children's Privacy</h2>
            <p>
              This platform is not intended for use by individuals under the age of 18. We do not knowingly 
              collect personal information from minors. If you are under 18, you must have a parent or legal 
              guardian's consent to use this platform, and your parent or guardian must accept these terms on 
              your behalf.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Cookies & Tracking</h2>
            <p>
              We use session cookies for authentication purposes only. These cookies are HTTP-only, 
              secure, and expire when your session ends or after the configured timeout period. We do not 
              use third-party tracking cookies or advertising trackers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify registered users of 
              significant changes via email (if provided) or through a notice on our platform. Your continued 
              use of the platform after changes are posted constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Contact Information</h2>
            <p>
              If you have questions about this Privacy Policy, wish to exercise your privacy rights, 
              or need to report a privacy concern, please contact your platform administrator or the 
              production team managing your streaming session.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}