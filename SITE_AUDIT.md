# SITE AUDIT: The Petal & Bloom

This document provides a comprehensive technical and visual audit of the "The Petal & Bloom" storefront. It is intended as a blueprint for a UI/UX redesign.

---

## 1. TECH STACK

- **Framework**: React 18.3.1 (Vite 5.4.2)
- **Language**: TypeScript 5.5.3
- **Styling**: Tailwind CSS 3.4.1 (Utility-first approach)
- **UI Libraries**: 
    - `lucide-react` (Icon library)
    - `react-router-dom` (Routing)
- **Backend/CMS**: Supabase (Database & Storage)
- **State Management**: React Context (Cart, Wishlist, Product, SiteAssets, QuickView, Notifications)
- **Fonts**:
    - **Display/Headings**: `"Cormorant Garamond"`, Georgia, serif
    - **Body/UI**: `Inter`, system-ui, sans-serif

---

## 2. SITE MAP

| Route | Page Name | File Path |
| :--- | :--- | :--- |
| `/` | Home | `src/pages/Home.tsx` |
| `/shop` | Shop All | `src/pages/Shop.tsx` |
| `/wishlist` | Wishlist | `src/pages/Wishlist.tsx` |
| `/flowers` | Flowers Category | `src/pages/Flowers.tsx` |
| `/bouquets` | Bouquets Category | `src/pages/Bouquets.tsx` |
| `/gifts` | Gifts Category | `src/pages/Gifts.tsx` |
| `/bags` | Bags Category | `src/pages/Bags.tsx` |
| `/decor` | Home Décor Category | `src/pages/HomeDecor.tsx` |
| `/gift-boxes` | Gift Boxes Category | `src/pages/GiftBoxes.tsx` |
| `/custom` | Custom Orders | `src/pages/CustomOrders.tsx` |
| `/custom-bouquet` | Bouquet Builder | `src/pages/CustomBouquetBuilder.tsx` |
| `/gift-finder` | Gift Finder | `src/pages/GiftFinder.tsx` |
| `/about` | About the Studio | `src/pages/About.tsx` |
| `/care-guide` | Care Guide | `src/pages/CareGuide.tsx` |
| `/shipping` | Shipping & FAQ | `src/pages/ShippingFAQ.tsx` |
| `/contact` | Contact | `src/pages/Contact.tsx` |
| `/product/:code` | Product Detail | `src/pages/ProductDetail.tsx` |
| `/privacy` | Privacy Policy | `src/pages/Privacy.tsx` |
| `/terms` | Terms of Service | `src/pages/Terms.tsx` |
| `/refund` | Refund Policy | `src/pages/Refund.tsx` |
| `/admin/*` | Admin Portal | `src/pages/admin/*` |

---

## 3. PER-PAGE BREAKDOWN

### 🏠 Home Page (`/`)
**Purpose**: Brand storytelling and high-level discovery.

| Section | Purpose | Structure / JSX Snippet |
| :--- | :--- | :--- |
| **Hero** | Immediate value prop | `<section className="relative min-h-screen..."><div className="absolute inset-0"><img src={...} className="...animate-gentle-zoom" /></div><div className="container-lux relative z-10 text-center"><Reveal><p className="section-label...">Handmade in India</p><h1 className="heading-serif...">Flowers that<br />never fade.</h1>...</Reveal></div></section>` |
| **Philosophy** | Emotional connection | `<section className="py-32 lg:py-48 bg-parchment-50"><div className="container-lux"><div className="max-w-4xl mx-auto text-center relative"><Reveal><h2 className="heading-serif...">An Heirloom of Affection.</h2><p className="...">Fresh flowers are a fleeting beauty...</p></Reveal></div></div></section>` |
| **Curation** | Mood-based entry | `<section className="py-32 lg:py-48 bg-silk/50"><div className="container-lux"><SectionHeading ... /><div className="grid grid-cols-1 md:grid-cols-3 gap-12 mt-20">{occasions.slice(0, 3).map(...) => (<Link className="...group relative block overflow-hidden rounded-sm aspect-[4/5]..."><img ... /><div className="absolute bottom-0 left-0 right-0 p-10 text-left"><div className="...">...</div><h3 className="font-serif text-3xl text-parchment-50">{occasion.name}</h3></Link>)}</div></div></section>` |
| **Studio Experience** | Customization CTA | `<section className="py-32 lg:py-48 bg-parchment-50"><div className="container-lux"><div className="grid lg:grid-cols-12 gap-16 items-center"><Reveal className="lg:col-span-7"><div className="relative aspect-[4/5]..."><img ... /></div></Reveal><Reveal className="lg:col-span-5"><p className="section-label">The Studio Table</p><h2 className="heading-serif...">Your flowers.<br />Your story.</h2>...</Reveal></div></div></section>` |
| **Proof/Macro** | Craftsmanship detail | `<section className="py-32 lg:py-48 bg-forest text-parchment-50"><div className="container-lux"><div className="text-center max-w-3xl mx-auto mb-20"><Reveal><p className="section-label text-rose">The Detail</p><h2 className="heading-serif...">Stitch by Stitch.</h2></Reveal></div><div className="grid grid-cols-1 md:grid-cols-3 gap-12">{...}</div></div></section>` |
| **Trust Strip** | Credibility markers | `<section className="py-16 bg-silk/30 border-b border-silk"><div className="container-lux"><div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-8 opacity-80">{trustStrip.map(...) => (<div className="flex items-center gap-4 text-ink-light"><Icon ... /><span className="...">...</span></div>)}</div></div></section>` |
| **Closing CTA** | Conversion | `<section className="py-32 lg:py-48 bg-parchment-50 relative overflow-hidden"><div className="container-lux relative z-10 text-center"><Reveal><h2 className="heading-serif...">Ready to give a gift<br />that stays?</h2><div className="flex flex-col sm:flex-row items-center justify-center gap-8">...</div></Reveal></div></section>` |

