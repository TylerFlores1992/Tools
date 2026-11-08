// Build list → three.js meshes. One merged mesh per part, so a tap picks a whole part.
// Rig space is inches, Z up (docs/RIG.md); three is Y up, so (x, y, z) → (x, z, −y).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { BuildList, Part, Vec3 } from "../types.ts";

export const toThree = (p: Vec3) => new THREE.Vector3(p[0], p[2], -p[1]);

const UP = new THREE.Vector3(0, 1, 0);

/** A cylinder from a to b (three space). */
function tube(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 8): THREE.BufferGeometry {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, false);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** Two axes square to `dir`, matching the rig's X/Y/Z where it can. */
function crossAxes(dir: THREE.Vector3): [THREE.Vector3, THREE.Vector3] {
  const vertical = Math.abs(dir.y) > 0.9;
  const s1 = vertical ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3().crossVectors(dir, UP).normalize();
  const s2 = new THREE.Vector3().crossVectors(s1, dir).normalize();
  return [s1, s2];
}

function boxTruss(start: THREE.Vector3, end: THREE.Vector3, width: number, inset: number, chordR: number): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  dir.normalize();
  const [s1, s2] = crossAxes(dir);
  const h = width / 2 - inset;
  const corners = [
    [h, h],
    [-h, h],
    [-h, -h],
    [h, -h],
  ].map(([a, b]) => new THREE.Vector3().addScaledVector(s1, a).addScaledVector(s2, b));
  const parts: THREE.BufferGeometry[] = [];
  for (const c of corners) parts.push(tube(start.clone().add(c), end.clone().add(c), chordR));
  // Lacing: a zigzag on each face, roughly one bay per truss width.
  const bays = Math.max(1, Math.round(len / width));
  const bay = len / bays;
  for (let f = 0; f < 4; f++) {
    const c1 = corners[f];
    const c2 = corners[(f + 1) % 4];
    for (let i = 0; i < bays; i++) {
      const a = start.clone().addScaledVector(dir, i * bay);
      const b = start.clone().addScaledVector(dir, (i + 1) * bay);
      const from = (i % 2 ? c2 : c1).clone().add(a);
      const to = (i % 2 ? c1 : c2).clone().add(b);
      parts.push(tube(from, to, chordR * 0.45, 6));
    }
    // End ladder bars
    parts.push(tube(start.clone().add(c1), start.clone().add(c2), chordR * 0.45, 6));
    parts.push(tube(end.clone().add(c1), end.clone().add(c2), chordR * 0.45, 6));
  }
  return mergeGeometries(parts)!;
}

function cornerBlock(center: THREE.Vector3, size: number, inset: number, chordR: number): THREE.BufferGeometry {
  const h = size / 2 - inset;
  const parts: THREE.BufferGeometry[] = [];
  const pts: THREE.Vector3[] = [];
  for (const x of [-h, h]) for (const y of [-h, h]) for (const z of [-h, h]) pts.push(new THREE.Vector3(x, y, z).add(center));
  for (let i = 0; i < 8; i++)
    for (let j = i + 1; j < 8; j++) {
      const d = pts[i].distanceTo(pts[j]);
      if (Math.abs(d - 2 * h) < 1e-6) parts.push(tube(pts[i], pts[j], chordR));
    }
  // Gusset plates as thin boxes on each face.
  const plate = new THREE.BoxGeometry(size * 0.6, size * 0.6, 0.3);
  for (const n of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)]) {
    const g = plate.clone();
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n));
    g.translate(center.x + n.x * h, center.y + n.y * h, center.z + n.z * h);
    parts.push(g);
  }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!;
}

/** A box in three space, centered at c. */
function box(c: THREE.Vector3, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(x, y, z);
  g.translate(c.x, c.y, c.z);
  return g.toNonIndexed();
}

/**
 * A self-climber sleeve block: a welded tube frame around the tower mast (which passes through it),
 * X-braced on each face, guide rollers bearing on the tower's chords, and connection plates where
 * the grid truss bolts on. `size` across, a little taller than the truss.
 */
