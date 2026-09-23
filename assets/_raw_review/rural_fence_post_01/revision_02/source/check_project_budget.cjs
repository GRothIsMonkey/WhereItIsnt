// Reads the exported buffers and executes the unchanged repository measurement code.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'../../../..');
const bytes=fs.readFileSync(path.join(root,'export/rural_fence_post_01_r02.glb'));
const jsonLength=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+jsonLength));
const bin=bytes.subarray(28+jsonLength);
function attribute(index){
  const a=g.accessors[index],v=g.bufferViews[a.bufferView];
  const size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
  const width={5126:4,5125:4,5123:2,5121:1}[a.componentType];
  const read={5126:'readFloatLE',5125:'readUInt32LE',5123:'readUInt16LE',5121:'readUInt8'}[a.componentType];
  const offset=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||size*width;
  const get=(i,c)=>bin[read](offset+i*stride+c*width);
  return {count:a.count,getX:i=>get(i,0),getY:i=>get(i,1),getZ:i=>get(i,2)};
}
const images=g.images.map(im=>{
  const v=g.bufferViews[im.bufferView],png=bin.subarray(v.byteOffset,v.byteOffset+v.byteLength);
  return {isTexture:true,image:{width:png.readUInt32BE(16),height:png.readUInt32BE(20)}};
});
const texture=t=>images[g.textures[t.index].source];
const materials=g.materials.map(m=>({name:m.name,map:texture(m.pbrMetallicRoughness.baseColorTexture),roughnessMap:texture(m.pbrMetallicRoughness.metallicRoughnessTexture),...(m.normalTexture?{normalMap:texture(m.normalTexture)}:{})}));
for(const n of g.nodes){
  if(n.matrix||n.translation||n.rotation||n.scale)throw Error('Adapter expects identity node transforms; extend before measuring transformed nodes');
}
const tree={children:g.nodes.flatMap(n=>g.meshes[n.mesh].primitives.map(p=>({isMesh:true,children:[],material:materials[p.material],geometry:{index:attribute(p.indices),attributes:{position:attribute(p.attributes.POSITION),uv:attribute(p.attributes.TEXCOORD_0)}}})))};
const ctx={root:tree};vm.createContext(ctx);
for(const file of ['asset-measure.js','asset-budgets.js'])vm.runInContext(fs.readFileSync(path.join(repo,'src/assets',file),'utf8'),ctx);
const result=vm.runInContext('({measurement:measureAsset(root),budget:validateAssetBudget(measureAsset(root),"small-prop",[])})',ctx);
fs.writeFileSync(path.join(root,'report/project_budget_validation.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(result.budget.status!=='pass')process.exitCode=1;

