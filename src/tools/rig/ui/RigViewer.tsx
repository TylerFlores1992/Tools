"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BuildList } from "../types";
import { buildScene, dimMaterials, disposeGeometries, makeMaterials, partMeshes, type Look, type Mats } from "./scene";

export type ViewerHandle = {
  /** The rig as a USDZ file for iPhone AR Quick Look (meters, Y up). */
  usdz: () => Promise<Blob>;
  /** Back to the starting angle. */
  resetView: () => void;
};

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";

function readLook(): Look {
  return {
    truss: cssVar("--fw-ink-2"),
    corner: cssVar("--fw-ink"),
    pipe: cssVar("--fw-control"),
    clamp: cssVar("--fw-ink"),
    plate: cssVar("--fw-muted"),
    selected: cssVar("--fw-ember"),
    ground: cssVar("--fw-surface"),
    grid: cssVar("--fw-control"),
    bg: cssVar("--fw-bg"),
  };
}

type State = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  rig: THREE.Group | null;
  mats: Mats;
  dim: Mats;
  picked: THREE.MeshStandardMaterial;
  fit: () => void;
  /** Ask for a frame; drawing only happens when something changed. */
  invalidate: () => void;
};

/**
 * The rig in 3D. Drag to orbit, pinch or scroll to zoom, two fingers to pan, tap a part to pick
 * it. The picked part turns ember AND everything else fades, and the sheet names it in words, so
 * the choice never rests on colour alone. Parts can also be picked from a list (Parts tab).
 */