function sleeveBlock(center: THREE.Vector3, size: number, trussH: number, towerW: number, inset: number, chordR: number, chainTop?: number): THREE.BufferGeometry {
  const r = chordR * 1.25;
  const h = size / 2 - r;
  const hy = trussH / 2 + 2;
  const parts: THREE.BufferGeometry[] = [];
  const P = (x: number, y: number, z: number) => new THREE.Vector3(center.x + x, center.y + y, center.z + z);
  const cs: [number, number][] = [
    [h, h],
    [-h, h],
    [-h, -h],
    [h, -h],
  ];
  for (const [x, z] of cs) parts.push(tube(P(x, -hy, z), P(x, hy, z), r, 10));
  for (let i = 0; i < 4; i++) {
    const [x1, z1] = cs[i];
    const [x2, z2] = cs[(i + 1) % 4];
    for (const y of [-hy, hy]) parts.push(tube(P(x1, y, z1), P(x2, y, z2), r, 10));
    // X bracing on the face
    parts.push(tube(P(x1, -hy, z1), P(x2, hy, z2), chordR * 0.55, 6));
    parts.push(tube(P(x1, hy, z1), P(x2, -hy, z2), chordR * 0.55, 6));
    // Connection face where a truss end bolts on: spigots at the truss chords, tied by a frame.
    const mx = (x1 + x2) / 2;
    const mz = (z1 + z2) / 2;
    const out = new THREE.Vector3(mx, 0, mz).normalize();
    const side = new THREE.Vector3(-out.z, 0, out.x);
    const k = trussH / 2 - inset;
    const face = new THREE.Vector3(center.x + mx + out.x * r, center.y, center.z + mz + out.z * r);
    const spig = [
      [k, k],
      [-k, k],
      [-k, -k],
      [k, -k],
    ].map(([a, yy]) => face.clone().addScaledVector(side, a).add(new THREE.Vector3(0, yy, 0)));
    for (let j = 0; j < 4; j++) {
      parts.push(tube(spig[j], spig[(j + 1) % 4], chordR * 0.6, 6));
      parts.push(tube(spig[j].clone().addScaledVector(out, -r), spig[j].clone().addScaledVector(out, 1.6), chordR * 0.95, 10));
    }
  }
  // Guide rollers: a pair top and bottom at each tower chord, axles square to the diagonal.
  const c = towerW / 2 - inset;
  for (const [sx, sz] of cs.map(([x, z]) => [Math.sign(x), Math.sign(z)])) {
    for (const y of [-hy + 2, hy - 2]) {
      const at = P(sx * (c + chordR + 1.1), y, sz * (c + chordR + 1.1));
      const axle = new THREE.Vector3(sx, 0, -sz).normalize();
      const g = new THREE.CylinderGeometry(1.1, 1.1, 2.4, 12);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, axle));
      g.translate(at.x, at.y, at.z);
      parts.push(g.toNonIndexed());
      // Roller arm back to the frame corner.
      parts.push(tube(at, P(sx * h, y, sz * h), 0.7, 6).toNonIndexed());
    }
  }
  // The climbing hoist sits on the sleeve at one corner; its chain runs up to the head block.
  if (chainTop !== undefined) {
    const at = P(h + 6, hy + 5, h + 6);
    const body = new THREE.CylinderGeometry(4.2, 4.2, 10, 16);
    body.rotateZ(Math.PI / 2);
    body.translate(at.x, at.y, at.z);
    parts.push(body, box(at.clone().add(new THREE.Vector3(-6.5, 0, 0)), 3, 7.5, 7.5), box(P(h + 3, hy, h + 3), 9, 1.5, 9));
    parts.push(tube(at.clone().add(new THREE.Vector3(0, 4, 0)), new THREE.Vector3(at.x, chainTop, at.z), 0.4, 6));
  }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
}

/**
 * A tower head block: a square frame of box beams with a cross through the middle, a sheave plate
 * on top with two chain wheels, and a socket under it that the top tower section pins into.
 */
