/* demerit · V14 — kit3d.js : le moteur commun des planches.
   Scène photographique : carte d'environnement procédurale (reflets), backdrop en shader, sol sombre poli,
   poussières, bloom, grain+vignette, profondeur de champ optionnelle, caméra à plans, étiquettes projetées.
   Empaqueté par esbuild dans chaque planche : zéro CDN, zéro requête réseau. */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { PMREMGenerator } from 'three';
export { THREE };
export { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
export { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
export { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';

export const HEAD = /Headless/.test(navigator.userAgent);
export const $ = s => document.querySelector(s);
export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const COL = { bg: 0x06030b, v: 0x9d5cff, hi: 0xefe6ff, pale: 0xd9c8ff, deep: 0x5b34b5, ink: 0x150a2e };

/* ---------- palettes d'ambiance : une par planche ---------- */
export const ENV = {
  nuit:   { top: 0x0a0618, mid: 0x150a30, bot: 0x04020a, key: 0xe9dcff, rim: 0x9d5cff, fog: 0x07040f, dust: 0xb48cff },
  orage:  { top: 0x0b0a1a, mid: 0x1a1140, bot: 0x050310, key: 0xdcd4ff, rim: 0x7d4dff, fog: 0x0a0618, dust: 0x9d8cff },
  lave:   { top: 0x120720, mid: 0x2a0f4d, bot: 0x07030e, key: 0xffe9f6, rim: 0xc06bff, fog: 0x0d0518, dust: 0xd9a6ff },
  clinik: { top: 0x0a0a14, mid: 0x141428, bot: 0x05050c, key: 0xf2f0ff, rim: 0x8f7dff, fog: 0x08080f, dust: 0xcfc8ff },
  bronze: { top: 0x0d0818, mid: 0x241338, bot: 0x050309, key: 0xffe6cf, rim: 0xb07bff, fog: 0x0a0614, dust: 0xe0c3ff },
  abysse: { top: 0x05060f, mid: 0x0c1430, bot: 0x03040a, key: 0xdfe8ff, rim: 0x6f7bff, fog: 0x050810, dust: 0x9fb4ff }
};

/* ---------- matériaux partagés ---------- */
const mc = {};
function S(c, r, m, e, ei, o) { return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, emissive: e || 0, emissiveIntensity: ei || 0, ...(o || {}) }); }
export function mat(kind) {
  if (mc[kind]) return mc[kind];
  const M = {
    body: S(0x3b1e88, .5, .12), dark: S(0x150b2e, .55, .25), darker: S(0x0a0518, .7, .1),
    skin: S(0xdccbf8, .62, 0), hair: S(0x241050, .85, 0), cap: S(0x7a4ff0, .42, .15),
    glow: S(0x9d5cff, .28, 0, 0x9d5cff, 1.5), hot: S(0xefe6ff, .25, 0, 0xc9a8ff, 2.2),
    eye: S(0x0a0418, .35, 0), metal: S(0x9a80dd, .18, .95), chrome: S(0xdcd0ff, .08, 1),
    paper: S(0xd3c1f7, .82, 0), coin: S(0xece0ff, .2, .75, 0x9d5cff, .9),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xb48cff, roughness: .06, metalness: 0, transmission: .92, thickness: .5, ior: 1.45, transparent: true, opacity: .5, clearcoat: 1, clearcoatRoughness: .05 }),
    wall: new THREE.MeshPhysicalMaterial({ color: 0x2a1856, roughness: .1, metalness: .1, transparent: true, opacity: .16, clearcoat: 1, clearcoatRoughness: .06, depthWrite: false }),
    liquid: new THREE.MeshPhysicalMaterial({ color: 0x7f4dff, roughness: .08, metalness: 0, transmission: .85, thickness: 1.4, ior: 1.33, transparent: true, opacity: .78, emissive: 0x3a1a8f, emissiveIntensity: .5 }),
    floor: S(0x07040f, .26, .92)
  }[kind];
  mc[kind] = M; return M;
}
export function part(geo, m, x, y, z, parent) { const o = new THREE.Mesh(geo, m.isMaterial ? m : mat(m)); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; if (parent) parent.add(o); return o; }

