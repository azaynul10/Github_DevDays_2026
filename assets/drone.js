// "Repository City" — a dependency-free 3D drone flyover rendered on a 2D canvas.
// Buildings are commits along a main street (green) and a feature branch (purple)
// that merges back through a pull-request bridge. No libraries, works offline.
(() => {
  'use strict';
  const canvas = document.getElementById('flight-canvas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  const frozenFrame = params.has('frame') ? Number(params.get('frame')) : null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.getElementById('flight-toggle');

  const COLORS = {
    skyTop: [7, 10, 14], skyLow: [13, 31, 24], ground: [9, 14, 12], fog: [11, 20, 18],
    main: [63, 185, 80], feature: [163, 113, 247], block: [30, 41, 36], blockAlt: [36, 46, 52]
  };

  // Deterministic pseudo-random numbers so the city looks the same every visit.
  let seed = 20261001;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  // Roads: main runs north along x = 0; the feature branch leaves at z = 34 and merges at z = 92.
  const featurePath = [[0, 34], [10, 44], [16, 56], [16, 78], [8, 88], [0, 96]];
  const roads = [
    { points: [[0, -40], [0, 170]], width: 3.2, color: COLORS.main },
    { points: featurePath, width: 2.4, color: COLORS.feature }
  ];

  const buildings = [];
  const commits = [];
  const addBuilding = (x, z, w, d, h, color, glow, label) => buildings.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h, color, glow, label });

  // Commit towers along main and along the feature branch.
  const mainLabels = { 2: 'Add learning goals', 5: 'Add a practice goal', 11: 'Merge pull request #1' };
  for (let i = 0; i < 14; i++) {
    const z = -24 + i * 13;
    const side = i % 2 ? 1 : -1;
    const h = 6 + rand() * 9 + (mainLabels[i] ? 6 : 0);
    addBuilding(side * 5.2, z, 3.4, 3.4, h, COLORS.block, COLORS.main, mainLabels[i]);
    commits.push({ x: 0, z, color: COLORS.main });
  }
  [[13.5, 47, 'feature: add filter'], [19.6, 62, null], [19.6, 74, 'Copilot proposed change'], [12, 86, null]].forEach(([x, z, label]) => {
    addBuilding(x, z, 3, 3, 8 + rand() * 7 + (label ? 5 : 0), COLORS.blockAlt, COLORS.feature, label);
  });

  // City blocks fill the rest of the grid; keep roads clear.
  const nearRoad = (x, z) => {
    if (Math.abs(x) < 8.5) return true;
    for (let i = 0; i < featurePath.length - 1; i++) {
      const [ax, az] = featurePath[i], [bx, bz] = featurePath[i + 1];
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
      if (Math.hypot(x - (ax + t * (bx - ax)), z - (az + t * (bz - az))) < 6.5) return true;
    }
    return false;
  };
  for (let gx = -64; gx <= 64; gx += 8) {
    for (let gz = -48; gz <= 176; gz += 8) {
      if (nearRoad(gx, gz) || rand() < 0.22) continue;
      const tall = rand() < 0.12;
      addBuilding(gx + (rand() - 0.5) * 1.5, gz + (rand() - 0.5) * 1.5, 3.2 + rand() * 2.4, 3.2 + rand() * 2.4, (tall ? 14 : 3) + rand() * (tall ? 12 : 8), rand() < 0.5 ? COLORS.block : COLORS.blockAlt, null, null);
    }
  }

  // Closed drone route over the city (x, z, altitude).
  const route = [[-34, -58, 50], [-22, -14, 44], [-14, 24, 42], [6, 44, 46], [30, 64, 50], [34, 104, 48], [6, 138, 52], [-34, 150, 60], [-58, 96, 62], [-52, 26, 56]];
  const catmull = (p0, p1, p2, p3, t) => {
    const t2 = t * t, t3 = t2 * t;
    return p1.map((_, k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
  };
  const along = (u) => {
    const n = route.length, s = ((u % 1) + 1) % 1 * n, i = Math.floor(s);
    return catmull(route[(i - 1 + n) % n], route[i % n], route[(i + 1) % n], route[(i + 2) % n], s - i);
  };

  let W = 0, H = 0, F = 1, dpr = 1;
  const cam = { x: 0, y: 26, z: 0, yaw: 0, pitch: -0.5, f: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0] };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const NEAR = 0.6, FAR = 175;

  function setCamera(u) {
    const p = along(u), q = along(u + 0.012);
    cam.x = p[0]; cam.y = p[2]; cam.z = p[1];
    pointer.sx += (pointer.x - pointer.sx) * 0.06;
    pointer.sy += (pointer.y - pointer.sy) * 0.06;
    // Look slightly to the right of the travel direction so the city sits beside the headline.
    cam.yaw = Math.atan2(q[0] - p[0], q[1] - p[1]) + 0.32 + pointer.sx * 0.18;
    cam.pitch = -0.66 + pointer.sy * 0.08;
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    cam.f = [sy * cp, sp, cy * cp];
    cam.r = [cy, 0, -sy];
    cam.u = [cam.f[1] * cam.r[2] - cam.f[2] * cam.r[1], cam.f[2] * cam.r[0] - cam.f[0] * cam.r[2], cam.f[0] * cam.r[1] - cam.f[1] * cam.r[0]];
  }

  const toCam = (x, y, z) => {
    const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    return [dx * cam.r[0] + dy * cam.r[1] + dz * cam.r[2], dx * cam.u[0] + dy * cam.u[1] + dz * cam.u[2], dx * cam.f[0] + dy * cam.f[1] + dz * cam.f[2]];
  };
  const project = (c) => [W / 2 + (c[0] / c[2]) * F, H / 2 - (c[1] / c[2]) * F];

  // Clip a camera-space polygon against the near plane (Sutherland–Hodgman, one plane).
  function clipNear(poly) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const aIn = a[2] >= NEAR, bIn = b[2] >= NEAR;
      if (aIn) out.push(a);
      if (aIn !== bIn) {
        const t = (NEAR - a[2]) / (b[2] - a[2]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
      }
    }
    return out;
  }

  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const fogAmount = (d) => Math.max(0, Math.min(1, (d - 55) / (FAR - 55)));

  function fillPoly(worldPts, color, alpha = 1, stroke = null) {
    const poly = clipNear(worldPts.map((p) => toCam(p[0], p[1], p[2])));
    if (poly.length < 3) return false;
    ctx.beginPath();
    poly.forEach((c, i) => { const [sx, sy] = project(c); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
    ctx.closePath();
    ctx.fillStyle = rgb(color, alpha);
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    return true;
  }

  function drawSky() {
    const horizon = Math.max(-H, Math.min(H * 2, H / 2 + Math.tan(cam.pitch) * F));
    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon));
    sky.addColorStop(0, rgb(COLORS.skyTop));
    sky.addColorStop(1, rgb(COLORS.skyLow));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const ground = ctx.createLinearGradient(0, horizon, 0, H);
    ground.addColorStop(0, rgb(COLORS.fog));
    ground.addColorStop(1, rgb(COLORS.ground));
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, W, H - horizon);
    const glow = ctx.createRadialGradient(W * 0.55, horizon, 0, W * 0.55, horizon, W * 0.6);
    glow.addColorStop(0, 'rgba(63,185,80,0.16)');
    glow.addColorStop(1, 'rgba(63,185,80,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, horizon - H * 0.3, W, H * 0.6);
  }

  function drawGrid() {
    ctx.lineWidth = 1;
    const step = 8, span = 96;
    const gx0 = Math.floor((cam.x - span) / step) * step, gz0 = Math.floor((cam.z - span) / step) * step;
    for (let k = 0; k <= (span * 2) / step; k++) {
      [[gx0 + k * step, cam.z - span, gx0 + k * step, cam.z + span], [cam.x - span, gz0 + k * step, cam.x + span, gz0 + k * step]].forEach(([x1, z1, x2, z2]) => {
        let a = toCam(x1, 0, z1), b = toCam(x2, 0, z2);
        if (a[2] < NEAR && b[2] < NEAR) return;
        if (a[2] < NEAR) { const t = (NEAR - a[2]) / (b[2] - a[2]); a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]; }
        if (b[2] < NEAR) { const t = (NEAR - b[2]) / (a[2] - b[2]); b = [b[0] + (a[0] - b[0]) * t, b[1] + (a[1] - b[1]) * t, NEAR]; }
        const pa = project(a), pb = project(b);
        const grad = ctx.createLinearGradient(pa[0], pa[1], pb[0], pb[1]);
        grad.addColorStop(0, `rgba(63,185,80,${0.16 * (1 - fogAmount(a[2]))})`);
        grad.addColorStop(1, `rgba(63,185,80,${0.16 * (1 - fogAmount(b[2]))})`);
        ctx.strokeStyle = grad;
        ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
      });
    }
  }

  function drawRoads(time) {
    roads.forEach((road) => {
      for (let i = 0; i < road.points.length - 1; i++) {
        const [ax, az] = road.points[i], [bx, bz] = road.points[i + 1];
        const len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len * road.width / 2, nz = (bx - ax) / len * road.width / 2;
        const steps = Math.max(1, Math.ceil(len / 12));
        for (let s = 0; s < steps; s++) {
          const t0 = s / steps, t1 = (s + 1) / steps;
          const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
          const d = Math.hypot((x0 + x1) / 2 - cam.x, (z0 + z1) / 2 - cam.z);
          fillPoly([[x0 + nx, 0.02, z0 + nz], [x1 + nx, 0.02, z1 + nz], [x1 - nx, 0.02, z1 - nz], [x0 - nx, 0.02, z0 - nz]], mix(road.color, COLORS.fog, fogAmount(d) * 0.9), 0.32 * (1 - fogAmount(d)));
        }
      }
      // Pulses travelling along each road: commits flowing toward main.
      const total = road.points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - road.points[i][0], p[1] - road.points[i][1]), 0);
      for (let k = 0; k < 6; k++) {
        let dist = ((time * 9 + k * (total / 6)) % total), i = 0;
        while (i < road.points.length - 2 && dist > Math.hypot(road.points[i + 1][0] - road.points[i][0], road.points[i + 1][1] - road.points[i][1])) {
          dist -= Math.hypot(road.points[i + 1][0] - road.points[i][0], road.points[i + 1][1] - road.points[i][1]); i++;
        }
        const [ax, az] = road.points[i], [bx, bz] = road.points[i + 1];
        const t = Math.min(1, dist / Math.hypot(bx - ax, bz - az));
        const c = toCam(ax + (bx - ax) * t, 0.6, az + (bz - az) * t);
        if (c[2] < NEAR || c[2] > FAR) continue;
        const [sx, sy] = project(c), r = Math.max(1.5, 26 / c[2]);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3);
        g.addColorStop(0, rgb(road.color, 0.95 * (1 - fogAmount(c[2]))));
        g.addColorStop(1, rgb(road.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, r * 3, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  const LIGHT = [-0.45, 0.8, -0.38];
  const faces = [];
  function collectFaces() {
    faces.length = 0;
    for (const b of buildings) {
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      const dist = Math.hypot(cx - cam.x, cz - cam.z);
      if (dist > FAR) continue;
      const centre = toCam(cx, b.h / 2, cz);
      if (centre[2] < -10) continue;
      const list = [
        { n: [0, 1, 0], pts: [[b.x0, b.h, b.z0], [b.x1, b.h, b.z0], [b.x1, b.h, b.z1], [b.x0, b.h, b.z1]], c: [cx, b.h, cz], top: true },
        { n: [0, 0, 1], pts: [[b.x0, 0, b.z1], [b.x1, 0, b.z1], [b.x1, b.h, b.z1], [b.x0, b.h, b.z1]], c: [cx, b.h / 2, b.z1] },
        { n: [0, 0, -1], pts: [[b.x1, 0, b.z0], [b.x0, 0, b.z0], [b.x0, b.h, b.z0], [b.x1, b.h, b.z0]], c: [cx, b.h / 2, b.z0] },
        { n: [1, 0, 0], pts: [[b.x1, 0, b.z1], [b.x1, 0, b.z0], [b.x1, b.h, b.z0], [b.x1, b.h, b.z1]], c: [b.x1, b.h / 2, cz] },
        { n: [-1, 0, 0], pts: [[b.x0, 0, b.z0], [b.x0, 0, b.z1], [b.x0, b.h, b.z1], [b.x0, b.h, b.z0]], c: [b.x0, b.h / 2, cz] }
      ];
      for (const face of list) {
        const vx = cam.x - face.c[0], vy = cam.y - face.c[1], vz = cam.z - face.c[2];
        if (face.n[0] * vx + face.n[1] * vy + face.n[2] * vz <= 0) continue;
        faces.push({ b, face, depth: vx * vx + vy * vy + vz * vz, dist });
      }
    }
    faces.sort((a, b) => b.depth - a.depth);
  }

  function drawBuildings() {
    for (const { b, face, dist } of faces) {
      const shade = 0.55 + 0.45 * Math.max(0, face.n[0] * LIGHT[0] + face.n[1] * LIGHT[1] + face.n[2] * LIGHT[2]);
      let color = b.color.map((v) => Math.min(255, v * shade * (face.top ? 1.25 : 1)));
      if (b.glow && face.top) color = mix(color, b.glow, 0.55);
      const fog = fogAmount(dist);
      fillPoly(face.pts, mix(color, COLORS.fog, fog), 1, b.glow ? rgb(b.glow, 0.55 * (1 - fog)) : `rgba(120,160,140,${0.08 * (1 - fog)})`);
      if (b.glow && !face.top && dist < 90) {
        // Window strips on commit towers.
        for (let k = 1; k < Math.floor(b.h / 2.2); k++) {
          const y = k * 2.2, p = face.pts, t = 0.18;
          const a = [p[0][0] + (p[1][0] - p[0][0]) * t, y, p[0][2] + (p[1][2] - p[0][2]) * t];
          const c = [p[0][0] + (p[1][0] - p[0][0]) * (1 - t), y, p[0][2] + (p[1][2] - p[0][2]) * (1 - t)];
          fillPoly([a, c, [c[0], y + 0.5, c[2]], [a[0], y + 0.5, a[2]]], b.glow, 0.28 * (1 - fog));
        }
      }
    }
  }

  function drawLabels() {
    if (W < 760) return; // On phones the headline covers the scene; skip labels to keep text readable.
    ctx.font = `600 ${Math.round(12.5)}px "Mona Sans", "Segoe UI", system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    for (const b of buildings) {
      if (!b.label) continue;
      const c = toCam((b.x0 + b.x1) / 2, b.h + 1.2, (b.z0 + b.z1) / 2);
      if (c[2] < 4 || c[2] > 120) continue;
      const [sx, sy] = project(c);
      if (sx < W * 0.5 || sx > W - 40 || sy < 70 || sy > H - 60) continue;
      const alpha = Math.min(1, (120 - c[2]) / 30);
      const text = b.label, w = ctx.measureText(text).width + 22, y = sy - 26;
      ctx.strokeStyle = rgb(b.glow, 0.7 * alpha); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, y + 11); ctx.stroke();
      ctx.fillStyle = `rgba(13,17,23,${0.86 * alpha})`;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(sx - w / 2, y - 11, w, 22, 11) : ctx.rect(sx - w / 2, y - 11, w, 22); ctx.fill();
      ctx.strokeStyle = rgb(b.glow, 0.85 * alpha); ctx.stroke();
      ctx.fillStyle = `rgba(240,246,252,${alpha})`;
      ctx.fillText(text, sx - w / 2 + 11, y);
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    W = Math.max(1, rect.width); H = Math.max(1, rect.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    F = (H / 2) / Math.tan((W < 700 ? 64 : 56) * Math.PI / 360);
  }

  let running = !reducedMotion.matches && frozenFrame === null;
  let visible = true, last = performance.now(), progress = frozenFrame ?? 0.16, clock = 0, idle = true;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (running && visible) { progress += dt / 75; clock += dt; }
    setCamera(progress);
    drawSky(); drawGrid(); drawRoads(clock); collectFaces(); drawBuildings(); drawLabels();
    if (running && visible) requestAnimationFrame(frame); else idle = true;
  }
  const wake = () => { if (idle && running && visible) { idle = false; last = performance.now(); requestAnimationFrame(frame); } };
  const renderOnce = () => { setCamera(progress); drawSky(); drawGrid(); drawRoads(clock); collectFaces(); drawBuildings(); drawLabels(); };

  function setRunning(next) {
    running = next;
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(!running));
      toggle.querySelector('span').textContent = running ? 'Pause flight' : 'Resume flight';
    }
    if (running) wake(); else renderOnce();
  }

  new ResizeObserver(() => { resize(); if (!running || !visible) renderOnce(); }).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; wake(); });
  canvas.parentElement.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    if (!running) renderOnce();
  });
  canvas.parentElement.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; });
  if (toggle) toggle.addEventListener('click', () => setRunning(!running));
  reducedMotion.addEventListener?.('change', (e) => setRunning(!e.matches && frozenFrame === null));

  resize();
  if (frozenFrame !== null || reducedMotion.matches) {
    pointer.sx = pointer.x; pointer.sy = pointer.y;
    setRunning(false);
    if (toggle && frozenFrame === null) toggle.querySelector('span').textContent = 'Motion reduced · Play flight';
  } else {
    idle = false;
    requestAnimationFrame(frame);
  }
  canvas.dataset.ready = 'true';
})();