function headBlock(center: THREE.Vector3, size: number, thick: number, towerW: number): THREE.BufferGeometry {
  const b = 3.5; // beam width
  const parts: THREE.BufferGeometry[] = [];
  const P = (x: number, y: number, z: number) => new THREE.Vector3(center.x + x, center.y + y, center.z + z);
  const e = size / 2 - b / 2;
  parts.push(box(P(0, 0, e), size, thick, b), box(P(0, 0, -e), size, thick, b), box(P(e, 0, 0), b, thick, size - 2 * b), box(P(-e, 0, 0), b, thick, size - 2 * b));
  parts.push(box(P(0, 0, 0), size - 2 * b, thick * 0.8, b), box(P(0, 0, 0), b, thick * 0.8, size - 2 * b));
  // Socket the tower pins into, just under the frame.
  parts.push(box(P(0, -thick / 2 - 1.5, 0), towerW + 1, 3, towerW + 1));
  // Sheave plate and two chain wheels on top.
  parts.push(box(P(0, thick / 2 + 0.4, 0), towerW, 0.8, towerW));
  for (const z of [-4, 4]) {
    const g = new THREE.CylinderGeometry(4.2, 4.2, 1.6, 20);
    g.rotateX(Math.PI / 2);
    g.translate(center.x, center.y + thick / 2 + 4.6, center.z + z);
    parts.push(g.toNonIndexed());
    parts.push(box(P(0, thick / 2 + 3, z + Math.sign(z) * 1.4), 2.5, 5.2, 0.6));
  }
  // Lifting eyes at the corners.
  for (const [x, z] of [
    [e, e],
    [-e, e],
    [-e, -e],
    [e, -e],
  ]) {
    const g = new THREE.TorusGeometry(1.5, 0.45, 6, 12);
    g.translate(center.x + x, center.y + thick / 2 + 1.8, center.z + z);
    parts.push(g.toNonIndexed());
  }
  return mergeGeometries(parts)!;
}

/** A tower base: the plate, a socket for the bottom section, and a levelling jack at each corner. */
function towerBase(center: THREE.Vector3, size: number, thick: number, towerW: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [box(center, size, thick, size)];
  const top = center.y + thick / 2;
  for (const [x, z] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ]) {
    const at = new THREE.Vector3(center.x + x * (size / 2 - 2.5), top, center.z + z * (size / 2 - 2.5));
    // Levelling jack: a threaded rod through the plate with a T handle on top.
    parts.push(tube(at.clone().add(new THREE.Vector3(0, -thick - 1, 0)), at.clone().add(new THREE.Vector3(0, 6, 0)), 0.7, 8).toNonIndexed());
    parts.push(tube(at.clone().add(new THREE.Vector3(-2.5, 6, 0)), at.clone().add(new THREE.Vector3(2.5, 6, 0)), 0.45, 6).toNonIndexed());
    const foot = new THREE.CylinderGeometry(2, 2.2, 0.6, 12);
    foot.translate(at.x, center.y - thick / 2 - 0.9, at.z);
    parts.push(foot.toNonIndexed());
  }
  // Socket the bottom tower section pins into.
  parts.push(box(new THREE.Vector3(center.x, top + 1, center.z), towerW + 1.5, 2, towerW + 1.5));
  return mergeGeometries(parts)!;
}

/** A chain hoist hanging from a point: body, gearbox, chain up to the hook point and a bag. */
export function hoistGeometry(at: THREE.Vector3, deadhang: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  if (deadhang) {
    parts.push(tube(at, at.clone().add(new THREE.Vector3(0, 60, 0)), 0.5, 6).toNonIndexed());
    const s = new THREE.TorusGeometry(1.6, 0.5, 6, 12);
    s.translate(at.x, at.y + 1.6, at.z);
    parts.push(s.toNonIndexed());
    return mergeGeometries(parts)!;
  }
  const body = new THREE.CylinderGeometry(4.5, 4.5, 11, 16);
  body.rotateZ(Math.PI / 2);
  body.translate(at.x, at.y + 16, at.z);
  parts.push(body.toNonIndexed(), box(new THREE.Vector3(at.x + 7, at.y + 16, at.z), 3, 8, 8));
  parts.push(tube(at.clone().add(new THREE.Vector3(0, 21, 0)), at.clone().add(new THREE.Vector3(0, 96, 0)), 0.35, 6).toNonIndexed());
  parts.push(tube(at, at.clone().add(new THREE.Vector3(0, 11, 0)), 0.35, 6).toNonIndexed());
  const bag = new THREE.CylinderGeometry(3, 2.4, 9, 12);
  bag.translate(at.x - 6, at.y + 9, at.z);
  parts.push(bag.toNonIndexed());
  const hook = new THREE.TorusGeometry(1.4, 0.45, 6, 12, Math.PI * 1.5);
  hook.translate(at.x, at.y + 1.2, at.z);
  parts.push(hook.toNonIndexed());
  return mergeGeometries(parts)!;
}

