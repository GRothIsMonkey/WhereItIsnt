"""Original, deterministic R02 timber/repair-hardware authoring; Blender 5.2."""
import bpy,bmesh,math,json,struct,sys
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent
for d in ('source','export','textures','review','report'): (ROOT/d).mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
asset=bpy.data.collections.new('rural_fence_post_01');scene.collection.children.link(asset)

def image_file(name,rgb,data=False):
    h,w,_=rgb.shape;im=bpy.data.images.new(name,width=w,height=h,alpha=False)
    im.colorspace_settings.name='Non-Color' if data else 'sRGB'
    rgba=np.concatenate((np.clip(rgb,0,1),np.ones((h,w,1))),2).astype(np.float32)
    im.pixels.foreach_set(rgba.ravel());im.filepath_raw=str(ROOT/'textures'/f'{name}.png');im.file_format='PNG';im.save();im.pack();return im

# Wood sheet: 4 physical metres per UV unit, with reserved end-grain quadrant.
# Authored at 64 px/m. No hidden UV multiplier or high-density detail map.
n=256;y,x=np.mgrid[0:n,0:n].astype(float);u=x/n;v=y/n
rng=np.random.default_rng(2201)
field=np.zeros_like(u)
# Irregular, discontinuous fibre ribbons instead of R01's regular sinusoidal bands.
for k in range(180):
    center=rng.uniform(0,1);width=rng.uniform(.0017,.0044);phase=rng.uniform(0,6.28)
    bend=.0018*np.sin(v*rng.uniform(3,13)+phase)+.0007*np.sin(v*31+phase)
    weight=rng.uniform(-.080,.043);cy=rng.uniform(0,1)
    field+=weight*np.exp(-((u-center-bend)/width)**2)*(.35+.65*np.exp(-((v-cy)/.25)**2))
cloud=.022*np.sin(u*31+v*13)+.011*np.cos(v*36-u*19)
val=.255+field+cloud
warm=np.stack((val*1.13,val*.99,val*.81),2)
bleach=np.clip(.3+.25*np.sin(u*25+1)+.1*np.cos(v*10),0,.75)
rgb=warm*(1-bleach[:,:,None])+np.stack((val*1.05+.025,val*1.045+.023,val*1.01+.020),2)*bleach[:,:,None]
# Post lower damp age, dependent on the same physical-length UV coordinate.
rgb-=np.exp(-((v-.055)/.036)**2)[:,:,None]*np.array([.08,.066,.049])
for cx,cy in ((.084,.26),(.415,.31),(.515,.39)):
    rad=np.sqrt(((u-cx)*100)**2+((v-cy)*25)**2)
    knot=np.exp(-rad*rad*.9)*.035+np.sin(rad*12)*np.exp(-rad*rad*.12)*.009
    rgb-=knot[:,:,None]
# Clear growth-ring end grain and tiny radial checks, same physical density.
end=(u>.78)&(v<.24);r=np.sqrt(((u-.89)*1.15)**2+((v-.12)*.95)**2)
endval=.32+.065*np.sin(r*750+.8*np.sin(u*80))+.018*np.cos(r*412)
ergb=np.stack((endval*1.12,endval*1.025,endval*.86),2)
rgb=np.where(end[:,:,None],ergb,rgb)
base=image_file('r02_weathered_timber_basecolor',rgb)
rough=np.clip(.85-field*.8+cloud*.7,.77,.95)
mr=image_file('r02_weathered_timber_metallicroughness',np.stack((np.ones_like(u),rough,np.zeros_like(u)),2),True)
height=np.mean(rgb,2);dy,dx=np.gradient(height)
norm=np.stack((-dx*4,-dy*4,np.ones_like(dx)),2);norm/=np.linalg.norm(norm,axis=2,keepdims=True)
normal=image_file('r02_weathered_timber_normal',norm*.5+.5,True)
n=128;y,x=np.mgrid[0:n,0:n].astype(float)
seeds=rng.uniform(0,n,(640,2));nearest=np.full((n,n),1e10);cells=np.zeros((n,n))
for sx,sy in seeds:
    dist=(x-sx)**2+(y-sy)**2;mask=dist<nearest;cells[mask]=rng.uniform(-1,1);nearest=np.minimum(nearest,dist)
