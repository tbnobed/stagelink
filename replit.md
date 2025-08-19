# Overview

Virtual Audience Platform is a professional live streaming solution built with React and Express that enables real-time video publishing and audience interaction capabilities. The application provides a comprehensive streaming platform with WHIP/WHEP protocol support, live chat integration, and QR code generation for easy session sharing. Users can generate streaming links, manage guest sessions, and interact with live video streams through an intuitive web interface.

## Recent Changes (August 19, 2025)
- Fixed SRS SDK script loading by updating paths to use https://cdn2.obedtv.live:8088/players/js/
- Resolved TypeScript errors for QRCode library integration
- Verified WHIP/WHEP streaming protocols are working correctly with WebRTC connections
- Link generator creates proper URLs formatted as: https://cdn2.obedtv.live:8088/players/session.html?stream=guest1&return=studio1&chat=true

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom Virtual Audience theme variables and dark mode support
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: React Query (@tanstack/react-query) for server state management
- **Form Handling**: React Hook Form with Zod validation schemas

## Backend Architecture  
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Session Storage**: Connect-pg-simple for PostgreSQL-based session storage
- **Development**: Hot reload with Vite middleware in development mode

## Database Design
- **ORM**: Drizzle with PostgreSQL dialect
- **Schema**: Located in shared/schema.ts with Zod integration for validation
- **Migrations**: Managed through Drizzle Kit with migrations stored in ./migrations directory
- **Connection**: Neon Database serverless driver (@neondatabase/serverless)

## Authentication & Authorization
- **Storage Interface**: Abstracted storage layer with in-memory fallback (MemStorage class)
- **User Management**: Basic user schema with username/password authentication
- **Session Handling**: Express sessions with PostgreSQL backing store

## Streaming Architecture
- **Protocol Support**: WHIP/WHEP for WebRTC streaming
- **External SDK**: SRS (Simple Realtime Server) SDK integration
- **Video Processing**: Real-time codec information and session statistics
- **Media Constraints**: 1280x720 resolution at 30fps with audio support

## Application Structure
- **Monorepo Layout**: Client, server, and shared code organization
- **Path Aliases**: Configured for @/, @shared/, and @assets imports
- **Asset Management**: Attached assets directory for static resources
- **Build Process**: Vite for frontend, esbuild for backend production builds

## Key Features
- **Link Generation**: Dynamic streaming link creation with QR code support
- **Session Management**: Real-time video streaming with WebRTC
- **Live Chat**: Integrated chat functionality for audience interaction
- **Responsive Design**: Mobile-first approach with Tailwind responsive utilities
- **Error Handling**: Comprehensive error boundaries and toast notifications

# External Dependencies

## Core Streaming Services
- **SRS SDK**: Real-time streaming server SDK from cdn2.obedtv.live for WHIP/WHEP protocol implementation
- **WebRTC Adapters**: Browser compatibility layer for WebRTC functionality

## Database & Storage
- **Neon Database**: Serverless PostgreSQL hosting platform
- **PostgreSQL**: Primary database with session storage integration

## UI & Design System
- **Radix UI**: Comprehensive set of accessible UI primitives
- **Lucide React**: Icon library for consistent iconography
- **Font Awesome**: Additional icon support for streaming interface
- **Google Fonts**: Inter font family for typography

## Development & Build Tools
- **Replit Integration**: Development environment with error modal and cartographer plugins
- **QR Code Generation**: Client-side QR code library for sharing functionality
- **Date Formatting**: date-fns for temporal data handling

## External CDN Resources
- **jQuery & Utility Libraries**: Legacy support for streaming components
- **Bootstrap CSS**: Styling framework for certain UI elements
- **WebRTC Polyfills**: Cross-browser WebRTC support