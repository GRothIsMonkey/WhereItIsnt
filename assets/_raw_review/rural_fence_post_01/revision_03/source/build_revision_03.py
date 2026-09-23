"""R03 derives directly from the saved R02 meshes, UVs, materials and review rig.
No R01/R02 file is written. Blender 5.2 background authoring and EEVEE review.
"""
import bpy,bmesh,math,json,struct,ast
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent
PREV=ROOT.parent/'revision_02'
bpy.ops.wm.open_mainfile(filepath=str(PREV/'source/rural_fence_post_01_r02.blend'))
scene=bpy.context.scene
wood=bpy.data.objects['rural_fence_post_01_wood'];metal=bpy.data.objects['rural_fence_post_01_bracket'];objects=[wood,metal]
review=bpy.data.collections['REVIEW_ONLY'];cam=scene.camera
key=bpy.data.objects['REVIEW_ONLY_sky_softbox'];fill=bpy.data.objects['REVIEW_ONLY_sky_fill'];sun=bpy.data.objects['REVIEW_ONLY_overcast_sun'];fog=bpy.data.objects['REVIEW_ONLY_finite_air'];spot=bpy.data.objects['REVIEW_ONLY_flashlight'];ground=bpy.data.objects['REVIEW_ONLY_ground']
copies=[o for o in scene.objects if o.name.startswith('REVIEW_ONLY_repeat_')]

# Find R02's actual connected timber pieces; no reconstructed primitive substitute.
adj={v.index:set() for v in wood.data.vertices}
for e in wood.data.edges:
    a,b=e.vertices;adj[a].add(b);adj[b].add(a)
unseen=set(adj);groups=[]
while unseen:
    first=unseen.pop();group={first};stack=[first]
    while stack:
        v=stack.pop()
        for n in adj[v]:
            if n in unseen:unseen.remove(n);group.add(n);stack.append(n)
    groups.append(group)
post_ids=next(g for g in groups if max(wood.data.vertices[i].co.z for i in g)>1.15)
rail_ids=set(adj)-post_ids
original_positions={i:wood.data.vertices[i].co.copy() for i in adj}

def lean(z):return .052*(z/1.2)**1.15+.007*math.sin(z*4)
joint_shift=lean(.876)
def droop(x):
    t=max(0,min(1,(x-.022)/1.858))
    return -.009-.038*math.sin(math.pi*t)-.042*t
for i in post_ids:
    v=wood.data.vertices[i];x,y,z=v.co
    # Ground moisture eats the exposed lower front-right corner, leaving core timber.
    damp=math.exp(-((z-.11)/.13)**2)
    if x>.025 and y<-.025:
        v.co.x-=.012*damp;v.co.y+=.010*damp
    # Existing drying check opens with age, rather than random mesh noise.
    bow=.016*math.sin(z/1.2*math.pi)
    checkx=-.021+bow+.002*math.sin(z*15)
    if abs(x-checkx)<.0025 and y<0 and z>.70:v.co.y+=.008*((z-.70)/.5)
    # Rain-softened crown has local corner loss, not a pointed horror silhouette.
    if z>1.15:
        wear=max(0,(x+.005)/.09)*max(0,(-y+.012)/.10)
        v.co.z-=.026*wear*min(1,(z-1.15)/.035)
    v.co.x+=lean(z)
    v.co.y+=.006*(z/1.2)**2
post_height=max(wood.data.vertices[i].co.z for i in post_ids)
for i in post_ids:wood.data.vertices[i].co.z*=1.2/post_height
post_height=max(wood.data.vertices[i].co.z for i in post_ids)-min(wood.data.vertices[i].co.z for i in post_ids)
for i in rail_ids:
    v=wood.data.vertices[i];x,y,z=v.co;t=max(0,min(1,(x-.022)/1.858))
    v.co.x+=joint_shift
    v.co.z+=droop(x)
    angle=.023*t
    center=.876-.022*math.sin(math.pi*t)
    v.co.y=y*math.cos(angle)-(z-center)*math.sin(angle)
    v.co.z+=y*math.sin(angle)
    # A localized degraded lower edge and stressed end; no detached theatrical shards.
    if x>1.45:
        edge=max(0,min(1,(center-z)/.048))*max(0,min(1,(-y+.012)/.046))
        loss=.017*math.exp(-((x-1.60)/.19)**2)+.009*t
        v.co.z+=edge*loss;v.co.y+=edge*.006
        if x>1.85:v.co.x-=edge*.035
