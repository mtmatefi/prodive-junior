import * as THREE from './vendor/three.module.min.js';
// ---- profiles: each child has its own saved game (profile 1 keeps the old keys)
const __lsGet = Storage.prototype.getItem, __lsSet = Storage.prototype.setItem;
{ let act = 1; try { act = (JSON.parse(__lsGet.call(localStorage, 'seaju_profiles')) || {}).act || 1; } catch (e) {}
  if (act !== 1) { const map = (k) => (typeof k === 'string' && k.startsWith('seaju') && !k.includes('#') && k !== 'seaju_profiles' && k !== 'seaju_lang') ? k + '#' + act : k;
    Storage.prototype.getItem = function (k) { return __lsGet.call(this, map(k)); }; Storage.prototype.setItem = function (k, v) { return __lsSet.call(this, map(k), v); }; } }

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const phone = $('#phone');
const canvas = $('#gl');
const TAN = Math.tan(THREE.MathUtils.degToRad(20)); // fov 40

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
let W = 390, H = 844, aspect = W / H;

// ---------- loading ----------
const loader = new THREE.TextureLoader();
const files = ['bg_map.jpg', 'd_map.png', 'bg_explore.jpg', 'd_explore.png', 'bg_anemone.jpg', 'd_anemone.png', 'bg_manta.jpg', 'd_manta.png', 'bg_base.jpg', 'd_base.png', 'diver.png', 'turtle.png', 'fusilier.png', 'clown.png', 'manta.png', 'kneel.png', 'bg_jetty.jpg', 'd_jetty.png', 'bg_fan.jpg', 'd_fan.png', 'bg_kri.jpg', 'd_kri.png', 'sp_wobbegong.png', 'sp_seahorse.png', 'sp_parrotfish.png', 'sp_moorish.png', 'bg_beach.jpg', 'd_beach.png', 'bg_night.jpg', 'd_night.png', 'bg_boat.jpg', 'd_boat.png', 'wayan.png', 'it_bottle.png', 'it_bag.png', 'it_can.png', 'it_flipflop.png', 'it_cup.png', 'it_net.png', 'it_canang1.png', 'it_canang2.png', 'sil_acropora.png', 'bg_home.jpg', 'd_home.png', 'bg_mangrove.jpg', 'd_mangrove.png', 'bg_glow.jpg', 'd_glow.png', 'kakek.png', 'it_seed.png', 'it_mtree.png', 'pano_beach.jpg', 'ayu.png', 'pano_home.jpg', 'pano_reef.jpg', 'pano_anemone.jpg', 'pano_manta.jpg', 'pano_boatday.jpg', 'pano_nightreef.jpg', 'pano_boatnight.jpg', 'pano_mangrove.jpg', 'pano_farm.jpg', 'wdiver.png', 'adiver.png', 'village.png', 'sp_whaleshark.png', 'sp_mola.png', 'sp_octopus.png', 'sp_reefshark.png', 'sp_nudi.png'];
const tex = {};
let loaded = 0;
await Promise.all(files.map((f) => new Promise((res) => {
  loader.load('assets/' + f, (t) => {
    t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    tex[f.split('.')[0]] = t; loaded++; $('#lbar').style.width = (loaded / files.length * 100) + '%'; res();
  }, undefined, () => { loaded++; res(); });
})));

// ---------- shaders ----------
const plateVS = `
uniform sampler2D dmap; uniform float D, L0; uniform vec2 c0;
varying vec2 vUv; varying float vD;
void main(){ vUv=uv; float d=texture2D(dmap,uv).r; vD=d; vec3 p=position; p.z=d*D;
  p.xy = c0 + (p.xy-c0)*(L0-p.z)/L0;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`;
const plateFS = `
uniform sampler2D map; uniform float time, caustic, wobble, blueOnly, bleach, night; uniform vec2 swayC; uniform float swayR, swayA; uniform vec4 patches[4];
varying vec2 vUv; varying float vD;
float cpat(vec2 p){ float c=0.; vec2 q=p;
  for(int i=0;i<3;i++){ float fi=float(i);
    q=vec2(q.x+sin(q.y*1.3+time*0.55+fi)*0.7, q.y+cos(q.x*1.5-time*0.45+fi*1.7)*0.7);
    float v=abs(sin(q.x)+sin(q.y))*0.5; c+=1./(1.+60.*v*v); }
  return c/3.; }
void main(){ vec2 uv=vUv;
  vec3 base=texture2D(map,uv).rgb;
  float bm = mix(1., smoothstep(0.02,0.12, base.b-base.r), blueOnly);
  float w = wobble*bm;
  uv.x += sin(uv.y*38.+time*1.2)*0.0016*w*(0.5+vD);
  uv.y += cos(uv.x*30.+time*0.9)*0.0011*w;
  float sr = 1.-smoothstep(0., swayR, distance(vUv*vec2(1.,1.78), swayC*vec2(1.,1.78)));
  uv.x += sin(time*1.6+vUv.y*28.)*0.006*swayA*sr; uv.y += cos(time*1.3+vUv.x*22.)*0.003*swayA*sr;
  vec3 col=texture2D(map,uv).rgb; float lum=dot(col,vec3(.3,.59,.11));
  float m=smoothstep(.42,.85,lum)*smoothstep(.58,.12,vUv.y)*caustic;
  col += vec3(.7,.95,1.)*cpat(vUv*vec2(9.,16.)*1.5)*m*.38;
  float rev=0.; for(int i=0;i<4;i++){ vec4 p=patches[i]; rev=max(rev, p.w*(1.-smoothstep(p.z*.35,p.z,distance(vUv*vec2(1.,1.78),p.xy*vec2(1.,1.78))))); }
  float bm2=bleach*(1.-rev)*smoothstep(.12,.38,vD);
  float l2=dot(col,vec3(.3,.59,.11)); col=mix(col, vec3(l2)*1.05+vec3(.2,.22,.24), bm2*.85);
  col*= 1.-night*.0;
  gl_FragColor=vec4(col,1.); }`;
const spriteVS = `
uniform float time, amp, speed, phase; uniform int mode; varying vec2 vUv;
void main(){ vUv=uv; vec3 p=position; float x=uv.x, y=uv.y;
  if(mode==1){ float t=pow(x,1.7); p.y+=sin(time*speed+phase-x*5.)*amp*t; p.x+=sin(time*speed+phase)*amp*.12*t; }
  else if(mode==2){ float w=pow(abs(x-.5)*2.,1.6); p.y+=sin(time*speed+phase)*amp*w; p.z+=cos(time*speed+phase)*amp*.6*w; }
  else if(mode==3){ float k=smoothstep(.42,0.,y); p.x+=sin(time*speed+phase+(x>.5?3.14:0.))*amp*k; p.y+=cos(time*speed+phase)*amp*.3*k; }
  else if(mode==4){ p.y+=sin(time*speed+phase-x*3.)*amp*.35; p.x+=sin(time*speed*.5+phase)*amp*.1; }
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`;
const spriteFS = `
uniform sampler2D map; uniform float fog, opacity, bright; uniform vec3 fogColor; varying vec2 vUv;
void main(){ vec4 c=texture2D(map,vUv); if(c.a<.02) discard;
  vec3 col=mix(c.rgb*bright, fogColor, fog); gl_FragColor=vec4(col, c.a*opacity); }`;
const raysFS = `
uniform float time, strength; varying vec2 vUv;
void main(){ vec2 o=vec2(.62,1.25); vec2 d=vUv-o; float a=atan(d.x,-d.y);
  float r = .5+.5*sin(a*38.+time*.35)*sin(a*21.-time*.22+1.3);
  r = pow(r,3.); float fade = smoothstep(0.,.9,vUv.y)*smoothstep(1.05,.6,vUv.y);
  gl_FragColor=vec4(vec3(.85,.97,1.)*r*fade*strength,1.); }`;
const ptsVS = `
uniform float time, size; attribute float seed; varying float vA;
void main(){ vec3 p=position; p.y+=mod(time*(.08+seed*.12)+seed*20.,8.)-4.; p.x+=sin(time*.4+seed*30.)*.25;
  vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=size*(.5+seed)*(30./-mv.z); vA=.25+.5*fract(seed*7.3);
  gl_Position=projectionMatrix*mv; }`;
const ptsFS = `
varying float vA; uniform vec3 color;
void main(){ vec2 c=gl_PointCoord-.5; float d=length(c); if(d>.5) discard;
  float a=smoothstep(.5,.1,d)*vA; gl_FragColor=vec4(color*a,a); }`;
const bubVS = `
attribute float born; attribute vec3 vel; uniform float time; varying float vA;
void main(){ float age=time-born; vec3 p=position+vel*age+vec3(sin(age*6.+born*9.)*.04,age*age*.25,0.);
  vA = born<0.?0.:clamp(1.-age/2.2,0.,1.);
  vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=(14.+fract(born*13.)*12.)*(8./-mv.z)*(vA>0.?1.:0.); gl_Position=projectionMatrix*mv; }`;
const bubFS = `
varying float vA; void main(){ vec2 c=gl_PointCoord-.5; float d=length(c); if(d>.5) discard;
  float ring=smoothstep(.5,.42,d)*smoothstep(.28,.42,d); float hi=smoothstep(.18,.0,length(c-vec2(-.14,-.14)));
  float a=(ring*.9+hi*.8+.12)*vA; gl_FragColor=vec4(vec3(1.)*a,a); }`;

// ---------- scene builder ----------
function makePlate(name, D, opts = {}) {
  const geo = new THREE.PlaneGeometry(9, 16, 128, 228);
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex['bg_' + name] }, dmap: { value: tex['d_' + name] }, D: { value: D }, L0: { value: 20 }, c0: { value: new THREE.Vector2() },
      time: { value: 0 }, caustic: { value: opts.caustic ?? 1 }, wobble: { value: opts.wobble ?? 1 }, blueOnly: { value: opts.blueOnly ?? 0 },
      swayC: { value: new THREE.Vector2(...(opts.swayC || [0, 0])) }, swayR: { value: opts.swayR ?? .01 }, swayA: { value: opts.swayA ?? 0 }, bleach: { value: 0 }, night: { value: 0 }, patches: { value: [0,1,2,3].map(() => new THREE.Vector4(0, 0, .1, 0)) } },
    vertexShader: plateVS, fragmentShader: plateFS });
  return new THREE.Mesh(geo, mat);
}
function makeSprite(t, width, mode = 0, o = {}) {
  const h = width * t.image.height / t.image.width;
  const geo = new THREE.PlaneGeometry(width, h, 24, 12);
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: t }, time: { value: 0 }, amp: { value: o.amp ?? 0 }, speed: { value: o.speed ?? 6 }, phase: { value: o.phase ?? Math.random() * 6 }, mode: { value: mode },
      fog: { value: 0 }, fogColor: { value: new THREE.Color(...(o.fogColor || [0.2, 0.6, 0.75])) }, opacity: { value: 1 }, bright: { value: o.bright ?? 1 } },
    vertexShader: spriteVS, fragmentShader: spriteFS, transparent: true, depthWrite: false });
  const m = new THREE.Mesh(geo, mat); m.userData.w = width; m.userData.h = h; return m;
}
function makeDust(n, box, color = [0.85, 0.95, 1], size = 3) {
  const g = new THREE.BufferGeometry(); const p = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - .5) * box[0]; p[i * 3 + 1] = (Math.random() - .5) * box[1]; p[i * 3 + 2] = Math.random() * box[2] + box[3]; s[i] = Math.random(); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
  const m = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, size: { value: size }, color: { value: new THREE.Color(...color) } }, vertexShader: ptsVS, fragmentShader: ptsFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  return new THREE.Points(g, m);
}
function makeBubbles(n) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), born = new Float32Array(n).fill(-99);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('vel', new THREE.BufferAttribute(vel, 3)); g.setAttribute('born', new THREE.BufferAttribute(born, 1));
  const m = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 } }, vertexShader: bubVS, fragmentShader: bubFS, transparent: true, depthWrite: false, depthTest: false });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 20;
  let k = 0;
  pts.userData.emit = (x, y, z, count, spread = .15, now = clock) => {
    for (let i = 0; i < count; i++) { const j = k++ % n;
      pos[j * 3] = x + (Math.random() - .5) * spread; pos[j * 3 + 1] = y + (Math.random() - .5) * spread; pos[j * 3 + 2] = z;
      vel[j * 3] = (Math.random() - .5) * .3; vel[j * 3 + 1] = .5 + Math.random() * .6; vel[j * 3 + 2] = 0; born[j] = now + i * .05; }
    g.attributes.position.needsUpdate = g.attributes.vel.needsUpdate = g.attributes.born.needsUpdate = true; };
  return pts;
}

// rays overlay (camera space)
const raysMat = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, strength: { value: .1 } }, vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`, fragmentShader: raysFS, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
const rays = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), raysMat); rays.position.z = -1; rays.renderOrder = 30; camera.add(rays);
const camBubbles = makeBubbles(160); camera.add(camBubbles);

// ---------- scenes ----------
const S = {};
function scene3(name, D, opts) {
  const sc = new THREE.Scene();
  const plate = makePlate(name, D, opts); sc.add(plate);
  const o = { name, sc, plate, D, rays: opts.rays ?? 0, fogColor: opts.fogColor || [0.2, 0.6, 0.75] };
  S[name] = o; return o;
}
let L0 = 20; const c0 = new THREE.Vector2(0, 0);
function img2xy(u, v) { return [(u - .5) * 9, (.5 - v) * 16]; }
function toWorld(sc, u, v, d) { const [x, y] = img2xy(u, v); const z = d * sc.D; return new THREE.Vector3(c0.x + (x - c0.x) * (L0 - z) / L0, c0.y + (y - c0.y) * (L0 - z) / L0, z); }

const map = scene3('map', 1.2, { caustic: 0, wobble: 1.2, blueOnly: 1 });
const ex = scene3('explore', 2.6, { caustic: 1, wobble: 1, rays: .1, fogColor: [0.25, 0.62, 0.76] });
const je = scene3('jetty', 2.6, { caustic: 1, wobble: 1, rays: .14, fogColor: [0.2, 0.55, 0.7] });
const fa = scene3('fan', 2.6, { caustic: 1, wobble: 1, rays: .1, swayC: [.5, .45], swayR: .25, swayA: .35, fogColor: [0.25, 0.62, 0.76] });
const kr = scene3('kri', 2.8, { caustic: 1, wobble: 1, rays: .14, fogColor: [0.18, 0.52, 0.7] });
const an = scene3('anemone', 2.6, { caustic: .6, wobble: .8, rays: .08, swayC: [.42, .5], swayR: .32, swayA: 1, fogColor: [0.28, 0.6, 0.72] });
const mt = scene3('manta', 2.4, { caustic: 1, wobble: 1, rays: .14, fogColor: [0.18, 0.5, 0.62] });
const be = scene3('beach', 1.6, { caustic: 0, wobble: 1.2, blueOnly: 1 });
const ni = scene3('night', 2.4, { caustic: .2, wobble: 1, rays: .07, fogColor: [0.18, 0.22, 0.5] });
const bo = scene3('boat', 1.4, { caustic: 0, wobble: 1.3, blueOnly: 1 });
const bs = scene3('base', 2.2, { caustic: 0, wobble: 0, swayC: [.42, .3], swayR: .17, swayA: .4 });
for (const k of ['explore', 'jetty', 'fan', 'kri', 'anemone', 'manta', 'night']) { const d = makeDust(260, [10, 17, 4, .5]); S[k].sc.add(d); S[k].dust = d; }
{ const d = makeDust(90, [3, 6, 1, 1.2], [1, .95, .8], 2.2); bs.sc.add(d); bs.dust = d; }

// ---------- layout ----------
let Z = 1;
function resize() {
  const r = phone.getBoundingClientRect(); W = r.width; H = r.height; aspect = W / H;
  Z = Math.min(1.6, Math.max(.7, Math.min(H / 790, W / 370))); phone.style.setProperty('--z', Z);
  renderer.setSize(W, H, false); camera.aspect = aspect; camera.updateProjectionMatrix();
  const vis = Math.min(16, 9 / aspect) * 0.94; L0 = vis / (2 * TAN);
  for (const k in S) S[k].plate.material.uniforms.L0.value = L0;
  const rh = 2 * TAN; rays.scale.set(rh * aspect, rh, 1);
  layoutSprites(); if (coachStep >= 0) coachShow();
}
window.addEventListener('resize', resize);

// ---------- camera ----------
const cam = { u: .5, v: .5, zoom: 1, tu: .5, tv: .5, tz: 1, dragX: 0, dragY: 0 };
function camClamp(u, v, zoom) {
  const L = L0 * zoom * ((typeof sens !== 'undefined' && sens.has && st.screen !== 'map') ? .85 : 1); const hh = L * TAN, hw = hh * aspect;
  let [x, y] = img2xy(u, v);
  const mx = Math.max(0, 4.5 - hw - .15), my = Math.max(0, 8 - hh - .15);
  return [THREE.MathUtils.clamp(x, -mx, mx), THREE.MathUtils.clamp(y, -my, my), L, mx, my];
}
function setView(u, v, zoom, instant) { cam.tu = u; cam.tv = v; cam.tz = zoom; if (instant) { cam.u = u; cam.v = v; cam.zoom = zoom; } }

// ---------- content ----------
let clock = 0;
const all = []; // sprites per scene for time updates
function spr(scene, t, w, mode, o) { const m = makeSprite(t, w, mode, Object.assign({ fogColor: scene.fogColor }, o)); scene.sc.add(m); all.push(m); return m; }
function makeSchool(scene, n, size) { const a = []; for (let i = 0; i < n; i++) { const f = spr(scene, tex.fusilier, size + Math.random() * .2, 1, { amp: .06, speed: 9 + Math.random() * 3 }); f.userData.off = new THREE.Vector3((Math.random() - .5) * 2.6, (Math.random() - .5) * 1.4, (Math.random() - .5) * 1.2); f.userData.ph = Math.random() * 6; a.push(f); } return a; }
function animSchool(scene, a, u, v, d, sp = .16) { const c = toWorld(scene, u + Math.sin(clock * sp) * .08, v + Math.sin(clock * sp * 1.4) * .03, d); const dir = Math.cos(clock * sp) > 0 ? -1 : 1;
  a.forEach((f) => { const p = f.userData.off, w = clock * 1.1 + f.userData.ph; f.position.set(c.x + p.x + Math.sin(w) * .25, c.y + p.y + Math.sin(w * 1.3) * .12, c.z + p.z + Math.cos(w) * .2); f.scale.x = dir; f.rotation.z = Math.sin(w * 1.3) * .08 * dir; setFog(f); }); }
// explore plate
const school = makeSchool(ex, 38, .62);
const turtle = spr(ex, tex.turtle, 2.0, 4, { amp: .06, speed: 1.6 });
const wobbe = spr(ex, tex.sp_wobbegong, 1.9, 4, { amp: .02, speed: 1 });
const smallFish = []; for (let i = 0; i < 6; i++) { const f = spr(ex, tex.fusilier, .32, 1, { amp: .04, speed: 11 }); f.userData.ph = Math.random() * 10; smallFish.push(f); }
// jetty plate
const jSchool = makeSchool(je, 44, .55);
const jIdols = [0, 1].map((i) => { const m = spr(je, tex.sp_moorish, .9, 1, { amp: .03, speed: 5 }); m.userData.ph = i * 1.7; return m; });
// fan plate
const seahorse = spr(fa, tex.sp_seahorse, .22, 4, { amp: .01, speed: 1.2 });
const fIdols = [0, 1].map((i) => { const m = spr(fa, tex.sp_moorish, .8, 1, { amp: .03, speed: 5 }); m.userData.ph = i * 2.3; return m; });
const fSmall = []; for (let i = 0; i < 8; i++) { const f = spr(fa, tex.fusilier, .3, 1, { amp: .04, speed: 11 }); f.userData.ph = Math.random() * 10; fSmall.push(f); }
// kri plate
const kSchoolA = makeSchool(kr, 46, .6), kSchoolB = makeSchool(kr, 30, .45);
const parrots = [0, 1, 2].map((i) => { const p = spr(kr, tex.sp_parrotfish, [1.6, 1.3, 1.1][i], 1, { amp: .04, speed: 4 }); p.userData.ph = i * 2; return p; });
// anemone
const clowns = [0, 1, 2].map((i) => { const c = spr(an, tex.clown, [2.3, 1.3, .8][i], 1, { amp: .05, speed: 10 + i }); c.userData.ph = i * 2.1; return c; });
// manta
const mantas = [0, 1, 2].map((i) => { const m = spr(mt, tex.manta, 3.2, 2, { amp: .32, speed: 1.6 + i * .15 }); m.userData.a = i * 2.1; return m; });
const cleaners = []; for (let i = 0; i < 8; i++) { const f = spr(mt, tex.fusilier, .2, 1, { amp: .03, speed: 14, bright: 1.1 }); f.userData.ph = Math.random() * 10; cleaners.push(f); }
// camera-space actors
const diver = makeSprite(tex.diver, 1, 3, { amp: .07, speed: 5 }); diver.material.depthTest = false; diver.renderOrder = 10; camera.add(diver); all.push(diver);
const kneel = makeSprite(tex.kneel, 1, 0, { fogColor: mt.fogColor }); kneel.material.depthTest = false; kneel.renderOrder = 10; camera.add(kneel); all.push(kneel);
// base
const glowMat = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 }, k: { value: .35 } }, vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform float t,k; varying vec2 vUv; void main(){ float d=length((vUv-.5)*vec2(1.,.7)); float a=smoothstep(.5,0.,d)*k*(.8+.2*sin(t*2.)); gl_FragColor=vec4(vec3(1.,.75,.9)*a,a);}`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.6), glowMat); bs.sc.add(glow);
const coneBubbles = makeBubbles(120); coneBubbles.material.depthTest = false; bs.sc.add(coneBubbles);

function layoutSprites() {
  const g = toWorld(bs, .66, .63, .62); glow.position.copy(g); glow.position.z += .2; bs.cone = g;
  const dz = 8, vh = 2 * dz * TAN, vw = vh * aspect;
  diver.position.set(0, (.5 - .66) * vh, -dz); diver.scale.setScalar(Math.min(.27 * vw, .16 * vh * 506 / 810) / diver.userData.w);
  kneel.position.set((0.68 - .5) * vw, (.5 - .835) * vh, -dz); kneel.scale.setScalar(.15 * vw / kneel.userData.w);
}

// ---------- data ----------
const ALBUM = [
  { id: 'clownfish', name: 'Clownfisch', cat: 'fisch', img: 'st_clownfish.jpg' },
  { id: 'turtle', name: 'Karett-Schildkröte', cat: 'riese', img: 'st_turtle.jpg' },
  { id: 'manta', name: 'Riffmanta', cat: 'riese', img: 'st_manta.jpg' },
  { id: 'walkingshark', name: 'Laufhai', cat: 'fisch', img: 'st_walkingshark.jpg' },
  { id: 'seahorse', name: 'Zwerg-Seepferdchen', cat: 'fisch', img: 'st_seahorse.jpg' },
  { id: 'moorish', name: 'Halfterfisch', cat: 'fisch', img: 'st_moorish.jpg' },
  { id: 'wobbegong', name: 'Teppichhai', cat: 'riese', img: 'st_wobbegong.jpg' },
  { id: 'parrotfish', name: 'Büffelkopf-Papageifisch', cat: 'fisch', img: 'st_parrotfish.jpg' },
  { id: 'acropora', name: 'Tischkoralle', cat: 'koralle', img: 'st_acropora.jpg' }];
const CARDS = {
  clownfish: { lat: 'Amphiprion percula', facts: [['Wohnt in einer Anemone', 'home'], ['Bis 11 cm lang', 'ruler'], ['Schleim schützt vor Nesseln', 'shield']], say: 'Die Anemone beschützt ihn, und er hält sie sauber. Freunde helfen sich!' },
  turtle: { lat: 'Eretmochelys imbricata', facts: [['Frisst gern Schwämme', 'leaf'], ['Panzer bis 1 m lang', 'ruler'], ['Vom Aussterben bedroht', 'shield']], say: 'Sie frisst Schwämme. So haben die Korallen mehr Platz zum Wachsen!' },
  manta: { lat: 'Mobula alfredi', facts: [['Bis 5 m breit', 'ruler'], ['Frisst winziges Plankton', 'leaf'], ['Lässt sich putzen', 'shield']], say: 'An der Putzstation knabbern kleine Fische die Haut der Mantas sauber. Das ist wie Zähneputzen!' },
  walkingshark: { lat: 'Hemiscyllium freycineti', facts: [['Läuft auf den Flossen', 'ruler'], ['Lebt nur in Ost-Indonesien', 'home'], ['Jagt in der Nacht', 'shield']], say: 'Dieser Hai schwimmt nicht nur, er läuft über den Meeresboden!' },
  moorish: { lat: 'Zanclus cornutus', facts: [['Langer Flossen-Faden', 'ruler'], ['Frisst Schwämme', 'leaf'], ['Oft zu zweit unterwegs', 'home']], say: 'Mit seiner langen Schnauze kommt er in jede Ritze im Riff.' },
  acropora: { lat: 'Acropora', facts: [['Wächst wie ein Tisch', 'ruler'], ['Gibt Fischen Schatten', 'home'], ['Braucht viel Licht', 'leaf']], say: 'Unter einer Tischkoralle verstecken sich viele kleine Fische.' },
  wobbegong: { lat: 'Eucrossorhinus dasypogon', facts: [['Liegt gut getarnt am Boden', 'shield'], ['Hat einen Fransen-Bart', 'leaf'], ['Wartet geduldig auf Futter', 'home']], say: 'Siehst du den Bart aus Fransen? So sieht er aus wie ein Stein mit Algen. Perfekt getarnt!' },
  seahorse: { lat: 'Hippocampus bargibanti', facts: [['Nur etwa 2 cm gross', 'ruler'], ['Lebt auf Fächerkorallen', 'home'], ['Sieht aus wie die Koralle', 'shield']], say: 'Das Zwerg-Seepferdchen ist so klein wie ein Fingernagel. Sogar Forscher übersehen es!' },
  parrotfish: { lat: 'Bolbometopon muricatum', facts: [['Grösster Papageifisch', 'ruler'], ['Knabbert Korallen-Algen', 'leaf'], ['Macht weissen Sand', 'home']], say: 'Er knabbert am Riff und scheidet feinen Sand aus. Viele weisse Strände kommen von Papageifischen!' } };

// nodes: views per depth level [u, v, zoom]
const NODES = {
  fan: { plate: 'fan', name: 'Fächerkorallen', depths: [4, 8, 12], views: [[.5, .36, .8], [.53, .44, .62], [.5, .68, .8]], l: null, r: 'left' },
  left: { plate: 'explore', name: 'Korallengarten', depths: [2, 6, 10], views: [[.32, .4, .74], [.3, .6, .68], [.32, .72, .7]], l: 'fan', r: 'start' },
  start: { plate: 'explore', name: 'Riff', depths: [2, 6, 10], views: [[.5, .36, .85], [.5, .5, 1], [.52, .7, .72]], l: 'left', r: 'steg' },
  steg: { plate: 'explore', name: 'Steg', depths: [2, 6, 10], views: [[.72, .34, .68], [.7, .46, .66], [.68, .68, .7]], l: 'start', r: 'jetty' },
  jetty: { plate: 'jetty', name: 'Unter dem Steg', depths: [1, 3, 5], views: [[.5, .34, .85], [.5, .5, 1], [.5, .68, .8]], l: 'steg', r: null },
  kri: { plate: 'kri', name: 'Tulamben', depths: [5, 15, 25], views: [[.55, .34, .85], [.55, .5, 1], [.5, .68, .8]], l: null, r: null } };
const LINE = ['fan', 'left', 'start', 'steg', 'jetty'];
const QUESTS = [
  { id: 'turtle', txt: 'Finde die Schildkröte beim Steg', node: 'steg', lvl: null },
  { id: 'clownfish', txt: 'Wer wohnt in der Anemone im Korallengarten?', node: 'left', lvl: 1 },
  { id: 'wobbegong', txt: 'Tauche beim Riff ganz nach unten zum Sandgrund', node: 'start', lvl: 2 },
  { id: 'seahorse', txt: 'Such das winzige Seepferdchen an den Fächerkorallen', node: 'fan', lvl: 1 },
  { id: 'manta', txt: 'Mission bei Manta Point: Tauche zurück zur Karte', site: 'manta' },
  { id: 'parrotfish', txt: 'Tulamben ist offen! Finde den grossen Papageifisch', site: 'kri' }];
const UNLOCK = 7;
const st = { found: new Set(['moorish', 'acropora']), isNew: new Set(), node: 'start', lvl: 1, air: 5, airT: 0, scene: 'map', screen: 'map', cardId: null, calm: 0, holding: false, mdone: false, care: new Set(), day: 12, site: 'arborek', tutDone: false };
window.__st = st;

// ---------- audio ----------
let actx = null, amb = null;
function audioInit() {
  if (actx) return; try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = actx.createBuffer(1, actx.sampleRate * 4, actx.sampleRate); const d = buf.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.2; }
    const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    amb = actx.createGain(); amb.gain.value = 0; src.connect(lp).connect(amb).connect(actx.destination); src.start();
  } catch (e) { actx = null; }
}
function ambient(on) { if (amb) amb.gain.setTargetAtTime(on ? .22 : 0, actx.currentTime, .6); }
function blip(f0 = 380, f1 = 900, t = .14, v = .12) { if (!actx) return; try { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.setValueAtTime(f0, actx.currentTime); o.frequency.exponentialRampToValueAtTime(f1, actx.currentTime + t); g.gain.setValueAtTime(v, actx.currentTime); g.gain.exponentialRampToValueAtTime(.001, actx.currentTime + t + .05); o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + t + .1); } catch (e) {} }
function chime() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, f * 1.01, .25, .08), i * 110)); }
function speak(text) { try { const s = window.speechSynthesis; if (!s) return; s.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; u.rate = .95; u.pitch = 1.15; const v = s.getVoices().find((x) => x.lang && x.lang.startsWith('de')); if (v) u.voice = v; s.speak(u); } catch (e) {} }
function buzz(ms = 15) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

// ---------- UI helpers ----------
let toastT = 0;
function toast(txt, sp = true) { $('#toastTxt').textContent = txt; $('#toast').classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => $('#toast').classList.remove('on'), 3600); if (sp) speak(txt); }
let sayT = 0;
function say(txt, sp = true) { $('#sayTxt').textContent = txt; $('#say').classList.add('on'); clearTimeout(sayT); sayT = setTimeout(() => $('#say').classList.remove('on'), 4200); if (sp) speak(txt); }
function bubbleBurst(n = 26) { const b = $('#bubbles'); for (let i = 0; i < n; i++) { const e = document.createElement('i'); const s = 10 + Math.random() * 34; e.style.width = e.style.height = s + 'px'; e.style.left = Math.random() * 100 + '%'; e.style.setProperty('--dx', (Math.random() - .5) * 120 + 'px'); e.style.animationDelay = Math.random() * .35 + 's'; e.style.animationDuration = .8 + Math.random() * .6 + 's'; b.appendChild(e); setTimeout(() => e.remove(), 2000); } blip(300, 700, .25, .1); }
function updCount() { const n = st.found.size; $$('.cnt').forEach((e) => e.textContent = n + '/15'); $('#abar').style.width = (n / 15 * 100) + '%'; }
function setAir() { $$('#air span').forEach((e, i) => e.classList.toggle('off', i >= st.air)); }
const ARW = { l: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B1F3A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>', r: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B1F3A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>', u: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B1F3A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>', d: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B1F3A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>', m: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B1F3A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/></svg>', s: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B1F3A" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>' };

// ---------- quests ----------
function curQuest() { return QUESTS.find((q) => !st.found.has(q.id)); }
function questDir(q) {
  if (!q) return ['', 'Fertig!'];
  if (q.site) return ['m', st.screen === 'explore' && st.node !== 'kri' && q.site === 'kri' ? 'Karte' : (q.site === 'manta' ? 'Karte' : (st.node === 'kri' ? 'Hier' : 'Karte'))];
  if (st.node === 'kri') return ['m', 'Karte'];
  const a = LINE.indexOf(st.node), b = LINE.indexOf(q.node);
  if (b < a) return ['l', 'Links']; if (b > a) return ['r', 'Rechts'];
  if (q.lvl !== null && q.lvl !== undefined && q.lvl !== st.lvl) return q.lvl > st.lvl ? ['d', 'Tiefer'] : ['u', 'Höher'];
  return ['s', 'Hier!'];
}
function updQuest() {
  const q = curQuest(); const i = q ? QUESTS.indexOf(q) : QUESTS.length;
  $('#qNum').textContent = q ? `AUFGABE ${i + 1}/${QUESTS.length}` : 'ALLE AUFGABEN GESCHAFFT';
  $('#qTxt').textContent = q ? q.txt : 'Super! Du hast alle Tiere gefunden.';
  const a = q && ALBUM.find((x) => x.id === q.id); $('#qImg').src = a ? 'assets/sil_' + a.id + '.png' : 'assets/st_clownfish.jpg';
  const [k, t] = questDir(q); $('#qDir').innerHTML = (ARW[k] || '') + t;
}
$('#quest').addEventListener('click', (e) => { e.stopPropagation(); const q = curQuest(); if (!q) return say('Du hast alle Aufgaben geschafft!'); const [k] = questDir(q);
  const hint = { l: 'Schwimm nach links!', r: 'Schwimm nach rechts!', d: 'Tauch tiefer mit dem Pfeil nach unten!', u: 'Schwimm höher mit dem Pfeil nach oben!', m: 'Tippe unten rechts auf Karte und wähle den Tauchplatz!', s: 'Hier ist es! Such den gelben Ring oder drück die Lupe!' }[k];
  say(q.txt + '. ' + hint); });

// ---------- screens ----------
function transition(fn) { $('#fade').classList.add('on'); bubbleBurst(); setTimeout(() => { fn(); setTimeout(() => $('#fade').classList.remove('on'), 80); }, 480); }
function useScene(scene) { st.scene = scene; const o = S[scene]; o.sc.add(camera); raysMat.uniforms.strength.value = o.rays; }
function show(screen, scene) {
  st.screen = screen; $$('.screen').forEach((s) => s.classList.toggle('on', s.id === screen));
  $('#tabs').style.display = ['map', 'album', 'station'].includes(screen) ? 'flex' : 'none';
  $$('#tabs button').forEach((b) => b.classList.toggle('act', b.dataset.tab === screen));
  if (scene) { useScene(scene); setView(.5, .5, 1, true); }
  canvas.style.display = screen === 'album' ? 'none' : 'block';
  ambient(['explore', 'mission'].includes(screen));
  if (screen === 'album') renderAlbum();
  diver.visible = screen === 'explore' && st.scene !== 'anemone';
  kneel.visible = st.scene === 'manta';
  hideRing();
}

// ---------- map ----------
function renderDots() { const d = $('#dots'); d.innerHTML = ''; const n = Math.min(6, st.found.size); for (let i = 0; i < 6; i++) { const s = document.createElement('span'); s.style.cssText = 'width:12px;height:12px;border-radius:6px;background:' + (i < n ? '#FF8A5B' : '#D6E3EA'); d.appendChild(s); } updKri(); }
function updKri() { const open = st.found.size >= UNLOCK || (st.chapter || 0) >= 8; const m = $('.marker[data-site="kri"]'); m.querySelector('.mlabel').textContent = open ? 'Tulamben · Wrack' : `Tulamben · noch ${UNLOCK - st.found.size} Tiere`; m.querySelector('.mdot').style.background = open ? '#FF8A5B' : '#5B6B80';
  if (open) m.querySelector('.mdot').innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0B1F3A" stroke-width="2.2" stroke-linecap="round"><path d="M3 12c3-4 6-5 9-5 2 0 4 1 6 3l3-2v8l-3-2c-2 2-4 3-6 3-3 0-6-1-9-5z"/></svg>'; }
const SITES = { arborek: { name: 'Amed-Riff', sub: 'Schnorcheln · 27–30 °C', go: 'Los tauchen!', say: 'Am Amed-Riff wohnen Schildkröten, Clownfische und ein gut getarnter Hai.' },
  manta: { name: 'Manta Point', sub: 'Mission · 10 m', go: 'Mission starten!', say: 'Bei Manta Point lassen sich Riffmantas putzen. Da muss man ganz still sein!' },
  kri: { name: 'Tulamben', sub: 'Riffwand · bis 25 m', go: 'Los tauchen!', say: 'Tulamben! Hier liegt ein altes Schiffswrack. Heute ist es ein Riff voller Fische.' } };
function pickSite(k) {
  if (k === 'kri' && st.found.size < UNLOCK && (st.chapter || 0) < 8) { blip(300, 200, .2); toast(`Tulamben öffnet sich, wenn du ${UNLOCK} Tiere gefunden hast. Dir fehlen noch ${UNLOCK - st.found.size}.`); return; }
  st.site = k; const s = SITES[k]; $('#siteName').textContent = s.name; $('#siteSub').textContent = s.sub; $('#goLbl').textContent = s.go; $('#mapSay').textContent = s.say;
  $$('.marker').forEach((m) => m.classList.toggle('sel', m.dataset.site === k)); blip(500, 800, .1); speak(s.say);
}
$$('.marker').forEach((m) => m.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); pickSite(m.dataset.site); }));
$('#goDive').addEventListener('click', () => { audioInit(); buzz(); if (st.site === 'manta') transition(startMission); else if (st.site === 'kri') transition(() => startExplore('kri')); else transition(() => startExplore('start')); });