mv=.54+.026*cells+.009*np.sin(x*.31+y*.18)
metalbase=image_file('r02_galvanized_steel_basecolor',np.stack((mv*.95,mv,mv*1.04),2))
metalrough=np.clip(.53+.08*cells+.03*np.sin(x*.11),.40,.68)
metalmr=image_file('r02_galvanized_steel_metallicroughness',np.stack((np.ones_like(x),metalrough,np.ones_like(x)),2),True)

def material(name,base,mr,normal=None):
    m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;bs=n.get('Principled BSDF')
    t=n.new('ShaderNodeTexImage');t.image=base;l.new(t.outputs['Color'],bs.inputs['Base Color'])
    t=n.new('ShaderNodeTexImage');t.image=mr;s=n.new('ShaderNodeSeparateColor');l.new(t.outputs['Color'],s.inputs[0]);l.new(s.outputs['Green'],bs.inputs['Roughness']);l.new(s.outputs['Blue'],bs.inputs['Metallic'])
    if normal:
        t=n.new('ShaderNodeTexImage');t.image=normal;nm=n.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.7;l.new(t.outputs['Color'],nm.inputs['Color']);l.new(nm.outputs['Normal'],bs.inputs['Normal'])
    return m
wood=material('MAT_weathered_timber',base,mr,normal);metal=material('MAT_galvanized_steel',metalbase,metalmr)

def mesh(name,verts,faces,mat,uvs=None):
    me=bpy.data.meshes.new(name+'_mesh');me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name,me);asset.objects.link(ob);me.materials.append(mat)
    uv=me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        if uvs is not None:coords=uvs[p.index]
        else:
            axes=sorted(range(3),key=lambda i:abs(p.normal[i]))[:2]
            scale=.25 if mat==wood else .5
            coords=[(me.vertices[i].co[axes[0]]*scale+.32,me.vertices[i].co[axes[1]]*scale+.36) for i in p.vertices]
        for li,c in zip(p.loop_indices,coords):uv.data[li].uv=c
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();return ob

def section(a,b,c,check):
    return [(-a+c,-b),(-.029,-b),(-.024,-b),(-.021,-b+check),(-.018,-b),(.022,-b),(a-c,-b),(a,-b+c),(a,b-c),(a-c,b),(.021,b),(.017,b-check*.5),(.013,b),(-a+c,b),(-a,b-c),(-a,-b+c)]

def timber(name,kind):
    if kind=='post':levels=[0,.012,.20,.46,.72,.82,.935,1.065,1.176,1.20]
    else:levels=[.022,.070,.091,.094,.125,.31,.60,.94,1.29,1.60,1.855,1.88]
    verts=[];sections=[];N=16;faces=[];uvs=[]
    for k,t in enumerate(levels):
        if kind=='post':
            a=.083-.010*t/1.2;b=.077-.003*t/1.2;c=.0055+.0015*math.sin(t*5)
            check=.008*max(0,(t-.70)/.50)
            if k==len(levels)-1:a-=.007;b-=.003;c=.010
            if k==0:a-=.003;b-=.003
            sec=section(a,b,c,check)
            for j,(s,d) in enumerate(sec):
                bow=.016*math.sin(t/1.2*math.pi)
                # broad rough-sawn face and one controlled worn corner, not vertex noise
                s+=bow;d+=.004*math.sin(t*4.2)
                if j in (2,3,4):s+=.002*math.sin(t*15)
                z=t
                if k==len(levels)-1:z=1.2-.016*(s+a)/(2*a)-.004*(d+b)/(2*b)
                if j==6 and .2<t<.8:s-=.0025
                verts.append((s,d,z))
        else:
            tongue=t<=.091;a=.040 if tongue else .061;b=.022 if tongue else .034
            a*=1-.07*t/1.88;c=.003 if tongue else .0045
            if k==len(levels)-1:a-=.003;b-=.002
            # map section s to height; longitudinal checks live in the front face
            sec=section(a,b,c,.0035*max(0,1-abs(t-.8)/.7))
            for s,d in sec:
                sag=-.022*math.sin(math.pi*(t-.022)/1.858)
                if -.030<s<-.015:s+=.002*math.sin(t*11)
                twist=.012*math.sin(t/1.88*math.pi)
                zz=s*math.cos(twist)-d*math.sin(twist)
                yy=s*math.sin(twist)+d*math.cos(twist)
                verts.append((t,yy,.876+sag+zz))
        sections.append(sec)
    for k in range(len(levels)-1):
        arc=0
        for j in range(N):
            jj=(j+1)%N;dist=math.dist(sections[k][j],sections[k][jj]);off=.035 if kind=='post' else .40
            faces.append((k*N+j,k*N+jj,(k+1)*N+jj,(k+1)*N+j))
            uvs.append([(off+arc/4,.05+levels[k]/4),(off+(arc+dist)/4,.05+levels[k]/4),(off+(arc+dist)/4,.05+levels[k+1]/4),(off+arc/4,.05+levels[k+1]/4)])
            arc+=dist
    for k in (0,len(levels)-1):
        faces.append(tuple(k*N+j for j in range(N)));uvs.append([(.89+s/4,.12+d/4) for s,d in sections[k]])
    return mesh(name,verts,faces,wood,uvs)