for v in metal.data.vertices:
    x,y,z=v.co;blend=max(0,min(1,(x-.05)/.10))
    v.co.x+=(1-blend)*lean(z)+blend*joint_shift
    v.co.z+=blend*droop(x)
    v.co.y+=(1-blend)*.006*(z/1.2)**2
    # Slight bowed span between rail bolts; anchors stay against timber.
    if .19<x<.34:v.co.y-=.0025*math.sin((x-.19)/.15*math.pi)

# Small longitudinal losses expose the softened lower edge and an opened end check.
# Boolean cutters are temporary tooling, never asset objects or extra materials.
cutmat=bpy.data.materials.new('TEMP_cut_surface')
wood_repeats=[o for o in copies if o.data==wood.data]
wood.data=wood.data.copy()
bm=bmesh.new();bm.from_mesh(wood.data)
bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.to_mesh(wood.data);bm.free()
cutindex=len(wood.data.materials);wood.data.materials.append(cutmat)
def cut_prism(name,profile,y0,y1):
    count=len(profile)
    verts=[(x,y,z) for y in (y0,y1) for x,z in profile]
    faces=[tuple(reversed(range(count))),tuple(range(count,count*2))]
    faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    cutter=bpy.data.objects.new(name,me);scene.collection.objects.link(cutter)
    for m in wood.data.materials:me.materials.append(m or wood.data.materials[0])
    for p in me.polygons:p.material_index=cutindex
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    print('CUTTER_VOLUME',name,bm.calc_volume(signed=True));bm.to_mesh(me);bm.free()
    bpy.context.view_layer.objects.active=wood
    mod=wood.modifiers.new(name,'BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
cut_prism('softened_lower_edge',[(1.58,.756),(1.97,.809),(2.04,.69),(1.58,.69)],-.12,-.009)
cut_prism('opened_end_check',[(1.755,.838),(2.04,.850),(2.04,.833)],-.12,.010)
# Crown erosion remains the deformed R02 cap; retain its irregular solid profile.
uv=wood.data.uv_layers.active.data
for p in wood.data.polygons:
    if p.material_index==cutindex:
        # Cut faces get the same 64 px/m as the existing timber, with planar UVs.
        axis=max(range(3),key=lambda i:abs(p.normal[i]));axes=[i for i in range(3) if i!=axis]
        for li in p.loop_indices:
            co=wood.data.vertices[wood.data.loops[li].vertex_index].co
            uv[li].uv=(.40+co[axes[0]]*.25,.17+co[axes[1]]*.25)
        p.material_index=0
wood.data.materials.pop(index=cutindex);bpy.data.materials.remove(cutmat)
for ob in wood_repeats:ob.data=wood.data
# Refresh component membership for surface-space age masks after the cuts.
adj={v.index:set() for v in wood.data.vertices}
for e in wood.data.edges:
    a,b=e.vertices;adj[a].add(b);adj[b].add(a)
unseen=set(adj);groups=[]
while unseen:
    first=unseen.pop();group={first};stack=[first]
    while stack:
        for n in adj[stack.pop()]:
            if n in unseen:unseen.remove(n);group.add(n);stack.append(n)
    groups.append(group)
post_ids=next(g for g in groups if max(wood.data.vertices[i].co.z for i in g)>1.15)
rail_ids=set(adj)-post_ids

# Preserve untouched R02 UVs; update normals after deformation and local losses.
for ob in objects:
    ob.data.update();bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
    ob['revision']='03';ob['status']='RAW_REVIEW';ob['derived_from']='revision_02/source/rural_fence_post_01_r02.blend'

# Copy every packed R02 image before altering it. All file output is R03-local.
image_pairs={}
for mat in {m for ob in objects for m in ob.data.materials if m is not None}:
    for node in mat.node_tree.nodes:
        if node.type=='TEX_IMAGE':
            old=node.image
            if old.name not in image_pairs:
                new=old.copy();new.name=old.name.replace('r02_','r03_')
                if new.packed_file:new.unpack(method='REMOVE')
                arr=np.array(old.pixels[:],dtype=np.float32).reshape(old.size[1],old.size[0],4)
                image_pairs[old.name]=(new,arr)
            node.image=image_pairs[old.name][0]

# Surface-space masks rasterized into existing UVs. Specific damp/decayed zones,
# not a uniform dark filter; no extra texture or density increase.
def bake_age(ob,basekey,mrkey,iswood):
    baseim,rgba=image_pairs[basekey];mrim,mr=image_pairs[mrkey];h,w=rgba.shape[:2]
    dark=np.zeros((h,w));roughdelta=np.zeros((h,w));grain=np.zeros((h,w))
    me=ob.data;me.calc_loop_triangles();uvdata=me.uv_layers.active.data
    for tri in me.loop_triangles:
        uv=np.array([tuple(uvdata[i].uv) for i in tri.loops]);coords=np.array([tuple(me.vertices[i].co) for i in tri.vertices]);uv=uv*np.array([w,h])
        lo=np.maximum(np.floor(uv.min(0)-1).astype(int),0);hi=np.minimum(np.ceil(uv.max(0)+1).astype(int),[w-1,h-1])
        if np.any(hi<lo):continue
        yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];p=np.stack((xx+.5,yy+.5),2)
        a,b,c=uv;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(den)<1e-10:continue
        aa=((b[1]-c[1])*(p[:,:,0]-c[0])+(c[0]-b[0])*(p[:,:,1]-c[1]))/den
        bb=((c[1]-a[1])*(p[:,:,0]-c[0])+(a[0]-c[0])*(p[:,:,1]-c[1]))/den;cc=1-aa-bb
        inside=(aa>=-.08)&(bb>=-.08)&(cc>=-.08)
        xyz=aa[:,:,None]*coords[0]+bb[:,:,None]*coords[1]+cc[:,:,None]*coords[2];x,y,z=xyz[:,:,0],xyz[:,:,1],xyz[:,:,2]
        if iswood:
            ispost=tri.vertices[0] in post_ids
            if ispost:
                wet=.55*np.exp(-((z-.10)/.21)**2)
                stress=.30*np.exp(-((z-.855)/.075)**2)*np.exp(-((x-.11)/.07)**2)
                crown=.17*np.exp(-((z-1.18)/.055)**2)
                amount=.055+wet+stress+crown
            else:
                end=.30*np.exp(-((x-1.78)/.22)**2)
                joint=.24*np.exp(-((x-.15)/.13)**2)
                lower=.10*np.clip((.86-z)/.09,0,1)
                amount=.04+end+joint+lower
            amount*=.87+.13*np.sin(x*41+z*23)
            along=z if ispost else x
            across=x+y*.57 if ispost else z+y*.63
            fibres=np.sin(across*181+.8*np.sin(along*11))
            breaks=.5+.5*np.sin(along*37+np.sin(across*91))
            flecks=np.sin(across*267+along*54)*np.sin(along*71-across*42)
            variation=.14*fibres*(.35+.65*breaks)+.065*flecks
            # Leave the inherited end-grain pattern on the exposed end faces.
            if abs(tri.normal.z if ispost else tri.normal.x)>.80:variation*=.15
            gs=grain[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
            strict=(aa>=0)&(bb>=0)&(cc>=0)
            gs[:]=np.where(strict,variation,gs)
            rd=.04+.06*amount
        else:
            # Oxidation and dirt concentrated along exposed lower strap/contact zones.
            amount=.09+.10*(.5+.5*np.sin(x*35+z*43))
            for cx,cz in ((.004,.816),(.204,.874),(.405,.858)):
                amount+=.13*np.exp(-((x-cx)**2+(z-cz)**2)/.00045)
            rd=.10+.10*amount
        ds=dark[lo[1]:hi[1]+1,lo[0]:hi[0]+1];rs=roughdelta[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
        ds[:]=np.maximum(ds,np.where(inside,amount,0));rs[:]=np.maximum(rs,np.where(inside,rd,0))
    # Two-pixel dilation supplies seam padding to the baked localized treatment.
    for _ in range(2):
        dark=np.maximum.reduce([dark,np.roll(dark,1,0),np.roll(dark,-1,0),np.roll(dark,1,1),np.roll(dark,-1,1)])
        roughdelta=np.maximum.reduce([roughdelta,np.roll(roughdelta,1,0),np.roll(roughdelta,-1,0),np.roll(roughdelta,1,1),np.roll(roughdelta,-1,1)])
    if iswood:
        avg=rgba[:,:,:3].mean(2,keepdims=True)
        rgba[:,:,:3]=(.78*rgba[:,:,:3]+.22*avg)*(1-np.clip(dark,0,.70)[:,:,None])
        rgba[:,:,:3]*=np.array([1.015,1,.955])
        rgba[:,:,:3]*=(1+grain[:,:,None])
    else:
        rgba[:,:,:3]*=(1-dark[:,:,None]);rgba[:,:,:3]*=np.array([.99,1,1.01])
        mr[:,:,2]=np.clip(1-dark*.25,.90,1)
    mr[:,:,1]=np.clip(mr[:,:,1]+roughdelta,.60,.96)
    image_pairs[basekey]=(baseim,rgba);image_pairs[mrkey]=(mrim,mr)
bake_age(wood,'r02_weathered_timber_basecolor','r02_weathered_timber_metallicroughness',True)
bake_age(metal,'r02_galvanized_steel_basecolor','r02_galvanized_steel_metallicroughness',False)
for new,arr in image_pairs.values():
    new.pixels.foreach_set(np.clip(arr,0,1).astype(np.float32).ravel());new.filepath_raw=str(ROOT/'textures'/f'{new.name}.png');new.file_format='PNG';new.save();new.pack()

# Reuse the exact R02 measurement function, without executing its build code.
tree=ast.parse((PREV/'source/build_revision_02.py').read_text())
fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='metrics')
exec(compile(ast.Module(body=[fn],type_ignores=[]),'R02_metrics','exec'))
source=metrics(objects)
assert source['triangles']<1500
bpy.ops.object.select_all(action='DESELECT')
for ob in objects:ob.select_set(True)
bpy.context.view_layer.objects.active=wood
bpy.ops.export_scene.gltf(filepath=str(ROOT/'export/rural_fence_post_01_r03.glb'),export_format='GLB',use_selection=True,export_yup=True,export_cameras=False,export_lights=False)

def aim(ob,loc,target):ob.location=loc;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
bg=scene.world.node_tree.nodes.get('Background');gm=ground.data.materials[0];n=gm.node_tree.nodes;l=gm.node_tree.links;gbs=n.get('Principled BSDF')
def neutral():
    for ob in copies+[sun,fog,spot]:ob.hide_render=True
    for socket in ('Base Color','Normal'):
        for link in list(gbs.inputs[socket].links):l.remove(link)
    gbs.inputs['Base Color'].default_value=(.22,.235,.24,1);key.data.energy=700;key.data.size=4;key.data.color=(1,.95,.86);fill.data.energy=450;bg.inputs['Strength'].default_value=.5
def context(mode='overcast'):
    for ob in copies+[sun,fog]:ob.hide_set(False);ob.hide_render=False
    ramp=next(no for no in n if no.type=='VALTORGB');bump=next(no for no in n if no.type=='BUMP')
    l.new(ramp.outputs[0],gbs.inputs['Base Color']);l.new(bump.outputs[0],gbs.inputs['Normal'])
    key.data.size=8;key.data.energy=650;fill.data.energy=500;sun.data.energy=.9;bg.inputs['Strength'].default_value=.65
    if mode=='evening':key.data.energy=100;fill.data.energy=120;sun.data.energy=.17;bg.inputs['Strength'].default_value=.18;key.data.color=(1,.77,.50)
def render(name,loc,target,scale=None):
    aim(cam,loc,target);cam.data.type='ORTHO' if scale else 'PERSP';cam.data.lens=50
    if scale:cam.data.ortho_scale=scale
    scene.render.resolution_x=1400;scene.render.resolution_y=1050;scene.render.filepath=str(ROOT/'review'/name);bpy.ops.render.render(write_still=True)
neutral()
render('01_neutral_three_quarter.png',(2.9,-4.8,2.45),(.83,0,.62),2.34)
render('02_joint_closeup.png',(.64,-.91,1.10),(.16,0,.85),.65)
render('03_wood_decay_closeup.png',(2.10,-.75,1.04),(1.66,0,.795),.56)
render('04_metal_closeup.png',(.61,-.85,1.06),(.20,0,.855),.49)
context();render('05_d1_overcast.png',(3.1,-4.5,1.6),(.85,0,.70))
context('evening');render('06_d1_evening.png',(3.1,-4.5,1.6),(.85,0,.70))
for ob in copies+[sun]:ob.hide_render=True
key.data.energy=8;fill.data.energy=15;bg.inputs['Strength'].default_value=.04;spot.hide_render=False
aim(spot,(.94,-.55,.95),(.06,0,.86))
render('07_flashlight.png',(.69,-1.15,1.16),(.20,0,.85),.77)
spot.hide_render=True;key.data.color=(1,.95,.86);context()
render('08_medium_distance.png',(5,-14.2,1.6),(1,0,.65))
distances=[]
for distance in (1,5,15):
    target=Vector((.15,0,.85)) if distance==1 else Vector((.85,0,.67));dz=min(.92,distance*.35)
    loc=(target.x,-math.sqrt(distance*distance-dz*dz),target.z+dz)
    render(f'10_distance_{distance:02d}m.png',loc,target)
    distances.append({'distance':distance,'measured_camera_target_distance':(cam.location-target).length,'lens_mm':50,'sensor_width_mm':36})
neutral()
render('11_post_decay_detail.png',(.48,-.62,1.50),(.058,0,1.105),.37)
render('12_groundline_decay_detail.png',(.38,-.63,.37),(.025,0,.16),.48)
aim(cam,(2.9,-4.8,2.45),(.83,0,.62));cam.data.type='ORTHO';cam.data.ortho_scale=2.34
for ob in copies+[sun,fog,spot]:ob.hide_set(True)
for new,arr in image_pairs.values():new.filepath='//../textures/'+new.name+'.png'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.outliner.orphans_purge(do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source/rural_fence_post_01_r03.blend'))

# Matched comparison uses actual R02 and R03 under the same orthographic camera/light.
for ob in objects:ob.location.x=.20
before=set(scene.objects)
bpy.ops.import_scene.gltf(filepath=str(PREV/'export/rural_fence_post_01_r02.glb'))
old=[o for o in scene.objects if o not in before and o.type=='MESH']
for ob in old:ob.location.x=-2.1
aim(cam,(0,-6,2.55),(0,0,.61));cam.data.ortho_scale=4.55
scene.render.resolution_x=1800;scene.render.resolution_y=1000
# Review-only labels are geometry in this temporary comparison, never saved/exported.
for body,x in [('REVISION 02',-1.20),('REVISION 03',1.08)]:
    bpy.ops.object.text_add(location=(x,-.10,1.43));label=bpy.context.object;label.data.body=body;label.data.align_x='CENTER';label.data.size=.065;label.rotation_euler=cam.rotation_euler
scene.render.filepath=str(ROOT/'review/09_r02_vs_r03_matched.png');bpy.ops.render.render(write_still=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'export/rural_fence_post_01_r03.glb'))
reimport=metrics([o for o in bpy.context.scene.objects if o.type=='MESH'])
data=(ROOT/'export/rural_fence_post_01_r03.glb').read_bytes();sz=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+sz])
result={'derived_from':str(PREV/'source/rural_fence_post_01_r02.blend'),'blender':bpy.app.version_string,'source':source,'reimport':reimport,'post_height':post_height,'glb':{'nodes':len(doc['nodes']),'meshes':len(doc['meshes']),'materials':[m['name'] for m in doc['materials']],'images':len(doc['images']),'textures':len(doc['textures']),'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives']),'vertices':sum(doc['accessors'][p['attributes']['POSITION']]['count'] for m in doc['meshes'] for p in m['primitives']),'external_uris':[v['uri'] for k in ('buffers','images') for v in doc.get(k,[]) if 'uri'in v],'extensions':doc.get('extensionsUsed',[])},'image_dimensions':{i.name:list(i.size) for i in bpy.data.images},'distance_review':distances}
(ROOT/'report/technical_validation.json').write_text(json.dumps(result,indent=2));print('VALIDATION',json.dumps(result))
