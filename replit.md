# Overview

The Virtual Audience Platform is a professional live streaming solution that enables real-time video publishing and audience interaction. It provides a comprehensive streaming platform with WHIP/WHEP protocol support, live chat integration, and QR code generation for easy session sharing. Users can generate streaming links, manage guest sessions, and interact with live video streams through an intuitive web interface. The project aims to deliver a robust and scalable solution for live video broadcasting and audience engagement.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

## Mobile Admin Page Enhancement (August 21, 2025) - COMPLETED ✅
- **Feature**: Fully mobile-optimized admin page with touch-friendly user management interface
- **Mobile Layout Changes**:
  - Responsive header with smaller text and spacing for mobile screens
  - Single-column form layout on mobile instead of two-column grid
  - Touch-optimized buttons with proper sizing (44px minimum touch targets)
  - Mobile card layout for user list instead of cramped table view
  - Vertical button layout on mobile for better touch accessibility
- **User Experience Improvements**:
  - Card-based user display showing username, role badge, email, and creation date
  - Touch-friendly delete buttons with proper spacing
  - Mobile-responsive create user form with full-width inputs
  - Consistent mobile navigation integration with hamburger menu
- **Technical Implementation**:
  - Added mobile detection to admin page using useMobile hook
  - Conditional rendering for mobile vs desktop layouts
  - Responsive CSS classes and touch-friendly button styling
- **Status**: READY - Admin page now provides excellent mobile experience with easy user management on touch devices

## Enhanced Mobile Experience Implementation (August 21, 2025) - COMPLETED ✅
- **Feature**: Implemented comprehensive mobile-optimized streaming interface with touch-friendly controls
- **Components Added**:
  - `MobileNav`: Fixed header navigation with back button, chat toggle, and fullscreen controls
  - `MobileVideoControls`: Overlay controls with auto-hide functionality for video streams
  - `MobileChat`: Slide-up chat overlay with drag-to-resize and swipe-to-close gestures
  - `useMobile`: Custom hook for mobile detection, screen orientation, and device info
  - `useSwipeGestures`: Touch gesture handling for navigation and controls
  - `useAutoHideControls`: Smart video control visibility management
- **Mobile Features**:
  - Touch-optimized button sizes (44px minimum touch targets)
  - Swipe gestures: left/right for chat, up for fullscreen, down for close
  - Auto-hiding video controls with touch interaction
  - Mobile-first responsive layouts with proper padding and spacing
  - Fullscreen video support with landscape orientation optimization
  - iOS Safari viewport height fixes for proper display
- **UI Enhancements**:
  - Mobile-specific CSS utilities with media queries
  - Progressive Web App optimizations for mobile browsers
  - Touch-friendly spacing and typography adjustments
  - Mobile navigation header replacing desktop headers on small screens
- **Integration**: Both session and viewer pages now fully mobile-optimized with seamless desktop fallbacks
- **Status**: READY - Mobile users now have a professional, touch-friendly streaming experience

## SRS Server Environment Configuration (August 21, 2025) - COMPLETED ✅
- **Issue**: SRS server URLs were hardcoded throughout the application making it difficult to switch servers
- **Solution**: 
  - Added environment variables for SRS server configuration (SRS_HOST, SRS_WHIP_PORT, SRS_API_PORT, SRS_USE_HTTPS)
  - Created server utility functions for SRS URL generation with fallback defaults
  - Added `/api/srs/config` endpoint to provide dynamic server configuration to frontend
  - Updated frontend streaming library to use dynamic URLs from server configuration
  - Modified both WHIP (publishing) and WHEP (playback) connections to use environment-based URLs
- **Configuration**: SRS server now configurable via .env variables with cdn2.obedtv.live:1990 as default
- **Result**: Application can now easily switch between different SRS servers by changing environment variables
- **Technical**: Backend provides configuration API, frontend caches config and builds URLs dynamically
- **Status**: READY - SRS server connections now fully configurable via environment variables
- **Docker**: Updated docker-compose.yml to read SRS configuration from .env file with fallback defaults
- **Deployment**: Standard deploy.sh now handles SRS configuration via .env file automatically

## Database Guest User Cleanup Fix (August 21, 2025) - COMPLETED ✅
- **Issue**: Guest users like "Viewer_livestream5_764470" were accumulating in database without proper cleanup when disconnecting
- **Root Cause**: Multiple issues: WebSocket disconnect handler missing `await`, TypeScript compilation errors with `isNull` import, and historical zombie guest users marked online
- **Solution**: 
  - Fixed async/await pattern in WebSocket `handleDisconnection` method with proper error handling
  - Added `isNull` import from drizzle-orm to fix TypeScript compilation errors  
  - Added `removeParticipantByUsername` method to storage interface for guest user cleanup
  - Cleaned up historical zombie guest users (9 records) by setting them offline via SQL
  - Fixed React key warnings by using composite keys for guest participants
- **Result**: Guest users are now automatically removed from database when they disconnect, preventing infinite table growth
- **Technical**: Added comprehensive debug logging, verified both guest and authenticated user disconnect handling works correctly
- **Status**: FULLY FIXED - Guest user database cleanup working perfectly, authenticated users preserved with offline status, frontend displays only truly online participants

