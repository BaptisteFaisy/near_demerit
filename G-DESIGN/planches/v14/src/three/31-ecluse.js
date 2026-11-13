// TITRE: L'écluse
// SLOGAN: Un permis professionnel <b>à points</b> | qui <b>ouvre</b> les portes, qui <b>paie</b> le client lésé | et qui ne se <b>vend pas</b>
// SUB: Léa est coursier. Son jeton NEAR ouvre chaque mission, perd des points à chaque faute confirmée, verse sa caution au client, et reste soudé à son identité. Voici la machine entière.
import { stage, beams, mat, part, coin, stamp, months, THREE, v3, pool, softDot } from './kit3d.js';
import { lea, issuer, clientP, licenceCard, hexPips, fingerprint, coinStack, glowSprite, RoundedBoxGeometry } from './assets.js';

let A, st, B, G = {}, lab = {};
const WY = p => .18 + (p / 12) * 2.15;          /* hauteur d'eau selon les points */
const CW = b => .5 + b * 1.5;                   /* hauteur du contrepoids (caution) */
let waterLevel = WY(0), targetLevel = WY(0), gateOpen = 0, cwCoins = 10, fundLevel = 0;

/* ---------- eau : shader animé, brillant au ras des vagues ---------- */
function waterMat() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 }, uDeep: { value: new THREE.Color(0x160a3a) }, uTop: { value: new THREE.Color(0x9d5cff) }, uHi: { value: new THREE.Color(0xefe6ff) } },
    vertexShader: `uniform float uT; varying float vH; varying vec3 vV; varying vec3 vN;
      void main(){ vec3 p = position;
        float w = sin(p.x*1.5+uT*1.3)*.05 + cos(p.y*1.8-uT*1.05)*.045 + sin((p.x+p.y)*.75+uT*.6)*.03;
        p.z += w; vH = w;
        vN = normalize(normalMatrix * vec3(-cos(p.x*1.5+uT*1.3)*.075, sin(p.y*1.8-uT*1.05)*.081, 1.));
        vec4 mv = modelViewMatrix * vec4(p,1.); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uDeep,uTop,uHi; varying float vH; varying vec3 vV; varying vec3 vN;
      void main(){ float f = pow(1.-max(dot(normalize(vN),normalize(vV)),0.), 2.4);
        vec3 c = mix(uDeep, uTop, smoothstep(-.06,.09,vH));
        c = mix(c, uHi, f*.55);
        c += uHi * pow(max(dot(reflect(-normalize(vV),normalize(vN)), vec3(0.,0.,1.)),0.), 22.)*.5;
        gl_FragColor = vec4(c, .86); }`
  });
}

