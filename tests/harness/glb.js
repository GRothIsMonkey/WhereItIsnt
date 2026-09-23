/* D1 IMPLEMENTATION PHASE 4 — A GLB'S OWN BYTES, READ OFFLINE.

   WHAT THIS IS. The two chunks of a binary glTF — the JSON header and the BIN buffer — and
   the handful of things that can be read out of them without a renderer: node transforms,
   accessor data (positions, UVs, indices), material slots, and each embedded PNG's
   dimensions from its IHDR header.

   WHAT IT IS NOT. A loader. It decodes no image, builds no material, applies no colour
   space and knows nothing about three.js — `tests/browser-assets.js` and
   `tests/browser-budgets.js` make every claim that needs those, in a real Chromium, through
   the real GLTFLoader. This exists so an OFFLINE suite can ask the shipped file a question
   about its own geometry (do the declared collision boxes enclose the timber? does the real
   measurement code count 1,296 triangles?) instead of trusting an authoring report.

   It hands the measurement code DUCK-TYPED objects, exactly the shape `asset-measure.js`
   already reads: `isMesh`, `geometry.index`, `geometry.attributes.position/uv`, and
   `material.map` etc. with `image.width/height`. It does not reimplement a single rule. */
const fs = require('fs');

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const WIDTH = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 };
const READ = { 5126: 'readFloatLE', 5125: 'readUInt32LE', 5123: 'readUInt16LE', 5121: 'readUInt8' };

function readGlb(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error(file + ' is not a binary glTF');
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  const binHeader = 20 + jsonLength;
  const bin = bytes.subarray(binHeader + 8, binHeader + 8 + bytes.readUInt32LE(binHeader));

  /* A glTF accessor as a three.js-shaped BufferAttribute: count, itemSize, getX/Y/Z. */
  function accessor(index) {
    const a = json.accessors[index], v = json.bufferViews[a.bufferView];
    const size = COMPONENTS[a.type], width = WIDTH[a.componentType], read = READ[a.componentType];
    if (!size || !width) throw new Error('unsupported accessor ' + a.type + '/' + a.componentType);
    const offset = (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || size * width;
    const get = (i, c) => bin[read](offset + i * stride + c * width);
    return { count: a.count, itemSize: size,
             getX: (i) => get(i, 0), getY: (i) => get(i, 1), getZ: (i) => get(i, 2),
             min: a.min, max: a.max };
  }

  /* PNG dimensions live at fixed offsets in the IHDR chunk — no decode required. */
  const images = (json.images || []).map((im) => {
    const v = json.bufferViews[im.bufferView];
    const png = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
    const isPng = png.readUInt32BE(0) === 0x89504e47;
    return { name: im.name, mimeType: im.mimeType, isPng,
             width: isPng ? png.readUInt32BE(16) : null, height: isPng ? png.readUInt32BE(20) : null };
  });

  const texture = (ref) => {
    if (!ref) return null;
    const img = images[json.textures[ref.index].source];
    return { isTexture: true, uuid: 'glb-tex-' + ref.index, image: { width: img.width, height: img.height } };
  };

  /* One duck-typed material per glTF material, so shared materials stay shared. */
  const materials = (json.materials || []).map((m, i) => {
    const pbr = m.pbrMetallicRoughness || {};
    const out = { type: 'MeshStandardMaterial', uuid: 'glb-mat-' + i, name: m.name,
                  roughness: 1, metalness: 1, opacity: 1, transparent: false, side: 0, alphaTest: 0 };
    const map = texture(pbr.baseColorTexture), mr = texture(pbr.metallicRoughnessTexture);
    if (map) out.map = map;
    if (mr) { out.roughnessMap = mr; out.metalnessMap = mr; }
    if (m.normalTexture) out.normalMap = texture(m.normalTexture);
    return out;
  });

  /* The mesh nodes as a flat duck-typed tree. Refuses a transformed node rather than
     silently measuring it in the wrong space. */
  const IDENTITY = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const nodes = (json.nodes || []).filter((n) => n.mesh !== undefined).map((n) => {
    if (n.matrix || n.translation || n.rotation || n.scale) {
      throw new Error('node "' + n.name + '" carries a transform; this reader measures identity nodes only');
    }
    return json.meshes[n.mesh].primitives.map((p) => ({
      isMesh: true, visible: true, children: [], userData: {}, name: n.name,
      matrixWorld: { elements: IDENTITY.slice() },
      updateMatrixWorld() {},
      traverse(fn) { fn(this); },
      material: materials[p.material],
      geometry: {
        index: p.indices !== undefined ? accessor(p.indices) : null,
        groups: null,
        attributes: {
          position: accessor(p.attributes.POSITION),
          uv: p.attributes.TEXCOORD_0 !== undefined ? accessor(p.attributes.TEXCOORD_0) : undefined,
        },
      },
    }));
  }).flat();

  const root = { children: nodes, visible: true, userData: {},
                 matrixWorld: { elements: IDENTITY.slice() }, updateMatrixWorld() {},
                 traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); } };

  /* Every vertex position of one named node, as [x, y, z] triples. */
  function positions(nodeName) {
    const out = [];
    for (const n of nodes) {
      if (nodeName && n.name !== nodeName) continue;
      const a = n.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) out.push([a.getX(i), a.getY(i), a.getZ(i)]);
    }
    return out;
  }

  return { json, bytes, images, materials, nodes, root, positions, byteLength: bytes.length };
}

module.exports = { readGlb };
