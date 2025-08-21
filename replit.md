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
- **SRS Server Configuration**: Configurable via environment variables (SRS_HOST, SRS_WHIP_PORT, SRS_API_PORT, SRS_USE_HTTPS) with a dynamic `/api/srs/config` endpoint for frontend.
- **Reconnection Handling**: Robust video stream reconnection after chat-to-preview transitions using a React state-based restart system.

## Application Structure
- **Monorepo Layout**: Client, server, and shared code
- **Path Aliases**: Configured for @/, @shared/, and @assets
- **Build Process**: Vite for frontend, esbuild for backend production
- **Deployment**: Comprehensive Docker configurations for Ubuntu servers with Nginx reverse proxy, SSL, and automated migrations. Docker files are updated to match the current database schema and properly support all user roles and guest user fixes.

## Key Features
- **Link Generation**: Dynamic streaming link creation with QR code support, including short links with a 6-character alphanumeric code system. Links respect expiration settings.
- **Session Management**: Real-time video streaming with WebRTC, including session token system for single-use link security (reusable until link expiration or deletion).
- **Live Chat**: Integrated chat functionality with independent chat sessions for each streaming or viewer link.
- **Responsive Design**: Mobile-first approach with progressive web app features.
- **Error Handling**: Comprehensive error boundaries and toast notifications.

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