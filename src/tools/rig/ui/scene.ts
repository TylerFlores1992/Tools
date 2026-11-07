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
        geo = cornerBlock(toThree(p.center), p.size, chordInset, chordR);
        break;
      case "pipe":
        geo = tube(toThree(p.start), toThree(p.end), p.od / 2, 12);
        break;
      case "clamp":
        geo = clamp(toThree(p.at), toThree(p.pipeDir), toThree(p.chordDir), toThree(p.normal), p.offset);
        break;
      case "baseplate": {
        geo = new THREE.BoxGeometry(p.size, 0.5, p.size);
        const c = toThree(p.center);
        geo.translate(c.x, c.y, c.z);
        break;
      }
    }
    const mesh = new THREE.Mesh(geo, mats[p.kind]) as unknown as PartMesh;
    mesh.userData = { partId: p.id, kind: p.kind };
    group.add(mesh);
  }
  return group;
}

/** Meshes in a group, ready for raycasting. */
export const partMeshes = (g: THREE.Object3D) => g.children.filter((c): c is PartMesh => (c as THREE.Mesh).isMesh && !!c.userData.partId);
