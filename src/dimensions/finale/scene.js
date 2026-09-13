"use strict";
/* =====================================================================================
   THE FINALE'S WORLD SIDE
   ERA 1.5.3 — MOVED VERBATIM OUT OF VoxelWorld.

   Two methods: build the finale's ground scene and dispose it. The sequence itself —
   FINALE_BEATS, the creature, the camera drift — is FinalSequence in game.html and was
   not touched. CLAUDE.md section 59 governs all of it.

   The finale is not a saveable dimension and has no stable id; it is a place the player
   is taken to once. It has its own directory because its world content is its own.

   Every method below is byte-identical to the text that was in game.html, comments and
   all. It is attached to VoxelWorld's prototype by registerWorldContent, which copies
   property descriptors so a moved method is indistinguishable from a declared one.
   See src/world/world-content.js and ARCHITECTURE.md.
   ===================================================================================== */

registerWorldContent('finale', 'generation', class {

  /* =================================================================================
     PHASE 33 — BUILDING AND DISPOSING THE FINALE.

     VoxelWorld owns this for one reason only: it owns the scene graph, and every other
     "put something in the world and take it out again" path in the build lives here too
     (the Haven pocket, the tower proxies, the landmark silhouettes). Nothing about the
     CINEMATIC is here — no beats, no camera, no timing. FinalSequence asks for a scene
     and later asks for it to go away, and that is the whole interface between them,
     which is what lets Era 2 replace either side on its own.

     `atX/atZ/eyeY` place it on the player rather than on a fixed coordinate, so the
     finale composes itself around wherever the Haven happened to leave them. The
     creature stands along -Z, which is the bearing yaw 0 faces. */
  buildFinale(atX, atZ, groundY) {
    if (this.finale) return this.finale;

    const root = new THREE.Group();
    root.position.set(atX, groundY, atZ);

    const scene = buildFinaleScene();
    root.add(scene.group);

    const creature = buildFinalCreature(FINAL_CREATURE_HEIGHT);
    creature.group.position.set(0, 0, -FINALE_CREATURE_DISTANCE);
    root.add(creature.group);

    this.scene.add(root);
    this.finale = { root, scene, creature, groundY };
    return this.finale;
  }

  /* ONE TEARDOWN, and it disposes geometry and materials rather than only detaching the
     group — the finale's meshes are built per run and a New Game after the credits would
     otherwise leak a hundred and fifty metres of creature per playthrough. Idempotent:
     the handle is nulled first, so a second call finds nothing. */
  disposeFinale() {
    const f = this.finale;
    if (!f) return false;
    this.finale = null;
    this.scene.remove(f.root);
    f.root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
    return true;
  }
});
