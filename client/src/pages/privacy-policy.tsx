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
            <p className="mt-3">
              Certain rights and obligations relating to your participation in TBN's broadcast, including release, 
              indemnification, and dispute resolution, are governed by the separate <strong className="text-white">Virtual 
              Audience Participation Agreement</strong> (also referred to as the "TBN Adult Likeness Authorization and Release"), 
              which is presented to you prior to participation. By using the Platform, you acknowledge and agree to both 
              this Privacy Policy and the Virtual Audience Participation Agreement.
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
              <li><strong className="text-white">Recording & Reproduction:</strong> TBN may record (on film, tape, digital, electronic or otherwise) your Likeness; edit your Likeness at TBN's sole discretion and include it with the performance and/or likeness of others and with special effects, sound effects and music; and make multiple recordings for use and re-use in any traditional and non-traditional broadcast formats, worldwide, as well as TBN's print and electronic publications and/or on any of TBN's websites. This use is strictly limited to broadcast transmission platforms; TBN shall not make, use, and/or distribute any ancillary products including physical (other than archival) or electronic or digital copies of the Likeness or Recording embodying the Likeness.</li>
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
              <li>Your likeness, voice, and name may appear in TBN programming on traditional and non-traditional broadcast transmission platforms, TBN's print and electronic publications, and TBN's websites</li>
              <li>FCC regulations apply to all broadcast content</li>
              <li>You will receive no compensation for your participation unless otherwise agreed in writing by TBN</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. No Expectation of Privacy</h2>
            <p>
              Participants acknowledge and agree that they have <strong className="text-white">no expectation of privacy</strong> while 
              participating in a live streaming session on the Platform. By joining a live session, you understand that your video, audio, 
              likeness, voice, and any visible surroundings may be broadcast live to a public audience, recorded, and redistributed by TBN 
              and its affiliates. You should not share or display any private, confidential, or sensitive information during your participation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Platform Moderation Rights</h2>
            <p>
              TBN reserves the right to <strong className="text-white">remove, disconnect, mute, or otherwise restrict any participant</strong> from 
              a live session at its sole and absolute discretion, without prior notice or explanation. This includes, but is not limited to, 
              removal for inappropriate conduct, technical issues, content that may violate FCC broadcast standards, or any other reason 
              TBN deems necessary to protect the integrity of its broadcast. No participant shall have any claim or cause of action against 
              TBN arising from such removal or restriction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Network Reliability Disclaimer</h2>
            <p>
              The Platform relies on WebRTC technology and consumer internet connections to transmit live video and audio. 
              TBN is <strong className="text-white">not responsible for interruptions, connectivity issues, latency, degraded video or audio quality, 
              or other technical failures</strong> that are beyond its reasonable control, including but not limited to failures of your internet 
              service provider, local network conditions, device hardware or software limitations, browser compatibility issues, or force 
              majeure events. TBN does not guarantee uninterrupted or error-free streaming service and shall have no liability for any 
              losses or damages arising from such interruptions or failures.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Data Sharing & Disclosure</h2>
            <p>TBN may share your information with:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li><strong className="text-white">TBN Affiliates:</strong> Video, audio, and related data may be shared with TBN's affiliated entities, networks, and production partners.</li>
              <li><strong className="text-white">Production Teams:</strong> Video, audio, and chat data are shared with authorized TBN production staff and engineers managing the broadcast.</li>
              <li><strong className="text-white">Affiliated Companies, Licensees & Assignees:</strong> Video and audio streams may be shared with TBN's affiliated companies, licensees, assignees, and other successors-in-interest for use solely on traditional and non-traditional broadcast transmission platforms.</li>
              <li><strong className="text-white">Service Providers:</strong> TBN uses third-party services including SRS (Simple Realtime Server) for stream processing, PostgreSQL for data storage, and SendGrid for email communications.</li>
              <li><strong className="text-white">Legal Obligations:</strong> TBN may disclose your information if required by law, subpoena, court order, or regulatory request.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Data Retention</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong className="text-white">Account Data:</strong> Retained until the account is deleted by a TBN administrator.</li>
              <li><strong className="text-white">Video/Audio Streams & Recordings:</strong> Live streams are transmitted in real-time. TBN may retain recordings for archival purposes and use and re-use them in any traditional and non-traditional broadcast formats. Use is strictly limited to broadcast transmission platforms as set forth in the Adult Likeness Authorization and Release.</li>
              <li><strong className="text-white">Chat Messages:</strong> Retained for the duration of the streaming session and stored in TBN's database.</li>
              <li><strong className="text-white">Session Tokens & Links:</strong> Automatically expire based on configured durations (default 24 hours) and are cleaned up periodically.</li>
              <li><strong className="text-white">Consent Records:</strong> Retained indefinitely as legal compliance records to provide verifiable proof of informed consent.</li>
              <li><strong className="text-white">Guest User Data:</strong> Automatically removed from the database upon disconnection from the Platform.</li>
              <li><strong className="text-white">Biometric Data:</strong> Retained only for as long as necessary for the purposes described in this policy, or as required by law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Data Security</h2>
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
            <h2 className="text-xl font-semibold text-white mb-3">11. Your Rights</h2>
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
            <h2 className="text-xl font-semibold text-white mb-3">12. Age Restriction & Eligibility</h2>
            <p>
              <strong className="text-white">This Platform is strictly restricted to individuals aged 18 years or older.</strong> By 
              accessing or using the Platform, you represent and warrant that you are at least 18 years of age. TBN does not 
              knowingly collect personal information from individuals under 18. If TBN becomes aware that a user is under 18, 
              TBN will immediately terminate that user's access and delete any associated personal data.
            </p>
            <p className="mt-3">
              Minors (individuals under 18) are <strong className="text-white">not permitted</strong> to use the Platform under any 
              circumstances, including with parental or guardian consent. If a minor's participation is required for a specific 
              TBN production, a separate Minor Release and COPPA-compliant workflow with verifiable parental consent and separate 
              data retention controls must be arranged directly with TBN's legal department outside of this Platform.
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
            <h2 className="text-xl font-semibold text-white mb-3">14. Virtual Audience Participation Agreement</h2>
            <p>
              Your participation in TBN's live broadcast sessions is governed by the <strong className="text-white">Virtual Audience 
              Participation Agreement</strong> (the "TBN Adult Likeness Authorization and Release"), which is a separate contractual 
              agreement presented to you prior to each streaming session. The Participation Agreement addresses:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>Grant of rights to use your likeness, voice, and appearance in TBN broadcasts</li>
              <li>Release, indemnification, and waiver of claims</li>
              <li>Acknowledgment of no monetary compensation</li>
              <li>Scope of permitted use (broadcast transmission platforms only; no ancillary products)</li>
            </ul>
            <p className="mt-3">
              The Participation Agreement is incorporated by reference into this Privacy Policy. In the event of any conflict 
              between this Privacy Policy and the Participation Agreement regarding the scope of rights granted, the Participation 
              Agreement shall control.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">15. Dispute Resolution & Arbitration</h2>
            <p>
              <strong className="text-white">PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS.</strong>
            </p>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">15.1 Mandatory Binding Arbitration</h3>
            <p>
              Any dispute, claim, or controversy arising out of or relating to this Privacy Policy, the Virtual Audience 
              Participation Agreement, your use of the Platform, or your participation in any TBN broadcast (collectively, "Disputes") 
              shall be resolved exclusively through <strong className="text-white">final and binding arbitration</strong> administered 
              by the American Arbitration Association ("AAA") under its Commercial Arbitration Rules. The arbitration shall be conducted 
              by a single arbitrator in Dallas County, Texas. The arbitrator's decision shall be final and binding, and judgment on the 
              award may be entered in any court of competent jurisdiction.
            </p>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">15.2 Class Action Waiver</h3>
            <p>
              <strong className="text-white">YOU AGREE THAT ANY DISPUTE RESOLUTION PROCEEDINGS WILL BE CONDUCTED ONLY ON AN INDIVIDUAL 
              BASIS AND NOT IN A CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION.</strong> You waive any right to participate in a class 
              action lawsuit or class-wide arbitration against TBN. If for any reason a claim proceeds in court rather than arbitration, 
              you and TBN each waive any right to a jury trial.
            </p>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">15.3 Exceptions to Arbitration</h3>
            <p>
              Notwithstanding the foregoing, either party may seek injunctive or other equitable relief in any court of competent 
              jurisdiction to prevent the actual or threatened infringement, misappropriation, or violation of intellectual property 
              rights. TBN may also seek injunctive relief to enforce its broadcast rights and protect the integrity of its programming.
            </p>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">15.4 Irrevocability</h3>
            <p>
              All rights, licenses and privileges granted to TBN under these terms and the Adult Likeness Authorization 
              and Release are irrevocable and not subject to rescission, restraint or injunction under any circumstances. 
              Nothing herein shall be construed to obligate TBN to produce, distribute or use any of the rights granted herein.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">16. Governing Law & Venue</h2>
            <p>
              This Privacy Policy, the Virtual Audience Participation Agreement, and any Disputes arising hereunder shall be 
              construed according to the laws of the State of Texas, without regard to its conflict of laws principles. To the 
              extent any matter is not subject to arbitration as set forth in Section 15, jurisdiction shall lie with venue 
              exclusively in the state and federal courts located in Dallas County, Texas. You hereby consent to the personal 
              jurisdiction of such courts and waive any objection to jurisdiction or venue in any other place.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">17. Severability</h2>
            <p>
              If any provision of this Privacy Policy is held to be invalid, illegal, or unenforceable, the remaining 
              provisions shall continue in full force and effect. The invalid, illegal, or unenforceable provision shall 
              be modified to the minimum extent necessary to make it valid, legal, and enforceable while preserving the 
              original intent. If the class action waiver in Section 15.2 is found to be unenforceable, then the entirety 
              of Section 15 (Dispute Resolution & Arbitration) shall be null and void, and Disputes shall be resolved 
              exclusively in the courts described in Section 16.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">18. Changes to This Policy</h2>
            <p>
              TBN may update this Privacy Policy from time to time. TBN will notify registered users of 
              significant changes via email (if provided) or through a notice on the Platform. Your continued 
              use of the Platform after changes are posted constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">19. Contact Information</h2>
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