---

### 🛍️ Shop Page (`/shop`)
**Purpose**: Product discovery, filtering, and sorting.

| Section | Purpose | Structure / JSX Snippet |
| :--- | :--- | :--- |
| **Header** | Context & SEO | `<PageHeader label="Shop all" title={...} subtitle={...} image={heroImages.secondary} />` |
| **Filters** | Product refinement | `<div className="container-lux pb-12"><div className="flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between"><div className="flex flex-wrap gap-3">{categories.map(...) => (<button className="...">... </button>)}</div><div className="flex items-center gap-4"><button className="...">Customisable only</button>...</div></div><div className="mt-8 flex flex-wrap items-center gap-3">{giftingOccasions.map(...) => (<button className="...">...</button>)}</div></div>` |
| **Product Grid** | Display results | `<div className="container-lux pb-24"><p className="..."> {filtered.length} pieces</p>{filtered.length > 0 ? (<ProductGrid products={filtered} columns={3} />) : (<Reveal>...No blooms found...</Reveal>)}</div>` |

---

### 🌸 Product Detail Page (`/product/:code`)
**Purpose**: Product conversion and detailed information.

| Section | Purpose | Structure / JSX Snippet |
| :--- | :--- | :--- |
| **Breadcrumb** | Navigation back | `<nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-ink-light"><Link to="/shop" className="..."> <ArrowLeft size={16} /> Back to Studio</Link></nav>` |
| **Gallery** | Visual evidence | `<div className="lg:col-span-7"><Reveal><div className="space-y-8"><div className="aspect-[4/5]..."><img src={...} className="..." /></div>{product.images.length > 1 && (<div className="flex gap-4">{product.images.map(...) => (<button ...><img ... /></button>)}</div>)}</div></Reveal></div>` |
| **Info/Purchase** | Conversion tools | `<div className="lg:col-span-5"><Reveal delay={100}><div className="sticky top-32 glass-panel p-8..."><div className="flex items-center gap-3 mb-6 flex-wrap">{badges}</div><p className="...">{product.code}</p><h1 className="heading-serif text-5xl...">{product.name}</h1><div className="flex items-center gap-6 mb-10">...Price...Wishlist</div><div className="space-y-6 mb-10"><p>{product.description}</p></div>...Customization Area...<div className="flex flex-col gap-4">{CTAs}</div></div></Reveal></div>` |
| **Story/Details** | Value add | `<section className="py-24 lg:py-32 bg-parchment-100"><div className="container-lux"><div className="grid md:grid-cols-2 gap-16">{...Suggested For...}{...What is included...}</div></div></section>` |
| **FAQ** | Objection handling | `<section className="py-24 lg:py-32 bg-parchment-50"><div className="container-lux max-w-2xl"><Reveal>...Frequently Asked Questions</Reveal><ContextualFAQ faqs={productFAQs} /></div></section>` |
| **Process Guide** | Trust building | `<section className="py-24 lg:py-32 bg-parchment-100"><div className="container-lux"><Reveal>...From yarn to your doorstep.</Reveal><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8">{howItWorksSteps.map(...) => (<div className="text-center"><p className="font-serif text-4xl...">{step.num}</p>...</div>)}</div></div></section>` |
| **Recently Viewed** | Retention | `<RecentlyViewed excludeCode={product.code} />` |
| **Related** | AOV Increase | `<section className="py-24 lg:py-32 bg-parchment-50"><div className="container-lux"><Reveal>...You may also appreciate</Reveal><div className="grid grid-cols-2 lg:grid-cols-3 gap-8">{relatedProducts.map(...) => (<ProductCard product={p} />)}</div></div></section>` |