// ---------- explore ----------
function startExplore(node) { show('explore'); goNode(node, 1, true); updCount(); setAir();
  if (!st.tutDone) setTimeout(coachStart, 700); else setTimeout(() => { const q = curQuest(); if (q) say(q.txt); }, 600); }
function goNode(id, lvl, instant) {
  const n = NODES[id]; st.node = id; st.lvl = lvl; const changePlate = st.scene !== n.plate;
  if (changePlate) useScene(n.plate);
  const v = n.views[lvl]; setView(v[0], v[1], v[2], instant || changePlate);
  diver.visible = true; updNav();
}
function updNav() {
  const n = NODES[st.node];
  if (st.scene === 'anemone') { $('#edgeL').hidden = false; $('#edgeLt').textContent = 'Zurück'; $('#edgeR').hidden = true; $('#side').style.visibility = 'hidden'; }
  else { $('#edgeL').hidden = !n.l; $('#edgeR').hidden = !n.r; $('#edgeLt').textContent = n.l ? NODES[n.l].name : ''; $('#edgeRt').textContent = n.r ? NODES[n.r].name : ''; $('#side').style.visibility = 'visible'; }
  const ds = n.depths; $$('#gauge i').forEach((e, i) => { e.textContent = ds[i] + ' m'; e.classList.toggle('on', i === st.lvl); });
  $('#depth').textContent = (st.scene === 'anemone' ? 5 : ds[st.lvl]) + ' m';
  $('#up').style.opacity = st.lvl === 0 ? .4 : 1; $('#down').style.opacity = st.lvl === 2 ? .4 : 1;
  updQuest();
}
let swimDir = 0, swimT = 0;
function move(dir) {
  const n = NODES[st.node]; const t = dir < 0 ? n.l : n.r;
  if (!t) { blip(250, 180, .12); say(dir < 0 ? 'Da geht es nicht weiter.' : 'Da geht es nicht weiter.'); return; }
  swimDir = dir; swimT = 1.6; blip(420, 760, .18); camBubbles.userData.emit(diver.position.x, diver.position.y + .35, diver.position.z, 10, .2, clock);
  const plateChange = NODES[t].plate !== st.scene;
  const go = () => { goNode(t, st.lvl); arriveSay(t); };
  if (plateChange) transition(go); else go();
}
function arriveSay(id) { const q = curQuest(); const name = NODES[id].name; setTimeout(() => { if (q && q.node === id) say(q.lvl !== null && q.lvl !== undefined && q.lvl !== st.lvl ? `${name}! ${q.lvl > st.lvl ? 'Tauch tiefer!' : 'Schwimm höher!'}` : `${name}! Schau genau hin, hier ist etwas!`); else say(name + '.', false); }, 900); }
function depth(dl) { if (st.scene === 'anemone') return; const n = NODES[st.node]; const l = st.lvl + dl; if (l < 0 || l > 2) { blip(250, 180, .12); say(dl < 0 ? 'Weiter oben ist die Wasseroberfläche!' : 'Hier ist der Sandgrund, tiefer geht es nicht.'); return; }
  st.lvl = l; const v = n.views[l]; setView(v[0], v[1], v[2]); swimDir = 0; swimT = 1.2; blip(dl < 0 ? 500 : 500, dl < 0 ? 900 : 300, .14); if (dl < 0) camBubbles.userData.emit(diver.position.x, diver.position.y + .3, diver.position.z, 8, .2, clock); updNav();
  const q = curQuest(); if (q && q.node === st.node && q.lvl === l) setTimeout(() => say('Schau genau hin, hier ist etwas!'), 900); }
$('#edgeL').addEventListener('click', (e) => { e.stopPropagation(); if (st.scene === 'anemone') return transition(backToReef); move(-1); });
$('#edgeR').addEventListener('click', (e) => { e.stopPropagation(); move(1); });
$('#up').addEventListener('click', (e) => { e.stopPropagation(); depth(-1); });
$('#down').addEventListener('click', (e) => { e.stopPropagation(); depth(1); });
$('#thalBtn').addEventListener('click', (e) => { e.stopPropagation(); $('#quest').click(); });
$('#lupe').addEventListener('click', (e) => { e.stopPropagation(); buzz(); lupe(); });
function lupe() { const t = targets().find((x) => x.vis()); if (t) return t.hit(); say('Hier sehe ich nichts Neues. Folge dem gelben Pfeil oben!'); }
function enterAnemone() { show('explore'); useScene('anemone'); setView(.5, .5, 1, true); diver.visible = false; updNav(); setTimeout(() => say('Wer wohnt denn hier? Tippe auf den Fisch!'), 500); }
function backToReef() { show('explore'); goNode('left', 1, true); }
$$('[data-act="surface"]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); transition(() => { show('map', 'map'); renderDots(); }); }));
$$('[data-act="album"]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); st.returnTo = { scene: st.scene, node: st.node, lvl: st.lvl }; show('album'); }));

// discoverable targets per context
function onScreen(obj, pad = 30) { const [x, y, z] = screenPos(obj); return z < 1 && x > pad && x < W - pad && y > 130 * Z && y < H - 110 * Z; }
function targets() {
  const T = [];
  if (st.screen !== 'explore') return T;
  if (st.scene === 'anemone') T.push({ obj: clowns[0], lbl: st.found.has('clownfish') ? 'Clownfisch' : 'Neues Tier!', vis: () => true, hit: () => discover('clownfish') });
  if (st.scene === 'explore') {
    T.push({ obj: turtle, lbl: st.found.has('turtle') ? null : 'Neues Tier!', vis: () => onScreen(turtle) && st.lvl < 2, hit: () => discover('turtle') });
    T.push({ obj: wobbe, lbl: st.found.has('wobbegong') ? null : 'Neues Tier!', vis: () => st.lvl === 2 && onScreen(wobbe), hit: () => discover('wobbegong') });
    if (st.node === 'left') T.push({ pos: () => toWorld(ex, .24, .79, .8), lbl: 'Wer wohnt hier?', vis: () => st.lvl >= 1, hit: () => transition(enterAnemone) });
  }
  if (st.scene === 'fan') T.push({ obj: seahorse, lbl: st.found.has('seahorse') ? null : 'Neues Tier!', vis: () => st.lvl === 1 && onScreen(seahorse), hit: () => discover('seahorse') });
  if (st.scene === 'jetty') T.push({ obj: jIdols[0], lbl: null, vis: () => onScreen(jIdols[0]), hit: () => openCard('moorish', false) });
  if (st.scene === 'fan') T.push({ obj: fIdols[0], lbl: null, vis: () => onScreen(fIdols[0]), hit: () => openCard('moorish', false) });
  if (st.scene === 'kri') T.push({ obj: parrots[0], lbl: st.found.has('parrotfish') ? null : 'Neues Tier!', vis: () => onScreen(parrots[0]), hit: () => discover('parrotfish') });
  return T.sort((a, b) => (b.lbl ? 1 : 0) - (a.lbl ? 1 : 0));
}

// ---------- card ----------
const ICON = { home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>', ruler: '<path d="M3 17h18M5 17v-3M9 17v-5M13 17v-3M17 17v-5M21 17v-3"/>', shield: '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>', leaf: '<path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14zM5 19l7-7"/>' };
const FC = [['#E6F7FA', '#1F6FA8'], ['#FFF1E9', '#C4502A'], ['#FFF8DC', '#8A6A00']];
let cardFrom = null, cardFresh = false;
function discover(id) { const fresh = !st.found.has(id); st.found.add(id); if (fresh) { st.isNew.add(id); chime(); buzz(40); } updCount(); openCard(id, fresh); }
function openCard(id, fresh) {
  const a = ALBUM.find((x) => x.id === id), c = CARDS[id]; st.cardId = id; cardFrom = st.screen; cardFresh = fresh;
  $('#cImg').src = 'assets/' + a.img; $('#cName').textContent = a.name; $('#cName').style.fontSize = a.name.length > 17 ? '20px' : a.name.length > 12 ? '24px' : '30px'; $('#cName').style.lineHeight = '1.05'; phone.classList.add('cardon');
  $('#cLat').textContent = c.lat;
  $('#cFacts').innerHTML = c.facts.map((f, i) => `<div style="background:${FC[i][0]}"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${FC[i][1]}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICON[f[1]]}</svg>${f[0]}</div>`).join('');
  $('#cSay').textContent = 'Thalassa: «' + c.say + '»';
  $('#card .badge').lastChild.textContent = fresh ? 'Entdeckt!' : 'Mein Tier';
  $('#card').classList.remove('on'); $('#card').style.display = 'block'; requestAnimationFrame(() => requestAnimationFrame(() => $('#card').classList.add('on')));
  if (fresh) setTimeout(() => speak(a.name + '! ' + c.say), 400);
}
function closeCard() { phone.classList.remove('cardon'); $('#card').classList.remove('on'); setTimeout(() => { $('#card').style.display = 'none'; }, 350);
  if (st.screen === 'explore') { updQuest(); if (cardFresh) { const q = curQuest(); setTimeout(() => { if (!q) say('Wow, du hast alle Aufgaben geschafft!'); else say('Super! Nächste Aufgabe: ' + q.txt); }, 500); } }
  if (st.screen === 'map') renderDots(); }
$('#card').style.display = 'none';
$('[data-act="closecard"]').addEventListener('click', (e) => { e.stopPropagation(); closeCard(); });
$('#cSpeak').addEventListener('click', (e) => { e.stopPropagation(); const a = ALBUM.find((x) => x.id === st.cardId), c = CARDS[st.cardId]; speak(a.name + '. ' + c.facts.map((f) => f[0]).join('. ') + '. ' + c.say); });
$('[data-act="toalbum"]').addEventListener('click', (e) => { e.stopPropagation(); closeCard(); if (cardFrom === 'explore') st.returnTo = { scene: st.scene, node: st.node, lvl: st.lvl }; show('album'); });

// ---------- album ----------
let afilter = 'all';
function renderAlbum() {
  const g = $('#grid'); g.innerHTML = '';
  ALBUM.filter((a) => afilter === 'all' || a.cat === afilter).forEach((a) => {
    const f = st.found.has(a.id); const b = document.createElement('button'); b.className = 'tile' + (st.isNew.has(a.id) ? ' pop' : '');
    b.style.background = f ? '#fff' : 'rgba(255,255,255,.14)';
    b.innerHTML = `<img src="assets/${f ? a.img : 'sil_' + a.id + '.png'}" alt="" style="${f ? '' : 'filter:brightness(0) invert(1) opacity(.35);object-fit:contain'}"><span style="color:${f ? '#0B1F3A' : '#DCEBF4'}">${f ? a.name : '???'}</span>${st.isNew.has(a.id) ? '<span class="neu">NEU</span>' : ''}`;
    b.addEventListener('click', () => { if (f) openCard(a.id, false); else toast('Noch nicht gefunden. Schau in deiner Aufgabe nach!'); });
    g.appendChild(b); });
  setTimeout(() => st.isNew.clear(), 1200);
  $('#backDive').style.display = st.returnTo ? 'block' : 'none';
}
$('#backDive').addEventListener('click', () => { const r = st.returnTo; st.returnTo = null; if (!r) return; show('explore'); if (r.scene === 'anemone') { useScene('anemone'); setView(.5, .5, 1, true); diver.visible = false; updNav(); } else goNode(r.node, r.lvl, true); });
$$('#atabs button').forEach((b) => b.addEventListener('click', () => { afilter = b.dataset.f; $$('#atabs button').forEach((x) => x.classList.toggle('act', x === b)); renderAlbum(); }));
$$('#tabs button').forEach((b) => b.addEventListener('click', () => { audioInit(); st.returnTo = null; const t = b.dataset.tab; if (t === 'map') { show('map', 'map'); renderDots(); } else if (t === 'album') show('album'); else show('station', 'base'); }));

// ---------- mission ----------
function startMission() { show('mission', 'manta'); setView(.5, mt.pano ? .4 : .44, 1, true); st.calm = 0; st.mdone = false; $('#mwin').classList.remove('on'); setTimeout(() => { const tx = $('#mTxt').textContent; speak(/Knopf|button|tombol/i.test(tx) ? tx : tx + ' ' + T('Halte den Knopf gedrückt.')); }, 500); }
const holdBtn = $('#hold');
holdBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); st.holding = true; holdBtn.classList.add('down'); buzz(10); });
const hUp = () => { st.holding = false; holdBtn.classList.remove('down'); };
window.addEventListener('pointerup', hUp); window.addEventListener('pointercancel', hUp);
$('[data-act="mantacard"]').addEventListener('click', () => { $('#mwin').classList.remove('on'); discover('manta'); setTimeout(() => { st._mcard = true; }, 500); });

// ---------- station ----------
let glowBoost = 0, sparkle = 0;
$$('[data-care]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); const k = b.dataset.care; b.classList.add('done'); st.care.add(k); buzz();
  if (k === 'licht') { glowBoost = 1.4; blip(600, 1200, .3); }
  if (k === 'strom') { for (let i = 0; i < 4; i++) setTimeout(() => coneBubbles.userData.emit(bs.cone.x - .8, bs.cone.y - 1.2, bs.cone.z + .5, 8, .9, clock), i * 150); blip(300, 500, .3); }
  if (k === 'putzen') { sparkle = 1.2; blip(900, 1500, .15); }
  if (st.care.size === 3) { setTimeout(() => { st.day++; st.care.clear(); $$('[data-care]').forEach((x) => x.classList.remove('done')); $('#day').textContent = 'Tag ' + st.day; $('#grow').style.width = (st.day / 180 * 150).toFixed(1) + '%'; chime(); toast('Super gepflegt! Deine Koralle ist einen Tag gewachsen.'); }, 700); }
  else toast({ licht: 'Korallen brauchen Licht, denn in ihnen wohnen winzige Algen.', strom: 'Die Strömung bringt frisches Wasser und Futter.', putzen: 'Sauber! Jetzt kann die Koralle gut wachsen.' }[k]); }));

// ---------- parents ----------
function parents() { const a = 3 + Math.floor(Math.random() * 4), b = 2 + Math.floor(Math.random() * 5), r = a + b; const opts = [r - 1, r, r + 2].sort(() => Math.random() - .5);
  $('#pbox').innerHTML = `<span class="baloo" style="font-size:24px">Für Eltern</span><span style="font-weight:700;color:#3D5470">Bitte löse die Aufgabe: Wie viel ist ${a} + ${b}?</span><div class="opts">${opts.map((o) => `<button data-o="${o}">${o}</button>`).join('')}</div><button data-x style="border:0;background:none;font-weight:800;color:#3D5470;height:44px">Abbrechen</button>`;
  $('#parents').classList.add('on');
  $$('#pbox [data-o]').forEach((x) => x.addEventListener('click', () => { if (+x.dataset.o === r) parentsArea(); else { x.style.background = '#FFE1D6'; blip(300, 200, .15); } }));
  $('#pbox [data-x]').addEventListener('click', () => $('#parents').classList.remove('on')); }
function parentsArea() { $('#pbox').innerHTML = `<span style="font-weight:800;font-size:13px;letter-spacing:2px;color:#1F6FA8">ELTERNBEREICH · DEMO</span><span class="baloo" style="font-size:24px;line-height:1.1">Eine echte Koralle mit Ocean Pure</span><span style="font-weight:700;color:#3D5470;line-height:1.35">Ihr Kind pflegt im Spiel eine Koralle. Mit einer Patenschaft wächst eine echte Projektkoralle auf einem CoralCone in Indonesien. Foto und Status erscheinen danach im Spiel.</span><span style="background:#F2F6F9;border-radius:16px;padding:10px;font-weight:800">Patenschaft ab USD 30 · Prototyp, keine Zahlung</span><button class="cta" data-x style="height:56px;font-size:20px">Schliessen</button>`;
  $('#pbox [data-x]').addEventListener('click', () => $('#parents').classList.remove('on')); }
$$('[data-act="parents"]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); parents(); }));
$$('[data-speak]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); speak($(b.dataset.speak).textContent); }));

// ---------- tutorial (coach marks) ----------
const COACH = [
  { sel: '#edgeR', txt: 'Tippe auf die Pfeile links und rechts. Dann schwimmst du zum nächsten Ort.' },
  { sel: '#side', txt: 'Mit ↑ und ↓ tauchst du höher oder tiefer: 2 m, 6 m oder 10 m. In jeder Tiefe wohnen andere Tiere!' },
  { sel: '#quest', txt: 'Hier steht deine Aufgabe. Das gelbe Feld zeigt dir, wohin du schwimmen musst.' },
  { sel: '#lupe', txt: 'Siehst du einen gelben Ring? Tippe das Tier an oder drücke die Lupe. Los geht’s!' }];
let coachStep = -1;
function coachStart() { coachStep = 0; $('#coach').classList.add('on'); coachShow(); }
function coachShow() {
  const c = COACH[coachStep]; const el = $(c.sel); const r = el.getBoundingClientRect(), pr = phone.getBoundingClientRect();
  const x = (r.left - pr.left) / Z, y = (r.top - pr.top) / Z, w = r.width / Z, h = r.height / Z, pad = 10;
  const sp = $('#cspot'); sp.style.left = (x - pad) + 'px'; sp.style.top = (y - pad) + 'px'; sp.style.width = (w + pad * 2) + 'px'; sp.style.height = (h + pad * 2) + 'px';
  const box = $('#cbox'); const vh = H / Z; const below = y + h / 2 < vh / 2; box.style.top = below ? (y + h + pad + 18) + 'px' : 'auto'; box.style.bottom = below ? 'auto' : (vh - y + pad + 18) + 'px';
  $('#ctext').textContent = c.txt; $('#cdots').innerHTML = COACH.map((_, i) => `<i class="${i === coachStep ? 'on' : ''}"></i>`).join('');
  $('#cnext').textContent = coachStep === COACH.length - 1 ? 'Los!' : 'Weiter'; speak(c.txt);
}
$('#cnext').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); coachStep++; if (coachStep >= COACH.length) { coachStep = -1; st.tutDone = true; $('#coach').classList.remove('on'); const q = curQuest(); if (q) setTimeout(() => say('Erste Aufgabe: ' + q.txt), 300); return; } coachShow(); });

// ---------- input ----------
let pd = null;
canvas.addEventListener('pointerdown', (e) => { audioInit(); pd = { x: e.clientX, y: e.clientY, t: performance.now(), dx: cam.dragX, dy: cam.dragY }; });
canvas.addEventListener('pointermove', (e) => { if (!pd) return; cam.dragX = THREE.MathUtils.clamp(pd.dx - (e.clientX - pd.x) / W * 1.2, -.6, .6); cam.dragY = THREE.MathUtils.clamp(pd.dy + (e.clientY - pd.y) / H * 1.2, -.5, .5); });
canvas.addEventListener('pointerup', (e) => { if (!pd) return; const moved = Math.hypot(e.clientX - pd.x, e.clientY - pd.y); const quick = performance.now() - pd.t < 400; pd = null; if (moved < 12 && quick) tap(e); });
const tmp = new THREE.Vector3();
function screenPos(obj) { obj.getWorldPosition(tmp); tmp.project(camera); return [(tmp.x + 1) / 2 * W, (1 - tmp.y) / 2 * H, tmp.z]; }
function posOf(t) { if (t.obj) return screenPos(t.obj); tmp.copy(t.pos()).project(camera); return [(tmp.x + 1) / 2 * W, (1 - tmp.y) / 2 * H, tmp.z]; }
function tap(e) {
  if (st.screen !== 'explore') return;
  const r = phone.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
  for (const t of targets()) { if (!t.vis()) continue; const [tx, ty] = posOf(t); if (Math.hypot(x - tx, y - ty) < 90) return t.hit(); }
  say('Tippe auf die Pfeile, um zu schwimmen. Neue Tiere haben einen gelben Ring.', false);
}

// ---------- animation ----------
const ring = $('#ring'), ringlbl = $('#ringlbl');
function showRing(x, y, t) { ring.style.display = 'block'; ring.style.left = x / Z + 'px'; ring.style.top = y / Z + 'px'; ringlbl.style.display = 'block'; ringlbl.style.left = x / Z + 'px'; ringlbl.style.top = (y / Z + 44) + 'px'; ringlbl.textContent = t; }
function hideRing() { ring.style.display = 'none'; ringlbl.style.display = 'none'; }
function place(m, sc, u, v, d) { m.position.copy(toWorld(sc, u, v, d)); }
function setFog(m) { const dist = camera.position.z - m.position.z; m.material.uniforms.fog.value = THREE.MathUtils.clamp((dist - 15) / 30, 0, .45); }
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; clock += dt;
  const o = S[st.scene];
  const k = 1 - Math.exp(-dt * 2.0); cam.u += (cam.tu - cam.u) * k; cam.v += (cam.tv - cam.v) * k; cam.zoom += (cam.tz - cam.zoom) * k;
  if (!pd) { cam.dragX *= Math.exp(-dt * 1.2); cam.dragY *= Math.exp(-dt * 1.2); }
  const [cx, cy, L, mxx, myy] = camClamp(cam.u, cam.v, cam.zoom); const sway = st.scene === 'map' ? .12 : .2;
  camera.position.set(THREE.MathUtils.clamp(cx + Math.sin(clock * .35) * sway + cam.dragX, -mxx - .1, mxx + .1), THREE.MathUtils.clamp(cy + Math.sin(clock * .27 + 1) * sway * .6 + cam.dragY, -myy - .1, myy + .1), L);
  if (o.pano) { panoCam(dt); animPano(o, dt); }
  o.plate.material.uniforms.time.value = clock; raysMat.uniforms.time.value = clock; camBubbles.material.uniforms.time.value = clock;
  if (o.dust) o.dust.material.uniforms.time.value = clock;
  for (const m of all) m.material.uniforms.time.value = clock;
  ({ beach: () => {}, boat: () => {}, night: () => {}, explore: animExplore, jetty: animJetty, fan: animFan, kri: animKri, anemone: animAnemone, manta: animManta, base: animBase, map: animMap })[st.scene]?.(dt);
  // rings
  if (st.screen === 'explore' && !phone.classList.contains('cardon')) { const t = targets().find((x) => x.lbl && x.vis()); if (t) { const [x, y] = posOf(t); showRing(x, y, t.lbl); } else hideRing(); }
  // diver
  if (diver.visible) { swimT = Math.max(0, swimT - dt); const s = swimT > 0 ? 1 : 0; diver.rotation.z += (-swimDir * .22 * s - diver.rotation.z) * k * 2; diver.material.uniforms.speed.value = s ? 9 : 4.5; diver.material.uniforms.amp.value = s ? .11 : .06;
    const vh = 2 * 8 * TAN; diver.position.y = (.5 - .66) * vh + Math.sin(clock * 1.4) * .05; if (Math.random() < dt * .6) camBubbles.userData.emit(diver.position.x + .05, diver.position.y + .42 * diver.scale.y, diver.position.z, 3, .05, clock); }
  if (kneel.visible && Math.random() < dt * .5) camBubbles.userData.emit(kneel.position.x, kneel.position.y + .3, kneel.position.z, 3, .04, clock);
  if (st.screen === 'explore' && coachStep < 0) { st.airT += dt; if (st.airT > 25) { st.airT = 0; st.air--; if (st.air <= 1) { say('Luft wird knapp! Wir holen kurz neue Luft.'); setTimeout(() => { st.air = 5; setAir(); bubbleBurst(18); }, 1600); } setAir(); } }
  if (typeof storyFrame === 'function') storyFrame(dt);
  renderer.render(o.sc, camera);
  requestAnimationFrame(frame);
}
function animExplore() {
  const a = clock * .12; place(turtle, ex, .76 + Math.sin(a) * .05, .45 + Math.sin(a * 1.7) * .02, .62); turtle.position.y += Math.sin(clock * .9) * .08; turtle.rotation.z = Math.sin(a * 1.7) * .08; turtle.scale.x = Math.cos(a) > 0 ? -1 : 1; setFog(turtle);
  place(wobbe, ex, .74, .8, .95); wobbe.position.x += Math.sin(clock * .2) * .03;
  animSchool(ex, school, .34, .43, .5);
  smallFish.forEach((f) => { const u = ((clock * .05 + f.userData.ph) % 1 + 1) % 1; place(f, ex, 1.05 - u * 1.1, .55 + Math.sin(f.userData.ph) * .08, .35); setFog(f); });
}
function animJetty() { animSchool(je, jSchool, .5, .45, .4, .12); jIdols.forEach((m, i) => { const t = clock * .25 + m.userData.ph; place(m, je, .5 + Math.sin(t) * .25, .6 + i * .05 + Math.sin(t * 2) * .02, .6); m.scale.x = Math.cos(t) > 0 ? -1 : 1; setFog(m); }); }
function animFan() { place(seahorse, fa, .5, .41, .55); seahorse.rotation.z = Math.sin(clock * .8) * .05;
  fIdols.forEach((m, i) => { const t = clock * .22 + m.userData.ph; place(m, fa, .5 + Math.sin(t) * .3, .3 + i * .05, .45); m.scale.x = Math.cos(t) > 0 ? -1 : 1; setFog(m); });
  fSmall.forEach((f) => { const u = ((clock * .04 + f.userData.ph) % 1 + 1) % 1; place(f, fa, -.05 + u * 1.1, .5 + Math.sin(f.userData.ph) * .1, .4); f.scale.x = -1; setFog(f); }); }
function animKri() { animSchool(kr, kSchoolA, .66, .38, .35, .1); animSchool(kr, kSchoolB, .42, .55, .55, .14);
  parrots.forEach((p, i) => { const t = clock * .12 + p.userData.ph; place(p, kr, .55 + Math.sin(t) * .22, .64 + i * .04, .7 - i * .05); p.scale.x = Math.cos(t) > 0 ? 1 : -1; setFog(p); }); }
function animAnemone() { const spots = [[.6, .44, .78], [.36, .47, .72], [.43, .56, .8]];
  clowns.forEach((c, i) => { const [u, v, d] = spots[i]; const t = clock * .5 + c.userData.ph; place(c, an, u + Math.sin(t) * .04, v + Math.sin(t * 1.6) * .015, d); c.scale.x = Math.cos(t) > 0 ? -1 : 1; c.rotation.z = Math.sin(t * 1.6) * .1; }); }
function animManta(dt) {
  if (!st.mdone) st.calm = THREE.MathUtils.clamp(st.calm + (st.holding ? .09 : -.12) * dt, 0, 1);
  const c = st.calm; $('#calm').style.width = (c * 100) + '%'; $('#holdArc').setAttribute('stroke-dasharray', (c * 377).toFixed(0) + ' 377');
  const n = c >= .98 ? 3 : c > .62 ? 2 : c > .3 ? 1 : 0; $('#mcount').textContent = n + '/3 Mantas';
  if (st.holding && Math.random() < dt * 2) blip(700 + Math.random() * 200, 750, .08, .03);
  const Lp = THREE.MathUtils.lerp;
  mantas.forEach((m, i) => { const ud = m.userData; ud.a += dt * (.35 + i * .05) * (i % 2 ? -1 : 1);
    const vis = THREE.MathUtils.clamp((c - i * .3) * 5 + (i === 0 ? 1 : 0), 0, 1);
    const PZ = !!mt.pano; const cv = PZ ? Lp(.36, .42, c) - i * .03 : Lp(.33, .4, c) - i * .07, cd = PZ ? Lp(.55, .9, c) - i * .1 : Lp(.2, .85, c) - i * .12, ru = PZ ? Lp(.045, .075, c) + i * .01 : Lp(.2, .28, c);
    const px = m.position.x; place(m, mt, .5 + Math.cos(ud.a) * ru, cv + Math.sin(ud.a * 2) * .025, cd + Math.sin(ud.a) * .12); const sc = (PZ ? Lp(1.4, 2.1, c) : Lp(.75, 1.15, c)) * (1 - i * .12); m.scale.set(sc, sc, 1);
    if (Math.abs(m.position.x - px) > 1e-4) m.scale.x = m.position.x > px ? -sc : sc;
    m.rotation.z = Math.sin(ud.a) * .12 * Math.sign(m.scale.x); m.material.uniforms.opacity.value = vis; m.material.uniforms.fog.value = Lp(.35, .05, c) + i * .05; });
  cleaners.forEach((f) => { const t = clock * 1.4 + f.userData.ph; place(f, mt, .5 + Math.cos(t) * (mt.pano ? .04 : .12), (mt.pano ? .56 : .52) + Math.sin(t * 1.3) * .02, .45); f.scale.x = Math.sin(t) > 0 ? 1 : -1; });
  if (c >= .98 && !st.mdone) { st.mdone = true; st.holding = false; chime(); buzz(60); setTimeout(() => $('#mwin').classList.add('on'), 600); speak('Geschafft! Weil du so still warst, haben dich drei Riffmantas besucht.'); }
  $('#mfact').style.opacity = c > .4 ? 1 : 0;
}
function animBase(dt) {
  glowBoost = Math.max(0, glowBoost - dt * .8); sparkle = Math.max(0, sparkle - dt);
  glowMat.uniforms.t.value = clock; glowMat.uniforms.k.value = .28 + glowBoost * .6 + sparkle * .3; coneBubbles.material.uniforms.time.value = clock;
  if (Math.random() < dt * 3) coneBubbles.userData.emit(bs.cone.x + (Math.random() - .5) * 1.2, bs.cone.y - 1.6, bs.cone.z + .3, 1, .2, clock);
  if (sparkle > 0 && Math.random() < dt * 30) coneBubbles.userData.emit(bs.cone.x + (Math.random() - .5) * 2, bs.cone.y + (Math.random() - .5) * 3, bs.cone.z + .5, 1, .1, clock);
  tmp.copy(toWorld(bs, .64, .46, .55)).project(camera); const tag = $('#coneTag'); tag.style.left = (((tmp.x + 1) / 2 * W) / Z - 40) + 'px'; tag.style.top = (((1 - tmp.y) / 2 * H) / Z) + 'px';
}
const MK = { kri: [.28, .265], manta: [.7, .43], arborek: [.42, .525] };
function animMap() { for (const m of $$('.marker')) { const [u, v] = MK[m.dataset.site]; tmp.copy(toWorld(map, u, v, .4)).project(camera); m.style.left = ((tmp.x + 1) / 2 * W) / Z + 'px'; m.style.top = (((1 - tmp.y) / 2 * H) / Z + 26) + 'px'; } }

// ================= STORY & MINI-GAMES =================
const L = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;
// ---- persistence
function save() { try { localStorage.setItem('seaju', JSON.stringify({ v: 2, ch: st.chapter, found: [...st.found], tut: st.tutDone })); } catch (e) {} }
function load() { try { const d = JSON.parse(localStorage.getItem('seaju') || 'null'); if (d) { st.chapter = d.v === 2 ? (d.ch || 0) : 0; (d.found || []).forEach((x) => st.found.add(x)); st.tutDone = !!d.tut; } } catch (e) {} }
st.chapter = 0; load();

// ---- native TTS (Capacitor) with web fallback
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.nativePromise);
const _speakWeb = speak;
speak = function (text) { if (isNative()) { try { const C = window.Capacitor; C.nativePromise('TextToSpeech', 'stop', {}).catch(() => {}).finally(() => C.nativePromise('TextToSpeech', 'speak', { text, lang: 'de-DE', rate: 1.0, pitch: 1.1, volume: 1.0, category: 'playback' }).catch(() => _speakWeb(text))); } catch (e) { _speakWeb(text); } return; } _speakWeb(text); };

// ---- sensors
const sens = { has: false, beta: 0, gamma: 0, alpha: 0, base: null, rate: 0, acc: 0, motion: false, fx: 0, fy: 0, fdown: false, fspeed: 0 };
window.addEventListener('deviceorientation', (e) => { if (e.beta == null) return; sens.has = true; sens.alpha = e.alpha || 0; sens.beta = e.beta; sens.gamma = e.gamma; });
window.addEventListener('devicemotion', (e) => { const r = e.rotationRate; if (r && r.alpha != null) { sens.motion = true; sens.rate = Math.hypot(r.alpha || 0, r.beta || 0, r.gamma || 0); } const a = e.acceleration; if (a && a.x != null) sens.acc = Math.hypot(a.x, a.y, a.z); });
function calib() { sens.base = { b: sens.beta, g: sens.gamma }; sens.fx = sens.fy = 0; }
// finger fallback: drag on mini-game layer acts like tilting
let fstart = null, flast = null;
const mgEl = $('#mg');
function fingerDown(e) { fstart = { x: e.clientX, y: e.clientY, fx: sens.fx, fy: sens.fy }; flast = { x: e.clientX, y: e.clientY, t: performance.now() }; sens.fdown = true; }
function fingerMove(e) { if (!fstart) return; sens.fx = clamp(fstart.fx + (e.clientX - fstart.x) / 110, -1, 1); sens.fy = clamp(fstart.fy + (e.clientY - fstart.y) / 110, -1, 1); const t = performance.now(); const dt = Math.max(1, t - flast.t); sens.fspeed = Math.hypot(e.clientX - flast.x, e.clientY - flast.y) / dt * 1000; flast = { x: e.clientX, y: e.clientY, t }; }
function fingerUp() { fstart = null; sens.fdown = false; sens.fspeed = 0; }
mgEl.addEventListener('pointerdown', fingerDown); window.addEventListener('pointermove', fingerMove); window.addEventListener('pointerup', fingerUp);
function tilt() { if (sens.has) { if (!sens.base) calib(); return { x: clamp((sens.gamma - sens.base.g) / 22, -1, 1), y: clamp((sens.beta - sens.base.b) / 22, -1, 1) }; } return { x: sens.fx, y: sens.fy }; }
function shake() { return sens.has && sens.motion ? sens.rate : sens.fspeed / 6; } // deg/s-ish
const ctlTilt = () => sens.has ? 'Handy neigen' : 'Mit dem Finger ziehen';

// ---- small helpers
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const lay = $('#mgLayer');
function proj(sc, u, v, d) { tmp.copy(toWorld(sc, u, v, d)).project(camera); return [(tmp.x + 1) / 2 * W / Z, (1 - tmp.y) / 2 * H / Z]; }
function mgOpen(num, txt, ctl) { $('#mg').classList.add('on'); $('#mgNum').textContent = num; $('#mgTxt').textContent = txt; $('#mgBar').style.width = '0%'; $('#mgCtl').innerHTML = ctl || ''; $('#mgCtl').style.display = ctl ? 'flex' : 'none'; lay.innerHTML = ''; $('#photos').innerHTML = ''; bowlCtx.clearRect(0, 0, 9999, 9999); calib(); }
function mgClose() { $('#mg').classList.remove('on'); lay.innerHTML = ''; mgTick = null; bowlCtx.clearRect(0, 0, 9999, 9999); }
function mgBar(p) { $('#mgBar').style.width = clamp(p * 100, 0, 100) + '%'; }
let mgTick = null;
function storyFrame(dt) { if (mgTick) mgTick(dt); if (arOn) arTick(dt); stillTick(dt); }
function hideHud(on) { $('#explore').style.visibility = on ? 'hidden' : ''; }
const ICO_TILT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B1F3A" stroke-width="2.2" stroke-linecap="round"><rect x="7" y="3" width="10" height="18" rx="2" transform="rotate(-15 12 12)"/></svg>';

// ---- dialog
const POR = { wayan: '<img src="assets/wayan.png" alt="">', thalassa: '<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" style="margin-top:10px;background:linear-gradient(160deg,#7FE0EE,#2F7FD0);border-radius:50%;padding:4px"><path d="M4 14c2-4 5-6 8-6s6 2 8 6"/><circle cx="9" cy="12" r="1" fill="#fff"/><circle cx="15" cy="12" r="1" fill="#fff"/><path d="M9.5 16c1.5 1 3.5 1 5 0"/></svg>' };
const WHO = { wayan: 'Wayan', thalassa: 'Thalassa' };
function talk(who, txt, fact) { return new Promise((res) => {
  $('#dPor').innerHTML = POR[who]; $('#dPor').style.background = who === 'wayan' ? '#FFE9C7' : '#BFF3FA'; $('#dWho').textContent = WHO[who]; $('#dTxt').textContent = txt;
  const f = $('#dFact'); f.style.display = fact ? 'block' : 'none'; f.textContent = fact ? 'Wusstest du? ' + fact : '';
  $('#dlg').classList.remove('on'); void $('#dlg').offsetWidth; $('#dlg').classList.add('on'); speak(txt + (fact ? '. Wusstest du? ' + fact : ''));
  const done = (e) => { e && e.stopPropagation(); $('#dNext').onclick = null; $('#dlg').onclick = null; $('#dlg').classList.remove('on'); blip(500, 700, .08, .06); res(); };
  $('#dNext').onclick = done; setTimeout(() => { $('#dlg').onclick = (e) => { if (e.target.closest('#dSpeak')) return; done(e); }; }, 600);
}); }
$('#dSpeak').addEventListener('click', (e) => { e.stopPropagation(); speak($('#dTxt').textContent); });
function chapterCard(n, t, g) { return new Promise((res) => { $('#chNum').textContent = n === 0 ? 'PROLOG' : 'KAPITEL ' + n; $('#chT').textContent = t; $('#chG').textContent = g; $('#chap').classList.add('on'); chime(); speak((n === 0 ? 'Prolog. ' : 'Kapitel ' + n + '. ') + t + '. ' + g);
  $('#chGo').onclick = () => { $('#chap').classList.remove('on'); res(); }; }); }