function clamp(at: THREE.Vector3, pipeDir: THREE.Vector3, chordDir: THREE.Vector3, normal: THREE.Vector3, offset: number): THREE.BufferGeometry {
  const ring = (c: THREE.Vector3, d: THREE.Vector3) => {
    const g = new THREE.TorusGeometry(1.35, 0.5, 6, 14);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.clone().normalize()));
    g.translate(c.x, c.y, c.z);
    return g;
  };
  const far = at.clone().addScaledVector(normal, offset);
  const body = tube(at, far, 0.9, 8);
  return mergeGeometries([ring(at, pipeDir), ring(far, chordDir), body].map((g) => g.toNonIndexed()))!;
}

/** A hanging panel: its top edge runs a → b (three space), `drop` tall, thin. */
function panel(a: THREE.Vector3, b: THREE.Vector3, drop: number): THREE.BufferGeometry {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.BoxGeometry(d.length(), drop, 0.4);
  g.rotateY(-Math.atan2(d.z, d.x));
  g.translate((a.x + b.x) / 2, a.y - drop / 2, (a.z + b.z) / 2);
  return g;
}

/** Top rail, mid rail and posts at both ends (rig space in, three space out). */
function guardrail(start: Vec3, end: Vec3, height: number): THREE.BufferGeometry {
  const a = toThree(start);
  const b = toThree(end);
  const up = (p: THREE.Vector3, h: number) => p.clone().add(new THREE.Vector3(0, h, 0));
  const r = 0.85;
  return mergeGeometries([tube(a, up(a, height), r), tube(b, up(b, height), r), tube(up(a, height), up(b, height), r), tube(up(a, height / 2), up(b, height / 2), r * 0.8)].map((g) => g.toNonIndexed()))!;
}

/** Treads stepping down and out from the deck edge. */
function stairUnit(p: { at: Vec3; out: Vec3; width: number; rise: number; risers: number }, tread: number): THREE.BufferGeometry {
  const riser = p.rise / p.risers;
  const parts: THREE.BufferGeometry[] = [];
  const out = new THREE.Vector3(p.out[0], 0, -p.out[1]).normalize();
  const base = toThree(p.at);
  for (let i = 1; i < p.risers; i++) {
    // Step i from the top: its tread is i treads out, (risers − i) risers up.
    const h = (p.risers - i) * riser;
    const g = new THREE.BoxGeometry(p.width, h, tread);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), out));
    const c = base.clone().addScaledVector(out, (i - 0.5) * tread).add(new THREE.Vector3(0, h / 2, 0));
    g.translate(c.x, c.y, c.z);
    parts.push(g.toNonIndexed());
  }
  return parts.length ? mergeGeometries(parts)! : new THREE.BoxGeometry(p.width, 0.5, tread);
}

export type Look = { truss: string; corner: string; pipe: string; clamp: string; plate: string; selected: string; ground: string; grid: string; bg: string };

export type PartMesh = THREE.Mesh & { userData: { partId: string; kind: Part["kind"] } };

export type Mats = Record<Part["kind"], THREE.MeshStandardMaterial>;

/** One material per kind, made once per viewer and shared by every rebuild. */
export function makeMaterials(look: Look): Mats {
  return {
    truss: new THREE.MeshStandardMaterial({ color: look.truss, metalness: 0.6, roughness: 0.35 }),
    corner: new THREE.MeshStandardMaterial({ color: look.corner, metalness: 0.6, roughness: 0.35 }),
    pipe: new THREE.MeshStandardMaterial({ color: look.pipe, metalness: 0.5, roughness: 0.45 }),
    clamp: new THREE.MeshStandardMaterial({ color: look.clamp, metalness: 0.7, roughness: 0.3 }),
    baseplate: new THREE.MeshStandardMaterial({ color: look.plate, metalness: 0.4, roughness: 0.6 }),
    deck: new THREE.MeshStandardMaterial({ color: look.corner, metalness: 0.1, roughness: 0.8 }),
    leg: new THREE.MeshStandardMaterial({ color: look.truss, metalness: 0.6, roughness: 0.35 }),
    skirt: new THREE.MeshStandardMaterial({ color: look.plate, metalness: 0, roughness: 0.95, side: THREE.DoubleSide }),
    rail: new THREE.MeshStandardMaterial({ color: look.truss, metalness: 0.6, roughness: 0.35 }),
    stairs: new THREE.MeshStandardMaterial({ color: look.corner, metalness: 0.1, roughness: 0.8 }),
  };
}

