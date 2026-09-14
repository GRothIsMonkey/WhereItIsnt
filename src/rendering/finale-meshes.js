"use strict";
/* =====================================================================================
   THE FINAL CREATURE, AND THE GROUND IT STANDS ON
   ERA 1.5.6 — MOVED VERBATIM OUT OF game.html.

   buildFinalCreature and buildFinaleScene. A 150-metre silhouette of twelve meshes and
   three unlit materials, and the fifteen familiar shapes placed nearer than it so its
   scale can be read (section 59).

   EVERY RULE IN SECTION 59 APPLIES TO THIS FILE. Unlit MeshBasicMaterial only, so no
   lamp, sun or effect can resolve it into a lit asset. NOTHING ON THE FACE, ever — no
   eye, no mouth, no jaw. No name, no label, no text. It is not the Stalker and not the
   Behemoth, and neither is reachable from here.

   IT CANNOT APPEAR EARLY. Built from exactly one call site, downstream of the Haven
   shift, and both test suites walk the intact Haven proving nothing has spawned.
   Every line below is byte-identical to the text that was in game.html, comments and all.
   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md section 4.8 and src/rendering/LAYER.md.
   ===================================================================================== */

function buildFinalCreature(h) {
  const H = (typeof h === 'number' && h > 0) ? h : FINAL_CREATURE_HEIGHT;
  const group = new THREE.Group();

  /* MATERIALS. Three, shared across every part, and none of them respond to light in a
     way that could resolve the shape: `body` is a flat near-black basic material, so no
     lamp, sun or fog light can ever accidentally turn this into a lit model showcase. */
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x04050a, fog: true });
  const limbMat = new THREE.MeshBasicMaterial({ color: 0x06070c, fog: true });
  /* The one pale thing. Slightly transparent so it reads as an area rather than as a
     sticker, and deliberately off-white rather than white — a clean white would look
     like a light source, and this is not lit, it is just less dark. */
  const faceMat = new THREE.MeshBasicMaterial({
    color: 0xb9b5ac, transparent: true, opacity: 0.85, fog: true, side: THREE.DoubleSide,
  });

  /* THE LIMB RADII WERE RAISED BY ROUGHLY HALF AFTER THE FIRST RENDER.

     At the original thickness the legs were three metres across at three hundred and
     twenty metres — about seven pixels — and the whole figure read as a radio mast rather
     than as a body. That is the correct read for the first two beats and the wrong one for
     the last four: by the time the head turns, the player has to be looking at something
     with a TORSO.

     It is still absurdly thin. A human silhouette is roughly four to one, height against
     width; this is about seven to one at a hundred and fifty metres tall, which is a
     proportion no skeleton supports. `tests/finale.js` holds the floor at five and a half
     so it can never quietly become a normal giant. */
  const seg = (rTop, rBot, len, mat) =>
    new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, 6, 1, true), mat || limbMat);

  // --- LEGS ---------------------------------------------------------------------------
  // Two segments each, meeting at a knee that is neither halfway nor in line.
  const legTop = H * 0.63;
  const kneeY = legTop * 0.55;
  const legs = [];
  for (const side of [-1, 1]) {
    /* THE STANCE WAS WIDENED AFTER THE SECOND RENDER. At ±0.021H the two legs were about
       six metres apart at three hundred and twenty metres — closer together than they were
       thick — and they merged into one column, which read as a mast. A figure needs a gap
       between its legs more than it needs anything else about it. */
    const hipX = side * H * 0.038;          // still a narrow stance for the height
    const kneeX = side * H * 0.055;         // knee displaced OUTWARD from the hip line
    const footX = side * H * 0.030;         // and the foot back inside it again

    const thighLen = legTop - kneeY;
    const thigh = seg(H * 0.016, H * 0.021, thighLen);
    thigh.position.set((hipX + kneeX) / 2, kneeY + thighLen / 2, 0);
    thigh.rotation.z = Math.atan2(kneeX - hipX, thighLen);
    group.add(thigh);

    const shin = seg(H * 0.021, H * 0.010, kneeY);
    shin.position.set((kneeX + footX) / 2, kneeY / 2, 0);
    shin.rotation.z = Math.atan2(footX - kneeX, kneeY);
    group.add(shin);

    legs.push({ thigh, shin, side });
  }

  // --- TORSO --------------------------------------------------------------------------
  // Short for the body and tilted forward, so the mass hangs over the legs rather than
  // sitting on them.
  const torsoLen = H * 0.20;
  const torso = seg(H * 0.026, H * 0.042, torsoLen, bodyMat);
  torso.position.set(0, legTop + torsoLen / 2, 0);
  torso.rotation.x = 0.06;
  group.add(torso);
  const shoulderY = legTop + torsoLen;

  // --- ARMS ---------------------------------------------------------------------------
  /* THE THING A PLAYER ACTUALLY NOTICES. Upper and fore-arm together run to 0.64H, which
     puts the ends of them a third of the way down the shins. Nothing about the rest of
     the body is as immediately wrong as a hand hanging below a knee. */
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * H * 0.030, shoulderY, 0);
    group.add(pivot);

    const upperLen = H * 0.30;
    const upper = seg(H * 0.013, H * 0.011, upperLen);
    upper.position.y = -upperLen / 2;
    pivot.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -upperLen;
    pivot.add(elbow);

    const foreLen = H * 0.34;
    const fore = seg(H * 0.011, H * 0.007, foreLen);
    fore.position.y = -foreLen / 2;
    elbow.add(fore);

    // A slight outward set at rest, so the arms do not read as two straight lines.
    pivot.rotation.z = -side * 0.05;
    elbow.rotation.z = -side * 0.04;
    arms.push({ pivot, elbow, side });
  }

  // --- NECK + HEAD --------------------------------------------------------------------
  const neckLen = H * 0.09;
  const neck = seg(H * 0.010, H * 0.014, neckLen);
  neck.position.set(0, shoulderY + neckLen / 2, 0);
  group.add(neck);

  /* The head is a GROUP, because the sequence turns it and tilts it and must be able to
     do both without touching how it is built. */
  const head = new THREE.Group();
  head.position.set(0, shoulderY + neckLen, 0);
  group.add(head);

  const skullH = H * 0.045, skullW = H * 0.030, skullD = H * 0.022;
  const skull = new THREE.Mesh(new THREE.BoxGeometry(skullW, skullH, skullD), bodyMat);
  skull.position.y = skullH / 2;
  head.add(skull);

  /* THE FACE. A plain rectangle on the front of the skull, smaller than the skull so the
     dark surrounds it on every side. There are no features on it and there must never be:
     requirement 6 wants the player's imagination doing this work, and an eye or a mouth
     at this distance would resolve the whole thing into a monster. */
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(skullW * 0.62, skullH * 0.66), faceMat);
  face.position.set(0, skullH * 0.54, skullD / 2 + 0.05);
  head.add(face);

  return {
    group, legs, arms, head, face, faceMat, torso, neck,
    height: H, shoulderY, t: 0,
  };
}