post=timber('rural_fence_post_01_post','post');rail=timber('rural_fence_post_01_rail','rail')
# Actual blind housing: rail tongue enters post, bearing on wood, metal is a repair.
bpy.ops.mesh.primitive_cube_add(size=1,location=(.112,0,.876));cutter=bpy.context.object;cutter.name='TEMP_housing_cutter';cutter.dimensions=(.19,.048,.085)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bpy.context.view_layer.objects.active=post;mod=post.modifiers.new('housed_rail_socket','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
# Boolean-generated socket faces need authored physical-scale UVs, not cutter UVs.
post.data.update()
for p in post.data.polygons:
    co=[post.data.vertices[i].co for i in p.vertices]
    socket=any(all(abs(v[axis]-value)<1e-5 for v in co) for axis,value in ((0,.017),(1,.024),(1,-.024),(2,.8335),(2,.9185)))
    if socket:
        axes=sorted(range(3),key=lambda i:abs(p.normal[i]))[:2]
        for li,vertex in zip(p.loop_indices,co):post.data.uv_layers.active.data[li].uv=(.65+vertex[axes[0]]/4,.05+vertex[axes[1]]/4)
# Two old staple holes above the repaired joint; shallow blind bores, no extra material.
for z in (.984,1.004):
    bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=.0028,depth=.020,location=(.040,-.075,z),rotation=(math.pi/2,0,0));cutter=bpy.context.object
    bpy.context.view_layer.objects.active=post;mod=post.modifiers.new('old_staple_hole','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
post.data.update()
for p in post.data.polygons:
    bore_vertices=[post.data.vertices[i].co for i in p.vertices]
    if all(abs(co.x-.04)<.0035 and .979<co.z<1.009 and co.y<-.064 for co in bore_vertices):
        axes=sorted(range(3),key=lambda i:abs(p.normal[i]))[:2]
        for li in p.loop_indices:
            co=post.data.vertices[post.data.loops[li].vertex_index].co;post.data.uv_layers.active.data[li].uv=(.65+co[axes[0]]/4,.05+co[axes[1]]/4)
post_height=max(v.co.z for v in post.data.vertices)-min(v.co.z for v in post.data.vertices)

# One formed repair strap follows the front face, bends onto the inset rail face.
# Dropped post end makes the later repair readable even when grain cannot resolve.
path=[(-.051,-.078,.758),(-.050,-.078,.778),(-.033,-.078,.817),(.011,-.078,.857),(.055,-.078,.881),(.085,-.078,.884),(.098,-.078,.885),(.105,-.074,.886),(.113,-.066,.886),(.124,-.047,.886),(.135,-.039,.886),(.148,-.037,.886),(.30,-.037,.880),(.43,-.037,.871)]
verts=[];thick=.003
for k,(x,y,z) in enumerate(path):
    w=.022 if k not in (0,len(path)-1) else .014
    # strip cross direction in XZ perpendicular to local path
    a=Vector(path[max(0,k-1)]);b=Vector(path[min(len(path)-1,k+1)]);d=b-a;length=math.hypot(d.x,d.z);nx=-d.z/length;nz=d.x/length
    verts.extend([(x+sign*nx*w,y+depth,z+sign*nz*w) for depth in (0,thick) for sign in (-1,1)])
faces=[(0,2,3,1)]
for k in range(len(path)-1):
    a=k*4;b=(k+1)*4
    faces.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),(a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
a=(len(path)-1)*4;faces.append((a,a+1,a+3,a+2))
parts=[mesh('rural_fence_post_01_repair_strap',verts,faces,metal)]

def fastener(x,y,z):
    # Low-domed carriage heads and washers. Actual shafts remain inside timber.
    for label,rings,N in [('washer',[(0,.013),(.0017,.013),(.0022,.011)],10),('carriage_head',[(.002,.0095),(.006,.0085),(.008,.0055)],10)]:
        vs=[(x+r*math.cos(2*math.pi*j/N),y-t,z+r*math.sin(2*math.pi*j/N)) for t,r in rings for j in range(N)]
        fs=[tuple(range(N-1,-1,-1))]
        for k in range(len(rings)-1):
            fs.extend([(k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j) for j in range(N)])
        fs.append(tuple((len(rings)-1)*N+j for j in range(N)))
        ob=mesh('rural_fence_post_01_'+label,vs,fs,metal)
        if label=='carriage_head':
            for p in ob.data.polygons:p.use_smooth=len(p.vertices)==4
        parts.append(ob)
for pos in [(-.033,-.079,.816),(.165,-.038,.885),(.365,-.038,.875)]:fastener(*pos)

def join(obs,name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();ob=bpy.context.object;ob.name=name;ob.data.name=name+'_mesh';return ob
woodob=join([post,rail],'rural_fence_post_01_wood');metalob=join(parts,'rural_fence_post_01_bracket');objects=[woodob,metalob]
# Smooth shallow changes along timber; preserve sharp joinery and drying-check edges.
for ob in objects:
    bm=bmesh.new();bm.from_mesh(ob.data);bm.normal_update()
    for face in bm.faces:face.smooth=True
    for edge in bm.edges:edge.smooth=edge.is_manifold and edge.calc_face_angle()<math.radians(32)
    bm.to_mesh(ob.data);bm.free()
for ob in objects:
    bpy.context.view_layer.objects.active=ob;mod=ob.modifiers.new('final_triangulation','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=mod.name)
    ob['asset_id']='rural_fence_post_01';ob['revision']='02';ob['status']='RAW_REVIEW'

def metrics(obs):
    pts=[o.matrix_world@v.co for o in obs for v in o.data.vertices];lo=[min(v[i] for v in pts) for i in range(3)];hi=[max(v[i] for v in pts) for i in range(3)];out={'dimensions':[hi[i]-lo[i] for i in range(3)],'min':lo,'max':hi,'triangles':0,'vertices':0,'mesh_objects':len(obs),'objects':[]};world=texels=0
    for o in obs:
        me=o.data;me.calc_loop_triangles();wa=ta=0
        for t in me.loop_triangles:
            a,b,c=[o.matrix_world@me.vertices[i].co for i in t.vertices];area=(b-a).cross(c-a).length/2;uv=[me.uv_layers.active.data[i].uv for i in t.loops]
            ua=abs((uv[1].x-uv[0].x)*(uv[2].y-uv[0].y)-(uv[1].y-uv[0].y)*(uv[2].x-uv[0].x))/2
            res=256 if me.materials[t.material_index].name.startswith('MAT_weathered') else 128;wa+=area;ta+=ua*res*res
        bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
        out['objects'].append({'name':o.name,'triangles':len(me.loop_triangles),'source_vertices':len(me.vertices),'uv_layers':len(me.uv_layers),'nonmanifold_edges_after_seam_weld':sum(not e.is_manifold for e in bm.edges),'signed_volume':bm.calc_volume(signed=True),'degenerate_faces':sum(p.area<1e-12 for p in me.polygons),'location':list(o.location),'rotation':list(o.rotation_euler),'scale':list(o.scale),'texel_density':math.sqrt(ta/wa)})
        bm.free();out['triangles']+=len(me.loop_triangles);out['vertices']+=len(me.vertices);world+=wa;texels+=ta
    out['texel_density']=math.sqrt(texels/world);return out
source=metrics(objects)
assert source['triangles']<=1500,source
bpy.ops.object.select_all(action='DESELECT')
for ob in objects:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'export/rural_fence_post_01_r02.glb'),export_format='GLB',use_selection=True,export_yup=True,export_cameras=False,export_lights=False)

# Neutral and context review apparatus; never exported.
review=bpy.data.collections.new('REVIEW_ONLY');scene.collection.children.link(review)
def move_review(ob):
    for c in list(ob.users_collection):c.objects.unlink(ob)
    review.objects.link(ob)
def aim(o,loc,target):o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=400,location=(0,0,-.005));ground=bpy.context.object;ground.name='REVIEW_ONLY_ground';move_review(ground)
gm=bpy.data.materials.new('REVIEW_ONLY_ground');gm.use_nodes=True;gbs=gm.node_tree.nodes.get('Principled BSDF');gbs.inputs['Base Color'].default_value=(.22,.235,.24,1);gbs.inputs['Roughness'].default_value=.95;ground.data.materials.append(gm)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='REVIEW_ONLY_camera';move_review(cam);scene.camera=cam;cam.data.lens=50
def area(name,loc,energy,size,color):
    ld=bpy.data.lights.new('REVIEW_ONLY_'+name,'AREA');ld.energy=energy;ld.shape='DISK';ld.size=size;ld.color=color;ob=bpy.data.objects.new(ld.name,ld);review.objects.link(ob);aim(ob,loc,(.6,0,.6));return ob
