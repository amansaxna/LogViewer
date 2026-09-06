---
name: taste
description: |
  High-taste, production-grade visual design and frontend craftsmanship standard.
  Enforces zero-slop design principles: dark luxury aesthetics, kinetic typography,
  Apple/Linear/Stripe-tier scroll animations, 3D perspective transforms, dynamic lighting,
  tactile micro-interactions, and meticulously balanced spatial composition.
---

# Design Taste & Craftsmanship Standards (Zero-Slop Rulebook)

This skill sets the non-negotiable aesthetic and interaction bar for all web interfaces, landing pages, and component design.

---

## 1. The Anti-Slop Manifesto

### 🚫 What is "AI Design Slop"?
- Generic purple-to-cyan gradient blobs randomly scattered without light source coherence.
- Standard 3-column feature cards with generic placeholder icons in colored circles.
- Centered cookie-cutter layout without spatial tension, depth, or hierarchy.
- Flat, lifeless interactions without hover states, spring physics, or tactile feedback.
- Low-contrast washed-out text (e.g., `#666` on `#111`) or unrefined default typography.

### ✨ What is "High-Taste Craft"?
- **Intentional Depth & Lighting**: Consistent virtual light sources, subtle specular borders (`linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02))`), deep layered shadows with ambient occlusion.
- **Kinetic Choreography**: Elements don't just pop in; they ease in with staggered delays, fluid spring curves (`cubic-bezier(0.16, 1, 0.3, 1)`), and spatial awareness.
- **Type as Architecture**: Monospace accents (`JetBrains Mono`, `Fira Code`) contrasted with tight geometric display sans (`Geist`, `Inter`, `Plus Jakarta Sans`) with `-0.03em` tracking.
- **Physicality & Tactility**: Active states feel tactile with slight press down (`scale(0.98)`), glow pulses, and razor-sharp border highlights.

---

## 2. Core Aesthetic Tokens

### 2.1 Palette: Dark Luxury & Cyberpunk Precision
```css
:root {
  --bg-base: #07090e;
  --bg-surface-1: #0d111a;
  --bg-surface-2: #131824;
  --bg-surface-3: #1a2233;
  --bg-glass: rgba(13, 17, 26, 0.75);
  --border-subtle: rgba(255, 255, 255, 0.07);
  --border-highlight: rgba(255, 255, 255, 0.16);
  --accent-cyan: #00f2fe;
  --accent-blue: #4facfe;
  --accent-purple: #7928ca;
  --accent-emerald: #10b981;
  --accent-amber: #f59e0b;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --font-sans: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

---

## 3. Scroll-Driven Storytelling Architecture

For product walkthroughs and feature reveals:
1. **Pinned Hero Canvas**: Use a `position: sticky; top: 0;` container inside a tall scroll track (e.g. `400vh` or `500vh`).
2. **Dynamic 3D Camera Math**:
   - Initial state: Perspective tilt (`perspective(1200px) rotateX(12deg) scale(0.9)`).
   - Step 1 (Search & Filter): Smooth zoom & pan to Topbar (`transform: translate(20%, 30%) scale(2.2)`).
   - Step 2 (Virtual Log Table): Center focus on row tokens (`transform: translate(0%, -10%) scale(1.8)`).
   - Step 3 (Multi-Panel Grid): Zoom out to reveal 4-Quadrant layout (`transform: translate(0%, 0%) scale(1.0)`).
   - Step 4 (Delta Latency): Focus on bottom-right HUD (`transform: translate(-25%, -25%) scale(2.0)`).
3. **Animated Hotspots & Glowing Callout Beams**:
   - Target regions feature pulsing SVG rings and connecting leader lines that illuminate as their corresponding section enters the viewport.
4. **Progress HUD & Step Indicators**:
   - Monospace step counter (`01 / 04`), vertical progress bar, and clickable quick-jump nav dots.

---

## 4. Code Quality & Craftsmanship Checklist
- [ ] Responsive across 4K, 1440p, 1080p, tablet, and mobile.
- [ ] 60 FPS scroll performance (uses `transform` and `opacity` exclusively for animations).
- [ ] Hardware-accelerated CSS layers (`will-change: transform`).
- [ ] Accessible keyboard navigation and ARIA landmarks.
- [ ] Dark mode first with crisp, clean contrast.