/* ---------- quais, chambre, échelle des 12 points ---------- */
function chamber() {
  const g = new THREE.Group(); st.world.add(g);
  /* murs de verre : on voit l'eau, la péniche et les vannes depuis l'extérieur */
  const wall = (x, z, w, d, h) => {
    const m = part(new RoundedBoxGeometry(w, h ?? 3.4, d, 2, .05), 'wall', x, (h ?? 3.4) / 2, z, g);
    m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2;
    return m;
  };
  const cap = (x, z, w, d, y) => part(new RoundedBoxGeometry(w, .12, d, 2, .04), 'metal', x, y, z, g);
  wall(0, -2.9, 11.6, 1, 2.5); wall(0, 2.9, 11.6, 1, 2.5);
  wall(-6.3, 0, 1.6, 6.8, 2.5); wall(6.3, 0, 1.6, 6.8, 2.5);
  cap(0, -2.9, 11.7, 1.1, 2.54); cap(0, 2.9, 11.7, 1.1, 2.54);
  cap(-6.3, 0, 1.7, 6.9, 2.54); cap(6.3, 0, 1.7, 6.9, 2.54);
  const floor = part(new RoundedBoxGeometry(11.4, .16, 5.6, 2, .04), 'dark', 0, .06, 0, g); floor.receiveShadow = true;
  /* liseré lumineux des arêtes */
  [[0, -2.39, 11.6, .05], [0, 2.39, 11.6, .05]].forEach(([x, z, w, d]) => part(new THREE.BoxGeometry(w, .035, d), 'glow', x, 2.44, z, g));
  /* échelle graduée 12 → 1 gravée sur le mur du fond */
  const sc = new THREE.Group(); sc.position.set(0, 0, -2.36); g.add(sc); G.scale = sc; G.ticks = [];
  for (let i = 0; i < 12; i++) {
    const y = WY(i + 1) + .06;
    const t = part(new THREE.BoxGeometry(i % 3 === 2 ? 1.5 : .85, .05, .04), i === 11 ? 'hot' : 'glow', -4.4, y, 0, sc);
    G.ticks.push(t);
    if (i % 3 === 2) { const n = part(new THREE.BoxGeometry(.06, .22, .04), 'hot', -3.5, y, 0, sc); G.ticks.push(n); }
  }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 5.5, 44, 26), waterMat());
  water.rotation.x = -Math.PI / 2; water.position.y = waterLevel; g.add(water); G.water = water;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(13, 7), new THREE.MeshBasicMaterial({ map: pool(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .35 }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = .02; g.add(glow);
  return g;
}

/* ---------- vannes : la porte qui s'ouvre ou refuse ---------- */
function gate(x, tag) {
  const g = new THREE.Group(); g.position.set(x, 0, 0); st.world.add(g);
  const frame = part(new RoundedBoxGeometry(.5, 4, 5.6, 2, .06), 'metal', 0, 2, 0, g);
  frame.material = mat('metal');
  const leaf = new THREE.Group(); leaf.position.set(0, 0, 0); g.add(leaf);
  const panel = part(new RoundedBoxGeometry(.34, 3.5, 5, 3, .05), 'body', 0, 1.8, 0, leaf);
  part(new THREE.BoxGeometry(.4, .06, 5.1), 'hot', 0, 3.5, 0, leaf);
  for (let i = -1; i <= 1; i++) part(new THREE.BoxGeometry(.42, .05, 4.6), 'glow', 0, 1.8 + i * .9, 0, leaf);
  const lamp = part(new THREE.SphereGeometry(.13, 16, 12), 'hot', 0, 3.95, 0, g);
  g.userData = { leaf, lamp, panel };
  G[tag] = g; return g;
}

/* ---------- péniche de Léa : la licence flotte avec elle ---------- */
function barge() {
  const g = new THREE.Group(); g.position.set(-2.2, waterLevel, 0); st.world.add(g);
  const hull = part(new RoundedBoxGeometry(3.2, .7, 1.5, 4, .16), 'body', 0, .1, 0, g);
  hull.scale.set(1, 1, .82);
  part(new RoundedBoxGeometry(1.5, .55, 1.15, 3, .1), 'dark', -.55, .55, 0, g);
  part(new THREE.BoxGeometry(3.3, .05, 1.55), 'glow', 0, .42, 0, g);
  part(new RoundedBoxGeometry(.7, .5, .6, 3, .08), 'paper', 1.05, .68, 0, g);
  const p = lea({ scale: .82 }); p.position.set(.25, .45, 0); p.rotation.y = -Math.PI / 2.4; g.add(p);
  const card = licenceCard({ pts: 6, status: 'probation', bond: '1,00', req: '1,00' }, { w: 1.15 });
  card.position.set(-1.05, 1.55, .1); card.rotation.set(-.16, .5, .04); g.add(card);
  const halo = glowSprite(0x9d5cff, 2.2, .35); halo.position.copy(card.position); g.add(halo);
  G.lea = p; G.card = card; G.barge = g; G.bargeHalo = halo;
  return g;
}

/* ---------- tour du registre : empreinte, jauge, vues gratuites ---------- */
function tower() {
  const g = new THREE.Group(); g.position.set(8.6, 0, -1.4); st.world.add(g);
  part(new THREE.CylinderGeometry(1.5, 1.9, .5, 6), 'darker', 0, .25, 0, g);
  const shaft = part(new THREE.CylinderGeometry(.62, .8, 6.2, 6), 'dark', 0, 3.4, 0, g);
  part(new THREE.CylinderGeometry(.66, .66, .07, 6), 'hot', 0, 6.5, 0, g);
  const cab = part(new RoundedBoxGeometry(2.1, 1.3, 2.1, 3, .1), 'glass', 0, 7.3, 0, g);
  part(new THREE.CylinderGeometry(1.5, 1.15, .22, 6), 'metal', 0, 8.05, 0, g);
  const fp = fingerprint({ rings: 8 }); fp.scale.setScalar(.62); fp.position.set(0, 7.3, 1.12); g.add(fp);
  const core = part(new THREE.SphereGeometry(.3, 20, 16), 'hot', 0, 7.3, 0, g);
  /* jauge verticale : le niveau d'eau du registre */
  const tube = part(new THREE.CylinderGeometry(.17, .17, 5.4, 18, 1, true), 'glass', .95, 3.3, 0, g);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 1, 18), mat('liquid')); col.position.set(.95, .7, 0); g.add(col);
  G.tower = g; G.fp = fp; G.core = core; G.gaugeCol = col; G.tube = tube;
  return g;
}