key=area('sky_softbox',(0,-3,5),700,4,(1,.95,.86));fill=area('sky_fill',(1,3,4),450,5,(.8,.9,1))
scene.world=bpy.data.worlds.new('REVIEW_ONLY_sky');scene.world.use_nodes=True;bg=scene.world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=(.55,.65,.76,1);bg.inputs['Strength'].default_value=.5
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1400;scene.render.resolution_y=1050;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
def render(name,loc,target,scale=None):
    aim(cam,loc,target);cam.data.type='ORTHO' if scale else 'PERSP'
    if scale:cam.data.ortho_scale=scale
    scene.render.filepath=str(ROOT/'review'/name);bpy.ops.render.render(write_still=True)
render('01_neutral_three_quarter.png',(2.9,-4.8,2.45),(.83,0,.62),2.34)
render('02_neutral_side.png',(.90,-5,1.20),(.90,0,.60),2.25)
render('03_joint_closeup.png',(.60,-.91,1.10),(.115,0,.86),.65)
render('04_post_top_closeup.png',(.36,-.55,1.60),(.008,0,1.105),.35)

# Only linked copies of this same asset; one ground surface carries earth/grass colour.
copies=[]
for step in (-3,-2,-1,1,2,3,4,5):
    for original in objects:
        ob=bpy.data.objects.new('REVIEW_ONLY_repeat_'+original.name+'_'+str(step),original.data);review.objects.link(ob);ob.location.x=1.858*step;copies.append(ob)
