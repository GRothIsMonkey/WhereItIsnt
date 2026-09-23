"""Original deterministic asset authoring. Run using Blender 5.2 --background --python.
All geometry and image pixels are authored here; no third-party resources.
"""
import bpy, bmesh, math, json, struct
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
for folder in ('source','export','textures','review','report'):
    (ROOT/folder).mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=1
asset=bpy.data.collections.new('rural_fence_post_01')
scene.collection.children.link(asset)

def image_file(name, rgb, data=False):
    h,w,_=rgb.shape
    im=bpy.data.images.new(name,width=w,height=h,alpha=False)
    im.colorspace_settings.name='Non-Color' if data else 'sRGB'
    rgba=np.concatenate((np.clip(rgb,0,1),np.ones((h,w,1))),axis=2).astype(np.float32)
    im.pixels.foreach_set(rgba.ravel())
    im.filepath_raw=str(ROOT/'textures'/f'{name}.png')
    im.file_format='PNG'; im.save(); im.pack()
    return im

# A reusable two-metre grain sheet, 128 pixels / 2 metres = 64 px/m.
# End grain occupies the last quarter-width, away from the longitudinal strips.
n=128
y,x=np.mgrid[0:n,0:n].astype(float)
u=x/n; v=y/n
warp=u+.009*np.sin(v*8+u*14)+.004*np.sin(v*21+u*9)
grain=.46*np.sin(warp*337)+.30*np.sin(warp*591+v*1.6)+.24*np.sin(warp*173-v*2)
cloud=np.sin(u*21+v*5)*np.sin(v*9-u*3)
val=.335+.084*grain+.030*cloud+.021*np.sin(u*67+v*2)
# Thin longitudinal surface checks, around a single texel wide, with tapered ends.
for cx,cy,span in ((.060,.25,.16),(.104,.43,.23),(.185,.19,.12),(.244,.49,.17),(.414,.31,.21),(.433,.68,.16),(.470,.47,.26),(.529,.81,.13)):
    center=cx+.002*np.sin(v*19+cx*17)
    val-=.125*np.exp(-((u-center)/.0045)**2)*np.exp(-((v-cy)/span)**6)
val-=.035*np.exp(-v*20)*(1+.3*np.sin(u*89))
# Occasional soft knots; long, restrained and sparse rather than black holes.
for cx,cy in ((.18,.31),(.53,.71)):
    r=np.sqrt(((u-cx)*55)**2+((v-cy)*12)**2)
    val-=.053*np.exp(-r*r*.8)
    val+=.022*np.sin(r*7)*np.exp(-r*r*.15)
end=u>.76
r=np.sqrt(((u-.88)*1.05)**2+(v-.14)**2)
val=np.where(end,.365+.047*np.sin(r*230)+.025*np.sin(r*113),val)
woodrgb=np.stack((val*1.075,val*1.015,val*.935),axis=2)
woodbase=image_file('weathered_timber_basecolor',woodrgb)
rough=np.clip(.84-.035*grain+.018*cloud,.75,.94)
woodmr=image_file('weathered_timber_metallicroughness',np.stack((np.ones_like(rough),rough,np.zeros_like(rough)),2),True)
dy,dx=np.gradient(val)
normal=np.stack((-dx*3.0,-dy*3.0,np.ones_like(dx)),2)
normal/=np.linalg.norm(normal,axis=2,keepdims=True)
woodnormal=image_file('weathered_timber_normal',normal*.5+.5,True)
n=32; y,x=np.mgrid[0:n,0:n].astype(float)
rng=np.random.default_rng(1901)
seeds=rng.uniform(0,32,(45,2))
dist=(x[:,:,None]-seeds[:,0])**2+(y[:,:,None]-seeds[:,1])**2
cells=rng.uniform(-1,1,45)[np.argmin(dist,axis=2)]
metalval=.56+.037*cells+.012*np.sin(x*.8+y*.5)
metalbase=image_file('galvanized_steel_basecolor',np.stack((metalval*.98,metalval,metalval*1.02),2))
metalrough=.61+.035*cells
metalmr=image_file('galvanized_steel_metallicroughness',np.stack((np.ones_like(x),metalrough,np.ones_like(x)),2),True)

