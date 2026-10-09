/**
 * Keeps 3D object models (Hunyuan GLBs) placed into a world in sync with the saved placement list.
 * Models load once per object and are cloned per placement. Each is normalised so its largest side
 * is 1 m with its base on y = 0, then the placement's position, rotation and scale apply.
 */

import { useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { WorldPlacement as Placement } from '../services/jobService';

export interface WorldObject {
  /** The object render's id. */
  id: string;
  name: string;
  modelUrl: string;
}

export type { Placement };

const loader = new GLTFLoader();
const models = new Map<string, Promise<THREE.Object3D>>();

/** Unit-size copy of a model: largest side 1 m, centred on x / z, base on y = 0. */
export function normalizeModel(model: THREE.Object3D): THREE.Group {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const fit = 1 / (Math.max(size.x, size.y, size.z) || 1);
  const center = box.getCenter(new THREE.Vector3());
  model.scale.multiplyScalar(fit);
  model.position.set(-center.x * fit, -box.min.y * fit, -center.z * fit);
  const wrapper = new THREE.Group();
  wrapper.add(model);
  return wrapper;
}

function loadModel(url: string): Promise<THREE.Object3D> {
  let model = models.get(url);
  if (!model) {
    model = loader.loadAsync(url).then((gltf) => normalizeModel(gltf.scene));
    model.catch(() => models.delete(url)); // allow a retry after a failed load
    models.set(url, model);
  }
  return model;
}

/** Placement id of the placed object hit by `raycaster`, if any. */
export function pickPlacement(root: THREE.Object3D, raycaster: THREE.Raycaster): string | null {
  for (const hit of raycaster.intersectObject(root, true)) {
    let node: THREE.Object3D | null = hit.object;
    while (node && node !== root) {
      if (node.userData.placementId) return node.userData.placementId as string;
      node = node.parent;
    }
  }
  return null;
}

export function useWorldObjects(
  root: THREE.Group | null,
  objects: WorldObject[],
  placements: Placement[],
  selectedId: string | null,
) {
  useEffect(() => {
    if (!root) return;
    let stale = false;
    const urls = new Map(objects.map((o) => [o.id, o.modelUrl]));

    Promise.all(placements.map(async (placement) => {
      const url = urls.get(placement.object_render_id);
      if (!url) return null;
      try {
        const node = (await loadModel(url)).clone(true);
        node.userData.placementId = placement.id;
        node.position.set(...placement.position);
        node.rotation.y = placement.rotation_y;
        node.scale.setScalar(placement.scale);
        return node;
      } catch (err) {
        console.warn('3D object failed to load', placement.object_render_id, err);
        return null;
      }
    })).then((nodes) => {
      if (stale) return;
      root.clear();
      for (const node of nodes) {
        if (!node) continue;
        root.add(node);
        if (node.userData.placementId === selectedId) root.add(new THREE.BoxHelper(node, 0xfacc15));
      }
    });

    return () => {
      stale = true;
    };
  }, [root, objects, placements, selectedId]);
}