nt=gm.node_tree;n=nt.nodes;l=nt.links
coord=n.new('ShaderNodeTexCoord');noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1.4;noise.inputs['Detail'].default_value=3;l.new(coord.outputs['Object'],noise.inputs['Vector'])
ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.25;ramp.color_ramp.elements[0].color=(.085,.066,.04,1);ramp.color_ramp.elements[1].position=.78;ramp.color_ramp.elements[1].color=(.18,.21,.105,1);l.new(noise.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs[0],gbs.inputs['Base Color'])
bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.025;l.new(noise.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs[0],gbs.inputs['Normal'])
key.data.energy=650;key.data.size=8;fill.data.energy=500;bg.inputs['Strength'].default_value=.65
# Broad sun disk supplies distant ground illumination; finite haze avoids infinite-volume black sky.
sd=bpy.data.lights.new('REVIEW_ONLY_overcast_sun','SUN');sd.energy=.9;sd.angle=math.radians(25);sd.color=(.86,.92,1)
sun=bpy.data.objects.new(sd.name,sd);review.objects.link(sun);sun.rotation_euler=(.4,-.25,-.6)
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,10));fog=bpy.context.object;fog.name='REVIEW_ONLY_finite_air';fog.dimensions=(160,160,40);move_review(fog)
fm=bpy.data.materials.new('REVIEW_ONLY_air');fm.use_nodes=True;fm.node_tree.nodes.clear();fo=fm.node_tree.nodes.new('ShaderNodeOutputMaterial');vol=fm.node_tree.nodes.new('ShaderNodeVolumeScatter');vol.inputs['Density'].default_value=.003;vol.inputs['Color'].default_value=(.75,.81,.84,1);fm.node_tree.links.new(vol.outputs[0],fo.inputs['Volume']);fog.data.materials.append(fm);fog.display_type='WIRE'
render('05_d1_context_overcast.png',(3.1,-4.5,1.6),(.85,0,.70))
render('06_d1_context_distance.png',(5,-14.2,1.6),(1,0,.65))
key.data.energy=100;fill.data.energy=120;bg.inputs['Strength'].default_value=.18;key.data.color=(1,.77,.50);sd.energy=.17
render('07_d1_context_evening.png',(3.1,-4.5,1.6),(.85,0,.70))
for ob in copies:ob.hide_render=True
key.data.energy=8;fill.data.energy=15;bg.inputs['Strength'].default_value=.04
sun.hide_render=True
ld=bpy.data.lights.new('REVIEW_ONLY_flashlight','SPOT');ld.energy=70;ld.spot_size=math.radians(55);ld.spot_blend=.65;ld.shadow_soft_size=.035
spot=bpy.data.objects.new(ld.name,ld);review.objects.link(spot);aim(spot,(.9,-.55,.95),(.02,0,.87))
render('08_flashlight_grazing.png',(.65,-1.15,1.16),(.16,0,.86),.77)
spot.hide_render=True;key.data.energy=650;fill.data.energy=500;key.data.color=(1,.95,.86);bg.inputs['Strength'].default_value=.65
sun.hide_render=False;sd.energy=.9
for ob in copies:ob.hide_render=False
distance_records=[]
target=Vector((.83,0,.68))
for distance in (1,5,15,30):
    # Exact camera-target range, 50 mm horizontal FOV, unchanged render resolution.
    target=Vector((.10,0,.87)) if distance==1 else Vector((.83,0,.68))
    dz=min(.92,distance*.35);loc=(target.x,-math.sqrt(distance*distance-dz*dz),target.z+dz)
    render(f'09_distance_{distance:02d}m.png',loc,target)
    distance_records.append({'distance_m':distance,'actual_camera_target_distance':(cam.location-target).length,'target':list(target),'lens_mm':cam.data.lens,'sensor_width_mm':cam.data.sensor_width,'resolution':[1400,1050]})

