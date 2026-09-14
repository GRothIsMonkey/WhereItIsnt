"use strict";
/* =====================================================================================
   THE ASHEN FOREST CINDER FLAKES
   ERA 1.5.6 — MOVED VERBATIM OUT OF game.html.

   One bounded, recycled particle field that follows the camera. Pure decoration: it
   reads a position and an intensity and produces drifting motes.

   BOUNDED AND POOLED, WHICH IS THE POINT (section 72). The count is fixed at
   construction and flakes are wrapped rather than allocated, so the Farmlands can be
   traversed for an hour without the scene growing.
   Every line below is byte-identical to the text that was in game.html, comments and all.
   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md section 4.8 and src/rendering/LAYER.md.
   ===================================================================================== */

class AshParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.count = 240;
    this.radius = 20;  // horizontal spread around the follow point
    this.height = 16;  // vertical spread above the follow point

    const positions = new Float32Array(this.count * 3);
    this.fallSpeed = new Float32Array(this.count);
    this.swayPhase = new Float32Array(this.count);
    this.swaySpeed = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * this.radius * 2;
      positions[i * 3 + 1] = Math.random() * this.height;
      positions[i * 3 + 2] = (Math.random() - 0.5) * this.radius * 2;
      this.fallSpeed[i] = 0.25 + Math.random() * 0.35;
      this.swayPhase[i] = Math.random() * Math.PI * 2;
      this.swaySpeed[i] = 0.15 + Math.random() * 0.3;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x9a9284,
      size: 0.09,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.scene.add(this.points);

    this.active = false;
    this._t = 0;
  }

  setActive(active) {
    active = !!active;
    if (this.active === active) return;
    this.active = active;
    this.points.visible = active;
  }

  update(dt, followPos) {
    if (!this.active) return;
    this._t += dt;
    this.points.position.set(followPos.x, 0, followPos.z);

    const positions = this.points.geometry.attributes.position.array;
    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      positions[idx + 1] -= this.fallSpeed[i] * dt;
      positions[idx] += Math.sin(this._t * this.swaySpeed[i] + this.swayPhase[i]) * dt * 0.35;
      if (positions[idx + 1] < 0) {
        positions[idx] = (Math.random() - 0.5) * this.radius * 2;
        positions[idx + 1] = this.height;
        positions[idx + 2] = (Math.random() - 0.5) * this.radius * 2;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