/* ---------- pont roulant de la plateforme : dépose les missions ---------- */
function crane() {
  const g = new THREE.Group(); g.position.set(1.6, 0, 0); st.world.add(g);
  [-3.9, 3.9].forEach(z => { part(new RoundedBoxGeometry(.42, 6.4, .42, 2, .06), 'metal', 0, 3.2, z, g); part(new THREE.BoxGeometry(.5, .06, .5), 'glow', 0, 6.36, z, g); });
  part(new RoundedBoxGeometry(.6, .5, 8.4, 2, .08), 'dark', 0, 6.1, 0, g);
  part(new THREE.BoxGeometry(.66, .05, 8.3), 'hot', 0, 5.84, 0, g);
  const trolley = new THREE.Group(); trolley.position.set(0, 5.7, 0); g.add(trolley);
  part(new RoundedBoxGeometry(.9, .5, .9, 2, .08), 'body', 0, 0, 0, trolley);
  const cable = part(new THREE.CylinderGeometry(.02, .02, 2, 8), 'glow', 0, -1, 0, trolley);
  const hook = new THREE.Group(); hook.position.set(0, -2, 0); trolley.add(hook);
  const parcel = part(new RoundedBoxGeometry(.85, .6, .7, 3, .07), 'paper', 0, -.3, 0, hook);
  part(new THREE.BoxGeometry(.87, .07, .72), 'hot', 0, -.3, 0, hook);
  G.crane = g; G.trolley = trolley; G.cable = cable; G.hook = hook; G.parcel = parcel;
  return g;
}

/* ---------- contrepoids de la caution + réservoir du fonds ---------- */
function bondMachine() {
  const g = new THREE.Group(); g.position.set(-7.4, 0, 2.9); st.world.add(g);
  part(new RoundedBoxGeometry(2.2, .4, 2.2, 2, .06), 'darker', 0, .2, 0, g);
  const tube = part(new THREE.CylinderGeometry(.78, .78, 4.4, 24, 1, true), 'glass', 0, 2.5, 0, g);
  part(new THREE.TorusGeometry(.8, .05, 10, 32), 'metal', 0, 4.7, 0, g).rotation.x = Math.PI / 2;
  part(new THREE.TorusGeometry(.8, .05, 10, 32), 'metal', 0, .32, 0, g).rotation.x = Math.PI / 2;
  const req = part(new THREE.TorusGeometry(.86, .035, 8, 40), 'hot', 0, CW(1), 0, g); req.rotation.x = Math.PI / 2;
  const stack = coinStack(10, { r: .5 }); stack.position.y = .45; g.add(stack);
  G.bondStack = stack; G.bondReq = req; G.bondTube = tube; G.bondGroup = g;

  const r = new THREE.Group(); r.position.set(8, 0, 3.9); st.world.add(r);
  const basin = part(new THREE.CylinderGeometry(1.7, 1.45, 1.5, 32, 1, true), 'metal', 0, .75, 0, r);
  part(new THREE.TorusGeometry(1.72, .06, 10, 40), 'hot', 0, 1.5, 0, r).rotation.x = Math.PI / 2;
  const liq = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.4, 1, 32), mat('liquid')); liq.position.y = .1; liq.scale.y = .02; r.add(liq);
  G.fundLiq = liq; G.fundGroup = r;
  return g;
}