function stage(scene, u = .5, v = .5, z = 1) { show('story-stage'); $$('.screen').forEach((s) => s.classList.remove('on')); $('#tabs').style.display = 'none'; canvas.style.display = 'block'; useScene(scene); setView(u, v, z, true); diver.visible = false; kneel.visible = false; ambient(scene !== 'beach' && scene !== 'base' && scene !== 'boat'); }

// ---- arrows at the screen edge pointing to off-screen items, + idle pulse
let hintPool = [], idleT = 0, lastGot = -1;
let hintSide = 0;
function edgeHints(pts) {
  const w = W / Z, h = H / Z, top = 130, bot = h - 120; let k = 0;
  // only guide when nothing is left on screen, then one arrow to the nearest target; the chosen side sticks so the arrow never flips while turning
  const onScr = pts.some(([x, y]) => x > 20 && x < w - 20 && y > 90 && y < h - 40);
  let best = null, bd = 1e9; if (!onScr) for (const p of pts) { const d = Math.hypot(p[0] - w / 2, p[1] - h / 2); if (d < bd) { bd = d; best = p; } }
  if (best) { const side = best[0] < w / 2 ? -1 : 1; if (hintSide && side !== hintSide) { let alt = null, ad = 1e9; for (const p of pts) { const sd = p[0] < w / 2 ? -1 : 1; if (sd !== hintSide) continue; const d = Math.hypot(p[0] - w / 2, p[1] - h / 2); if (d < ad) { ad = d; alt = p; } } if (alt && ad < bd * 1.7) best = alt; } hintSide = best[0] < w / 2 ? -1 : 1; } else hintSide = 0;
  for (const [x, y] of (best ? [best] : [])) {
    let a = hintPool[k]; if (!a || !a.isConnected) { a = document.createElement('div'); a.className = 'ehint'; a.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M5 12h12M12 6l6 6-6 6" fill="none" stroke="#0B1F3A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'; lay.appendChild(a); hintPool[k] = a; }
    const cx = clamp(x, 34, w - 34), cy = clamp(y, top + 20, bot - 10); a.style.left = cx + 'px'; a.style.top = cy + 'px'; a.style.display = 'flex'; a.style.transform = `translate(-50%,-50%) rotate(${Math.atan2(y - cy, x - cx)}rad)`; k++; }
  for (let i = k; i < hintPool.length; i++) if (hintPool[i]) hintPool[i].style.display = 'none';
}
// ================= MINI-GAMES =================
// 1) Strand sauber (Prolog)
function gameBeach() { return new Promise((res) => { window.__mgDone = () => { mgTick = null; mgClose(); camera.rotation.z = 0; res(true); };
  stage('beach', .45, .62, .78);
  mgOpen('MINISPIEL · STRAND', 'Sammle den Müll ein! Die Opfergaben bleiben liegen.', '<span>Tippe auf den Müll</span>');
  const trash = ['bottle', 'bag', 'can', 'flipflop', 'cup', 'bottle', 'bag', 'net'];
  const spots = [[.22, .72], [.3, .86], [.45, .8], [.52, .93], [.62, .84], [.76, .87], [.86, .8], [.17, .9]];
  const can = [[.38, .73], [.56, .75], [.7, .92]];
  let got = 0; const items = [];
  trash.forEach((k, i) => { const im = new Image(); im.src = 'assets/it_' + k + '.png'; im.style.width = (k === 'bag' || k === 'net' || k === 'cup' ? 74 : 56) + 'px'; im.dataset.u = spots[i][0]; im.dataset.v = spots[i][1]; im.dataset.t = 1; lay.appendChild(im); items.push(im);
    im.onclick = (e) => { e.stopPropagation(); if (im.dataset.done) return; im.dataset.done = 1; got++; mgBar(got / trash.length); blip(600, 1000, .1); buzz(15); im.style.transition = 'all .6s'; im.style.left = (W / Z - 50) + 'px'; im.style.top = (H / Z - 70) + 'px'; im.style.opacity = 0; im.style.transform = 'translate(-50%,-50%) scale(.3)';
      if (got === trash.length) setTimeout(async () => { mgClose(); chime(); res(); }, 700); }; });
  can.forEach((p, i) => { const im = new Image(); im.src = 'assets/it_canang' + (i % 2 + 1) + '.png'; im.style.width = '78px'; im.dataset.u = p[0]; im.dataset.v = p[1]; lay.appendChild(im); items.push(im);
    im.onclick = (e) => { e.stopPropagation(); im.animate([{ transform: 'translate(-50%,-50%) rotate(0)' }, { transform: 'translate(-50%,-50%) rotate(8deg)' }, { transform: 'translate(-50%,-50%) rotate(-8deg)' }, { transform: 'translate(-50%,-50%) rotate(0)' }], { duration: 400 }); blip(300, 220, .15);
      toast('Halt! Das ist eine Opfergabe. Die bleibt liegen.'); }; });
  const bin = document.createElement('div'); bin.className = 'o'; bin.style.cssText = `left:${W / Z - 50}px;top:${H / Z - 76}px;width:64px;height:64px;border-radius:20px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(0,0,0,.3)`;
  bin.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0B1F3A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16l-1.5 13h-13z"/><path d="M9 7V4h6v3"/></svg>'; lay.appendChild(bin);
  mgTick = () => { const pts = []; items.forEach((im, i) => { if (im.dataset.done) return; const [x, y] = proj(be, +im.dataset.u, +im.dataset.v, .7); im.style.left = x + 'px'; im.style.top = (y + Math.sin(clock * 2 + i) * 2) + 'px'; if (im.dataset.t) pts.push([x, y]); }); edgeHints(pts); };
}); }

// 2) Licht für die Algen (Kapitel 1)
const PATCH = [[.2, .58], [.78, .6], [.34, .68], [.66, .7]];
function gameLight(skipNets) { return new Promise((res) => { window.__mgDone = () => { mgTick = null; mgClose(); camera.rotation.z = 0; res(true); };
  stage('explore', .5, .58, .9); const U = ex.plate.material.uniforms; U.bleach.value = 1; U.patches.value.forEach((p, i) => p.set(PATCH[i][0], 1 - PATCH[i][1], .16, 0));
  if (!skipNets) { school.forEach((f) => f.visible = false); turtle.visible = false; }
  mgOpen('MINISPIEL · TEIL 1', 'Ein Geisternetz liegt auf dem Riff. Schau dich um und tippe auf alle Netze!', ICO_TILT + '<span>' + (sens.has ? 'Handy bewegen zum Umsehen, dann Netze antippen' : 'Wischen zum Umsehen, dann Netze antippen') + '</span>'); st.lookBig = 1.8; if (sens.has) calib();
  let freed = 0; const nets = PATCH.map((p, i) => { const im = new Image(); im.src = 'assets/it_net.png'; im.style.width = '110px'; im.style.opacity = .92; lay.appendChild(im); im.onclick = (e) => { e.stopPropagation(); if (im.dataset.done) return; im.dataset.done = 1; freed++; mgBar(freed / 4 * .3); blip(400, 800, .12); im.style.transition = 'all .8s'; im.style.transform = 'translate(-50%,-160%) rotate(25deg)'; im.style.opacity = 0; if (freed === 4) setTimeout(part2, 900); }; return im; });
  let phase = 1, spot, targets = [], prog = [0, 0, 0, 0];
  if (skipNets) { nets.forEach((im) => { im.dataset.done = 1; im.style.display = 'none'; }); setTimeout(() => part2(), 30); }
  function part2() { phase = 2; const pano = !!ex.pano; st.lookLock = !pano; st.lookBig = 0; cam.dragX = cam.dragY = 0; lay.innerHTML = ''; calib();
    $('#mgNum').textContent = T('MINISPIEL · TEIL 2'); $('#mgTxt').textContent = T(pano ? 'Dreh dich zu den blassen Korallen. Halt das Licht drauf!' : 'Lenk das Licht zu den blassen Korallen!'); $('#mgCtl').innerHTML = ICO_TILT + '<span>' + (pano ? (sens.has && !st.gyroOff ? 'Handy bewegen zum Zielen' : 'Wischen zum Zielen') : ctlTilt()) + '</span>'; $('#mgCtl').style.display = 'flex';
    targets = PATCH.map(() => { const d = document.createElement('div'); d.className = 'ptarget'; d.innerHTML = '<i></i>'; lay.appendChild(d); return d; });
    spot = document.createElement('div'); spot.className = 'spotl'; lay.appendChild(spot); spot.x = W / Z / 2; spot.y = H / Z / 2; speak($('#mgTxt').textContent); }
  mgTick = (dt) => {
    if (phase === 1) { nets.forEach((im, i) => { if (im.dataset.done) return; const [x, y] = proj(ex, PATCH[i][0], PATCH[i][1], .7); im.style.left = x + 'px'; im.style.top = y + 'px'; }); return; }
    if (ex.pano) { spot.x = W / Z / 2; spot.y = H / Z / 2; } else { const t = tilt(); spot.x = clamp(spot.x + t.x * 420 * dt, 20, W / Z - 20); spot.y = clamp(spot.y + t.y * 420 * dt, 120, H / Z - 60); } spot.style.left = spot.x + 'px'; spot.style.top = spot.y + 'px';
    let all = 0; const hp = []; PATCH.forEach((p, i) => { const [x, y] = proj(ex, p[0], p[1], .7); const d = targets[i]; d.style.left = x + 'px'; d.style.top = y + 'px'; if (prog[i] < 1) hp.push([x, y]);
      if (prog[i] < 1 && Math.hypot(spot.x - x, spot.y - y) < (ex.pano ? 75 : 55)) { prog[i] = Math.min(1, prog[i] + dt / 1.8); if (Math.random() < dt * 8) blip(700 + prog[i] * 500, 800 + prog[i] * 500, .05, .03); if (prog[i] >= 1) { d.classList.add('ok'); chime(); buzz(30); } }
      d.style.setProperty('--p', (prog[i] * 100) + '%'); U.patches.value[i].w = prog[i]; all += prog[i]; });
    mgBar(.3 + all / 4 * .7); if (ex.pano) edgeHints(hp);
    if (all >= 4 && phase === 2) { phase = 3; setTimeout(async () => { mgClose(); for (let k = 0; k <= 20; k++) { U.bleach.value = 1 - k / 20; await wait(40); } school.forEach((f) => f.visible = true); turtle.visible = true; res(); }, 600); }
  };
}); }

// 3) Foto-Safari (Kapitel 2)
function gamePhoto() { return new Promise((res) => { window.__mgDone = () => { st.photoFish = false; mgTick = null; mgClose(); camera.rotation.z = 0; res(true); };
  stage('anemone', .47, .6, .6); clowns.forEach((c) => { c.userData.shot = false; c.visible = true; }); st.clownAway = false;
  mgOpen('MINISPIEL · FOTO-SAFARI', 'Mach von jedem der 3 Clownfische ein Foto. Halt ihn im Rahmen. Langsam!', ICO_TILT + '<span>' + (sens.has && !st.gyroOff ? 'Handy bewegen zum Zielen' : (an.pano ? 'Wischen zum Zielen' : 'Mit dem Finger zielen')) + '</span>');
  const vf = document.createElement('div'); vf.className = 'vf'; lay.appendChild(vf);
  let shots = 0, focus = 0, hide = 0, look = { x: 0, y: 0 }, cool = 0; const fish = clowns[0];
  mgTick = (dt) => {
    const t = tilt(); look.x += (-t.x * 2.1 - look.x) * Math.min(1, dt * 6); look.y += (t.y * 2.8 - look.y) * Math.min(1, dt * 6);
    cam.dragX = look.x; cam.dragY = look.y;
    // fish path
    const sp = an.pano ? .22 + .1 * Math.sin(clock * .3) : .35 + .25 * Math.sin(clock * .3); fish.userData.tp = (fish.userData.tp || 0) + dt * sp;
    const a = fish.userData.tp; const PZ = !!an.pano; st.photoFish = false; let u = .5 + Math.sin(a) * (PZ ? .055 : .34), v = (PZ ? .5 : .42) + Math.sin(a * 2) * (PZ ? .03 : .14), d = .78;
    if (hide > 0) { hide -= dt; u = .45; v = .58; d = .5; fish.material.uniforms.opacity.value = Math.max(0, fish.material.uniforms.opacity.value - dt * 3); } else fish.material.uniforms.opacity.value = Math.min(1, fish.material.uniforms.opacity.value + dt * 2);
    if (!an.pano) { const px = fish.position.x; place(fish, an, u, v, d); fish.scale.x = fish.position.x > px ? -1 : 1; }
    const cx = W / 2, cy = H / 2; let target = null; for (const c of clowns) { if (c.userData.shot || !c.visible) continue; const [fx, fy] = screenPos(c); if (Math.abs(fx - cx) < 105 * Z && Math.abs(fy - cy) < 80 * Z) { target = c; break; } }
    const inside = hide <= 0 && !!target; st.photoTarget = target;
    vf.classList.toggle('hot', inside);
    if (inside && shake() > (sens.has && sens.motion ? 160 : 320) && hide <= 0) { hide = 3.2; focus = 0; blip(400, 150, .25, .1); toast('Zu schnell! Er hat sich versteckt.'); }
    cool -= dt;
    if (inside && cool <= 0) { focus = Math.min(1, focus + dt / (an.pano ? 1.0 : 1.4)); } else focus = Math.max(0, focus - dt * .8);
    mgBar((shots + focus) / 3);
    if (focus >= 1) { focus = 0; cool = 1.2; shots++; $('#flash').classList.add('on'); setTimeout(() => $('#flash').classList.remove('on'), 60); blip(1200, 600, .12, .12); buzz(30);
      const im = new Image(); try { renderer.render(S[st.scene].sc, camera); const pc = document.createElement('canvas'); pc.width = pc.height = 160; const g = pc.getContext('2d'); const sw = 210 * Z, sh = 160 * Z; g.drawImage(canvas, W / 2 - sw / 2, H / 2 - sh / 2, sw, sh, 0, 0, 160, 160); im.src = pc.toDataURL('image/jpeg', .85); } catch (e) { im.src = 'assets/st_clownfish.jpg'; }
      $('#photos').appendChild(im); if (st.photoTarget) { st.photoTarget.userData.shot = true; toast(T(['Erstes Foto!', 'Zweites Foto!', 'Drittes Foto!'][shots - 1] || 'Foto!'), false); }
      if (shots >= 3) { mgTick = null; setTimeout(() => { st.photoFish = false; mgClose(); cam.dragX = cam.dragY = 0; res(); }, 900); } }
  };
}); }

// 4) Handy ruhig halten (Kapitel 3) – im Missionsscreen
let stillT = 0;
function stillTick(dt) { if (st.screen !== 'mission' || st.mdone) return; if (sens.has && sens.motion) { const still = sens.rate < 10 && sens.acc < .3; stillT = still ? stillT + dt : 0; st.sensorStill = stillT > .3; } else st.sensorStill = false; }
// patch manta calm: sensor stillness counts like holding
const _animManta = animManta;
animManta = function (dt) { const h = st.holding; if (st.sensorStill) st.holding = true; _animManta(dt); st.holding = h; };
function gameStill() { return new Promise((res) => { window.__mgDone = () => { mgTick = null; mgClose(); camera.rotation.z = 0; res(true); };
  startMission(); $('#mTxt').textContent = sens.motion ? 'Wie am Nyepi-Tag: Halte das Handy ganz still. Dann kommen die Mantas zur Putzstation!' : 'Wie am Nyepi-Tag: ganz still sein! Halte den Knopf gedrückt, dann kommen die Mantas.';
  st._mcard = false; const iv = setInterval(() => { if (st.mdone && st._mcard && $('#card').style.display === 'none') { clearInterval(iv); res(); } }, 300);
}); }

// 5a) Korallen-Babys fangen (Kapitel 4)
function gameSpawn() { return new Promise((res) => { window.__mgDone = () => { mgTick = null; mgClose(); camera.rotation.z = 0; res(true); };
  stage('night', .5, .5, .9);
  mgOpen('MINISPIEL · LAICHNACHT', 'Fang 20 Korallen-Babys!', ICO_TILT + '<span>' + ctlTilt() + ' (links/rechts)</span>');
  const net = document.createElement('div'); net.className = 'o'; net.style.cssText = 'width:120px;height:60px;border:4px solid #fff;border-top:0;border-radius:0 0 60px 60px;background:repeating-linear-gradient(45deg,rgba(255,255,255,.35) 0 2px,transparent 2px 10px),repeating-linear-gradient(-45deg,rgba(255,255,255,.35) 0 2px,transparent 2px 10px)'; lay.appendChild(net);
  const handle = document.createElement('div'); handle.className = 'o'; handle.style.cssText = 'width:6px;height:90px;background:#C9A54A;border-radius:3px'; lay.appendChild(handle);
  let nx = W / Z / 2, got = 0; const ny = H / Z * .36; const bs2 = [];
  mgTick = (dt) => {
    const t = tilt(); nx = clamp(nx + t.x * 520 * dt, 60, W / Z - 60); net.style.left = nx + 'px'; net.style.top = ny + 'px'; handle.style.left = nx + 'px'; handle.style.top = (ny - 70) + 'px';
    if (Math.random() < dt * 4) { const b = document.createElement('div'); b.className = 'o bundle'; b.x = 30 + Math.random() * (W / Z - 60); b.y = H / Z + 10; b.vy = 70 + Math.random() * 60; b.ph = Math.random() * 6; lay.appendChild(b); bs2.push(b); }
    for (let i = bs2.length - 1; i >= 0; i--) { const b = bs2[i]; b.y -= b.vy * dt; b.x += Math.sin(clock * 2 + b.ph) * 20 * dt; b.style.left = b.x + 'px'; b.style.top = b.y + 'px';
      if (Math.abs(b.y - ny) < 22 && Math.abs(b.x - nx) < 58) { got++; blip(900, 1300, .06, .05); b.remove(); bs2.splice(i, 1); mgBar(got / 20); if (got >= 20) { mgTick = null; setTimeout(() => { mgClose(); res(); }, 500); return; } continue; }
      if (b.y < 90) { b.remove(); bs2.splice(i, 1); } }
  };
}); }

// 5b) Schale balancieren (Kapitel 4)
const bowlCv = $('#bowl'), bowlCtx = bowlCv.getContext('2d');
function gameBowl() { return new Promise((res) => {
  // Kinderfreundlich + flüssig (7.11.): echte Zeit mit festen Physik-Schritten (kein Zeitlupen-Effekt auf langsamen Tablets),
  // Wasser fliesst zur tiefen Seite (Schale wie echt: Wasser rechts -> nach links neigen), sanfte Wellen, Böen mit Vorwarnung,
  // Wasserwaage + Pfeil zeigen, wohin man neigen muss. 3D dahinter in niedriger Auflösung, solange das Spiel läuft.
  const prevPR = renderer.getPixelRatio(); renderer.setPixelRatio(1);
  const end = (ok, delay) => { mgTick = null; camera.rotation.z = 0; renderer.setPixelRatio(prevPR); setTimeout(() => { mgClose(); res(ok); }, delay); };
  window.__mgDone = () => end(true, 0);
  stage('boat', .5, .55, .92);
  mgOpen('MINISPIEL · ÜBERFAHRT', 'Halt die Schale gerade. Nichts verschütten!', ICO_TILT + '<span>' + ctlTilt() + ', damit nichts überschwappt</span>');
  const dpr = 1; bowlCv.width = W; bowlCv.height = H;
  const DUR = 18, STEP = 1 / 60;
  let s = 0, vs = 0, tin = 0, water = 1, prog = 0, gust = 0, gustT = 3, warn = 0, fail = false, tSim = 0, lastReal = performance.now(), acc = 0;
  calib();
  mgTick = () => {
    const now = performance.now(); let real = Math.min(.25, (now - lastReal) / 1000); lastReal = now; acc += real;
    const t = tilt();
    while (acc >= STEP) { acc -= STEP; tSim += STEP;
      tin += (t.x - tin) * (1 - Math.exp(-STEP * 14));            // schnelle, leicht geglättete Reaktion
      gustT -= STEP; if (gustT < .9 && warn === 0) warn = 1;        // Vorwarnung kurz vor der Böe
      if (gustT < 0) { gustT = 2.6 + Math.random() * 2.2; gust = (Math.random() < .5 ? -1 : 1) * (.8 + Math.random() * .45); warn = 0; }
      gust *= Math.exp(-STEP * .9);
      const roll = Math.sin(tSim * .8) * .38 + Math.sin(tSim * 2.1) * .12 + gust;
      const force = (roll + tin * 1.15) * 2.4;                       // Neigung zählt etwas mehr als die Welle: immer korrigierbar
      vs += (force - s * 2.4) * STEP * 3.2; vs *= Math.exp(-STEP * 3.2); s = clamp(s + vs * STEP, -1.5, 1.5);
      if (Math.abs(s) > 1) water = Math.max(0, water - STEP * (Math.abs(s) - 1) * .9);
      prog += STEP / DUR;
    }
    camera.rotation.z = (Math.sin(tSim * .8) * .3 + gust) * .05;
    if (Math.abs(s) > 1 && Math.random() < real * 8) { blip(200, 120, .08, .05); buzz(8); }
    mgBar(prog);
    window.__bowlDbg = { s, water, prog };
    drawBowl(s, water, dpr, warn ? Math.sign(gust || 1) : 0);
    if (water < .3 && !fail) { fail = true; toast('Verschüttet! Nochmal.'); end(false, 2000); }
    else if (prog >= 1 && !fail) { fail = true; chime(); end(true, 500); }
  };
}); }
function drawBowl(s, water, dpr, warnDir) {
  const c = bowlCtx, w = bowlCv.width, h = bowlCv.height; c.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h * .74, R = Math.min(w * .36, 170 * dpr * Z);
  c.save(); c.translate(cx, cy);
  // shadow
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, R * .62, R * 1.05, R * .22, 0, 0, Math.PI * 2); c.fill();
  // bowl body
  let g = c.createLinearGradient(-R, 0, R, 0); g.addColorStop(0, '#5A3A20'); g.addColorStop(.5, '#A7743F'); g.addColorStop(1, '#4A2E18');
  c.fillStyle = g; c.beginPath(); c.moveTo(-R, 0); c.bezierCurveTo(-R, R * .9, R, R * .9, R, 0); c.closePath(); c.fill();
  // water surface (tilted ellipse)
  const lvl = (1 - water) * R * .35;
  c.save(); c.beginPath(); c.ellipse(0, 0, R * .96, R * .3, 0, 0, Math.PI * 2); c.clip();
  g = c.createLinearGradient(0, -R * .3, 0, R * .3); g.addColorStop(0, '#5FC8E8'); g.addColorStop(1, '#1D6FA0');
  c.fillStyle = '#3B2414'; c.fillRect(-R, -R, 2 * R, 2 * R);
  c.translate(0, lvl); c.rotate(s * .22); c.fillStyle = g; c.beginPath(); c.ellipse(s * R * .25, 0, R * 1.05, R * .3, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-R * .3 + s * R * .2, -R * .08, R * .3, R * .05, 0, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 14; i++) { const a = i * 2.39, rr = (i / 14) * R * .8; c.fillStyle = '#FF8FB8'; c.beginPath(); c.arc(Math.cos(a) * rr + s * R * .2, Math.sin(a) * rr * .26, 3.2 * dpr, 0, Math.PI * 2); c.fill(); }
  c.restore();
  // rim
  c.strokeStyle = '#C89156'; c.lineWidth = 8 * dpr; c.beginPath(); c.ellipse(0, 0, R, R * .31, 0, 0, Math.PI * 2); c.stroke();
  // spill droplets
  if (Math.abs(s) > 1) { c.fillStyle = 'rgba(120,210,240,.9)'; for (let i = 0; i < 6; i++) { const sx = Math.sign(s) * (R + Math.random() * 30 * dpr); c.beginPath(); c.arc(sx, Math.random() * R * .5, 4 * dpr, 0, Math.PI * 2); c.fill(); } }
  c.restore();
  // Wasserwaage oben: Punkt muss in der Mitte bleiben; Pfeil zeigt, wohin neigen
  { const lw = Math.min(w * .7, 360 * Z), lx = w / 2 - lw / 2, ly = h * .2, lh = 26 * Z;
    c.fillStyle = 'rgba(11,31,58,.75)'; c.fillRect(lx, ly, lw, lh);
    c.fillStyle = 'rgba(127,224,238,.35)'; c.fillRect(w / 2 - lw * .17, ly, lw * .34, lh);
    const bx = w / 2 + clamp(s, -1.5, 1.5) / 1.5 * (lw / 2 - lh / 2);
    c.fillStyle = Math.abs(s) > 1 ? '#FF8A5B' : (Math.abs(s) > .6 ? '#FFD84A' : '#7FE0EE'); c.beginPath(); c.arc(bx, ly + lh / 2, lh * .42, 0, Math.PI * 2); c.fill();
    if (Math.abs(s) > .55) { const d = -Math.sign(s), ax = w / 2 + d * (lw / 2 + 34 * Z), ay = ly + lh / 2, sz = 22 * Z * (1 + .15 * Math.sin(performance.now() / 120));
      c.fillStyle = '#FFD84A'; c.beginPath(); c.moveTo(ax + d * sz, ay); c.lineTo(ax - d * sz * .6, ay - sz * .8); c.lineTo(ax - d * sz * .6, ay + sz * .8); c.closePath(); c.fill(); }
    if (warnDir) { c.fillStyle = 'rgba(255,216,74,.9)'; c.font = '800 ' + Math.round(20 * Z) + 'px system-ui'; c.textAlign = 'center'; c.fillText('🌊 ' + T('Welle!'), w / 2, ly - 10 * Z); } }
  // water meter
  c.fillStyle = 'rgba(11,31,58,.8)'; const mx = w - 40 * dpr * Z, my = h * .3, mh = h * .3; c.fillRect(mx, my, 16 * dpr, mh); c.fillStyle = water > .5 ? '#7FE0EE' : '#FF8A5B'; c.fillRect(mx, my + mh * (1 - water), 16 * dpr, mh * water);
}

// 6) Korallen pflanzen (Kapitel 5)
const CONE = [[.6, .56], [.7, .56], [.58, .64], [.66, .63], [.74, .64], [.65, .71]];
function gamePlant() { return new Promise((res) => { window.__mgDone = () => { mgTick = null; mgClose(); camera.rotation.z = 0; res(true); };
  stage('base', .6, .55, .8);
  mgOpen('MINISPIEL · PFLANZEN', 'Tippe auf die leuchtenden Plätze!', '<span>Tippe auf die Plätze</span>');
  let n = 0; const els = CONE.map((p, i) => { const d = document.createElement('div'); d.className = 'ptarget'; d.style.width = d.style.height = '54px'; d.style.margin = '-27px 0 0 -27px'; d.style.pointerEvents = 'auto'; d.style.animation = 'pulse 1.4s infinite'; lay.appendChild(d);
    d.onclick = (e) => { e.stopPropagation(); if (d.dataset.done) return; d.dataset.done = 1; n++; mgBar(n / CONE.length); d.style.border = '0'; d.style.animation = 'none'; d.innerHTML = '<img src="assets/sil_acropora.png" style="position:absolute;left:50%;top:50%;width:64px;transform:translate(-50%,-50%) scale(0);transition:transform .4s">'; requestAnimationFrame(() => { d.firstChild.style.transform = 'translate(-50%,-50%) scale(1)'; }); chime(); buzz(25); glowBoost = 1;
      if (n === CONE.length) setTimeout(() => { mgClose(); res(); }, 1000); }; return d; });
  mgTick = () => { els.forEach((d, i) => { const [x, y] = proj(bs, CONE[i][0], CONE[i][1], .6); d.style.left = x + 'px'; d.style.top = y + 'px'; }); };
}); }

// 7) AR – Riff im Zimmer
let arOn = false, arStream = null; const arScene = new THREE.Scene(); const arCam = new THREE.PerspectiveCamera(60, 1, .1, 100);
const arAnimals = [['clown', 2.0, 0, 'Clownfisch'], ['turtle', 2.6, 1.6, 'Schildkröte'], ['manta', 3.4, 3.2, 'Riffmanta'], ['sp_parrotfish', 2.2, 4.6, 'Papageifisch']].map(([k, w, yaw, name], i) => {
  const m = makeSprite(tex[k], w, k === 'manta' ? 2 : (k === 'turtle' ? 4 : 1), { amp: k === 'manta' ? .3 : .05, speed: k === 'manta' ? 1.6 : 6, fogColor: [0, 0, 0] }); m.userData = Object.assign(m.userData, { yaw, name, ph: i, got: false }); arScene.add(m); all.push(m); return m; });
const arBub = makeBubbles(200); arScene.add(arBub);
let arYaw = 0, arPitch = 0, arDrag = null, arGot = 0;
const eul = new THREE.Euler(), q1 = new THREE.Quaternion(-Math.sqrt(.5), 0, 0, Math.sqrt(.5)), zee = new THREE.Vector3(0, 0, 1), q0 = new THREE.Quaternion();
async function startAR() {
  audioInit(); $('#arui').classList.add('on'); $$('.screen').forEach((s) => s.classList.remove('on')); $('#tabs').style.display = 'none'; arOn = true; arGot = 0; arAnimals.forEach((a) => { a.userData.got = false; a.visible = true; });
  arCam.aspect = W / H; arCam.updateProjectionMatrix(); $('#arCtl').innerHTML = sens.has ? ICO_TILT + '<span>Dreh dich mit dem Handy im Kreis</span>' : '<span>Wische, um dich umzusehen</span>';
  const v = $('#arv'); try { arStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); v.srcObject = arStream; v.style.display = 'block'; await v.play().catch(() => {}); $('#arTxt').textContent = 'Beweg dein Handy und such die 4 Tiere in deinem Zimmer!'; }
  catch (e) { v.style.display = 'none'; $('#phone').style.background = 'radial-gradient(circle at 50% 30%,#2F8FC0,#0B1F3A)'; $('#arTxt').textContent = 'Keine Kamera erlaubt, also tauchen wir im blauen Raum. Such die 4 Tiere!'; }
  speak($('#arTxt').textContent);
}
function stopAR() { arOn = false; $('#arui').classList.remove('on'); if (arStream) { arStream.getTracks().forEach((t) => t.stop()); arStream = null; } $('#arv').style.display = 'none'; $('#phone').style.background = ''; show('map', 'map'); renderDots(); }
$('#arBtn').addEventListener('click', (e) => { e.stopPropagation(); startAR(); });
$('#arClose').addEventListener('click', (e) => { e.stopPropagation(); stopAR(); });
$('#arui').addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; arDrag = { x: e.clientX, y: e.clientY, yaw: arYaw, pitch: arPitch }; });
window.addEventListener('pointermove', (e) => { if (!arDrag) return; arYaw = arDrag.yaw + (e.clientX - arDrag.x) / W * 2.5; arPitch = clamp(arDrag.pitch + (e.clientY - arDrag.y) / H * 1.5, -1, 1); });
window.addEventListener('pointerup', () => { arDrag = null; });
function arTick(dt) {
  if (sens.has) { const o = (screen.orientation && screen.orientation.angle) || 0; eul.set(THREE.MathUtils.degToRad(sens.beta), THREE.MathUtils.degToRad(sens.alpha), -THREE.MathUtils.degToRad(sens.gamma), 'YXZ'); arCam.quaternion.setFromEuler(eul); arCam.quaternion.multiply(q1); arCam.quaternion.multiply(q0.setFromAxisAngle(zee, -THREE.MathUtils.degToRad(o))); }
  else { arCam.quaternion.setFromEuler(new THREE.Euler(-arPitch, -arYaw, 0, 'YXZ')); }
  arBub.material.uniforms.time.value = clock;
  arAnimals.forEach((m, i) => { const ud = m.userData; const y = ud.yaw + Math.sin(clock * .15 + i) * .25; const r = 6 + Math.sin(clock * .3 + i) * .6;
    const px = m.position.x; m.position.set(Math.sin(y) * r, Math.sin(clock * .5 + i * 2) * .8 + (i === 2 ? 1.2 : 0), -Math.cos(y) * r); m.lookAt(0, m.position.y, 0);
    m.scale.x = Math.abs(m.scale.x) * (Math.sin(clock * .15 + i) > 0 ? -1 : 1);
    if (Math.random() < dt * .8) arBub.userData.emit(m.position.x, m.position.y, m.position.z, 2, .3, clock);
    m.material.uniforms.opacity.value = ud.got ? Math.max(0, m.material.uniforms.opacity.value - dt) : 1; });
  // aim: closest animal near screen center
  let best = null; arAnimals.forEach((m) => { if (m.userData.got) return; tmp.copy(m.position).project(arCam); if (tmp.z < 1 && Math.abs(tmp.x) < .32 && Math.abs(tmp.y) < .25) best = m; });
  $('#arVf').classList.toggle('hot', !!best); arTick.best = best;
  renderer.setClearColor(0x000000, 0);
}
$('#arShot').addEventListener('click', (e) => { e.stopPropagation(); const m = arTick.best; $('#arFlash').classList.add('on'); setTimeout(() => $('#arFlash').classList.remove('on'), 60); blip(1200, 600, .12, .12);
  if (!m) { toast('Kein Tier im Rahmen. Such weiter!'); return; } m.userData.got = true; arGot++; buzz(30); chime();
  $('#arTxt').textContent = `${m.userData.name} fotografiert! (${arGot}/4)`; speak(m.userData.name + '!');
  if (arGot >= 4) setTimeout(() => { $('#arTxt').textContent = 'Super! Du hast alle 4 Tiere in deinem Zimmer gefunden!'; speak($('#arTxt').textContent); chime(); }, 1200); });

// ================= STORYLINE =================
const CHAPTERS = [
  { t: 'Ein Morgen in Bali', g: 'Lerne Wayan kennen und erfahre, warum das Meer in Bali so wichtig ist.' },
  { t: 'Ein Tier, das ein Garten ist', g: 'Korallen und Algen: die wichtigste Freundschaft im Meer.' },
  { t: 'Freunde fürs Leben', g: 'Clownfisch und Anemone helfen sich gegenseitig.' },
  { t: 'Der Tag der Stille', g: 'Mantas und Putzerfische: Wer still ist, sieht mehr.' },
  { t: 'Die Nacht der Korallen-Babys', g: 'Wie Korallen neue Korallen machen.' },
  { t: 'Segara Kerthi: Das Meer ehren', g: 'Gemeinsam pflanzen wir neue Korallen.' }];