export const RigViewer = forwardRef<ViewerHandle, { list: BuildList; selected: string | null; onSelect: (id: string | null) => void; label: string }>(
  function RigViewer({ list, selected, onSelect, label }, ref) {
    const host = useRef<HTMLDivElement>(null);
    const state = useRef<State | null>(null);
    const onSelectRef = useRef(onSelect);
    useEffect(() => {
      onSelectRef.current = onSelect;
    }, [onSelect]);

    // One renderer for the life of the page.
    useEffect(() => {
      const el = host.current;
      if (!el) return;
      const look = readLook();
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      } catch {
        el.dataset.webgl = "off";
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(look.bg);
      el.appendChild(renderer.domElement);
      renderer.domElement.style.touchAction = "none";
      renderer.domElement.style.display = "block";
      const scene = new THREE.Scene();
      const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 1.6);
      const sun = new THREE.DirectionalLight(0xffffff, 1.8);
      sun.position.set(300, 500, 400);
      const grid = new THREE.GridHelper(1200, 100, look.grid, look.grid);
      const gridMat = grid.material as THREE.Material;
      gridMat.transparent = true;
      gridMat.opacity = 0.22;
      scene.add(hemi, sun, grid);
      const camera = new THREE.PerspectiveCamera(40, 1, 1, 20000);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.maxPolarAngle = Math.PI * 0.495;

      // Render on demand: a frame when asked, and a few more while damping settles.
      let raf = 0;
      const frame = () => {
        raf = 0;
        const moving = controls.update();
        renderer.render(scene, camera);
        if (moving) invalidate();
      };
      const invalidate = () => {
        if (!raf) raf = requestAnimationFrame(frame);
      };
      controls.addEventListener("change", invalidate);

      const fit = () => {
        const rig = state.current?.rig;
        if (!rig) return;
        const sphere = new THREE.Box3().setFromObject(rig).getBoundingSphere(new THREE.Sphere());
        const r = Math.max(sphere.radius, 30);
        // Distance that fits the sphere in the narrower of the two fields of view, plus margin.
        const vFov = THREE.MathUtils.degToRad(camera.fov);
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
        const dist = (r / Math.sin(Math.min(vFov, hFov) / 2)) * 1.08;
        const dir = new THREE.Vector3(0.62, 0.42, 0.66).normalize();
        controls.target.copy(sphere.center);
        camera.position.copy(sphere.center).addScaledVector(dir, dist);
        camera.near = dist / 100;
        camera.far = dist * 20;
        camera.updateProjectionMatrix();
        controls.update();
        invalidate();
      };
      const mats = makeMaterials(look);
      const dim = dimMaterials(mats);
      const picked = new THREE.MeshStandardMaterial({ color: look.selected, emissive: look.selected, emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.4 });
      state.current = { renderer, scene, camera, controls, rig: null, mats, dim, picked, fit, invalidate };

      const resize = () => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
        invalidate();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(el);
      resize();

      // A tap (one finger, barely moved) picks a part; pinches and drags never do.
      const ray = new THREE.Raycaster();
      const pointers = new Map<number, { x: number; y: number }>();
      let multi = false;
      const onDown = (e: PointerEvent) => {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size > 1) multi = true;
      };
      const onUp = (e: PointerEvent) => {
        const start = pointers.get(e.pointerId);
        pointers.delete(e.pointerId);
        const wasMulti = multi;
        if (pointers.size === 0) multi = false;
        if (!start || wasMulti || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;
        const rect = renderer.domElement.getBoundingClientRect();
        ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
        const rig = state.current?.rig;
        const hit = rig ? ray.intersectObjects(partMeshes(rig), false)[0] : undefined;
        onSelectRef.current(hit ? (hit.object.userData.partId as string) : null);
      };
      const onCancel = (e: PointerEvent) => {
        pointers.delete(e.pointerId);
        if (pointers.size === 0) multi = false;
      };
      const c = renderer.domElement;
      c.addEventListener("pointerdown", onDown);
      c.addEventListener("pointerup", onUp);
      c.addEventListener("pointercancel", onCancel);

      return () => {
        if (raf) cancelAnimationFrame(raf);
        ro.disconnect();
        c.removeEventListener("pointerdown", onDown);
        c.removeEventListener("pointerup", onUp);
        c.removeEventListener("pointercancel", onCancel);
        controls.dispose();
        if (state.current?.rig) disposeGeometries(state.current.rig);
        for (const m of [...Object.values(mats), ...Object.values(dim), picked, gridMat]) m.dispose();
        grid.geometry.dispose();
        hemi.dispose();
        sun.dispose();
        renderer.dispose();
        c.remove();
        state.current = null;
      };
    }, []);

    // Rebuild the rig when the design changes; keep the camera unless the size changed a lot.
    const lastSize = useRef<number>(0);
    useEffect(() => {
      const s = state.current;
      if (!s) return;
      const first = !s.rig;
      if (s.rig) {
        s.scene.remove(s.rig);
        disposeGeometries(s.rig);
      }
      s.rig = buildScene(list, s.mats);
      s.scene.add(s.rig);
      const size = new THREE.Box3().setFromObject(s.rig).getSize(new THREE.Vector3()).length();
      if (first || !lastSize.current || Math.abs(size - lastSize.current) / lastSize.current > 0.25) s.fit();
      lastSize.current = size;
      s.invalidate();
    }, [list]);

    // Selection look: shared materials, swapped, never created per change.
    useEffect(() => {
      const s = state.current;
      if (!s?.rig) return;
      for (const m of partMeshes(s.rig)) {
        const kind = m.userData.kind;
        m.material = !selected ? s.mats[kind] : m.userData.partId === selected ? s.picked : s.dim[kind];
      }
      s.invalidate();
    }, [selected, list]);

    useImperativeHandle(ref, () => ({
      resetView: () => state.current?.fit(),
      usdz: async () => {
        const s = state.current;
        if (!s?.rig) throw new Error("no scene");
        const { USDZExporter } = await import("three/examples/jsm/exporters/USDZExporter.js");
        const copy = buildScene(list, s.mats);
        const holder = new THREE.Group();
        holder.add(copy);
        holder.scale.setScalar(0.0254); // inches → meters
        holder.updateMatrixWorld(true);
        try {
          const data = await new USDZExporter().parseAsync(holder);
          return new Blob([data as BlobPart], { type: "model/vnd.usdz+zip" });
        } finally {
          disposeGeometries(copy);
        }
      },
    }));

    return <div ref={host} role="img" aria-label={label} className="relative h-full w-full overflow-hidden rounded-card bg-bg [&[data-webgl=off]]:grid [&[data-webgl=off]]:place-items-center" />;
  },
);