/* ---------- textures procédurales ---------- */
export function canvasTex(w, h, draw, opt) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (opt) Object.assign(t, opt); return t;
}
export const softDot = () => canvasTex(64, 64, (x, w) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, '#fff'); g.addColorStop(.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
export const pool = () => canvasTex(256, 256, (x, w) => { const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(200,160,255,.85)'); g.addColorStop(.4, 'rgba(140,80,255,.28)'); g.addColorStop(1, 'rgba(120,60,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });

/* ---------- backdrop shader : dégradé + halo + bandes + dither ---------- */
function backdropMat(p) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(p.top) }, uMid: { value: new THREE.Color(p.mid) }, uBot: { value: new THREE.Color(p.bot) },
      uGlow: { value: new THREE.Color(p.rim) }, uTime: { value: 0 }, uBands: { value: p.bands ?? 1 }, uGlowPos: { value: new THREE.Vector2(.5, .62) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `
      uniform vec3 uTop,uMid,uBot,uGlow; uniform float uTime,uBands; uniform vec2 uGlowPos; varying vec3 vP;
      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec3 d = normalize(vP);
        float h = d.y*.5+.5;
        vec3 c = mix(uBot, uMid, smoothstep(.0,.55,h));
        c = mix(c, uTop, smoothstep(.5,.95,h));
        vec2 uv = vec2(atan(d.z,d.x)/6.2831+.5, h);
        float g = exp(-length((uv-uGlowPos)*vec2(1.6,2.1))*3.4);
        c += uGlow * g * (.30 + .05*sin(uTime*.35));
        c += uGlow * .05 * smoothstep(.6,.0,abs(fract(uv.y*26.*uBands)-.5)) * uBands;
        c += (hash(gl_FragCoord.xy+uTime)-.5)*.012;
        gl_FragColor = vec4(c,1.);
      }`
  });
}

