"use strict";
/* =====================================================================================
   THE CREATURE SILHOUETTES
   ERA 1.5.6 — MOVED VERBATIM OUT OF game.html.

   buildStalkerMesh, buildSkeletonMesh, buildSpiderMesh, buildBehemothMesh — four
   parametric low-poly bodies and the handles their AI animates them by. The AI is in
   game.html and was not touched: these functions build a body and return its joints.

   PROPORTION IS THE HORROR AND IT LIVES HERE (sections 5 and 59). The Stalker's
   asymmetry, the Behemoth's scale — that is what these functions are, and it is exactly
   the layer Era 2's visual identity revolution is about.

   THE FINAL CREATURE IS NOT HERE. It is in finale-meshes.js, reachable from one call
   site, and section 59 requires it stay that way.
   Every line below is byte-identical to the text that was in game.html, comments and all.
   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md section 4.8 and src/rendering/LAYER.md.
   ===================================================================================== */

function buildStalkerMesh() {
  const H = STALKER_HEIGHT;
  const group = new THREE.Group();

  /* Three shared materials for the whole body. Unlit (MeshBasicMaterial) on purpose,
     exactly as the original Stalker was: at full night the ambient term is ~0.16, and
     a lit material would sink the creature into the dark where the player could never
     catch it — which the "stop it by looking with a light" mechanic depends on. Flat
     tones also serve the brief directly: an unlit body IS a silhouette, and the three
     separated values keep the layered slabs readable without any shading.
     All transparent so the existing VANISHING fade (which iterates bodyMaterials)
     keeps working unchanged. */
  const skin = new THREE.MeshBasicMaterial({ color: STALKER_SKIN, transparent: true, opacity: 0.94 });
  const skinLit = new THREE.MeshBasicMaterial({ color: STALKER_SKIN_LIT, transparent: true, opacity: 0.94 });
  const recess = new THREE.MeshBasicMaterial({ color: STALKER_RECESS, transparent: true, opacity: 0.94 });
  const bodyMaterials = [skin, skinLit, recess];

  const slab = (parent, mat, w, h, d, x, y, z, rx, ry, rz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  /* PROPORTIONS — non-human on purpose.
     Legs take 56% of total height (a human is ~48%) and the torso is short and
     narrow, so the creature is mostly leg. The neck then adds another 8% before the
     head even starts. */
  const legH = H * 0.56;
  const torsoH = H * 0.26;
  const neckH = H * 0.08;
  const hipY = legH;

  // ---- BODY PIVOT (breathing, sway, lean) ---------------------------------------
  const body = new THREE.Group();
  body.position.set(0, hipY, 0);
  group.add(body);

  // Pelvis — narrow, canted forward.
  slab(body, skin, 0.40, 0.16, 0.26, 0, 0.02, 0);
  slab(body, recess, 0.30, 0.07, 0.20, 0, -0.05, 0.01);

  // ---- TORSO --------------------------------------------------------------------
  const torso = new THREE.Group();
  torso.position.set(0, 0.06, 0);
  body.add(torso);

  // Core column, built from three stacked slabs that taper and drift so the spine
  // is never quite straight.
  slab(torso, skin, 0.34, torsoH * 0.38, 0.24, 0.00, torsoH * 0.19, 0);
  slab(torso, skin, 0.38, torsoH * 0.36, 0.22, 0.015, torsoH * 0.54, 0.01, 0, 0, -0.03);
  slab(torso, skinLit, 0.42, torsoH * 0.30, 0.20, -0.01, torsoH * 0.86, 0.00, 0, 0, 0.04);
  // Rib slabs — thin horizontal plates proud of the chest, uneven on purpose.
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const w = 0.44 - t * 0.10;
    slab(torso, skinLit, w, 0.035, 0.03, (i % 2 ? 0.012 : -0.012),
      torsoH * (0.34 + t * 0.50), 0.115, 0, 0, (i % 2 ? 0.05 : -0.04));
  }
  // Hollow beneath the ribs.
  slab(torso, recess, 0.26, torsoH * 0.22, 0.06, 0, torsoH * 0.30, 0.10);

  // Shoulder yoke — a single narrow bar, tilted, from which both arms hang.
  // Deliberately narrower than the ribcage: hunched, collapsed shoulders on a body
  // this tall read as far more wrong than broad ones, and keeping the arms tucked
  // close preserves the tall thin column silhouette.
  const yokeY = torsoH * 0.94;
  slab(torso, skin, 0.72, 0.09, 0.15, 0, yokeY, 0, 0, 0, -0.05);
  slab(torso, recess, 0.44, 0.05, 0.10, 0, yokeY - 0.06, 0.02);

  // ---- NECK + HEAD ---------------------------------------------------------------
  const neck = new THREE.Group();
  neck.position.set(0, yokeY + 0.02, 0);
  torso.add(neck);
  // Three thin vertebrae, each stepped slightly forward — the head is carried ahead
  // of the shoulders, not above them.
  slab(neck, skin, 0.13, neckH * 0.34, 0.13, 0, neckH * 0.17, 0.010);
  slab(neck, skin, 0.115, neckH * 0.34, 0.12, 0, neckH * 0.50, 0.028);
  slab(neck, skin, 0.10, neckH * 0.32, 0.11, 0, neckH * 0.82, 0.050);

  const head = new THREE.Group();
  head.position.set(0, neckH, 0.06);
  head.rotation.z = STALKER_ASYM_HEAD_TILT;
  neck.add(head);

  /* HEAD — an inverted angular wedge: broad and heavy across the top, tapering to a
     narrow blunt point at the bottom. Deliberately not a skull and not a box. */
  const hw = 0.52;
  slab(head, skin, hw, 0.20, 0.34, 0, 0.30, 0);              // heavy cranial slab
  slab(head, skinLit, hw * 0.92, 0.07, 0.36, 0, 0.41, 0.005); // crown plate
  slab(head, skin, hw * 0.78, 0.16, 0.30, 0, 0.13, 0.012);   // mid taper
  slab(head, skin, hw * 0.46, 0.14, 0.22, 0.008, -0.02, 0.02); // lower taper
  slab(head, skin, hw * 0.22, 0.10, 0.15, 0.012, -0.13, 0.025); // blunt point
  // Overhanging brow, cast well forward so the face sits in permanent shadow.
  slab(head, skinLit, hw * 0.98, 0.06, 0.10, 0, 0.24, 0.20, -0.22);
  // The face is a recess, not features. Minimal detail by design.
  slab(head, recess, hw * 0.60, 0.20, 0.05, 0.006, 0.12, 0.165);
  // Asymmetric temple plates — one longer than the other.
  slab(head, skinLit, 0.05, 0.22, 0.26, -hw * 0.50, 0.24, -0.01, 0, 0, 0.06);
  slab(head, skinLit, 0.05, 0.30, 0.26, hw * 0.50, 0.20, -0.01, 0, 0, -0.10);

  // ---- EYES ----------------------------------------------------------------------
  /* Small and deep in the recess. The eyes are a detail, not the design — they
     confirm what the silhouette already told you. eyeL/eyeR stay Groups so the
     existing _pulseEyes() scale animation keeps working untouched. */
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0022, transparent: true, opacity: 1 });
  const eyeGeo = new THREE.BoxGeometry(0.055, 0.045, 0.03);
  const eyeL = new THREE.Group();
  eyeL.position.set(-0.115, 0.145, 0.175);
  eyeL.add(new THREE.Mesh(eyeGeo, eyeMat));
  const eyeR = new THREE.Group();
  eyeR.position.set(0.108, 0.128, 0.175); // slightly lower and inboard — asymmetric
  eyeR.add(new THREE.Mesh(eyeGeo, eyeMat));
  head.add(eyeL, eyeR);

  const eyeLight = new THREE.PointLight(0xff0022, 3.0, 16, 2);
  eyeLight.position.set(0, 0.14, 0.26);
  head.add(eyeLight);

  // ---- ARMS ----------------------------------------------------------------------
  /* Absurdly long: fingertips hang below the knee. Built upper / fore / hand so the
     limb can fold, with splayed finger bars on a flat palm. */
  const arms = [];
  [-1, 1].forEach(side => {
    const lenMult = side > 0 ? STALKER_ASYM_ARM : 1.0;
    const upperH = H * 0.24 * lenMult;
    const foreH = H * 0.26 * lenMult;

    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.32, yokeY + (side > 0 ? STALKER_ASYM_SHOULDER : 0), 0);
    shoulder.rotation.z = side * 0.018; // barely splayed — arms hang tight to the body
    torso.add(shoulder);
    slab(shoulder, skin, 0.13, 0.12, 0.13, 0, -0.02, 0);                  // deltoid knot
    slab(shoulder, skin, 0.085, upperH, 0.085, 0, -upperH / 2 - 0.05, 0); // humerus
    slab(shoulder, skinLit, 0.03, upperH * 0.7, 0.03, side * 0.05, -upperH * 0.45, 0.01);

    const elbow = new THREE.Group();
    elbow.position.set(0, -upperH - 0.08, 0);
    shoulder.add(elbow);
    slab(elbow, recess, 0.10, 0.07, 0.10, 0, 0, 0);                       // joint knuckle
    slab(elbow, skin, 0.07, foreH, 0.07, 0, -foreH / 2 - 0.03, 0);        // radius
    slab(elbow, skinLit, 0.028, foreH * 0.8, 0.028, side * 0.042, -foreH * 0.5, 0);

    const hand = new THREE.Group();
    hand.position.set(0, -foreH - 0.06, 0);
    elbow.add(hand);
    slab(hand, skin, 0.10, 0.11, 0.05, 0, -0.05, 0);                      // flat palm
    // Long splayed fingers, uneven count and length per side.
    const nFingers = side > 0 ? 4 : 3;
    for (let f = 0; f < nFingers; f++) {
      const spread = (f - (nFingers - 1) / 2) * 0.045;
      const fl = 0.26 + (f % 2) * 0.07 + (side > 0 ? 0.03 : 0);
      slab(hand, skin, 0.022, fl, 0.022, spread, -0.11 - fl / 2, 0.01, 0, 0, spread * 2.2);
    }

    arms.push({ shoulder, elbow, hand, side, restZ: side * 0.05 });
  });

  // ---- LEGS ------------------------------------------------------------------------
  /* Digitigrade: thigh down, shin back, then a long raised heel before the foot.
     This reverse-knee read is the single biggest "not human" cue in the silhouette. */
  const legs = [];
  const thighH = legH * 0.42, shinH = legH * 0.40;
  [-1, 1].forEach(side => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.17, -0.02, 0);
    hip.rotation.x = -0.10;                     // thigh angles forward
    body.add(hip);
    slab(hip, skin, 0.135, thighH, 0.135, 0, -thighH / 2, 0);
    slab(hip, skinLit, 0.04, thighH * 0.8, 0.04, side * 0.075, -thighH * 0.5, 0);

    const knee = new THREE.Group();
    knee.position.set(0, -thighH, 0);
    knee.rotation.x = 0.34;                     // shin sweeps back — reverse knee
    hip.add(knee);
    slab(knee, recess, 0.145, 0.09, 0.145, 0, 0, 0);
    slab(knee, skin, 0.10, shinH, 0.10, 0, -shinH / 2 - 0.03, 0);
    slab(knee, skinLit, 0.03, shinH * 0.75, 0.03, side * 0.055, -shinH * 0.5, -0.01);

    const ankle = new THREE.Group();
    ankle.position.set(0, -shinH - 0.05, 0);
    ankle.rotation.x = -0.24;                   // long raised heel
    knee.add(ankle);
    const footH = legH - thighH - shinH - 0.05;
    slab(ankle, skin, 0.085, footH, 0.085, 0, -footH / 2, 0);
    slab(ankle, skin, 0.11, 0.06, 0.30, 0, -footH + 0.03, 0.07);   // splayed toe plate
    slab(ankle, skin, 0.05, 0.045, 0.12, side * 0.03, -footH + 0.02, 0.20);

    legs.push({ hip, knee, ankle, side, restHipX: -0.10, restKneeX: 0.34, restAnkleX: -0.24 });
  });

  return {
    group, bodyMaterials, eyeMat, eyeL, eyeR, eyeLight,
    headY: hipY + torsoH * 0.94 + neckH + 0.15,
    rig: { body, torso, neck, head, arms, legs, hipY }
  };
}

