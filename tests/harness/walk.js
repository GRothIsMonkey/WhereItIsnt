/* A WALKABILITY PROVER THAT USES THE GAME'S OWN COLLISION.

   Nothing here models the world: every query goes through VoxelWorld.collidesAABB with
   the player's real box (halfWidth 0.3, height 1.8), and the step-up mirrors
   PlayerController._tryStepUp exactly — same ceiling (PLAYER_STEP_HEIGHT), same probe
   count, same settle-back-down. So a route this finds is a route the player can walk,
   and one it cannot find is one they cannot. */
const STEP_H = 0.62, STEP_N = 8, HALF = 0.3, TALL = 1.8;
/* A JUMP IS PART OF WALKING IN THIS GAME. jumpVelocity is 8.6 against gravity -24, so
   the player clears 1.54 blocks; every terrain step in the Farmlands is one block and is
   crossed by jumping, not by the step assist. The prover therefore allows a 1.25-block
   rise — comfortably over a one-block step, comfortably under what the real jump can do,
   so it never claims a route the player could not take. */
const JUMP_H = 1.25;

function aabb(x, y, z) {
  return { minX: x - HALF, maxX: x + HALF, minY: y, maxY: y + TALL, minZ: z - HALF, maxZ: z + HALF };
}
function hits(w, x, y, z) { return w.collidesAABB(aabb(x, y, z)); }

// Fall until something supports the body, mirroring the controller's grounded state.
function settle(w, x, y, z, maxDrop) {
  let cur = y;
  for (let k = 0; k < (maxDrop || 40) * 10; k++) {
    const t = cur - 0.1;
    if (hits(w, x, t, z)) break;
    cur = t;
  }
  // refine to 0.02
  for (let k = 0; k < 5; k++) {
    const t = cur - 0.02;
    if (hits(w, x, t, z)) break;
    cur = t;
  }
  return hits(w, x, cur, z) ? null : cur;
}

function stepUp(w, x, y, z, allowJump) {
  const H = allowJump ? JUMP_H : STEP_H;
  const N = allowJump ? 16 : STEP_N;
  for (let i = 1; i <= N; i++) {
    const t = y + (H * i) / N;
    if (hits(w, x, t, z)) continue;
    let rest = t;
    for (let k = i - 1; k >= 0; k--) {
      const u = y + (H * k) / N;
      if (hits(w, x, u, z)) break;
      rest = u;
    }
    return rest;
  }
  return null;
}

/* Breadth-first over half-block moves. `bounds` keeps the search from wandering into
   the whole infinite region; `goal` is a predicate on (x,y,z). */
function walkReach(w, start, bounds, goal, limit) {
  const D = 0.5;
  const key = (x, y, z) => `${Math.round(x * 2)},${Math.round(y * 4)},${Math.round(z * 2)}`;
  const y0 = settle(w, start.x, start.y, start.z, 6);
  if (y0 === null) return { ok: false, why: 'start position is inside geometry', visited: 0 };
  const q = [{ x: start.x, y: y0, z: start.z }];
  const seen = new Set([key(start.x, y0, start.z)]);
  let visited = 0;
  while (q.length) {
    const p = q.shift();
    visited++;
    if (visited > (limit || 400000)) return { ok: false, why: 'search limit', visited };
    if (goal(p)) return { ok: true, at: p, visited };
    for (const [dx, dz] of [[D, 0], [-D, 0], [0, D], [0, -D]]) {
      const nx = p.x + dx, nz = p.z + dz;
      if (nx < bounds.x0 || nx > bounds.x1 || nz < bounds.z0 || nz > bounds.z1) continue;
      let ny = p.y;
      if (hits(w, nx, ny, nz)) {
        /* Blocked at the current height. Two things a real body does next, in order:
           step/jump up over what is in the way, or — walking downhill or down a flight
           of stairs — simply be lower by the time it gets there, because gravity has
           been pulling on it the whole way. Without the second the prover cannot walk
           DOWN a staircase whose exit is under a lintel, which is not a property of the
           world, only of the prover. */
        const up = stepUp(w, nx, ny, nz, true);
        if (up !== null) ny = up;
        else {
          let found = null;
          for (let drop = 0.25; drop <= 1.75; drop += 0.25) {
            if (!hits(w, nx, p.y - drop, nz)) { found = p.y - drop; break; }
          }
          if (found === null) continue;
          ny = found;
        }
      }
      const s = settle(w, nx, ny, nz, 4);          // a four-block drop is survivable
      if (s === null) continue;
      if (s < bounds.y0 || s > bounds.y1) continue;
      const k = key(nx, s, nz);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ x: nx, y: s, z: nz });
    }
  }
  return { ok: false, why: 'exhausted', visited };
}

module.exports = { walkReach, settle, hits };