/* ---------- grain + vignette + aberration légère ---------- */
const FilmShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: .07 }, uVig: { value: 1.05 }, uCA: { value: .0016 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uGrain,uVig,uCA; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 c = vUv-.5; float r2 = dot(c,c);
      vec2 off = c * uCA * (1.+r2*3.);
      vec4 col; col.r = texture2D(tDiffuse, vUv+off).r; col.g = texture2D(tDiffuse, vUv).g; col.b = texture2D(tDiffuse, vUv-off).b; col.a = 1.;
      float v = smoothstep(1.25, .28, length(c)*uVig*1.55);
      col.rgb *= mix(1., v, .82);
      col.rgb += (hash(vUv*vec2(1024.,768.)+uTime)-.5)*uGrain;
      gl_FragColor = col;
    }`
};

/* ---------- carte d'environnement procédurale (reflets réels) ---------- */
function envMap(renderer, p) {
  const pm = new PMREMGenerator(renderer); pm.compileEquirectangularShader();
  const s = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 20), new THREE.MeshBasicMaterial({ color: p.mid, side: THREE.BackSide })); s.add(box);
  const light = (c, i, w, h, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c })); m.material.color.multiplyScalar(i); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  light(0xffffff, 3.4, 8, 3, -4, 5, 6);
  light(p.rim, 5.0, 6, 6, 6, 3, -6);
  light(p.rim, 1.6, 14, 1.2, 0, -4, 0);
  const t = pm.fromScene(s, .04).texture; pm.dispose();
  [box, ...s.children].forEach(o => o.geometry && o.geometry.dispose());
  return t;
}

/* ---------- la scène ---------- */
export function stage(api, opts = {}) {
  const host = $('#gl'), ov = $('#ov'), stageEl = $('#stage');
  const p = Object.assign({}, ENV[opts.env || 'nuit'], opts.pal || {});
  let renderer = null;
  try { renderer = new THREE.WebGLRenderer({ antialias: !HEAD, preserveDrawingBuffer: true, powerPreference: 'high-performance' }); }
  catch (e) { const n = $('#nogl'); if (n) { n.style.display = 'block'; n.textContent = 'WebGL indisponible'; } }
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(p.fog, opts.fog ?? .028);
  const camera = new THREE.PerspectiveCamera(opts.fov || 34, 1, .05, 400);

  let composer, bloom, film, bokeh;
  if (renderer) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = opts.exposure ?? .95;
    renderer.shadowMap.enabled = !HEAD || opts.headShadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    scene.environment = envMap(renderer, p);
    scene.environmentIntensity = opts.envInt ?? .85;
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), opts.bloom ?? .55, .55, opts.threshold ?? .82);
    composer.addPass(bloom);
    if (opts.dof && !HEAD) { bokeh = new BokehPass(scene, camera, { focus: 9, aperture: .0009, maxblur: .008 }); composer.addPass(bokeh); }
    composer.addPass(new OutputPass());
    film = new ShaderPass(FilmShader); film.uniforms.uGrain.value = opts.grain ?? .07; composer.addPass(film);
  }

  /* backdrop */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 24), backdropMat(p));
  sky.renderOrder = -1; scene.add(sky);

  /* lumières : clé froide + contre-jour violet + remplissage bas */
  const amb = new THREE.HemisphereLight(p.key, p.bot, .3); scene.add(amb);
  const key = new THREE.DirectionalLight(p.key, opts.keyI ?? 1.5); key.position.set(-5, 8, 6); key.castShadow = true;
  key.shadow.mapSize.set(HEAD ? 512 : 1024, HEAD ? 512 : 1024); key.shadow.bias = -.0008; key.shadow.radius = 2;
  Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: .5, far: 40 }); scene.add(key);
  const rim = new THREE.PointLight(p.rim, opts.rimI ?? 55, 46, 2); rim.position.set(5, 4.5, -7); scene.add(rim);
  const fill = new THREE.PointLight(p.rim, opts.fillI ?? 14, 30, 2); fill.position.set(-6, 1.2, 4); scene.add(fill);

  /* sol + halo + grille + poussières */
  const world = new THREE.Group(); scene.add(world);
  let floor = null, grid = null, dust = null, halo = null;
  if (opts.floor !== false) {
    floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat('floor'));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; world.add(floor);
    if (opts.grid !== false) {
      grid = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uC: { value: new THREE.Color(p.rim) }, uS: { value: opts.gridStep ?? 1 } },
        vertexShader: 'varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: `uniform vec3 uC; uniform float uS; varying vec2 vU;
          float line(vec2 uv, float s){ vec2 g=abs(fract(uv*s-.5)-.5)/fwidth(uv*s); return 1.-min(min(g.x,g.y),1.); }
          void main(){ float a=max(line(vU,45.*uS),.0)*.16+line(vU,9.*uS)*.22;
            a*=smoothstep(.52,.05,length(vU-.5)); gl_FragColor=vec4(uC,a); }`
      }));
      grid.rotation.x = -Math.PI / 2; grid.position.y = .002; world.add(grid);
    }
    if (opts.halo !== false) {
      halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: pool(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: opts.haloO ?? .5 }));
      halo.rotation.x = -Math.PI / 2; halo.position.y = .006; world.add(halo);
    }
  }
  if (opts.dust !== false) {
    const n = HEAD ? 160 : 520, pos = new Float32Array(n * 3), sz = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * 34; pos[i * 3 + 1] = Math.random() * 11; pos[i * 3 + 2] = (Math.random() - .5) * 30; sz[i] = .012 + Math.random() * .035; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('size', new THREE.BufferAttribute(sz, 1));
    dust = new THREE.Points(g, new THREE.PointsMaterial({ size: .05, map: softDot(), color: p.dust, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    scene.add(dust);
  }

  /* ---------- rig caméra ---------- */
  const S = { amb: 1, shake: 0 }; const cam = { pos: v3(0, 3.2, 11), look: v3(0, 1.2, 0), fov: opts.fov || 34, roll: 0 };
  let shots = opts.shots || {};
  const st = {
    THREE, scene, world, camera, renderer, composer, bloom, film, bokeh, key, rim, fill, floor, grid, halo, dust, pal: p, S, cam,
    setShots(o) { shots = Object.assign(shots, o); },
    snap(name) { const s = shots[name]; if (!s) return; cam.pos.set(...s.pos); cam.look.set(...s.look); cam.fov = s.fov || cam.fov; cam.roll = s.roll || 0; },
    shot(name, ms, ease) {
      const s = shots[name]; if (!s) return api.wait(0);
      const p0 = cam.pos.clone(), l0 = cam.look.clone(), f0 = cam.fov, r0 = cam.roll;
      const p1 = v3(...s.pos), l1 = v3(...s.look), f1 = s.fov || f0, r1 = s.roll || 0;
      return api.tween(ms || 1100, k => { cam.pos.lerpVectors(p0, p1, k); cam.look.lerpVectors(l0, l1, k); cam.fov = f0 + (f1 - f0) * k; cam.roll = r0 + (r1 - r0) * k; }, ease || api.E.io);
    },
    shake(a, ms) { S.shake = a; return api.tween(ms || 480, k => { S.shake = a * (1 - k); }, api.E.out); },
    flash(m, i, ms) { const e0 = m.emissiveIntensity ?? 1; return api.tween(ms || 460, k => { m.emissiveIntensity = e0 + Math.sin(k * Math.PI) * (i || 3); }); },
    dim(to, ms) { const a = S.amb; return api.tween(ms || 620, k => { S.amb = a + (to - a) * k; }); },
    focus(d, ms) { if (!bokeh) return api.wait(0); const f0 = bokeh.uniforms.focus.value; return api.tween(ms || 700, k => { bokeh.uniforms.focus.value = f0 + (d - f0) * k; }); },
    bloomTo(v, ms) { const b0 = bloom.strength; return api.tween(ms || 600, k => { bloom.strength = b0 + (v - b0) * k; }); },
    pins: [], ticks: [],
    pin(el, target, off) { const q = { el, target, off: off || v3(0, 0, 0), op: 1 }; st.pins.push(q); return q; },
    label(kind, target, off, extra) {
      const d = document.createElement('div'); d.className = 'pin lab c'; const q = api.P[kind];
      d.innerHTML = '<div>' + (extra || '') + '<b>' + q.n + '</b><i>' + q.a + '</i></div>';
      ov.appendChild(d); return st.pin(d, target, off);
    },
    html(inner, target, off, cls) { const d = document.createElement('div'); d.className = 'pin ' + (cls || 'c'); d.innerHTML = inner; ov.appendChild(d); return st.pin(d, target, off); },
    onTick(f) { st.ticks.push(f); }
  };

  const tmp = new THREE.Vector3(); let lastDraw = -1e9, sharp = false;
  api.onFrame((t, dt) => {
    const W = stageEl.clientWidth, H = stageEl.clientHeight; if (!W || !H) return;
    for (const f of st.ticks) f(t, dt);
    const sway = Math.sin(t / 5200) * .045 * (opts.sway ?? 1);
    const pos = cam.pos.clone().sub(cam.look).applyAxisAngle(v3(0, 1, 0), sway).add(cam.look);
    if (S.shake) pos.add(v3((Math.random() - .5) * S.shake * .012, (Math.random() - .5) * S.shake * .012, 0));
    camera.position.copy(pos); camera.up.set(0, 1, 0); camera.lookAt(cam.look);
    camera.rotateZ(cam.roll); camera.fov = cam.fov; camera.aspect = W / H; camera.updateProjectionMatrix();
    amb.intensity = .3 * S.amb; key.intensity = (opts.keyI ?? 1.5) * S.amb; rim.intensity = (opts.rimI ?? 55) * (.45 + .55 * S.amb); fill.intensity = (opts.fillI ?? 14) * S.amb;
    sky.material.uniforms.uTime.value = t / 1000; sky.position.copy(camera.position);
    if (film) film.uniforms.uTime.value = t / 1000;
    if (dust) { dust.rotation.y = t / 90000; dust.position.y = Math.sin(t / 9000) * .35; }
    for (const q of st.pins) {
      const tg = q.target; if (tg.isObject3D) tg.getWorldPosition(tmp); else tmp.copy(tg);
      tmp.add(q.off); tmp.project(camera);
      const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.35 && Math.abs(tmp.y) < 1.35;
      q.el.style.transform = 'translate(' + ((tmp.x + 1) / 2 * W).toFixed(1) + 'px,' + ((1 - tmp.y) / 2 * H).toFixed(1) + 'px)';
      q.el.style.opacity = vis ? q.op : 0;
    }
    if (!renderer) return;
    let pr = Math.min(devicePixelRatio || 1, 2), skip = false;
    if (HEAD) { const d = document.documentElement.dataset; const still = !!d.stopped || !!d.done || !d.beat;
      if (still) { pr = 1; skip = sharp; sharp = true; } else { sharp = false; pr = .5; skip = t - lastDraw < 380; } }
    if (skip) return; lastDraw = t;
    if (renderer.getPixelRatio() !== pr) { renderer.setPixelRatio(pr); composer.setPixelRatio(pr); }
    const sz = renderer.getSize(new THREE.Vector2());
    if (sz.x !== W || sz.y !== H) { renderer.setSize(W, H, false); composer.setSize(W, H); }
    composer.render();
  });
  return st;
}

/* ---------- faisceaux : la nature de l'interaction se lit à la forme ---------- */
export function beams(st, api) {
  const g = new THREE.Group(); st.scene.add(g); const live = [];
  const curve = (a, b, lift) => { const m = a.clone().lerp(b, .5); m.y += lift ?? a.distanceTo(b) * .28; return new THREE.QuadraticBezierCurve3(a.clone(), m, b.clone()); };
  const tube = (c, r, m) => { const mesh = new THREE.Mesh(new THREE.TubeGeometry(c, 72, r, 8, false), mat(m)); mesh.geometry.setDrawRange(0, 0); g.add(mesh); live.push(mesh); return mesh; };
  const grow = (mesh, k) => mesh.geometry.setDrawRange(0, Math.floor(mesh.geometry.index.count * k / 6) * 6);
  const add = o => { g.add(o); live.push(o); return o; };
  const B = {
    group: g, live,
    tx(a, b, ms, lift) { const c = curve(a, b, lift); const t = tube(c, .028, 'hot'); const h = add(new THREE.Mesh(new THREE.SphereGeometry(.075, 14, 10), mat('hot')));
      return api.tween(ms || 850, k => { grow(t, k); h.position.copy(c.getPoint(k)); }, api.E.io); },
    xcc(a, b, ms) { const t1 = tube(curve(a, b, .95), .022, 'hot'), t2 = tube(curve(b, a, -.05), .022, 'glow'); const h = ms || 1000;
      return api.tween(h / 2, k => grow(t1, k), api.E.io).then(() => api.tween(h / 2, k => grow(t2, k), api.E.io)); },
    off(a, b, ms) { const c = curve(a, b, .6); const dots = []; for (let i = 0; i <= 26; i++) { const d = add(new THREE.Mesh(new THREE.SphereGeometry(.032, 8, 6), mat('hot'))); d.position.copy(c.getPoint(i / 26)); d.visible = false; dots.push(d); }
      return api.tween(ms || 1150, k => dots.forEach((d, i) => d.visible = i / 26 <= k), api.E.lin); },
    view(at, ms, r) { const ring = add(new THREE.Mesh(new THREE.TorusGeometry(1, .014, 8, 96), mat('hot'))); ring.rotation.x = Math.PI / 2; ring.position.copy(at);
      const ring2 = add(new THREE.Mesh(new THREE.TorusGeometry(1, .008, 8, 96), mat('glow'))); ring2.rotation.x = Math.PI / 2; ring2.position.copy(at);
      return api.tween(ms || 1300, k => { const s = .1 + k * (r || 5); ring.scale.setScalar(s); ring2.scale.setScalar(s * .72); ring.material.opacity = ring2.material.opacity = 1 - k; ring.visible = ring2.visible = k < .97; }, api.E.out); },
    pay(a, b, n, ms, keep) { const cv = curve(a, b, 1.25); const ps = [];
      for (let i = 0; i < (n || 4); i++) { const c = coin(); c.position.copy(a); add(c); ps.push(c); }
      return Promise.all(ps.map((c, i) => api.wait(i * 150).then(() => api.tween(ms || 850, k => { c.position.copy(cv.getPoint(k)); c.rotation.z = k * 11; c.rotation.y = k * 6; }, api.E.io)))).then(() => { if (!keep) ps.forEach(c => c.visible = false); return ps; }); },
    no(a, b, ms) { const c = curve(a, b, .5); const t = tube(c, .024, 'glow'); const h = add(new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 10), mat('hot')));
      return api.tween((ms || 700) * .6, k => { grow(t, k * .72); h.position.copy(c.getPoint(k * .72)); }, api.E.io)
        .then(() => { t.geometry.setDrawRange(0, 0); return api.tween(260, k => { h.scale.setScalar(1 - k); }, api.E.in); }); },
    burst(at, n, ms, col) { const ps = []; for (let i = 0; i < (n || 18); i++) { const m = new THREE.Mesh(new THREE.TetrahedronGeometry(.05), mat(col || 'hot')); m.position.copy(at); add(m);
        const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2; ps.push({ m, v: v3(Math.cos(a) * Math.cos(e), Math.sin(e) + .4, Math.sin(a) * Math.cos(e)).multiplyScalar(.6 + Math.random()) }); }
      return api.tween(ms || 900, k => ps.forEach(q => { q.m.position.copy(at).addScaledVector(q.v, k * 2.2); q.m.position.y -= k * k * 1.6; q.m.rotation.x = k * 8; q.m.rotation.y = k * 6; q.m.scale.setScalar(1 - k * .85); }), api.E.out); },
    clear() { live.splice(0).forEach(o => { g.remove(o); if (o.geometry) o.geometry.dispose(); }); }
  };
  return B;
}
export function coin() { const c = new THREE.Mesh(new THREE.CylinderGeometry(.085, .085, .022, 24), mat('coin')); c.rotation.x = Math.PI / 2; c.castShadow = true; return c; }

/* ---------- tampon plein cadre + compteur de mois ---------- */
export function stamp(api, txt, cls, hold) {
  const b = $('#big'); if (!b) return api.wait(hold || 900);
  b.className = cls || 'code'; b.textContent = txt;
  return api.tween(180, k => { b.style.opacity = k; b.style.transform = 'translate(-50%,-50%) scale(' + (1.5 - .5 * k) + ')'; }, api.E.out)
    .then(() => api.wait(hold || 850)).then(() => api.tween(280, k => { b.style.opacity = 1 - k; }, api.E.in));
}
export async function months(api, n, ms) {
  const m = $('#months'), b = $('#mo-n'); if (!m || !b) return; b.textContent = '+0';
  await api.tween(300, k => m.style.opacity = k);
  await api.tween(ms || 2100, k => { b.textContent = '+' + Math.round(n * k); }, api.E.io);
  await api.wait(420);
  await api.tween(320, k => { m.style.opacity = 1 - k; });
}
