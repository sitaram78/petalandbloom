₹# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands
- **Dev Server**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Typecheck**: `npm run typecheck`
- **Preview**: `npm run preview`

## Architecture & Structure
The project is a Vite-powered React application using TypeScript and Tailwind CSS.

### Core Architecture
- **Dynamic Catalog**: A Supabase-driven system manages categories and navigation links, allowing for real-time updates via the Admin Management Suite.
- **Global State**: Managed via React Context for core features:
    - `CartContext`: Handles the "Bloom Bag" (shopping cart) and enquiry logic.
    - `WishlistContext`: Manages saved items.
    - `QuickViewContext`: Controls the product quick-view modal.
    - `ProductContext`: Manages product catalog and lookup logic.
    - `SiteAssetsContext`: Manages dynamic site-wide background images and brand assets via Supabase Storage.
    - `NavigationContext`: Manages the dynamic, hierarchical menu structure fetched from Supabase.
- **Routing**: Single Page Application (SPA) architecture using `react-router-dom`.

### Component Hierarchy
- `src/components`: Shared UI building blocks (e.g., `ProductCard`, `Navbar`, `Footer`).
- `src/pages`: Top-level view components.
- `src/hooks`: Custom logic (e.g., `useReveal` for scroll-triggered animations, `useRecentlyViewed`, `useClickOutside`).
- `src/utils`: Helper functions for WhatsApp link generation and analytics.
- `src/utils/productSearch.ts`: Centralized product filtering and search logic used across the application.
- `src/utils/cache.ts`: LocalStorage caching utility with TTL for performance optimization.

### Visual Identity (The Botanical Studio)
The project implements a "Sophisticated Minimalist" luxury experience:
- **Palette**: Linen White base, Deep Slate Green text, with Muted Blush and Silver Sage accents.
- **Typography**: High-contrast Serif for display headings, Geometric Sans for body text.
- **UX Pattern**: Focused on a "Gallery" experience with curated narrative flows and minimal, intentional animations.

## Current Roadmap (Studio Evolution)
- [x] **Stability**: Fixing routing, product rendering, and asset paths.
- [ ] **Dynamic Infrastructure**: Completing the hierarchical navigation system (Infrastructure done; Navbar and Admin Manager pending).
- [x] **Visual Overhaul**: Implementing the "High-End Atelier" minimalist design.
- [x] **Asset Management**: Implementing dynamic site background photos via Supabase Storage and Admin Panel.
- [x] **Performance**: Implementing hybrid caching for products and assets to reduce API latency.
- [ ] **Studio Experience**: (Skipped) Gift Concierge Quiz, Studio Secrets, and Mood Discovery.