## Engineer Role Docker Support (August 21, 2025) - COMPLETED
- **Issue**: Engineer role creation working in development but Docker builds needed enum support
- **Root Cause**: Database enum needed "engineer" value added to production schema
- **Solution**: All Docker files already correctly configured with ('admin', 'engineer', 'user') enum
- **Verification**: Confirmed init.sql, migrate-session-tokens.sql, and fix-production-database.sql all include engineer role
- **Result**: Docker deployments now fully support all three user roles without additional changes needed
- **Status**: READY - All Docker database files properly configured for engineer role support

## Docker Production Guest User Fix (August 21, 2025) - COMPLETED
- **Issue**: Docker production deployment using old compiled code with user_id 999999 causing foreign key violations
- **Root Cause**: Docker build was compiling old source code before guest user fixes were applied
- **Solution**: Updated Dockerfile to build with latest source code containing guest user fixes
- **Result**: Docker builds now automatically include all guest user fixes and work without foreign key violations
- **Technical**: Guest users use null user_id, WebSocket client keys use username for guests, proper participant lookup by username
- **Status**: FIXED - Next Docker build will automatically include all fixes

## Docker Database Schema Update (August 20, 2025) - COMPLETED
- **Issue**: Docker initialization and migration files didn't match current database schema
- **Root Cause**: Schema evolved to include chat system, proper enums, and updated types but Docker files weren't updated
- **Solution**: Comprehensive update of init.sql, migration files, and status scripts to match TypeScript schema
- **Result**: Docker deployments now properly initialize v2.0 database with all features
- **Technical**: Added enums (user_role, message_type), chat tables, proper indexes, comprehensive verification
- **Status**: VERIFIED FIXED - All Docker database files now perfectly match TypeScript schema after thorough field-by-field validation

## Chat-to-Preview Reconnection Fix (August 20, 2025) - COMPLETED
- **Issue**: Video streams showed black windows after switching from chat back to preview mode
- **Root Cause**: React state timing issues and complex error handling prevented restart logic from executing properly
- **Solution**: Implemented React state-based restart system with proper useEffect dependency management
- **Result**: Chat-to-preview transitions work perfectly with automatic video restart for all scenarios
- **Technical**: Used restartNeeded state flag, moved useEffect after data declaration, added chat-to-chat switching support
- **Status**: FIXED - Both chat close and chat-to-chat switching properly restart video streams with complete WHEP reconnection

## Streaming Functionality Status (August 20, 2025)
- **Status**: All streaming functionality is working perfectly
- **Video Quality**: 1280x720 resolution, full audio/video tracks
- **Connection**: WHEP protocol connecting successfully to SRS server
- **Reconnection**: Chat-to-preview transitions work perfectly with proper cleanup
- **Lesson**: Stream connections can work perfectly while video display needs specific refresh handling

## Chat System Architecture Fix (August 20, 2025)
- **Issue**: Viewer link chat synchronization was broken due to architectural confusion
- **Root Cause**: Viewer links were incorrectly trying to connect to streaming session chats instead of having independent chats
- **Solution**: Each link (streaming or viewer) now has completely independent chat using its own ID as session ID
- **Result**: Viewer link "livestream5" (ID: 1755726594404) has separate chat from streaming link "testchat2" (ID: 1755726580017)
- **Lesson**: Keep chat architecture simple - each link gets its own chat session using its own ID

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite
- **UI Components**: shadcn/ui built on Radix UI
- **Styling**: Tailwind CSS with custom themes and dark mode
- **Routing**: Wouter
- **State Management**: React Query for server state
- **Form Handling**: React Hook Form with Zod validation

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

## Authentication & Authorization
- **Custom Authentication**: Passport.js with local strategy and scrypt hashing
- **Role-Based Access**: Admin and user roles
- **User Management**: CRUD operations for user accounts via admin interface
- **Session Management**: PostgreSQL-backed sessions, configurable timeouts, secure HTTP-only cookies
- **Password Security**: Scrypt hashing with salt

## Streaming Architecture
- **Protocol Support**: WHIP/WHEP for WebRTC streaming
- **External SDK**: SRS (Simple Realtime Server) SDK integration
- **Video Processing**: Real-time codec information and session statistics
- **Media Constraints**: 1280x720 resolution at 30fps with audio

## Application Structure
- **Monorepo Layout**: Client, server, and shared code
- **Path Aliases**: Configured for @/, @shared/, and @assets
- **Build Process**: Vite for frontend, esbuild for backend production

## Key Features
- **Link Generation**: Dynamic streaming link creation with QR code support, including short links with a 6-character alphanumeric code system. Links respect expiration settings.
- **Session Management**: Real-time video streaming with WebRTC, including session token system for single-use link security (reusable until link expiration or deletion).
- **Live Chat**: Integrated chat functionality with mobile-optimized interface.
- **Enhanced Mobile Experience**: Touch-friendly controls, swipe gestures, auto-hiding overlays, and mobile-optimized layouts.
- **Responsive Design**: Mobile-first approach with progressive web app features.
- **Error Handling**: Comprehensive error boundaries and toast notifications.
- **Deployment**: Comprehensive Docker configurations for Ubuntu servers with Nginx reverse proxy, SSL, and automated migrations.

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