def material(name,base,mr,normal=None):
    m=bpy.data.materials.new(name); m.use_nodes=True
    nodes=m.node_tree.nodes; links=m.node_tree.links
    bs=nodes.get('Principled BSDF')
    for im,role in ((base,'base'),(mr,'mr'),(normal,'normal')):
        if im is None: continue
        t=nodes.new('ShaderNodeTexImage'); t.image=im; t.interpolation='Linear'; t.extension='REPEAT'
        if role=='base': links.new(t.outputs['Color'],bs.inputs['Base Color'])
        elif role=='mr':
            sep=nodes.new('ShaderNodeSeparateColor')
            links.new(t.outputs['Color'],sep.inputs[0])
            links.new(sep.outputs['Green'],bs.inputs['Roughness'])
            links.new(sep.outputs['Blue'],bs.inputs['Metallic'])
        else:
            nm=nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value=.55
            links.new(t.outputs['Color'],nm.inputs['Color']); links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    return m
wood=material('MAT_weathered_timber',woodbase,woodmr,woodnormal)
metal=material('MAT_galvanized_steel',metalbase,metalmr)

def mesh(name,verts,faces,mat,uvs=None):
    me=bpy.data.meshes.new(name+'_mesh'); me.from_pydata(verts,[],faces); me.update()
    ob=bpy.data.objects.new(name,me); asset.objects.link(ob); me.materials.append(mat)
    layer=me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        if uvs is not None: coords=uvs[p.index]
        else:
            # Planar physical-scale mapping per face; intentionally reused metal sheet.
            axis=max(range(3),key=lambda a:abs(p.normal[a]))
            axes=[a for a in range(3) if a!=axis]
            coords=[(me.vertices[i].co[axes[0]]*2+.2,me.vertices[i].co[axes[1]]*2+.2) for i in p.vertices]
        for loop,uv in zip(p.loop_indices,coords): layer.data[loop].uv=uv
    bm=bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(me); bm.free()
    return ob

def timber(name,width,depth,length,axis,origin,offset):
    a=width/2; b=depth/2; c=.0032
    section=[(-a+c,-b),(a-c,-b),(a,-b+c),(a,b-c),(a-c,b),(-a+c,b),(-a,b-c),(-a,-b+c)]
    levels=[0,.006,length*.28,length*.61,length-.008,length]
    verts=[]
    for k,t in enumerate(levels):
        inset=.0015 if k in (0,5) else 0
        for j,(s,d) in enumerate(section):
            s=s*(1-inset/a); d=d*(1-inset/b)
            if k not in (0,5):
                s+=.0008*math.sin(k*1.9+j*.9); d+=.00065*math.sin(k*1.1+j*2.3)
            p=(s,d,t) if axis=='Z' else (t,d,s)
            verts.append(tuple(p[i]+origin[i] for i in range(3)))
    faces=[]; uvs=[]
    for k in range(5):
        arc=0
        for j in range(8):
            nxt=(j+1)%8
            dist=math.dist(section[j],section[nxt])
            faces.append((k*8+j,k*8+nxt,(k+1)*8+nxt,(k+1)*8+j))
            uvs.append([(offset+arc/2,levels[k]/2+.025),(offset+(arc+dist)/2,levels[k]/2+.025),(offset+(arc+dist)/2,levels[k+1]/2+.025),(offset+arc/2,levels[k+1]/2+.025)])
            arc+=dist
    for k in (0,5):
        faces.append(tuple(k*8+j for j in range(8)))
        uvs.append([(.87+s/2,.14+d/2) for s,d in section])
    return mesh(name,verts,faces,wood,uvs)

post=timber('rural_fence_post_01_post',.14,.14,1.2,'Z',(0,0,0),.035)
post_height=max(v.co.z for v in post.data.vertices)-min(v.co.z for v in post.data.vertices)
rail=timber('rural_fence_post_01_rail',.10,.05,1.8,'X',(.073,0,.88),.40)

def box(name,center,size,bevel=0):
    x,y,z=center; a,b,c=[s/2 for s in size]
    verts=[(x+sx*a,y+sy*b,z+sz*c) for sx,sy,sz in ((-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1))]
    ob=mesh(name,verts,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],metal)
    if bevel:
        bpy.context.view_layer.objects.active=ob; ob.select_set(True)
        mod=ob.modifiers.new('formed_edge','BEVEL'); mod.width=bevel; mod.segments=1
        bpy.ops.object.modifier_apply(modifier=mod.name); ob.select_set(False)
    return ob

