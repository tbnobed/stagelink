# Overview

The Virtual Audience Platform is a professional live streaming solution that enables real-time video publishing and audience interaction. It provides a comprehensive streaming platform with WHIP/WHEP protocol support, live chat integration, and QR code generation for easy session sharing. Users can generate streaming links, manage guest sessions, and interact with live video streams through an intuitive web interface. The project aims to deliver a robust and scalable solution for live video broadcasting and audience engagement.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite
- **UI Components**: shadcn/ui built on Radix UI
- **Styling**: Tailwind CSS with custom themes and dark mode
- **Routing**: Wouter
- **State Management**: React Query for server state
- **Form Handling**: React Hook Form with Zod validation
- **Mobile Experience**: Comprehensive mobile-optimized streaming interface with touch-friendly controls, swipe gestures, auto-hiding overlays, and mobile-optimized layouts. Includes components like `MobileNav`, `MobileVideoControls`, `MobileChat`, and custom hooks (`useMobile`, `useSwipeGestures`, `useAutoHideControls`) for enhanced mobile UX.
- **PWA Support**: Full Apple touch icon support and Progressive Web App (PWA) capabilities including `manifest.json` and iOS-specific meta tags.

## Backend Architecture  
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Session Storage**: PostgreSQL-based session storage via connect-pg-simple
- **Development**: Hot reload with Vite middleware

## Database Design
- **ORM**: Drizzle with PostgreSQL dialect
- **Schema**: Defined in shared/schema.ts with Zod integration
- **Migrations**: Managed through Drizzle Kit
- **Guest User Management**: Guest users are automatically removed from the database upon disconnection.

## Authentication & Authorization
- **Custom Authentication**: Passport.js with local strategy and scrypt hashing
- **Role-Based Access**: Admin, engineer, and user roles
- **User Management**: CRUD operations for user accounts via admin interface
- **Session Management**: PostgreSQL-backed sessions, configurable timeouts, secure HTTP-only cookies
- **Password Security**: Scrypt hashing with salt

## Streaming Architecture
- **Protocol Support**: WHIP/WHEP for WebRTC streaming
- **External SDK**: SRS (Simple Realtime Server) SDK integration
- **Video Processing**: Real-time codec information and session statistics
- **Media Constraints**: 1280x720 resolution at 30fps with audio
- **SRS Server Configuration**: Supports separate WHIP, WHEP, and Studio server addresses via environment variables (SRS_WHIP_HOST/PORT, SRS_WHEP_HOST/PORT, SRS_STUDIO_HOST/PORT, SRS_API_HOST/PORT) with individual HTTPS settings. Studio server is dedicated to return feed playback for load balancing; falls back to WHEP settings if not configured. Maintains backward compatibility with legacy SRS_HOST configuration. Dynamic `/api/srs/config` endpoint provides all configurations to frontend.
- **Multi-Server Load Balancing**: Round-robin WHIP server assignment for guest links via SRS_WHIP_SERVERS env var (comma-separated host:port list). Each generated link stores its assigned server in the `assigned_server` column. Session pages read the `server` query param to direct WHIP publishing to the assigned server. WHEP viewing for room grids automatically resolves to the same server where the stream was published, ensuring viewers connect to the correct SRS instance. Studio viewer also supports server-aware WHEP playback via the `server` query param. Falls back to default SRS_WHIP_HOST if SRS_WHIP_SERVERS is not configured.
- **Reconnection Handling**: Robust video stream reconnection after chat-to-preview transitions using a React state-based restart system.

## Application Structure
- **Monorepo Layout**: Client, server, and shared code
- **Path Aliases**: Configured for @/, @shared/, and @assets
- **Build Process**: Vite for frontend, esbuild for backend production
- **Deployment**: Comprehensive Docker v2.7 configurations for Ubuntu servers with Nginx reverse proxy, SSL, and automated migrations. Docker files include user registration system, password reset functionality, multi-server WHIP load balancing, TBN Adult Likeness Authorization consent system, Studio server support, and properly support all user roles and guest user fixes.
- **Email Service**: SendGrid integration for professional email invites with clean short link formatting.