function buildSkeletonMesh(size) {
  const group = new THREE.Group();
  const boneColor = 0xd8d4c4;
  const boneMat = () => new THREE.MeshLambertMaterial({ color: boneColor });
  const bodyMaterials = [];
  const addPart = (parent, geo, mat, x, y, z, rx, ry, rz) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  const h = size[1]; // total height reference (~1.8)
  const legH = h * 0.42, torsoH = h * 0.36, headH = h * 0.2;
  const torsoY = legH + torsoH / 2;
  const headY = legH + torsoH + headH / 2;

  /* PIVOTS. The rest pose below reproduces the previous silhouette exactly — every
     part sits at the same world offset it did before, just expressed relative to the
     joint it hangs from. */
  const torso = new THREE.Group();      // pivots at the hips
  torso.position.set(0, legH, 0);
  group.add(torso);

  const head = new THREE.Group();       // pivots at the neck
  head.position.set(0, torsoH, 0);
  torso.add(head);

  // Skull with hollow dark eye sockets
  const skullMat = boneMat(); bodyMaterials.push(skullMat);
  addPart(head, new THREE.BoxGeometry(size[0] * 0.75, headH, size[0] * 0.75), skullMat, 0, headH / 2, 0);
  const socketMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
  addPart(head, new THREE.BoxGeometry(0.08, 0.08, 0.04), socketMat, -size[0] * 0.16, headH * 0.55, size[0] * 0.37);
  addPart(head, new THREE.BoxGeometry(0.08, 0.08, 0.04), socketMat, size[0] * 0.16, headH * 0.55, size[0] * 0.37);
  const jawMat = boneMat(); bodyMaterials.push(jawMat);
  const jaw = addPart(head, new THREE.BoxGeometry(size[0] * 0.4, headH * 0.18, size[0] * 0.55), jawMat, 0, headH * 0.05, size[0] * 0.1);

  // Spine + ribcage
  const spineMat = boneMat(); bodyMaterials.push(spineMat);
  addPart(torso, new THREE.BoxGeometry(0.06, torsoH, 0.06), spineMat, 0, torsoY - legH, 0);
  const ribMat = boneMat(); bodyMaterials.push(ribMat);
  for (let i = 0; i < 3; i++) {
    const ry2 = torsoY + torsoH * 0.28 - i * torsoH * 0.28;
    addPart(torso, new THREE.BoxGeometry(size[0] * 0.62, 0.045, size[0] * 0.4), ribMat, 0, ry2 - legH, 0);
  }
  const pelvisMat = boneMat(); bodyMaterials.push(pelvisMat);
  addPart(torso, new THREE.BoxGeometry(size[0] * 0.5, 0.09, size[0] * 0.36), pelvisMat, 0, 0.03, 0);

  // Arms — shoulder pivot + elbow pivot per side
  const armW = 0.08;
  const upperArmH = torsoH * 0.55, lowerArmH = torsoH * 0.5;
  const shoulderY = torsoY + torsoH * 0.32;
  const arms = [];
  [-1, 1].forEach(side => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * (size[0] * 0.5 + armW * 0.5), shoulderY - legH, 0);
    shoulder.rotation.z = side * 0.08;
    torso.add(shoulder);
    const armMat = boneMat(); bodyMaterials.push(armMat);
    addPart(shoulder, new THREE.BoxGeometry(armW, upperArmH, armW), armMat, 0, -upperArmH / 2, 0);

    const elbow = new THREE.Group();
    elbow.position.set(0, -upperArmH, 0);
    elbow.rotation.z = side * 0.06;
    shoulder.add(elbow);
    const lowerMat = boneMat(); bodyMaterials.push(lowerMat);
    addPart(elbow, new THREE.BoxGeometry(armW * 0.9, lowerArmH, armW * 0.9), lowerMat, 0, -lowerArmH / 2, 0);

    arms.push({ shoulder, elbow, side, restZ: side * 0.08, restElbowZ: side * 0.06 });
  });

  // Bow strapped to the torso - a thin curved arc built from angled bars
  const bowMat = new THREE.MeshLambertMaterial({ color: 0x5a3d28 });
  const bowGroup = new THREE.Group();
  bowGroup.position.set(size[0] * 0.5 + 0.1, torsoY - torsoH * 0.15 - legH, 0.12);
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const a = (i / (segs - 1) - 0.5) * Math.PI * 0.75;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.03, torsoH * 0.24, 0.03), bowMat);
    seg.position.set(Math.sin(a) * 0.16, Math.cos(a) * 0.16, 0);
    seg.rotation.z = -a;
    bowGroup.add(seg);
  }
  torso.add(bowGroup);

  // Legs — hip pivot + knee pivot per side, hung off the root so they stay planted
  // while the torso above them sways.
  const upperLegH = legH * 0.55, lowerLegH = legH * 0.5;
  const legs = [];
  [-1, 1].forEach(side => {
    const hip = new THREE.Group();
    hip.position.set(side * size[0] * 0.22, legH, 0);
    group.add(hip);
    const legMat = boneMat(); bodyMaterials.push(legMat);
    addPart(hip, new THREE.BoxGeometry(armW, upperLegH, armW), legMat, 0, -upperLegH / 2, 0);

    const knee = new THREE.Group();
    knee.position.set(0, -upperLegH, 0);
    hip.add(knee);
    const lowerLegMat = boneMat(); bodyMaterials.push(lowerLegMat);
    addPart(knee, new THREE.BoxGeometry(armW * 0.9, lowerLegH, armW * 0.9), lowerLegMat, 0, -lowerLegH / 2, 0);

    legs.push({ hip, knee, side });
  });

  // Faint eye glow so it still reads well at night despite being "hollow"
  const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0xdff0ff });
  const eyeGlow = new THREE.Mesh(new THREE.BoxGeometry(size[0] * 0.7, 0.05, 0.03), eyeGlowMat);
  eyeGlow.position.set(0, headH * 0.55, size[0] * 0.39);

  return {
    group, bodyMaterials, eyeMesh: eyeGlow, headY,
    // The eyes belong to the skull, so they must follow the head pivot rather than
    // the root — otherwise they float in place when the mob looks or lurches.
    eyeParent: head,
    rig: { kind: 'biped', torso, head, jaw, arms, legs, baseY: 0 }
  };
}

