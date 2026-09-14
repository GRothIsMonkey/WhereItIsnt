"use strict";
/* =====================================================================================
   THE FARMLAND ANIMALS
   ERA 1.5.6 — MOVED VERBATIM OUT OF game.html.

   Phase 18.2's parametric animal library: cow, sheep, chicken, horse, each across four
   condition tiers, built from the shared loft/blade/lump/patch/spike primitives with
   shared geometry and shared materials (sections 21, 22, 72).

   THE FOUR SPECIES MUST STAY VISUALLY DISTINCT and must never collapse into reskins
   (section 21). VISUAL CONDITION IS NOT BEHAVIOUR (section 23): this file decides how an
   animal LOOKS, and nothing in it may read or set how one acts. That separation is
   permanent and it is why the deterioration archetypes are here and the behaviour states
   are not.
   Every line below is byte-identical to the text that was in game.html, comments and all.
   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md section 4.8 and src/rendering/LAYER.md.
   ===================================================================================== */

function buildFarmAnimalMesh(species, cond, variant) {
  variant = variant | 0;
  const group = new THREE.Group();
  const M = _animMats(species, cond);
  const parts = [];
  const add = (parent, geo, mat, x, y, z, rx, ry, rz, sc) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    if (sc) m.scale.set(sc, sc, sc);
    m.castShadow = true;
    parent.add(m); parts.push(m);
    return m;
  };
  /* Deterministic per-(species, condition, variant) stream. Every animal drawn from this
     pool bucket is identical, which is what keeps the bucket reusable; per-animal
     variation is applied as transforms at acquire time, never as new geometry. */
  let ps = (species * 7349 + cond * 15731 + variant * 6151 + 1) >>> 0;
  const rnd = () => { ps ^= ps << 13; ps >>>= 0; ps ^= ps >>> 17; ps ^= ps << 5; ps >>>= 0; return (ps % 10000) / 10000; };

  const sev = cond;                       // 0..3
  const gaunt = FARM_ANIM_GAUNT[cond];
  // Which region this animal's deterioration concentrates on.
  const RG = { FLANK: 0, FACE: 1, SHOULDER: 2, REAR: 3 }[['FLANK','FACE','SHOULDER','REAR'][variant & 3]];
  const hits = (region) => sev > 0 && (RG === region || sev === 3);

  /* The animator's handles are RECORDED as each species builds them, not searched for
     afterwards. Searching the tree by "first child group that has children" picked the
     chicken's WING as its neck and then lost the head entirely — the kind of failure that
     silently produces an animal whose head never moves. */
  let RIG_BODY = null, RIG_NECK = null, RIG_HEAD = null;

  // Detail groups, toggled by distance. See FarmAnimal.setLod.
  const detailNear = new THREE.Group(); group.add(detailNear);
  const detailMed = new THREE.Group(); group.add(detailMed);

  /* ---- Shared helper: lay a coat-loss patch on the body. A patch is a flattened lump in
     `under`, so it reads as skin showing through rather than as a decal. */
  const patch = (parent, x, y, z, r, mat) => {
    // Turned to face out along the body's side, so it lies flat on the flank instead of
    // standing off it. Sign of x decides which way it looks.
    const m = add(parent, _lpPatch(r, ((ps ^ Math.round(r * 1000)) & 1023) | 0), mat || M.under,
                  x, y, z, 0, x >= 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    return m;
  };
  const bone = (parent, x, y, z, len, r, rot) =>
    add(parent, _lpSpike(len, r, r * 0.55, 0), M.bone, x, y, z, rot || 0, 0, Math.PI / 2);
  const tissueRecess = (parent, x, y, z, r) => {
    const m = add(parent, _lpLump(r, 771), M.tissue, x, y, z);
    m.scale.set(0.9, 0.5, 1.0);
    return m;
  };
  const eyeAt = (parent, x, y, z, r) => {
    // Socket first, then the eye set into it: at tier 3 the socket is wider and the eye
    // sits deeper, which is the whole of the "sunken" read and needs no cartoon staring.
    add(parent, _lpLump(r * (1.5 + sev * 0.22), 401), M.dark, x, y, z - r * 0.25).scale.set(1, 1, 0.55);
    if (sev === 3) add(parent, _lpLump(r * 1.25, 409), M.recess || M.dark, x, y, z - r * 0.4).scale.set(1, 1, 0.4);
    return add(parent, _lpLump(r, 419), M.eye, x, y, z + r * 0.18 - sev * r * 0.12);
  };

  /* ================================ COW ================================
     Heavy, low and broad. The read at distance is: deep barrel with a dropped belly, a
     thick short neck carried level, a big blunt head, and hips that stand proud of the
     back line. */
  if (species === FARM_ANIM_SPECIES.COW) {
    /* Proportions checked against a real animal rather than eyeballed: leg ~54% of wither
       height, length:height ~1.4. The first pass had the belly resting on the ground. */
    const bodyY = 1.00;
    const body = new THREE.Group(); body.position.set(0, bodyY, 0); group.add(body);
    // Flank recession is where "gaunt" becomes a silhouette rather than a colour.
    const fl = 1 - (sev >= 2 ? (sev - 1) * 0.13 : 0) * (hits(0) ? 1.5 : 1);
    add(body, _lpLoft([
      [-0.62, 0.21, 0.19, -0.02], [-0.44, 0.32, 0.32, -0.05], [-0.20, 0.37 * fl, 0.38, -0.07],
      [ 0.06, 0.38 * fl, 0.39, -0.08], [ 0.30, 0.37, 0.37, -0.05], [ 0.52, 0.30, 0.30, 0.00],
      [ 0.66, 0.20, 0.21, 0.02],
    ], 'cowtorso'), M.coat, 0, 0, 0);
    // Hip and shoulder masses: the two swellings that make a cow read as a cow.
    add(body, _lpLump(0.24, 11), M.coat, 0, 0.16, -0.44).scale.set(1.15, 0.9, 1.0);
    add(body, _lpLump(0.26, 12), M.coat, 0, 0.15, 0.40).scale.set(1.2, 0.95, 1.05);
    // A belly that hangs, which no box can do.
    add(body, _lpLump(0.27, 13), M.coat, 0, -0.28, 0.02).scale.set(1.0, 0.62, 1.9);
    // Natural markings, so a healthy cow is patterned rather than a solid colour.
    for (const [mx, my, mz, mr] of [[0.34, 0.16, 0.14, 0.17], [-0.36, -0.02, -0.20, 0.15],
                                    [0.30, -0.10, -0.34, 0.12], [-0.30, 0.18, 0.26, 0.11]]) {
      add(detailMed, _lpPatch(mr, 200 + Math.round(mr * 100)), M.coatAlt,
          mx, bodyY + my, mz, 0, mx >= 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    }

    RIG_BODY = body;
    const neck = new THREE.Group(); neck.position.set(0, 0.20, 0.56); body.add(neck);
    RIG_NECK = neck;
    /* A cow's neck is SHORT and thick and carried level — that, plus the depth of the
       barrel, is the whole difference from the horse at distance. The first pass gave it a
       0.30 reaching neck and the two species read as the same animal in two colours. */
    add(neck, _lpLoft([
      [0, 0.22, 0.235, 0], [0.10, 0.195, 0.205, 0.00], [0.19, 0.175, 0.180, -0.01],
    ], 'cowneck'), M.coat, 0, 0, 0);
    // Brisket: the mass that hangs between the front legs. Cows have it, horses do not.
    add(neck, _lpLump(0.13, 16), M.coat, 0, -0.16, 0.06).scale.set(0.85, 1.1, 1.2);
    const head = new THREE.Group(); head.position.set(0, -0.02, 0.19); neck.add(head); RIG_HEAD = head;
    // Skull, then a narrower muzzle: two lofts, not one box on another.
    add(head, _lpLoft([[0, 0.165, 0.170, 0], [0.15, 0.150, 0.145, -0.01], [0.27, 0.115, 0.105, -0.03]], 'cowskull'), M.coat, 0, 0, 0);
    add(head, _lpLoft([[0.24, 0.095, 0.09, -0.03], [0.40, 0.088, 0.082, -0.045]], 'cowmuz'), M.dark, 0, 0, 0);
    add(head, _lpLump(0.035, 21), M.dark, 0.045, -0.055, 0.40);
    add(head, _lpLump(0.035, 22), M.dark, -0.045, -0.055, 0.40);
    for (const sx of [-1, 1]) {
      eyeAt(head, sx * 0.115, 0.045, 0.16, 0.030);
      // Ears sweep out and back; a torn tip is one of the cheapest damage reads there is.
      const torn = (sev === 3 && hits(1)) ? 0.55 : 1;
      add(head, _lpBlade(0.17 * torn, 0.045, 0.028, 0.011, 0.03), M.coat,
          sx * 0.15, 0.035, 0.02, 0.15, sx * 1.15, 0);
      // Horns: shorter and chipped as the animal deteriorates.
      const hl = 0.15 * (sev === 3 && hits(1) ? 0.5 : 1);
      add(head, _lpSpike(hl, 0.030, 0.008, 0.05), M.keratin, sx * 0.10, 0.145, 0.03, -0.5, sx * 0.75, 0);
    }
    // Legs: tapered, with a distinct cannon bone and a hoof.
    for (const [lx, lz, fwd] of [[-0.22, 0.38, 1], [0.22, 0.38, 1], [-0.22, -0.38, 0], [0.22, -0.38, 0]]) {
      const hip = new THREE.Group(); hip.position.set(lx, bodyY - 0.22, lz); group.add(hip);
      add(hip, _lpLoftY([[0, 0.090, 0.105], [0.26, 0.058, 0.064], [0.44, 0.046, 0.049]], 'cowthigh'), M.coat, 0, 0, 0);
      const knee = new THREE.Group(); knee.position.set(0, -0.44, 0); hip.add(knee);
      add(knee, _lpLoftY([[0, 0.044, 0.047], [0.26, 0.039, 0.041]], 'cowcannon'), M.coat, 0, 0, 0);
      add(knee, _lpLoftY([[0.26, 0.053, 0.051], [0.34, 0.056, 0.039]], 'cowhoof'), M.keratin, 0, 0, 0);
      hip.userData.front = fwd === 1;
    }
    const tail = new THREE.Group(); tail.position.set(0, bodyY + 0.16, -0.64); group.add(tail);
    add(tail, _lpLoftY([[0, 0.030, 0.030], [0.42, 0.017, 0.017]], 'cowtail'), M.coat, 0, 0, 0);
    if (!(sev === 3 && hits(3))) add(tail, _lpBlade(0.16, 0.036, 0.012, 0.020, 0.02), M.mane, 0, -0.42, 0, 1.45, 0, 0);
    group.userData.tailPivot = tail;
  }

  /* ================================ SHEEP ================================
     The opposite read to the cow: almost no visible body, just a cloud of wool on short
     dark legs with a narrow face poking out of the front. The fleece is real separate
     geometry — thirteen lumps — because that is the only way wool loss can be a
     silhouette change rather than a colour change. */
  if (species === FARM_ANIM_SPECIES.SHEEP) {
    const bodyY = 0.66;
    const body = new THREE.Group(); body.position.set(0, bodyY, 0); group.add(body);
    // The animal UNDER the wool, which is what shows when the fleece goes.
    add(body, _lpLoft([
      [-0.40, 0.14, 0.14, 0], [-0.20, 0.19, 0.19, -0.02], [0.10, 0.20, 0.20, -0.02],
      [0.34, 0.16, 0.17, 0], [0.44, 0.12, 0.13, 0.01],
    ], 'shbody'), M.under, 0, 0, 0);
    /* Fleece. Each lump is placed on a fixed lattice and then KEPT OR DROPPED by tier and
       archetype, so wool loss is subtractive geometry. A bald sheep has a visibly smaller,
       wrong-shaped outline from fifty blocks away. */
    const fleece = [
      [0, 0.20, -0.30, 0.21], [-0.17, 0.14, -0.24, 0.19], [0.17, 0.14, -0.24, 0.19],
      [0, 0.24, -0.02, 0.23], [-0.20, 0.16, 0.00, 0.20], [0.20, 0.16, 0.00, 0.20],
      [0, 0.20, 0.22, 0.21], [-0.17, 0.12, 0.24, 0.18], [0.17, 0.12, 0.24, 0.18],
      [-0.13, -0.06, -0.10, 0.16], [0.13, -0.06, -0.10, 0.16],
      [-0.13, -0.06, 0.14, 0.16], [0.13, -0.06, 0.14, 0.16],
    ];
    const keepAt = [1.0, 0.82, 0.55, 0.30][cond];
    fleece.forEach((f, i) => {
      const [x, y, z, r] = f;
      // The archetype decides WHERE the wool goes first.
      let bias = 1;
      if (hits(0) && Math.abs(x) > 0.1) bias = 0.45;              // side baldness
      if (hits(1) && z > 0.15) bias = 0.35;                       // neck and shoulder
      if (hits(2) && z > -0.05 && Math.abs(x) > 0.1) bias = 0.4;
      if (hits(3) && z < -0.1) bias = 0.35;                       // rump collapse
      if (rnd() > keepAt * bias) return;                          // this clump is gone
      /* Parented to `body`, always. An earlier version sent the lower clumps to detailMed
         to save triangles at distance — but detailMed hangs off `group` while these
         coordinates are body-local, so at tier 2 the sheep's belly wool detached and
         floated half a metre underneath it. Detail groups may only hold parts authored in
         GROUP space; anything body-local stays on the body. */
      const m = add(body, _lpLump(r * (1 - sev * 0.05), 100 + i),
                    (sev >= 2 && rnd() < 0.3) ? M.coatAlt : M.coat, x, y, z);
      m.scale.set(1.05, 0.95, 1.05);
    });
    RIG_BODY = body;
    const neck = new THREE.Group(); neck.position.set(0, 0.12, 0.40); body.add(neck); RIG_NECK = neck;
    add(neck, _lpLoft([[0, 0.085, 0.09, 0], [0.14, 0.072, 0.075, 0.02]], 'shneck'), M.under, 0, 0, 0);
    const head = new THREE.Group(); head.position.set(0, 0.03, 0.14); neck.add(head); RIG_HEAD = head;
    // A narrow wedge face, nothing like the cow's blunt block.
    add(head, _lpLoft([[0, 0.078, 0.088, 0], [0.12, 0.062, 0.068, -0.02], [0.24, 0.042, 0.044, -0.05]], 'shhead'), M.dark, 0, 0, 0);
    add(head, _lpLump(0.026, 31), M.dark, 0, -0.055, 0.24).scale.set(1.2, 0.8, 0.9);
    for (const sx of [-1, 1]) {
      eyeAt(head, sx * 0.062, 0.030, 0.09, 0.021);
      const torn = (sev === 3 && hits(1)) ? 0.5 : 1;
      add(head, _lpBlade(0.13 * torn, 0.032, 0.020, 0.008, 0.05), M.dark, sx * 0.075, 0.015, 0.01, 0.1, sx * 1.5, 0);
    }
    if (cond <= 1) { // a healthy sheep has a woolly forehead; a rotten one does not
      add(detailNear, _lpLump(0.075, 33), M.coat, 0, bodyY + 0.18, 0.50).scale.set(1.1, 0.8, 0.9);
    }
    for (const [lx, lz, fwd] of [[-0.14, 0.24, 1], [0.14, 0.24, 1], [-0.14, -0.24, 0], [0.14, -0.24, 0]]) {
      const hip = new THREE.Group(); hip.position.set(lx, bodyY - 0.16, lz); group.add(hip);
      add(hip, _lpLoftY([[0, 0.046, 0.051], [0.28, 0.032, 0.034]], 'shleg'), M.dark, 0, 0, 0);
      const knee = new THREE.Group(); knee.position.set(0, -0.28, 0); hip.add(knee);
      add(knee, _lpLoftY([[0, 0.030, 0.032], [0.16, 0.026, 0.028]], 'shcannon'), M.dark, 0, 0, 0);
      add(knee, _lpLoftY([[0.16, 0.036, 0.034], [0.22, 0.038, 0.026]], 'shhoof'), M.keratin, 0, 0, 0);
      hip.userData.front = fwd === 1;
    }
    const tail = new THREE.Group(); tail.position.set(0, bodyY + 0.10, -0.44); group.add(tail);
    add(tail, _lpLump(0.055, 35), sev >= 2 ? M.under : M.coat, 0, -0.04, 0);
    group.userData.tailPivot = tail;
  }

  /* ================================ CHICKEN ================================
     A completely different construction: upright, two-legged, no neck-forward posture at
     all. The read is an ovoid body tipped back, a raised fan tail, a small round head on a
     short S-neck, and thin scaled legs. Nothing here is a scaled-down quadruped. */
  if (species === FARM_ANIM_SPECIES.CHICKEN) {
    const bodyY = 0.30;
    const body = new THREE.Group(); body.position.set(0, bodyY, 0); group.add(body);
    body.rotation.x = -0.18;                       // tipped back, as a standing hen stands
    add(body, _lpLoft([
      [-0.17, 0.075, 0.075, 0], [-0.08, 0.115, 0.120, -0.01], [0.05, 0.125, 0.130, -0.01],
      [0.15, 0.098, 0.100, 0.00], [0.21, 0.062, 0.062, 0.01],
    ], 'chbody'), M.coat, 0, 0, 0);
    // Wings: layered blades, so feather loss can remove layers.
    for (const sx of [-1, 1]) {
      const wing = new THREE.Group(); wing.position.set(sx * 0.105, 0.02, 0.02); body.add(wing);
      const layers = [3, 3, 2, 1][cond];
      for (let i = 0; i < layers; i++) {
        if (hits(0) && i >= layers - 1) continue;          // wing-loss archetype
        add(i === 0 ? wing : detailMed === null ? wing : wing,
            _lpBlade(0.20 - i * 0.02, 0.052, 0.030, 0.007, 0.03),
            i === 1 ? M.coatAlt : M.coat,
            0, 0.03 - i * 0.028, -0.10, -0.15, sx * 0.10, sx * 0.25);
      }
      if (sev >= 2) patch(wing, 0, -0.01, -0.04, 0.045);
    }
    // Tail fan: three blades standing up and back. Deteriorates to one.
    const tail = new THREE.Group(); tail.position.set(0, 0.10, -0.17); body.add(tail);
    const tf = [3, 3, 2, 1][cond];
    for (let i = 0; i < tf; i++) {
      if (hits(3) && i > 0) continue;
      add(tail, _lpBlade(0.17, 0.038, 0.016, 0.006, -0.02), i === 1 ? M.coatAlt : M.mane,
          (i - 1) * 0.035, 0, 0, -1.15, 0, (i - 1) * 0.25);
    }
    group.userData.tailPivot = tail;
    RIG_BODY = body;
    const neck = new THREE.Group(); neck.position.set(0, 0.10, 0.16); body.add(neck); RIG_NECK = neck;
    add(neck, _lpLoft([[0, 0.052, 0.055, 0], [0.10, 0.045, 0.048, 0.05]], 'chneck'),
        (hits(1) && sev >= 2) ? M.under : M.coat, 0, 0, 0);
    const head = new THREE.Group(); head.position.set(0, 0.11, 0.06); neck.add(head); RIG_HEAD = head;
    add(head, _lpLump(0.058, 41), M.coat, 0, 0, 0).scale.set(1.0, 1.0, 1.1);
    // Beak: a small keratin spike, and a comb and wattle above and below it.
    add(head, _lpSpike(0.075, 0.026, 0.004, -0.012), M.keratin, 0, -0.005, 0.045, 0.12, 0, 0);
    if (!(sev === 3 && hits(1))) {
      add(head, _lpBlade(0.055, 0.030, 0.014, 0.006, 0.0), M.tissue, 0, 0.050, -0.01, -1.5, 0, 0);
      add(detailNear, _lpLump(0.020, 43), M.tissue, 0, bodyY + 0.155, 0.115);
    }
    for (const sx of [-1, 1]) eyeAt(head, sx * 0.042, 0.012, 0.036, 0.014);
    // Two legs, thin, scaled, with splayed toes.
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(sx * 0.055, bodyY - 0.09, 0.01); group.add(hip);
      add(hip, _lpLoftY([[0, 0.031, 0.033], [0.09, 0.022, 0.024]], 'chthigh'), M.coat, 0, 0, 0);
      const knee = new THREE.Group(); knee.position.set(0, -0.09, 0); hip.add(knee);
      add(knee, _lpLoftY([[0, 0.014, 0.014], [0.12, 0.012, 0.012]], 'chshank'), M.keratin, 0, 0, 0);
      for (const tz of [-1, 0, 1]) {
        add(knee, _lpLoft([[0, 0.008, 0.006, 0], [0.055, 0.005, 0.004, 0]], 'chtoe'), M.keratin,
            0, -0.12, 0.012, 0, tz * 0.45, 0);
      }
      hip.userData.front = sx > 0;
    }
  }

  /* ================================ HORSE ================================
     Tall and narrow where the cow is low and broad. The silhouette cues are the long
     arched neck carried high, the deep but slim chest, legs about 40% longer in
     proportion, and the mane and tail as real hair geometry. */
  if (species === FARM_ANIM_SPECIES.HORSE) {
    /* Leg ~55% of wither height, chest deep but narrow. This is the number that stops a
       horse reading as a large cow, and it is the one the first pass got most wrong. */
    const bodyY = 1.34;
    const body = new THREE.Group(); body.position.set(0, bodyY, 0); group.add(body);
    const fl = 1 - (sev >= 2 ? (sev - 1) * 0.14 : 0) * (hits(0) ? 1.5 : 1);
    add(body, _lpLoft([
      [-0.60, 0.19, 0.22, 0.02], [-0.40, 0.25, 0.30, 0.00], [-0.14, 0.26 * fl, 0.33, -0.02],
      [0.14, 0.26 * fl, 0.34, -0.02], [0.40, 0.25, 0.31, 0.00], [0.60, 0.20, 0.24, 0.03],
    ], 'hotorso'), M.coat, 0, 0, 0);
    add(body, _lpLump(0.26, 51), M.coat, 0, 0.06, -0.46).scale.set(1.05, 1.15, 1.0);   // croup
    add(body, _lpLump(0.22, 52), M.coat, 0, 0.08, 0.46).scale.set(1.1, 1.05, 0.95);    // shoulder
    add(detailMed, _lpLump(0.16, 53), M.coatAlt, 0.24, bodyY + 0.10, -0.10).scale.set(0.5, 1.1, 1.4);

    // The neck: three sections rising and reaching forward, which is the species read.
    RIG_BODY = body;
    const neck = new THREE.Group(); neck.position.set(0, 0.24, 0.56); body.add(neck); RIG_NECK = neck;
    neck.rotation.x = -0.80;
    add(neck, _lpLoft([[0, 0.150, 0.22, 0], [0.24, 0.115, 0.185, 0.02], [0.46, 0.088, 0.145, 0.04],
                       [0.60, 0.078, 0.125, 0.05]], 'honeck'),
        (hits(2) && sev >= 2) ? M.under : M.coat, 0, 0, 0);
    // Mane: blades along the crest. Gapped and thinned by tier and archetype.
    const maneN = 7;
    for (let i = 0; i < maneN; i++) {
      const t = i / (maneN - 1);
      if (sev >= 1 && rnd() < (hits(3) ? 0.20 + sev * 0.22 : sev * 0.13)) continue;
      add(group, _lpBlade(0.16 - t * 0.03, 0.032, 0.013, 0.007, 0.02), M.mane,
          0, bodyY + 0.30 + t * 0.42, 0.50 + t * 0.32, -1.0 - t * 0.30, 0, 0);
    }
    const head = new THREE.Group(); head.position.set(0, 0.04, 0.60); neck.add(head); RIG_HEAD = head;
    head.rotation.x = 0.72;
    // A long head: cheek, then a distinctly separate muzzle. Nothing blunt about it.
    add(head, _lpLoft([[0, 0.082, 0.120, 0], [0.17, 0.066, 0.092, -0.02], [0.31, 0.052, 0.062, -0.05]], 'hohead'), M.coat, 0, 0, 0);
    add(head, _lpLoft([[0.28, 0.060, 0.068, -0.05], [0.42, 0.058, 0.060, -0.07]], 'homuz'), M.dark, 0, 0, 0);
    add(head, _lpLump(0.026, 61), M.dark, 0.030, -0.045, 0.42);
    add(head, _lpLump(0.026, 62), M.dark, -0.030, -0.045, 0.42);
    for (const sx of [-1, 1]) {
      eyeAt(head, sx * 0.088, 0.055, 0.10, 0.026);
      const torn = (sev === 3 && hits(1)) ? 0.55 : 1;
      add(head, _lpBlade(0.12 * torn, 0.030, 0.008, 0.008, 0.01), M.coat, sx * 0.055, 0.115, -0.02, -0.35, sx * 0.5, 0);
    }
    // Long legs with a visible hock and a fetlock tuft.
    for (const [lx, lz, fwd] of [[-0.19, 0.44, 1], [0.19, 0.44, 1], [-0.19, -0.44, 0], [0.19, -0.44, 0]]) {
      const hip = new THREE.Group(); hip.position.set(lx, bodyY - 0.28, lz); group.add(hip);
      add(hip, _lpLoftY([[0, 0.082, 0.108], [0.34, 0.046, 0.053], [0.56, 0.036, 0.040]], 'hothigh'), M.coat, 0, 0, 0);
      const knee = new THREE.Group(); knee.position.set(0, -0.56, 0); hip.add(knee);
      add(knee, _lpLoftY([[0, 0.033, 0.035], [0.42, 0.029, 0.031]], 'hocannon'), M.coat, 0, 0, 0);
      add(detailNear, _lpBlade(0.08, 0.026, 0.010, 0.006, 0.01), M.mane, lx, bodyY - 0.28 - 0.94, lz, 1.9, 0, 0);
      add(knee, _lpLoftY([[0.42, 0.043, 0.041], [0.50, 0.045, 0.030]], 'hohoof'), M.keratin, 0, 0, 0);
      hip.userData.front = fwd === 1;
    }
    const tail = new THREE.Group(); tail.position.set(0, bodyY + 0.14, -0.64); group.add(tail);
    const tn = (sev === 3 && hits(3)) ? 1 : (sev >= 2 ? 2 : 3);
    for (let i = 0; i < tn; i++) {
      add(tail, _lpBlade(0.40 - i * 0.05, 0.040, 0.016, 0.010, 0.10), M.mane,
          (i - 1) * 0.025, 0, 0, 1.35, 0, (i - 1) * 0.18);
    }
    group.userData.tailPivot = tail;
  }

  /* ================================ DETERIORATION OVERLAY ================================
     Applied after the species is built, so it reads the same way on all four. Coat loss
     scales with tier and concentrates on the archetype's region; exposure is capped hard. */
  if (sev > 0) {
    const S = { COW: 0, SHEEP: 1, CHICKEN: 2, HORSE: 3 }, sp = species;
    const bodyY = [1.00, 0.66, 0.30, 1.34][sp];
    const len = [0.62, 0.40, 0.20, 0.60][sp];
    const wid = [0.35, 0.20, 0.13, 0.27][sp];
    const nPatch = [0, 2, 5, 8][sev];
    // Where the patches cluster, per archetype.
    const zBias = [0.0, 0.65, 0.35, -0.60][variant & 3];
    for (let i = 0; i < nPatch; i++) {
      const side = rnd() < 0.5 ? -1 : 1;
      const z = (zBias * len) + (rnd() - 0.5) * len * (sev === 3 ? 1.5 : 0.9);
      const y = bodyY + (rnd() - 0.4) * wid * 1.1;
      const r = (0.05 + rnd() * 0.09) * (1 + sev * 0.22) * (sp === 2 ? 0.55 : 1);
      patch(i < 3 ? group : detailMed, side * wid * (0.85 + rnd() * 0.25), y, z, r,
            rnd() < 0.3 ? M.dark : M.under);
    }
    /* EXPOSURE, and the caps are the whole of the restraint. At most two bone shapes and
       at most one tissue recess on any animal in the game, and only at tier 3. A rib edge
       and a single dark hollow say "this animal is failing"; anything more says
       "zombie farm", which the brief rules out and which would also wreck the contrast
       that makes the healthy animals worth looking at. */
    if (sev === 3) {
      const bz = zBias * len * 0.6;
      bone(group, wid * 0.92, bodyY + wid * 0.15, bz, 0.11 * (sp === 2 ? 0.5 : 1), 0.011, 0.25);
      if (variant & 1) bone(group, -wid * 0.92, bodyY + wid * 0.02, bz - 0.10, 0.09 * (sp === 2 ? 0.5 : 1), 0.010, -0.2);
      tissueRecess(detailNear, (variant & 2 ? 1 : -1) * wid * 0.85, bodyY - wid * 0.15, bz + 0.08, 0.045 * (sp === 2 ? 0.6 : 1));
    }
  }

  /* Collect the leg pivots the animator drives, in a stable order. */
  const legs = [];
  for (const ch of group.children) {
    if (ch.userData && ch.userData.front !== undefined) {
      legs.push({ hip: ch, knee: ch.children.find(c => c.children && c.children.length >= 0 && c.isGroupLike) || ch.children[1] || ch.children[0],
                  phase: (legs.length % 2 === 0) ? 0 : Math.PI, front: ch.userData.front });
    }
  }
  // The knee is the hip's child Group (the only child without geometry).
  for (const L of legs) {
    L.knee = L.hip.children.find(c => !c.geometry && c.children) || L.hip;
    L.rest = { neck: RIG_NECK ? RIG_NECK.rotation.x : 0, head: RIG_HEAD ? RIG_HEAD.rotation.x : 0 };
  }
  const restNeck = RIG_NECK ? RIG_NECK.rotation.x : 0;

  return {
    group, parts, species, cond, variant,
    detailNear, detailMed,
    rig: {
      body: RIG_BODY || group, neck: RIG_NECK || group, head: RIG_HEAD || group,
      /* The neck's authored resting angle. The animator adds its grazing rotation to this
         rather than overwriting it — a horse's neck is arched at rest and the Phase 18
         animator assigned rotation.x absolutely, which would have snapped it straight. */
      restNeck,
      legs, tail: group.userData.tailPivot || null,
      bodyY: [1.00, 0.66, 0.30, 1.34][species],
      height: FARM_ANIM_HEIGHT[species],
    },
  };
}