---

### 🎁 Gift Finder (`/gift-finder`)
**Purpose**: Interactive guidance for undecided users.

| Section | Purpose | Structure / JSX Snippet |
| :--- | :--- | :--- |
| **Header** | Guidance | `<PageHeader label="Gift Finder" title={<>Help me choose a gift</>} ... />` |
| **Quiz Interface** | Selection logic | `<div className="container-lux max-w-2xl">{step < 3 && (<div className="flex items-center justify-center gap-2 mb-10">{steps.slice(0,3).map(...) => (<div className="...">...</div>)}</div>)} {step === 0 && (<Reveal><h2 className="heading-serif text-3xl text-center mb-8">What's the occasion?</h2><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{occasions.map(...) => (<button className="...">...</button>)}</div></Reveal)}...</div>` |
| **Recommendations**| Conversion | `{isComplete && (<Reveal><div className="text-center mb-8">...Here's what we found...</div>{recommendations.length > 0 ? (<div className="grid grid-cols-2 gap-5">{recommendations.map(...) => (<ProductCard product={p} />)}</div>) : (<div className="...">No blooms found...</div>)}...</div></Reveal>)}` |

---

### 🎨 Bouquet Builder (`/custom-bouquet`)
**Purpose**: High-ticket custom order funnel.

| Section | Purpose | Structure / JSX Snippet |
| :--- | :--- | :--- |
| **Header** | Creative mindset | `<PageHeader label="Studio Table" title={<>Co-create your bloom.</>} ... />` |
| **Studio Manifest** | Live summary | `<div className="lg:col-span-4"><div className="sticky top-32 space-y-8"><div className="glass-panel..."><h3 className="font-serif text-2xl text-ink mb-8">The Composition</h3><div className="space-y-6">{summaryItems}</div><div className="mt-10 pt-8 border-t border-silk..."><span className="font-serif text-4xl text-ink">{formatPrice(estimatedPrice)}</span></div></div></div>` |
| **Tool Tray** | Step-by-step config | `<div className="lg:col-span-8"><div className="max-w-2xl mx-auto"><div className="flex items-center justify-between mb-16">{steps.map(...) => (<div className="...">...</div>)}</div><div className="min-h-[450px]">{step === 0 && (<Reveal>...Determine the scale...<div className="grid grid-cols-2 sm:grid-cols-3 gap-6">{bouquetSizes.map(...) => (<button className="...">...</button>)}</div></Reveal)}...}</div></div>` |

---

### 📖 Static Pages (About, Care, Shipping, Policies)
**Purpose**: Trust and information.

- **About Page**: Uses a linear narrative flow: `Header` $\rightarrow$ `Story` $\rightarrow$ `Values` $\rightarrow$ `Process` $\rightarrow$ `CTA`.
- **Policy Pages**: Uses a shared `PolicyPage` component.
  - **Structure**: `<div className="pt-20 lg:pt-24"><div className="container-lux py-4"><Link to="/" ... /></div><section className="container-lux pb-16"><Reveal><p className="section-label">{label}</p><h1 className="heading-serif text-4xl...">{title}</h1></Reveal><div className="max-w-2xl space-y-8">{sections.map(...) => (<div><h2 className="font-serif...">{section.heading}</h2>{section.body.map(...) => (<p className="...">...</p>)}</div>)}</div></section></div>`

---

## 4. DESIGN TOKENS

### 🎨 Color Palette
| Token | Hex | Application |
| :--- | :--- | :--- |
| `parchment-50` | `#F9F7F2` | Primary backgrounds, light surfaces |
| `ink` | `#3C473E` | Primary text, headings |
| `ink-light` | `#5A665D` | Body text, labels |
| `rose` | `#BFA3A3` | Primary accent, highlights, CTA elements |
| `sage` | `#A3B18A` | Secondary accent, "customisable" badges |
| `forest` | `#2A3D31` | Dark sections, footer background |
| `silk` | `#F2E8DF` | Border colors, subtle backgrounds, muted highlights |
| `charcoal` | `#1C1E1B` | Darkest text/accents |
| `brown-400` | `#6f5d4c` | Muted labels, placeholder text |

### ✍️ Typography
- **Display (Serif)**: `"Cormorant Garamond"`
    - `text-6xl` to `text-9xl` (Hero headings)
    - `text-3xl` to `text-5xl` (Section headings)
    - `italic` used for emotional aural markers.
- **Body (Sans)**: `Inter`
    - `text-sm` to `text-lg` (Body content)
    - `text-[10px]` with `tracking-wider` (Section labels)