/** Faded copies of each kind's material, for everything that isn't selected. */
export function dimMaterials(mats: Mats): Mats {
  const out = {} as Mats;
  for (const [k, m] of Object.entries(mats) as [Part["kind"], THREE.MeshStandardMaterial][]) {
    const d = m.clone();
    d.transparent = true;
    d.opacity = 0.28;
    out[k] = d;
  }
  return out;
}

/** Frees a rig's geometries (materials are shared and freed by their owner). */
export function disposeGeometries(g: THREE.Object3D) {
  g.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
}

/** Every part as a mesh, in a group that sits on the floor. */
export function buildScene(list: BuildList, mats: Mats): THREE.Group {
  const group = new THREE.Group();
  const { width, chordInset, chordOd } = list.series;
  const chordR = chordOd / 2;
  for (const p of list.parts) {
    let geo: THREE.BufferGeometry;
    switch (p.kind) {
      case "truss":
        geo = boxTruss(toThree(p.start), toThree(p.end), width, chordInset, chordR);
        break;
      case "corner":
        if (p.role === "head") geo = headBlock(toThree(p.center), p.size, p.thick ?? 7.5, width);
        else if (p.role === "sleeve") {
          const head = list.parts.find((q) => q.kind === "corner" && q.role === "head" && Math.abs(q.center[0] - p.center[0]) < 0.5 && Math.abs(q.center[1] - p.center[1]) < 0.5);
          const top = head && head.kind === "corner" ? head.center[2] - (head.thick ?? 0) / 2 : undefined;
          geo = sleeveBlock(toThree(p.center), p.size, list.series.height, width, chordInset, chordR, top);
        }
        else geo = cornerBlock(toThree(p.center), p.size, chordInset, chordR);
        break;
      case "pipe":
        geo = tube(toThree(p.start), toThree(p.end), p.od / 2, 12);
        break;
      case "clamp":
        geo = clamp(toThree(p.at), toThree(p.pipeDir), toThree(p.chordDir), toThree(p.normal), p.offset);
        break;
      case "baseplate": {
        const thick = Math.max(0.5, 2 * p.center[2]);
        const c = toThree(p.center);
        if (p.center[2] > 0) geo = towerBase(c, p.size, thick, width);
        else {
          geo = new THREE.BoxGeometry(p.size, thick, p.size);
          geo.translate(c.x, c.y, c.z);
        }
        break;
      }
      case "deck": {
        // Frame plus top: from the underside (at) up to the walking surface, 4" in all.
        const [x, z] = p.rotation === 0 ? [p.length, p.width] : [p.width, p.length];
        geo = new THREE.BoxGeometry(x, 4, z);
        const c = toThree(p.at);
        geo.translate(c.x, c.y + 2, c.z);
        break;
      }
      case "leg": {
        const a = toThree(p.at);
        geo = tube(a, a.clone().add(new THREE.Vector3(0, p.height - 3, 0)), 0.8, 8);
        break;
      }
      case "skirt":
        geo = panel(toThree(p.start), toThree(p.end), p.drop);
        break;
      case "rail":
        geo = guardrail(p.start, p.end, p.height);
        break;
      case "stairs":
        geo = stairUnit(p, p.run / Math.max(1, p.risers - 1));
        break;
    }
    const mesh = new THREE.Mesh(geo, mats[p.kind]) as unknown as PartMesh;
    mesh.userData = { partId: p.id, kind: p.kind };
    group.add(mesh);
  }
  return group;
}

/** Meshes in a group, ready for raycasting. */
export const partMeshes = (g: THREE.Object3D) => g.children.filter((c): c is PartMesh => (c as THREE.Mesh).isMesh && !!c.userData.partId);
