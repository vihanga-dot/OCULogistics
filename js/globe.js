/* =========================================================================
   js/globe.js — Interactive 3D Earth with glowing shipping-route arcs
   Ports: Colombo & Trincomalee (Sri Lanka) → Singapore, Dubai,
           Shanghai, Rotterdam, Mumbai.
   Loaded as an ES module from index.html. Degrades gracefully if
   Three.js fails to load (shows a static SVG fallback).
   ========================================================================= */

const PORTS = [
  { name: 'Colombo',        lat:  6.9271, lon:  79.8652, country: 'Sri Lanka',  hub: true  },
  { name: 'Trincomalee',    lat:  8.5950, lon:  81.2130, country: 'Sri Lanka',  hub: true  },
  { name: 'Singapore',      lat:  1.3521, lon: 103.8198, country: 'Singapore' },
  { name: 'Dubai',          lat:  25.2048, lon:  55.2708, country: 'UAE' },
  { name: 'Shanghai',       lat:  31.2304, lon: 121.4737, country: 'China' },
  { name: 'Rotterdam',      lat:  51.9244, lon:  4.4777, country: 'Netherlands' },
  { name: 'Mumbai',         lat:  19.0760, lon:  72.8777, country: 'India' },
];

// Hub → destination arcs (the "shipping routes")
const ARCS = [
  ['Colombo',    'Singapore'],
  ['Colombo',    'Dubai'],
  ['Colombo',    'Shanghai'],
  ['Colombo',    'Rotterdam'],
  ['Colombo',    'Mumbai'],
  ['Trincomalee','Singapore'],
  ['Trincomalee','Mumbai'],
  ['Trincomalee','Dubai'],
];

const EARTH_RADIUS = 1;
const GLOBE_DIVS   = 64;

function latLonToVec3(lat, lon) {
  const phi   = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -EARTH_RADIUS * Math.sin(phi) * Math.cos(theta),
     EARTH_RADIUS * Math.cos(phi),
     EARTH_RADIUS * Math.sin(phi) * Math.sin(theta)
  );
}

function buildArcPoints(a, b, segments = 60) {
  const vA = latLonToVec3(a.lat, a.lon);
  const vB = latLonToVec3(b.lat, b.lon);
  // Height factor: 2.6× for near arcs, 3.4× for trans-ocean (longer great-circle)
  const dist = vA.distanceTo(vB);
  const height = dist > 1.8 ? 3.4 : 2.6;
  const mid = vA.clone().add(vB).multiplyScalar(height);
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const f = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
    pts.push(vA.clone().lerp(mid, f).lerp(vB, t));
  }
  return pts;
}

// ── Texture loader (runs immediately; globe renders once texture arrives) ──
function loadEarthTexture() {
  return new Promise((resolve) => {
    const urls = [
      'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
      'https://unpkg.com/three-globe@2.24.1/example/img/earth-blue-marble.jpg',
    ];
    let tried = 0;
    const tryNext = () => {
      const url = urls[tried];
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => resolve(img);
      img.onerror = () => { tried++; if (tried < urls.length) tryNext(); else resolve(null); };
      img.src = url;
    };
    tryNext();
  });
}

// ── Main globe class ────────────────────────────────────────────────────────
export class ShippingGlobe {
  constructor(container) {
    this.container  = container;
    this.renderer   = null;
    this.scene      = null;
    this.camera     = null;
    this.globe      = null;
    this.arcs       = [];
    this.dots       = [];
    this.pulses     = [];
    this.raycaster  = new THREE.Raycaster();
    this.mouse      = new THREE.Vector2();
    this.isSpinning = true;
    this.spinSpeed  = 0.0012;
    this.clock      = new THREE.Clock();
    this.initialized = false;

    this._setup();
  }