function buildFinaleScene() {
  const group = new THREE.Group();
  const parts = [];

  /* One material for everything that is not the ground. The finale is a silhouette shot:
     a lit material here would give the landmarks form, and form at this distance competes
     with the one shape that is meant to be hard to read. */
  const inkMat = new THREE.MeshBasicMaterial({ color: 0x0a0c12, fog: true });
  const groundMat = new THREE.MeshBasicMaterial({ color: 0x0d0f14, fog: true });

  // THE GROUND. One plane, big enough that its edge is far past anything the fog lets
  // through, so the horizon is fog rather than an edge.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(FINALE_GROUND_SIZE, FINALE_GROUND_SIZE), groundMat);
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);
  parts.push(ground);

  const box = (w, hh, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), inkMat);
    m.position.set(x, y, z);
    group.add(m); parts.push(m);
    return m;
  };

  for (const L of FINALE_LANDMARKS) {
    const z = -L.at, x = L.x, h = L.h;
    switch (L.kind) {
      case 'pole':
        box(0.5, h, 0.5, x, h / 2, z);
        box(4.0, 0.4, 0.4, x, h * 0.86, z);          // crossarm
        break;
      case 'tree':
        box(0.9, h * 0.45, 0.9, x, h * 0.22, z);     // trunk
        box(h * 0.62, h * 0.58, h * 0.62, x, h * 0.70, z);  // crown
        break;
      case 'barn':
        box(20, h, 12, x, h / 2, z);
        box(14, h * 0.42, 12, x, h * 1.10, z);       // roof mass
        box(5, h * 1.35, 5, x + 14, h * 0.68, z);    // silo
        break;
      case 'house':
        box(11, h, 9, x, h / 2, z);
        box(12, h * 0.40, 10, x, h * 1.12, z);
        box(1.2, h * 0.5, 1.2, x + 3, h * 1.45, z);  // chimney
        break;
      case 'cabin':
        // The Haven's own footprint, at its own size, standing on this ground.
        box(12, h * 0.75, 12, x, h * 0.375, z);
        box(1.2, h * 0.55, 1.2, x + 2, h * 0.95, z);
        break;
      case 'tower': {
        // The Farmlands' signature landmark, and the tallest thing the player knows.
        for (const lx of [-4, 4]) box(0.8, h * 0.72, 0.8, x + lx, h * 0.36, z);
        for (const lz of [-4, 4]) box(0.8, h * 0.72, 0.8, x, h * 0.36, z + lz);
        box(13, h * 0.20, 13, x, h * 0.82, z);       // tank
        box(0.6, h * 0.12, 0.6, x, h * 0.98, z);     // mast
        break;
      }
      case 'suburb':
        box(10, h, 10, x, h / 2, z);
        box(11, h * 0.38, 11, x, h * 1.10, z);
        break;
    }
  }

  return { group, parts, inkMat, groundMat };
}