/* ---------- personnes sur les quais ---------- */
function people() {
  const iss = issuer({ scale: .92 }); iss.position.set(-8.4, .5, -1.6); iss.rotation.y = Math.PI / 2.6; st.world.add(iss);
  const off = part(new RoundedBoxGeometry(2.4, 2, 2, 3, .08), 'dark', -8.4, 1.5, -1.6, st.world);
  part(new THREE.BoxGeometry(2.45, .06, 2.05), 'hot', -8.4, 2.52, -1.6, st.world);
  const cl = clientP({ scale: .92 }); cl.position.set(3.9, .1, 5.1); cl.rotation.y = -Math.PI / 3.4; st.world.add(cl);
  const quay = part(new RoundedBoxGeometry(6.5, .2, 3), 'darker', 4.6, .1, 5.4, st.world);
  G.issuer = iss; G.issuerDesk = off; G.client = cl; G.quay = quay;
}

/* ---------- étiquettes projetées des 6 parties ---------- */
function labels() {
  lab.issuer = st.label('issuer', G.issuerDesk, v3(0, 1.9, 0));
  lab.platform = st.label('platform', G.crane, v3(0, 7.2, 0));
  lab.pro = st.label('pro', G.barge, v3(0, 2.9, 0));
  lab.client = st.label('client', G.client, v3(0, 2.3, 0));
  lab.registry = st.label('registry', G.tower, v3(0, 8.9, 0));
  lab.fund = st.label('fund', G.fundGroup, v3(0, 2.3, 0));
  Object.values(lab).forEach(q => { q.el.classList.add('lab'); });
}

/* ---------- état dur (saut, rejeu) ---------- */
function apply(s) {
  waterLevel = targetLevel = WY(s.pts);
  G.water.position.y = waterLevel;
  G.barge.position.y = waterLevel;
  G.lea.position.y = .45;
  G.gaugeCol.scale.y = Math.max(.02, s.pts / 12); G.gaugeCol.position.y = .7 + (s.pts / 12) * 2.4;
  G.ticks.forEach((t, i) => { t.visible = i < Math.max(0, 12 - s.pts) || true; t.material = i < 12 - s.pts ? mat('darker') : mat('glow'); });
  cwCoins = Math.max(0, Math.round(s.bond * 10));
  G.bondStack.children.forEach((c, i) => { c.visible = i < cwCoins; });
  G.bondReq.position.y = CW(s.req);
  fundLevel = Math.min(1, s.fund / .4);
  G.fundLiq.scale.y = Math.max(.02, fundLevel); G.fundLiq.position.y = .1 + fundLevel * .55;
  G.card.userData.set({ pts: s.pts, status: s.status, bond: A.fmt(s.bond), req: A.fmt(s.req), token: s.token || 'demerit-1' });
  gateOpen = 0; setGate(0);
  G.barge.position.x = -2.2;
}
function setGate(k) {
  gateOpen = k;
  [G.gateUp, G.gateDown].forEach(g => {
    g.userData.leaf.position.y = k * 3.3;
    g.userData.lamp.material = k > .8 ? mat('hot') : mat('glow');
    g.userData.lamp.scale.setScalar(1 + k * .3);
  });
}

