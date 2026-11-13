/* demerit · V14 — assets.js : accessoires 3D partagés (personnages, carte-permis, typo 3D, empreinte, caution).
   Les scènes importent ce dont elles ont besoin ; tout est procédural, aucune ressource réseau. */
import { THREE, mat, part, canvasTex, softDot, COL } from './kit3d.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
export { RoundedBoxGeometry };

/* ---------- personnages ---------- */
export function person(o = {}) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const torso = o.torso || 'body';
  part(new THREE.CapsuleGeometry(.1, .46, 4, 12), 'dark', -.11, .34, 0, body);
  part(new THREE.CapsuleGeometry(.1, .46, 4, 12), 'dark', .11, .34, 0, body);
  const t = part(new THREE.CapsuleGeometry(.25, .4, 8, 18), torso, 0, .98, 0, body); t.scale.set(1, 1, .7);
  const armL = part(new THREE.CapsuleGeometry(.07, .44, 4, 10), torso, -.34, .96, 0, body); armL.rotation.z = .17;
  const armR = part(new THREE.CapsuleGeometry(.07, .44, 4, 10), torso, .34, .96, 0, body); armR.rotation.z = -.17;
  const head = new THREE.Group(); head.position.set(0, 1.5, 0); body.add(head);
  part(new THREE.SphereGeometry(.21, 26, 20), 'skin', 0, 0, 0, head);
  part(new THREE.SphereGeometry(.026, 8, 6), 'eye', -.075, .02, .19, head);
  part(new THREE.SphereGeometry(.026, 8, 6), 'eye', .075, .02, .19, head);
  if (o.smile !== false) { const s = part(new THREE.TorusGeometry(.055, .011, 6, 14, Math.PI), 'eye', 0, -.065, .185, head); s.rotation.z = Math.PI; }
  if (o.hair !== false) { const h = part(new THREE.SphereGeometry(.225, 22, 16, 0, Math.PI * 2, 0, Math.PI * .56), 'hair', 0, .02, -.02, head); h.rotation.x = -.24; }
  if (o.ponytail) { const p = part(new THREE.CapsuleGeometry(.065, .28, 4, 10), 'hair', 0, -.11, -.25, head); p.rotation.x = .5; }
  if (o.bun) part(new THREE.SphereGeometry(.095, 14, 12), 'hair', 0, .23, -.05, head);
  if (o.cap === 'courier') {
    part(new THREE.SphereGeometry(.23, 22, 14, 0, Math.PI * 2, 0, Math.PI * .5), 'cap', 0, .05, 0, head);
    const v = part(new THREE.CylinderGeometry(.185, .185, .022, 22, 1, false, -Math.PI * .5, Math.PI), 'cap', 0, .055, .09, head); v.scale.z = 1.3;
    part(new THREE.OctahedronGeometry(.04), 'hot', 0, .19, .19, head);
  }
  if (o.cap === 'kepi') {
    part(new THREE.CylinderGeometry(.2, .23, .19, 22), 'dark', 0, .19, 0, head);
    part(new THREE.CylinderGeometry(.245, .245, .026, 22), 'glow', 0, .13, 0, head);
    const v = part(new THREE.CylinderGeometry(.17, .17, .018, 18, 1, false, -Math.PI * .5, Math.PI), 'dark', 0, .095, .09, head); v.scale.z = 1.4;
    part(new THREE.OctahedronGeometry(.045), 'hot', 0, .21, .21, head);
  }
  if (o.bag) { part(new RoundedBoxGeometry(.4, .42, .28, 3, .04), 'cap', 0, 1.08, -.32, body); const s = part(new THREE.BoxGeometry(.055, .66, .035), 'hot', 0, 1.03, .18, body); s.rotation.z = .7; }
  if (o.parcel) { const p = part(new RoundedBoxGeometry(.4, .3, .3, 2, .03), 'paper', 0, .87, .32, body); part(new THREE.BoxGeometry(.41, .035, .31), 'glow', 0, .87, .32, body); armL.rotation.set(-1.05, 0, .24); armR.rotation.set(-1.05, 0, -.24); armL.position.z = armR.position.z = .17; }
  g.scale.setScalar(o.scale || 1);
  g.userData = { head, body, armL, armR };
  return g;
}
export const lea = (o = {}) => person({ cap: 'courier', ponytail: true, bag: true, ...o });
export const issuer = (o = {}) => person({ cap: 'kepi', hair: false, torso: 'dark', ...o });
export const clientP = (o = {}) => person({ bun: true, parcel: true, torso: 'body', ...o });
/* agent délégué (agent1.lea.testnet) : petit robot */
export function agent(o = {}) {
  const g = new THREE.Group();
  part(new RoundedBoxGeometry(.34, .4, .3, 4, .06), 'metal', 0, .62, 0, g);
  const head = part(new RoundedBoxGeometry(.26, .2, .24, 4, .05), 'dark', 0, .94, 0, g);
  part(new THREE.SphereGeometry(.05, 12, 10), 'hot', 0, .94, .13, g);
  part(new THREE.CylinderGeometry(.02, .02, .16, 8), 'glow', 0, 1.1, 0, g);
  part(new THREE.TorusGeometry(.16, .02, 8, 24), 'glow', 0, .62, 0, g).rotation.x = Math.PI / 2;
  const hover = new THREE.Mesh(new THREE.ConeGeometry(.14, .2, 16, 1, true), mat('glow')); hover.position.y = .3; hover.rotation.x = Math.PI; g.add(hover);
  g.userData = { head, hover }; g.scale.setScalar(o.scale || 1); return g;
}

