// BONECO 3D DO REPLAY (24/11/2026, estilo "desenho com contorno" escolhido pelo Lucas).
// Corredor, ciclista e nadador articulados, com cores chapadas (toon) e uma borda clara em volta
// (a peça desenhada de novo, um pouco maior, pelo avesso). Desenhado num canvas pequeno que vai
// no marcador do mapa de ruas. A câmera do boneco copia a inclinação do mapa, e o boneco gira
// para o rumo do trajeto relativo ao mapa. Só desenho: nenhum número do treino usa isto.
// Proteções: se o aparelho demorar a desenhar (média > 12 ms por quadro), o app volta ao ícone
// plano; com "Reduzir movimento", o boneco fica parado.
import * as THREE from 'three';

export type Esporte = 'corrida' | 'bike' | 'nado';
const LIMITE_MS = 12;

function cor(v: string, reserva: string): THREE.Color {
  const x = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  try { return new THREE.Color(x || reserva); } catch { return new THREE.Color(reserva); }
}

export class Boneco3D {
  readonly canvas: HTMLCanvasElement;
  private ren: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private raiz = new THREE.Group();
  private J: any = {};
  private fase = 0;
  private esporte: Esporte;
  private tempos: number[] = [];
  lento = false;

  pes: [number, number] = [0, 0]; // onde ficam os pés no canvas, a partir do centro (px)
  private px: number;

  constructor(esporte: Esporte, px = 136) {
    this.px = px;
    this.esporte = esporte;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = Math.round(px * Math.min(2, window.devicePixelRatio || 1));
    this.canvas.style.width = this.canvas.style.height = px + 'px';
    this.ren = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    this.ren.setClearColor(0x000000, 0);
    const C = { ciano: cor('--ciano', '#22D3EE'), violeta: cor('--violeta', '#5B3FD0'), magenta: cor('--magenta', '#E8459A'), borda: new THREE.Color('#F2F2F7') };
    const grad = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
    grad.needsUpdate = true; grad.minFilter = grad.magFilter = THREE.NearestFilter;
    const mats = new Map<string, THREE.Material>();
    const mat = (c: THREE.Color) => { const k = c.getHexString(); if (!mats.has(k)) mats.set(k, new THREE.MeshToonMaterial({ color: c, gradientMap: grad })); return mats.get(k)!; };
    const bordaM = new THREE.MeshBasicMaterial({ color: C.borda, side: THREE.BackSide });
    const peca = (g: THREE.BufferGeometry, c: THREE.Color, esc: [number, number, number]) => { const m = new THREE.Mesh(g, mat(c)); const o = new THREE.Mesh(g, bordaM); o.scale.set(...esc); m.add(o); return m; };
    const seg = (len: number, r: number, c: THREE.Color) => { const g = new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 4, 10); g.translate(0, -len / 2, 0); return peca(g, c, [1.35, 1.04, 1.35]); };
    const bola = (r: number, c: THREE.Color) => peca(new THREE.SphereGeometry(r, 16, 12), c, [1.18, 1.18, 1.18]);
    const junta = (pai: THREE.Object3D, x: number, y: number, z: number) => { const j = new THREE.Group(); j.position.set(x, y, z); pai.add(j); return j; };