async function playChapter(n) {
  st.inStory = true; hideHud(false);
  await chapterCard(n, CHAPTERS[n].t, CHAPTERS[n].g);
  if (n === 0) {
    stage('beach', .5, .45, .85);
    await talk('wayan', 'Om Swastiastu! Ich bin Wayan. Willkommen an unserem Strand in Nord-Bali!');
    await talk('wayan', 'Siehst du die kleinen Körbchen aus Palmblatt mit Blüten? Das sind Canang sari, kleine Opfergaben. Damit sagen wir jeden Tag Danke.');
    await talk('wayan', 'Bei uns sagen viele: Tri Hita Karana. Das heisst: Wir leben in Harmonie mit den Menschen, mit der Natur und mit dem Göttlichen.', 'Bei der Melasti-Zeremonie gehen viele Menschen in weissen Kleidern ans Meer. Das Meer gilt als reinigend.');
    await talk('wayan', 'Aber schau: Plastik liegt am Strand! Das Meer bringt es zurück. Hilfst du mir aufräumen?');
    await gameBeach();
    await talk('wayan', 'Danke! Jetzt ist der Strand wieder schön. Komm, wir tauchen zum Riff!');
    stage('explore', .5, .5, 1);
    await talk('thalassa', 'Hallo, ich bin Thalassa, die Stimme des Meeres. Ich zeige euch die Geheimnisse des Riffs: die Freundschaften, die man Symbiose nennt.', 'Symbiose heisst: Zwei verschiedene Lebewesen helfen sich gegenseitig.');
  }
  if (n === 1) {
    stage('explore', .5, .62, 1); ex.plate.material.uniforms.bleach.value = 1; school.forEach((f) => f.visible = false); turtle.visible = false;
    await talk('wayan', 'Oh nein! Das Riff ist ganz blass. Und die Fische sind weg!');
    await talk('thalassa', 'Weisst du, was eine Koralle ist? Sie ist ein Tier! Ganz viele winzige Polypen wohnen zusammen.');
    await talk('thalassa', 'In den Polypen wohnen winzige Algen. Die Algen machen aus Sonnenlicht Futter für die Koralle. Und sie geben ihr die schönen Farben!', 'Wenn das Meer zu warm wird, verlassen die Algen die Koralle. Dann wird sie weiss. Das heisst Korallenbleiche.');
    await talk('thalassa', 'Hier hat ein altes Fischernetz das Licht versperrt. Lass es uns entfernen und den Korallen wieder Sonne schenken!');
    await gameLight();
    await talk('wayan', 'Wow, die Farben sind zurück! Und die Fische kommen wieder!');
    await talk('thalassa', 'Genau. Koralle und Alge brauchen sich. Das ist die wichtigste Symbiose im Riff.');
  }
  if (n === 2) {
    st.storyQuest = { id: 'clownfish', txt: 'Schwimm zum Korallengarten und finde die Anemone', node: 'left', lvl: 1 };
    stage('explore'); await talk('thalassa', 'Im Korallengarten wohnt ein bunter Fisch in einem giftigen Haus. Schwimm mit den Pfeilen dorthin und such den gelben Ring!');
    show('explore'); goNode('start', 1, true); updQuest();
    await new Promise((r) => { st.hook = r; });
    await talk('wayan', 'Ein Clownfisch! Aber die Anemone hat doch Nesselfäden. Tut ihm das nicht weh?');
    await talk('thalassa', 'Nein! Der Clownfisch hat eine Schleimschicht, die ihn schützt. Die Anemone gibt ihm ein sicheres Zuhause. Und er verjagt Fische, die die Anemone fressen wollen.');
    await talk('thalassa', 'Mach drei schöne Fotos für dein Album. Aber beweg dich langsam, sonst erschrickt er!');
    hideHud(true); await gamePhoto(); hideHud(false); st.storyQuest = null;
    st.found.add('clownfish'); st.isNew.add('clownfish'); updCount(); openCard('clownfish', true); await waitCard();
  }
  if (n === 3) {
    stage('manta', .5, .5, 1);
    await talk('wayan', 'In Bali gibt es einen besonderen Tag: Nyepi, den Tag der Stille. Dann ist die ganze Insel ruhig, sogar der Flughafen ist zu!');
    await talk('thalassa', 'Hier bei Manta Point ist eine Putzstation. Kleine Putzerfische fressen den Mantas Parasiten von der Haut. Die Mantas werden sauber, die Fische satt. Wieder eine Symbiose!');
    await talk('thalassa', 'Mantas sind scheu. Wenn wir ganz still sind wie an Nyepi, kommen sie zu uns.');
    await gameStill();
  }
  if (n === 4) {
    stage('night', .5, .5, 1);
    await talk('wayan', 'Es ist Nacht, und der Mond ist voll. Thalassa sagt, heute passiert etwas ganz Besonderes!');
    await talk('thalassa', 'Einmal im Jahr, ein paar Nächte nach Vollmond, schicken viele Korallen gleichzeitig winzige Päckchen mit Eiern und Samen ins Wasser. Daraus werden Korallen-Babys!', 'Das nennt man Korallen-Laichen. Es sieht aus wie Schnee, der nach oben fällt.');
    await talk('thalassa', 'Forscher sammeln einige davon und ziehen sie gut geschützt auf. So wachsen Korallen, die Hitze besser aushalten.');
    await gameSpawn();
    stage('boat', .5, .55, .92);
    await talk('wayan', 'Geschafft! Jetzt bringen wir die Schale mit dem Jukung, unserem Boot, zur Station. Halt sie gut gerade!');
    let ok = false; while (!ok) { ok = await gameBowl(); if (!ok) await talk('wayan', 'Keine Sorge, das ist schwierig! Wir versuchen es nochmal, ganz ruhig.'); }
    await talk('wayan', 'Wir sind da, und die Korallen-Babys sind sicher!');
  }
  if (n === 5) {
    stage('base', .5, .5, 1);
    await talk('thalassa', 'Die Korallen-Babys sind gross geworden. Jetzt setzen wir sie auf einen CoralCone. Darauf können sie im Meer gut wachsen.');
    await gamePlant();
    stage('explore', .5, .5, 1); ex.plate.material.uniforms.bleach.value = 0;
    await talk('wayan', 'Wir haben den Cone ins Riff gebracht. Bald ist hier wieder ein bunter Korallengarten!');
    stage('beach', .5, .45, .85);
    await talk('wayan', 'Segara Kerthi heisst: das Meer ehren und rein halten. Das machen wir zusammen, die Menschen im Dorf, die Taucher und du!');
    await talk('thalassa', 'Du hast gelernt: Im Meer helfen sich viele. Koralle und Alge. Clownfisch und Anemone. Manta und Putzerfisch. Und wir Menschen können dem Meer auch helfen.');
    await new Promise((r) => { $('#cert').classList.add('on'); chime(); speak('Urkunde. Riff-Hüterin und Riff-Hüter!'); $('#certOk').onclick = () => { $('#cert').classList.remove('on'); r(); }; });
    await talk('thalassa', 'Jetzt kannst du frei tauchen, Tulamben entdecken und mit AR sogar Fische in deinem Zimmer suchen. Bis bald!');
  }
  st.chapter = Math.max(st.chapter, n + 1); save(); st.inStory = false; hideHud(false); mgClose();
  show('map', 'map'); renderDots(); updStoryCard();
}
function waitCard() { return new Promise((r) => { const iv = setInterval(() => { if ($('#card').style.display === 'none') { clearInterval(iv); r(); } }, 250); }); }
// hook anemone entry for chapter 2
const _enterAnemone = enterAnemone;
enterAnemone = function () { _enterAnemone(); if (st.hook) { const r = st.hook; st.hook = null; setTimeout(r, 600); } };
// story quest overrides free quest
const _curQuest = curQuest; curQuest = function () { return st.storyQuest || _curQuest(); };
// in story chapter 2, clownfish ring should not open card directly
const _targets = targets; targets = function () { const T = _targets(); if (st.inStory && st.scene === 'anemone') return []; return T; };

function updStoryCard() {
  const n = st.chapter; const done = n >= CHAPTERS.length;
  $('#scNum').textContent = done ? 'GESCHICHTE GESCHAFFT' : (n === 0 ? 'PROLOG' : `KAPITEL ${n} VON ${CHAPTERS.length - 1}`);
  $('#scT').textContent = done ? 'Du bist Riff-Hüter*in!' : CHAPTERS[n].t;
  $('#storyGo').querySelector('span').textContent = done ? 'Nochmal von vorn' : (n === 0 ? 'Geschichte starten' : 'Weiterspielen');
}
$('#storyGo').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); if (st.chapter >= CHAPTERS.length) st.chapter = 0; transition(() => playChapter(st.chapter)); });
for (const k in SITES) SITES[k].go = 'Frei tauchen';
$('#tPlay').addEventListener('click', () => { audioInit(); $('#title').remove(); if (sens.has) calib(); transition(() => playChapter(st.chapter >= CHAPTERS.length ? 0 : st.chapter)); });
$('#tSkip').addEventListener('click', () => { audioInit(); $('#title').remove(); });
// map: free dive only after prolog
const _pickSite = pickSite;
// parents: reset progress
const _parentsArea = parentsArea;
parentsArea = function () { _parentsArea(); const b = document.createElement('button'); b.className = 'linkb'; b.textContent = 'Spielstand zurücksetzen'; b.onclick = () => { try { localStorage.removeItem('seaju'); } catch (e) {} location.reload(); }; $('#pbox').appendChild(b); };
// render AR scene when active
const _render = renderer.render.bind(renderer);
renderer.render = function (sc, cm) { if (arOn) return _render(arScene, arCam); return _render(sc, cm); };
// save found animals whenever discovered
const _discover = discover; discover = function (id) { _discover(id); save(); };


// compact map sheet: free-dive button in the row
$('#freeRow').appendChild($('#goDive')); $('#dots').style.display = 'none'; $('#siteName').style.fontSize = '18px';
updStoryCard();

// ================= LANGUAGE, VOICES, LOOK-AROUND =================
let LANG = 'de'; try { LANG = localStorage.getItem('seaju_lang') || ((navigator.language || 'de').startsWith('de') ? 'de' : (navigator.language || '').startsWith('id') ? 'id' : 'en'); } catch (e) {}
let EN = {}, VO = { de: {}, en: {} };
try { EN = await (await fetch('i18n_en.json')).json(); } catch (e) {}
let ID = {}; try { ID = await (await fetch('i18n_id.json')).json(); } catch (e) {}
try { VO = await (await fetch('assets/vo/manifest.json')).json(); } catch (e) {}
const RULES = [
  [/^AUFGABE (\d+)\/(\d+)$/, (m) => `TASK ${m[1]}/${m[2]}`],
  [/^KAPITEL (\d+) VON (\d+)$/, (m) => `CHAPTER ${m[1]} OF ${m[2]}`],
  [/^KAPITEL (\d+)$/, (m) => `CHAPTER ${m[1]}`],
  [/^Tag (\d+)$/, (m) => `Day ${m[1]}`],
  [/^(\d)\/3 Mantas$/, (m) => `${m[1]}/3 mantas`],
  [/^Tulamben · noch (\d+) Tiere$/, (m) => `Tulamben · ${m[1]} more animals`],
  [/^Tulamben öffnet sich, wenn du (\d+) Tiere gefunden hast\. Dir fehlen noch (\d+)\.$/, (m) => `Tulamben opens when you have found ${m[1]} animals. You need ${m[2]} more.`],
  [/^Thalassa: «(.*)»$/, (m) => `Thalassa: “${T(m[1])}”`],
  [/^Wusstest du\? (.*)$/, (m) => `Did you know? ${T(m[1])}`],
  [/^Super! Nächste Aufgabe: (.*)$/, (m) => `Great! Next task: ${T(m[1])}`],
  [/^Erste Aufgabe: (.*)$/, (m) => `First task: ${T(m[1])}`],
  [/^(.+) fotografiert! \((\d)\/4\)$/, (m) => `${T(m[1])} photographed! (${m[2]}/4)`],
  [/^(.+)! Schau genau hin, hier ist etwas!$/, (m) => `${T(m[1])}! Look closely, there's something here!`],
  [/^(.+)! Tauch tiefer!$/, (m) => `${T(m[1])}! Dive deeper!`],
  [/^(.+)! Schwimm höher!$/, (m) => `${T(m[1])}! Swim higher!`],
  [/^Bitte löse die Aufgabe: Wie viel ist (\d+) \+ (\d+)\?$/, (m) => `Please solve: what is ${m[1]} + ${m[2]}?`],
  [/^(.+)\.$/, (m) => (EN[m[1]] ? EN[m[1]] + '.' : null)]];
Object.assign(EN, { 'ELTERNBEREICH · DEMO': 'PARENT AREA · DEMO', 'Eine echte Koralle mit Ocean Pure': 'A real coral with Ocean Pure', 'Ihr Kind pflegt im Spiel eine Koralle. Mit einer Patenschaft wächst eine echte Projektkoralle auf einem CoralCone in Indonesien. Foto und Status erscheinen danach im Spiel.': 'Your child cares for a coral in the game. With a sponsorship, a real project coral grows on a CoralCone in Indonesia. Its photo and status then appear in the game.', 'Patenschaft ab USD 30 · Prototyp, keine Zahlung': 'Sponsorship from USD 30 · prototype, no payment', 'Super!': 'Great!', 'Nächste Aufgabe:': 'Next task:', 'Erste Aufgabe:': 'First task:' });
function T(s) { if (LANG === 'de' || !s) return s; const D = LANG === 'id' ? ID : EN; const k = s.trim(); if (D[k]) return s.replace(k, D[k]); if (LANG === 'id') { const m = k.match(/^KAPITEL (\d+)$/); if (m) return 'BAB ' + m[1]; } if (LANG === 'en') for (const [re, fn] of RULES) { const m = k.match(re); if (m) { const r = fn(m); if (r) return r; } } if (/[.!?:]\s/.test(k)) return splitSeg(k).map((x) => T(x)).join(' '); return s; }
// DOM sweeper: translate text nodes + aria labels (keeps German original for switching back)
function sweep(root = phone) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const v = n.nodeValue; if (!v || !v.trim()) continue; if (n.parentElement && n.parentElement.closest('#heroPick,#profPick,#profBtn')) continue;
    if (LANG !== 'de') { if (n.__en === v && n.__l === LANG) continue; const src = (n.__de && n.__en === v) ? n.__de : v; const t = T(src); if (t !== src) { n.__de = src; n.__en = t; n.__l = LANG; n.nodeValue = t; } else if (src !== v) { n.nodeValue = src; n.__en = null; } } else if (n.__de && n.__en === v) { n.nodeValue = n.__de; n.__en = null; } }
  root.querySelectorAll('[aria-label]').forEach((e) => { if (!e.__de) e.__de = e.getAttribute('aria-label'); e.setAttribute('aria-label', LANG !== 'de' ? T(e.__de) : e.__de); });
}
setInterval(() => sweep(), 250);
function setLang(l) { LANG = l; try { localStorage.setItem('seaju_lang', l); } catch (e) {} document.documentElement.lang = l; sweep(); $$('.langb').forEach((b) => b.classList.toggle('act', b.dataset.l === l)); }

// ---- voice playback (pre-recorded clips), fallback device TTS
const norm = (s) => s.replace(/[«»“”"]/g, '').replace(/\s+/g, ' ').trim().replace(/[.!?:…]+$/, '').toLowerCase();
const splitSeg = (s) => s.split(/(?<=[.!?:])\s+/).map((x) => x.trim()).filter(Boolean);
let voA = null, voToken = 0;
function voStop() { voToken++; if (voA) { try { voA.pause(); } catch (e) {} voA = null; } try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {} if (isNative()) window.Capacitor.nativePromise('TextToSpeech', 'stop', {}).catch(() => {}); }
function playItem(it, tok) { return new Promise((res) => { if (tok !== voToken) return res();
  if (it.url) { const a = new Audio(it.url); voA = a; a.onended = () => setTimeout(res, 110); a.onerror = res; a.play().catch(res); return; }
  ttsFallback(it.text, res); }); }
async function voPlay(items, tok) { for (const it of items) { if (tok !== voToken) return; await playItem(it, tok); } }
const _speakOld = speak;
speak = function (text, who = 'thalassa') {
  if (!text) return; const t = T(text); const segs = splitSeg(t); const M = (VO[LANG] || {});
  voStop(); const tok = voToken;
  voPlay(segs.map((s) => { const f = M[who] && M[who][norm(s)]; return f ? { url: 'assets/vo/' + f } : { text: s }; }), tok);
};
function ttsFallback(t, done = () => {}) { const lang = LANG === 'en' ? 'en-US' : LANG === 'id' ? 'id-ID' : 'de-DE';
  if (isNative()) { const C = window.Capacitor; C.nativePromise('TextToSpeech', 'speak', { text: t, lang, rate: 1.0, pitch: 1.05, volume: 1.0, category: 'playback' }).then(done, done); return; }
  try { const s = window.speechSynthesis; if (!s) return done(); const u = new SpeechSynthesisUtterance(t); u.lang = lang; u.rate = .95; const v = s.getVoices().find((x) => x.lang && x.lang.startsWith(LANG)); if (v) u.voice = v; u.onend = done; u.onerror = done; s.speak(u); setTimeout(done, 400 + t.length * 90); } catch (e) { done(); } }
// talk(): translate + Wayan voice
talk = function (who, txt, fact) { return new Promise((res) => {
  $('#dPor').innerHTML = POR[who]; $('#dPor').style.background = who === 'wayan' ? '#FFE9C7' : '#BFF3FA'; $('#dWho').textContent = WHO[who]; $('#dTxt').textContent = T(txt);
  const f = $('#dFact'); f.style.display = fact ? 'block' : 'none'; f.textContent = fact ? T('Wusstest du? ' + fact) : '';
  $('#dlg').classList.remove('on'); void $('#dlg').offsetWidth; $('#dlg').classList.add('on');
  speak(txt + (fact ? ' Wusstest du? ' + fact : ''), who); $('#dSpeak').onclick = (e) => { e.stopPropagation(); speak(txt + (fact ? ' Wusstest du? ' + fact : ''), who); };
  const done = (e) => { e && e.stopPropagation(); $('#dNext').onclick = null; $('#dlg').onclick = null; $('#dlg').classList.remove('on'); blip(500, 700, .08, .06); res(); };
  $('#dNext').onclick = done; setTimeout(() => { $('#dlg').onclick = (e) => { if (e.target.closest('#dSpeak')) return; done(e); }; }, 600);
}); };
chapterCard = function (n, t, g) { return new Promise((res) => { $('#chNum').textContent = n === 0 ? 'PROLOG' : 'KAPITEL ' + n; $('#chT').textContent = T(t); $('#chG').textContent = T(g); $('#chap').classList.add('on'); chime(); speak(t + '. ' + g);
  $('#chGo').onclick = () => { $('#chap').classList.remove('on'); voStop(); res(); }; }); };

// ---- look around by moving the phone (everywhere)
st.lookLock = false; let lookScene = '', lookNode = '';
function lookTick(dt) { if (st.gyroOff) return;
  const mgOpenNow = $('#mg').classList.contains('on');
  if (arOn || st.lookLock || st.screen === 'album') return;
  if (!sens.has && !mgOpenNow) return; // finger look handled by canvas drag
  if (st.scene + st.node !== lookScene + lookNode) { lookScene = st.scene; lookNode = st.node; if (sens.has) calib(); }
  const t = tilt(); const big = mgOpenNow ? (st.scene === 'beach' ? 1.8 : (st.lookBig || 1)) : 1;
  const tx = -t.x * 2.4 * big, ty = t.y * 3.2 * big;
  cam.dragX += (tx - cam.dragX) * Math.min(1, dt * 5); cam.dragY += (ty - cam.dragY) * Math.min(1, dt * 5);
  if (sens.has && sens.base) { sens.base.g += (sens.gamma - sens.base.g) * dt * .03; sens.base.b += (sens.beta - sens.base.b) * dt * .03; } // slow re-centering
}
const _storyFrame = storyFrame;
storyFrame = function (dt) { lookTick(dt); _storyFrame(dt); };
// games that use tilt for something else lock the look
for (const [g, name] of [[gameLight, 'gameLight'], [gameSpawn, 'gameSpawn'], [gameBowl, 'gameBowl'], [gamePhoto, 'gamePhoto']]) {
  const wrapped = async function (...a) { st.lookLock = name !== 'gameLight' && !(name === 'gamePhoto' && S.anemone.pano); try { return await g(...a); } finally { st.lookLock = false; st.lookBig = 0; cam.dragX = cam.dragY = 0; } };
  if (name === 'gameLight') gameLight = wrapped; if (name === 'gameSpawn') gameSpawn = wrapped; if (name === 'gameBowl') gameBowl = wrapped; if (name === 'gamePhoto') gamePhoto = wrapped;
}
window.__games = { gameLight: () => gameLight() }; window.__dbg = { mantas, get PV() { return PV; }, camera, S, clowns };
// beach: zoom out a little less, larger look range + off-screen hints
const _gameBeach = gameBeach;
gameBeach = async function () { const p = _gameBeach(); setView(.42, .66, .62, true); $('#mgCtl').innerHTML = ICO_TILT + '<span>' + (sens.has ? 'Handy bewegen zum Umsehen' : 'Mit dem Finger wischen, um den Strand zu sehen') + '</span>'; $('#mgCtl').style.display = 'flex'; $('#mgCtl').style.left = '40%';
  setTimeout(() => speak('Beweg das Handy, um den ganzen Strand zu sehen.'), 2500); return p; };
// language buttons on title + parents
const lb = document.createElement('div'); lb.style.cssText = 'display:flex;gap:8px'; lb.innerHTML = '<button class="ghost langb" data-l="de">Deutsch</button><button class="ghost langb" data-l="en">English</button><button class="ghost langb" data-l="id">Bahasa</button>';
$('#title').appendChild(lb); lb.querySelectorAll('button').forEach((b) => b.onclick = (e) => { e.stopPropagation(); setLang(b.dataset.l); });
const st2 = document.createElement('style'); st2.textContent = '.langb.act{background:#fff;color:#0B1F3A}'; document.head.appendChild(st2);
const _pa = parentsArea; parentsArea = function () { _pa(); const r = document.createElement('div'); r.style.cssText = 'display:flex;gap:8px;justify-content:center'; r.innerHTML = '<button class="ghost langb" data-l="de" style="color:#0B1F3A;border-color:#0B1F3A">Deutsch</button><button class="ghost langb" data-l="en" style="color:#0B1F3A;border-color:#0B1F3A">English</button><button class="ghost langb" data-l="id" style="color:#0B1F3A;border-color:#0B1F3A">Bahasa</button>'; $('#pbox').insertBefore(r, $('#pbox').lastChild); r.querySelectorAll('button').forEach((b) => b.onclick = () => setLang(b.dataset.l)); setLang(LANG); };
setLang(LANG);

// ================= 360° PANORAMA ENGINE =================
// A scene with `pano:true` is a sphere around the camera. u = yaw (0..1 around), v = pitch (0 top, .5 horizon, 1 down).
const PBAND = Math.PI * 154 / 180; // vertical coverage of a 21:9 panorama
const panoVS = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const panoFS = `
uniform sampler2D map; uniform float time, wobble, sway, caustic, bleach, night, band; uniform vec4 patches[4]; varying vec3 vDir;
float cpat(vec2 p){ float c=0.; vec2 q=p; for(int i=0;i<3;i++){ float fi=float(i); q=vec2(q.x+sin(q.y*1.3+time*0.55+fi)*0.7, q.y+cos(q.x*1.5-time*0.45+fi*1.7)*0.7); float v=abs(sin(q.x)+sin(q.y))*0.5; c+=1./(1.+60.*v*v); } return c/3.; }
void main(){ vec3 d = normalize(vDir);
  float u = atan(d.x, -d.z) / 6.2831853 + .5; float v = clamp(.5 - asin(d.y) / band, .002, .998);
  vec2 uv = vec2(u, 1. - v);
  float u2 = fract(u + .5); vec2 gx = vec2(dFdx(u), -dFdx(v)), gy = vec2(dFdy(u), -dFdy(v));
  float gx2 = dFdx(u2), gy2 = dFdy(u2); if (abs(gx2) < abs(gx.x)) gx.x = gx2; if (abs(gy2) < abs(gy.x)) gy.x = gy2;
  vec3 base = textureGrad(map, uv, gx, gy).rgb;
  float blue = smoothstep(.02, .14, base.b - base.r) * step(.5, v);
  float green = smoothstep(.03, .12, base.g - max(base.r, base.b) * .92) * (1. - smoothstep(.42, .56, v));
  uv.x += (sin(v * 140. + time * 1.3) * .0009 + sin(u * 300. - time * 1.7) * .0005) * wobble * blue;
  uv.y += cos(u * 220. + time * 1.1) * .0012 * wobble * blue;
  uv.x += sin(time * 1.4 + u * 90.) * .0016 * sway * green * (1. - v * 1.6);
  vec3 col = textureGrad(map, uv, gx, gy).rgb;
  float lum = dot(col, vec3(.3, .59, .11));
  col += vec3(.7, .95, 1.) * cpat(vec2(u * 120., v * 40.)) * smoothstep(.42, .85, lum) * smoothstep(.55, .75, v) * caustic * .35;
  float rev = 0.; for (int i = 0; i < 4; i++) { vec4 p = patches[i]; float du = abs(u - p.x); du = min(du, 1. - du); rev = max(rev, p.w * (1. - smoothstep(p.z * .35, p.z, length(vec2(du * 2.3, (1. - v) - p.y))))); }
  float bm2 = bleach * (1. - rev) * smoothstep(.5, .6, v);
  col = mix(col, vec3(dot(col, vec3(.3, .59, .11))) * 1.05 + vec3(.2, .22, .24), bm2 * .85);
  col = mix(col, col * vec3(.35, .45, .8), night);
  gl_FragColor = vec4(col, 1.); }`;
const PANO_R = 60;
function scenePano(name, file, opts = {}) {
  const sc = new THREE.Scene();
  const t = tex[file]; t.wrapS = THREE.RepeatWrapping; t.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    uniforms: { map: { value: t }, time: { value: 0 }, wobble: { value: opts.wobble ?? 1 }, sway: { value: opts.sway ?? 0 }, caustic: { value: opts.caustic ?? 0 }, bleach: { value: 0 }, night: { value: 0 }, band: { value: PBAND }, L0: { value: 20 }, patches: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, .1, 0)) } },
    vertexShader: panoVS, fragmentShader: panoFS });
  const plate = new THREE.Mesh(new THREE.SphereGeometry(PANO_R, 96, 48), mat); plate.renderOrder = -10; sc.add(plate);
  const o = { name, sc, plate, D: 1, pano: true, rays: opts.rays ?? 0, fogColor: opts.fogColor || [0.2, 0.6, 0.75], front: opts.front ?? .5 };
  S[name] = o; return o;
}
// position on the sphere for (u, v); d = how close (0 far .. 1 near), like the old plate depth
function panoPos(u, v, d = .5) { const a = (u - .5) * Math.PI * 2, p = (.5 - v) * PBAND, r = 26 - d * 12;
  return new THREE.Vector3(Math.sin(a) * Math.cos(p) * r, Math.sin(p) * r, -Math.cos(a) * Math.cos(p) * r); }
const _tw = toWorld; toWorld = function (sc, u, v, d) { return sc.pano ? panoPos(u, v, d) : _tw(sc, u, v, d); };
const _pl = place; place = function (m, sc, u, v, d) { if (sc.pano) { m.position.copy(panoPos(u, v, d)); m.lookAt(0, 0, 0); } else _pl(m, sc, u, v, d); };
const _pr = proj; const _pv = new THREE.Vector3();
proj = function (sc, u, v, d) { if (!sc.pano) return _pr(sc, u, v, d);
  _pv.copy(panoPos(u, v, d)).applyMatrix4(camera.matrixWorldInverse);
  { const a = Math.atan2(_pv.x, -_pv.z); const hf = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect); if (Math.abs(a) > hf * 1.02 || _pv.z > -0.3) { const b = Math.atan2(_pv.y, Math.hypot(_pv.x, _pv.z)); return [W / Z / 2 + a / hf * (W / Z / 2), H / Z / 2 - b / (camera.fov * Math.PI / 360) * (H / Z / 2)]; } } // behind: far off to that side
  _pv.applyMatrix4(camera.projectionMatrix); return [(_pv.x + 1) / 2 * W / Z, (1 - _pv.y) / 2 * H / Z]; };

// ---- view: gyro (magic window) + finger + pinch
window.__pv = null; const PV = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, base: 0, basePitch: 0, devYaw: null, devPitch: 0, dev0: null, dragYaw: 0, dragPitch: 0, zoom: 1, tZoom: 1, active: false };
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _q1 = new THREE.Quaternion(-Math.sqrt(.5), 0, 0, Math.sqrt(.5)), _f = new THREE.Vector3();
window.addEventListener('deviceorientation', (e) => { if (e.beta == null) return;
  const D2R = Math.PI / 180; _e.set(e.beta * D2R, (e.alpha || 0) * D2R, -e.gamma * D2R, 'YXZ'); _q.setFromEuler(_e).multiply(_q1);
  _f.set(0, 0, -1).applyQuaternion(_q); const y = Math.atan2(_f.x, -_f.z), p = Math.asin(clamp(_f.y, -1, 1));
  if (PV.devYaw == null) PV.devYaw = y; else { let dy = y - (PV.devYaw % (Math.PI * 2)); dy = ((dy + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; PV.devYaw += dy; }
  PV.devPitch = p; });
setInterval(() => { window.__pv = { yaw: PV.yaw, t: PV.tYaw, drag: PV.dragYaw, lock: st.lookLock, sc: st.scene, z: PV.zoom }; }, 300);
function panoRecenter() { PV.dev0 = PV.devYaw; PV.dev0p = PV.devPitch; PV.dragYaw = 0; PV.dragPitch = 0; }
function panoView(u, v, zoom) { PV.base = (u - .5) * Math.PI * 2; PV.basePitch = (.5 - v) * PBAND; PV.tZoom = clamp(zoom || 1, .5, 3); panoRecenter(); }
function panoCam(dt) {
  const gy = sens.has && PV.devYaw != null && !st.lookLock && !st.gyroOff;
  if (gy && PV.dev0 == null) panoRecenter();
  const dYaw = gy ? (PV.devYaw - PV.dev0) : 0; const dPitch = gy ? (PV.devPitch - (PV.dev0p || 0)) : 0;
  if (!st.lookLock) { PV.tYaw = PV.base + dYaw + PV.dragYaw; const lim = Math.max(0, PBAND / 2 - camera.fov * Math.PI / 360 - .02); PV.tPitch = clamp(PV.basePitch + dPitch + PV.dragPitch, -lim, lim); PV.dragPitch = clamp(PV.dragPitch, -lim - PV.basePitch - dPitch, lim - PV.basePitch - dPitch); }
  const k = 1 - Math.exp(-dt * 10); // smoothing: gentle, no jitter
  let dyw = PV.tYaw - PV.yaw; PV.yaw += dyw * k; PV.pitch += (PV.tPitch - PV.pitch) * k; PV.zoom += (PV.tZoom - PV.zoom) * (1 - Math.exp(-dt * 8));
  camera.position.set(0, 0, 0); camera.rotation.set(PV.pitch, -PV.yaw, 0, 'YXZ');
  const fov = clamp(72 / PV.zoom, 24, 110); if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
}
function panoLeave() { camera.rotation.set(0, 0, 0); if (camera.fov !== 40) { camera.fov = 40; camera.updateProjectionMatrix(); } }
// current view direction as (u, v) — for games that spawn things where the child looks
function panoLookUV() { return [((PV.yaw / (Math.PI * 2)) + .5 + 10) % 1, .5 - PV.pitch / PBAND]; }
// finger: one finger turns, two fingers zoom (0.5x..3x)
{ const pts = new Map(); let pinch0 = null, z0 = 1;
  let moved = 0; const ok = (e) => S[st.scene] && S[st.scene].pano && !e.target.closest('button,#dlg,#chap,#cert,#card,#title,.fdhold,.fdear,#tabs,.sheet');
  phone.addEventListener('click', (e) => { if (moved > 12) { e.stopPropagation(); e.preventDefault(); } moved = 0; }, true);
  phone.addEventListener('pointerdown', (e) => { if (!ok(e)) return; moved = 0; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); z0 = PV.tZoom; } }, true);
  phone.addEventListener('pointermove', (e) => { if (!pts.has(e.pointerId)) return; const p = pts.get(e.pointerId); const dx = e.clientX - p[0], dy = e.clientY - p[1]; moved += Math.abs(dx) + Math.abs(dy); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size >= 2 && pinch0) { const [a, b] = [...pts.values()]; PV.tZoom = clamp(z0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch0, .5, 3); return; }
    if (st.lookLock) return; const f = (camera.fov * Math.PI / 180) / H; PV.dragYaw -= dx * f * 1.6; PV.dragPitch += dy * f * 1.2; }, true);
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null; };
  phone.addEventListener('pointerup', up, true); phone.addEventListener('pointercancel', up, true);
  phone.addEventListener('wheel', (e) => { if (S[st.scene] && S[st.scene].pano) PV.tZoom = clamp(PV.tZoom * (e.deltaY > 0 ? .9 : 1.1), .5, 3); }, { passive: true }); }
const _setView = setView; setView = function (u, v, zoom, instant) { _setView(u, v, zoom, instant); if (S[st.scene] && S[st.scene].pano) { PV.base = (u - .5) * Math.PI * 2; PV.basePitch = (.5 - v) * PBAND; PV.tZoom = clamp(Math.max(1, zoom || 1), .5, 3); if (instant) { panoRecenter(); PV.yaw = PV.base; PV.pitch = PV.basePitch; PV.zoom = PV.tZoom; } } };
const _useScene = useScene; useScene = function (scene) { const was = S[st.scene] && S[st.scene].pano; _useScene(scene); if (S[scene].pano) panoRecenter(); else if (was) panoLeave(); };
// moving clouds for outdoor panoramas: soft sprites drifting along the sky band
function cloudTex() { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 14; i++) { const x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, r = 22 + Math.random() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,240,235,.55)'); gr.addColorStop(1, 'rgba(255,240,235,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128); }
  const t = new THREE.CanvasTexture(c); return t; }
function addClouds(o, n = 7, tint = 1) { const t = cloudTex(); o.clouds = [];
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: .55 * tint })); m.userData = { u: Math.random(), v: .12 + Math.random() * .18, s: .002 + Math.random() * .003 }; o.sc.add(m); o.clouds.push(m); } }
function animPano(o, dt) { o.plate.material.uniforms.time.value = clock;
  if (o.clouds) for (const m of o.clouds) { m.userData.u = (m.userData.u + m.userData.s * dt) % 1; m.position.copy(panoPos(m.userData.u, m.userData.v, -0.9)); m.lookAt(0, 0, 0); }
  if (o.anim) o.anim(dt); }

{ const pb = scenePano('beach', 'pano_beach', { sway: 1, wobble: 1 }); addClouds(pb); Object.assign(be, pb); S.beach = be; }

// ================= STORY V2: Opas Geschichte · Tri Hita Karana =================
const ho = scene3('home', 1.5, { caustic: 0, wobble: 0 });
const mgv = scene3('mangrove', 1.8, { caustic: 0, wobble: 1, blueOnly: 1 });
const gl = scene3('glow', 1.6, { caustic: 0, wobble: 1.1, blueOnly: 1 });
const kakekS = spr(ho, tex.kakek, 1.75, 0); const wayanS = spr(ho, tex.wayan, 2.3, 0);
place(kakekS, ho, .3, .7, .97); place(wayanS, ho, .7, .76, .97);
{ const d = makeDust(70, [9, 16, 1, 1], [1, .9, .7], 2); ho.sc.add(d); ho.dust = d; }
const _stage = stage;
stage = function (scene, u, v, z) { _stage(scene, u, v, z); ambient(!['beach', 'base', 'boat', 'boatday', 'home', 'glow', 'mangrove'].includes(scene)); };

// ---- narrator: Opa Made
POR.kakek = '<img src="assets/kakek.png" alt="" style="width:190%;margin-top:2px">'; WHO.kakek = 'Opa Ketut';
const PORBG = { wayan: '#FFE9C7', kakek: '#F1DDB8', thalassa: '#BFF3FA', baruna: '#0B3E66' };
POR.baruna = '<svg width="76" height="76" viewBox="0 0 76 76" style="margin-top:0"><defs><radialGradient id="bg1" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#BFF8FF"/><stop offset=".45" stop-color="#2FB4E0"/><stop offset="1" stop-color="#0B3E66"/></radialGradient></defs><circle cx="38" cy="38" r="38" fill="url(#bg1)"/><g fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M14 44c6-8 12-8 18 0s12 8 18 0 8-6 12-3" opacity=".95"/><path d="M18 54c5-5 10-5 15 0s10 5 15 0 7-4 10-2" opacity=".6"/><path d="M38 14v10M30 18l3 7M46 18l-3 7" opacity=".8"/></g></svg>';
WHO.baruna = 'Baruna, Herr des Meeres';
Object.assign(EN, { 'Baruna, Herr des Meeres': 'Baruna, Lord of the Sea' });
const uwfx = document.createElement('div'); uwfx.id = 'uwfx'; phone.appendChild(uwfx);
Object.assign(EN, { 'Opa Ketut': 'Grandpa Ketut' });
let curWho = 'kakek';
speak = function (text, who = 'kakek') {
  if (!text) return; curWho = who; const t = T(text); const segs = splitSeg(t); const M = (VO[LANG] || {});
  voStop(); const tok = voToken;
  voPlay(segs.map((s) => { const k = norm(s); const f = (M[who] && M[who][k]) || (who === 'kakek' && M.thalassa && M.thalassa[k]); return f ? { url: 'assets/vo/' + f } : { text: s }; }), tok);
};
ttsFallback = function (t, done = () => {}) { const lang = LANG === 'en' ? 'en-US' : LANG === 'id' ? 'id-ID' : 'de-DE'; const pitch = curWho === 'wayan' ? 1.25 : curWho === 'kakek' ? .78 : curWho === 'baruna' ? .6 : 1.05; const rate = curWho === 'kakek' ? .9 : curWho === 'baruna' ? .85 : 1;
  if (isNative()) { window.Capacitor.nativePromise('TextToSpeech', 'speak', { text: t, lang, rate, pitch, volume: 1.0, category: 'playback' }).then(done, done); return; }
  try { const s = window.speechSynthesis; if (!s) return done(); const u = new SpeechSynthesisUtterance(t); u.lang = lang; u.rate = rate * .95; u.pitch = pitch; const v = s.getVoices().find((x) => x.lang && x.lang.startsWith(LANG)); if (v) u.voice = v; u.onend = done; u.onerror = done; s.speak(u); setTimeout(done, 400 + t.length * 90); } catch (e) { done(); } };
talk = function (who, txt, fact) { return new Promise((res) => {
  $('#dPor').innerHTML = POR[who]; $('#dPor').style.background = PORBG[who] || '#BFF3FA'; $('#dWho').textContent = T(WHO[who]); $('#dTxt').textContent = T(txt);
  const f = $('#dFact'); f.style.display = fact ? 'block' : 'none'; f.textContent = fact ? T('Wusstest du? ' + fact) : '';
  const uw = who === 'baruna'; if (uw && !phone.classList.contains('uw')) { blip(180, 90, .9, .1); blip(600, 1200, .6, .03); } phone.classList.toggle('uw', uw);
  $('#dlg').classList.remove('on'); void $('#dlg').offsetWidth; $('#dlg').classList.add('on');
  speak(txt + (fact ? ' Wusstest du? ' + fact : ''), who); $('#dSpeak').onclick = (e) => { e.stopPropagation(); speak(txt + (fact ? ' Wusstest du? ' + fact : ''), who); };
  const done = (e) => { e && e.stopPropagation(); $('#dNext').onclick = null; $('#dlg').onclick = null; $('#dlg').classList.remove('on'); phone.classList.remove('uw'); blip(500, 700, .08, .06); voStop(); res(); };
  $('#dNext').onclick = done; setTimeout(() => { $('#dlg').onclick = (e) => { if (e.target.closest('#dSpeak')) return; done(e); }; }, 600);
}); };

