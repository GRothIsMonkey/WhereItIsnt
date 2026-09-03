const vm = require('vm');
const THREE = require('three');
const { load } = require('./load.js');

function makeWorld(gamePath) {
  const S = load(gamePath || require('path').join(__dirname, '..', '..', 'game.html'));
  const ev = (code) => vm.runInContext(code, S);
  // Minimal atlas stand-in: the mesher only ever reads .texture and uv helpers.
  S.__atlas = {
    texture: new THREE.Texture(),
    tileCount: 39 + 1 + vm.runInContext('SUB_TILE_DEFS.length', S),
  };
  S.__scene = new THREE.Scene();
  S.__THREE = THREE;
  const w = ev('(function(){ const w = new VoxelWorld(__scene, __atlas, null); return w; })()');
  return { S, ev, w };
}
module.exports = { makeWorld, THREE };
