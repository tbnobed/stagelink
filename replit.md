# Overview

Virtual Audience Platform is a professional live streaming solution built with React and Express that enables real-time video publishing and audience interaction capabilities. The application provides a comprehensive streaming platform with WHIP/WHEP protocol support, live chat integration, and QR code generation for easy session sharing. Users can generate streaming links, manage guest sessions, and interact with live video streams through an intuitive web interface.

## Recent Changes (August 19, 2025)
- Fixed SRS SDK script loading by updating paths to use https://cdn2.obedtv.live:8088/players/js/
- Resolved TypeScript errors for QRCode library integration
- Verified WHIP/WHEP streaming protocols are working correctly with WebRTC connections
- Updated link generator to point to current Replit server instead of external CDN
- Removed stats section from homepage per user request
- Generated links now use dynamic host: window.location.host/session?stream=guest1&return=studio1&chat=true
- Created new Links page with WHEP preview functionality for managing generated links
- Preview shows the guest stream (WHIP stream) not the return feed, so you can see what the guest will broadcast
- Added dedicated Viewer page (/viewer) for full-screen WHEP playback of guest streams
- "Open" button in Links page now opens full-screen viewer instead of guest session page
- Added "Copy Ingest Link" button that generates RTMP ingest URLs: rtmp://cdn2.obedtv.live/live/{StreamName}
- Replaced Guest Session card with Links card on the home page per user request
- Removed Session link from main navigation menu
- Added link expiration functionality with configurable durations (1 hour to 1 week, custom, or never)
- Automatic cleanup of expired links on page load with user notification
- Added "Remove Expired Links" button for manual cleanup
- Links display expiration status with countdown timers and color-coded badges
- Created comprehensive Docker deployment configuration for Ubuntu servers
- Added multi-stage Dockerfile with production optimizations and security hardening
- Configured Nginx reverse proxy with SSL termination, rate limiting, and caching
- Created PostgreSQL database with initialization scripts and health checks
- Added automated deployment script with SSL certificate generation
- Implemented health check endpoint for container monitoring
- Fixed Docker build issues by creating dedicated production server without vite dependencies
- Resolved module resolution errors in production environment
- Updated build commands to use npx for proper CLI tool execution
- Fixed production server path resolution using process.cwd() instead of import.meta.dirname
- Resolved Docker container startup issues with proper static file serving
- Fixed localStorage issue preventing links from being shared across users/browsers
- Migrated link storage from localStorage to server-side API with in-memory storage
- Added REST API endpoints for links: GET /api/links, POST /api/links, DELETE /api/links/:id
- Updated frontend to use React Query for server state management instead of localStorage
- Links are now visible to all users accessing the application on any browser
- Updated Docker deployment with improved build process and health checks
- Added comprehensive API testing script and deployment verification
- Enhanced deployment documentation with v2.0 features and troubleshooting
- Created .env.example for easier configuration management
- Fixed QR code generation issues by replacing window.QRCode with proper npm package
- Added production Docker compose configuration with resource limits
- Enhanced deployment scripts to verify QR code package installation
- Fixed link persistence issue by implementing PostgreSQL database storage instead of in-memory storage
- Links now persist across application restarts and server reboots
- Migrated from MemStorage to DatabaseStorage with proper database schema

### Authentication System Implementation (August 19, 2025)
- Implemented complete custom authentication system with Passport.js using scrypt password hashing
- Added role-based access control with admin and user roles
- Created comprehensive user management interface for admins to create/delete users
- Added protected routes requiring login to access core streaming features
- Built authentication pages with both login and registration forms
- Created user profile page with secure password change functionality
- Added user dropdown menu in navigation with logout and profile access
- Updated Docker deployment files to support authentication with SESSION_SECRET configuration
- Enhanced database schema with users table, session storage, and proper foreign key relationships
- Default admin account created on startup (username: admin, password: password - must be changed)
- All passwords securely hashed using scrypt algorithm with salt for maximum security
- Session management using PostgreSQL storage for production scalability
- Created comprehensive authentication deployment guide (DEPLOYMENT_AUTH.md)

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
- **Custom Authentication**: Passport.js with local strategy using scrypt password hashing
- **Role-Based Access**: Admin and user roles with protected routes and middleware
- **User Management**: Complete CRUD operations for user accounts with admin interface
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple for scalability
- **Password Security**: Scrypt hashing with salt, secure password comparison, and change functionality
- **Session Management**: Configurable session timeouts and secure HTTP-only cookies

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