// ---- styles for the new parts
const st3 = document.createElement('style'); st3.textContent = `
#thk{position:absolute;top:max(12px,env(safe-area-inset-top));right:12px;z-index:12;display:none;gap:4px;zoom:var(--z,1);pointer-events:none}
#thk.on{display:flex}
#thk .li{width:58px;display:flex;flex-direction:column;align-items:center;gap:3px;color:#fff;font-weight:800;font-size:10px;text-shadow:0 1px 3px rgba(0,0,0,.7)}
#thk .li i{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(11,31,58,.85) 56%,transparent 59%),conic-gradient(var(--c) calc(var(--g,0)*1turn),rgba(255,255,255,.28) 0);box-shadow:0 0 calc(var(--g,0)*24px) calc(var(--g,0)*4px) var(--c);transition:box-shadow .8s}
#thk .li svg{opacity:calc(.35 + var(--g,0)*.65)}
#thk .li.pulse i{animation:lip .7s 3}
@keyframes lip{50%{transform:scale(1.35)}}
#oldph{position:absolute;left:50%;top:calc(max(14px,env(safe-area-inset-top)) + 64px);width:290px;margin-left:-145px;z-index:59;background:#fbf6ea;padding:7px 7px 30px;border-radius:3px;box-shadow:0 16px 36px rgba(0,0,0,.5);transform:rotate(-3deg) translateY(-40px) scale(.85);opacity:0;transition:all .7s cubic-bezier(.2,1.4,.4,1);pointer-events:none;zoom:var(--z,1)}
#oldph.on{opacity:1;transform:rotate(-3deg)}
#oldph img{width:100%;display:block}
#oldph span{position:absolute;bottom:7px;left:0;right:0;text-align:center;font:italic 700 14px Georgia,serif;color:#6b5a3a}
#uwfx{position:absolute;inset:0;z-index:58;pointer-events:none;opacity:0;transition:opacity 1.2s;background:radial-gradient(ellipse at 50% 40%,rgba(120,230,255,.0) 30%,rgba(4,40,90,.55) 75%,rgba(2,20,50,.85) 100%)}
#uwfx::after{content:'';position:absolute;inset:0;background:repeating-radial-gradient(circle at 50% 30%,rgba(190,250,255,.10) 0 2px,transparent 3px 26px);animation:uwr 6s linear infinite;mix-blend-mode:screen}
@keyframes uwr{to{transform:scale(1.25);opacity:.4}}
.uw #uwfx{opacity:1}
.uw #dlg .dbox{background:#E6FAFF;box-shadow:0 0 40px rgba(127,230,242,.7),0 12px 30px rgba(11,31,58,.4)}
.uw #dlg .who b{background:#7FE6F2}
.uw #dlg .por{box-shadow:0 0 22px 6px rgba(127,230,242,.8)}
.ehint{position:absolute;width:46px;height:46px;border-radius:50%;background:var(--sun);display:none;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.35);pointer-events:none;animation:ehp 1s infinite}
@keyframes ehp{50%{box-shadow:0 0 0 10px rgba(255,216,74,.35)}}
#yay{position:absolute;inset:0;z-index:61;display:none;align-items:center;justify-content:center;pointer-events:none;zoom:var(--z,1)}
#yay.on{display:flex}
#yay b{font-family:'Baloo 2';font-weight:800;font-size:44px;line-height:1.05;color:#fff;text-align:center;padding:0 20px;text-shadow:0 4px 0 #C9643F,0 8px 24px rgba(0,0,0,.5);animation:yb .9s cubic-bezier(.2,1.6,.4,1)}
#yay i{position:absolute;width:12px;height:12px;border-radius:3px;left:50%;top:45%;animation:yc 1.4s ease-out forwards}
@keyframes yb{0%{transform:scale(.2)}100%{transform:scale(1)}}
@keyframes yc{to{transform:translate(var(--x),var(--y)) rotate(540deg);opacity:0}}
#glowcv{position:absolute;inset:0;width:100%;height:100%;z-index:4;pointer-events:none;mix-blend-mode:screen}
.fdg{position:absolute;left:12px;top:150px;bottom:170px;width:46px;border-radius:23px;background:rgba(11,31,58,.6);color:#fff;font-weight:800;font-size:11px}
.fdg b{position:absolute;left:0;right:0;text-align:center;transform:translateY(-50%)}
.fdg .me{position:absolute;left:50%;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;background:var(--sun);border:3px solid #fff;overflow:hidden;transition:top .1s linear}
.fdg .me img{width:100%;margin-top:2px;position:static;transform:none}
.fdair{position:absolute;right:14px;top:150px;width:70px;height:70px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#fff;font-weight:800;font-size:11px;background:radial-gradient(circle,rgba(11,31,58,.85) 60%,transparent 62%),conic-gradient(#7FE6F2 var(--a,100%),rgba(255,255,255,.2) 0)}
.fdair b{font-family:'Baloo 2';font-size:20px;line-height:1}
.fdhold{position:absolute;left:50%;bottom:86px;width:132px;height:132px;margin-left:-66px;border-radius:50%;border:0;background:var(--coral);color:var(--ink);font-family:'Baloo 2';font-weight:800;font-size:19px;line-height:1.05;box-shadow:0 8px 0 #C9643F,0 14px 26px rgba(0,0,0,.35);touch-action:none}
.fdhold.on{transform:translateY(6px);box-shadow:0 2px 0 #C9643F}
.fdear{position:absolute;right:16px;bottom:250px;padding:12px 16px;border-radius:22px;border:0;background:var(--sun);color:var(--ink);font-weight:800;font-size:15px;display:none;animation:lip 1s infinite}
.fdbr{position:absolute;left:50%;top:44%;width:150px;height:150px;margin:-75px 0 0 -75px;border-radius:50%;border:4px solid rgba(255,255,255,.85);background:rgba(127,230,242,.25);display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Baloo 2';font-weight:800;font-size:20px;text-shadow:0 2px 6px rgba(0,0,0,.5)}
`; document.head.appendChild(st3);

// ---- three lights (Tri Hita Karana)
const ICL = {
  natur: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9BF0AE" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/></svg>',
  menschen: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFC98F" stroke-width="2.2" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c0-4 2.5-6 5-6s5 2 5 6M11 20c0-4 2.5-6 5-6s5 2 5 6"/></svg>',
  gott: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFE68F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z"/></svg>' };
const LIGHTS = [['natur', 'Natur', '#5FE07A'], ['menschen', 'Menschen', '#FFA65A'], ['gott', 'Göttliches', '#FFD84A']];
const LMSG = { natur: 'Das Licht der Natur leuchtet heller!', menschen: 'Das Licht der Menschen leuchtet heller!', gott: 'Das Licht des Göttlichen leuchtet heller!' };
const thk = document.createElement('div'); thk.id = 'thk';
thk.innerHTML = LIGHTS.map(([k, l, c]) => `<div class="li" data-k="${k}" style="--c:${c}"><i>${ICL[k]}</i><span>${l}</span></div>`).join('');
phone.appendChild(thk);
st.lights = { natur: 0, menschen: 0, gott: 0 };
const LIGHT_PLAN = [['gott'], ['natur'], ['natur'], ['gott'], ['menschen'], ['menschen'], ['natur'], ['gott', 'menschen']];
function updLights() { thk.querySelectorAll('.li').forEach((e) => e.style.setProperty('--g', st.lights[e.dataset.k] / 3)); }
function lightsBase(n) { st.lights = { natur: 0, menschen: 0, gott: 0 }; for (let i = 0; i < n && i < LIGHT_PLAN.length; i++) LIGHT_PLAN[i].forEach((k) => st.lights[k]++); updLights(); }
function pulseLight(k) { const e = thk.querySelector(`[data-k="${k}"]`); e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse'); }
async function lightUp(k) { st.lights[k] = Math.min(3, st.lights[k] + 1); thk.classList.add('on'); updLights(); pulseLight(k); chime(); buzz(40); toast(LMSG[k], false); await wait(1500); }
setInterval(() => { thk.classList.toggle('on', !!st.inStory && st.screen !== 'mission' && !$('#mg').classList.contains('on') && !$('#chap').classList.contains('on') && !$('#cert').classList.contains('on')); }, 200);

// ---- old photos
const oph = document.createElement('div'); oph.id = 'oldph'; oph.innerHTML = '<img alt=""><span></span>'; phone.appendChild(oph);
function showPhoto(f, cap) { oph.querySelector('img').src = 'assets/' + f + '.jpg'; oph.querySelector('span').textContent = cap; oph.classList.remove('on'); void oph.offsetWidth; oph.classList.add('on'); blip(900, 500, .08, .05); }
function hidePhoto() { oph.classList.remove('on'); }

// ---- glowing plankton (canvas overlay)
const WATER = [[.5, .37], [1, .37], [1, 1], [.64, 1], [.7, .88], [.75, .75], [.78, .6], [.8, .5], [.82, .44], [.5, .44]];
const SHORE = [[.82, .44], [.8, .5], [.78, .6], [.75, .75], [.7, .88], [.64, 1]];
function inPoly(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; }
const GLW = { on: false, cv: null, c: null, sp: [], auto: 0, dot: null };
{ const d = document.createElement('canvas'); d.width = d.height = 64; const c = d.getContext('2d'); const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(235,255,255,1)'); g.addColorStop(.25, 'rgba(90,235,255,.9)'); g.addColorStop(.6, 'rgba(20,140,255,.35)'); g.addColorStop(1, 'rgba(0,60,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); GLW.dot = d; }
function glowStart() { if (GLW.on) return; GLW.on = true; GLW.cv = document.createElement('canvas'); GLW.cv.id = 'glowcv'; phone.appendChild(GLW.cv); GLW.c = GLW.cv.getContext('2d'); GLW.sp = []; GLW.auto = 0; }
function glowStop() { GLW.on = false; if (GLW.cv) GLW.cv.remove(); GLW.cv = null; GLW.sp = []; GLW.auto = 0; }
function glowAt(x, y, n = 1, spread = 10) { for (let i = 0; i < n; i++) GLW.sp.push({ x: x + (Math.random() - .5) * spread * 2, y: y + (Math.random() - .5) * spread, a: 0, l: .7 + Math.random() * 1.1, r: (9 + Math.random() * 18) * Z, vx: (Math.random() - .5) * 8, vy: (Math.random() - .5) * 4 }); }
function glowUV(u, v, n = 1, spread = 10) { const [x, y] = proj(gl, u, v, .45); glowAt(x * Z, y * Z, n, spread * Z); }
function randWater() { for (let k = 0; k < 20; k++) { const p = [-.1 + Math.random() * .4, .51 + Math.random() * .49]; if (inPoly(p, WATER)) return p; } return [.1, .7]; }
function randShore() { const i = Math.floor(Math.random() * (SHORE.length - 1)); const t = Math.random(); const a = SHORE[i], b = SHORE[i + 1]; return [a[0] + (b[0] - a[0]) * t + .005 + Math.random() * .03, a[1] + (b[1] - a[1]) * t]; }
function glowFrame(dt) {
  if (!GLW.on || st.scene !== 'glow') { if (GLW.cv) GLW.c.clearRect(0, 0, GLW.cv.width, GLW.cv.height); return; }
  const dpr = Math.min(2, window.devicePixelRatio || 1); if (GLW.cv.width !== Math.round(W * dpr)) { GLW.cv.width = Math.round(W * dpr); GLW.cv.height = Math.round(H * dpr); }
  if (GLW.auto > 0) { const k = GLW.auto * 110 * dt; for (let i = 0; i < k; i++) { const p = Math.random() < .6 ? randShore() : randWater(); glowUV(p[0], p[1], 1, 6); } }
  const c = GLW.c; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H); c.globalCompositeOperation = 'lighter';
  GLW.sp = GLW.sp.filter((s) => (s.a += dt) < s.l); if (GLW.sp.length > 900) GLW.sp.splice(0, GLW.sp.length - 900);
  for (const s of GLW.sp) { const al = Math.sin(Math.PI * s.a / s.l); s.x += s.vx * dt; s.y += s.vy * dt; c.globalAlpha = al; const r = s.r * (.7 + .5 * al); c.drawImage(GLW.dot, s.x - r, s.y - r, r * 2, r * 2); }
  c.globalAlpha = 1;
}
const _sf2 = storyFrame; storyFrame = function (dt) { _sf2(dt); glowFrame(dt); };

// ================= NEW MINI-GAMES =================
// A) Riff-Putzete: Müll + Netze einsammeln, Fische kommen zurück
const TRASH = [['bag', .17, .74], ['can', .5, .8], ['bottle', .83, .76], ['cup', .45, .6], ['flipflop', .6, .65], ['bottle', .3, .84]];
function gameReef() { return new Promise((res) => { window.__mgDone = () => { mgTick = null; mgClose(); school.forEach((f) => f.visible = true); res(true); };
  stage('explore', .5, .6, .9); const U = ex.plate.material.uniforms; U.bleach.value = 1; U.patches.value.forEach((p) => p.w = 0);
  school.forEach((f) => f.visible = false); turtle.visible = false; st.lookBig = 1.8;
  mgOpen('MINISPIEL · RIFF-PUTZETE', 'Sammle Müll und Netze ein!', ICO_TILT + '<span>' + (sens.has ? 'Handy bewegen zum Umsehen, dann antippen' : 'Wischen zum Umsehen, dann antippen') + '</span>'); if (sens.has) calib();
  const items = [...PATCH.map((p) => ['net', p[0], p[1]]), ...TRASH]; let got = 0;
  const els = items.map(([k], i) => { const im = new Image(); im.src = 'assets/it_' + k + '.png'; im.style.width = (k === 'net' ? 110 : 60) + 'px'; im.style.opacity = .95; lay.appendChild(im);
    im.onclick = (e) => { e.stopPropagation(); if (im.dataset.done) return; im.dataset.done = 1; got++; mgBar(got / items.length); blip(400, 800, .12); buzz(20);
      im.style.transition = 'all .8s'; im.style.transform = 'translate(-50%,-240%) scale(.5) rotate(25deg)'; im.style.opacity = 0;
      const n = Math.round(school.length * got / items.length); school.forEach((f, j) => f.visible = j < n);
      if (got === 3) toast('Die ersten Fische kommen!');
      if (got === items.length) { turtle.visible = true; mgTick = null; setTimeout(() => { mgClose(); chime(); res(); }, 900); } };
    return im; });
  mgTick = () => { const pts = []; els.forEach((im, i) => { if (im.dataset.done) return; const [x, y] = proj(ex, items[i][1], items[i][2], .7); im.style.left = x + 'px'; im.style.top = (y + Math.sin(clock * 1.5 + i) * 2) + 'px'; pts.push([x, y]); }); edgeHints(pts); };
}).finally(() => { st.lookBig = 0; }); }

// B) Freediving: ruhig atmen, abtauchen, Druckausgleich, Luft im Blick
function gameFreedive() { return new Promise((res) => { let ui;
  window.__mgDone = () => { mgTick = null; mgClose(); res(true); };
  stage('explore', .5, .3, 1.05); ex.plate.material.uniforms.bleach.value = 0; school.forEach((f) => f.visible = true); turtle.visible = true;
  mgOpen('MINISPIEL · FREEDIVING', 'Ganz ruhig atmen …', '');
  ui = document.createElement('div'); ui.innerHTML = `<div class="fdbr">Einatmen</div><div class="fdg" style="display:none">${[0, 1, 2, 3, 4, 5].map((m) => `<b style="top:${6 + m * 17.6}%">${m} m</b>`).join('')}<div class="me"><img src="assets/wayan.png" alt=""></div></div><div class="fdair" style="display:none"><b>100</b>Luft</div><button class="fdhold" style="display:none">Halten zum Abtauchen</button><button class="fdear">Druckausgleich!</button>`;
  lay.appendChild(ui); const br = ui.querySelector('.fdbr'), g = ui.querySelector('.fdg'), me = ui.querySelector('.me'), air = ui.querySelector('.fdair'), hold = ui.querySelector('.fdhold'), ear = ui.querySelector('.fdear');
  let phase = 0, bt = 0, depth = 0, a = 1, holding = false, block = 0, eq = {}, forced = false, done = false;
  const down = (e) => { e.preventDefault(); e.stopPropagation(); holding = true; hold.classList.add('on'); }, up = () => { holding = false; hold.classList.remove('on'); };
  hold.addEventListener('pointerdown', down); hold.addEventListener('pointerup', up); hold.addEventListener('pointerleave', up); hold.addEventListener('pointercancel', up);
  ear.onclick = (e) => { e.stopPropagation(); eq[block] = 1; block = 0; ear.style.display = 'none'; blip(300, 900, .2, .1); buzz(30); const p = toWorld(ex, .5, .45, .9); camBubbles.userData.emit(p.x, p.y, p.z, 10, .3, clock); };
  mgTick = (dt) => {
    if (phase === 0) { bt += dt; const cyc = bt % 6, inh = cyc < 3; const s = inh ? .7 + .5 * (cyc / 3) : 1.2 - .5 * ((cyc - 3) / 3); br.style.transform = `scale(${s})`; br.textContent = T(inh ? 'Einatmen' : 'Ausatmen');
      if (bt >= 12) { phase = 1; br.remove(); g.style.display = air.style.display = hold.style.display = ''; $('#mgTxt').textContent = T('Knopf halten = tauchen. Pass auf deine Luft auf!'); speak($('#mgTxt').textContent); } return; }
    if (done) return;
    if (block) depth = Math.max(block - .05, depth - dt * .1);
    else if (holding && !forced && a > 0) depth += dt * .75; else depth -= dt * 1.1;
    depth = clamp(depth, 0, 5);
    for (const m of [2, 4]) if (!block && !eq[m] && depth >= m) { block = m; depth = m; ear.style.display = 'block'; toast('Druck auf den Ohren! Tippe auf «Druckausgleich».'); }
    if (depth > .2) a -= dt / (block ? 40 : age().air); else { a = Math.min(1, a + dt / 2.5); if (forced && a > .9) { forced = false; toast('Wieder Luft! Nochmal!'); } }
    if (a <= 0 && !forced) { forced = true; a = 0; block = 0; ear.style.display = 'none'; toast('Luft knapp! Schnell nach oben.'); }
    air.style.setProperty('--a', (a * 100) + '%'); air.querySelector('b').textContent = Math.round(a * 100); me.style.top = (6 + depth * 17.6) + '%';
    setView(.5, .3 + depth / 5 * .32, 1.05 - depth / 5 * .38); lay.style.background = `rgba(0,30,80,${depth / 5 * .22})`; mgBar(depth / 5);
    if (holding && Math.random() < dt * 3) { const p = toWorld(ex, .5, .4, .9); camBubbles.userData.emit(p.x, p.y, p.z, 2, .2, clock); }
    if (depth >= 5) { done = true; chime(); buzz(60); setTimeout(() => { lay.style.background = ''; mgClose(); res(); }, 700); }
  };
}).finally(() => { lay.style.background = ''; }); }

// C) Mangroven pflanzen
const MSPOT = [[.1, .48], [.25, .47], [.42, .48], [.57, .46], [.69, .43]];
// planted mangroves stay in the 3D scene (not only as overlay pictures)
const mtreeTex = await new Promise((r) => loader.load('assets/it_mtree.png', (t) => { t.colorSpace = THREE.NoColorSpace; r(t); }, undefined, () => r(null)));
const mangTrees = [];
function plantMangroves(spots) { if (!mtreeTex) return; mangTrees.forEach((m) => m.parent && m.parent.remove(m)); mangTrees.length = 0;
  spots.forEach((s) => { const m = makeSprite(mtreeTex, 3, 1, { amp: .06, speed: 1.4, fogColor: [0, 0, 0] }); m.geometry.translate(0, m.geometry.parameters.height / 2, 0); mgv.sc.add(m); place(m, mgv, s.u, s.v, .7); mangTrees.push(m); });
  [...lay.querySelectorAll('img')].forEach((im) => { if (/it_mtree/.test(im.src)) im.style.display = 'none'; }); }
function gameMangrove() { mangTrees.forEach((m) => m.parent && m.parent.remove(m)); mangTrees.length = 0; return new Promise((res) => { window.__mgDone = () => { mgTick = null; mgClose(); res(true); };
  stage('mangrove', .86, .62, 1); st.lookBig = 1.5;
  mgOpen('MINISPIEL · MANGROVEN', 'Pflanze 5 Mangroven! Tippe auf die Ringe.', ICO_TILT + '<span>' + (sens.has ? 'Handy bewegen zum Umsehen' : 'Wischen zum Umsehen') + '</span>'); if (sens.has) calib();
  let n = 0, phase = 1; const fish = [];
  const spots = MSPOT.map(([u, v]) => { const d = document.createElement('div'); d.className = 'ptarget'; d.style.pointerEvents = 'auto'; d.innerHTML = '<i></i>'; lay.appendChild(d);
    const im = new Image(); im.src = 'assets/it_seed.png'; im.style.cssText = 'width:34px;transform:translate(-50%,-100%) scale(0);transform-origin:50% 100%;transition:transform .7s cubic-bezier(.2,1.6,.4,1),width 2s'; lay.appendChild(im);
    d.onclick = (e) => { e.stopPropagation(); if (d.dataset.done) return; d.dataset.done = 1; d.style.display = 'none'; im.style.transform = 'translate(-50%,-100%) scale(1)'; n++; mgBar(n / 5 * .6); blip(500, 900, .12); buzz(20); if (n === 5) setTimeout(grow, 900); };
    return { d, im, u, v }; });
  async function grow() { phase = 2; $('#mgTxt').textContent = T('Schau, sie wachsen!'); speak($('#mgTxt').textContent);
    for (const s of spots) { s.im.src = 'assets/it_mtree.png'; s.im.style.width = '86px'; await wait(300); }
    await wait(1500); mgBar(.8); phase = 3; setView(.8, .58, 1); $('#mgTxt').textContent = T('Und unten wohnen Babyfische!'); speak($('#mgTxt').textContent);
    for (let i = 0; i < 14; i++) { const f = new Image(); f.src = 'assets/fusilier.png'; f.style.width = (30 + Math.random() * 14) + 'px'; f.style.opacity = 0; f.style.transition = 'opacity 1s'; lay.appendChild(f); f.u = .74 + Math.random() * .1; f.v = .55 + Math.random() * .08; f.ph = Math.random() * 6; f.sp = .5 + Math.random() * .6; fish.push(f); setTimeout(() => f.style.opacity = .95, 100 + i * 120); }
    await wait(4200); mgBar(1); chime(); mgTick = null; plantMangroves(spots); setTimeout(() => { mgClose(); res(); }, 600); }
  mgTick = () => {
    const pts = []; spots.forEach((s) => { const [x, y] = proj(mgv, s.u, s.v, .7); s.d.style.left = x + 'px'; s.d.style.top = (y - 20) + 'px'; s.im.style.left = x + 'px'; s.im.style.top = y + 'px'; if (!s.d.dataset.done) pts.push([x, y - 20]); }); edgeHints(phase === 1 ? pts : []);
    fish.forEach((f) => { const du = Math.sin(clock * f.sp + f.ph) * .06; const [x, y] = proj(mgv, f.u + du, f.v + Math.sin(clock * 2 + f.ph) * .005, .6); f.style.left = x + 'px'; f.style.top = y + 'px'; f.style.transform = `translate(-50%,-50%) scaleX(${Math.cos(clock * f.sp + f.ph) > 0 ? -1 : 1})`; });
  };
}).finally(() => { st.lookBig = 0; }); }

// D) Das leuchtende Meer: Bewegung lässt Plankton leuchten
function gameGlow() { return new Promise((res) => { window.__mgDone = () => { mgTick = null; mgClose(); GLW.auto = 1; res(true); };
  stage('glow', .14, .6, 1); glowStart();
  mgOpen('MINISPIEL · DAS LEUCHTENDE MEER', sens.has ? 'Beweg das Handy. Das Plankton leuchtet!' : 'Wisch übers Wasser. Das Plankton leuchtet!', ICO_TILT + '<span>' + (sens.has ? 'Handy bewegen oder übers Wasser wischen' : 'Übers Wasser wischen') + '</span>');
  let p = 0, last = null, done = false;
  const toUV = (e) => { const r = phone.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const isWater = (x, y) => inPoly([x, y], WATER.map(([u, v]) => { const q = proj(gl, u, v, .45); return [q[0] * Z, q[1] * Z]; }));
  const mv = (e) => { if (done) return; const [x, y] = toUV(e); if (last) { const d = Math.hypot(x - last[0], y - last[1]); if (isWater(x, y)) { glowAt(x, y, Math.min(14, 2 + d / 4), 18); p += d / 2600 * age().glow; } } last = [x, y]; };
  const dn = (e) => { last = toUV(e); if (isWater(last[0], last[1])) { glowAt(last[0], last[1], 14, 22); p += .015; blip(900, 1400, .08, .04); } };
  lay.addEventListener('pointerdown', dn); lay.addEventListener('pointermove', mv); lay.addEventListener('pointerup', () => last = null);
  mgTick = (dt) => {
    if (done) return;
    if (sens.has && sens.motion) { const m = clamp((sens.rate - 12) / 110, 0, 1.6); if (m > 0) { const k = m * 70 * dt; for (let i = 0; i < k; i++) { const q = Math.random() < .55 ? randShore() : randWater(); glowUV(q[0], q[1], 3, 14); } p += m * dt / 9 * age().glow; if (Math.random() < m * dt * 6) blip(1000 + Math.random() * 600, 1300, .06, .03); } }
    GLW.auto = p * .5; mgBar(p);
    if (p >= 1) { done = true; GLW.auto = 1.6; chime(); buzz(80); setTimeout(() => { mgClose(); GLW.auto = 1; res(); }, 1800); }
  };
}); }

// ================= 360°: story locations become panoramas =================
function toPano(o, file, opts = {}) { const p = scenePano(o.name, file, opts);
  for (const ch of [...o.sc.children]) if (ch !== o.plate && ch !== camera) p.sc.add(ch);
  Object.assign(o, { sc: p.sc, plate: p.plate, pano: true, rays: opts.rays ?? o.rays }); S[o.name] = o; return o; }
toPano(ho, 'pano_home', { wobble: 0, sway: .5 }); place(kakekS, ho, .465, .63, .97); place(wayanS, ho, .535, .66, .97);
toPano(ex, 'pano_reef', { wobble: .5, caustic: .8, rays: .1 });
toPano(an, 'pano_anemone', { wobble: .5, caustic: .6, rays: .08 });
toPano(mt, 'pano_manta', { wobble: .5, caustic: 1.2, rays: .14 });
toPano(ni, 'pano_nightreef', { wobble: .4, caustic: .15, rays: .05 });
toPano(bo, 'pano_boatnight', { wobble: 1.2 });
toPano(mgv, 'pano_mangrove', { wobble: 1, sway: 1 }); addClouds(mgv, 6);
toPano(bs, 'pano_farm', { wobble: .8, sway: .6 });
const bday = scenePano('boatday', 'pano_boatday', { wobble: 1.2 }); addClouds(bday, 8);
toPano(gl, 'pano_beach', { wobble: 1.4, sway: .6 }); gl.plate.material.uniforms.night.value = .82;
{ const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(.35, 'rgba(255,255,230,.95)'); gr.addColorStop(.45, 'rgba(200,220,255,.35)'); gr.addColorStop(1, 'rgba(160,190,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.sc.add(moon); gl.moon = moon; }
gl.anim = () => { const t = clock * .004; place(gl.moon, gl, .1 + t % .2, .22 - Math.sin(t * 6) * .02, -1.2); };
// positions on the new panoramas
PATCH.splice(0, 4, [.12, .68], [.38, .55], [.58, .55], [.82, .55]);
TRASH.splice(0, TRASH.length, ['bag', .22, .74], ['can', .45, .76], ['bottle', .55, .8], ['cup', .7, .72], ['flipflop', .95, .74], ['bottle', .32, .7]);
MSPOT.splice(0, 5, [.875, .672], [.92, .636], [.946, .606], [.835, .69], [.86, .742]);
WATER.splice(0, WATER.length, [-.1, .51], [.3, .51], [.3, .6], [.22, .75], [.12, .9], [.05, 1], [-.1, 1]);
SHORE.splice(0, SHORE.length, [.3, .55], [.27, .63], [.2, .77], [.12, .9], [.05, 1]);

// ================= HERO (Wayan / Ayu), MASK VIEW, TITLE =================
const HERO = { wayan: { name: 'Wayan', img: 'assets/wayan.png' }, ayu: { name: 'Ayu', img: 'assets/ayu.png' } };
st.hero = (() => { try { return localStorage.getItem('seaju_hero') || ''; } catch (e) { return ''; } })();
function hero() { return HERO[st.hero] || HERO.wayan; }
function heroize(t) { return st.hero === 'ayu' ? String(t).replace(/Wayan/g, 'Ayu') : t; }
function applyHero() { const h = hero(); POR.wayan = `<img src="${h.img}" alt="">`; WHO.wayan = h.name;
  try { localStorage.setItem('seaju_hero', st.hero); } catch (e) {}
  const t = st.hero === 'ayu' ? tex.ayu : tex.wayan; wayanS.material.uniforms.map.value = t; wayanS.scale.x = (t.image.width / t.image.height) / (tex.wayan.image.width / tex.wayan.image.height);
  document.querySelectorAll('img[src="assets/wayan.png"],img[src="assets/ayu.png"]').forEach((i) => { if (!i.closest('#heroPick')) i.src = h.img; }); }
const _T = T; T = function (s) { return heroize(_T(s)); };
const _speakH = speak; speak = function (text, who) { return _speakH(text, who === 'wayan' && st.hero === 'ayu' ? 'ayu' : who); };
const _ttsF = ttsFallback; ttsFallback = function (t, done) { if (curWho === 'ayu') curWho = 'wayan'; return _ttsF(t, done); };
// diving mask: underwater the child looks through a mask
const UW = ['explore', 'jetty', 'fan', 'kri', 'anemone', 'manta', 'night'];
const maskEl = document.createElement('div'); maskEl.id = 'mask';
maskEl.innerHTML = '<svg viewBox="0 0 100 178" preserveAspectRatio="none"><defs><radialGradient id="mk-g" cx="50%" cy="45%" r="60%"><stop offset=".75" stop-color="#06152b" stop-opacity="0"/><stop offset="1" stop-color="#06152b" stop-opacity=".55"/></radialGradient></defs><path fill-rule="evenodd" fill="#071a33" fill-opacity=".78" d="M-5-5H105V183H-5Z M8 40 C8 22 22 16 38 18 C44 19 47 24 50 24 C53 24 56 19 62 18 C78 16 92 22 92 40 L92 150 C92 164 80 170 64 168 C56 167 54 160 50 160 C46 160 44 167 36 168 C20 170 8 164 8 150 Z"/><rect x="0" y="0" width="100" height="178" fill="url(#mk-g)"/><path d="M14 44 C16 30 26 25 36 25" stroke="#fff" stroke-opacity=".35" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg><i></i><i></i><i></i>';
phone.appendChild(maskEl);
const st4 = document.createElement('style'); st4.textContent = `
#mask{position:absolute;inset:0;z-index:3;pointer-events:none;opacity:0;transition:opacity .8s}
#mask.on{opacity:1}
#mask svg{position:absolute;inset:0;width:100%;height:100%}
#mask i{position:absolute;bottom:-20px;width:10px;height:10px;border-radius:50%;border:1.5px solid rgba(220,250,255,.8);animation:mkb 5s linear infinite}
#mask i:nth-of-type(1){left:12%;animation-delay:0s}#mask i:nth-of-type(2){left:86%;animation-delay:1.7s;width:7px;height:7px}#mask i:nth-of-type(3){left:20%;animation-delay:3.3s;width:6px;height:6px}
@keyframes mkb{0%{transform:translateY(0)}100%{transform:translateY(-110vh) translateX(10px)}}
#heroPick{display:flex;gap:14px;justify-content:center;margin:6px 0 4px}
#heroPick button{width:132px;height:178px;border-radius:24px;border:4px solid transparent;background:rgba(255,255,255,.18);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:6px 0 8px;color:#fff;font-family:'Baloo 2';font-weight:800;font-size:20px;overflow:hidden}
#heroPick button img{height:132px;width:auto;object-fit:contain;position:static}
#heroPick button.sel{border-color:var(--sun);background:rgba(255,216,74,.25)}
#chapPick{position:absolute;inset:0;z-index:300;background:rgba(6,21,43,.92);display:none;flex-direction:column;align-items:center;padding:calc(max(18px,env(safe-area-inset-top)) + 10px) 18px 18px;gap:10px;overflow:auto;zoom:var(--z,1)}
#chapPick.on{display:flex}
#chapPick h2{color:#fff;font-family:'Baloo 2';margin:0 0 6px}
#chapPick button{width:100%;max-width:340px;min-height:58px;border-radius:18px;border:0;background:#fff;color:var(--ink);font-weight:800;font-size:16px;text-align:left;padding:10px 16px}
#chapPick button[disabled]{opacity:.35}
#chapPick button b{display:block;font-size:12px;color:#C9643F;letter-spacing:.06em}
`; document.head.appendChild(st4);
setInterval(() => { maskEl.classList.toggle('on', UW.includes(st.scene) && canvas.style.display !== 'none' && !arOn && ['explore', 'story-stage', 'mission'].includes(st.screen)); }, 200);
// title: pick hero, continue / restart / chapter list
{ const ti = $('#title');
  if (ti) { const img = ti.querySelector('img.w'); const pick = document.createElement('div'); pick.id = 'heroPick';
    pick.innerHTML = `<button data-h="wayan"><img src="assets/wayan.png" alt="">Wayan</button><button data-h="ayu"><img src="assets/ayu.png" alt="">Ayu</button>`;
    if (img) img.replaceWith(pick); else ti.insertBefore(pick, $('#tPlay'));
    const mark = () => pick.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.h === st.hero));
    pick.querySelectorAll('button').forEach((b) => b.onclick = () => { st.hero = b.dataset.h; applyHero(); mark(); blip(600, 900, .1); speak(b.dataset.h === 'ayu' ? 'Ich bin Ayu!' : 'Ich bin Wayan!', 'wayan'); });
    if (!st.hero) st.hero = 'wayan'; mark();
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap';
    row.innerHTML = '<button class="ghost" id="tNew">Neu starten</button><button class="ghost" id="tChap">Kapitel wählen</button>';
    $('#tSkip').after(row);
    $('#tNew').onclick = () => { audioInit(); st.chapter = 0; save(); $('#title').remove(); if (sens.has) calib(); transition(() => playChapter(0)); };
    $('#tChap').onclick = () => { audioInit(); openChapPick(); }; }
  const cp = document.createElement('div'); cp.id = 'chapPick'; phone.appendChild(cp); }
function openChapPick() { const cp = $('#chapPick');
  cp.innerHTML = '<h2>' + T('Kapitel wählen') + '</h2>' + CHAPTERS.map((c, i) => `<button data-i="${i}" ${i > st.chapter ? 'disabled' : ''}><b>${i === 0 ? 'PROLOG' : (LANG === 'en' ? 'CHAPTER ' : LANG === 'id' ? 'BAB ' : 'KAPITEL ') + i}</b>${T(c.t)}</button>`).join('') + `<button data-i="x" style="background:transparent;color:#fff;text-align:center">${T('Zurück')}</button>`;
  cp.classList.add('on');
  cp.querySelectorAll('button').forEach((b) => b.onclick = () => { cp.classList.remove('on'); if (b.dataset.i === 'x') return; const n = +b.dataset.i; $('#title') && $('#title').remove(); if (sens.has) calib(); transition(() => playChapter(n)); }); }
applyHero();
Object.assign(EN, { 'Neu starten': 'Start over', 'Kapitel wählen': 'Choose chapter', 'Zurück': 'Back', 'Ich bin Ayu!': "I'm Ayu!", 'Ich bin Wayan!': "I'm Wayan!" });

// ================= E3: LEVEL REBUILD =================
const st5 = document.createElement('style'); st5.textContent = `
.paddle{position:absolute;bottom:96px;width:120px;height:120px;border-radius:50%;border:0;background:var(--sun);color:var(--ink);font-family:'Baloo 2';font-weight:800;font-size:18px;box-shadow:0 8px 0 #C99A1F,0 14px 26px rgba(0,0,0,.35);touch-action:none}
.paddle.on{transform:translateY(6px);box-shadow:0 2px 0 #C99A1F}
.paddle.dim{background:#E8E1C8;box-shadow:0 8px 0 #B9B3A0,0 14px 26px rgba(0,0,0,.25);color:#8A8370}
.paddle.next{animation:pnext .7s infinite;outline:5px solid #fff}
@keyframes pnext{50%{transform:scale(1.1)}}
.paddle.wrong{background:#FF8A5B;animation:pwrong .3s}
@keyframes pwrong{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.balbar{position:absolute;left:50%;top:150px;width:220px;height:16px;margin-left:-110px;border-radius:8px;background:rgba(255,255,255,.35)}
.balbar i{position:absolute;top:-6px;width:28px;height:28px;margin-left:-14px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.4)}
.balbar b{position:absolute;left:35%;right:35%;top:0;bottom:0;border-radius:8px;background:rgba(95,224,122,.7)}
#wonder{position:absolute;inset:0;z-index:5;pointer-events:none;overflow:hidden}
#wonder i{position:absolute;bottom:-20px;width:9px;height:9px;border-radius:50%;background:radial-gradient(circle,#fff 0,#FFC2D4 40%,rgba(255,140,170,0) 70%);animation:wup linear forwards}
@keyframes wup{0%{transform:translate(0,0)}50%{transform:translate(18px,-55vh)}100%{transform:translate(-12px,-115vh);opacity:.2}}
#wave{position:absolute;left:-40%;right:-40%;bottom:-30%;height:45%;z-index:5;pointer-events:none;background:radial-gradient(ellipse at 50% 0%,rgba(255,255,255,.95) 0,rgba(200,240,255,.7) 30%,rgba(120,200,240,0) 70%);transform:translateX(-100%);animation:wv 2.4s ease-in-out forwards}
@keyframes wv{0%{transform:translateX(-100%) translateY(20%)}50%{transform:translateX(0) translateY(-10%)}100%{transform:translateX(100%) translateY(20%);opacity:0}}
.farmTank{position:absolute;width:118px;height:118px;margin:-59px 0 0 -59px;border-radius:22px;border:3px solid rgba(255,255,255,.85);background:rgba(20,120,170,.35);display:flex;align-items:flex-end;justify-content:center;pointer-events:auto}
.farmTank svg{margin-bottom:6px;transition:transform .8s}
.farmTank .alg{position:absolute;width:26px;height:26px;border-radius:50%;background:#6DA34D;box-shadow:inset -3px -3px 0 #4C7D33}
.farmTank em{position:absolute;top:-30px;left:50%;transform:translateX(-50%);white-space:nowrap;text-align:center;font-style:normal;font-weight:800;font-size:15px;color:#0B1F3A;background:rgba(255,255,255,.92);border-radius:12px;padding:2px 9px}
`; document.head.appendChild(st5);
// ---- hero diver at the manta point (instead of the generic kneeling diver)
kneel.material.uniforms.opacity.value = 0;
const heroDiver = spr(mt, tex.wdiver, 2.8, 3, { amp: .05, speed: 3.5 });
mt.anim = () => { heroDiver.material.uniforms.map.value = st.hero === 'ayu' ? tex.adiver : tex.wdiver; place(heroDiver, mt, .43 + Math.sin(clock * .3) * .01, .7 + Math.sin(clock * 1.1) * .006, .95); };
// ---- villagers for the festival day (shown in chapter 7 only)
const village = spr(be, tex.village, 7, 0); village.visible = false; place(village, be, .36, .6, .75);
// ---- farm tanks & planting spots on the farm panorama
CONE.splice(0, CONE.length, [.6, .74], [.66, .72], [.72, .76], [.78, .74], [.64, .82], [.74, .84]);
// ---- anemone: the clownfish only lives there when it is clean
st.clownAway = false;
animAnemone = function () { const spots = [[.5, .58, .8], [.44, .6, .75], [.47, .64, .82]];
  clowns.forEach((c, i) => { if (i === 0 && st.photoFish) return; let [u, v, d] = spots[i]; const t = clock * .5 + c.userData.ph; if (st.clownAway) { u += .18 + Math.sin(clock * .2 + i) * .08; v -= .08; }
    place(c, an, u + Math.sin(t) * .04, v + Math.sin(t * 1.6) * .015, d); c.scale.x = Math.cos(t) > 0 ? -1 : 1; c.rotation.z = Math.sin(t * 1.6) * .1; }); };

// A) beach: half-buried trash, bottles bobbing in the waves, waves washing new trash ashore
gameBeach = function () { return new Promise((res) => { window.__mgDone = () => { mgTick = null; mgClose(); res(true); };
  stage('beach', .3, .62, 1);
  mgOpen('MINISPIEL · STRAND', 'Sammle den Müll ein! Die Opfergaben bleiben liegen.', ICO_TILT + '<span>' + (sens.has ? 'Dreh dich um: Müll liegt überall' : 'Wischen zum Umsehen') + '</span>');
  const TOTAL = 13; let got = 0, T0 = 0, washes = 0; const items = [];
  const bin = document.createElement('div'); bin.className = 'o'; bin.style.cssText = `left:${W / Z - 50}px;top:${H / Z - 76}px;width:64px;height:64px;border-radius:20px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(0,0,0,.3)`;
  bin.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0B1F3A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16l-1.5 13h-13z"/><path d="M9 7V4h6v3"/></svg>'; lay.appendChild(bin);
  function add(k, u, v, kind) { const im = new Image(); im.src = 'assets/it_' + k + '.png'; im.style.width = (k === 'bag' || k === 'net' || k === 'cup' ? 74 : 56) + 'px';
    Object.assign(im, { u, v, u0: u, v0: v, kind, ph: Math.random() * 6, born: T0 }); im.dataset.t = 1; if (kind === 'buried') im.style.clipPath = 'inset(0 0 50% 0)';
    lay.appendChild(im); items.push(im);
    im.onclick = (e) => { e.stopPropagation(); if (im.dataset.done) return; im.dataset.done = 1; got++; mgBar(got / TOTAL); blip(600, 1000, .1); buzz(15);
      im.style.clipPath = 'none'; im.style.transition = 'all .6s'; im.style.left = (W / Z - 50) + 'px'; im.style.top = (H / Z - 70) + 'px'; im.style.opacity = 0; im.style.transform = 'translate(-50%,-50%) scale(.3)';
      if (got === 3) toast('Super! Schau auch ins Wasser!'); if (got === TOTAL) { mgTick = null; edgeHints([]); setTimeout(() => { mgClose(); chime(); res(); }, 700); } };
    return im; }
  [['bottle', .27, .68, 'lie'], ['bag', .33, .76, 'buried'], ['can', .45, .67, 'lie'], ['flipflop', .52, .76, 'buried'], ['cup', .64, .79, 'lie'], ['bottle', .8, .75, 'buried'], ['bag', .86, .7, 'lie'], ['can', .39, .79, 'buried']].forEach((a) => add(...a));
  [['bottle', .12, .62], ['cup', .17, .58], ['bottle', .07, .7]].forEach(([k, u, v]) => add(k, u, v, 'float'));
  [[.41, .62], [.56, .66], [.92, .7]].forEach((p, i) => { const im = new Image(); im.src = 'assets/it_canang' + (i % 2 + 1) + '.png'; im.style.width = '78px'; Object.assign(im, { u: p[0], v: p[1], kind: 'canang', ph: i }); lay.appendChild(im); items.push(im);
    im.onclick = (e) => { e.stopPropagation(); im.animate([{ transform: 'translate(-50%,-50%) rotate(0)' }, { transform: 'translate(-50%,-50%) rotate(8deg)' }, { transform: 'translate(-50%,-50%) rotate(-8deg)' }, { transform: 'translate(-50%,-50%) rotate(0)' }], { duration: 400 }); blip(300, 220, .15); toast('Halt! Das ist eine Opfergabe. Die bleibt liegen.'); }; });
  mgTick = (dt) => { T0 += dt;
    if (washes < 2 && T0 > 9 + washes * 9) { washes++; const im = add(washes === 1 ? 'bag' : 'can', .1, .74, 'wash'); im.u1 = washes === 1 ? .23 : .2; im.v1 = washes === 1 ? .71 : .78; im.born = T0; toast('Eine Welle bringt neuen Müll! Er kommt aus dem Meer.'); blip(200, 120, .4, .08); }
    const pts = [];
    for (const im of items) { if (im.dataset.done) continue; let u = im.u, v = im.v, rot = 0;
      if (im.kind === 'float') { u = im.u0 + Math.sin(clock * .7 + im.ph) * .02; v = im.v0 + Math.sin(clock * .9 + im.ph) * .025; rot = Math.sin(clock * 1.3 + im.ph) * 20; }
      if (im.kind === 'wash') { const k = Math.min(1, (T0 - im.born) / 3.2), e = 1 - Math.pow(1 - k, 3); u = im.u0 + (im.u1 - im.u0) * e; v = im.v0 + (im.v1 - im.v0) * e; rot = (1 - e) * Math.sin(clock * 2) * 25; }
      const [x, y] = proj(be, u, v, .7); im.style.left = x + 'px'; im.style.top = (y + (im.kind === 'lie' ? Math.sin(clock * 2 + im.ph) * 1.5 : 0)) + 'px'; if (rot) im.style.transform = `translate(-50%,-50%) rotate(${rot}deg)`; if (im.dataset.t) pts.push([x, y]); }
    edgeHints(pts); };
}); };

// B) snorkeling: look down onto the reef, clean up, then free a turtle from plastic
const _gameReef = gameReef;
gameReef = async function () { await _gameReef(); await turtleRescue(); };
function turtleRescue() { return new Promise((res) => { window.__mgDone = () => { mgTick = null; mgClose(); res(true); };
  stage('explore', .5, .62, 1); turtle.visible = true;
  mgOpen('MINISPIEL · RETTUNG', 'Hilfe! Die Schildkröte hängt im Plastik. Tippe 3-mal auf das Netz!', '<span>Aufs Netz tippen</span>');
  const net = new Image(); net.src = 'assets/it_net.png'; net.style.width = '120px'; net.style.pointerEvents = 'auto'; lay.appendChild(net); let taps = 0, free = 0;
  net.onclick = (e) => { e.stopPropagation(); if (taps >= 3) return; taps++; mgBar(taps / 3); blip(400, 700, .12); buzz(30); net.style.width = (120 - taps * 26) + 'px';
    net.animate([{ transform: 'translate(-50%,-50%) rotate(0)' }, { transform: 'translate(-50%,-50%) rotate(14deg)' }, { transform: 'translate(-50%,-50%) rotate(-14deg)' }, { transform: 'translate(-50%,-50%)' }], { duration: 350 });
    if (taps === 3) { net.style.transition = 'all .8s'; net.style.opacity = 0; free = .001; chime(); toast('Frei! Danke!'); setTimeout(() => { mgClose(); res(); }, 2200); } };
  mgTick = (dt) => { const u = .5 + (free ? (free += dt * .08) : Math.sin(clock * 3) * .004), v = .55 - (free ? free * .5 : 0);
    place(turtle, ex, u, v, .9); turtle.scale.x = -1; const [x, y] = proj(ex, u, v, .9); net.style.left = x + 'px'; net.style.top = y + 'px'; edgeHints(taps < 3 ? [[x, y]] : []); };
}); }

// C) anemone full of trash: the clownfish has no home until it is clean
function gameAnemone() { return new Promise((res) => { window.__mgDone = () => { mgTick = null; mgClose(); st.clownAway = false; res(true); };
  stage('anemone', .47, .6, 1); st.clownAway = true;
  mgOpen('MINISPIEL · ANEMONE', 'In der Anemone liegt Müll. Der Clownfisch hat kein Zuhause! Räum sie auf.', '<span>Müll antippen</span>');
  const its = [['bag', .45, .57], ['can', .5, .62], ['cup', .46, .66]]; let n = 0;
  const els = its.map(([k, u, v]) => { const im = new Image(); im.src = 'assets/it_' + k + '.png'; im.style.width = '62px'; Object.assign(im, { u, v }); lay.appendChild(im);
    im.onclick = (e) => { e.stopPropagation(); if (im.dataset.done) return; im.dataset.done = 1; n++; mgBar(n / 3); blip(500, 900, .1); buzz(20); im.style.transition = 'all .7s'; im.style.transform = 'translate(-50%,-250%) scale(.4)'; im.style.opacity = 0;
      if (n === 3) { st.clownAway = false; toast('Schau, der Clownfisch zieht wieder ein!'); chime(); setTimeout(() => { mgClose(); res(); }, 2600); } }; return im; });
  mgTick = () => { const pts = []; els.forEach((im) => { if (im.dataset.done) return; const [x, y] = proj(an, im.u, im.v, .8); im.style.left = x + 'px'; im.style.top = y + 'px'; pts.push([x, y]); }); edgeHints(pts); };
}); }

// D) paddling out: tap left/right in turn, keep the boat level
function gamePaddle() { return new Promise((res) => { window.__mgDone = () => { mgTick = null; mgClose(); camera.rotation.z = 0; st.lookLock = false; res(true); };
  stage('boatday', .5, .55, 1); st.lookLock = true; if (sens.has) calib();
  mgOpen('MINISPIEL · RAUSPADDELN', 'Paddle zum Manta Point! Tippe immer auf das blinkende Paddel: links, rechts, links …', '');
  const ui = document.createElement('div'); ui.innerHTML = '<button class="paddle" style="left:18px">Links</button><button class="paddle" style="right:18px">Rechts</button><div class="balbar"><b></b><i></i></div>'; lay.appendChild(ui);
  const [bl, br] = ui.querySelectorAll('.paddle'), knob = ui.querySelector('.balbar i');
  let dist = 0, last = '', bal = 0, push = 0, done = false, warn = 0, speed = 0, stroke = 0;
  const cue = () => { const nextL = last !== 'L'; bl.classList.toggle('next', nextL); br.classList.toggle('next', !nextL); bl.classList.toggle('dim', !nextL); br.classList.toggle('dim', nextL); }; cue();
  const hit = (side, b) => (e) => { e.preventDefault(); e.stopPropagation(); if (done) return; b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 120);
    const good = side !== last; const steady = Math.abs(bal) < age().steady;
    if (good) { last = side; dist += .05 * (steady ? 1 : .4); speed = Math.min(1, speed + .35); stroke = 1; push += side === 'L' ? .1 : -.1; blip(300, 420, .08, .05); buzz(10); const sp = toWorld(bday, side === 'L' ? .42 : .58, .8, .95); camBubbles.userData.emit(sp.x, sp.y, sp.z, 6, .25, clock); }
    else { b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 300); blip(200, 140, .12, .06); buzz(25); }
    cue(); };
  bl.addEventListener('pointerdown', hit('L', bl)); br.addEventListener('pointerdown', hit('R', br));
  mgTick = (dt) => { if (done) return; const t = tilt(); push *= Math.exp(-dt * 1.5); speed *= Math.exp(-dt * .9); stroke = Math.max(0, stroke - dt * 2); const wave = Math.sin(clock * 1.3) * .25 + Math.sin(clock * .7 + 1) * .15;
    bal = clamp(t.x + wave * .6 + push, -1, 1); knob.style.left = ((bal + 1) / 2 * 100) + '%'; camera.rotation.z = -bal * .18; camera.rotation.x = PV.pitch + Math.sin(clock * 1.7) * .02 - stroke * .03 + speed * .015;
    // the boat glides: the view pushes forward with every stroke (narrower field of view = closer to the temple)
    PV.tZoom = 1 + dist * .9 + speed * .06; bday.plate.material.uniforms.wobble.value = 1.2 + speed * 2.5;
    if (Math.abs(bal) > .75 && (warn -= dt) < 0) { warn = 3; toast('Gerade halten!'); }
    mgBar(dist); if (dist >= 1) { done = true; chime(); buzz(60); setTimeout(() => { camera.rotation.z = 0; st.lookLock = false; PV.tZoom = 1; bday.plate.material.uniforms.wobble.value = 1.2; mgClose(); res(); }, 700); } };
}); }