# Rear mounting plate and one continuous folded U seat, 2 mm galvanized sheet.
parts=[box('hanger_back',(.0715,0,.88),(.003,.118,.174),.0008)]
profile=[(-.028,.935),(-.028,.827),(.028,.827),(.028,.935),(.026,.935),(.026,.829),(-.026,.829),(-.026,.935)]
verts=[(x,y,z) for x in (.073,.215) for y,z in profile]
faces=[tuple(range(7,-1,-1)),tuple(range(8,16))]
faces += [(j,(j+1)%8,(j+1)%8+8,j+8) for j in range(8)]
parts.append(mesh('hanger_folded_seat',verts,faces,metal))

def fastener(center,axis):
    # Three eight-sided rings form a washer; three six-sided rings a bevelled hex head.
    def lathe(name,segments,rings):
        verts=[]
        for t,r in rings:
            for j in range(segments):
                a=2*math.pi*j/segments
                p=(t,r*math.cos(a),r*math.sin(a)) if axis=='X' else (r*math.cos(a),-t,r*math.sin(a))
                verts.append(tuple(p[i]+center[i] for i in range(3)))
        faces=[tuple(range(segments-1,-1,-1))]
        for k in range(len(rings)-1):
            for j in range(segments): faces.append((k*segments+j,k*segments+(j+1)%segments,(k+1)*segments+(j+1)%segments,(k+1)*segments+j))
        faces.append(tuple((len(rings)-1)*segments+j for j in range(segments)))
        return mesh(name,verts,faces,metal)
    parts.append(lathe('washer',8,[(0,.008),(.0015,.008),(.002,.0068)]))
    parts.append(lathe('hex_head',6,[(.0015,.0058),(.005,.0058),(.0058,.0046)]))
for y in (-.047,.047):
    for z in (.823,.938): fastener((.0731,y,z),'X')
for x in (.116,.182): fastener((x,-.028,.882),'Y')

def join(objects,name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join(); ob=bpy.context.object; ob.name=name; ob.data.name=name+'_mesh'
    return ob
woodob=join([post,rail],'rural_fence_post_01_wood')
metalob=join(parts,'rural_fence_post_01_bracket')
objects=[woodob,metalob]
for ob in objects:
    bpy.context.view_layer.objects.active=ob
    mod=ob.modifiers.new('final_triangles','TRIANGULATE'); bpy.ops.object.modifier_apply(modifier=mod.name)
    ob['asset_id']='rural_fence_post_01'; ob['review_status']='RAW_REVIEW'
    for p in ob.data.polygons:p.use_smooth=False

def metrics(obs):
    bounds=[o.matrix_world@v.co for o in obs for v in o.data.vertices]
    lo=[min(v[i] for v in bounds) for i in range(3)]; hi=[max(v[i] for v in bounds) for i in range(3)]
    result={'dimensions':[hi[i]-lo[i] for i in range(3)],'min':lo,'max':hi,'triangles':0,'vertices':0,'meshes':len(obs),'objects':[]}
    totalworld=totaltex=0
    for o in obs:
        m=o.data;m.calc_loop_triangles(); area=tex=0
        for t in m.loop_triangles:
            a,b,c=[o.matrix_world@m.vertices[i].co for i in t.vertices]
            w=(b-a).cross(c-a).length/2
            uv=[m.uv_layers.active.data[i].uv for i in t.loops]
            ua=abs((uv[1].x-uv[0].x)*(uv[2].y-uv[0].y)-(uv[1].y-uv[0].y)*(uv[2].x-uv[0].x))/2
            res=128 if m.materials[t.material_index].name.startswith('MAT_weathered') else 32
            area+=w;tex+=ua*res*res
        bm=bmesh.new();bm.from_mesh(m)
        result['objects'].append({'name':o.name,'triangles':len(m.loop_triangles),'vertices':len(m.vertices),'uv_layers':len(m.uv_layers),'nonmanifold_edges':sum(not e.is_manifold for e in bm.edges),'volume':bm.calc_volume(signed=True),'degenerate_faces':sum(p.area<1e-12 for p in m.polygons),'location':list(o.location),'rotation':list(o.rotation_euler),'scale':list(o.scale),'texel_density':math.sqrt(tex/area)})
        bm.free();result['triangles']+=len(m.loop_triangles);result['vertices']+=len(m.vertices);totalworld+=area;totaltex+=tex
    result['texel_density']=math.sqrt(totaltex/totalworld)
    return result
source_metrics=metrics(objects)
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'export/rural_fence_post_01.glb'),export_format='GLB',use_selection=True,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT')