function buildSpiderMesh(size) {
  const group = new THREE.Group();
  const bodyColor = 0x1a1a1a;
  const bodyMaterials = [];

  /* The carapace (thorax + abdomen + eyes) hangs off its own pivot so it can bob and
     sway as one unit. The hips deliberately stay on the root so the legs read as
     planted while the body rides over them. Both sit inside the thorax sphere, so the
     small relative offset is never visible. */
  const body = new THREE.Group();
  group.add(body);

  const thoraxMat = new THREE.MeshLambertMaterial({ color: bodyColor }); bodyMaterials.push(thoraxMat);
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(size[0] * 0.32, 8, 6), thoraxMat);
  thorax.scale.set(1, 0.75, 1.1);
  thorax.position.set(0, size[1] * 0.62, size[2] * 0.18);
  thorax.castShadow = true;
  body.add(thorax);

  const abdomenMat = new THREE.MeshLambertMaterial({ color: bodyColor }); bodyMaterials.push(abdomenMat);
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(size[0] * 0.42, 8, 6), abdomenMat);
  abdomen.scale.set(1.05, 0.85, 1.3);
  abdomen.position.set(0, size[1] * 0.58, -size[2] * 0.28);
  abdomen.castShadow = true;
  body.add(abdomen);

  // 8 articulated two-segment legs, angled outward and down like a real spider stance
  const legMat = new THREE.MeshLambertMaterial({ color: bodyColor }); bodyMaterials.push(legMat);
  const legPositions = [-1.1, -0.55, 0.1, 0.65];
  const legLen1 = size[0] * 0.5, legLen2 = size[0] * 0.45;
  const legs = [];
  [-1, 1].forEach(side => {
    legPositions.forEach((zOff, i) => {
      const hipY = size[1] * 0.62;
      const hip = new THREE.Group();
      hip.position.set(side * size[0] * 0.22, hipY, zOff * size[2] * 0.22);
      hip.rotation.z = side * 0.9;
      hip.rotation.y = zOff * 0.35;
      group.add(hip);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(legLen1, 0.045, 0.045), legMat);
      upper.position.set(legLen1 / 2, 0, 0);
      hip.add(upper);
      const knee = new THREE.Group();
      knee.position.set(legLen1, 0, 0);
      knee.rotation.z = -1.15;
      hip.add(knee);
      const lower = new THREE.Mesh(new THREE.BoxGeometry(legLen2, 0.04, 0.04), legMat);
      lower.position.set(legLen2 / 2, 0, 0);
      knee.add(lower);
      // Rest angles are captured here so the animator only ever writes rest + delta
      // and can never drift the stance away from the authored pose.
      legs.push({
        hip, knee, side, index: i,
        restZ: side * 0.9, restY: zOff * 0.35, restKneeZ: -1.15,
        // Diagonal gait: alternate legs within a side, and offset the two sides, so
        // the spider never moves all eight in unison.
        phase: (i % 2) * Math.PI + (side > 0 ? Math.PI : 0)
      });
    });
  });

  // 6 small emissive red eye pixels on the head/thorax front
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const eyeGroup = new THREE.Group();
  const eyeOffsets = [[-0.09, 0.03], [0.09, 0.03], [-0.05, -0.02], [0.05, -0.02], [-0.13, -0.01], [0.13, -0.01]];
  for (const [ex, ey] of eyeOffsets) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), eyeMat);
    eye.position.set(ex * size[0], size[1] * 0.62 + ey, size[2] * 0.42);
    eyeGroup.add(eye);
  }
  body.add(eyeGroup);

  return {
    group, bodyMaterials, eyeMesh: eyeGroup, headY: size[1] * 0.62,
    eyeParent: body,
    rig: { kind: 'spider', body, thorax, abdomen, legs }
  };
}

