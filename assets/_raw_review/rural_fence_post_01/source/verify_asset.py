"""Read-only source/GLB checks; writes review evidence inside this asset directory."""
import bpy, bmesh, json, math
import numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source/rural_fence_post_01.blend'))
scene=bpy.context.scene
source_objects=[o for o in scene.objects if o.name.startswith('rural_fence_post_01')]
checks={'source_reopens':True,'source_packed_images':sum(i.packed_file is not None for i in bpy.data.images),'source_objects':[o.name for o in scene.objects],'component_audits':[]}
for o in source_objects:bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'export/rural_fence_post_01.glb'))
for ob in [o for o in scene.objects if o.name.startswith('rural_fence_post_01')]:
    bm=bmesh.new();bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
    bm.normal_update()
    unseen=set(bm.verts);volumes=[];bad=0
    while unseen:
        first=unseen.pop();group={first};stack=[first]
        while stack:
            v=stack.pop()
            for e in v.link_edges:
                other=e.other_vert(v)
                if other in unseen:unseen.remove(other);group.add(other);stack.append(other)
        fs={f for v in group for f in v.link_faces}
        vol=0
        for f in fs:
            coords=[v.co for v in f.verts]
            for i in range(1,len(coords)-1):vol+=coords[0].dot(coords[i].cross(coords[i+1]))/6
        volumes.append(vol)
    checks['component_audits'].append({'name':ob.name,'welded_vertices':len(bm.verts),'nonmanifold_edges_after_seam_weld':sum(not e.is_manifold for e in bm.edges),'components':len(volumes),'all_component_signed_volumes_positive':all(v>0 for v in volumes),'component_volumes':volumes})
    bm.free()
scene.render.filepath=str(ROOT/'review/06_glb_reimport_overcast.png')
bpy.ops.render.render(write_still=True)
def pixels(path):
    im=bpy.data.images.load(str(path),check_existing=False)
    arr=np.empty(len(im.pixels),dtype=np.float32);im.pixels.foreach_get(arr)
    return arr.reshape(-1,4)[:,:3]
a=pixels(ROOT/'review/04_overcast.png');b=pixels(ROOT/'review/06_glb_reimport_overcast.png')
checks['roundtrip_render_mean_absolute_rgb_difference']=float(np.abs(a-b).mean())
checks['roundtrip_render_max_absolute_rgb_difference']=float(np.abs(a-b).max())
checks['roundtrip_pixels_with_difference_over_1_of_255']=float(np.mean(np.max(np.abs(a-b),axis=1)>1/255))
(ROOT/'report/roundtrip_validation.json').write_text(json.dumps(checks,indent=2))
print(json.dumps(checks))