# Review setup lives in a clearly separate collection and never enters export.
review=bpy.data.collections.new('REVIEW_ONLY_camera_lights_ground');scene.collection.children.link(review)
def move_review(ob):
    for col in list(ob.users_collection):col.objects.unlink(ob)
    review.objects.link(ob)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.005)); ground=bpy.context.object
ground.name='REVIEW_ONLY_neutral_ground';move_review(ground)
gm=bpy.data.materials.new('REVIEW_ONLY_ground');gm.diffuse_color=(.19,.205,.21,1);gm.use_nodes=True
gm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.19,.205,.21,1)
gm.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.93;ground.data.materials.append(gm)
bpy.ops.object.camera_add(); camera=bpy.context.object;camera.name='REVIEW_ONLY_camera';move_review(camera);scene.camera=camera
camera.data.type='ORTHO'
def aim(ob,loc,target):
    ob.location=loc;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
def light(name,loc,energy,size,color):
    d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.shape='DISK';d.size=size;d.color=color
    ob=bpy.data.objects.new(name,d);review.objects.link(ob);aim(ob,loc,(.5,0,.6));return ob
key=light('REVIEW_ONLY_key',(0,-3,5),650,4,(1,.97,.91))
fill=light('REVIEW_ONLY_fill',(1,3,3),350,5,(.85,.91,1))
scene.world=bpy.data.worlds.new('REVIEW_ONLY_world');scene.world.use_nodes=True
bg=scene.world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=(.45,.49,.55,1)
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1024;scene.render.resolution_y=1024;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.render.image_settings.color_mode='RGB'
def render(name,loc,target,scale,mode):
    aim(camera,loc,target);camera.data.ortho_scale=scale
    if mode=='day':
        key.data.energy=850;key.data.size=.8;key.data.color=(1,.96,.88);fill.data.energy=320;bg.inputs['Strength'].default_value=.55
    elif mode=='overcast':
        key.data.energy=550;key.data.size=5;key.data.color=(.94,.97,1);fill.data.energy=450;bg.inputs['Strength'].default_value=.7
    else:
        key.data.energy=95;key.data.size=3;key.data.color=(1,.77,.53);fill.data.energy=95;bg.inputs['Strength'].default_value=.16
    scene.render.filepath=str(ROOT/'review'/name);bpy.ops.render.render(write_still=True)
render('01_three_quarter_day.png',(3.2,-5,2.8),(.83,0,.62),2.28,'day')
render('02_side_day.png',(.90,-5,1.25),(.90,0,.60),2.22,'day')
render('03_bracket_closeup.png',(.66,-.9,1.19),(.085,0,.89),.45,'day')
render('04_overcast.png',(3.2,-5,2.8),(.83,0,.62),2.28,'overcast')
render('05_evening.png',(3.2,-5,2.8),(.83,0,.62),2.28,'evening')
# Restore useful overcast-like source presentation without another render.
aim(camera,(3.2,-5,2.8),(.83,0,.62));camera.data.ortho_scale=2.28
key.data.energy=550;key.data.size=5;key.data.color=(.94,.97,1);fill.data.energy=450;bg.inputs['Strength'].default_value=.7
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=woodob
for im in (woodbase,woodmr,woodnormal,metalbase,metalmr):im.filepath='//../textures/'+im.name+'.png'
bpy.ops.outliner.orphans_purge(do_recursive=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source/rural_fence_post_01.blend'))

# Fresh-scene import plus direct GLB buffer accounting.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'export/rural_fence_post_01.glb'))
imported=metrics([o for o in bpy.context.scene.objects if o.type=='MESH'])
data=(ROOT/'export/rural_fence_post_01.glb').read_bytes()
jsonlen=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+jsonlen])
glb={'nodes':len(doc['nodes']),'meshes':len(doc['meshes']),'materials':[m['name'] for m in doc['materials']],'images':len(doc['images']),'textures':len(doc['textures']),'external_uris':[x['uri'] for k in ('buffers','images') for x in doc.get(k,[]) if 'uri' in x],'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives']),'vertices':sum(doc['accessors'][p['attributes']['POSITION']]['count'] for m in doc['meshes'] for p in m['primitives']),'extensions':doc.get('extensionsUsed',[]),'cameras':len(doc.get('cameras',[]))}
result={'blender':bpy.app.version_string,'source':source_metrics,'reimport':imported,'glb':glb,'image_dimensions':{i.name:list(i.size) for i in bpy.data.images},'post_height':post_height}
(ROOT/'report/technical_validation.json').write_text(json.dumps(result,indent=2))
print('ASSET_VALIDATION',json.dumps(result))