// E) spawning: a quiet moment just to watch the coral babies rise
function spawnWonder(sec = 5) { const w = document.createElement('div'); w.id = 'wonder'; phone.appendChild(w);
  for (let i = 0; i < 70; i++) { const d = document.createElement('i'); d.style.left = (Math.random() * 100) + '%'; d.style.animationDuration = (6 + Math.random() * 6) + 's'; d.style.animationDelay = (Math.random() * sec) + 's'; const s = 5 + Math.random() * 9; d.style.width = d.style.height = s + 'px'; w.appendChild(d); }
  setTimeout(() => w.remove(), (sec + 13) * 1000); }

// F) mangroves: a wave comes – and the sand stays
function waveTest() { return new Promise((res) => { const w = document.createElement('div'); w.id = 'wave'; phone.appendChild(w); blip(160, 90, 1.2, .12); buzz(80); setTimeout(() => { w.remove(); res(); }, 2500); }); }

// G) festival: give offerings to the sea, the village is there
function gameOffer() { return new Promise((res) => { window.__mgDone = () => { mgTick = null; mgClose(); res(true); };
  stage('beach', .32, .64, 1); village.visible = true;
  mgOpen('MINISPIEL · SEGARA KERTHI', 'Tippe auf die Opfergaben. Sie schwimmen als Dank ins Meer.', '<span>Opfergaben antippen</span>');
  let n = 0; const els = [[.3, .7], [.34, .76], [.27, .82]].map(([u, v], i) => { const im = new Image(); im.src = 'assets/it_canang' + (i % 2 + 1) + '.png'; im.style.width = '80px'; Object.assign(im, { u, v, go: 0 }); lay.appendChild(im);
    im.onclick = (e) => { e.stopPropagation(); if (im.go) return; im.go = .001; n++; mgBar(n / 3); chime(); if (n === 3) setTimeout(() => { mgClose(); res(); }, 2800); }; return im; });
  mgTick = (dt) => { const pts = []; els.forEach((im) => { if (im.go) { im.go += dt * .25; im.style.opacity = Math.max(0, 1 - im.go); } const u = im.u - (im.go || 0) * .18, v = im.v - (im.go || 0) * .1; const [x, y] = proj(be, u, v, .7); im.style.left = x + 'px'; im.style.top = (y + Math.sin(clock * 2 + u * 9) * 2) + 'px'; if (!im.go) pts.push([x, y]); }); edgeHints(pts); };
}); }

// H) coral farm side quest: corals grow over real time and chapters; they only turn pale, they never die
const FARM_KEY = 'seaju_farm';
function farmLoad() { let f = null; try { f = JSON.parse(localStorage.getItem(FARM_KEY)); } catch (e) {} if (!f) f = { on: false, c: [0, 1, 2, 3].map(() => ({ g: .1, h: 1, a: 0 })), t: Date.now(), planted: 0 };
  const hrs = Math.max(0, (Date.now() - f.t) / 36e5); f.c.forEach((c) => { c.h = Math.max(.3, c.h - hrs * .04); c.a = Math.min(4, c.a + Math.floor(hrs / 6)); c.g = Math.min(1, c.g + hrs * .02 * (c.h > .6 ? 1 : .3)); }); f.t = Date.now(); return f; }
function farmSave(f) { f.t = Date.now(); try { localStorage.setItem(FARM_KEY, JSON.stringify(f)); } catch (e) {} }
function farmBoost(x) { const f = farmLoad(); if (!f.on) return; f.c.forEach((c) => { if (c.h > .6) c.g = Math.min(1, c.g + x); }); farmSave(f); }
function coralSvg(g, h) { const s = .45 + g * .75, col = h > .6 ? '#FF8A5B' : h > .45 ? '#F3C6A8' : '#EEE7DF';
  return `<svg width="70" height="70" viewBox="0 0 40 40" style="transform:scale(${s});transform-origin:50% 100%"><g fill="none" stroke="${col}" stroke-width="3.4" stroke-linecap="round"><path d="M20 39V22M20 26l-7-8M20 24l7-9M13 18l-3-6M13 18l1-7M27 15l3-6M27 15l-2-7"/></g><rect x="13" y="36" width="14" height="4" rx="2" fill="#8C6E54"/></svg>`; }
function openFarm() { return new Promise((res) => { const f = farmLoad(); window.__mgDone = () => { mgTick = null; mgClose(); farmSave(f); res(true); };
  stage('base', .7, .74, 1); hideHud(true);
  mgOpen('KORALLENFARM', f.c.some((c) => c.g >= 1) ? 'Eine Koralle ist gross! Tippe drauf, dann kommt sie ins Riff.' : f.c.some((c) => c.a > 0) ? 'Tippe auf die grünen Algen, dann wachsen deine Korallen.' : 'Deine Korallen wachsen. Schau später wieder nach!', '<button class="ghost" id="farmOut" style="background:#fff;color:#0B1F3A;height:44px">Fertig</button>');
  const pos = [[.665, .69], [.735, .69], [.665, .8], [.735, .8]];
  const tanks = f.c.map((c, i) => { const d = document.createElement('div'); d.className = 'farmTank'; lay.appendChild(d); d.u = pos[i][0]; d.v = pos[i][1]; return d; });
  function render() { tanks.forEach((d, i) => { const c = f.c[i]; d.innerHTML = coralSvg(c.g, c.h) + `<em>${c.g >= 1 ? T('Bereit fürs Riff!') : Math.round(c.g * 100) + ' %'}</em>`;
    for (let a = 0; a < c.a; a++) { const al = document.createElement('span'); al.className = 'alg'; al.style.left = (10 + a * 24) + 'px'; al.style.top = (12 + (a % 2) * 30) + 'px'; d.appendChild(al);
      al.onclick = (e) => { e.stopPropagation(); c.a--; c.h = Math.min(1, c.h + .2); blip(700, 1000, .08); render(); farmSave(f); if (f.c.every((x) => x.a === 0)) toast('Alles sauber! Deine Korallen freuen sich.'); }; }
    d.onclick = () => { if (c.g >= 1) { c.g = .1; f.planted++; chime(); toast('Ins Riff gepflanzt! Schon ' + f.planted + ' Korallen.'); farmSave(f); render(); } else if (c.a === 0) { c.h = Math.min(1, c.h + .05); blip(500, 600, .05); } }; }); }
  const hint = () => { const has = f.c.some((c) => c.a > 0), ready = f.c.some((c) => c.g >= 1); $('#mgTxt').textContent = T(ready ? 'Eine Koralle ist gross! Tippe drauf, dann kommt sie ins Riff.' : has ? 'Tippe auf die grünen Algen, dann wachsen deine Korallen.' : 'Deine Korallen wachsen. Schau später wieder nach!'); };
  const _r = render; render = function () { _r(); hint(); };
  render(); setTimeout(() => { const b = $('#farmOut'); if (b) b.onclick = () => window.__mgDone(); }, 50);
  mgTick = () => tanks.forEach((d) => { const [x, y] = proj(bs, d.u, d.v, .85); d.style.left = x + 'px'; d.style.top = y + 'px'; });
}).finally(() => hideHud(false)); }
// farm button on the map, once the farm is unlocked
{ const fr = $('#freeRow'); if (fr) { const b = document.createElement('button'); b.className = 'ghost'; b.id = 'farmBtn'; b.style.cssText = 'color:#0B1F3A;border-color:#0B1F3A;background:#fff;height:40px;padding:0 12px;display:none'; b.textContent = T('Korallenfarm'); fr.after(b);
  b.onclick = () => { audioInit(); transition(async () => { await openFarm(); show('map', 'map'); }); };
  setInterval(() => { const f = farmLoad(); b.style.display = f.on && st.screen === 'map' ? '' : 'none'; const need = f.c.some((c) => c.a > 0 || c.g >= 1); b.textContent = T('Korallenfarm') + (need ? ' !' : ''); }, 1000); } }

// ================= E4: COLLECTION ALBUM WITH RARE ANIMALS =================
const RAR = { 1: 'Häufig', 2: 'Selten', 3: 'Sehr selten' };
const RARITY = { clownfish: 1, moorish: 1, parrotfish: 1, acropora: 1, turtle: 2, wobbegong: 2, seahorse: 2, walkingshark: 2, octopus: 2, reefshark: 2, nudi: 2, manta: 3, whaleshark: 3, mola: 3 };
ALBUM.push(
  { id: 'whaleshark', name: 'Walhai', cat: 'riese', img: 'st_whaleshark.jpg' },
  { id: 'mola', name: 'Mondfisch', cat: 'riese', img: 'st_mola.jpg' },
  { id: 'octopus', name: 'Riff-Oktopus', cat: 'fisch', img: 'st_octopus.jpg' },
  { id: 'reefshark', name: 'Schwarzspitzen-Riffhai', cat: 'riese', img: 'st_reefshark.jpg' },
  { id: 'nudi', name: 'Nacktschnecke', cat: 'fisch', img: 'st_nudi.jpg' });
Object.assign(CARDS, {
  whaleshark: { lat: 'Rhincodon typus', facts: [['Grösster Fisch der Welt', 'ruler'], ['Frisst nur winziges Plankton', 'leaf'], ['Jeder hat ein eigenes Punktemuster', 'shield']], say: 'Er ist so lang wie ein Bus, aber ganz sanft. Seine Punkte sind wie ein Fingerabdruck!' },
  mola: { lat: 'Mola mola', facts: [['Schwerster Knochenfisch', 'ruler'], ['Sonnt sich an der Oberfläche', 'home'], ['Frisst gern Quallen', 'leaf']], say: 'Der Mondfisch sieht aus wie ein schwimmender Kopf. Er legt sich zum Aufwärmen an die Oberfläche!' },
  octopus: { lat: 'Octopus cyanea', facts: [['Hat drei Herzen', 'shield'], ['Kann die Farbe wechseln', 'leaf'], ['Acht Arme voller Saugnäpfe', 'ruler']], say: 'Der Oktopus hat drei Herzen und blaues Blut. Und er kann sich in Sekunden unsichtbar machen!' },
  reefshark: { lat: 'Carcharhinus melanopterus', facts: [['Schwarze Flossenspitzen', 'shield'], ['Hält das Riff gesund', 'home'], ['Scheu vor Menschen', 'leaf']], say: 'Riffhaie fressen kranke Fische. Damit sind sie die Ärzte des Riffs!' },
  nudi: { lat: 'Chromodoris', facts: [['Atmet mit Federn auf dem Rücken', 'leaf'], ['Bunt heisst: Ich schmecke eklig', 'shield'], ['Nur so gross wie ein Daumen', 'ruler']], say: 'Die Nacktschnecke ist so bunt, damit alle wissen: Iss mich lieber nicht!' } });
const FACT2 = { clownfish: 'Alle Clownfische kommen als Jungs zur Welt.', turtle: 'Sie kann über 50 Jahre alt werden.', manta: 'Mantas haben das grösste Gehirn aller Fische.', walkingshark: 'Er kann eine Stunde ohne Wasser überleben.', seahorse: 'Bei Seepferdchen bekommt der Papa die Babys.', moorish: 'Er heisst so, weil er wie eine Maske aussieht.', wobbegong: 'Er kann einen Fisch mit einem einzigen Biss schnappen.', parrotfish: 'Nachts schläft er in einem Schleim-Schlafsack.', acropora: 'Sie wächst bis zu 10 cm im Jahr.', whaleshark: 'Er kann über 100 Jahre alt werden.', mola: 'Ein Weibchen legt Millionen winzige Eier.', octopus: 'Er kann sich durch ein Loch so klein wie eine Münze quetschen.', reefshark: 'Er riecht einen Tropfen Blut im Wasser von weit weg.', nudi: 'Manche fressen Nesselzellen und benutzen sie selbst.' };
const SETS = [{ id: 'giants', name: 'Riesen des Meeres', ids: ['manta', 'whaleshark', 'mola', 'turtle'] }, { id: 'friends', name: 'Freunde fürs Leben', ids: ['clownfish', 'acropora', 'manta', 'parrotfish'] }, { id: 'hide', name: 'Meister der Tarnung', ids: ['wobbegong', 'seahorse', 'octopus', 'nudi'] }];
st.seen = (() => { try { return JSON.parse(localStorage.getItem('seaju_seen')) || {}; } catch (e) { return {}; } })();
function seenSave() { try { localStorage.setItem('seaju_seen', JSON.stringify(st.seen)); } catch (e) {} }
const stA = document.createElement('style'); stA.textContent = `
#card.gold .cardbox,#card.gold > div{box-shadow:0 0 0 5px #FFD84A,0 0 30px rgba(255,216,74,.7)}
.rar{display:inline-block;margin-left:8px;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:800;vertical-align:middle}
.rar1{background:#DFF3E6;color:#1F7A44}.rar2{background:#E3ECFF;color:#2F55B8}.rar3{background:#FFF0C2;color:#9A6A00}
#sets{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-top:-2px}
#album .grid{top:278px}
#sets span{flex:none;white-space:nowrap;padding:4px 10px;border-radius:12px;background:rgba(255,255,255,.18);color:#fff;font-weight:800;font-size:12px}
#sets span.done{background:#FFD84A;color:#0B1F3A}
.rareHit{position:absolute;width:150px;height:110px;margin:-55px 0 0 -75px;border-radius:50%;pointer-events:auto;box-shadow:0 0 0 3px rgba(255,236,150,.9),0 0 26px 8px rgba(255,236,150,.55);animation:rh 1.2s infinite;z-index:6}
@keyframes rh{50%{box-shadow:0 0 0 6px rgba(255,236,150,.4),0 0 40px 14px rgba(255,236,150,.35)}}
`; document.head.appendChild(stA);
const _openCardR = openCard;
openCard = function (id, fresh) { _openCardR(id, false); const c = CARDS[id], a = ALBUM.find((x) => x.id === id); const n = st.seen[id] || 0;
  $('#cName').innerHTML = T(a.name) + `<span class="rar rar${RARITY[id] || 1}">${T(RAR[RARITY[id] || 1])}</span>`;
  $('#cSay').textContent = T('Opa Ketut') + ': «' + T(c.say) + '»';
  if (n >= 2 && FACT2[id]) $('#cSay').textContent += ' ' + T('Neu') + ': ' + T(FACT2[id]);
  $('#card').classList.toggle('gold', n >= 2);
  $('#card .badge').lastChild.textContent = T(fresh ? 'Entdeckt!' : n >= 2 ? 'Goldene Karte' : 'Mein Tier');
  if (st.age === '5') { $('#cLat').style.display = 'none'; [...$('#cFacts').children].forEach((d, i) => d.style.display = i ? 'none' : ''); } else { $('#cLat').style.display = ''; [...$('#cFacts').children].forEach((d) => d.style.display = ''); }
  if (fresh || n === 2) setTimeout(() => speak(a.name + '! ' + c.say + (n >= 2 && FACT2[id] ? ' ' + FACT2[id] : '')), 400);
  if (fresh) checkSets(id); };
function checkSets(id) { for (const s of SETS) if (s.ids.includes(id) && s.ids.every((x) => st.found.has(x))) { setTimeout(() => { toast(T('Abzeichen') + ': ' + T(s.name) + '!'); chime(); }, 1500); } }
const _renderAlbum = renderAlbum; renderAlbum = function () { _renderAlbum();
  let el = $('#sets'); if (!el) { el = document.createElement('div'); el.id = 'sets'; $('#atabs').after(el); }
  el.innerHTML = SETS.map((s) => { const k = s.ids.filter((x) => st.found.has(x)).length; return `<span class="${k === s.ids.length ? 'done' : ''}">${T(s.name)} ${k}/${s.ids.length}</span>`; }).join('');
  [...$('#grid').children].forEach((b, i) => { const a = ALBUM.filter((x) => afilter === 'all' || x.cat === afilter)[i]; if (a && (st.seen[a.id] || 0) >= 2) b.style.boxShadow = '0 0 0 3px #FFD84A'; }); };
document.querySelectorAll('#album span').forEach((s) => { if (s.textContent === 'BALI') s.textContent = 'BALI'; });
// rare encounters during free diving: something special swims by, glittering – tap it!
let rareT = 25, rare = null; setInterval(() => { window.__rareT = [rareT, st.screen, st.inStory, phone.classList.contains("cardon"), !!rare]; }, 500);
const RARE_MODE = { whaleshark: 1, mola: 4, octopus: 0, reefshark: 1, nudi: 0, turtle: 4, manta: 2, seahorse: 0, wobbegong: 1 };
function rarePick() { const pool = []; for (const a of ALBUM) { const r = RARITY[a.id] || 1; if (r < 2) continue; const w = (r === 3 ? 1 : 3) * (st.found.has(a.id) ? 1 : 2); for (let i = 0; i < w; i++) pool.push(a.id); } return pool[Math.floor(Math.random() * pool.length)]; }
function rareTick(dt) {
  if (st.screen !== 'explore' || st.inStory || phone.classList.contains('cardon') || $('#coach').classList.contains('on')) { if (rare) rareEnd(); return; }
  if (!rare) { rareT -= dt; if (rareT > 0) return; const id = rarePick(); const t = tex['sp_' + id] || tex[id]; if (!t) { rareT = 10; return; }
    const sc = S[st.scene]; const w = id === 'whaleshark' ? 6 : id === 'nudi' ? 1.4 : 3; const m = spr(sc, t, w, RARE_MODE[id] ?? 1, { amp: .06, speed: 3 });
    const [lu, lv] = sc.pano ? panoLookUV() : [.5, .5]; const dir = Math.random() < .5 ? 1 : -1;
    rare = { id, m, sc, u: lu - dir * (sc.pano ? .05 : .1), v: clamp(lv + (Math.random() - .5) * .1, .35, .7), dir, life: 18, told: false };
    const hit = document.createElement('div'); hit.className = 'rareHit'; phone.appendChild(hit); rare.hit = hit;
    hit.onclick = (e) => { e.stopPropagation(); const id2 = rare.id; st.seen[id2] = (st.seen[id2] || 0) + 1; seenSave(); rareEnd(); discover(id2); };
    return; }
  rare.life -= dt; rare.u += rare.dir * dt * (rare.sc.pano ? .008 : .012); place(rare.m, rare.sc, rare.u, rare.v + Math.sin(clock) * .01, .55); rare.m.scale.x = rare.dir > 0 ? -1 : 1;
  const [x, y] = proj(rare.sc, rare.u, rare.v, .55); rare.hit.style.left = x * Z + 'px'; rare.hit.style.top = y * Z + 'px';
  if (!rare.told && x > 30 && x < W / Z - 30 && y > 90 && y < H / Z - 90) { rare.told = true; toast('Schau! Da schwimmt etwas Besonderes vorbei!'); blip(900, 1500, .3, .06); }
  if (rare.life <= 0) rareEnd(); }
function rareEnd() { if (!rare) return; rare.sc.sc.remove(rare.m); const i = all.indexOf(rare.m); if (i >= 0) all.splice(i, 1); rare.hit.remove(); rare = null; rareT = 30 + Math.random() * 40; }
const _discoverR = discover; discover = function (id) { if (!st.seen[id]) { st.seen[id] = 1; seenSave(); } _discoverR(id); };

// ================= E5: AGE LEVELS, ARCADE WITH HIGHSCORES, FRIENDS =================
st.age = (() => { try { return localStorage.getItem('seaju_age') || '5'; } catch (e) { return '5'; } })();
const AGE = { 5: { air: 22, steady: .8, glow: 1.3, label: '5–6' }, 7: { air: 17, steady: .6, glow: 1, label: '7–9' }, 10: { air: 13, steady: .45, glow: .8, label: '10+' } };
function age() { return AGE[st.age] || AGE[5]; }
// nickname from fixed words only (no free text, no real names)
const NICK_A = ['Blauer', 'Bunter', 'Mutiger', 'Leiser', 'Schneller', 'Kleiner', 'Goldener', 'Fröhlicher'], NICK_B = ['Delfin', 'Manta', 'Clownfisch', 'Oktopus', 'Seestern', 'Hai', 'Schildkröte', 'Seepferdchen'];
st.nick = (() => { try { let n = JSON.parse(localStorage.getItem('seaju_nick')); if (!n) { n = { a: Math.floor(Math.random() * 8), b: Math.floor(Math.random() * 8), num: 10 + Math.floor(Math.random() * 90), code: Math.random().toString(36).slice(2, 8).toUpperCase() }; localStorage.setItem('seaju_nick', JSON.stringify(n)); } return n; } catch (e) { return { a: 0, b: 0, num: 42, code: 'OCEAN1' }; } })();
function nickAdj(ai, bi) { const w = NICK_A[ai]; if (LANG !== 'de') return T(w); const g = NICK_G[bi]; return g === 'f' ? w.replace(/er$/, 'e') : g === 'n' ? w.replace(/er$/, 'es') : w; }
const NICK_G = ['m', 'm', 'm', 'm', 'm', 'm', 'f', 'n'];
function nickName() { const a = nickAdj(st.nick.a, st.nick.b), b = T(NICK_B[st.nick.b]); return (LANG === 'id' ? b + ' ' + a : a + ' ' + b) + ' ' + st.nick.num; }
st.friendsOn = (() => { try { return localStorage.getItem('seaju_friends') === '1'; } catch (e) { return false; } })();
// leaderboard server (Cloudflare Worker + D1). Empty until deployed: then everything stays on the phone.
const LB_URL = '';
async function lbSubmit(game, score) { if (!LB_URL || !st.friendsOn) return; try { await fetch(LB_URL + '/score', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: st.nick.code, nick: [st.nick.a, st.nick.b, st.nick.num], game, score, age: st.age }) }); } catch (e) {} }
async function lbFriends(game) { if (!LB_URL || !st.friendsOn) return null; try { const fr = JSON.parse(localStorage.getItem('seaju_fr') || '[]'); const r = await fetch(LB_URL + '/friends?game=' + game + '&codes=' + [st.nick.code, ...fr].join(',')); return await r.json(); } catch (e) { return null; } }
// apply age to the mini-games
// arcade: every mini-game alone, scored by time; best score per game and age
const ARCADE = [['beach', 'Strand-Putzete', () => gameBeach()], ['reef', 'Riff-Putzete', () => _gameReef()], ['dive', 'Freediving', () => gameFreedive()], ['paddle', 'Rauspaddeln', () => gamePaddle()], ['spawn', 'Korallen-Babys fangen', () => gameSpawn()], ['bowl', 'Schale balancieren', () => gameBowl()], ['mangrove', 'Mangroven pflanzen', () => gameMangrove()], ['glow', 'Leuchtendes Meer', () => gameGlow()]];
function bestGet() { try { return JSON.parse(localStorage.getItem('seaju_best')) || {}; } catch (e) { return {}; } }
const stB = document.createElement('style'); stB.textContent = `
#arcade{position:absolute;inset:0;z-index:300;background:linear-gradient(180deg,#0B3E66,#06152b);display:none;flex-direction:column;align-items:center;padding:calc(max(16px,env(safe-area-inset-top)) + 8px) 16px 16px;gap:8px;overflow:auto;zoom:var(--z,1);color:#fff}
#arcade.on{display:flex}
#arcade h2{font-family:'Baloo 2';margin:0;font-size:28px}
#arcade .me{font-weight:800;font-size:13px;color:#BFF3FA;text-align:center}
#arcade .g{width:100%;max-width:340px;display:flex;align-items:center;justify-content:space-between;background:#fff;color:var(--ink);border-radius:18px;padding:10px 14px;border:0;font-weight:800;font-size:16px;text-align:left}
#arcade .g small{display:block;color:#3D5470;font-size:12px}
#arcade .g b{font-family:'Baloo 2';font-size:22px;color:#C9643F}
#arcade .row{display:flex;gap:8px}
#arcade .row button{height:40px;border-radius:14px;border:2px solid #fff;background:transparent;color:#fff;font-weight:800;padding:0 14px}
#arcade .row button.sel{background:#FFD84A;color:#0B1F3A;border-color:#FFD84A}
#score{position:absolute;inset:0;z-index:310;background:rgba(6,21,43,.86);display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#fff;zoom:var(--z,1);text-align:center}
#score.on{display:flex}
#score b{font-family:'Baloo 2';font-size:64px;line-height:1;color:#FFD84A}
#score .stars{font-size:40px;letter-spacing:6px}
`; document.head.appendChild(stB);
const arc = document.createElement('div'); arc.id = 'arcade'; phone.appendChild(arc);
const scoreEl = document.createElement('div'); scoreEl.id = 'score'; phone.appendChild(scoreEl);
function openArcade() { const best = bestGet();
  arc.innerHTML = `<h2>${T('Spielhalle')}</h2><div class="me">${nickName()} · ${T('Code')} ${st.nick.code}</div>
    <div class="row">${['5', '7', '10'].map((a) => `<button data-age="${a}" class="${st.age === a ? 'sel' : ''}">${AGE[a].label}</button>`).join('')}</div>` +
    ARCADE.map(([id, name]) => `<button class="g" data-g="${id}"><span>${T(name)}<small>${T('Bestleistung')}</small></span><b>${best[id + '_' + st.age] || '–'}</b></button>`).join('') +
    `<button class="g" data-g="friends" style="background:#BFF3FA"><span>${T('Freunde')}<small>${st.friendsOn ? T('Freundes-Code teilen') : T('Eltern schalten frei')}</small></span><b>›</b></button>
    <button class="ghost" data-g="x" style="margin-top:6px">${T('Zurück')}</button>`;
  arc.classList.add('on');
  arc.querySelectorAll('[data-age]').forEach((b) => b.onclick = () => { st.age = b.dataset.age; try { localStorage.setItem('seaju_age', st.age); } catch (e) {} openArcade(); });
  arc.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => { const g = b.dataset.g; if (g === 'x') { arc.classList.remove('on'); return; } if (g === 'friends') { friendsPanel(); return; } arc.classList.remove('on'); playArcade(g); }); }