## Key Features
- **Link Generation**: Dynamic streaming link creation with QR code support, including short links with a 6-character alphanumeric code system. Links respect expiration settings.
- **Session Management**: Real-time video streaming with WebRTC, including session token system for single-use link security (reusable until link expiration or deletion).
- **Live Chat**: Integrated chat functionality with independent chat sessions for each streaming or viewer link.
- **Email Invites**: Professional email invitation system using SendGrid integration with clean short links (yourapp.com/s/ABC123) for better appearance and trustworthiness.
- **Screen Optimization**: Enhanced layouts with max-width-7xl containers and better space utilization on Home and Generator pages, including responsive 3-column layouts on large screens.
- **Responsive Design**: Mobile-first approach with progressive web app features.
- **Consent System**: Verifiable consent recording for US broadcast compliance. ConsentDialog gates streaming with mandatory acceptance of camera/microphone, recording, broadcast, and privacy policy terms. Consent records include timestamp, IP address, user agent, and full consent text. Admin audit log available in Admin Panel.
- **Privacy Policy**: Comprehensive privacy policy page (/privacy) addressing CCPA, BIPA, FCC regulations for US broadcast streaming.
- **Error Handling**: Comprehensive error boundaries and toast notifications.
- **Productions & Capacity Management**: Named live events with configurable maximum live participant caps (default 128). Guests linked to a production are routed through a real-time waiting room when capacity is full. Automatic promotion via WebSocket when a slot opens; manual promotion from the admin Productions page. Each guest link can be assigned to a production with name and email tracking. WebSocket production tracking (`production_join` message type) in chat-websocket.ts with in-memory state. REST API: `GET/POST/PUT/DELETE /api/productions`, `GET /api/productions/:id/participants`, `POST /api/productions/:id/participants/:linkId/promote`. Admin page at `/productions`. Generator page supports production/guest name/email assignment per link.
- **Production Room Assignment**: Rooms can be assigned to a production via a "Rooms" tab in the Productions admin page. When a participant goes LIVE, they are automatically placed into the first available slot in an assigned room (`room_participants` + `room_stream_assignments`). When they leave/drop, their slot is freed. When a waiting guest is promoted (auto or manual), they take the freed slot. Schema: `rooms.productionId` FK links rooms to a production. API: `GET/PUT /api/productions/:id/rooms`. WebSocket: `liveStreamNames` map and `streamName` in waitingQueue track stream identity for room management across all promotion/eviction paths.
- **Settings (merged into Admin)**: Return feed management is now embedded directly in the Admin page. Includes add, edit, delete of studio return feeds (display name, stream name, optional per-feed server addresses). Each feed supports up to 3 server slots: Primary Server, Fallback Server, and Fallback Server 2 (`fallbackServerAddress2` column in `return_feeds` table). The session page and streaming library chain through all 3 servers on failure. The `return_feeds` table is the single source of truth for feed dropdowns on Generator and Productions pages. Default feeds (Socal 1–6, Plex 1–8) are seeded on first setup.
- **WHEP Server Pool**: Admin page includes a dedicated "Return Feed WHEP Servers" section for managing a pool of servers used exclusively for delivering studio return feeds to guests.
- **Moderator Console**: Dedicated moderator page at `/moderator/:productionId` (admin/engineer only) accessible via a button on the Productions page. Split-pane layout: left sidebar shows all guests with Live/Waiting/Offline status, search, and filter. Right panel has a broadcast bar (sends one message to ALL guest chats simultaneously) and a private 1-on-1 chat view per selected guest. Backend: `POST /api/productions/:id/broadcast` delivers a message to each guest's chat session and pushes it via WebSocket in real time.
- **Aggregated / Group Chat**: Production guests can see each other's messages in a shared public chat feed (YouTube Live-style). Session page shows a "Group Chat" tab (connects all guests in the same production to shared WS session `pub-${productionId}`) alongside a "Private" tab (1-on-1 moderator messages). Messages stored in `chat_messages` with `session_id = pub-${productionId}`. No schema changes required — existing WS session routing handles it. Component: `ProductionPublicChat` in `client/src/components/production-public-chat.tsx`.

## Scalability (500-guest hardening)
- **WebSocket**: O(1) reverse-map lookups (`wsToRegularClientKey`, `wsToNotificationListenerKey`) for disconnect/message handling. `sessionParticipants` Map provides indexed per-session client lookups. Group chat (`pub-*`) sessions skip participant DB tracking and participant-list broadcasts entirely.
- **Database**: Indexes on all high-traffic columns (`chat_participants.session_id`, `chat_messages.session_id`, `room_stream_assignments.room_id/stream_name`, `room_participants.room_id/stream_name`, `generated_links.production_id`, `rooms.production_id`). PostgreSQL pool max set to 30 connections.
- **Broadcast**: Production broadcast uses `Promise.all` for parallel DB inserts across all guest sessions.
- **Connection budget**: Each guest opens max 2 WebSocket connections (1 production + 1 chat tab). Total ~1000 WS for 500 guests.
- **Docker prerequisite**: Set `ulimit -n 65536` for the container to handle 1000+ WS file descriptors.

# External Dependencies

## Core Streaming Services
- **SRS SDK**: Real-time streaming server SDK from cdn2.obedtv.live for WHIP/WHEP protocol implementation.

## Database & Storage
- **Neon Database**: Serverless PostgreSQL hosting.
- **PostgreSQL**: Primary database.

## UI & Design System
- **Radix UI**: UI primitives.
- **Lucide React**: Icon library.
- **Font Awesome**: Icon support.
- **Google Fonts**: Inter font family.

## Development & Build Tools
- **QR Code Generation**: Client-side QR code library.
- **date-fns**: Date formatting.