/* ---------- init ---------- */
function init(api) {
  A = api;
  st = stage(api, {
    env: 'orage', fog: .021, exposure: 1, bloom: .6, threshold: .78, grain: .06, dof: false,
    gridStep: .8, haloO: .3,
    shots: {
      idle: { pos: [13.5, 7, 15.5], look: [0, 1.9, 0], fov: 34 },
      wide: { pos: [16, 9.5, 19], look: [0, 1.6, 0], fov: 32 },
      chamber: { pos: [5.5, 3.6, 9.5], look: [-1.2, 1.3, 0], fov: 36 },
      barge: { pos: [1.4, 2.7, 6.6], look: [-2.2, 1.3, 0], fov: 38 },
      gate: { pos: [11, 3.4, 7.5], look: [5.6, 1.7, 0], fov: 38 },
      tower: { pos: [4.2, 5.2, 6.2], look: [8.6, 4, -1.4], fov: 36 },
      crane: { pos: [-3.4, 5.4, 9.6], look: [1.6, 3.6, 0], fov: 38 },
      bond: { pos: [-3.2, 2.9, 8], look: [-7.4, 2.2, 2.9], fov: 38 },
      fund: { pos: [3.8, 3.2, 9.4], look: [8, 1, 3.9], fov: 38 },
      client: { pos: [1.2, 2.6, 10.4], look: [3.9, 1.2, 5.1], fov: 38 },
      scale: { pos: [2.5, 2.4, 7.5], look: [-3.4, 1.5, -2.3], fov: 40 }
    }
  });
  if (!st.renderer) return;
  B = beams(st, api);
  chamber(); gate(-5.9, 'gateUp'); gate(5.9, 'gateDown'); barge(); tower(); crane(); bondMachine(); people(); labels();
  st.snap('idle');
  /* vie permanente : eau, empreinte, halos */
  st.onTick((t) => {
    G.water.material.uniforms.uT.value = t / 1000;
    G.barge.position.y = waterLevel + Math.sin(t / 900) * .035;
    G.barge.rotation.z = Math.sin(t / 1300) * .012;
    G.fp.rotation.z = t / 5200;
    G.core.scale.setScalar(1 + Math.sin(t / 620) * .06);
    G.gaugeCol.scale.y = Math.max(.02, A.state.pts / 12);
  });
  apply({ ...A.state });
}

/* ---------- lecture de l'état ---------- */
function sync(s) { apply(s); }

/* ---------- petits gestes réutilisables ---------- */
const P = {
  issuer: () => v3(-8.4, 2.4, -1.6), registry: () => v3(8.6, 7.3, -1.4), pro: () => G.barge.position.clone().add(v3(0, 1.6, 0)),
  platform: () => v3(1.6, 5.7, 0), client: () => v3(3.9, 1.3, 5.1), fund: () => v3(8, 1.2, 3.9), bond: () => v3(-7.4, 2.4, 2.9)
};
async function dropParcel(a, to, ms) {
  const y0 = G.hook.position.y;
  await a.tween(ms || 900, k => { G.hook.position.y = y0 - k * 2.4; G.cable.scale.y = 1 + k * 1.2; G.cable.position.y = -1 - k * 1.2; }, a.E.io);
  G.parcel.visible = false;
  await a.wait(220);
  G.parcel.visible = true;
  await a.tween(700, k => { G.hook.position.y = y0 - 2.4 + k * 2.4; G.cable.scale.y = 1 + (1 - k) * 1.2; G.cable.position.y = -1 - (1 - k) * 1.2; }, a.E.io);
}
async function water(a, pts, ms) {
  const from = waterLevel, to = WY(pts);
  await a.tween(ms || 1300, k => {
    waterLevel = a.lerp(from, to, k);
    G.water.position.y = waterLevel; G.barge.position.y = waterLevel;
    G.gaugeCol.position.y = .7 + ((waterLevel - .18) / 2.15) * 2.4;
  }, a.E.io);
  targetLevel = to;
}
async function splash(a, n, at) { await B.burst(at || v3(-2.2, waterLevel + .1, 0), n || 22, 900, 'hot'); }

