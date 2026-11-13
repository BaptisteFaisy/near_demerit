/* demerit · V14 — type3d.js : typographie 3D (TextGeometry + polices embarquées).
   Isolé d'assets.js pour ne pas alourdir les planches qui n'en ont pas besoin (~300 Ko de fontes). */
import { THREE, mat } from './kit3d.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import fontBold from 'three/examples/fonts/helvetiker_bold.typeface.json';
import fontReg from 'three/examples/fonts/helvetiker_regular.typeface.json';
export { TextGeometry, FontLoader, fontBold, fontReg };

const FB = new FontLoader().parse(fontBold), FR = new FontLoader().parse(fontReg);
export const fonts = { bold: FB, regular: FR };
/* helvetiker n'embarque pas tous les diacritiques : on les retire pour la 3D */
export const plain = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/[·—–]/g, '-').replace(/[’‘]/g, "'");

export function text3d(str, o = {}) {
  const g = new TextGeometry(plain(str), {
    font: o.bold === false ? FR : FB, size: o.size ?? .4, height: o.depth ?? .06,
    curveSegments: o.curve ?? 6, bevelEnabled: o.bevel !== false,
    bevelThickness: .008, bevelSize: .006, bevelSegments: 2
  });
  if (o.center !== false) g.center();
  const m = new THREE.Mesh(g, o.mat || mat(o.m || 'hot'));
  m.castShadow = true;
  return m;
}
/* chiffre monumental : le même, prêt à poser */
export const num3d = (n, o = {}) => text3d(String(n), Object.assign({ size: 1.6, depth: .22 }, o));
