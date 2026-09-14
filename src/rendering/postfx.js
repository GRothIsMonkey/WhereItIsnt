"use strict";
/* =====================================================================================
   THE ONE POST-PROCESSING PASS
   ERA 1.5.6 — MOVED VERBATIM OUT OF game.html.

   Grain, vignette, channel split and the edge mirage, over one render target, driven by
   a single 0..1 "how intact is this player" number. Phase 27 and Phase 36 both tuned
   what that number does; neither is changed here.

   IT IS ONE PASS AND THERE MUST NOT BE TWO. The opening film, the Haven dissolve, the
   Suburbia sanity ramp and the finale all reach the screen through this shader, which is
   why none of them needed a pipeline of its own (sections 56, 58, 59).

   ERA 2 KEEPS OR REPLACES THIS WHOLE. It is the only thing between the scene and the
   canvas, so it is the cheapest place to change what the game looks like — and the
   render-scale setting (section 48) is a property of this target, not of the world.
   Every line below is byte-identical to the text that was in game.html, comments and all.
   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md section 4.8 and src/rendering/LAYER.md.
   ===================================================================================== */

class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.target = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat
    });
    this.orthoScene = new THREE.Scene();
    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.PlaneGeometry(2, 2);
    this.uniforms = {
      tDiffuse: { value: this.target.texture },
      uTime: { value: 0 },
      uSanity: { value: 1.0 },
      uNoise: { value: 0.0 },
      uJumpscare: { value: 0.0 },
      // LEVEL 4 — MASTER HORROR POST-FX SWITCH (PHASE 5A PART 3). 1.0 = normal
      // sanity-driven horror grading; 0.0 = every horror effect fully disabled
      // (vignette, chromatic aberration, grain, scanlines, mirage warp, jumpscare
      // wash) leaving a clean, untouched, fully-bright image. See setHorrorEnabled.
      uHorror: { value: 1.0 },
      // PHASE 5B — 0..1 void-glitch intensity, INDEPENDENT of both Sanity and uHorror.
      // Drives datamosh-style horizontal block tearing, an aggressive RGB split and a
      // red crush during The Haven Shift, so the collapse looks like the renderer
      // itself is failing rather than like the player merely losing their mind.
      uVoidGlitch: { value: 0.0 },
      /* PHASE 32 — 0..1 Haven dissolve. Independent of everything above it, because the
         Haven runs with uHorror at 0 and must be able to fade out without any of the
         horror grading coming back on to do it. ONE uniform added to the pass that was
         already there — see setHavenFade for why this is not a new effect stack. */
      uHavenFade: { value: 0.0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uSanity;
        uniform float uNoise;
        uniform float uJumpscare;
        uniform float uHorror;
        uniform float uVoidGlitch;
        uniform float uHavenFade;
        uniform vec2 uResolution;
        varying vec2 vUv;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1)) + uTime * 60.0 + uNoise * 17.0) * 43758.5453); }

        void main() {
          vec2 uv = vUv;

          // Horror Post-FX Bypass: Sanity > 80% completely disables chromatic
          // aberration, screen noise/grain, scanline flicker, mirage warp, and the
          // dark vignette (all gated to 0.0 intensity here) — those effects only ever
          // kick back in once Sanity has actually dropped below the threshold.
          // uHorror is the Level 4 master kill-switch: multiplying it into fxGate
          // forces chromatic aberration, grain, scanlines, mirage warp AND the
          // vignette to exactly 0.0 contribution regardless of Sanity.
          float fxGate = (uSanity > 0.8 ? 0.0 : 1.0) * uHorror;

          // Screen-edge heat-mirage distortion: Sanity < 20 (uSanity < 0.2) only,
          // growing as Sanity keeps falling. A pair of offset sine waves on the UVs,
          // masked so the center of the screen stays stable and only the edges
          // wobble like a heat haze. uNoise re-seeds the wave phase each frame so
          // it reads as an organic warp rather than a fixed ripple.
          float mirageAmt = (uSanity < 0.2 ? (0.2 - uSanity) * 5.0 : 0.0) * fxGate;
          float edgeMask = smoothstep(0.12, 0.55, length(uv - 0.5));
          vec2 wobUv = uv;
          wobUv.x += sin(uv.y * 12.0 + uTime * 2.2 + uNoise * 6.2831) * 0.006 * mirageAmt * edgeMask;
          wobUv.y += cos(uv.x * 10.0 + uTime * 1.7 + uNoise * 6.2831) * 0.005 * mirageAmt * edgeMask;

          // Chromatic Aberration: kicks in once Sanity < 50 (uSanity < 0.5), radial
          // RGB channel split whose separation grows proportionately as Sanity keeps
          // dropping toward 0.
          float caAmt = (uSanity < 0.5 ? (0.5 - uSanity) * 0.025 : 0.0) * fxGate;
          vec2 caDir = (wobUv - 0.5) * caAmt;
          vec3 color;
          color.r = texture2D(tDiffuse, wobUv + caDir).r;
          color.g = texture2D(tDiffuse, wobUv).g;
          color.b = texture2D(tDiffuse, wobUv - caDir).b;

          float vigStrength = mix(0.25, 1.15, 1.0 - uSanity);
          vec2 centered = uv - 0.5;
          float vig = smoothstep(0.85, 0.2, length(centered) * vigStrength + 0.15);
          color *= mix(1.0, vig, 0.85 * fxGate);

          float grainAmt = (uSanity < 0.4 ? (0.4 - uSanity) * 1.6 : 0.02) * fxGate;
          float g = (hash(uv * uResolution.xy) - 0.5) * grainAmt;
          color += g;

          float scan = sin(uv.y * uResolution.y * 1.4 + uTime * 20.0) * 0.03 * (1.0 - uSanity) * fxGate;
          color -= scan;

          // --- PHASE 5B: VOID GLITCH -------------------------------------------
          // Applied outside the fxGate/uHorror path entirely so it works even with
          // the horror grading disabled. Horizontal bands of the image are seized and
          // shifted sideways (datamosh tearing), the RGB channels are torn apart much
          // harder than the sanity aberration ever goes, and the result is crushed
          // toward red to sit under the blood-red fog.
          if (uVoidGlitch > 0.001) {
            float g = uVoidGlitch;
            // Quantize Y into chunky bands, then jitter each band's horizontal offset.
            float band = floor(uv.y * 28.0);
            float bandNoise = fract(sin(band * 91.7 + floor(uTime * 18.0) * 3.13) * 43758.5453);
            float tear = (bandNoise - 0.5) * 0.14 * g * step(0.55, bandNoise);
            vec2 gUv = vec2(clamp(uv.x + tear, 0.0, 1.0), uv.y);

            float split = 0.02 * g;
            vec3 gc;
            gc.r = texture2D(tDiffuse, clamp(gUv + vec2(split, 0.0), 0.0, 1.0)).r;
            gc.g = texture2D(tDiffuse, gUv).g;
            gc.b = texture2D(tDiffuse, clamp(gUv - vec2(split, 0.0), 0.0, 1.0)).b;

            // Heavy grain and a red crush.
            float gn = (hash(uv * uResolution.xy * 1.7) - 0.5) * 0.35 * g;
            gc += gn;
            gc.r = min(1.0, gc.r * (1.0 + 0.55 * g));
            gc.g *= (1.0 - 0.40 * g);
            gc.b *= (1.0 - 0.45 * g);

            color = mix(color, gc, clamp(g, 0.0, 1.0));
          }

          color = mix(color, vec3(0.9, 0.05, 0.05), uJumpscare * 0.6 * uHorror);

          // --- PHASE 32: THE HAVEN DISSOLVE ------------------------------------
          // The safe place being removed, not corrupted. Three cheap terms and no
          // second render pass:
          //   soften   four taps on a radius that opens with the fade, so the room
          //            goes out of focus the way a memory of it would
          //   drain    toward luma, so the gold light leaves before the shapes do
          //   recede   toward the pale ground colour from the edges inward, so the
          //            cabin is lost from the outside in rather than dimming evenly
          // Entirely skipped while the fade is zero, which is the whole of the intact
          // Haven and every other dimension in the game.
          if (uHavenFade > 0.001) {
            float f = clamp(uHavenFade, 0.0, 1.0);
            vec2 texel = 1.0 / uResolution.xy;
            float r = f * 3.5;
            vec3 soft = texture2D(tDiffuse, clamp(uv + vec2( r, 0.0) * texel, 0.0, 1.0)).rgb
                      + texture2D(tDiffuse, clamp(uv + vec2(-r, 0.0) * texel, 0.0, 1.0)).rgb
                      + texture2D(tDiffuse, clamp(uv + vec2(0.0,  r) * texel, 0.0, 1.0)).rgb
                      + texture2D(tDiffuse, clamp(uv + vec2(0.0, -r) * texel, 0.0, 1.0)).rgb;
            color = mix(color, soft * 0.25, f * 0.85);

            float lum = dot(color, vec3(0.299, 0.587, 0.114));
            color = mix(color, vec3(lum), f * 0.80);

            float edge = smoothstep(0.15, 0.85, length(uv - vec2(0.5)) * 1.35);
            color = mix(color, vec3(0.75, 0.78, 0.79), f * f * edge * 0.9);
          }

          gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
        }
      `
    });
    const quad = new THREE.Mesh(geo, mat);
    this.orthoScene.add(quad);
    this.jumpscareAmount = 0;
  }

  resize(w, h) {
    this.target.setSize(w, h);
    this.uniforms.uResolution.value.set(w, h);
  }

  triggerJumpscare() { this.jumpscareAmount = 1.0; }

  /* LEVEL 4 — FULL HORROR SHADER RESET (PHASE 5A PART 3).
     Flips the uHorror master switch. With it at 0 the fragment shader's fxGate
     collapses to zero, which simultaneously:
       - removes the screen vignette (the vig mix term is gated by fxGate),
       - strips chromatic aberration (caAmt * fxGate),
       - removes film grain and scanline flicker,
       - disables the low-sanity edge mirage warp,
       - neutralizes the red jumpscare wash.
     Any pending jumpscare is cleared immediately so a queued one can't flash
     through on the first Haven frame. */
  // PHASE 5B — sets the void-glitch intensity (0 = off, 1 = full renderer collapse).
  setVoidGlitch(amount) {
    this.uniforms.uVoidGlitch.value = Math.max(0, Math.min(1, amount));
  }

  /* PHASE 32 — sets the Haven dissolve (0 = the intact cabin, 1 = fully removed).

     WHY THIS IS ONE UNIFORM AND NOT A FRAMEWORK. The brief is explicit that the
     transition out should not justify building a post-processing stack. It does not: the
     scene already renders through this single full-screen pass on its way to the canvas,
     so the whole dissolve is one branch inside a shader that was already running, costing
     four texture taps on the frames where it is not zero and nothing at all on the frames
     where it is. No render target, no second pass, no new material. */
  setHavenFade(amount) {
    this.uniforms.uHavenFade.value = Math.max(0, Math.min(1,
      (typeof amount === 'number' && isFinite(amount)) ? amount : 0));
  }

  setHorrorEnabled(enabled) {
    this.uniforms.uHorror.value = enabled ? 1.0 : 0.0;
    if (!enabled) {
      this.jumpscareAmount = 0;
      this.uniforms.uJumpscare.value = 0;
      this.uniforms.uSanity.value = 1.0;
    }
  }

  render(dt, sanityFraction) {
    this.uniforms.uTime.value += dt;
    this.uniforms.uSanity.value = sanityFraction;
    // Re-seeded every frame so the mirage warp and grain don't repeat in a fixed pattern.
    this.uniforms.uNoise.value = Math.random();
    this.jumpscareAmount = Math.max(0, this.jumpscareAmount - dt * 1.5);
    this.uniforms.uJumpscare.value = this.jumpscareAmount;

    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.orthoScene, this.orthoCam);
  }
}