# Save neutral source presentation; optional context collection stays editable.
for ob in copies:ob.hide_render=True;ob.hide_set(True)
sun.hide_render=True;sun.hide_set(True);fog.hide_render=True;fog.hide_set(True)
l.remove(gbs.inputs['Base Color'].links[0]);l.remove(gbs.inputs['Normal'].links[0]);gbs.inputs['Base Color'].default_value=(.22,.235,.24,1)
key.data.energy=700;key.data.size=4;fill.data.energy=450;bg.inputs['Strength'].default_value=.5
aim(cam,(2.9,-4.8,2.45),(.83,0,.62));cam.data.type='ORTHO';cam.data.ortho_scale=2.34
bpy.ops.object.select_all(action='DESELECT')
for ob in objects:ob.select_set(True)
bpy.context.view_layer.objects.active=woodob
for im in (base,mr,normal,metalbase,metalmr):im.filepath='//../textures/'+im.name+'.png'
for screen in bpy.data.screens:
    for ar in screen.areas:
        if ar.type=='VIEW_3D':ar.spaces.active.region_3d.view_distance=2.9;ar.spaces.active.region_3d.view_location=(.8,0,.6);ar.spaces.active.shading.type='MATERIAL'
bpy.ops.outliner.orphans_purge(do_recursive=True);bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source/rural_fence_post_01_r02.blend'))
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT/'export/rural_fence_post_01_r02.glb'))
reimport=metrics([o for o in bpy.context.scene.objects if o.type=='MESH'])
data=(ROOT/'export/rural_fence_post_01_r02.glb').read_bytes();size=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+size])
result={'blender':bpy.app.version_string,'source':source,'reimport':reimport,'post_height':post_height,'glb':{'nodes':len(doc['nodes']),'meshes':len(doc['meshes']),'materials':[m['name'] for m in doc['materials']],'images':len(doc['images']),'textures':len(doc['textures']),'vertices':sum(doc['accessors'][p['attributes']['POSITION']]['count'] for m in doc['meshes'] for p in m['primitives']),'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives']),'external_uris':[x['uri'] for k in ('buffers','images') for x in doc.get(k,[]) if 'uri'in x],'extensions':doc.get('extensionsUsed',[])},'image_dimensions':{i.name:list(i.size) for i in bpy.data.images},'distance_review':distance_records}
(ROOT/'report/technical_validation.json').write_text(json.dumps(result,indent=2));print('VALIDATION',json.dumps(result))