async function playArcade(id) { const it = ARCADE.find((x) => x[0] === id); audioInit(); st.inStory = true; st.inArcade = id; hideHud(true); const t0 = performance.now();
  const r = await it[2](); const secs = (performance.now() - t0) / 1000; st.inStory = false; st.inArcade = null; hideHud(false);
  if (r === false) { showScore(id, 0, secs); return; }
  const score = Math.max(10, Math.round(30000 / Math.max(5, secs))); const best = bestGet(); const k = id + '_' + st.age; const nb = !best[k] || score > best[k]; if (nb) { best[k] = score; try { localStorage.setItem('seaju_best', JSON.stringify(best)); } catch (e) {} }
  lbSubmit(id, score); showScore(id, score, secs, nb); }
function showScore(id, score, secs, nb) { const stars = score > 1800 ? 3 : score > 900 ? 2 : score > 0 ? 1 : 0;
  scoreEl.innerHTML = `<span class="baloo" style="font-size:22px">${T(ARCADE.find((x) => x[0] === id)[1])}</span><div class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div><b>${score}</b><span style="font-weight:800">${Math.round(secs)} s${nb ? ' · ' + T('Neuer Rekord!') : ''}</span>
    <button class="cta" id="scAgain" style="max-width:260px">${T('Nochmal')}</button><button class="ghost" id="scBack">${T('Zur Spielhalle')}</button>`;
  scoreEl.classList.add('on'); if (nb) { chime(); buzz(60); } speak(nb ? 'Neuer Rekord!' : 'Gut gemacht!');
  $('#scAgain').onclick = () => { scoreEl.classList.remove('on'); playArcade(id); }; $('#scBack').onclick = () => { scoreEl.classList.remove('on'); show('map', 'map'); openArcade(); }; }
function friendsPanel() { if (!st.friendsOn) { toast(T('Die Freunde-Funktion schalten Eltern im Elternbereich frei.')); return; }
  const fr = (() => { try { return JSON.parse(localStorage.getItem('seaju_fr') || '[]'); } catch (e) { return []; } })();
  arc.innerHTML = `<h2>${T('Freunde')}</h2><div class="me">${T('Dein Code')}: <b style="font-size:22px;color:#FFD84A">${st.nick.code}</b><br>${nickName()}</div>
    <div class="me" style="color:#fff">${T('Sei nett zu anderen und teile nie deinen echten Namen oder Wohnort.')}</div>
    <div style="display:flex;gap:6px"><input id="frIn" maxlength="6" placeholder="CODE" style="width:150px;height:44px;border-radius:14px;border:0;text-align:center;font-weight:800;font-size:20px;text-transform:uppercase"><button class="cta" id="frAdd" style="width:auto;height:44px;padding:0 16px;font-size:16px">${T('Hinzufügen')}</button></div>
    <div class="me">${fr.length ? fr.join(' · ') : T('Noch keine Freunde')}</div>
    <div class="me">${LB_URL ? '' : T('Die gemeinsame Rangliste startet, sobald der Server bereit ist. Bis dahin zählen deine eigenen Rekorde.')}</div>
    <button class="ghost" id="frBack">${T('Zurück')}</button>`;
  $('#frAdd').onclick = () => { const c = $('#frIn').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length === 6 && c !== st.nick.code && !fr.includes(c)) { fr.push(c); try { localStorage.setItem('seaju_fr', JSON.stringify(fr)); } catch (e) {} chime(); } friendsPanel(); };
  $('#frBack').onclick = openArcade; }
// parents area: age level + friends switch
const _parentsAreaR = parentsArea; parentsArea = function () { _parentsAreaR();
  const box = $('#pbox'); const extra = document.createElement('div'); extra.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:6px';
  extra.innerHTML = `<span style="font-weight:800">${T('Alter des Kindes')}</span><div style="display:flex;gap:6px">${['5', '7', '10'].map((a) => `<button data-pa="${a}" style="flex:1;height:44px;border-radius:14px;border:2px solid #0B1F3A;background:${st.age === a ? '#FFD84A' : '#fff'};font-weight:800">${AGE[a].label}</button>`).join('')}</div>
    <label style="display:flex;align-items:center;gap:10px;font-weight:800"><input type="checkbox" id="pfr" ${st.friendsOn ? 'checked' : ''} style="width:24px;height:24px"> ${T('Freunde-Rangliste erlauben (nur Spitznamen)')}</label>`;
  box.insertBefore(extra, box.querySelector('[data-x]'));
  extra.querySelectorAll('[data-pa]').forEach((b) => b.onclick = () => { st.age = b.dataset.pa; try { localStorage.setItem('seaju_age', st.age); } catch (e) {} extra.querySelectorAll('[data-pa]').forEach((x) => x.style.background = x === b ? '#FFD84A' : '#fff'); });
  $('#pfr').onchange = (e) => { st.friendsOn = e.target.checked; try { localStorage.setItem('seaju_friends', st.friendsOn ? '1' : '0'); } catch (x) {} }; };
// entry points: title and map
{ const row = $('#tNew') && $('#tNew').parentElement; if (row) { const b = document.createElement('button'); b.className = 'ghost'; b.id = 'tArc'; b.textContent = 'Spielhalle'; row.appendChild(b); b.onclick = () => { audioInit(); $('#title') && $('#title').remove(); show('map', 'map'); openArcade(); }; }
  const fb = $('#farmBtn'); if (fb) { const b = document.createElement('button'); b.className = 'ghost'; b.textContent = 'Spielhalle'; b.style.cssText = 'color:#0B1F3A;border-color:#0B1F3A;background:#fff;height:40px;padding:0 12px'; fb.after(b); b.onclick = () => { audioInit(); openArcade(); }; } }
const _sfE = storyFrame; storyFrame = function (dt) { _sfE(dt); rareTick(dt); };


// ---- background: stop all sound when the app is not visible
document.addEventListener('visibilitychange', () => { try { if (document.hidden) { voStop(); if (typeof actx !== 'undefined' && actx && actx.state === 'running') actx.suspend(); } else if (typeof actx !== 'undefined' && actx && actx.state === 'suspended') actx.resume(); } catch (e) {} });
window.addEventListener('pagehide', () => { try { voStop(); actx && actx.suspend(); } catch (e) {} });
// ---- calm screen while an animal card is open: hide lights, task bar, mask
{ const stC = document.createElement('style'); stC.textContent = '.cardon #thk,.cardon #quest,.cardon #mask,.cardon .rareHit{opacity:0!important;pointer-events:none!important;transition:opacity .3s}'; document.head.appendChild(stC); }

// ================= E6: MUSIC PER PLACE (WebAudio, no files) =================
const MUS = { kind: null, timer: null, bus: null, lp: null };
const PELOG = [293.7, 311.1, 349.2, 415.3, 440, 466.2, 523.3];
function musBus() { if (!actx) return null; if (!MUS.bus) { MUS.bus = actx.createGain(); MUS.bus.gain.value = 0; MUS.lp = actx.createBiquadFilter(); MUS.lp.type = 'lowpass'; MUS.lp.frequency.value = 7000; MUS.bus.connect(MUS.lp); MUS.lp.connect(actx.destination); } return MUS.bus; }
function bell(f, t, v) { try { const o = actx.createOscillator(), o2 = actx.createOscillator(), g = actx.createGain(), g2 = actx.createGain(); o.frequency.value = f; o2.frequency.value = f * 2.76; g2.gain.value = .22;
  o2.connect(g2); g2.connect(g); o.connect(g); g.connect(MUS.bus); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0005, t + 2.4); o.start(t); o2.start(t); o.stop(t + 2.5); o2.stop(t + 2.5); } catch (e) {} }
function musStep() { if (!MUS.kind || !actx) return; if (!document.hidden && actx.state === 'running') { const t = actx.currentTime + .05, slow = MUS.kind !== 'above';
    const n = PELOG[Math.floor(Math.random() * PELOG.length)] * (MUS.kind === 'under' ? .5 : 1);
    bell(n, t, slow ? .045 : .055); if (Math.random() < .35) bell(n * 1.5, t + .32, .025); if (Math.random() < .18) bell(PELOG[0] * .5, t, .05); }
  MUS.timer = setTimeout(musStep, (MUS.kind === 'above' ? 620 : 1150) + Math.random() * 520); }
function music(kind) { if (!actx || !musBus()) return; if (kind === MUS.kind) return; MUS.kind = kind; clearTimeout(MUS.timer);
  MUS.lp.frequency.setTargetAtTime(kind === 'under' ? 800 : 6500, actx.currentTime, .5); MUS.bus.gain.setTargetAtTime(kind ? .5 : 0, actx.currentTime, .8); if (kind) musStep(); }
setInterval(() => { if (typeof actx === 'undefined' || !actx) return; const sc = st.scene; const k = st.screen === 'album' ? 'above' : UW.includes(sc) ? 'under' : ['glow', 'boat'].includes(sc) ? 'night' : 'above'; music(k); }, 1000);

// ================= E6: SEVERAL CHILDREN ON ONE PHONE =================
// every 'seaju…' key gets the profile suffix (profile 1 keeps the old keys, so nothing is lost)
const PROF = (() => { try { return JSON.parse(localStorage.getItem('seaju_profiles')) || { act: 1, list: [{ id: 1 }] }; } catch (e) { return { act: 1, list: [{ id: 1 }] }; } })();
function profSave() { try { localStorage.setItem('seaju_profiles', JSON.stringify(PROF)); } catch (e) {} }
const stP = document.createElement('style'); stP.textContent = `
#profBtn{position:absolute;top:calc(max(12px,env(safe-area-inset-top)) + 4px);left:12px;z-index:5;height:40px;border-radius:20px;border:2px solid #fff;background:rgba(6,21,43,.45);color:#fff;font-weight:800;padding:0 14px 0 6px;display:flex;align-items:center;gap:6px}
#profBtn img{width:30px;height:30px;border-radius:50%;object-fit:cover;object-position:top;background:#FFE9C7}
#profPick{position:absolute;inset:0;z-index:320;background:rgba(6,21,43,.94);display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;zoom:var(--z,1);color:#fff}
#profPick.on{display:flex}
#profPick button.p{width:280px;height:70px;border-radius:20px;border:3px solid transparent;background:#fff;color:#0B1F3A;font-weight:800;font-size:18px;display:flex;align-items:center;gap:12px;padding:0 12px}
#profPick button.p.act{border-color:#FFD84A}
#profPick button.p img{width:50px;height:50px;border-radius:50%;object-fit:cover;object-position:top;background:#FFE9C7}
`; document.head.appendChild(stP);
function profInfo(id) { const g = (k) => { try { return __lsGet.call(localStorage, id === 1 ? k : k + '#' + id); } catch (e) { return null; } };
  let nick = null; try { nick = JSON.parse(g('seaju_nick')); } catch (e) {} let ch = 0; try { ch = (JSON.parse(g('seaju')) || {}).ch || 0; } catch (e) {}
  const h = g('seaju_hero') || 'wayan'; return { img: HERO[h] ? HERO[h].img : HERO.wayan.img, name: nick ? (LANG === 'id' ? T(NICK_B[nick.b]) + ' ' + T(NICK_A[nick.a]) : nickAdj(nick.a, nick.b) + ' ' + T(NICK_B[nick.b])) : T('Neues Kind'), ch }; }
function openProfiles() { const el = $('#profPick');
  el.innerHTML = `<span class="baloo" style="font-size:28px">${T('Wer spielt?')}</span>` + PROF.list.map((p) => { const i = profInfo(p.id); return `<button class="p ${p.id === PROF.act ? 'act' : ''}" data-p="${p.id}"><img src="${i.img}" alt=""><span>${i.name}<br><small style="font-weight:700;color:#3D5470">${T('Kapitel')} ${Math.min(i.ch, 7)}</small></span></button>`; }).join('') +
    (PROF.list.length < 4 ? `<button class="ghost" data-p="new">+ ${T('Neues Kind')}</button>` : '') + `<button class="ghost" data-p="x">${T('Zurück')}</button>`;
  el.classList.add('on');
  el.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => { const v = b.dataset.p; if (v === 'x') { el.classList.remove('on'); return; }
    if (v === 'new') { const id = Math.max(...PROF.list.map((p) => p.id)) + 1; PROF.list.push({ id }); PROF.act = id; profSave(); location.reload(); return; }
    if (+v !== PROF.act) { PROF.act = +v; profSave(); location.reload(); } else el.classList.remove('on'); }); }
{ const pp = document.createElement('div'); pp.id = 'profPick'; phone.appendChild(pp);
  const ti = $('#title'); if (ti) { const b = document.createElement('button'); b.id = 'profBtn'; const i = profInfo(PROF.act); b.innerHTML = `<img src="${i.img}" alt=""><span>${i.name}</span>`; ti.appendChild(b); b.onclick = (e) => { e.stopPropagation(); openProfiles(); }; } }
Object.assign(EN, { 'Wer spielt?': "Who's playing?", 'Neues Kind': 'New child', 'Kapitel': 'Chapter' });
Object.assign(ID, { 'Wer spielt?': 'Siapa yang main?', 'Neues Kind': 'Anak baru', 'Kapitel': 'Bab' });


// ---- one farm only: the house tab opens the new coral farm (old station screen retired); land scenes do not wobble
{ const tb = document.querySelector('#tabs button[data-tab="station"]'); if (tb) { const nb = tb.cloneNode(true); tb.replaceWith(nb);
    nb.addEventListener('click', () => { audioInit(); const f = farmLoad(); if (!f.on) { f.on = true; farmSave(f); } transition(async () => { await openFarm(); show('map', 'map'); renderDots(); }); }); } }
bs.plate.material.uniforms.wobble.value = 0; bs.plate.material.uniforms.sway.value = .25;
ho.plate.material.uniforms.wobble.value = 0;


// ---- tilt on/off + swipe always works
st.gyroOff = (() => { try { return localStorage.getItem('seaju_gyro') === 'off'; } catch (e) { return false; } })();
tilt = function () { if (sens.has && !st.gyroOff) { if (!sens.base) calib(); return { x: clamp((sens.gamma - sens.base.g) / 22, -1, 1), y: clamp((sens.beta - sens.base.b) / 22, -1, 1) }; } return { x: sens.fx, y: sens.fy }; };
function setGyro(off) { st.gyroOff = off; try { localStorage.setItem('seaju_gyro', off ? 'off' : 'on'); } catch (e) {} panoRecenter(); $$('.gyroT').forEach((b) => b.textContent = (off ? 'Neigen: aus' : 'Neigen: an')); toast(off ? 'Neigen ist aus. Wische zum Umsehen.' : 'Neigen ist an. Beweg das Handy zum Umsehen.'); }
{ const stG = document.createElement('style'); stG.textContent = 'canvas,#mg,#mgLayer,#story-stage,#explore,#mission{touch-action:none}'; document.head.appendChild(stG);
  const row = $('#tNew') && $('#tNew').parentElement; if (row) { const b = document.createElement('button'); b.className = 'ghost gyroT'; b.textContent = (st.gyroOff ? 'Neigen: aus' : 'Neigen: an'); b.onclick = () => setGyro(!st.gyroOff); row.appendChild(b); } }
const _paG = parentsArea; parentsArea = function () { _paG(); const box = $('#pbox'); const b = document.createElement('button'); b.className = 'ghost gyroT'; b.style.cssText = 'color:#0B1F3A;border-color:#0B1F3A;height:44px'; b.textContent = (st.gyroOff ? 'Neigen: aus' : 'Neigen: an'); b.onclick = () => setGyro(!st.gyroOff); box.insertBefore(b, box.querySelector('[data-x]')); };

// ================= STORY (kurz, mit Erfolgsmomenten) =================
const yayEl = document.createElement('div'); yayEl.id = 'yay'; phone.appendChild(yayEl);
async function yay(t) { const cols = ['#FFD84A', '#FF8A5B', '#7FE6F2', '#5FE07A', '#fff'];
  yayEl.innerHTML = '<b>' + T(t) + '</b>' + Array.from({ length: 26 }, (_, i) => { const a = Math.random() * 6.28, r = 120 + Math.random() * 160; return `<i style="background:${cols[i % 5]};--x:${Math.cos(a) * r}px;--y:${Math.sin(a) * r}px;animation-delay:${Math.random() * .15}s"></i>`; }).join('');
  yayEl.classList.add('on'); chime(); buzz(60); speak(t, 'wayan'); await wait(1700); yayEl.classList.remove('on'); }
CHAPTERS.length = 0; CHAPTERS.push(
  { t: 'Opas Geschichte', g: 'Wie bunt war das Meer früher?' },
  { t: 'Plastik am Strand', g: 'Mach den Strand sauber!' },
  { t: 'Müll im Riff', g: 'Hol die Fische zurück!' },
  { t: 'Ein Atemzug tief', g: 'Tauch zum Clownfisch!' },
  { t: 'Zu den Mantas', g: 'Besuch die Mantas!' },
  { t: 'Die Nacht der Korallen-Babys', g: 'Rette die Korallen-Babys!' },
  { t: 'Wurzeln im Meer', g: 'Pflanze Mangroven!' },
  { t: 'Das leuchtende Meer', g: 'Bring die drei Lichter zum Leuchten!' });
const K = (t, f) => talk('kakek', t, f), Wy = (t, f) => talk('wayan', t, f), Bn = (t, f) => talk('baruna', t, f);
// ================= EXPRESSIONS & POSES =================
function exprOf(txt) { const t = T(txt || ''), d = (txt || '').toLowerCase();
  if (/oh nein|hilfe|krank|müde|achtung|verloren|knapp|keine fische|plastik!|müll!/.test(d)) return 'sad';
  if (/\?\s*$/.test(t.trim()) || /warum|was sind|wo wohnt|wer spricht/.test(d)) return 'think';
  if (/wow|schau|unglaublich|wie bunt|so viele/.test(d)) return 'wow';
  if (/geschafft|danke|super|juhu|hurra|ja!|leuchten!|zurück!|alle drei/.test(d)) return 'cheer';
  return 'happy'; }
function facePor(who, txt) { const key = who === 'wayan' ? (st.hero === 'ayu' ? 'ayu' : 'wayan') : who === 'kakek' ? 'kakek' : null; if (!key) return null;
  return `<img src="assets/fc_${key}_${exprOf(txt)}.png" alt="" style="width:100%;height:100%;object-fit:cover;margin:0">`; }
const _talkFx = talk; talk = function (who, txt, fact) { const p = facePor(who, txt); const old = POR[who]; if (p) POR[who] = p; const r = _talkFx(who, txt, fact); POR[who] = old; return r; };
// success moments: the hero jumps in, cheering
const _yayFx = yay; yay = async function (t) { const k = st.hero === 'ayu' ? 'ayu' : 'wayan'; const im = new Image(); im.className = 'yayPose'; im.src = `assets/po_${k}_cheer.png`;
  im.style.cssText = 'position:absolute;left:50%;bottom:-10px;height:46%;transform:translateX(-50%) translateY(110%);transition:transform .45s cubic-bezier(.2,1.5,.4,1);z-index:62;pointer-events:none;zoom:var(--z,1)'; phone.appendChild(im);
  requestAnimationFrame(() => requestAnimationFrame(() => im.style.transform = 'translateX(-50%) translateY(0)')); await _yayFx(t); im.style.transform = 'translateX(-50%) translateY(110%)'; setTimeout(() => im.remove(), 500); };
// at home: the hero sprite thinks or points while grandpa tells his story


// ---- fewer clicks: dialogs go on by themselves, cards close themselves, no extra pop-ups
let talkTok = 0;
const _talkAuto = talk; talk = function (who, txt, fact) { const tok = ++talkTok; const p = _talkAuto(who, txt, fact);
  const ms = 1600 + T(txt || '').length * 72 + (fact ? 1200 + T(fact).length * 60 : 0);
  const tryNext = () => { if (tok !== talkTok || !$('#dlg').classList.contains('on')) return; let busy = false; try { busy = (voA && !voA.paused && !voA.ended) || (window.speechSynthesis && window.speechSynthesis.speaking); } catch (e) {} if (busy) { setTimeout(tryNext, 400); return; } setTimeout(() => { if (tok === talkTok && $('#dlg').classList.contains('on')) $('#dNext').click(); }, 700); };
  setTimeout(tryNext, ms); return p; };
const _chapAuto = chapterCard; chapterCard = function (n, t, g) { const p = _chapAuto(n, t, g); setTimeout(() => { if ($('#chap').classList.contains('on')) { const b = $('#chGo'); b && b.click(); } }, 3600); return p; };
lightUp = async function (k) { st.lights[k] = Math.min(3, st.lights[k] + 1); thk.classList.add('on'); updLights(); pulseLight(k); chime(); buzz(40); await wait(1100); };
const _openCardAuto = openCard; openCard = function (id, fresh) { _openCardAuto(id, fresh); if (st.inStory) setTimeout(() => { if ($('#card').style.display !== 'none') closeCard(); }, 6500); };

playChapter = async function (n) {
  st.inStory = true; hideHud(false); glowStop(); hidePhoto(); lightsBase(n);
  await chapterCard(n, CHAPTERS[n].t, CHAPTERS[n].g);
  if (n === 0) {
    stage('home', .5, .6, .92); thk.classList.add('on');
    await K('Om Swastiastu! Ich bin Opa Ketut.');
    showPhoto('ph_reef', 'Bali, 1975'); await K('Schau! So bunt war unser Riff früher.');
    showPhoto('ph_school', 'Bali, 1975'); await K('Und so viele Fische!');
    showPhoto('ph_glow', 'Bali, 1976'); await K('Und nachts hat das Meer geleuchtet.', 'Manche Lebewesen machen selbst Licht.');
    hidePhoto();
    await Wy('Wow! Warum leuchtet es heute nicht mehr?');
    pulseLight('natur'); setTimeout(() => pulseLight('menschen'), 700); setTimeout(() => pulseLight('gott'), 1400);
    await K('Wir brauchen drei Lichter: Natur, Menschen und Göttliches.', 'Auf Bali heisst das Tri Hita Karana.');
    await K('Bringst du sie zum Leuchten?');
    await Wy('Ja! Zuerst ein Canang sari für den Schrein.');
    await offerAnim('shrine'); await lightUp('gott'); await yay('Das erste Licht!');
  }
  if (n === 1) {
    stage('beach', .3, .68, .9); beachTrash(true);
    await Wy('Oh nein! Überall Plastik!');
    await K('Früher war der Strand sauber. Räumst du auf?', 'Plastik bleibt Hunderte Jahre im Meer.');
    beachTrash(false); await gameBeach(); await yay('Strand sauber!');
    await lightUp('natur');
    await Wy('Und jetzt unter Wasser!');
  }
  if (n === 2) {
    stage('explore', .5, .62, 1); ex.plate.material.uniforms.bleach.value = 1; school.forEach((f) => f.visible = false); turtle.visible = false;
    reefTrash(true); await Wy('Auch hier Müll! Und keine Fische.');
    await Bn('Wayan … hörst du mich?');
    await Wy('Wer spricht da? Eine Stimme im Wasser!');
    await Bn('Ich bin Baruna, der Herr des Meeres. Mein Riff ist krank. Hilfst du mir?', 'Baruna hört man nur unter Wasser.');
    reefTrash(false); await gameReef(); await yay('Die Fische sind zurück!');
    await Bn('Korallen brauchen Licht. Lenk die Sonne zu ihnen!', 'In Korallen wohnen winzige Algen. Sie machen aus Licht Futter.');
    await gameLight(true); await yay('Die Farben sind zurück!');
    await Bn('Koralle und Alge helfen sich. Das ist Symbiose!');
    await lightUp('natur');
  }
  if (n === 3) {
    stage('beach', .24, .54, .9);
    await Wy('Opa! Unter Wasser spricht eine Stimme!');
    await K('Das ist Baruna, der Herr des Meeres. Er braucht dich.', 'Auf Bali ist Baruna der Gott des Meeres.');
    await Wy('Ich will tiefer tauchen!');
    await K('Dann lernst du Freediving: ruhig atmen, langsam runter.', 'Nie allein tauchen! Immer mit einem Buddy.');
    await Wy('Zuerst ein Canang sari fürs Meer. Danke, Meer!');
    await offerAnim('sea'); await lightUp('gott');
    await gameFreedive(); await yay('5 Meter tief!');
    stage('anemone', .5, .5, 1); st.clownAway = true;
    await Bn('Gut gemacht! Schau, dort ist die Anemone. Aber wo wohnt der Clownfisch?');
    await gameAnemone(); await yay('Er wohnt wieder hier!');
    await Wy('Ein Clownfisch! Tut ihm die Anemone nicht weh?');
    await Bn('Nein! Er hat eine Schutzschicht. Die zwei helfen sich.');
    await Bn('Mach 3 Fotos. Aber langsam!');
    hideHud(true); await gamePhoto(); hideHud(false); st.storyQuest = null; await yay('Super Fotos!');
    st.found.add('clownfish'); st.isNew.add('clownfish'); updCount(); openCard('clownfish', true); await waitCard();
  }
  if (n === 4) {
    stage('boatday', .5, .58, 1); ibuShow(true);
    await Wy('Das ist Ibu Komang aus dem Dorf. Sie lehrt mich tauchen!');
    await K('Menschen helfen Menschen. Das ist das zweite Licht.');
    await lightUp('menschen');
    await Wy('Komm, wir paddeln raus!');
    await gamePaddle(); await yay('Angekommen!');
    stage('manta', .5, .5, 1);
    await Bn('Willkommen bei Manta Point!');
    await Bn('Putzerfische putzen die Mantas. Beide haben etwas davon.');
    await Wy('Wir sind ganz still, wie an Nyepi.', 'An Nyepi ist ganz Bali still, sogar der Flughafen.');
    await gameStill(); await yay('Die Mantas sind da!');
  }
  if (n === 5) {
    stage('night', .48, .27, 1);
    await Wy('Vollmond! Schau, wie hell der Mond ins Wasser scheint.');
    setView(.5, .5, 1); spawnWonder(7); await Bn('Schau ganz still zu: Meine Korallen schicken Babys ins Wasser.', 'Das heisst Korallen-Laichen.');
    await Bn('Und jetzt fang sie!');
    await gameSpawn(); await yay('Gerettet!');
    stage('boat', .5, .55, .92);
    await Wy('Ab zur Station. Halt die Schale gerade!');
    let ok = false, tries = 0; while (!ok && tries < 3) { ok = await gameBowl(); tries++; if (!ok && tries < 3) await Wy('Nochmal, ganz ruhig!'); }
    await yay('Geschafft!');
    stage('base', .5, .5, 1);
    await K('Jetzt pflanzen wir sie auf einen CoralCone.', 'Ein CoralCone ist ein Stein, auf dem Korallen-Babys wachsen.');
    await gamePlant(); await yay('Gepflanzt!');
    { const f = farmLoad(); if (!f.on) f.c.forEach((c, i) => { c.a = Math.max(c.a, 1 + (i % 2)); }); f.on = true; farmSave(f); }
    await K('Ein paar Korallen-Babys wachsen jetzt in deiner Korallenfarm. Schau oft nach ihnen!');
    await openFarm();
    village.visible = true; stage('beach', .33, .56, .9);
    await Wy('Das ganze Dorf hilft mit!');
    await lightUp('menschen');
  }
  if (n === 6) {
    stage('mangrove', .86, .62, 1);
    await Wy('Was sind das für Bäume?');
    await K('Mangroven! Ihre Wurzeln halten den Sand fest.');
    await K('Und Babyfische wohnen darin.', 'Viele Rifffische wachsen in Mangroven auf.');
    await gameMangrove(); setView(.89, .62, 1); await yay('5 Mangroven!');
    await K('Achtung, eine grosse Welle kommt!');
    await waveTest(); await yay('Der Sand bleibt!');
    await lightUp('natur');
  }
  if (n === 7) {
    village.visible = true; stage('beach', .33, .56, .9);
    await Wy('Heute ist Fest! Alle danken dem Meer.', 'Das Fest heisst Segara Kerthi: das Meer ehren.');
    await gameOffer(); village.visible = false;
    await lightUp('gott'); await lightUp('menschen');
    await K('Alle drei Lichter leuchten! Komm, heute Nacht ans Wasser.');
    stage('glow', .14, .6, 1); glowStart();
    await gameGlow(); await yay('Das Meer leuchtet!');
    showPhoto('ph_glow', 'Opas Foto, 1976');
    await K('Genau wie damals! Danke, Wayan.');
    hidePhoto();
    await K('Hörst du die Wellen? Baruna sagt Danke. Bali leuchtet wieder.');
    await K('Bald rufen dich die anderen Inseln.');
    await new Promise((r) => { $('#cert').classList.add('on'); chime(); speak('Urkunde. Riff-Hüterin und Riff-Hüter!'); $('#certOk').onclick = () => { $('#cert').classList.remove('on'); r(); }; });
    await K('Jetzt kannst du frei tauchen. Bis bald!');
    glowStop();
  }
  $$('.yayPose').forEach((e) => e.remove()); beachTrash(false); ibuShow(false);
  st.chapter = Math.max(st.chapter, n + 1); save(); farmBoost(.15); village.visible = false; st.inStory = false; hideHud(false); mgClose(); hidePhoto();
  show('map', 'map'); renderDots(); updStoryCard();
};
window.__games.playChapter = (n) => playChapter(n);
updStoryCard();


{ const qs = document.createElement('style'); qs.textContent = '@keyframes chapIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}#chap.on{animation:chapIn .4s ease-out}#dWho{white-space:nowrap;font-size:14px}'; document.head.appendChild(qs); }
// ---- visible beach trash in the chapter-1 dialog (the mini-game uses tappable overlays instead)
const BT = await Promise.all([['bottle', .27, .68], ['bag', .33, .76], ['can', .36, .66], ['cup', .24, .72]].map(([k, u, v]) => new Promise((r) => loader.load('assets/it_' + k + '.png', (t) => { t.colorSpace = THREE.NoColorSpace; const m = makeSprite(t, k === 'bag' || k === 'cup' ? 2.4 : 1.8, 0, { fogColor: [0, 0, 0] }); m.visible = false; be.sc.add(m); place(m, be, u, v, .7); r(m); }, undefined, () => r(null)))));
function beachTrash(on) { BT.forEach((m) => { if (m) m.visible = on; }); }
// ---- Android back button: close the top layer, leave a game only after asking, never drop out of the app by accident
{ const qs = document.createElement('style'); qs.textContent = '#backAsk{position:absolute;inset:0;z-index:400;background:rgba(6,21,43,.72);display:none;align-items:center;justify-content:center;zoom:var(--z,1)}#backAsk.on{display:flex}#backAsk .box{background:#fff;color:#0B1F3A;border-radius:24px;padding:22px 18px;width:290px;display:flex;flex-direction:column;gap:16px;text-align:center}#backAsk b{font-family:"Baloo 2";font-size:24px;line-height:1.1}#backAsk .row{display:flex;gap:10px}#backAsk button{height:50px;flex:1;border-radius:16px;font-weight:800;font-size:16px;border:0}#backAsk #baYes{background:#FF8A5B;color:#0B1F3A}#backAsk #baNo{background:#E8F1F7;color:#0B1F3A}'; document.head.appendChild(qs);
  const qb = document.createElement('div'); qb.id = 'backAsk'; qb.innerHTML = '<div class="box"><b id="baT"></b><div class="row"><button id="baNo"></button><button id="baYes"></button></div></div>'; phone.appendChild(qb);
  const ask = (q, yes, no, onYes) => { $('#baT').textContent = T(q); $('#baYes').textContent = T(yes); $('#baNo').textContent = T(no); qb.classList.add('on'); $('#baYes').onclick = () => { qb.classList.remove('on'); onYes(); }; $('#baNo').onclick = () => qb.classList.remove('on'); };
  const on = (sel) => { const e = $(sel); return !!(e && e.classList.contains('on')); };
  const exitApp = () => { try { window.Capacitor.nativePromise('App', 'exitApp', {}); } catch (e) {} };
  const toMap = () => { try { voStop && voStop(); } catch (e) {} try { if (sessionStorage.getItem('seaju_resume') !== 'arcade') sessionStorage.setItem('seaju_resume', 'map'); } catch (e) {} location.reload(); };
  function onBack() {
    if (on('#backAsk')) { qb.classList.remove('on'); return; }
    if (on('#profPick')) { $('#profPick').classList.remove('on'); return; }
    if (on('#chapPick')) { $('#chapPick').classList.remove('on'); return; }
    if (on('#parents')) { $('#parents').classList.remove('on'); return; }
    if ($('#card') && $('#card').style.display !== 'none') { closeCard(); return; }
    if (on('#coach')) return;
    if (on('#score')) { $('#score').classList.remove('on'); show('map', 'map'); openArcade(); return; }
    if (st.inArcade) { ask('Spiel verlassen?', 'Zur Spielhalle', 'Weiterspielen', () => { try { sessionStorage.setItem('seaju_resume', 'arcade'); } catch (e) {} toMap(); }); return; }
    if (st.inStory || on('#mg')) { ask('Spiel verlassen?', 'Zur Karte', 'Weiterspielen', toMap); return; }
    if (on('#arcade')) { $('#arcade').classList.remove('on'); return; }
    if ($('#title') || st.screen === 'map') { ask('App beenden?', 'Beenden', 'Bleiben', exitApp); return; }
    show('map', 'map'); renderDots();
  }
  document.addEventListener('backbutton', onBack); window.__back = onBack;
  try { const r = sessionStorage.getItem('seaju_resume'); if (r) { sessionStorage.removeItem('seaju_resume'); const t = $('#title'); if (t) t.remove(); if (r === 'arcade') setTimeout(() => openArcade(), 300); } } catch (e) {} }
// ---- control hint pill: hidden by default, shown only when the child seems stuck or the gyro gives nothing
{ const qs = document.createElement('style'); qs.textContent = '#mgCtl{transition:opacity .35s}#mg.hintOff #mgCtl{opacity:0;pointer-events:none}'; document.head.appendChild(qs);
  let lastAct = Date.now(), showUntil = 0, lastOri = 0, oriRef = null, openAt = 0, wasOn = false;
  window.addEventListener('deviceorientation', (e) => { if (e.beta == null) return; lastOri = Date.now();
    if (!oriRef) oriRef = [e.beta, e.gamma]; if (Math.abs(e.beta - oriRef[0]) + Math.abs(e.gamma - oriRef[1]) > 10) { oriRef = [e.beta, e.gamma]; lastAct = Date.now(); } });
  phone.addEventListener('pointerdown', () => { lastAct = Date.now(); }, true);
  setInterval(() => { const m = $('#mg'), c = $('#mgCtl'); if (!m || !c) return; const now = Date.now();
    const isOn = m.classList.contains('on'); if (isOn && !wasOn) { openAt = now; lastAct = now; showUntil = 0; } wasOn = isOn; if (!isOn) return;
    if (c.querySelector('button')) { m.classList.remove('hintOff'); return; } // real controls stay visible
    const gyroOk = !st.gyroOff && sens.has && now - lastOri < 1500;
    const lim = gyroOk ? 9000 : (now - openAt < 6000 ? 4000 : 6000);
    if (now < showUntil) { m.classList.remove('hintOff'); return; }
    if (now - lastAct > lim) { showUntil = now + 4000; lastAct = now; m.classList.remove('hintOff'); return; }
    m.classList.add('hintOff'); }, 250); }
