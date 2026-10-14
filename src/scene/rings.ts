import * as THREE from 'three';

/** Expanding rings that show the radio signal leaving an antenna. */
export class RingPool {
  private rings: { mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; t: number }[] = [];

  constructor(scene: THREE.Scene, color: number, private size: number, count = 6) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({ mesh, t: 1 });
    }
  }

  emit(pos: THREE.Vector3): void {
    const r = this.rings.find((x) => x.t >= 1) ?? this.rings[0];
    r.t = 0; r.mesh.position.copy(pos); r.mesh.visible = true;
  }

  update(dt: number, camera: THREE.Camera): void {
    for (const r of this.rings) {
      if (r.t >= 1) { r.mesh.visible = false; continue; }
      r.t += dt / 1.1;
      r.mesh.scale.setScalar(0.3 + r.t * this.size);
      r.mesh.material.opacity = (1 - r.t) * 0.55;
      r.mesh.lookAt(camera.position);
    }
  }
}