/* ---------- carte-permis : la vraie fiche du jeton, mise à jour avec l'état ---------- */
export function cardFace(v) {
  return canvasTex(640, 400, (x, W, H) => {
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#150b2e'); g.addColorStop(.55, '#0d0620'); g.addColorStop(1, '#1b0f3d');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(157,92,255,.55)'; x.lineWidth = 3; x.strokeRect(9, 9, W - 18, H - 18);
    x.strokeStyle = 'rgba(157,92,255,.14)'; x.lineWidth = 1;
    for (let i = 0; i < 26; i++) { x.beginPath(); x.moveTo(0, i * 16); x.lineTo(W, i * 16 - 60); x.stroke(); }
    x.fillStyle = '#9d5cff'; x.font = '600 22px Consolas,monospace'; x.fillText('DEMERIT', 34, 62);
    x.fillStyle = 'rgba(201,184,238,.75)'; x.font = '400 15px Consolas,monospace'; x.fillText('PERMIS PROFESSIONNEL · SOULBOUND NEP-171', 34, 90);
    x.fillStyle = '#efe6ff'; x.font = '200 66px "Segoe UI",system-ui,sans-serif'; x.fillText(v.name || 'LEA', 34, 176);
    x.fillStyle = 'rgba(201,184,238,.8)'; x.font = '400 19px Consolas,monospace'; x.fillText((v.account || 'lea.testnet') + '  ·  ' + (v.cat || 'COURSIER'), 34, 208);
    x.fillStyle = '#efe6ff'; x.font = '200 104px "Segoe UI",system-ui,sans-serif'; x.fillText(String(v.pts ?? 6), 34, 330);
    x.fillStyle = '#9d5cff'; x.font = '400 30px "Segoe UI",system-ui,sans-serif'; x.fillText('/12', 34 + (v.pts >= 10 ? 118 : 62), 330);
    for (let i = 0; i < 12; i++) {
      const px = 210 + (i % 6) * 34, py = 268 + Math.floor(i / 6) * 34;
      x.beginPath(); x.arc(px, py, 11, 0, 7); x.fillStyle = i < (v.pts ?? 6) ? '#9d5cff' : 'rgba(157,92,255,.16)'; x.fill();
    }
    x.fillStyle = (v.status || '').includes('suspend') ? '#efe6ff' : 'rgba(201,184,238,.9)';
    x.font = '600 20px Consolas,monospace'; x.fillText(String(v.status || 'probation').toUpperCase(), 210, 240);
    x.fillStyle = 'rgba(157,92,255,.85)'; x.font = '400 16px Consolas,monospace';
    x.fillText('TOKEN ' + (v.token || 'demerit-1'), 210, 356);
    x.fillText('CAUTION ' + (v.bond ?? '1,00') + ' / ' + (v.req ?? '1,00') + ' N', 392, 356);
    x.fillStyle = 'rgba(239,230,255,.5)'; x.font = '400 13px Consolas,monospace';
    x.fillText('EMPREINTE ' + (v.fp || 'fp-lea'), 392, 62);
    x.strokeStyle = 'rgba(239,230,255,.35)'; x.lineWidth = 2;
    for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(560, 200, 16 + i * 9, -1.1, 1.1); x.stroke(); }
  }, { colorSpace: THREE.SRGBColorSpace });
}
export function licenceCard(v = {}, o = {}) {
  const g = new THREE.Group();
  const w = o.w ?? 1.6, h = w * .625;
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, .035, 4, .02), mat('dark')); body.castShadow = true; g.add(body);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w * .985, h * .97), new THREE.MeshStandardMaterial({ map: cardFace(v), roughness: .38, metalness: .12, emissive: 0x2a1460, emissiveIntensity: .55 }));
  face.position.z = .019; g.add(face);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w * .985, h * .97), new THREE.MeshStandardMaterial({ color: 0x120a28, roughness: .5, metalness: .4 }));
  back.position.z = -.019; back.rotation.y = Math.PI; g.add(back);
  const edge = new THREE.Mesh(new RoundedBoxGeometry(w * 1.01, h * 1.02, .04, 4, .02), new THREE.MeshBasicMaterial({ color: 0x9d5cff, transparent: true, opacity: .18 })); g.add(edge);
  g.userData = { face, body, edge, set(nv) { face.material.map = cardFace(nv); face.material.needsUpdate = true; } };
  return g;
}

