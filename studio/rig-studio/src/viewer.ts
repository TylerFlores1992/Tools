// The 3D / plan / front / side view of one version: the rig from the shared Rig Planner scene
// (src/tools/rig/ui/scene.ts), hoists, reference layers, and load labels as HTML over the canvas.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildScene, disposeGeometries, hoistGeometry, makeMaterials, partMeshes, toThree, type Look, type Mats } from "../../../src/tools/rig/ui/scene.ts";
import type { Compiled, Sketch } from "../../../src/tools/rig/sketch.ts";
import type { Vec3 } from "../../../src/tools/rig/types.ts";
import type { Layer, Shape } from "./model.ts";

export type ViewName = "3d" | "plan" | "front" | "side";
export type Label = { at: Vec3; text: string; tone: "ok" | "warn" | "plain"; id?: string };
export type Show = { truss: boolean; towers: boolean; points: boolean; labels: boolean };

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";

function look(): Look {
  return {
    truss: css("--metal"),
    corner: css("--metal-2"),
    pipe: css("--metal"),
    clamp: css("--metal-2"),
    plate: css("--plate"),
    selected: css("--accent"),
    ground: css("--floor"),
    grid: css("--grid"),
    bg: css("--stage"),
  };
}

export class Viewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private persp: THREE.PerspectiveCamera;
  private ortho: THREE.OrthographicCamera;
  private camera: THREE.Camera;
  private controls: OrbitControls;
  private rig = new THREE.Group();
  private refs = new THREE.Group();
  private grid?: THREE.GridHelper;
  private mats: Mats;
  private extraMats: Record<string, THREE.Material> = {};
  private labelsEl: HTMLDivElement;
  private labels: { el: HTMLElement; at: THREE.Vector3 }[] = [];
  private view: ViewName = "3d";
  private bounds = new THREE.Box3(new THREE.Vector3(-120, 0, -120), new THREE.Vector3(120, 120, 120));
  private ro: ResizeObserver;
  private raf = 0;
  private owner: Record<string, string> = {};
  private textures = new Map<string, THREE.Texture>();
  onPick?: (sketchId: string | null) => void;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute("aria-label", "Rig view: drag to turn, pinch or scroll to zoom");
    this.renderer.domElement.setAttribute("role", "img");
    this.labelsEl = document.createElement("div");
    this.labelsEl.className = "vlabels";
    host.appendChild(this.labelsEl);
    this.persp = new THREE.PerspectiveCamera(40, 1, 1, 200000);
    this.ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, -200000, 200000);
    this.camera = this.persp;
    this.controls = new OrbitControls(this.persp, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.addEventListener("change", () => this.request());
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(400, 900, 600);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-600, 300, -400);
    this.scene.add(fill);
    this.scene.add(this.refs, this.rig);
    this.mats = makeMaterials(look());
    this.retheme();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    let down: { x: number; y: number } | null = null;
    this.renderer.domElement.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
    this.renderer.domElement.addEventListener("pointerup", (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) this.pick(e);
      down = null;
    });
  }

  /** Colours follow the page's light or dark theme. */
  retheme() {
    const l = look();
    this.scene.background = new THREE.Color(l.bg);
    const fresh = makeMaterials(l);
    for (const k of Object.keys(this.mats) as (keyof Mats)[]) this.mats[k].color.copy(fresh[k].color);
    if (this.extraMats.hoist) (this.extraMats.hoist as THREE.MeshStandardMaterial).color.set(css("--hoist"));
    if (this.extraMats.fixture) (this.extraMats.fixture as THREE.MeshStandardMaterial).color.set(css("--fixture"));
    if (this.extraMats.shape) (this.extraMats.shape as THREE.LineBasicMaterial).color.set(css("--shape"));
    if (this.extraMats.existing) (this.extraMats.existing as THREE.MeshStandardMaterial).color.set(css("--shape"));
    this.makeGrid();
    this.request();
  }

  private mat(name: "hoist" | "fixture" | "shape" | "pick" | "existing") {
    if (!this.extraMats[name]) {
      this.extraMats[name] =
        name === "shape"
          ? new THREE.LineBasicMaterial({ color: css("--shape") })
          : name === "existing"
            ? new THREE.MeshStandardMaterial({ color: css("--shape"), transparent: true, opacity: 0.45, depthWrite: false })
            : new THREE.MeshStandardMaterial({ color: css(name === "hoist" ? "--hoist" : name === "pick" ? "--accent" : "--fixture"), metalness: 0.3, roughness: 0.55 });
    }
    return this.extraMats[name];
  }

  private makeGrid() {
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry.dispose();
    }
    const size = Math.max(480, Math.ceil(Math.max(this.bounds.max.x - this.bounds.min.x, this.bounds.max.z - this.bounds.min.z) / 120 + 1) * 120);
    this.grid = new THREE.GridHelper(size, size / 60, new THREE.Color(css("--grid-major")), new THREE.Color(css("--grid")));
    const c = this.bounds.getCenter(new THREE.Vector3());
    this.grid.position.set(Math.round(c.x / 12) * 12, 0, Math.round(c.z / 12) * 12);
    this.scene.add(this.grid);
  }

  setRig(sketch: Sketch, compiled: Compiled, show: Show) {
    disposeGeometries(this.rig);
    this.rig.clear();
    this.owner = compiled.owner;
    const g = buildScene(compiled.list, this.mats);
    for (const m of [...g.children]) {
      const kind = (m.userData as { kind?: string }).kind;
      const id = (m.userData as { partId?: string }).partId ?? "";
      const role = compiled.list.parts.find((p) => p.id === id);
      const isTower = role && ((role.kind === "truss" && role.role === "tower") || (role.kind === "corner" && role.role) || (role.kind === "baseplate" && role.center[2] > 0));
      m.visible = isTower ? show.towers : kind === "truss" || kind === "corner" || kind === "baseplate" ? show.truss : true;
      this.rig.add(m);
    }
    for (const p of sketch.points) {
      const mesh = new THREE.Mesh(hoistGeometry(toThree(p.at), p.kind === "deadhang"), this.mat("hoist"));
      mesh.userData = { partId: `pt:${p.id}`, kind: "point" };
      mesh.visible = show.points;
      this.rig.add(mesh);
      this.owner[`pt:${p.id}`] = p.id;
    }
    for (const l of sketch.loads) {
      const geo = new THREE.BoxGeometry(18, 24, 18);
      const c = toThree(l.at);
      geo.translate(c.x, c.y - 14, c.z);
      const mesh = new THREE.Mesh(geo, this.mat("fixture"));
      mesh.userData = { partId: `ld:${l.id}`, kind: "load" };
      this.rig.add(mesh);
      this.owner[`ld:${l.id}`] = l.id;
    }
    this.measure();
    this.request();
  }

  /** Built geometry per layer, so a change to one layer (or a read-out writing its 75 layer documents
   * one after another) doesn't rebuild every other one. Measured 2026-11-10: rebuilding everything
   * on each write took 52 s to open CFF-26 (196k faces). */
  private built = new Map<string, { key: string; obj: THREE.Object3D }>();
  private pendingLayers: Layer[] | null = null;
  private layerTimer: ReturnType<typeof setTimeout> | null = null;

  /** Show these layers. Rapid calls are gathered (the last one wins) and only changed layers rebuild. */
  setLayers(layers: Layer[]) {
    this.pendingLayers = layers;
    if (this.layerTimer) return;
    this.layerTimer = setTimeout(() => {
      this.layerTimer = null;
      const next = this.pendingLayers;
      this.pendingLayers = null;
      if (next) this.applyLayers(next);
    }, 120);
  }

  private static layerKey(l: Layer): string {
    const heavy = l.shapes ?? l.rig ?? l.fixtures ?? [];
    return [l.id, l.at, l.kind, l.visible, l.opacity, l.x, l.y, l.z, l.rot, l.widthIn, l.asset, heavy.length].join("|");
  }

  private disposeTree(root: THREE.Object3D) {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      if (m.material && (m.material as THREE.MeshBasicMaterial).map) (m.material as THREE.Material).dispose();
    });
  }

  private applyLayers(layers: Layer[]) {
    const keep = new Set<string>();
    for (const l of layers) {
      const id = l.id ?? `${l.name}|${l.at}`;
      keep.add(id);
      const key = Viewer.layerKey(l);
      const had = this.built.get(id);
      if (had && had.key === key) continue;
      if (had) {
        this.refs.remove(had.obj);
        this.disposeTree(had.obj);
      }
      const obj = this.buildLayer(l);
      this.built.set(id, { key, obj });
      this.refs.add(obj);
    }
    for (const [id, had] of this.built) {
      if (keep.has(id)) continue;
      this.refs.remove(had.obj);
      this.disposeTree(had.obj);
      this.built.delete(id);
    }
    this.applyViewTags();
    this.measure();
    this.request();
  }

  private buildLayer(l: Layer): THREE.Group {
    const group = new THREE.Group();
    {
      if (!l.visible) return group;
      if (l.kind === "image" && l.asset && l.px) {
        const w = l.widthIn ?? 480;
        const h = (w * l.px[1]) / l.px[0];
        const geo = new THREE.PlaneGeometry(w, h);
        geo.rotateX(-Math.PI / 2);
        geo.translate(w / 2, 0, -h / 2);
        const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: l.opacity ?? 0.7, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
        const url = `/_blob/${l.asset}`;
        let tex = this.textures.get(url);
        if (!tex) {
          tex = new THREE.TextureLoader().load(url, () => this.request());
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          this.textures.set(url, tex);
        }
        mat.map = tex;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.y = ((l.rot ?? 0) * Math.PI) / 180;
        mesh.position.set(l.x ?? 0, (l.z ?? 0) + 0.2, -(l.y ?? 0));
        mesh.renderOrder = -1;
        group.add(mesh);
      }
      if (l.kind === "fixtures" && l.fixtures?.length) {
        const geo = new THREE.CylinderGeometry(3.2, 5.5, 13, 10);
        geo.translate(0, -8, 0);
        const inst = new THREE.InstancedMesh(geo, this.mat("fixture"), l.fixtures.length);
        const m = new THREE.Matrix4();
        l.fixtures.forEach((f, i) => {
          m.makeTranslation(f.x, f.z, -f.y);
          inst.setMatrixAt(i, m);
        });
        group.add(inst);
      }
      if (l.kind === "rig" && l.rig?.length) {
        for (const it of l.rig) {
          const a = new THREE.Vector3(it.at[0], it.at[2], -it.at[1]);
          if (it.kind === "truss" && it.b) {
            const b = new THREE.Vector3(it.b[0], it.b[2], -it.b[1]);
            const len = a.distanceTo(b);
            if (len < 0.5) continue;
            const geo = new THREE.BoxGeometry(len, 12, 12);
            const m = new THREE.Mesh(geo, this.mat("existing"));
            m.position.copy(a.clone().add(b).multiplyScalar(0.5));
            m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize());
            group.add(m);
          } else if (it.kind === "truss" && it.bbox) {
            const [x0, y0, x1, y1] = it.bbox;
            const geo = new THREE.BoxGeometry(Math.max(1, x1 - x0), 12, Math.max(1, y1 - y0));
            const m = new THREE.Mesh(geo, this.mat("existing"));
            m.position.set((x0 + x1) / 2, it.at[2], -(y0 + y1) / 2);
            group.add(m);
          } else {
            const geo = new THREE.ConeGeometry(4, 10, 8);
            geo.rotateX(Math.PI);
            const m = new THREE.Mesh(geo, this.mat(it.kind === "hoist" ? "hoist" : "existing"));
            m.position.copy(a).add(new THREE.Vector3(0, 6, 0));
            group.add(m);
          }
        }
      }
      if (l.kind === "shapes" && l.shapes?.length) group.add(this.shapesGroup(l.shapes));
    }
    return group;
  }

  /** A drawing's outlines and 3D objects as a handful of meshes (a set can have thousands): flat
   * outlines as one set of lines; 3D objects raised to their height, one mesh per fill colour (the
   * drawing's own colours, data rather than page colours), with their edges drawn so they read in
   * either theme. */
  private blockMats = new Map<string, THREE.Material>();
  private shapesGroup(shapes: Shape[]): THREE.Object3D {
    // A hybrid symbol's 2D graphics show only in Plan and its 3D part only in the other views, as in
    // Vectorworks; everything else shows in both.
    const out = new THREE.Group();
    for (const tag of ["both", "plan", "3d"] as const) {
      const list = shapes.filter((s) => (s.v ?? "both") === tag);
      if (!list.length) continue;
      const g = this.shapesPart(list);
      g.userData.view = tag;
      out.add(g);
    }
    return out;
  }

  /** Show a hybrid symbol's 2D graphics in Plan and its 3D part elsewhere. */
  private applyViewTags() {
    this.refs.traverse((o) => {
      const tag = o.userData.view as string | undefined;
      if (tag === "plan") o.visible = this.view === "plan";
      else if (tag === "3d") o.visible = this.view !== "plan";
    });
  }

  private shapesPart(shapes: Shape[]): THREE.Object3D {
    const g = new THREE.Group();
    const seg: number[] = [];
    const byFill = new Map<string, THREE.BufferGeometry[]>();
    const edges: THREE.BufferGeometry[] = [];
    let fillOrder = 0;
    for (const s of shapes) {
      if (s.m) {
        // The drawing's real faces: each face fanned into triangles, drawing XY onto the floor.
        const { q, v, f } = s.m;
        const zb = s.mz ?? 0;
        const pos = new Float32Array(v.length);
        for (let i = 0; i < v.length; i += 3) {
          pos[i] = v[i] * q;
          pos[i + 1] = v[i + 2] * q + zb;
          pos[i + 2] = -v[i + 1] * q;
        }
        const idx: number[] = [];
        for (let i = 0; i < f.length; ) {
          const n = f[i];
          for (let j = 2; j < n; j++) idx.push(f[i + 1], f[i + j], f[i + j + 1]);
          i += n + 1;
        }
        if (idx.length) {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
          geo.setIndex(idx);
          edges.push(new THREE.EdgesGeometry(geo, 30));
          const flat = geo.toNonIndexed();
          flat.computeVertexNormals();
          const key = s.fill ?? "none";
          (byFill.get(key) ?? byFill.set(key, []).get(key)!).push(flat);
        }
        continue;
      }
      if (s.pts.length < 2) continue;
      if (s.closed && (s.h ?? 0) > 0 && s.pts.length >= 3) {
        let geo: THREE.BufferGeometry;
        try {
          geo = new THREE.ExtrudeGeometry(new THREE.Shape(s.pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: s.h ?? 1, bevelEnabled: false });
        } catch {
          continue;
        }
        geo.rotateX(-Math.PI / 2); // drawing XY onto the floor, height up
        geo.translate(0, s.z ?? 0, 0);
        const key = s.fill ?? "none";
        (byFill.get(key) ?? byFill.set(key, []).get(key)!).push(geo.index ? geo.toNonIndexed() : geo);
        edges.push(new THREE.EdgesGeometry(geo, 30));
        continue;
      }
      if (s.closed && s.fill && s.pts.length >= 3) {
        // A flat filled shape (a deck's plan, a riser, a floor area): filled in its colour, as the plan shows it.
        try {
          const geo = new THREE.ShapeGeometry(new THREE.Shape(s.pts.map(([x, y]) => new THREE.Vector2(x, y))));
          geo.rotateX(-Math.PI / 2);
          geo.translate(0, (s.z ?? 0) + 0.1 + Math.min(fillOrder++ * 0.002, 6), 0); // later shapes on top, as in the drawing
          (byFill.get(s.fill) ?? byFill.set(s.fill, []).get(s.fill)!).push(geo.index ? geo.toNonIndexed() : geo);
        } catch {
          // a shape three.js can't triangulate: its outline below still shows
        }
      }
      const z = (s.z ?? 0) + 0.3 + Math.min(fillOrder * 0.002, 6);
      const pts = s.closed ? [...s.pts, s.pts[0]] : s.pts;
      for (let i = 0; i + 1 < pts.length; i++) seg.push(pts[i][0], z, -pts[i][1], pts[i + 1][0], z, -pts[i + 1][1]);
    }
    if (seg.length) {
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
      g.add(new THREE.LineSegments(lg, this.mat("shape")));
    }
    for (const [key, geos] of byFill) {
      let mat = this.blockMats.get(key);
      if (!mat) {
        // Solid, in the drawing's own colours, like Vectorworks' shaded view (no see-through boxes).
        mat = new THREE.MeshStandardMaterial({ color: key === "none" ? 0xc9ccd1 : key, roughness: 0.85, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        this.blockMats.set(key, mat);
      }
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos.map((q) => (q.deleteAttribute("uv"), q)), false);
      if (merged) g.add(new THREE.Mesh(merged, mat));
    }
    const e = edges.length ? mergeGeometries(edges, false) : null;
    if (e) g.add(new THREE.LineSegments(e, this.mat("shape")));
    return g;
  }

  setLabels(labels: Label[], on: boolean) {
    this.labelsEl.replaceChildren();
    this.labels = [];
    if (!on) return this.request();
    for (const l of labels) {
      const el = document.createElement("div");
      el.className = `vlabel ${l.tone}`;
      el.textContent = l.text;
      this.labelsEl.appendChild(el);
      this.labels.push({ el, at: toThree(l.at) });
    }
    this.request();
  }

  highlight(ids: Set<string>) {
    for (const m of partMeshes(this.rig)) {
      const sid = this.owner[m.userData.partId];
      const on = sid !== undefined && ids.has(sid);
      const kind = m.userData.kind as string;
      const base = kind === "point" ? this.mat("hoist") : kind === "load" ? this.mat("fixture") : this.mats[m.userData.kind as keyof Mats];
      m.material = on ? this.mat("pick") : base;
    }
    this.request();
  }

  private measure() {
    const b = new THREE.Box3();
    const add = (g: THREE.Object3D) => g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh || (o as THREE.Line).isLine) {
        const ob = new THREE.Box3().setFromObject(o);
        if (!ob.isEmpty()) b.union(ob);
      }
    });
    add(this.rig);
    add(this.refs);
    if (b.isEmpty()) b.set(new THREE.Vector3(-120, 0, -120), new THREE.Vector3(120, 120, 120));
    b.min.y = Math.min(b.min.y, 0);
    const changed = !b.equals(this.bounds);
    this.bounds = b;
    if (changed) this.makeGrid();
  }

  setView(v: ViewName, fit = true) {
    this.view = v;
    this.applyViewTags();
    const ortho = v !== "3d";
    this.camera = ortho ? this.ortho : this.persp;
    this.controls.object = this.camera;
    this.controls.enableRotate = !ortho;
    this.controls.screenSpacePanning = true;
    if (fit) this.fit();
    this.request();
  }

  fit() {
    const b = this.bounds;
    const c = b.getCenter(new THREE.Vector3());
    const size = b.getSize(new THREE.Vector3());
    const sphere = b.getBoundingSphere(new THREE.Sphere());
    const { clientWidth: W, clientHeight: H } = this.host;
    const aspect = W / Math.max(1, H);
    if (this.view === "3d") {
      const fov = (this.persp.fov * Math.PI) / 180;
      const fit = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * aspect));
      const d = (sphere.radius * 1.08) / Math.sin(fit / 2);
      const dir = new THREE.Vector3(0.75, 0.55, 1).normalize();
      this.persp.position.copy(c).addScaledVector(dir, d);
      this.persp.near = Math.max(1, d / 200);
      this.persp.far = d * 20;
      this.persp.updateProjectionMatrix();
    } else {
      const [w, h] = this.view === "plan" ? [size.x, size.z] : this.view === "front" ? [size.x, size.y] : [size.z, size.y];
      const half = Math.max(w / 2 / aspect, h / 2) * 1.22 + 24;
      this.ortho.left = -half * aspect;
      this.ortho.right = half * aspect;
      this.ortho.top = half;
      this.ortho.bottom = -half;
      this.ortho.zoom = 1;
      const far = sphere.radius * 4 + 1000;
      if (this.view === "plan") {
        this.ortho.position.set(c.x, c.y + far, c.z);
        this.ortho.up.set(0, 0, -1);
      } else if (this.view === "front") {
        this.ortho.position.set(c.x, c.y, c.z + far);
        this.ortho.up.set(0, 1, 0);
      } else {
        this.ortho.position.set(c.x + far, c.y, c.z);
        this.ortho.up.set(0, 1, 0);
      }
      this.ortho.lookAt(c);
      this.ortho.updateProjectionMatrix();
    }
    this.controls.target.copy(c);
    this.controls.update();
    this.request();
  }

  private pick(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.intersectObjects(partMeshes(this.rig).filter((m) => m.visible), false)[0];
    this.onPick?.(hit ? (this.owner[(hit.object as THREE.Mesh).userData.partId] ?? null) : null);
  }

  private resize() {
    const { clientWidth: W, clientHeight: H } = this.host;
    if (!W || !H) return;
    this.renderer.setSize(W, H, false);
    this.persp.aspect = W / H;
    this.persp.updateProjectionMatrix();
    const half = (this.ortho.top - this.ortho.bottom) / 2;
    this.ortho.left = -half * (W / H);
    this.ortho.right = half * (W / H);
    this.ortho.updateProjectionMatrix();
    this.request();
  }

  request() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.renderer.render(this.scene, this.camera);
      const { clientWidth: W, clientHeight: H } = this.host;
      for (const l of this.labels) {
        const p = l.at.clone().project(this.camera);
        const hide = p.z > 1 || p.z < -1 || Math.abs(p.x) > 1.05 || Math.abs(p.y) > 1.05;
        l.el.style.display = hide ? "none" : "";
        l.el.style.transform = `translate(${((p.x + 1) / 2) * W}px, ${((1 - p.y) / 2) * H}px) translate(-50%, -130%)`;
      }
    });
  }

  /** Point the 3D camera (three space) — for close-up checks. */
  lookFrom(pos: [number, number, number], target: [number, number, number]) {
    this.setView("3d", false);
    this.persp.position.set(...pos);
    this.controls.target.set(...target);
    this.controls.update();
    this.request();
  }

  /** A PNG of the current view, for thumbnails and the rental sheet. */
  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    disposeGeometries(this.rig);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelsEl.remove();
  }
}