/* ---------- les 18 temps ---------- */
async function beat(b, a) {
  const id = b.id;
  switch (id) {
    case '0a': {
      await st.shot('chamber', 1200);
      await B.off(P.issuer(), P.pro(), 1400);
      G.fp.userData.rings.forEach((r, i) => a.wait(i * 60).then(() => a.tween(300, k => r.scale.setScalar(k), a.E.back)));
      await stamp(a, 'fp-lea', 'code', 700);
      break;
    }
    case '0b': {
      await st.shot('scale', 1100);
      await B.tx(P.issuer(), P.registry(), 1000);
      for (let i = 11; i >= 0; i--) { const t = G.ticks[i * 2]; if (t) { t.material = mat('hot'); await a.tween(70, k => t.scale.x = 1 + Math.sin(k * Math.PI) * .8); t.material = mat('glow'); } }
      await stamp(a, '12', 'num', 700);
      break;
    }
    case '1': {
      await st.shot('barge', 1200);
      await B.tx(P.issuer(), P.registry(), 900);
      await B.tx(P.registry(), P.pro(), 900);
      a.commit(['pts', 'status', 'token']);
      G.card.scale.setScalar(.01);
      await a.tween(700, k => G.card.scale.setScalar(k), a.E.back);
      G.bargeHalo.material.opacity = .8;
      await water(a, 6, 1500);
      a.commit(['bond', 'req']);
      await splash(a, 26);
      await stamp(a, '6', 'num', 700);
      break;
    }
    case '2a': {
      await st.shot('crane', 1100);
      await B.tx(P.client(), P.platform(), 950);
      await dropParcel(a, P.pro(), 1100);
      await stamp(a, '0,10', 'code', 620);
      break;
    }
    case '2b': {
      await st.shot('gate', 1200);
      await B.xcc(P.platform(), P.registry(), 1200);
      await a.tween(1200, k => setGate(k), a.E.io);
      await stamp(a, 'OUI', 'code', 620);
      break;
    }
    case '2c': {
      await st.shot('barge', 1000);
      const x0 = G.barge.position.x;
      await a.tween(2200, k => { G.barge.position.x = a.lerp(x0, 3.4, k); }, a.E.io);
      await B.pay(P.platform(), P.pro(), 5, 900);
      a.commit();
      await stamp(a, '+0,10', 'code', 600);
      break;
    }
    case '3': {
      await st.shot('chamber', 1100);
      await B.tx(P.client(), P.registry(), 900);
      G.barge.position.x = -2.2; setGate(0);
      a.commit(['pts']);
      await water(a, 3, 1500);
      await splash(a, 30);
      await st.shake(1.1);
      await stamp(a, '−3', 'num', 700);
      break;
    }
    case '4': {
      await st.shot('tower', 1200);
      await months(a, 6, 2200);
      await B.view(P.registry(), 1500, 6);
      a.commit(['pts', 'month']);
      await water(a, 4, 1400);
      await stamp(a, '+1', 'num', 620);
      break;
    }
    case '5a': {
      await st.shot('chamber', 1200);
      await B.tx(P.client(), P.registry(), 900);
      a.commit(['pts', 'status', 'inval']);
      await water(a, 0, 1700);
      await splash(a, 44);
      await st.shake(2.4, 700);
      G.core.material = mat('hot');
      await stamp(a, '0', 'num', 760);
      break;
    }
    case '5b': {
      await st.shot('bond', 1200);
      a.commit(['bond', 'fund', 'credit', 'coef', 'req']);
      await B.pay(P.bond(), P.client(), 4, 1000);
      await st.shot('fund', 1000);
      await B.pay(P.bond(), P.fund(), 3, 900);
      fundLevel = .5;
      await a.tween(900, k => { G.fundLiq.scale.y = Math.max(.02, k * .5); G.fundLiq.position.y = .1 + k * .28; }, a.E.io);
      await stamp(a, '0,20', 'num', 700);
      break;
    }
    case '6': {
      await st.shot('gate', 1100);
      await B.no(P.platform(), P.pro(), 900);
      await st.shake(1.6);
      await stamp(a, 'ERR_LICENSE_SUSPENDED', 'code', 900);
      break;
    }
    case '7': {
      await st.shot('wide', 1400);
      const ghost = lea({ scale: .8 }); ghost.position.set(-11, .5, 3.4); st.world.add(ghost);
      const hull = part(new RoundedBoxGeometry(3, .66, 1.4, 4, .15), 'dark', -11, .35, 3.4, st.world);
      await a.tween(1600, k => { ghost.position.x = a.lerp(-11, -7.6, k); hull.position.x = ghost.position.x; }, a.E.io);
      await B.no(P.registry(), v3(-7.6, 1.6, 3.4), 900);
      G.fp.userData.rings.forEach(r => a.tween(400, k => r.material.emissiveIntensity = 1.5 + Math.sin(k * Math.PI) * 4));
      await st.shake(1.4);
      await stamp(a, 'ERR_IDENTITY_SUSPENDED', 'code', 950);
      await a.tween(600, k => { ghost.scale.setScalar(.8 * (1 - k)); hull.scale.y = 1 - k; }, a.E.in);
      st.world.remove(ghost); st.world.remove(hull);
      break;
    }
    case '8a': {
      await st.shot('tower', 1200);
      await months(a, 6, 2000);
      await B.view(P.registry(), 1400, 6);
      a.commit(['pts', 'status', 'month']);
      await st.shot('chamber', 1000);
      await water(a, 6, 1600);
      await splash(a, 20);
      await stamp(a, '6', 'num', 640);
      break;
    }
    case '8b': {
      await st.shot('gate', 1200);
      await B.no(P.platform(), P.pro(), 850);
      await a.tween(700, k => setGate(Math.sin(k * Math.PI) * .28), a.E.io);
      setGate(0);
      await st.shake(1.3);
      await stamp(a, 'ERR_UNDER_BONDED', 'code', 900);
      break;
    }
    case '8c': {
      await st.shot('bond', 1200);
      await B.pay(P.pro(), P.bond(), 7, 1200);
      a.commit(['bond']);
      cwCoins = 13;
      G.bondStack.children.forEach((c, i) => { c.visible = i < cwCoins; });
      await a.tween(500, k => G.bondReq.scale.setScalar(1 + Math.sin(k * Math.PI) * .3));
      await stamp(a, '+0,65', 'num', 640);
      break;
    }
    case '8d': {
      await st.shot('gate', 1100);
      await B.xcc(P.platform(), P.registry(), 1100);
      await a.tween(1300, k => setGate(k), a.E.io);
      a.commit();
      const x0 = G.barge.position.x;
      await a.tween(2000, k => { G.barge.position.x = a.lerp(x0, 4.6, k); }, a.E.io);
      await stamp(a, 'OUI', 'code', 620);
      break;
    }
    case '9': {
      await st.shot('barge', 1100);
      const c0 = G.card.position.clone();
      await a.tween(700, k => { G.card.position.x = c0.x + k * 1.5; G.card.rotation.y = .5 + k * 1.2; }, a.E.io);
      await B.no(P.pro(), P.client(), 700);
      await st.shake(1.8);
      await stamp(a, 'ERR_SOULBOUND', 'code', 900);
      await a.tween(700, k => { G.card.position.x = c0.x + 1.5 * (1 - k); G.card.rotation.y = .5 + 1.2 * (1 - k); }, a.E.back);
      break;
    }
    case '10': {
      await st.shot('client', 1100);
      await B.pay(P.registry(), P.client(), 4, 1000);
      a.commit();
      await st.shot('wide', 1800);
      await a.tween(900, k => { G.bondReq.scale.setScalar(1 + Math.sin(k * Math.PI) * .25); });
      await stamp(a, '10/10', 'num', 900);
      break;
    }
    default: await st.shot('chamber', 1000);
  }
}

