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
          className="mb-8 text-white/60 hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-full bg-[hsl(159,100%,41%)]/10">
            <Shield className="h-6 w-6 text-[hsl(159,100%,41%)]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Trinity Broadcasting Network (TBN) Privacy Policy</h1>
            <p className="text-white/60 text-sm">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>

        <div className="space-y-8 text-white/80 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              This Privacy Policy describes how Trinity Broadcasting Network, Inc. and its affiliates 
              ("TBN," "we," "us," or "our") collect, use, disclose, and protect your personal information 
              when you use the Virtual Audience Platform and related services (collectively, the "Platform"). 
              This policy applies to all users, including registered users, guest participants, audience members, 
              and viewers accessing the Platform.
            </p>
            <p className="mt-3">
              The Platform is operated by TBN for the purpose of live television broadcast and streaming 
              in the United States and worldwide. By using the Platform, you agree to the collection and use 
              of information in accordance with this policy and all applicable federal and state laws, including 
              but not limited to the California Consumer Privacy Act (CCPA), the Illinois Biometric Information 
              Privacy Act (BIPA), and applicable Federal Communications Commission (FCC) regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>
            
            <h3 className="text-lg font-medium text-white mt-4 mb-2">2.1 Account Information</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Username and password (password is stored securely using scrypt hashing)</li>
              <li>Email address (optional, used for account recovery and invitations)</li>
              <li>User role (admin, engineer, or user)</li>
              <li>Account creation and modification timestamps</li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">2.2 Video & Audio Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Live video feed captured from your camera via WebRTC (WHIP protocol)</li>
              <li>Live audio feed captured from your microphone</li>
              <li>Video resolution settings (up to 1280x720 at 30fps)</li>
              <li>Audio and video codec information</li>
              <li>Stream names and session identifiers</li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">2.3 Biometric & Likeness Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Facial geometry and likeness as captured by your camera</li>
              <li>Voice and vocal characteristics as captured by your microphone</li>
              <li>Physical appearance and mannerisms visible in the video feed</li>
            </ul>
            <p className="mt-2 text-white/70 text-sm">
              In compliance with the Illinois Biometric Information Privacy Act (BIPA), TBN provides this notice 
              that biometric data may be captured during your participation. By consenting to use the Platform, 
              you consent to TBN's collection, use, and storage of such data as described in this policy.
            </p>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">2.4 Chat & Communication Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Chat messages sent during streaming sessions</li>
              <li>Sender and recipient identifiers</li>
              <li>Message timestamps</li>
              <li>Chat participation status (online/offline)</li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">2.5 Technical & Device Information</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>IP address</li>
              <li>Browser type and version (User-Agent)</li>
              <li>Device type (desktop, mobile)</li>
              <li>Operating system</li>
              <li>WebRTC connection statistics</li>
              <li>Session tokens and authentication cookies</li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">2.6 Consent Records</h3>
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
            <h2 className="text-xl font-semibold text-white mb-3">3. How TBN Uses Your Information</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong className="text-white">Live Streaming & Broadcast:</strong> To transmit your video and audio feed to TBN's production team and broadcast systems using WebRTC WHIP/WHEP protocols for live television broadcast, internet streaming, and related media distribution.</li>
              <li><strong className="text-white">Recording & Reproduction:</strong> TBN may record, store, reproduce, distribute, and create derivative works from your video, audio, likeness, and voice for use in TBN's programming, promotional materials, replays, archived content, and any other purpose.</li>
              <li><strong className="text-white">Communication:</strong> To facilitate real-time chat between participants, production staff, and engineers during streaming sessions.</li>
              <li><strong className="text-white">Account Management:</strong> To authenticate users, manage roles and permissions, and provide account recovery services.</li>
              <li><strong className="text-white">Session Management:</strong> To create and validate access tokens, manage streaming links, and control session expiration.</li>
              <li><strong className="text-white">Legal Compliance:</strong> To maintain verifiable consent records as required by applicable US federal and state laws, including FCC broadcast regulations.</li>
              <li><strong className="text-white">Platform Security:</strong> To monitor for unauthorized access, protect against abuse, and maintain system integrity.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Live Broadcast Disclosure</h2>
            <p>
              <strong className="text-white">IMPORTANT NOTICE:</strong> Content streamed through this Platform is operated by 
              Trinity Broadcasting Network (TBN) and may be broadcast live on television and streaming platforms in the United States 
              and worldwide. Once broadcast, your video and audio content becomes part of the public broadcast record. 
              Please be aware that:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>Live broadcasts cannot be retracted once transmitted</li>
              <li>TBN may retain recordings of broadcasts indefinitely for archival, rebroadcast, and promotional purposes</li>
              <li>Your likeness, voice, and name may appear in TBN programming, promotional materials, replays, social media, and archived content</li>
              <li>FCC regulations apply to all broadcast content</li>
              <li>You will receive no compensation for your participation unless otherwise agreed in writing by TBN</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Data Sharing & Disclosure</h2>
            <p>TBN may share your information with:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li><strong className="text-white">TBN Affiliates:</strong> Video, audio, and related data may be shared with TBN's affiliated entities, networks, and production partners.</li>
              <li><strong className="text-white">Production Teams:</strong> Video, audio, and chat data are shared with authorized TBN production staff and engineers managing the broadcast.</li>
              <li><strong className="text-white">Broadcast Partners & Licensees:</strong> Video and audio streams are transmitted to television networks, streaming platforms, and TBN's licensees for broadcast and distribution.</li>
              <li><strong className="text-white">Service Providers:</strong> TBN uses third-party services including SRS (Simple Realtime Server) for stream processing, PostgreSQL for data storage, and SendGrid for email communications.</li>
              <li><strong className="text-white">Legal Obligations:</strong> TBN may disclose your information if required by law, subpoena, court order, or regulatory request.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Retention</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong className="text-white">Account Data:</strong> Retained until the account is deleted by a TBN administrator.</li>
              <li><strong className="text-white">Video/Audio Streams & Recordings:</strong> Live streams are transmitted in real-time. TBN and its broadcast partners may retain recordings indefinitely for archival, rebroadcast, and promotional purposes.</li>
              <li><strong className="text-white">Chat Messages:</strong> Retained for the duration of the streaming session and stored in TBN's database.</li>
              <li><strong className="text-white">Session Tokens & Links:</strong> Automatically expire based on configured durations (default 24 hours) and are cleaned up periodically.</li>
              <li><strong className="text-white">Consent Records:</strong> Retained indefinitely as legal compliance records to provide verifiable proof of informed consent.</li>
              <li><strong className="text-white">Guest User Data:</strong> Automatically removed from the database upon disconnection from the Platform.</li>
              <li><strong className="text-white">Biometric Data:</strong> Retained only for as long as necessary for the purposes described in this policy, or as required by law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Data Security</h2>
            <p>TBN implements the following security measures to protect your data:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>Passwords are hashed using scrypt with unique salts</li>
              <li>Session management uses secure HTTP-only cookies</li>
              <li>Video and audio streams are transmitted using encrypted WebRTC connections (SRTP/DTLS)</li>
              <li>Database connections are encrypted</li>
              <li>Role-based access control limits data access to authorized TBN personnel</li>
              <li>Session tokens expire automatically and are validated server-side</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Your Rights</h2>
            <p>Depending on your state of residence, you may have the following rights:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li><strong className="text-white">Right to Know:</strong> You may request information about the personal data TBN collects and how it is used.</li>
              <li><strong className="text-white">Right to Delete:</strong> You may request deletion of your personal data, subject to certain exceptions (consent records and broadcast recordings may be retained for legal compliance and archival purposes).</li>
              <li><strong className="text-white">Right to Opt-Out:</strong> You may decline consent and choose not to participate in streaming sessions.</li>
              <li><strong className="text-white">Right to Non-Discrimination:</strong> TBN will not discriminate against you for exercising your privacy rights.</li>
            </ul>
            <p className="mt-3">
              <strong className="text-white">California Residents (CCPA):</strong> California residents have additional rights under the California Consumer 
              Privacy Act, including the right to know what personal information is collected, the right to delete 
              personal information, and the right to opt-out of the sale of personal information. TBN does not sell 
              your personal information.
            </p>
            <p className="mt-3">
              <strong className="text-white">Illinois Residents (BIPA):</strong> Illinois residents have additional rights regarding biometric information 
              under the Biometric Information Privacy Act. TBN will not sell, lease, trade, or otherwise profit from 
              your biometric data. Biometric data collected through the Platform will be permanently destroyed when the 
              initial purpose for collecting such data has been satisfied, or within three (3) years of your last interaction 
              with the Platform, whichever occurs first.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Release & Waiver of Claims</h2>
            <p>
              By using this Platform and granting consent to participate in TBN's broadcast, you hereby release and forever 
              discharge Trinity Broadcasting Network, Inc., its parent companies, subsidiaries, affiliates, successors, 
              assigns, licensees, officers, directors, employees, agents, and representatives (collectively, the "Released Parties") 
              from any and all claims, demands, actions, causes of action, suits, costs, expenses, liabilities, and damages of 
              every kind and nature, whether known or unknown, arising out of or in connection with your participation in the 
              broadcast and/or your use of the Platform, including but not limited to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>Claims for defamation, libel, or slander</li>
              <li>Claims for invasion of privacy or violation of the right of publicity</li>
              <li>Claims for infringement of moral rights</li>
              <li>Claims for intentional or negligent infliction of emotional distress</li>
              <li>Claims arising under any state or federal statute, including CCPA, BIPA, and FCC regulations</li>
              <li>Claims for compensation, royalties, or residuals related to the use of your likeness, voice, or appearance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Binding Arbitration</h2>
            <p>
              <strong className="text-white">PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT.</strong>
            </p>
            <p className="mt-3">
              Any dispute, claim, or controversy arising out of or relating to this Privacy Policy, your use of the Platform, 
              or your participation in any TBN broadcast ("Dispute") shall be resolved exclusively through final and binding 
              arbitration administered by the American Arbitration Association ("AAA") in accordance with its Commercial 
              Arbitration Rules then in effect, rather than in a court of law. The arbitration shall take place in 
              Orange County, California, unless the parties mutually agree to a different location.
            </p>
            <p className="mt-3">
              The arbitrator shall have the exclusive authority to resolve any Dispute, including but not limited to disputes 
              regarding the scope, enforceability, or validity of this arbitration provision. The arbitrator's decision shall 
              be final and binding, and judgment on the award rendered by the arbitrator may be entered in any court of 
              competent jurisdiction.
            </p>
            <p className="mt-3">
              Each party shall bear its own costs and attorney's fees in connection with the arbitration, except as otherwise 
              provided by law or the AAA's rules. The arbitration shall be conducted in the English language.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Class Action Waiver</h2>
            <p>
              <strong className="text-white">YOU AGREE THAT ANY DISPUTE RESOLUTION PROCEEDINGS, WHETHER IN ARBITRATION OR COURT, 
              WILL BE CONDUCTED ONLY ON AN INDIVIDUAL BASIS AND NOT IN A CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION.</strong>
            </p>
            <p className="mt-3">
              You expressly waive your right to participate in any class action, collective action, or representative proceeding 
              against Trinity Broadcasting Network (TBN), its affiliates, officers, directors, employees, or agents. You agree 
              that any claims must be brought in your individual capacity and not as a plaintiff or class member in any purported 
              class, collective, or representative proceeding. The arbitrator shall not have the authority to combine or 
              consolidate claims of more than one person, or to conduct any class, collective, or representative proceeding. 
              If this class action waiver is found to be unenforceable, then the entirety of the arbitration provision 
              (Section 10) shall be null and void, and the Dispute shall be decided by a court of competent jurisdiction 
              in Orange County, California.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Children's Privacy</h2>
            <p>
              This Platform is not intended for use by individuals under the age of 18. TBN does not knowingly 
              collect personal information from minors. If you are under 18, you must have a parent or legal 
              guardian's consent to use this Platform, and your parent or guardian must accept these terms on 
              your behalf.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">13. Cookies & Tracking</h2>
            <p>
              TBN uses session cookies for authentication purposes only. These cookies are HTTP-only, 
              secure, and expire when your session ends or after the configured timeout period. TBN does not 
              use third-party tracking cookies or advertising trackers on this Platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">14. Governing Law</h2>
            <p>
              This Privacy Policy and any disputes arising hereunder shall be governed by and construed in accordance 
              with the laws of the State of California, without regard to its conflict of laws principles. To the extent 
              that any legal proceeding is not subject to the binding arbitration provision in Section 10, you agree 
              to submit to the exclusive jurisdiction and venue of the state and federal courts located in Orange County, 
              California.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">15. Severability</h2>
            <p>
              If any provision of this Privacy Policy is held to be invalid, illegal, or unenforceable, the remaining 
              provisions shall continue in full force and effect. The invalid, illegal, or unenforceable provision shall 
              be modified to the minimum extent necessary to make it valid, legal, and enforceable while preserving the 
              original intent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">16. Changes to This Policy</h2>
            <p>
              TBN may update this Privacy Policy from time to time. TBN will notify registered users of 
              significant changes via email (if provided) or through a notice on the Platform. Your continued 
              use of the Platform after changes are posted constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">17. Contact Information</h2>
            <p>
              If you have questions about this Privacy Policy, wish to exercise your privacy rights, 
              or need to report a privacy concern, please contact:
            </p>
            <div className="mt-3 bg-white/5 rounded-xl p-4">
              <p className="text-white font-medium">Trinity Broadcasting Network (TBN)</p>
              <p>P.O. Box C</p>
              <p>Santa Ana, CA 92711</p>
              <p className="mt-2">
                Website:{" "}
                <a href="https://www.tbn.org" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-semibold hover:text-blue-300">
                  www.tbn.org
                </a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