// ================= READING DIALOG: one running text per speaker, words light up with the voice, goes on by itself =================
{ const qs = document.createElement('style'); qs.textContent = `
#dlg .dbox{gap:8px;padding:14px 16px 12px}
#dlg #dTxt{max-height:36vh;overflow:hidden;position:relative;scroll-behavior:smooth;font-weight:800;font-size:19px;line-height:1.55;color:#0B1F3A}
#dlg #dTxt p{margin:0 0 6px}
#dlg #dTxt p.factp{font-size:15px;line-height:1.5;background:#E6F7FA;border-radius:12px;padding:6px 10px;color:#1F6FA8}
#dlg #dTxt .w{color:#A9B9C7;transition:color .12s,background .12s;border-radius:6px;padding:0 1px}
#dlg #dTxt p.factp .w{color:#9BC2D6}
#dlg #dTxt .w.on{color:#0B1F3A}#dlg #dTxt p.factp .w.on{color:#1F6FA8}
#dlg #dTxt .w.cur{color:#0B1F3A;background:#FFD84A}
#dlg #dFact{display:none!important}
#dlg #dNext{display:none}
#dlg .drow{justify-content:space-between;align-items:center;min-height:36px}
#dlg .rhint{font-weight:800;font-size:13px;color:#7F93A8;display:flex;align-items:center;gap:6px}
#dlg .rhint i{display:inline-block;width:0;height:0;border-left:9px solid #FF8A5B;border-top:6px solid transparent;border-bottom:6px solid transparent;animation:rh 1.1s infinite}
@keyframes rh{50%{transform:translateX(3px);opacity:.6}}
#dlg .dbox.fresh{animation:spin .3s ease-out}`; document.head.appendChild(qs);
  const row = $('#dlg .drow'); if (row && !row.querySelector('.rhint')) { const h = document.createElement('span'); h.className = 'rhint'; h.innerHTML = '<span class="rhtxt"></span><i></i>'; row.appendChild(h); }
  let lastWho = null, rdTimers = [], rdTok = 0, hideT = 0;
  const clearTimers = () => { rdTimers.forEach(clearTimeout); rdTimers = []; };
  function wordSpans(seg, idx, cls) { const p = document.createElement('p'); if (cls) p.className = cls;
    seg.split(/\s+/).filter(Boolean).forEach((w, i) => { const sp = document.createElement('span'); sp.className = 'w'; sp.dataset.seg = idx; sp.textContent = w; p.appendChild(sp); p.appendChild(document.createTextNode(' ')); }); return p; }
  function segDur(s) { return .35 + s.length * (LANG === 'id' ? .085 : LANG === 'en' ? .07 : .075); }
  // speak with timing callbacks: onSeg(i, seconds) when segment i starts
  function speakTimed(text, who, onSeg) { const t = T(text); const segs = splitSeg(t); const M = (VO[LANG] || {}); voStop(); const tok = voToken; curWho = who;
    return (async () => { for (let i = 0; i < segs.length; i++) { if (tok !== voToken) return false; const sg = segs[i]; const k = norm(sg); const f = (M[who] && M[who][k]) || (who === 'kakek' && M.thalassa && M.thalassa[k]); const est = segDur(sg);
        if (f) { await new Promise((res) => { const a = new Audio('assets/vo/' + f); voA = a; let told = false; const go = (d) => { if (told) return; told = true; onSeg(i, d); };
            a.onplay = () => go(isFinite(a.duration) && a.duration > .2 ? a.duration : est); a.onended = () => setTimeout(res, 90); a.onerror = () => { go(est); setTimeout(res, est * 1000); };
            a.play().catch(() => { go(est); setTimeout(res, est * 1000); }); }); }
        else { onSeg(i, est); await new Promise((res) => { let done = false; const fin = () => { if (!done) { done = true; res(); } }; ttsFallback(sg, fin); setTimeout(fin, est * 1000 + 1500); }); }
        if (tok !== voToken) return false; }
      return tok === voToken; })(); }
  function hideDlg() { $('#dlg').classList.remove('on'); phone.classList.remove('uw'); lastWho = null; $('#dTxt').innerHTML = ''; }
  window.__hideDlg = hideDlg;
  talk = function (who, txt, fact) { return new Promise((res) => { clearTimeout(hideT); clearTimers(); const tok = ++rdTok;
    const dlg = $('#dlg'), box = $('#dlg .dbox'), tx = $('#dTxt');
    const same = lastWho === who && dlg.classList.contains('on');
    if (!same) { tx.innerHTML = ''; const p = facePor(who, txt); $('#dPor').innerHTML = p || POR[who]; $('#dPor').style.background = PORBG[who] || '#BFF3FA'; $('#dWho').textContent = T(WHO[who]); box.classList.remove('fresh'); void box.offsetWidth; box.classList.add('fresh'); }
    else { const p = facePor(who, txt); if (p) $('#dPor').innerHTML = p; tx.querySelectorAll('.w').forEach((w) => { w.classList.remove('cur'); w.classList.add('on'); }); }
    lastWho = who;
    const uw = who === 'baruna'; if (uw && !phone.classList.contains('uw')) { blip(180, 90, .9, .1); blip(600, 1200, .6, .03); } phone.classList.toggle('uw', uw);
    const full = txt + (fact ? ' Wusstest du? ' + fact : '');
    const t = T(full); const segs = splitSeg(t); const nMain = splitSeg(T(txt)).length;
    const paras = []; segs.forEach((sg, i) => { const isFact = i >= nMain; const last = paras[paras.length - 1];
      if (last && last.isFact === isFact) { const tmpP = wordSpans(sg, i); while (tmpP.firstChild) last.el.appendChild(tmpP.firstChild); }
      else { const el = wordSpans(sg, i, isFact ? 'factp' : ''); paras.push({ el, isFact }); tx.appendChild(el); } });
    const words = [...tx.querySelectorAll('.w')].filter((w) => !w.classList.contains('on'));
    dlg.classList.add('on'); $('#dlg .rhtxt').textContent = '';
    const scrollTo = (el) => { const top = el.offsetTop - tx.clientHeight * .55; tx.scrollTop = Math.max(0, top); };
    const lightAll = () => { words.forEach((w) => { w.classList.remove('cur'); w.classList.add('on'); }); };
    let finished = false;
    const finish = (skip) => { if (finished) return; finished = true; clearTimers(); lightAll(); if (skip) voStop(); dlg.onclick = null; $('#dNext').onclick = null; blip(500, 700, .06, .04);
      hideT = setTimeout(() => { if (tok === rdTok) hideDlg(); }, 1200); res(); };
    const onSeg = (i, dur) => { if (tok !== rdTok || finished) return; clearTimers(); words.forEach((w) => { if (+w.dataset.seg < i) { w.classList.remove('cur'); w.classList.add('on'); } });
      const ws = words.filter((w) => +w.dataset.seg === i); const tot = ws.reduce((a, w) => a + w.textContent.length + 1.5, 0); let cum = 0;
      ws.forEach((w, j) => { const at = dur * 1000 * cum / tot; cum += w.textContent.length + 1.5;
        rdTimers.push(setTimeout(() => { if (tok !== rdTok) return; ws.forEach((x, k) => { if (k < j) { x.classList.remove('cur'); x.classList.add('on'); } }); w.classList.add('cur'); scrollTo(w); }, at)); });
      rdTimers.push(setTimeout(() => { ws.forEach((x) => { x.classList.remove('cur'); x.classList.add('on'); }); }, dur * 1000)); };
    speakTimed(full, who, onSeg).then((ok) => { if (tok !== rdTok || finished) return; rdTimers.push(setTimeout(() => finish(false), 650)); });
    const replay = (e) => { e.stopPropagation(); if (finished) { words.forEach((w) => w.classList.remove('on')); finished = false; clearTimeout(hideT); speakTimed(full, who, onSeg).then(() => { if (tok === rdTok && !finished) rdTimers.push(setTimeout(() => finish(false), 650)); }); } else { speakTimed(full, who, onSeg); } };
    $('#dSpeak').onclick = replay;
    $('#dNext').onclick = (e) => { e && e.stopPropagation(); finish(true); };
    setTimeout(() => { if (tok !== rdTok) return; $('#dlg .rhtxt').textContent = T('Tippen = weiter'); dlg.onclick = (e) => { if (e.target.closest('#dSpeak')) return; finish(true); }; }, 500);
  }); };
  // hide the box when a mini-game, a card or a success moment takes over
  const _mgOpenR = mgOpen; mgOpen = function (...a) { hideDlg(); clearTimers(); rdTok++; return _mgOpenR(...a); };
  const _yayR = yay; yay = async function (t) { hideDlg(); return _yayR(t); };
  const _chapR = chapterCard; chapterCard = function (...a) { hideDlg(); return _chapR(...a); };
}
// ---- story props: trash lying in the reef during the chapter-2 dialog; a canang sari that is placed as an offering
const RT = await Promise.all([['bag', .3, .66], ['can', .46, .72], ['bottle', .58, .7], ['cup', .4, .75]].map(([k, u, v]) => new Promise((r) => loader.load('assets/it_' + k + '.png', (t) => { t.colorSpace = THREE.NoColorSpace; const m = makeSprite(t, k === 'bag' ? 2.2 : 1.6, 0, { fogColor: [0, 0, 0] }); m.visible = false; ex.sc.add(m); place(m, ex, u, v, .7); r(m); }, undefined, () => r(null)))));
function reefTrash(on) { RT.forEach((m) => { if (m) m.visible = on; }); }
function offerAnim(where) { return new Promise((res) => { const im = new Image(); im.src = 'assets/it_canang1.png'; const sea = where === 'sea';
  im.style.cssText = `position:absolute;left:50%;top:78%;width:96px;transform:translate(-50%,-50%) scale(.6);opacity:0;transition:all 1.6s ease-in-out;z-index:61;pointer-events:none;zoom:var(--z,1);filter:drop-shadow(0 8px 12px rgba(0,0,0,.35))`;
  phone.appendChild(im); blip(600, 900, .3, .06);
  requestAnimationFrame(() => requestAnimationFrame(() => { im.style.opacity = 1; im.style.transform = sea ? 'translate(-50%,-50%) scale(.45) translateY(-170px)' : 'translate(-50%,-50%) scale(.9) translateY(-120px)'; }));
  setTimeout(() => { im.style.transition = 'all .9s'; im.style.opacity = 0; }, 1800); setTimeout(() => { im.remove(); res(); }, 2500); }); }
// ================= FREE DIVE IN 360°: four places on Bali, look around instead of choosing a depth =================
await new Promise((r) => loader.load('assets/pano_kri.jpg', (t) => { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; tex.pano_kri = t; r(); }, undefined, () => r()));
if (tex.pano_kri) toPano(kr, 'pano_kri', { wobble: .5, caustic: .8, rays: .12 });
{ const P = { start: { plate: 'explore', name: 'Riff', depth: 5, view: [.5, .5, 1], l: null, r: 'anemone' },
    anemone: { plate: 'anemone', name: 'Anemone', depth: 3, view: [.5, .5, 1], l: 'start', r: 'manta' },
    manta: { plate: 'manta', name: 'Manta Point', depth: 10, view: [.5, .42, 1], l: 'anemone', r: 'kri', locked: () => (st.chapter || 0) < 5 ? 'Manta Point öffnet sich nach Kapitel 4.' : '' },
    kri: { plate: 'kri', name: 'Tulamben', depth: 15, view: [.58, .5, 1], l: 'manta', r: null, locked: () => st.found.size < UNLOCK && (st.chapter || 0) < 8 ? `Tulamben öffnet sich, wenn du ${UNLOCK} Tiere gefunden hast. Dir fehlen noch ${UNLOCK - st.found.size}.` : '' } };
  for (const k of Object.keys(NODES)) delete NODES[k];
  for (const [k, v] of Object.entries(P)) NODES[k] = Object.assign({ depths: [v.depth, v.depth, v.depth], views: [v.view, v.view, v.view] }, v);
  NODES.left = NODES.steg = NODES.jetty = NODES.fan = NODES.start; // old names still resolve to the reef
  LINE.splice(0, LINE.length, 'start', 'anemone', 'manta', 'kri');
  QUESTS.splice(0, QUESTS.length,
    { id: 'turtle', txt: 'Finde die Schildkröte im Riff', node: 'start', lvl: null },
    { id: 'clownfish', txt: 'Schwimm zur Anemone. Wer wohnt dort?', node: 'anemone', lvl: null },
    { id: 'reefshark', txt: 'Schau zum Sandgrund: Dort schwimmt ein kleiner Riffhai', node: 'start', lvl: null },
    { id: 'seahorse', txt: 'Such das winzige Seepferdchen an der Fächerkoralle', node: 'start', lvl: null },
    { id: 'manta', txt: 'Besuch die Mantas am Manta Point', node: 'manta', lvl: null },
    { id: 'parrotfish', txt: 'Tulamben ist offen! Finde den grossen Papageifisch am Wrack', node: 'kri', lvl: null });
  SITES.arborek.say = 'Am Amed-Riff wohnen Schildkröten, Clownfische und ein kleiner Riffhai.';
  COACH[0].txt = 'Tippe auf die Pfeile links und rechts. Dann schwimmst du zum nächsten Tauchplatz.';
  COACH[1] = { sel: '#depth', txt: 'Dreh dich um oder wisch: Tiere verstecken sich oben, unten und hinter dir!' };
  // Bali animals in the reef panorama: turtle, a small blacktip reef shark over the sand, the pygmy seahorse on the fan coral
  ex.sc.remove(wobbe); fa.sc.remove(seahorse); ex.sc.add(seahorse); seahorse.scale.set(1.7, 1.7, 1);
  const rshark = spr(ex, tex.sp_reefshark, 3.4, 1, { amp: .05, speed: 2.2 });
  const _animEx = animExplore; animExplore = function () { _animEx();
    const a = clock * .09; place(rshark, ex, .64 + Math.sin(a) * .1, .8 + Math.sin(a * 2.3) * .015, .55); rshark.scale.x = Math.cos(a) > 0 ? -1 : 1; rshark.rotation.z = Math.sin(a * 2.3) * .06;
    place(seahorse, ex, .095, .53, .8); seahorse.rotation.z = Math.sin(clock * .8) * .06; };
  // Tulamben: the parrotfish swims where the big painted one is, so a tap there always works; the schools stay high above the wreck
  animKri = function () { parrots.forEach((p, i) => { const t = clock * .15 + p.userData.ph; if (i === 0) { place(p, kr, .125 + Math.sin(t) * .008, .735 + Math.sin(t * 1.4) * .006, .93); p.scale.set(3.2, 3.2, 1); p.scale.x = 3.2; } else { place(p, kr, .3 + Math.sin(t) * .05 + i * .05, .6 + Math.sin(t * 1.4) * .012, .6); p.scale.x = Math.cos(t) > 0 ? 1 : -1; } });
    animSchool(kr, kSchoolA, .4, .25, .45, .12); animSchool(kr, kSchoolB, .62, .28, .5, .14); };
  // targets: what the yellow ring points to
  targets = function () { const T = []; if (st.screen !== 'explore') return T; const lbl = (id, name) => st.found.has(id) ? name : 'Neues Tier!';
    if (st.scene === 'explore') { T.push({ obj: turtle, lbl: lbl('turtle', 'Schildkröte'), vis: () => onScreen(turtle), hit: () => discover('turtle') });
      T.push({ obj: rshark, lbl: lbl('reefshark', 'Riffhai'), vis: () => onScreen(rshark), hit: () => discover('reefshark') });
      T.push({ obj: seahorse, lbl: lbl('seahorse', 'Seepferdchen'), vis: () => onScreen(seahorse, 10), hit: () => discover('seahorse') }); }
    if (st.scene === 'anemone') T.push({ obj: clowns[0], lbl: lbl('clownfish', 'Clownfisch'), vis: () => onScreen(clowns[0]), hit: () => discover('clownfish') });
    if (st.scene === 'manta') T.push({ obj: mantas[0], lbl: lbl('manta', 'Riffmanta'), vis: () => onScreen(mantas[0]), hit: () => discover('manta') });
    if (st.scene === 'kri') T.push({ obj: parrots[0], lbl: lbl('parrotfish', 'Papageifisch'), vis: () => onScreen(parrots[0]), hit: () => discover('parrotfish') });
    return T.sort((a, b) => (/Neues/.test(b.lbl) ? 1 : 0) - (/Neues/.test(a.lbl) ? 1 : 0)); };
  // quest direction: to the place first, then to where the animal is in the 360° view
  questDir = function (q) { if (!q) return ['', 'Fertig!']; const a = LINE.indexOf(st.node), b = LINE.indexOf(q.node);
    if (b < a) return ['l', 'Links']; if (b > a) { const lk = NODES[q.node].locked && NODES[q.node].locked(); return lk ? ['m', q.node === 'manta' ? 'Kapitel 4' : 'Gesperrt'] : ['r', 'Rechts']; }
    const t = targets().find((x) => x.lbl && /Neues/.test(x.lbl)); if (!t) return ['s', 'Hier!']; const [x, y, z] = posOf(t); const w = W, h = H;
    if (z < 1 && x > 30 && x < w - 30 && y > 120 * Z && y < h - 110 * Z) return ['s', 'Hier!'];
    if (z >= 1 || x < 30 || x > w - 30) return [x < w / 2 ? 'l' : 'r', x < w / 2 ? 'Dreh links' : 'Dreh rechts']; return [y < h / 2 ? 'u' : 'd', y < h / 2 ? 'Schau hoch' : 'Schau runter']; };
  updNav = function () { const n = NODES[st.node]; const lk = (k) => k && NODES[k].locked && NODES[k].locked();
    $('#edgeL').hidden = !n.l; $('#edgeR').hidden = !n.r; $('#edgeLt').textContent = n.l ? T(NODES[n.l].name) : ''; $('#edgeRt').textContent = n.r ? T(NODES[n.r].name) + (lk(n.r) ? ' 🔒' : '') : '';
    $('#side').style.visibility = 'hidden'; $('#depth').textContent = n.depth + ' m'; updQuest(); };
  depth = function () {};
  move = function (dir) { const n = NODES[st.node]; const t = dir < 0 ? n.l : n.r; if (!t) { blip(250, 180, .12); say('Da geht es nicht weiter.'); return; }
    const lk = NODES[t].locked && NODES[t].locked(); if (lk) { blip(300, 200, .2); say(lk); return; }
    swimDir = dir; swimT = 1.6; blip(420, 760, .18); transition(() => { goNode(t, 1, true); arriveSay(t); }); };
  goNode = function (id, lvl, instant) { const n = NODES[id] || NODES.start; st.node = LINE.includes(id) ? id : 'start'; st.lvl = 1; useScene(n.plate); setView(n.view[0], n.view[1], n.view[2], true);
    diver.visible = n.plate !== 'anemone'; if (n.plate === 'manta') { st.calm = 1; st.mdone = true; } updNav(); };
  arriveSay = function (id) { const q = curQuest(); const name = T(NODES[id].name); setTimeout(() => { if (q && q.node === id) say(`${name}! ${T('Schau dich um, hier ist etwas!')}`); else say(name + '.', false); }, 900); };
  for (const [sel, d] of [['#edgeL', -1], ['#edgeR', 1]]) { const b = $(sel); const nb = b.cloneNode(true); b.replaceWith(nb); nb.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); move(d); }); }
  const qb = $('#quest'); const nq = qb.cloneNode(true); qb.replaceWith(nq); nq.addEventListener('click', (e) => { e.stopPropagation(); const q = curQuest(); if (!q) return say('Du hast alle Aufgaben geschafft!'); const [k] = questDir(q);
    const hint = { l: 'Schwimm nach links!', r: 'Schwimm nach rechts!', d: 'Schau nach unten!', u: 'Schau nach oben!', m: 'Das ist noch zu. Spiel zuerst die Geschichte weiter!', s: 'Hier ist es! Such den gelben Ring oder drück die Lupe!' }[k];
    say(q.txt + '. ' + hint); });
  startExplore = function (node) { show('explore'); goNode(node === 'kri' ? 'kri' : 'start', 1, true); updCount(); setAir(); if (!st.tutDone) setTimeout(coachStart, 700); else setTimeout(() => { const q = curQuest(); if (q) say(q.txt); }, 600); };
  { const gd = $('#goDive'); const ng = gd.cloneNode(true); gd.replaceWith(ng); ng.addEventListener('click', () => { audioInit(); buzz(); if (st.site === 'manta') transition(startMission); else if (st.site === 'kri') transition(() => startExplore('kri')); else transition(() => startExplore('start')); }); }
  { const bd = $('#backDive'); const nb = bd.cloneNode(true); bd.replaceWith(nb); nb.addEventListener('click', () => { const r = st.returnTo; st.returnTo = null; if (!r) return; show('explore'); goNode(r.node, 1, true); }); }
}
// the little diver in the free-dive view is the chosen hero
setInterval(() => { const t = st.hero === 'ayu' ? tex.adiver : tex.wdiver; if (t && diver.material.uniforms.map.value !== t) { diver.material.uniforms.map.value = t; } }, 500);
// ---- dive mask: the glass frame lies over the game items, the game title bar stays on top
{ const qs = document.createElement('style'); qs.textContent = '#mg #mask{z-index:2;position:absolute;inset:0}#mg #mgLayer{z-index:1}#mg .mgtop,#mg #mgCtl,#mg .photos,#mg .flash,#mg .vf{z-index:5}#mg .mgtop{position:absolute}'; document.head.appendChild(qs);
  const svgNS = 'http://www.w3.org/2000/svg'; const cs = document.createElementNS(svgNS, 'svg'); cs.setAttribute('width', '0'); cs.setAttribute('height', '0'); cs.style.position = 'absolute';
  cs.innerHTML = '<defs><clipPath id="mgclip" clipPathUnits="objectBoundingBox"><path d="M.08 .2247 C.08 .1236 .22 .0899 .38 .1011 C.44 .1067 .47 .1348 .5 .1348 C.53 .1348 .56 .1067 .62 .1011 C.78 .0899 .92 .1236 .92 .2247 L.92 .8427 C.92 .9213 .8 .9551 .64 .9438 C.56 .9382 .54 .8989 .5 .8989 C.46 .8989 .44 .9382 .36 .9438 C.2 .9551 .08 .9213 .08 .8427 Z"/></clipPath></defs>'; document.body.appendChild(cs);
  const qs2 = document.createElement('style'); qs2.textContent = '#mgLayer.masked{clip-path:url(#mgclip)}'; document.head.appendChild(qs2);
  setInterval(() => { $('#mgLayer').classList.toggle('masked', $('#mask').classList.contains('on') && $('#mg').classList.contains('on')); }, 200);
  const mk = $('#mask'); if (mk) { const _o = mgOpen, _c = mgClose; mgOpen = function (...a) { const r = _o(...a); if (mk.parentElement !== $('#mg')) $('#mg').insertBefore(mk, $('#mgLayer').nextSibling); return r; };
    mgClose = function (...a) { const r = _c(...a); if (mk.parentElement !== phone) phone.appendChild(mk); return r; }; } }
// ---- Ibu Komang, the village dive teacher, sits at the bow during chapter 4
const ibuTex = await new Promise((r) => loader.load('assets/ibu.png', (t) => { t.colorSpace = THREE.NoColorSpace; r(t); }, undefined, () => r(null)));
const ibu = ibuTex ? makeSprite(ibuTex, 2.6, 4, { amp: .03, speed: 1.2, fogColor: [0, 0, 0] }) : null; if (ibu) { ibu.visible = false; bday.sc.add(ibu); all.push(ibu); place(ibu, bday, .5, .66, .97); }
function ibuShow(on) { if (ibu) ibu.visible = on; }
// ---- settings button (everywhere) and a settings page: tilt, language, who plays, age, start screen, parents
{ const qs = document.createElement('style'); qs.textContent = `
#setBtn{position:absolute;top:max(12px,env(safe-area-inset-top));left:12px;z-index:13;width:40px;height:40px;border-radius:20px;border:2px solid rgba(255,255,255,.85);background:rgba(6,21,43,.45);display:flex;align-items:center;justify-content:center;zoom:var(--z,1)}
#setBtn.hide,.cardon #setBtn,#mg.on~#setBtn{display:none}
#explore.on~#setBtn,#mission.on~#setBtn{top:auto;bottom:118px;left:auto;right:12px}
#setPanel{position:absolute;inset:0;z-index:330;background:rgba(6,21,43,.94);display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#fff;zoom:var(--z,1);padding:20px}
#setPanel.on{display:flex}
#setPanel .row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
#setPanel .ghost.act{background:#fff;color:#0B1F3A}
#setPanel .big{width:270px;height:52px;border-radius:18px;border:0;background:#fff;color:#0B1F3A;font-weight:800;font-size:17px}`; document.head.appendChild(qs);
  const b = document.createElement('button'); b.id = 'setBtn'; b.setAttribute('aria-label', 'Einstellungen'); b.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'; phone.appendChild(b);
  const pn = document.createElement('div'); pn.id = 'setPanel'; phone.appendChild(pn);
  function openSettings() { const i = profInfo(PROF.act);
    pn.innerHTML = `<span class="baloo" style="font-size:28px">${T('Einstellungen')}</span>
      <div class="row"><button class="ghost gyroT">${st.gyroOff ? 'Neigen: aus' : 'Neigen: an'}</button></div>
      <div class="row">${['de', 'en', 'id'].map((l) => `<button class="ghost langb ${LANG === l ? 'act' : ''}" data-l="${l}">${{ de: 'Deutsch', en: 'English', id: 'Bahasa' }[l]}</button>`).join('')}</div>
      <div class="row">${['5', '7', '10'].map((a) => `<button class="ghost ageb ${st.age === a ? 'act' : ''}" data-age="${a}">${T('Alter')} ${AGE[a].label}</button>`).join('')}</div>
      <button class="big" id="spProf">${T('Wer spielt?')}: ${i.name}</button>
      <button class="big" id="spTitle">${T('Zum Startbild')}</button>
      <button class="big" id="spParents">${T('Für Eltern')}</button>
      <button class="big" id="spUpd">${T('Nach Update suchen')}</button>
      <button class="ghost" id="spClose" style="margin-top:8px">${T('Zurück')}</button>`;
    pn.classList.add('on');
    pn.querySelector('.gyroT').onclick = (e) => { setGyro(!st.gyroOff); e.target.textContent = st.gyroOff ? 'Neigen: aus' : 'Neigen: an'; };
    pn.querySelectorAll('.langb').forEach((x) => x.onclick = () => { setLang(x.dataset.l); openSettings(); });
    pn.querySelectorAll('.ageb').forEach((x) => x.onclick = () => { st.age = x.dataset.age; try { localStorage.setItem('seaju_age', st.age); } catch (e) {} openSettings(); });
    $('#spProf').onclick = () => { pn.classList.remove('on'); openProfiles(); };
    $('#spTitle').onclick = () => { try { voStop(); } catch (e) {} try { sessionStorage.removeItem('seaju_resume'); } catch (e) {} location.reload(); };
    $('#spParents').onclick = () => { pn.classList.remove('on'); const pb = document.querySelector('[data-act="parents"]'); pb && pb.click(); };
    $('#spUpd').onclick = () => { pn.classList.remove('on'); checkUpdate(true); };
    $('#spClose').onclick = () => pn.classList.remove('on'); sweep(pn); }
  b.onclick = (e) => { e.stopPropagation(); audioInit(); openSettings(); };
  setInterval(() => { b.classList.toggle('hide', !!$('#title') || $('#mg').classList.contains('on') || $('#dlg').classList.contains('on') || $('#chap').classList.contains('on') || $('#coach').classList.contains('on') || !!$('.yayPose') || $('#cert').classList.contains('on')); }, 300);
  const _ob = window.__back; window.__back = function () { if (pn.classList.contains('on')) { pn.classList.remove('on'); return; } return _ob(); }; document.removeEventListener('backbutton', _ob); document.addEventListener('backbutton', window.__back); }
// ---- the hero diver in the free-dive view: the chosen hero, big enough for the wide 360° view
{ const mk = (t) => { const m = makeSprite(t, 1, 3, { amp: .05, speed: 4, fogColor: [0, 0, 0] }); m.material.depthTest = false; m.renderOrder = 10; m.visible = false; camera.add(m); all.push(m); return m; };
  const HD = { wayan: tex.wdiver ? mk(tex.wdiver) : null, ayu: tex.adiver ? mk(tex.adiver) : null };
  const _sfD = storyFrame; storyFrame = function (dt) { _sfD(dt);
    const want = st.screen === 'explore' && st.scene !== 'anemone' && !arOn; diver.visible = false;
    for (const [k, m] of Object.entries(HD)) { if (!m) continue; const on = want && (st.hero === 'ayu' ? k === 'ayu' : k === 'wayan'); m.visible = on; if (!on) continue;
      const dz = 8, vh = 2 * dz * Math.tan(camera.fov * Math.PI / 360), vw = vh * camera.aspect; const sc = .34 * vw / m.userData.w; m.scale.set(sc * (swimDir < 0 ? -1 : 1), sc, 1);
      m.position.set(.12 * vw, -.22 * vh + Math.sin(clock * 1.3) * .03 * vh, -dz); m.rotation.z = (swimT > 0 ? -swimDir * .18 : 0) + Math.sin(clock * .9) * .04; } }; }
// ---- the big wave at the mangroves: the whole view heaves, foam rushes in from below, the young trees hold the sand
let waveFx = null; { const _sfW = storyFrame; storyFrame = function (dt) { _sfW(dt); if (waveFx) waveFx(dt); }; }
waveTest = function () { return new Promise((res) => { const w = document.createElement('div'); w.id = 'wave2'; phone.appendChild(w);
  const qs = document.createElement('style'); qs.textContent = '#wave2{position:absolute;left:0;right:0;bottom:0;height:70%;z-index:5;pointer-events:none;background:linear-gradient(180deg,rgba(255,255,255,0) 0%,rgba(40,130,200,.35) 18%,rgba(60,160,220,.75) 28%,rgba(255,255,255,.97) 36%,rgba(225,245,255,.85) 55%,rgba(120,200,240,.9) 100%);transform:translateY(100%);transition:transform 1.1s cubic-bezier(.2,.8,.3,1)}'; document.head.appendChild(qs);
  const lock = st.lookLock; st.lookLock = true; const p0 = PV.tPitch, y0 = PV.tYaw; let t = 0; blip(160, 90, 1.4, .14); buzz(80);
  requestAnimationFrame(() => requestAnimationFrame(() => { w.style.transform = 'translateY(22%)'; }));
  setTimeout(() => { w.style.transition = 'transform 1.4s ease-in'; w.style.transform = 'translateY(100%)'; }, 1300);
  waveFx = (dt) => { t += dt; const e = Math.max(0, 1 - t / 2.8); PV.tPitch = p0 - Math.sin(t * 2.2) * .13 * e; PV.tYaw = y0 + Math.sin(t * 3.1) * .05 * e; camera.rotation.z += Math.sin(t * 2.6) * .09 * e; mangTrees.forEach((m) => { m.material.uniforms.amp.value = .06 + .5 * e; m.material.uniforms.speed.value = 1.4 + 6 * e; }); };
  setTimeout(() => { waveFx = null; st.lookLock = lock; PV.tPitch = p0; PV.tYaw = y0; mangTrees.forEach((m) => { m.material.uniforms.amp.value = .06; m.material.uniforms.speed.value = 1.4; }); w.remove(); qs.remove(); res(); }, 3000); }); };
// ================= SELF-UPDATE (Android APK outside the Play Store) =================
const UPDATE_URL = 'https://github.com/mtmatefi/prodive-junior/releases/latest/download/latest.json';
const Upd = (() => { try { return window.Capacitor && window.Capacitor.isNativePlatform() ? window.Capacitor.Plugins.Updater || window.Capacitor.registerPlugin('Updater') : null; } catch (e) { return null; } })();
{ const qs = document.createElement('style'); qs.textContent = `#updCard{position:absolute;inset:0;z-index:420;background:rgba(6,21,43,.8);display:none;align-items:center;justify-content:center;zoom:var(--z,1)}#updCard.on{display:flex}
#updCard .box{background:#fff;color:#0B1F3A;border-radius:26px;padding:22px 20px;width:300px;display:flex;flex-direction:column;gap:12px;text-align:center}
#updCard b{font-family:"Baloo 2";font-size:26px;line-height:1.05}#updCard p{margin:0;font-weight:700;font-size:15px;color:#3C5A75;white-space:pre-line;text-align:left}
#updCard .bar{height:14px;border-radius:7px;background:#E8F1F7;overflow:hidden;display:none}#updCard .bar i{display:block;height:100%;width:0;background:#33C3E8;transition:width .2s}
#updCard button{height:52px;border-radius:18px;border:0;font-weight:800;font-size:17px}#updCard .go{background:#FF8A5B;color:#0B1F3A}#updCard .later{background:#E8F1F7;color:#0B1F3A}`; document.head.appendChild(qs); }
const updCard = document.createElement('div'); updCard.id = 'updCard'; updCard.innerHTML = '<div class="box"><b></b><p></p><div class="bar"><i></i></div><button class="go"></button><button class="later"></button></div>'; phone.appendChild(updCard);
async function checkUpdate(manual) {
  if (!Upd) { if (manual) toast(T('Updates gibt es nur in der Android-App.'), false); return; }
  try { const me = await Upd.info(); const r = await Upd.check({ url: UPDATE_URL }); const m = JSON.parse(r.json);
    if (!(m.versionCode > me.versionCode)) { if (manual) toast(T('Du hast die neueste Version.') + ' (' + me.versionName + ')', false); return; }
    if (!manual) { try { if (sessionStorage.getItem('seaju_upd_later') === String(m.versionCode)) return; } catch (e) {} }
    const notes = (m.notes && (m.notes[LANG] || m.notes.de)) || '';
    updCard.querySelector('b').textContent = T('Neue Version da!') + ' ' + m.versionName; updCard.querySelector('p').textContent = notes;
    const go = updCard.querySelector('.go'), later = updCard.querySelector('.later'), bar = updCard.querySelector('.bar'), fill = bar.querySelector('i');
    go.textContent = T('Jetzt holen'); later.textContent = T('Später'); go.disabled = false; bar.style.display = 'none'; later.style.display = '';
    updCard.classList.add('on');
    later.onclick = () => { try { sessionStorage.setItem('seaju_upd_later', String(m.versionCode)); } catch (e) {} updCard.classList.remove('on'); };
    go.onclick = async () => { if (go.dataset.ready) { const ir = await Upd.install(); if (ir.needsPermission) toast(T('Bitte «Aus dieser Quelle zulassen» einschalten und zurückkommen.'), false); return; }
      go.disabled = true; later.style.display = 'none'; bar.style.display = 'block'; go.textContent = T('Lädt …');
      const h = await Upd.addListener('progress', (e) => { if (e.percent >= 0) { fill.style.width = e.percent + '%'; go.textContent = T('Lädt …') + ' ' + e.percent + ' %'; } });
      try { await Upd.download({ url: m.apk }); h.remove(); go.disabled = false; go.dataset.ready = '1'; go.textContent = T('Installieren'); const ir = await Upd.install(); if (ir.needsPermission) toast(T('Bitte «Aus dieser Quelle zulassen» einschalten und zurückkommen.'), false); }
      catch (e) { h.remove(); go.disabled = false; later.style.display = ''; bar.style.display = 'none'; go.textContent = T('Nochmal versuchen'); toast(T('Download hat nicht geklappt. Ist Internet da?'), false); } };
  } catch (e) { if (manual) toast(T('Keine Verbindung zum Update-Server.'), false); } }
setTimeout(() => checkUpdate(false), 4000);
document.addEventListener('resume', () => checkUpdate(false));
// ---- QA fixes: language consistency
{ const IDR = [[/^KAPITEL (\d+) VON (\d+)$/, (m) => `BAB ${m[1]} DARI ${m[2]}`], [/^Tulamben · noch (\d+) Tiere$/, (m) => `Tulamben · ${m[1]} hewan lagi`],
    [/^Tulamben öffnet sich, wenn du (\d+) Tiere gefunden hast\. Dir fehlen noch (\d+)\.$/, (m) => `Tulamben terbuka kalau kamu sudah menemukan ${m[1]} hewan. Kurang ${m[2]} lagi.`]];
  const _T2 = T; T = function (s) { if (LANG === 'id' && s) { const k = s.trim(); for (const [re, fn] of IDR) { const m = k.match(re); if (m) return fn(m); } } return _T2(s); };
  const _toast = toast; toast = function (txt, sp = true) { return _toast(T(txt), sp); };
  const _mgOpenQ = mgOpen; mgOpen = function (...a) { _mgOpenQ(...a); sweep($('#mg')); };
  const _setLang = setLang; setLang = function (l) { _setLang(l); const b = $('#profBtn'); if (b) { const i = profInfo(PROF.act); const sp = b.querySelector('span'); if (sp) sp.textContent = i.name; } };}

// ---------- start ----------
resize(); updCount(); renderDots(); show('map', 'map');
$('#loading').style.opacity = 0; setTimeout(() => $('#loading').remove(), 700);
requestAnimationFrame(frame);
