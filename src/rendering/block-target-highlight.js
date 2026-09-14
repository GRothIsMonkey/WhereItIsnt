"use strict";
/* =====================================================================================
   THE OUTLINE UNDER THE CROSSHAIR
   ERA 1.5.6 — MOVED VERBATIM OUT OF game.html.

   The white box on the block you are looking at, the red one on a block your tool
   cannot break, and the crack overlay while it breaks. Phase 28 made this the primary
   teacher of the mining verb — there is no tutorial, and this outline is most of why
   none is needed (section 54).

   IT NAMES NO BLOCK ID. It is handed a position, a size and a state; what is there and
   whether it can be broken are decided elsewhere. That is why it moves cleanly and why
   Era 2 keeps it: a first-person game still has to show you what you are aiming at.
   Every line below is byte-identical to the text that was in game.html, comments and all.
   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md section 4.8 and src/rendering/LAYER.md.
   ===================================================================================== */

class BlockTargetHighlight {
  constructor(scene) {
    this.scene = scene;
    this.key = null;
    this.stage = -1;

    const box = new THREE.BoxGeometry(1, 1, 1);
    this.outlineMat = new THREE.LineBasicMaterial({
      color: MINING_OUTLINE_IDLE, transparent: true, opacity: 0.9, depthWrite: false
    });
    this.outline = new THREE.LineSegments(new THREE.EdgesGeometry(box), this.outlineMat);
    this.outline.scale.setScalar(1.004);
    this.outline.renderOrder = 3;
    this.outline.visible = false;
    this.outline.frustumCulled = false;
    scene.add(this.outline);

    this.crackTextures = buildCrackStageTextures(MINING_CRACK_STAGES);
    this.crackMat = new THREE.MeshBasicMaterial({
      map: this.crackTextures[0], transparent: true, opacity: 0.9,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
    });
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.002, 1.002, 1.002), this.crackMat);
    this.crack.renderOrder = 4;
    this.crack.visible = false;
    this.crack.frustumCulled = false;
    scene.add(this.crack);
    this._boxGeo = box;
  }

  /* Show the outline on a voxel. `state` drives colour only: 'idle' | 'mining' | 'blocked'. */
  setTarget(bx, by, bz, state, blockId) {
    const key = bx + ',' + by + ',' + bz;
    if (key !== this.key) {
      this.key = key;
      /* PHASE 13 — squash the outline down onto a shaped block's real height, so
         highlighting a kerb, a slab or a porch step doesn't draw a full cube hanging in
         the air above it. Full cubes are unaffected (shapeTopAt returns 1). */
      const top = blockId === undefined ? 1 : shapeTopAt(blockId);
      this.outline.scale.set(1, top, 1);
      this.outline.position.set(bx + 0.5, by + top * 0.5, bz + 0.5);
      this.crack.position.set(bx + 0.5, by + top * 0.5, bz + 0.5);
      this.setProgress(0);
    }
    const color = state === 'blocked' ? MINING_OUTLINE_BLOCKED
      : state === 'mining' ? MINING_OUTLINE_ACTIVE : MINING_OUTLINE_IDLE;
    this.outlineMat.color.setHex(color);
    this.outlineMat.opacity = state === 'idle' ? 0.9 : 1.0;
    this.outline.visible = true;
  }

  /* frac 0..1 — selects a crack frame. Frame 0 means "untouched": no overlay at all. */
  setProgress(frac) {
    if (frac <= 0.001) {
      if (this.stage !== -1) { this.stage = -1; this.crack.visible = false; }
      return;
    }
    const stage = Math.min(MINING_CRACK_STAGES - 1, Math.floor(frac * MINING_CRACK_STAGES));
    if (stage !== this.stage) {
      this.stage = stage;
      this.crackMat.map = this.crackTextures[stage];
      this.crackMat.needsUpdate = true;
    }
    this.crack.visible = true;
  }

  hide() {
    this.key = null;
    this.stage = -1;
    this.outline.visible = false;
    this.crack.visible = false;
  }

  dispose() {
    this.scene.remove(this.outline);
    this.scene.remove(this.crack);
    this.outline.geometry.dispose();
    this.outlineMat.dispose();
    this.crack.geometry.dispose();
    this.crackMat.dispose();
    for (const t of this.crackTextures) t.dispose();
    this._boxGeo.dispose();
  }
}