    // corpo: tronco, cabeça, braços e pernas com cotovelo, joelho e tornozelo
    const quadril = junta(this.raiz, 0, 0.95, 0);
    const tronco = seg(0.55, 0.13, C.ciano); tronco.rotation.x = Math.PI; quadril.add(tronco);
    quadril.add(bola(0.14, C.violeta));
    const pescoco = junta(quadril, 0, 0.55, 0);
    const cabeca = bola(0.12, C.violeta); cabeca.position.y = 0.14; pescoco.add(cabeca);
    const P: any = {};
    for (const L of [-1, 1]) {
      const omb = junta(quadril, L * 0.19, 0.5, 0); omb.add(seg(0.28, 0.05, C.ciano));
      const cot = junta(omb, 0, -0.28, 0); cot.add(seg(0.26, 0.045, C.ciano));
      const anca = junta(quadril, L * 0.09, -0.02, 0); anca.add(seg(0.45, 0.075, C.violeta));
      const joe = junta(anca, 0, -0.45, 0); joe.add(seg(0.43, 0.06, C.ciano));
      const tor = junta(joe, 0, -0.43, 0); const pe = seg(0.2, 0.05, C.magenta); pe.rotation.x = -Math.PI / 2; pe.position.z = -0.03; tor.add(pe);
      P[L] = { omb, cot, anca, joe, tor };
    }
    this.J = { quadril, pescoco, P };
    this.scene.add(this.raiz);
    if (esporte === 'bike') {
      const bike = new THREE.Group(); this.raiz.add(bike);
      for (const z of [0.52, -0.52]) { const g = new THREE.TorusGeometry(0.34, 0.03, 8, 28); const r = peca(g, C.borda, [1.06, 1.06, 1.06]); r.rotation.y = Math.PI / 2; r.position.set(0, 0.34, z); bike.add(r); }
      const tubo = (a: THREE.Vector3, b: THREE.Vector3, c = C.magenta) => { const v = new THREE.Vector3().subVectors(b, a); const t = seg(v.length(), 0.025, c); t.position.copy(a); t.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), v.clone().normalize()); bike.add(t); };
      const sel = new THREE.Vector3(0, 0.98, -0.18), mov = new THREE.Vector3(0, 0.42, -0.02), gui = new THREE.Vector3(0, 1.02, 0.42), ed = new THREE.Vector3(0, 0.34, -0.52), ef = new THREE.Vector3(0, 0.34, 0.52);
      tubo(sel, mov); tubo(sel, gui); tubo(mov, gui); tubo(mov, ed); tubo(sel, ed); tubo(gui, ef, C.borda);
    }
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.6));
    const sol = new THREE.DirectionalLight(0xffffff, 1.2); sol.position.set(3, 6, 4); this.scene.add(sol);
    this.pose();
  }

  // avança a passada/pedalada/braçada (só enquanto o replay toca)
  avanca(dtSeg: number) { this.fase = (this.fase + dtSeg * (this.esporte === 'bike' ? 1.1 : this.esporte === 'nado' ? 0.7 : 1.4)) % 1; }

  private pose() {
    const a = this.fase * Math.PI * 2, { quadril, pescoco, P } = this.J;
    const corpo = this.raiz.children[0] as THREE.Object3D; void corpo;
    quadril.rotation.set(0, 0, 0); pescoco.rotation.set(0, 0, 0); quadril.position.set(0, 0.95, 0);
    if (this.esporte === 'corrida') {
      quadril.position.y = 0.95 + Math.abs(Math.sin(a)) * 0.06; quadril.rotation.x = 0.18;
      for (const L of [-1, 1]) { const s = Math.sin(a + (L > 0 ? 0 : Math.PI));
        P[L].anca.rotation.x = -s * 0.75; P[L].joe.rotation.x = 0.35 + Math.max(0, s) * 1.25; P[L].tor.rotation.x = -0.2;
        P[L].omb.rotation.x = s * 0.85; P[L].cot.rotation.x = -1.5; P[L].omb.rotation.z = -L * 0.08; }
    } else if (this.esporte === 'bike') {
      quadril.position.set(0, 1.01, -0.18); quadril.rotation.x = 0.95; pescoco.rotation.x = -0.6;
      for (const L of [-1, 1]) { const s = a + (L > 0 ? 0 : Math.PI);
        P[L].anca.rotation.x = -1.15 - Math.sin(s) * 0.45; P[L].joe.rotation.x = 1.25 + Math.cos(s) * 0.45; P[L].tor.rotation.x = -0.3;
        P[L].omb.rotation.x = -1.25; P[L].cot.rotation.x = -0.15; P[L].omb.rotation.z = -L * 0.12; }
    } else {
      // nado (crawl): deitado de bruços
      quadril.position.set(0, 0.1, -0.75); quadril.rotation.set(Math.PI / 2, Math.sin(a) * 0.35, 0); pescoco.rotation.y = Math.sin(a) * 0.4;
      for (const L of [-1, 1]) { const s = a + (L > 0 ? 0 : Math.PI);
        P[L].omb.rotation.x = Math.PI - (((s % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)); P[L].cot.rotation.x = -0.25 - Math.max(0, Math.sin(s)) * 0.6; P[L].omb.rotation.z = -L * 0.15;
        P[L].anca.rotation.x = Math.sin(a * 2 + (L > 0 ? 0 : Math.PI)) * 0.25; P[L].joe.rotation.x = 0.15; P[L].tor.rotation.x = 0.6; }
    }
  }

  // rumoRel: rumo do trajeto menos o rumo do mapa (graus, sentido horário a partir do "para cima"
  // da tela); inclinação: a do mapa (0 = de cima, 60 = 3ª pessoa)
  desenha(rumoRel: number, inclinacao: number) {
    const t0 = performance.now();
    this.pose();
    this.raiz.rotation.y = (-rumoRel * Math.PI) / 180;
    // elevação da câmera: segue a inclinação do mapa, mas nunca olha bem de cima (o boneco
    // continua de pé e legível na vista "de cima"): entre 30° (3ª pessoa) e 55° (de cima)
    const e = (Math.min(55, Math.max(30, 90 - inclinacao)) * Math.PI) / 180, D = 4.6;
    this.cam.position.set(0, 0.75 + D * Math.sin(e), -D * Math.cos(e));
    this.cam.up.set(0, Math.cos(e), Math.sin(e));
    this.cam.lookAt(0, 0.75, 0);
    this.ren.render(this.scene, this.cam);
    // pés (chão sob o quadril) na tela do canvas, para o marcador encostar no trajeto
    const p = new THREE.Vector3(0, 0, this.esporte === 'nado' ? -0.75 : 0).project(this.cam);
    this.pes = [(p.x * this.px) / 2, (-p.y * this.px) / 2];
    const ms = performance.now() - t0;
    this.tempos.push(ms); if (this.tempos.length > 60) this.tempos.shift();
    if (this.tempos.length >= 30 && this.tempos.reduce((s, x) => s + x, 0) / this.tempos.length > LIMITE_MS) this.lento = true;
    (window as any).__apex3d = { ms: this.tempos.reduce((s, x) => s + x, 0) / this.tempos.length, quadros: this.tempos.length, lento: this.lento };
  }

  libera() { this.ren.dispose(); this.scene.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); }); }
}