/* ---------- mode manuel : la 3D suit l'état réel du moteur ---------- */
async function manual(s, meta) {
  if (!st.renderer) return;
  const a = A;
  if (meta && meta.kind === 'no') await st.shake(1.2);
  if (meta && meta.kind === 'pay') await B.pay(P.pro(), P.client(), 4, 800);
  if (meta && meta.kind === 'xcc') await B.xcc(P.platform(), P.registry(), 900);
  await water(a, s.pts, 900);
  cwCoins = Math.max(0, Math.round(s.bond * 10));
  G.bondStack.children.forEach((c, i) => { c.visible = i < cwCoins; });
  G.bondReq.position.y = CW(s.req);
  fundLevel = Math.min(1, s.fund / .4);
  await a.tween(700, k => { G.fundLiq.scale.y = Math.max(.02, k * fundLevel); G.fundLiq.position.y = .1 + k * fundLevel * .55; }, a.E.io);
  G.card.userData.set({ pts: s.pts, status: s.status, bond: A.fmt(s.bond), req: A.fmt(s.req), token: s.token || 'demerit-1' });
  const ok = s.bond >= s.req && s.pts > 0 && s.status !== 'suspendu';
  await a.tween(900, k => setGate(ok ? k : 0), a.E.io);
}

window.SCENE = { init, sync, beat, manual };