/* ---------- 12 hexagones : les points ---------- */
export function hexPips(o = {}) {
  const g = new THREE.Group(); const n = o.n ?? 12, r = o.r ?? .13, gap = o.gap ?? .06;
  const pips = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, o.d ?? .05, 6), mat('glow'));
    m.rotation.x = Math.PI / 2;
    const per = o.per ?? 6, row = Math.floor(i / per);
    m.position.set((i % per) * (r * 1.78 + gap) - ((per - 1) * (r * 1.78 + gap)) / 2, -row * (r * 1.6 + gap), 0);
    g.add(m); pips.push(m);
  }
  g.userData = { pips, set(on) { pips.forEach((p, i) => { p.material = i < on ? mat('hot') : mat('darker'); p.scale.setScalar(i < on ? 1 : .82); }); } };
  g.userData.set(o.on ?? 12);
  return g;
}

/* ---------- empreinte d'identité (le casier suit la personne) ---------- */
export function fingerprint(o = {}) {
  const g = new THREE.Group(); const n = o.rings ?? 9;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(.16 + i * .1, .011, 6, 60, Math.PI * (1.15 + (i % 3) * .18)), mat(i % 2 ? 'glow' : 'hot'));
    m.rotation.z = (i % 2 ? .5 : -.4) + i * .12; m.position.y = Math.sin(i) * .03; g.add(m);
  }
  g.userData.rings = g.children.slice();
  return g;
}

/* ---------- coffre de caution ---------- */
export function vault(o = {}) {
  const g = new THREE.Group(); const s = o.scale ?? 1;
  part(new RoundedBoxGeometry(1.1, 1.1, 1, 4, .07), 'metal', 0, .58, 0, g);
  const door = new THREE.Group(); door.position.set(0, .58, .5); g.add(door);
  part(new RoundedBoxGeometry(.96, .96, .08, 4, .04), 'dark', 0, 0, 0, door);
  const dial = part(new THREE.TorusGeometry(.24, .035, 10, 32), 'hot', 0, 0, .06, door);
  part(new THREE.CylinderGeometry(.05, .05, .05, 14), 'glow', 0, 0, .07, door).rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) part(new THREE.BoxGeometry(.03, .03, .1), 'metal', Math.cos(i / 8 * 6.28) * .34, Math.sin(i / 8 * 6.28) * .34, .05, door);
  g.userData = { door, dial }; g.scale.setScalar(s); return g;
}
export function coinStack(n, o = {}) {
  const g = new THREE.Group(); const r = o.r ?? .16;
  for (let i = 0; i < n; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .035, 28), mat('coin')); c.position.y = i * .04; c.castShadow = true; g.add(c); }
  return g;
}
export function glowSprite(col, size, op) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: col ?? COL.v, transparent: true, opacity: op ?? .8, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size ?? 1.6); return s;
}
