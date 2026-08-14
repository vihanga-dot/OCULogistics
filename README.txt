OCULogistics — Ocean Redesign Update
=====================================

This is NOT a full copy of your repo — it's only the files that changed.
Drop these into your existing OCULogistics repo, overwriting the files
at the same paths. Nothing else in your repo (js/main.js, js/admin.js,
js/auth.js, js/firebase-config.js, js/utils.js, js/cloudinary-upload.js,
firestore.rules, assets/, etc.) needs to change — this update only
touches presentation.

FILES IN THIS ZIP → WHERE THEY GO IN YOUR REPO
------------------------------------------------
css/style.css     → css/style.css       (overwrite)
js/globe.js       → js/globe.js         (new file)
index.html        → index.html          (overwrite)
papers.html       → papers.html         (overwrite)
notes.html        → notes.html          (overwrite)
articles.html     → articles.html       (overwrite)
events.html       → events.html         (overwrite)
login.html        → login.html          (overwrite)
admin.html        → admin.html          (overwrite)

HOW TO APPLY
------------
1. Copy this zip's contents into your repo root, replacing the files above.
2. Confirm css/animations.css still exists in your repo (unchanged, not
   included here — style.css and index.html both still reference it).
3. Confirm assets/images/logo.png still exists (referenced by every page).
4. Commit and push / deploy as usual (firebase deploy, if that's your flow).

WHAT CHANGED
------------
- Full visual redesign: bright tropical-ocean palette, Apple-style
  spacious layout (pill buttons, soft shadows, rounded cards, frosted
  nav), Inter font with a system-font (-apple-system/SF Pro) stack.
- New interactive 3D globe in the homepage hero (js/globe.js), built
  with Three.js, showing glowing shipping-route arcs from Colombo and
  Trincomalee to Singapore, Dubai, Shanghai, Rotterdam, and Mumbai.
  Draggable, auto-rotating, degrades gracefully if Three.js fails to load.
  Loaded via CDN in index.html (cdnjs.cloudflare.com + jsdelivr.net) —
  check your CSP/hosting config allows those origins if you have one set.
- Unified footer (contact / quick links / social) across all public pages.
- No JavaScript logic changed — every element ID and class your existing
  main.js / admin.js / auth.js depend on is preserved exactly.

STILL OPEN (not part of this design pass)
------------------------------------------
- The Cloudinary upload preset is unsigned, so Firestore's access-level
  rules don't actually protect image uploads (flagged in-code already).
  Fixing this needs a signed preset via a Cloud Function checking the
  caller's ID token — happy to help whenever you want to tackle it.
