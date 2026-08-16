OCULogistics — Globe & Route Theme Update
=========================================

This is NOT a full copy of your repo — it's only the files that changed.
Drop these into your existing OCULogistics repo, overwriting the files
at the same paths. Nothing else in your repo (js/admin.js, js/auth.js,
js/firebase-config.js, js/utils.js, js/cloudinary-upload.js,
firestore.rules, assets/, etc.) needs to change — this update only
touches presentation.

FILES IN THIS UPDATE → WHERE THEY GO IN YOUR REPO
--------------------------------------------------
css/style.css     → css/style.css       (overwrite)
js/globe.js       → js/globe.js         (new file — 3D globe)
js/main.js        → js/main.js          (overwrite — globe init + effects)
index.html        → index.html          (overwrite)
papers.html       → papers.html         (overwrite)
notes.html        → notes.html          (overwrite)
articles.html     → articles.html       (overwrite)
events.html       → events.html         (overwrite)
login.html        → login.html          (overwrite)
admin.html        → admin.html          (overwrite)

HOW TO APPLY
------------
1. Copy this update's files into your repo root, replacing the files above.
2. Confirm css/animations.css still exists (unchanged — referenced by style.css).
3. Confirm assets/images/logo.png still exists (referenced by every page).
4. Commit and push / deploy as usual (firebase deploy, if that's your flow).

WHAT CHANGED
------------
Theme: "container terminal at night" — deep navy surfaces, amber signal
lights (#FF8A3D), teal AIS/waypoint accents (#2FD4C6), corner-cut card
geometry referencing ISO shipping-container castings, and a monospace
signal-font pairing (Space Grotesk display + Inter body).

- New interactive 3D globe in the homepage hero (js/globe.js), built with
  Three.js via an ES importmap, showing glowing shipping-route arcs from
  Colombo and Trincomalee (Sri Lanka hubs) to Singapore, Dubai, Shanghai,
  Rotterdam, and Mumbai. Draggable (mouse/touch), auto-rotating, scroll-to-zoom,
  with animated traveling dots, pulsing port markers, hub labels, a starfield,
  and a compass rose. Degrades to an inline animated SVG fallback if Three.js
  can't load.
- Importmap declaration in index.html (three + three/addons from jsdelivr).
  Globe loads as a separate module; main.js initializes it after DOM ready and
  handles re-initialization on resize. If the module fails to load, an inline
  SVG fallback (globe-fallback div) is rendered — contains graticule grid,
  simplified continents, route arcs, animated port dots, and a compass rose.
- Route-themed visual system added to css/style.css:
  * Custom cursor (signal dot + wayfind ring) — consumed by js/effects.js
  * Scroll-reveal classes (.oc-reveal / .oc-revealed) — consumed by js/effects.js
  * Card tilt classes (.oc-tilt) — consumed by js/effects.js
  * Ripple animation (.oc-ripple) — consumed by js/effects.js
  * Hero typing style (.oc-typing-active / .oc-typing-done)
  * Route arc section dividers (animated SVG, amber→teal gradient)
  * Route stat badges (big numbers + pulsing dots: Active Routes, Countries,
    Weekly Shipments, Partner Ports)
  * Route ribbon (hubs in coral, destinations in teal, with arrow separators)
  * Compass badges (used in page headers: Club Dispatches, Scholarly Cargo,
    Crew Logs, Port Arrivals, Command Bridge)
  * Route-bg-grid (faint graticule + route arc behind content sections)
  * Compass rose keyframes, route dot animation for SVG fallbacks
- js/effects.js now wired on every page (index, papers, notes, articles,
  events, login). It provides: custom cursor, hero typing effect, magnetic
  buttons, click ripple, card tilt (3D pointer-follow), scroll-reveal
  (IntersectionObserver), navbar scroll state, and prefers-reduced-motion /
  touch-device guards.
- Page headers given compass-badge labels: "Club Dispatches" (Articles),
  "Scholarly Cargo" (Papers), "Crew Logs" (Notes), "Port Arrivals" (Events),
  "Command Bridge" (Admin sidebar), "Crew Login" (Login).
- Footer unified across all public pages with route-themed section titles:
  "Port of Call" (contact), "Chart Your Course" (quick links), "Follow Our Wake"
  (social).
- Route-bg-grid SVG added behind the About and Latest Posts sections.
- No JavaScript logic changed — every element ID and class your existing
  main.js / admin.js / auth.js depend on is preserved exactly.

STILL OPEN (not part of this design pass)
------------------------------------------
- The Cloudinary upload preset is unsigned, so Firestore's access-level
  rules don't actually protect image uploads (flagged in-code already).
  Fixing this needs a signed preset via a Cloud Function checking the
  caller's ID token — happy to help whenever you want to tackle it.