### 📏 Spacing & Layout
- **Container**: `.container-lux` (custom max-width centering).
- **Vertical Rhythm**: `py-16`, `py-24`, `py-32`, `py-48` for section spacing.
- **Breakpoints**: Standard Tailwind (`sm`, `md`, `lg`).
- **Borders**: `rounded-sm` (sharp, minimalist corners) across almost all components.

### ✨ Effects
- **Glassmorphism**: `.glass-panel` (semi-transparent backgrounds with blur).
- **Animations**:
    - `fade-in`, `fade-up`, `slide-in` (0.6s - 1.5s durations).
    - `gentle-zoom` (8s loop for hero images).
- **Shadows**: `.shadow-soft` (light, diffuse shadows for luxury feel).

---

## 5. COMPONENT INVENTORY

| Component | Path | Purpose | Code Snippet (Key Logic) |
| :--- | :--- | :--- | :--- |
| **Navbar** | `src/components/Navbar.tsx` | Global nav, search, cart/wishlist triggers | `Header` with `fixed top-0`, `glass-panel` on scroll, and an absolute-positioned search results overlay. |
| **Footer** | `src/components/Footer.tsx` | Global links, brand info, social | `bg-ink-dark` with a 4-column grid for Brand, Explore, Info, and Connect. |
| **ProductCard**| `src/components/ProductCard.tsx`| Visual unit for products | `aspect-[4/5]` image, `font-serif` title, `formatPrice` helper for pricing. |
| **Reveal** | `src/components/Reveal.tsx` | Scroll-triggered animations | Wrapper using `IntersectionObserver` to trigger CSS animations when element enters viewport. |
| **PageHeader** | `src/components/PageHeader.tsx` | Standardized page intro | `label`, `title`, `subtitle`, and a large `image` as a background or accent. |
| **WhatsAppButton**| `src/components/WhatsAppButton.tsx`| Primary conversion tool | Dynamic link generation via `buildWhatsAppLink` with configurable labels and variants. |
| **ProductGrid** | `src/components/ProductGrid.tsx` | Layout for product lists | Flex/Grid wrapper that maps `ProductCard` components. |

---

## 6. NAVIGATION & LAYOUT

### Header Structure
- **Desktop**: Logo $\rightarrow$ Navigation Links $\rightarrow$ Action Icons (Search, Wishlist, Cart) $\rightarrow$ Gift Concierge Button.
- **Mobile**: Logo $\rightarrow$ Action Icons $\rightarrow$ Hamburger Menu.
- **Mobile Menu**: Slide-in overlay from the right (`animate-slide-in`) containing nav links and a WhatsApp CTA.

### Footer Structure
- **Columns**: Brand Story $\rightarrow$ Explore (Shop) $\rightarrow$ Information (Policies) $\rightarrow$ Connect (Social/Hours).
- **Bottom Bar**: Copyright $\rightarrow$ "Made with heart and yarn" credit.

### Shared Wrappers
- **AppContent**: Wraps all routes; conditionally renders `Navbar`, `MobileBottomNav`, and `Footer` based on whether the route is an admin route.
- **Main**: `min-h-screen` with bottom padding (`pb-16 sm:pb-0`) to avoid content overlap with the `MobileBottomNav`.

---

## 7. IMAGERY & ASSETS

- **Sources**:
    - **Local**: `/logo.jpeg` (Public folder).
    - **Static Config**: `src/data/site.ts` contains `heroImages` and `instagramPosts` as static URLs (mostly Pexels/external).
    - **Dynamic**: `SiteAssetsContext` fetches `section_key` and `image_url` from Supabase Storage, allowing the admin to update home page images without code changes.
- **Aspect Ratios**:
    - **Product/Occasion Images**: `aspect-[4/5]` (Portrait) - maintains a consistent gallery feel.
    - **Hero Images**: `object-cover` filling the container, often with `animate-gentle-zoom`.

---

## 8. CURRENT KNOWN ISSUES

- **Hardcoded Admin Logic**: The `App.tsx` uses `pathname.startsWith('/admin')` for conditional rendering. This is functional but could be abstracted into a layout component.
- **Image Fallbacks**: Some `ProductDetail` images use a hardcoded Pexels URL as a fallback, which may not always match the product's aesthetic.
- **Styling Inconsistencies**: Most pages use `bg-parchment-50`, but some sections use `bg-silk/50` or `bg-parchment-100`. This is intentional for "zoning" but may feel fragmented during a redesign.
- **Mobile Nav Redundancy**: The site has both a hamburger menu in the `Navbar` and a `MobileBottomNav`. This might be over-servicing navigation on small screens.
