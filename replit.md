# Overview

The Virtual Audience Platform is a professional live streaming solution that enables real-time video publishing and audience interaction. It provides a comprehensive streaming platform with WHIP/WHEP protocol support, live chat integration, and QR code generation for easy session sharing. Users can generate streaming links, manage guest sessions, and interact with live video streams through an intuitive web interface. The project aims to deliver a robust and scalable solution for live video broadcasting and audience engagement.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

## Chat-to-Preview Reconnection Fix (August 20, 2025)
- **Issue**: Video streams showed black windows after switching from chat back to preview mode
- **Root Cause**: Complex video event handlers and overlay system interfering with video rendering despite perfect WHEP connections
- **Solution**: Simplified video element by removing all complex event handlers and overlay logic, implementing clean stop/restart cycle
- **Result**: Chat-to-preview transitions now work with proper video display and streaming connections
- **Technical**: Used simple video element with unique key, complete stopPreview/previewStream cycle, removed interference
- **Status**: Video streaming and reconnections working with 720x1280 quality display

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
- **Live Chat**: Integrated chat functionality.
- **Responsive Design**: Mobile-first approach.
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