  _setup() {
    const rect = this.container.getBoundingClientRect();
    const W = Math.max(rect.width, 320);
    const H = Math.max(rect.height, 320);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(W, H);
    this.renderer.setClearColor(0x070d18, 0);
    this.container.appendChild(this.renderer.domElement);

    // Scene + camera
    this.scene    = new THREE.Scene();
    this.camera   = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    this.camera.position.set(0, 0.6, 2.8);

    // Starfield
    const starGeo  = new THREE.BufferGeometry();
    const starCount = 1400;
    const starPos  = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) starPos[i] = (Math.random() - 0.5) * 60;
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x93a6ba, size: 0.035, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    this.scene.add(new THREE.Points(starGeo, starMat));

    // Ambient + point light
    this.scene.add(new THREE.AmbientLight(0x404060, 0.6));
    const keyLight = new THREE.PointLight(0xffd9a0, 1.6, 8);
    keyLight.position.set(2, 3, 4);
    this.scene.add(keyLight);
    const fillLight = new THREE.PointLight(0x2fd4c6, 0.6, 8);
    fillLight.position.set(-2, -1, 3);
    this.scene.add(fillLight);

    // Glow ring (visible from outside the globe)
    const glowGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.045, GLOBE_DIVS, GLOBE_DIVS);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x2fd4c6, transparent: true, opacity: 0.09,
      side: THREE.BackSide, wireframe: false
    });
    this.scene.add(new THREE.Mesh(glowGeo, glowMat));

    // Arc glow ring (slightly larger, teal tint)
    const glowGeo2 = new THREE.SphereGeometry(EARTH_RADIUS * 1.07, GLOBE_DIVS, GLOBE_DIVS);
    const glowMat2 = new THREE.MeshBasicMaterial({
      color: 0xff8a3d, transparent: true, opacity: 0.05,
      side: THREE.BackSide
    });
    this.scene.add(new THREE.Mesh(glowGeo2, glowMat2));

    // Earth — show a solid coloured sphere immediately; swap to texture when loaded
    const solidGeo = new THREE.SphereGeometry(EARTH_RADIUS, GLOBE_DIVS, GLOBE_DIVS);
    const solidMat = new THREE.MeshStandardMaterial({
      color: 0x1a3a5c, roughness: 0.7, metalness: 0.1
    });
    this.globe = new THREE.Mesh(solidGeo, solidMat);
    this.scene.add(this.globe);

    loadEarthTexture().then(textureImg => {
      if (!textureImg || !this.globe) return;
      const tex = new THREE.Texture(textureImg);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      this.globe.material = new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.55, metalness: 0.05
      });
    });

    // Draw arcs + port markers
    this._drawArcs();
    this._drawPorts();

    // Interaction
    this._bindEvents();

    this.initialized = true;
    this._animate();
  }

  _drawArcs() {
    const visited = new Set();
    ARCS.forEach(([fromName, toName]) => {
      const from = PORTS.find(p => p.name === fromName);
      const to   = PORTS.find(p => p.name === toName);
      if (!from || !to) return;
      const key  = [fromName, toName].sort().join('|');
      const isMain = !visited.has(key) && from.hub;
      visited.add(key);

      const ptsArray = buildArcPoints(from, to);
      const geometry  = new THREE.BufferGeometry().setFromPoints(ptsArray);

      // Main arcs: amber/orange glow. Secondary arcs: teal, dashed, fainter.
      const color  = isMain ? 0xff8a3d : 0x2fd4c6;
      const opacity = isMain ? 0.85 : 0.35;
      const width  = isMain ? 1.6 : 0.8;

      const mat = new THREE.LineBasicMaterial({
        color, transparent: true, opacity,
        linewidth: width
      });
      const line = new THREE.Line(geometry, mat);
      this.scene.add(line);
      this.arcs.push({ line, from, to, isMain, pts: ptsArray });

      // Glow ribbon for main arcs (additive, wider, faint)
      if (isMain) {
        const glowMat = new THREE.LineBasicMaterial({
          color: 0xff5a1f, transparent: true, opacity: 0.28,
          blending: THREE.AdditiveBlending, depthWrite: false
        });
        const glowLine = new THREE.Line(geometry.clone(), glowMat);
        this.scene.add(glowLine);
      }

      // Dots travelling along the arc
      const dotCount = isMain ? 4 : 1;
      for (let d = 0; d < dotCount; d++) {
        const dotGeo = new THREE.SphereGeometry(0.018, 12, 12);
        const dotMat = new THREE.MeshBasicMaterial({
          color: isMain ? 0xff8a3d : 0x2fd4c6,
          transparent: true, opacity: 0.95
        });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        this.scene.add(dot);

        // Glow halo around dot
        const haloGeo = new THREE.SphereGeometry(0.035, 12, 12);
        const haloMat = new THREE.MeshBasicMaterial({
          color: isMain ? 0xff6a2d : 0x2fd4c6,
          transparent: true, opacity: 0.35,
          blending: THREE.AdditiveBlending, depthWrite: false
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        this.scene.add(halo);

        const phase   = (d / dotCount) * 0.8 + Math.random() * 0.15;
        const speed   = 0.07 + Math.random() * 0.04;
        this.dots.push({ dot, halo, from, to, phase, speed, isMain, pts: ptsArray });
      }
    });
  }

  _drawPorts() {
    PORTS.forEach(port => {
      const pos = latLonToVec3(port.lat, port.lon);

      // Pulsing marker
      const size  = port.hub ? 0.035 : 0.022;
      const color = port.hub ? 0xff8a3d : 0x2fd4c6;
      const geo   = new THREE.SphereGeometry(size, 16, 16);
      const mat   = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
      const mesh  = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      // Glow halo
      const haloGeo = new THREE.SphereGeometry(size * 2.4, 16, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.28,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.copy(pos);
      this.scene.add(halo);

      // Outer pulse ring — a small sprite billboarded
      const ringGeo = new THREE.SphereGeometry(size * 1.2, 8, 8);
      const ringMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      this.scene.add(ring);

      this.pulses.push({ mesh, halo, ring, port, baseOpacity: port.hub ? 0.95 : 0.7 });

      // Label sprite (SVG data-URI) for hub ports only — keeps it clean
      if (port.hub) {
        const label = this._makeLabel(port.name);
        label.position.copy(pos.clone().multiplyScalar(1.18));
        this.scene.add(label);
      }
    });
  }

  _makeLabel(name) {
    const canvas = document.createElement('canvas');
    canvas.width  = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Background pill
    ctx.fillStyle   = 'rgba(7,16,25,0.78)';
    ctx.strokeStyle = '#2fd4c6';
    ctx.lineWidth   = 2;
    const tw = ctx.measureText(name).width || name.length * 11;
    const pw = Math.max(tw + 28, 90);
    const rx = pw / 2;
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(0, 0, pw, 40, 20);
      ctx.fill();
      ctx.stroke();
    } else {
      // Fallback for older browsers
      const r = 20;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(pw - r, 0);
      ctx.quadraticCurveTo(pw, 0, pw, r);
      ctx.lineTo(pw, 40 - r);
      ctx.quadraticCurveTo(pw, 40, pw - r, 40);
      ctx.lineTo(r, 40);
      ctx.quadraticCurveTo(0, 40, 0, 40 - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Text
    ctx.fillStyle = '#caf0f8';
    ctx.font      = '600 26px "Space Grotesk", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, pw / 2, 22);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false,
      opacity: 0.95, sizeAttenuation: true
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.7, 0.175, 1);
    return sprite;
  }

  _bindEvents() {
    const el = this.renderer.domElement;

    const onMove = (x, y) => {
      this.mouse.x = (x / this.container.clientWidth)  * 2 - 1;
      this.mouse.y = -(y / this.container.clientHeight) * 2 + 1;
    };

    el.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
    el.addEventListener('touchmove', e => {
      if (e.touches.length) onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    // Drag-to-rotate
    let dragging = false;
    let prevX = 0;
    let prevY = 0;
    const onDown = (x, y) => { dragging = true; prevX = x; prevY = y; this.isSpinning = false; };
    const onUp   = () => { dragging = false; setTimeout(() => { this.isSpinning = true; }, 2000); };

    el.addEventListener('mousedown',  e => onDown(e.clientX, e.clientY));
    window.addEventListener('mouseup',   onUp);
    el.addEventListener('touchstart', e => { if (e.touches.length) onDown(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    window.addEventListener('touchend',  onUp);

    // Scroll-to-zoom
    this.container.addEventListener('wheel', e => {
      e.preventDefault();
      this.camera.position.z = Math.max(1.8, Math.min(4.5, this.camera.position.z + e.deltaY * 0.003));
    }, { passive: false });

    // Resize
    const onResize = () => {
      const rect = this.container.getBoundingClientRect();
      const W = Math.max(rect.width, 320);
      const H = Math.max(rect.height, 320);
      this.camera.aspect = W / H;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(W, H);
    };
    window.addEventListener('resize', onResize);

    // Re-layout when container size changes (e.g. sidebar toggle)
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(onResize);
      ro.observe(this.container);
    }
  }

  _animate() {
    const loop = () => {
      requestAnimationFrame(loop);
      const dt  = this.clock.getDelta();
      const t   = this.clock.elapsedTime;

      // Auto-rotate
      if (this.isSpinning) {
        this.globe.rotation.y += this.spinSpeed;
      }

      // Drag rotation (via mouse)
      if (this._lastMouseX !== undefined) {
        const dx = this.mouse.x - this._lastMouseX;
        this.globe.rotation.y += dx * 0.012;
        this.globe.rotation.x += (this.mouse.y - this._lastMouseY) * 0.006;
        this.globe.rotation.x = Math.max(-Math.PI / 2.4, Math.min(Math.PI / 2.4, this.globe.rotation.x));
        this._lastMouseX = this.mouse.x;
        this._lastMouseY = this.mouse.y;
      } else {
        this._lastMouseX = this.mouse.x;
        this._lastMouseY = this.mouse.y;
      }

      // Animate dots along arcs
      for (const d of this.dots) {
        d.phase = (d.phase + dt * d.speed) % 1;
        const idx = Math.floor(d.phase * (d.pts.length - 1));
        const frac = (d.phase * (d.pts.length - 1)) - idx;
        const p0  = d.pts[Math.min(idx, d.pts.length - 1)];
        const p1  = d.pts[Math.min(idx + 1, d.pts.length - 1)];
        const pos = p0.clone().lerp(p1, frac);
        d.dot.position.copy(pos);
        d.halo.position.copy(pos);

        // Pulse halo size
        const pulse = 1 + Math.sin(t * 4 + d.phase * 10) * 0.5;
        d.halo.scale.set(pulse, pulse, pulse);
      }

      // Port marker pulses
      for (const p of this.pulses) {
        const scale = 1 + Math.sin(t * 2.2 + p.port.lat) * 0.35;
        p.ring.scale.set(scale, scale, scale);
        p.ring.material.opacity = 0.25 + Math.sin(t * 2.2 + p.port.lat) * 0.15;
      }

      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  dispose() {
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode === this.container) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    this.initialized = false;
  }
}

// ── Static SVG fallback (shown if Three.js can't load) ────────────────────
export function renderFallback(container) {
  const w = Math.max(container.clientWidth, 320);
  const h = Math.max(container.clientHeight, 320);
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.32;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  svg.style.display = 'block';

  // Background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', w); bg.setAttribute('height', h);
  bg.setAttribute('fill', '#070d18');
  svg.appendChild(bg);

  // Grid lines (AIS/waypoint grid motif)
  for (let i = 0; i <= 12; i++) {
    const x = (i / 12) * w;
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', x); ln.setAttribute('y1', 0);
    ln.setAttribute('x2', x); ln.setAttribute('y2', h);
    ln.setAttribute('stroke', 'rgba(47,212,198,0.07)');
    ln.setAttribute('stroke-width', '1');
    svg.appendChild(ln);
  }
  for (let i = 0; i <= 8; i++) {
    const y = (i / 8) * h;
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', 0); ln.setAttribute('y1', y);
    ln.setAttribute('x2', w); ln.setAttribute('y2', y);
    ln.setAttribute('stroke', 'rgba(47,212,198,0.07)');
    ln.setAttribute('stroke-width', '1');
    svg.appendChild(ln);
  }

  // Globe circle
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', cx); circle.setAttribute('cy', cy);
  circle.setAttribute('r', r);
  circle.setAttribute('fill', 'url(#earthGrad)');
  circle.setAttribute('stroke', 'rgba(47,212,198,0.4)');
  circle.setAttribute('stroke-width', '1.5');
  svg.appendChild(circle);

  // Radial gradient for globe
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const grad = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
  grad.id = 'earthGrad';
  grad.setAttribute('cx', '35%'); grad.setAttribute('cy', '30%');
  const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop1.setAttribute('offset', '0%'); stop1.setAttribute('stop-color', '#1a4a6e');
  const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop2.setAttribute('offset', '70%'); stop2.setAttribute('stop-color', '#0e2a44');
  const stop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop3.setAttribute('offset', '100%'); stop3.setAttribute('stop-color', '#071428');
  grad.append(stop1, stop2, stop3);
  defs.appendChild(grad);
  svg.appendChild(defs);

  // Simplified continent shapes (rough polygons for visual depth)
  const continents = [
    // Eurasia (rough)
    { fill: '#1a3a2a', points: '420,200 520,180 600,210 620,260 580,300 500,310 440,290 400,250' },
    // Africa (rough)
    { fill: '#2a4a2a', points: '460,320 500,310 530,340 540,380 520,420 480,430 450,400 440,360' },
    // North America (rough)
    { fill: '#1a3a2a', points: '100,180 160,160 220,170 260,200 240,240 180,260 120,240 90,210' },
    // South America (rough)
    { fill: '#2a4a2a', points: '170,290 200,280 220,310 225,360 210,410 190,440 165,430 155,380 160,330' },
    // Australia (rough)
    { fill: '#2a4a2a', points: '720,370 760,360 790,380 785,420 750,440 715,420 710,390' },
  ];
  for (const c of continents) {
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', c.points);
    poly.setAttribute('fill', c.fill);
    svg.appendChild(poly);
  }

  // Route arcs as curved SVG paths
  const portPos = {};
  PORTS.forEach(p => {
    const latR = (p.lat / 90) * Math.PI / 2;
    const lonR = (p.lon / 180) * Math.PI;
    const x = cx + r * Math.cos(latR) * Math.sin(lonR);
    const y = cy - r * Math.sin(latR);
    portPos[p.name] = { x, y };
  });

  const processed = new Set();
  ARCS.forEach(([fromName, toName]) => {
    const key = [fromName, toName].sort().join('|');
    const isMain = !processed.has(key) && PORTS.find(p => p.name === fromName)?.hub;
    processed.add(key);

    const a = portPos[fromName], b = portPos[toName];
    if (!a || !b) return;

    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const cx2 = mx - dy * 0.38;
    const cy2 = my + dx * 0.38;

    const color  = isMain ? '#ff8a3d' : '#2fd4c6';
    const opacity = isMain ? '0.8' : '0.3';
    const sw     = isMain ? '2' : '1';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const d = `M ${a.x},${a.y} Q ${cx2},${cy2} ${b.x},${b.y}`;
    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', sw);
    path.setAttribute('fill', 'none');
    path.setAttribute('opacity', opacity);
    path.setAttribute('stroke-linecap', 'round');
    svg.appendChild(path);

    // Glow for main arcs
    if (isMain) {
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glow.setAttribute('d', d);
      glow.setAttribute('stroke', '#ff5a1f');
      glow.setAttribute('stroke-width', '6');
      glow.setAttribute('fill', 'none');
      glow.setAttribute('opacity', '0.2');
      glow.setAttribute('stroke-linecap', 'round');
      glow.setAttribute('filter', 'url(#blur)');
      svg.appendChild(glow);
    }

    // Animated dot along arc (CSS animated dashoffset)
    const dotPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    dotPath.setAttribute('d', d);
    dotPath.setAttribute('stroke', color);
    dotPath.setAttribute('stroke-width', '3');
    dotPath.setAttribute('fill', 'none');
    dotPath.setAttribute('opacity', '0.6');
    dotPath.setAttribute('stroke-linecap', 'round');
    dotPath.style.strokeDasharray = dist;
    dotPath.style.strokeDashoffset = dist;
    dotPath.style.animation = `ocRouteDot 3.5s ${isMain ? 0 : 1.2}s linear infinite`;
    svg.appendChild(dotPath);
  });

  // Port dots
  PORTS.forEach(port => {
    const pos = portPos[port.name];
    if (!pos) return;
    const size = port.hub ? 6 : 4;
    const color = port.hub ? '#ff8a3d' : '#2fd4c6';

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', pos.x); dot.setAttribute('cy', pos.y);
    dot.setAttribute('r', size);
    dot.setAttribute('fill', color);
    dot.setAttribute('opacity', '0.95');
    svg.appendChild(dot);

    if (port.hub) {
      const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      halo.setAttribute('cx', pos.x); halo.setAttribute('cy', pos.y);
      halo.setAttribute('r', size * 3);
      halo.setAttribute('fill', 'none');
      halo.setAttribute('stroke', color);
      halo.setAttribute('stroke-width', '1.5');
      halo.setAttribute('opacity', '0.4');
      halo.style.animation = 'ocPulseRing 2.5s ease-in-out infinite';
      svg.appendChild(halo);

      // Label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', pos.x);
      label.setAttribute('y', pos.y - 14);
      label.setAttribute('fill', '#caf0f8');
      label.setAttribute('font-family', '"Space Grotesk","Segoe UI",sans-serif');
      label.setAttribute('font-size', '11');
      label.setAttribute('font-weight', '600');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('opacity', '0.9');
      label.textContent = port.name;
      svg.appendChild(label);
    }
  });

  // Compass rose (top-right corner)
  const compass = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const cx2 = w - 52, cy2 = 52, cr = 28;
  const cg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  cg.setAttribute('cx', cx2); cg.setAttribute('cy', cy2);
  cg.setAttribute('r', cr);
  cg.setAttribute('fill', 'none');
  cg.setAttribute('stroke', 'rgba(47,212,198,0.3)');
  cg.setAttribute('stroke-width', '1');
  compass.appendChild(cg);

  // Cardinal points
  const cardinals = [
    { label: 'N', angle: 0 }, { label: 'E', angle: 90 },
    { label: 'S', angle: 180 }, { label: 'W', angle: 270 }
  ];
  for (const c of cardinals) {
    const rad = c.angle * Math.PI / 180;
    const x = cx2 + cr * 0.7 * Math.sin(rad);
    const y = cy2 - cr * 0.7 * Math.cos(rad);
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', cx2); ln.setAttribute('y1', cy2);
    ln.setAttribute('x2', x); ln.setAttribute('y2', y);
    ln.setAttribute('stroke', c.label === 'N' ? '#ff8a3d' : 'rgba(47,212,198,0.4)');
    ln.setAttribute('stroke-width', '1.5');
    compass.appendChild(ln);

    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', x); txt.setAttribute('y', y - 6);
    txt.setAttribute('fill', c.label === 'N' ? '#ff8a3d' : '#93a6ba');
    txt.setAttribute('font-family', '"Space Grotesk","Segoe UI",sans-serif');
    txt.setAttribute('font-size', '9');
    txt.setAttribute('font-weight', '700');
    txt.setAttribute('text-anchor', 'middle');
    txt.textContent = c.label;
    compass.appendChild(txt);
  }
  svg.appendChild(compass);

  // Blur filter for glow
  const fDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const blur = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  blur.id = 'blur';
  const bl = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
  bl.setAttribute('stdDeviation', '3');
  blur.appendChild(bl);
  fDefs.appendChild(blur);
  svg.appendChild(fDefs);

  container.innerHTML = '';
  container.appendChild(svg);
}
