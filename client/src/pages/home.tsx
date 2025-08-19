import { Link } from "wouter";

export default function Home() {
  const stats = [
    { label: "Uptime", value: "99.9%" },
    { label: "Max Resolution", value: "1080p" },
    { label: "Frame Rate", value: "30fps" },
    { label: "Latency", value: "< 100ms" }
  ];

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold va-text-primary mb-4">
            Virtual Audience
            <span className="va-text-green ml-4">Platform</span>
          </h1>
          <p className="text-xl va-text-secondary max-w-2xl mx-auto">
            Professional live streaming solution with real-time video publishing and audience interaction capabilities
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Guest Session Card */}
          <div className="va-bg-dark-surface rounded-2xl p-8 border va-border-dark hover:border-va-primary/50 transition-all duration-300 hover:transform hover:scale-105">
            <div className="flex items-center mb-6">
              <div className="bg-va-primary/20 p-3 rounded-lg mr-4">
                <i className="fas fa-video va-text-green text-2xl"></i>
              </div>
              <h3 className="text-2xl font-semibold va-text-primary">Guest Session</h3>
            </div>
            <p className="va-text-secondary mb-6">
              Start publishing your live video stream with real-time codec information and session statistics
            </p>
            <ul className="space-y-2 mb-6 va-text-secondary">
              <li className="flex items-center">
                <i className="fas fa-check va-text-green mr-3"></i>
                WHIP/WHEP Protocol Support
              </li>
              <li className="flex items-center">
                <i className="fas fa-check va-text-green mr-3"></i>
                Real-time Video Streaming
              </li>
              <li className="flex items-center">
                <i className="fas fa-check va-text-green mr-3"></i>
                Live Chat Integration
              </li>
            </ul>
            <Link
              href="/session"
              className="w-full va-bg-primary hover:va-bg-primary-dark text-va-dark-bg font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
              data-testid="button-launch-session"
            >
              Launch Guest Session
            </Link>
          </div>

          {/* Link Generator Card */}
          <div className="va-bg-dark-surface rounded-2xl p-8 border va-border-dark hover:border-va-primary/50 transition-all duration-300 hover:transform hover:scale-105">
            <div className="flex items-center mb-6">
              <div className="bg-va-primary/20 p-3 rounded-lg mr-4">
                <i className="fas fa-link va-text-green text-2xl"></i>
              </div>
              <h3 className="text-2xl font-semibold va-text-primary">Link Generator</h3>
            </div>
            <p className="va-text-secondary mb-6">
              Create custom guest links with studio return feeds and chat configuration options
            </p>
            <ul className="space-y-2 mb-6 va-text-secondary">
              <li className="flex items-center">
                <i className="fas fa-check va-text-green mr-3"></i>
                Custom Stream Names
              </li>
              <li className="flex items-center">
                <i className="fas fa-check va-text-green mr-3"></i>
                Studio Return Feed Selection
              </li>
              <li className="flex items-center">
                <i className="fas fa-check va-text-green mr-3"></i>
                QR Code Generation
              </li>
            </ul>
            <Link
              href="/generator"
              className="w-full bg-transparent hover:va-bg-primary border-2 border-va-primary hover:text-va-dark-bg va-text-green font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center"
              data-testid="button-open-generator"
            >
              Open Link Generator
            </Link>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {stats.map((stat, index) => (
            <div key={index} className="va-bg-dark-surface-2 rounded-lg p-4">
              <div className="text-2xl font-bold va-text-green">{stat.value}</div>
              <div className="text-sm va-text-secondary">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