function buildBehemothMesh(size) {
  const W = size[0], H = size[1], D = size[2];
  const group = new THREE.Group();

  // Six shared materials for ~90 primitives. The three Lambert hull materials go into
  // bodyMaterials so the existing hurt-flash loop still lights the whole body.
  const hull = new THREE.MeshLambertMaterial({ color: BEHEMOTH_HULL });
  const plate = new THREE.MeshLambertMaterial({ color: BEHEMOTH_PLATE });
  const bone = new THREE.MeshLambertMaterial({ color: BEHEMOTH_BONE });
  const glowMat = new THREE.MeshBasicMaterial({ color: BEHEMOTH_GLOW });
  const coreMat = new THREE.MeshBasicMaterial({ color: BEHEMOTH_CORE });
  const growthMat = new THREE.MeshLambertMaterial({ color: BEHEMOTH_GROWTH });
  const bodyMaterials = [hull, plate, bone, growthMat];

  const slab = (parent, mat, w, h, d, x, y, z, rx, ry, rz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  /* PROPORTIONS. Legs are only 35% of height (a human is ~48%) and the arms are
     nearly twice the leg length — that inversion is what makes it read as a hulking
     ape-like ruin rather than a big humanoid. */
  const legH = H * 0.35;
  const hipY = legH;

  const body = new THREE.Group();      // breathing / weight-shift pivot
  body.position.set(0, hipY, 0);
  group.add(body);

  // ---- PELVIS -------------------------------------------------------------------
  slab(body, hull, W * 0.62, H * 0.09, D * 0.5, 0, H * 0.03, 0);
  slab(body, plate, W * 0.48, H * 0.035, D * 0.4, 0.02, H * 0.075, 0.02);
  slab(body, bone, W * 0.14, H * 0.05, D * 0.16, -W * 0.2, H * 0.02, D * 0.2);

  // ---- TORSO --------------------------------------------------------------------
  const torso = new THREE.Group();
  torso.position.set(0, H * 0.09, 0);
  torso.rotation.x = 0.14;             // permanent forward hunch
  body.add(torso);

  const chestH = H * 0.30;
  // Side pillars only — the FRONT CENTRE IS LEFT OPEN. This gap is the hollow.
  [-1, 1].forEach(side => {
    const w = side > 0 ? W * 0.26 : W * 0.22;   // asymmetric: right flank is heavier
    slab(torso, hull, w, chestH, D * 0.46, side * W * 0.30, chestH * 0.5, -D * 0.04);
    slab(torso, plate, w * 0.7, chestH * 0.34, D * 0.12, side * W * 0.31, chestH * 0.66, D * 0.19, 0, 0, side * 0.06);
    slab(torso, bone, w * 0.34, chestH * 0.22, D * 0.10, side * W * 0.30, chestH * 0.22, D * 0.20);
  });
  // Spine column closing the back of the cavity.
  slab(torso, hull, W * 0.44, chestH * 1.02, D * 0.22, 0, chestH * 0.5, -D * 0.22);
  for (let i = 0; i < 4; i++) {
    slab(torso, bone, W * 0.10, chestH * 0.11, D * 0.09, (i % 2 ? 0.04 : -0.04),
      chestH * (0.16 + i * 0.24), -D * 0.34);
  }
  // Belly floor and the upper yoke that the cavity is cut between.
  slab(torso, hull, W * 0.72, chestH * 0.20, D * 0.42, 0, chestH * 0.08, D * 0.02);
  slab(torso, hull, W * 0.80, chestH * 0.22, D * 0.46, 0, chestH * 0.92, 0);
  slab(torso, plate, W * 0.66, chestH * 0.09, D * 0.20, -0.03, chestH * 1.00, D * 0.16, 0, 0, -0.04);

  // ---- THE HOLLOW: ribcage arch + suspended core --------------------------------
  const chest = new THREE.Group();
  chest.position.set(0, chestH * 0.5, D * 0.10);
  torso.add(chest);
  // Rib bars arching across the open cavity, uneven lengths so the cage looks broken.
  const ribs = [];
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const rw = W * (0.50 - Math.abs(t - 0.45) * 0.26);
    const r = slab(chest, glowMat, rw, H * 0.014, H * 0.014,
      (i % 2 ? 0.03 : -0.03), (t - 0.5) * chestH * 0.74, D * 0.14, 0, 0, (i % 2 ? 0.05 : -0.06));
    ribs.push(r);
  }
  // Two broken sternum struts, one clearly snapped short.
  slab(chest, glowMat, H * 0.013, chestH * 0.62, H * 0.013, -W * 0.07, 0, D * 0.145);
  slab(chest, glowMat, H * 0.013, chestH * 0.30, H * 0.013, W * 0.08, -chestH * 0.12, D * 0.145, 0, 0, 0.10);
  // The core, suspended in the gap.
  const coreGlow = new THREE.Mesh(new THREE.SphereGeometry(W * 0.15, 10, 8), coreMat);
  coreGlow.position.set(0, 0, D * 0.02);
  chest.add(coreGlow);
  const coreShell = new THREE.Mesh(new THREE.SphereGeometry(W * 0.21, 8, 6),
    new THREE.MeshBasicMaterial({ color: BEHEMOTH_GLOW, transparent: true, opacity: 0.30 }));
  coreShell.position.copy(coreGlow.position);
  chest.add(coreShell);

  // ---- SHOULDERS & CORRUPTED GROWTH ----------------------------------------------
  // Huge pauldrons — the widest point of the whole creature.
  [-1, 1].forEach(side => {
    const s = side > 0 ? 1.12 : 1.0;   // right pauldron is visibly larger
    slab(torso, hull, W * 0.34 * s, chestH * 0.30, D * 0.44, side * W * 0.44, chestH * 0.92, 0, 0, 0, -side * 0.10);
    slab(torso, plate, W * 0.28 * s, chestH * 0.12, D * 0.34, side * W * 0.46, chestH * 1.06, 0, 0, 0, -side * 0.12);
  });
  // Crystal erupting through the back and left shoulder — irregular, uneven counts.
  const growth = [];
  const spikes = [
    [-0.30, 1.06, -0.26, 0.30, -0.5, 0.3], [-0.46, 0.94, -0.30, 0.42, -0.8, 0.5],
    [-0.14, 1.14, -0.24, 0.24, -0.3, -0.2], [0.34, 1.02, -0.28, 0.22, -0.6, -0.4],
    [0.06, 1.18, -0.20, 0.34, -0.4, 0.1], [-0.58, 0.78, -0.22, 0.20, -1.0, 0.6],
    [0.20, 0.86, -0.34, 0.18, -0.7, -0.3],
  ];
  for (const [sx, sy, sz, len, rx, rz] of spikes) {
    const g = slab(torso, growthMat, W * 0.07, H * len * 0.5, W * 0.07,
      sx * W, chestH * sy, sz * D, rx, 0, rz);
    growth.push(g);
  }

  // ---- HEAD ----------------------------------------------------------------------
  /* No neck. The head is jammed down between the pauldrons and thrust forward, which
     is most of why the silhouette reads as hunched and predatory. */
  const head = new THREE.Group();
  head.position.set(0, chestH * 0.86, D * 0.22);
  head.rotation.z = 0.05;              // permanent cant
  torso.add(head);

  slab(head, hull, W * 0.46, H * 0.13, D * 0.40, 0, 0, 0);                    // cranium
  slab(head, plate, W * 0.42, H * 0.05, D * 0.34, -0.02, H * 0.075, -D * 0.02); // crown plate
  slab(head, hull, W * 0.34, H * 0.07, D * 0.16, 0, H * 0.015, D * 0.22);     // muzzle
  slab(head, plate, W * 0.50, H * 0.035, D * 0.10, 0, H * 0.055, D * 0.17, -0.28); // heavy brow
  // Jaw — a separate pivot so it can drop open on the roar/slam.
  const jaw = new THREE.Group();
  jaw.position.set(0, -H * 0.035, D * 0.06);
  head.add(jaw);
  slab(jaw, hull, W * 0.30, H * 0.045, D * 0.24, 0, -H * 0.02, D * 0.06);
  for (let i = 0; i < 4; i++)
    slab(jaw, bone, W * 0.035, H * 0.028, W * 0.035, (i - 1.5) * W * 0.075, -H * 0.005, D * 0.15);
  // Asymmetric horns: one long and swept, one snapped off to a stub.
  const horns = [];
  horns.push(slab(head, bone, W * 0.09, H * 0.20, W * 0.09, -W * 0.22, H * 0.12, -D * 0.04, -0.42, 0, 0.34));
  horns.push(slab(head, bone, W * 0.07, H * 0.15, W * 0.07, -W * 0.30, H * 0.25, -D * 0.13, -0.70, 0, 0.55));
  horns.push(slab(head, bone, W * 0.10, H * 0.07, W * 0.10, W * 0.22, H * 0.10, -D * 0.04, -0.20, 0, -0.30)); // snapped stub
  // Eyes: a recessed horizontal slit band, not two dots.
  const eyeGroup = new THREE.Group();
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xc060ff });
  [-1, 1].forEach(side => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(W * 0.13, H * 0.018, W * 0.03), eyeMat);
    e.position.set(side * W * 0.11, H * 0.02 + (side > 0 ? -H * 0.006 : 0), D * 0.195);
    eyeGroup.add(e);
  });
  head.add(eyeGroup);

  // ---- ARMS ----------------------------------------------------------------------
  /* Enormous and long enough that the fists hang just clear of the ground. Hung from
     the TORSO, not the root, so they follow the hunch and the breathing swell with
     the pauldrons instead of separating from them. */
  const arms = [];
  const shoulderLocalY = chestH * 1.02;
  [-1, 1].forEach(side => {
    const bulk = side > 0 ? 1.10 : 1.0;         // right arm is the heavier one
    const upperH = H * 0.225 * bulk;
    const foreH = H * 0.205 * bulk;

    const shoulder = new THREE.Group();
    shoulder.position.set(side * W * 0.56, shoulderLocalY, 0);
    shoulder.rotation.z = side * 0.10;
    torso.add(shoulder);
    slab(shoulder, bone, W * 0.20, H * 0.05, D * 0.20, 0, -H * 0.01, 0);
    slab(shoulder, hull, W * 0.26 * bulk, upperH, D * 0.26 * bulk, 0, -upperH / 2 - H * 0.02, 0);
    slab(shoulder, plate, W * 0.22 * bulk, upperH * 0.42, D * 0.10, side * W * 0.06, -upperH * 0.45, D * 0.11, 0, 0, side * 0.05);

    const elbow = new THREE.Group();
    elbow.position.set(0, -upperH - H * 0.045, 0);
    shoulder.add(elbow);
    slab(elbow, bone, W * 0.20, H * 0.045, D * 0.20, 0, 0, 0);
    slab(elbow, hull, W * 0.23 * bulk, foreH, D * 0.23 * bulk, 0, -foreH / 2 - H * 0.02, 0);
    slab(elbow, plate, W * 0.09, foreH * 0.7, W * 0.09, side * W * 0.10, -foreH * 0.5, 0);
    // A crystal shard has grown out through the forearm on one side only.
    if (side < 0) slab(elbow, growthMat, W * 0.06, H * 0.14, W * 0.06, -W * 0.13, -foreH * 0.62, D * 0.06, 0.3, 0, -0.5);

    const fist = new THREE.Group();
    fist.position.set(0, -foreH - H * 0.04, 0);
    elbow.add(fist);
    slab(fist, hull, W * 0.30 * bulk, H * 0.14, D * 0.30 * bulk, 0, -H * 0.06, 0);
    for (let k = 0; k < 3; k++)
      slab(fist, bone, W * 0.07, H * 0.05, D * 0.11, (k - 1) * W * 0.09, -H * 0.125, D * 0.13);

    arms.push({ shoulder, elbow, fist, side, restZ: side * 0.10 });
  });

  // ---- LEGS ------------------------------------------------------------------------
  // Short, immensely thick, slightly bowed — they look barely adequate to the load.
  const legs = [];
  const thighH = legH * 0.46, shinH = legH * 0.36;
  [-1, 1].forEach(side => {
    const hip = new THREE.Group();
    hip.position.set(side * W * 0.24, hipY, 0);
    hip.rotation.z = side * 0.07;
    group.add(hip);
    slab(hip, hull, W * 0.32, thighH, D * 0.34, 0, -thighH / 2, 0);
    slab(hip, plate, W * 0.26, thighH * 0.4, D * 0.12, 0, -thighH * 0.35, D * 0.14);

    const knee = new THREE.Group();
    knee.position.set(0, -thighH, 0);
    hip.add(knee);
    slab(knee, bone, W * 0.26, H * 0.04, D * 0.26, 0, 0, 0);
    slab(knee, hull, W * 0.28, shinH, D * 0.30, 0, -shinH / 2 - H * 0.015, 0);

    const ankle = new THREE.Group();
    ankle.position.set(0, -shinH - H * 0.03, 0);
    knee.add(ankle);
    const footH = legH - thighH - shinH - H * 0.03;
    slab(ankle, hull, W * 0.34, footH, D * 0.46, 0, -footH / 2, D * 0.06);
    for (let k = 0; k < 3; k++)
      slab(ankle, bone, W * 0.08, footH * 0.5, D * 0.12, (k - 1) * W * 0.11, -footH * 0.72, D * 0.26);

    legs.push({ hip, knee, ankle, side, restHipZ: side * 0.07 });
  });

  /* ---- DARKNESS AURA TELEGRAPH ----------------------------------------------------
     Purely cosmetic. The ability itself is untouched — this ring simply makes the
     already-existing 12-block snuffing radius VISIBLE, expanding to exactly
     BEHEMOTH_AURA_R when _darknessAura() fires. One reused mesh, never reallocated. */
  const auraRing = new THREE.Mesh(
    new THREE.RingGeometry(0.86, 1.0, 40),
    new THREE.MeshBasicMaterial({ color: BEHEMOTH_GLOW, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  );
  auraRing.rotation.x = -Math.PI / 2;
  auraRing.position.y = 0.12;
  auraRing.renderOrder = 2;
  auraRing.visible = false;
  group.add(auraRing);

  return {
    group, bodyMaterials, eyeMesh: eyeGroup, headY: H * 0.96,
    rig: {
      kind: 'behemoth', heavy: true, body, torso, chest, head, jaw,
      coreGlow, coreShell, ribs, growth, horns, auraRing, arms, legs,
      hipY, chestH, baseY: 0
    }
  };
}
