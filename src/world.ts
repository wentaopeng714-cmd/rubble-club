import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {type Demolition,type Event,type Vec,type Tool} from './simulation';
const INK=0x30394e,CREAM=0xfff3d1,YELLOW=0xffcc42;
const THEMES=[
 {wall:0xf08e74,trim:0x52b8c4,roof:0xf1ca58,ground:0xc6d5a9,bg:0xf4eddd},
 {wall:0x64acd2,trim:0xffd075,roof:0xf094a8,ground:0xc5dcca,bg:0xe8eddf},
 {wall:0xf4cf64,trim:0x9e8bcc,roof:0x50ada8,ground:0xb9d0ab,bg:0xf6eed9},
 {wall:0x76beb0,trim:0xf1998e,roof:0x6b98ba,ground:0xd7d6a7,bg:0xedecda},
 {wall:0xaa91cf,trim:0xf5ce78,roof:0xe78b73,ground:0xb8d6c3,bg:0xeee7e4},
 {wall:0xf09aae,trim:0x60b8c3,roof:0xf0c557,ground:0xc0d2b1,bg:0xf6e9dd},
];
interface FX{mesh:T.Mesh;vel:T.Vector3;life:number;max:number;spin:number}
export class Scene {
 renderer:T.WebGLRenderer;scene=new T.Scene();camera=new T.OrthographicCamera();root=new T.Group();building=new T.Group();machine=new T.Group();turret=new T.Group();boom=new T.Group();collector=new T.Group();moduleMeshes=new Map<number,T.Group>();pieceMeshes=new Map<number,T.Mesh>();materials=new Map<number,T.MeshStandardMaterial>();fx:FX[]=[];hover=new T.Box3Helper(new T.Box3(),YELLOW);ray=new T.Raycaster();mouse=new T.Vector2();time=0;angle=.72;targetAngle=.72;shake=0;stage=-1;targetId=-1;paused=false;tool:'breaker'|'ball'|'blast'='breaker';swing:{position:T.Vector3;tool:Tool;age:number;duration:number}|null=null;head=new T.Group();tip=new T.Vector3();arm1!:T.Mesh;arm2!:T.Mesh;chain!:T.Mesh;claw!:T.Mesh;wheelMeshes:T.Mesh[]=[];neighborSign=new T.Group();charge=new T.Group();wreckBall!:T.Mesh;lastNeighbor='';floors=2;reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 constructor(public host:HTMLElement){
  this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.setClearColor(0xf4eddd);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;host.appendChild(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Colorful demolition site. Tap a building support to demolish it.');
  this.scene.add(new T.HemisphereLight(0xfff6dc,0x7eabb4,2.4));const sun=new T.DirectionalLight(0xfff0d4,3.2);sun.position.set(-8,18,10);sun.castShadow=true;const shadowSize=innerWidth<700?1024:2048;sun.shadow.mapSize.set(shadowSize,shadowSize);Object.assign(sun.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:.5,far:50});sun.shadow.normalBias=.05;sun.shadow.bias=-.0002;this.scene.add(sun,this.root,this.building,this.machine,this.collector,this.boom,this.head,this.hover,this.neighborSign,this.charge);this.hover.visible=false;(this.hover.material as T.LineBasicMaterial).linewidth=2;this.hover.renderOrder=2;this.buildMachine();this.buildCollector();this.resize();new ResizeObserver(()=>this.resize()).observe(host);
 }
 mat(color:number){if(!this.materials.has(color))this.materials.set(color,new T.MeshStandardMaterial({color,roughness:.83}));return this.materials.get(color)!;}
 mesh(geo:T.BufferGeometry,color:number,parent:T.Object3D){const m=new T.Mesh(geo,this.mat(color));m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 box(w:number,h:number,d:number,color:number,parent:T.Object3D,x=0,y=0,z=0,r=.035){const m=this.mesh(new RoundedBoxGeometry(w,h,d,1,r),color,parent);m.position.set(x,y,z);return m;}
 cyl(rt:number,rb:number,h:number,color:number,parent:T.Object3D,x=0,y=0,z=0,n=10){const m=this.mesh(new T.CylinderGeometry(rt,rb,h,n),color,parent);m.position.set(x,y,z);return m;}
 ball(size:number,color:number,parent:T.Object3D,x=0,y=0,z=0){const m=this.mesh(new T.IcosahedronGeometry(size,1),color,parent);m.position.set(x,y,z);return m;}
 label(text:string,w:number,h:number,color='#313b4c',bg?:string){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);}ctx.fillStyle=color;ctx.font='900 57px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,66);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map,transparent:true,side:T.DoubleSide,depthWrite:false}));return m;}
 segment(a:T.Vector3,b:T.Vector3,width:number,color:number,parent:T.Group){const m=this.box(width,1,width,color,parent);this.link(m,a,b);return m;}
 link(m:T.Mesh,a:T.Vector3,b:T.Vector3){m.position.copy(a).add(b).multiplyScalar(.5);m.scale.y=a.distanceTo(b);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());}
 buildMachine(){
  this.machine.position.set(-4.9,0,3.35);this.machine.rotation.y=-.3;
  for(const x of [-.76,.76]){this.box(.38,.42,2.25,INK,this.machine,x,.3,0,.17);for(let i=0;i<5;i++){const wheel=this.cyl(.17,.17,.4,0x76838a,this.machine,x,.32,-.8+i*.4,10);wheel.rotation.z=Math.PI/2;}for(let i=0;i<7;i++)this.box(.41,.07,.095,0x505c66,this.machine,x,.54,-.93+i*.3,.012);}
  this.machine.add(this.turret);this.box(1.6,.33,1.8,YELLOW,this.turret,0,.77,0,.15);this.box(.75,1.03,.96,YELLOW,this.turret,-.3,1.4,-.16,.13);this.box(.6,.64,.065,0x397888,this.turret,-.3,1.53,.34,.055);this.box(.055,.62,.76,0x478c99,this.turret,-.7,1.53,-.16);this.box(.9,.13,1.1,CREAM,this.turret,-.3,1.99,-.16,.07);this.cyl(.07,.08,.37,INK,this.turret,.56,1.05,-.55);this.ball(.13,0xf18b4d,this.turret,.21,1.05,-.61);
  const logo=this.label('RC',.48,.23);logo.rotation.y=-Math.PI/2;logo.position.set(-.825,.8,.15);this.turret.add(logo);
  this.arm1=this.box(.27,1,.31,YELLOW,this.boom);this.arm2=this.box(.2,1,.24,0xefaa35,this.boom);this.chain=this.box(.05,1,.05,INK,this.boom);this.claw=this.box(.42,.62,.48,INK,this.head);this.cyl(.22,.25,.14,YELLOW,this.head,0,.38,0);this.wreckBall=this.ball(.44,INK,this.head);this.wreckBall.visible=false;
  for(let i=0;i<3;i++){const stick=this.cyl(.075,.075,.44,0xed7056,this.charge,(i-1)*.12,0,0,8);stick.rotation.z=Math.PI/2;}this.box(.1,.2,.23,0x634e62,this.charge);this.cyl(.025,.025,.18,0xf1cc62,this.charge,0,.18,0,6);this.charge.visible=false;
 }
 buildCollector(){
  this.collector.position.set(9,0,5.5);this.collector.rotation.y=-Math.PI/2;
  this.box(1.4,.25,2.8,INK,this.collector,0,.48,0);this.box(1.5,.7,1.65,0x51b8b4,this.collector,0,.93,-.48,.1);this.box(1.24,.66,1.38,0x386e82,this.collector,0,1.06,-.48,.05);this.box(1.35,.95,1.03,0xf29b84,this.collector,0,1.03,.85,.12);this.box(1.11,.38,.04,0x315e75,this.collector,0,1.2,1.38);this.box(1.45,.12,1.1,CREAM,this.collector,0,1.56,.85);
  for(const x of [-.72,.72])for(const z of [-.88,.9]){const wheel=this.cyl(.3,.3,.2,INK,this.collector,x,.31,z,12);wheel.rotation.z=Math.PI/2;this.wheelMeshes.push(wheel);const hub=this.cyl(.15,.15,.215,CREAM,this.collector,x,.31,z,12);hub.rotation.z=Math.PI/2;}
 }
 tree(x:number,z:number,color:number){const g=new T.Group();g.position.set(x,0,z);this.root.add(g);this.cyl(.1,.16,1.15,0xb88862,g,0,.57,0,8);this.ball(.72,color,g,0,1.48,0).scale.y=1.2;this.ball(.45,color,g,.4,1.2,.2);this.cyl(.68,.75,.09,0xa8c89b,g,0,.045,0,16);}
 littleHouse(x:number,z:number,color:number,scale=1){const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(scale);this.root.add(g);this.box(2.3,1.9,2.1,color,g,0,.95,0,.08);this.box(2.5,.22,2.3,CREAM,g,0,1.95,0);for(const dx of [-.62,.62]){this.box(.64,.75,.05,0x548b9b,g,dx,1.07,1.08);this.box(.045,.75,.06,CREAM,g,dx,1.07,1.12);}this.box(.42,.8,.08,0xf3d56f,g,0,.41,1.11);return g;}
 rebuild(game:Demolition){
  this.stage=game.level;this.floors=game.config.floors;this.lastNeighbor='';this.clear(this.root);this.clear(this.building);this.clear(this.neighborSign);this.moduleMeshes.clear();for(const mesh of this.pieceMeshes.values()){this.scene.remove(mesh);mesh.geometry.dispose();}this.pieceMeshes.clear();this.clearFX();this.swing=null;this.angle=this.targetAngle=.72;const pal=THEMES[game.config.theme];this.renderer.setClearColor(pal.bg);this.scene.fog=new T.Fog(pal.bg,35,70);
  const ground=this.mesh(new T.PlaneGeometry(160,160),pal.bg,this.root);ground.rotation.x=-Math.PI/2;ground.position.y=-.31;ground.castShadow=false;
  this.box(20,.45,15,pal.ground,this.root,0,-.27,0,.6);this.box(9.2,.15,5.3,0xe5cab0,this.root,0,-.035,-.1,.18);
  this.box(22,.12,2.55,0xb7b8b1,this.root,0,-.07,5.6,.06);for(let x=-10;x<=10;x+=2)this.box(.9,.016,.07,CREAM,this.root,x,.006,5.8,.01);
  this.box(22,.1,.4,CREAM,this.root,0,.015,4.14,.03);
  // Bright safety fence, striped posts, cones and a little site sign.
  for(let x=-4.5;x<5;x+=1.2){for(const z of [-3.2,3.05]){if(z>0&&x<2.8)continue;const pole=this.cyl(.065,.065,.8,0xf5b746,this.root,x,.4,z,8);this.box(1.1,.22,.07,0xf4b94c,this.root,x+.55,.52,z,.025);}}
  for(const [x,z] of [[-3.3,3.2],[2.9,3.1],[4,3.2],[-6.7,2.9]]){this.box(.38,.05,.38,INK,this.root,x,.04,z);this.cyl(.035,.14,.4,0xf38650,this.root,x,.25,z,8);this.cyl(.09,.115,.08,CREAM,this.root,x,.2,z,8);}
  const sign=this.box(1.75,.9,.1,INK,this.root,-4.3,1.07,-2.65,.08);const label=this.label('RUBBLE CLUB',1.55,.36,'#ffe37d');label.position.set(-4.3,1.1,-2.58);this.root.add(label);for(const x of [-4.9,-3.7])this.box(.08,.8,.08,0xb18f6b,this.root,x,.4,-2.65);
  this.tree(-7.6,-2.7,0x80bf92);this.tree(-8.7,1,0x59a997);this.tree(8,-3.6,0xf2b884);this.tree(9,2,0x95c2a8);
  this.littleHouse(-7.5,-6,0xbda4d7,.8);this.littleHouse(-4.6,-7.4,0xeeb084,.65);this.littleHouse(7.8,-7,0x72bfcc,.85);
  for(let i=0;i<7;i++){const f=this.mesh(new T.ConeGeometry(.2,.45,3),[0xea8279,0x70b8bf,0xe9c561][i%3],this.root);f.position.set(-7+i*.65,3-Math.sin(i/6*Math.PI)*.4,-4.7);f.rotation.z=Math.PI;f.rotation.y=Math.PI/2;}
  if(game.config.protected){const p=game.neighborPosition;this.littleHouse(p.x,p.z,0xeb92ac);const porch=this.box(2.5,.12,.65,0x93b9b5,this.root,p.x,.1,p.z+1.3);const name=this.label('KEEP ME!',1.65,.32,'#fff6d5','#50797b');name.position.set(p.x,1.95,p.z+1.17);this.root.add(name);this.neighborSign.position.set(p.x,2.65,p.z);this.neighborSign.add(this.label('♥ 100%',1.5,.42,'#48616b','#fff5d8'));}
  for(const n of game.modules){
   const g=new T.Group();g.position.set(n.position.x,n.position.y,n.position.z);this.building.add(g);this.moduleMeshes.set(n.id,g);
   if(n.floor===0){this.box(.48,1.16,.48,n.reinforced?0x627888:YELLOW,g,0,-.03,0,.05);this.box(.91,.18,.91,CREAM,g,0,-.57,0);this.box(1.35,.14,1.35,pal.trim,g,0,.63,0);for(const z of [-.25,.25])for(let i=0;i<3;i++){const band=this.box(.5,.095,.015,0x4d5260,g,0,-.35+i*.24,z,.006);band.rotation.z=-.35;}if(n.reinforced)for(const x of [-.25,.25])this.box(.065,1.18,.065,CREAM,g,x,-.02,.255,.01);}
   else{
    const color=n.floor%2?pal.wall:new T.Color(pal.wall).lerp(new T.Color(CREAM),.16).getHex();this.box(1.33,1.19,1.33,color,g,0,-.03,0,.045);this.box(1.38,.13,1.38,CREAM,g,0,-.65,0,.025);
    for(const side of [-1,1]){this.box(.84,.83,.045,0x407f97,g,0,.015,side*.687,.035);this.box(.085,.83,.055,CREAM,g,0,.015,side*.718,.008);this.box(.97,.065,.075,CREAM,g,0,-.4,side*.714,.01);this.box(.045,.83,.84,0x508a9d,g,side*.687,.015,0,.035);this.box(.055,.83,.07,CREAM,g,side*.719,.015,0,.01);}
   }
   if(n.floor===game.config.floors-1){this.box(1.43,.19,1.43,pal.roof,g,0,.73,0,.065);if((n.col+n.row)%3===0)this.box(.35,.23,.4,pal.trim,g,0,.91,0);}
   const proxy=new T.Mesh(new T.BoxGeometry(1.4,1.43,1.4),new T.MeshBasicMaterial({visible:false}));proxy.userData.id=n.id;g.add(proxy);g.userData.proxy=proxy;
   const crackZ=n.floor===0?.272:.725,crackScale=n.floor===0?.55:1;const crackGeo=new T.BufferGeometry().setFromPoints([new T.Vector3(-.35*crackScale,.48,crackZ),new T.Vector3(.08*crackScale,.15,crackZ),new T.Vector3(-.13*crackScale,-.12,crackZ),new T.Vector3(.3*crackScale,-.48,crackZ)]);const crack=new T.Line(crackGeo,new T.LineBasicMaterial({color:INK,transparent:true,opacity:.8}));crack.visible=false;g.add(crack);g.userData.crack=crack;
  }
  this.collector.position.x=9;this.resize();
 }
 pick(x:number,y:number,game:Demolition){const r=this.renderer.domElement.getBoundingClientRect();this.mouse.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);this.ray.setFromCamera(this.mouse,this.camera);const meshes=game.modules.filter(n=>n.state==='standing').map(n=>this.moduleMeshes.get(n.id)?.userData.proxy).filter(Boolean);return this.ray.intersectObjects(meshes,false)[0]?.object.userData.id??-1;}
 orbit(delta:number){this.targetAngle+=delta;}
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight,aspect=w/h,span=aspect<.8?18+Math.max(0,this.floors-3)*1.2:aspect<1.2?16:12+Math.max(0,this.floors-3)*.65;this.camera.left=-span*aspect/2;this.camera.right=span*aspect/2;this.camera.top=span/2;this.camera.bottom=-span/2;this.camera.near=.5;this.camera.far=100;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);}
 burst(p:Vec,color:number,count=12,power=2){for(let i=0;i<count&&this.fx.length<160;i++){const mesh=this.mesh(new T.BoxGeometry(.1,.1,.1),color,this.scene);mesh.position.set(p.x,p.y,p.z);mesh.castShadow=false;mesh.receiveShadow=false;const life=.45+Math.random()*.55;this.fx.push({mesh,vel:new T.Vector3((Math.random()-.5)*power,1+Math.random()*power,(Math.random()-.5)*power),life,max:life,spin:Math.random()*4});}}
 event(e:Event,game:Demolition){
  if(e.type==='swing'&&e.position)this.swing={position:new T.Vector3(e.position.x,e.position.y,e.position.z),tool:e.tool!,age:0,duration:e.tool==='blast'?1.25:e.tool==='ball'?.85:.5};
  if(e.type==='hit'){this.shake=this.reduced?0:.1;this.burst(e.position!,YELLOW,10,e.tool==='blast'?4:2);}
  if(e.type==='break')this.burst(e.position!,THEMES[game.config.theme].trim,6,2);
  if(e.type==='impact')this.burst(e.position!,0xe9d6b1,4,.6);
  if(e.type==='collect'&&Math.random()<.12)this.burst({x:this.collector.position.x,y:1.5,z:5.5},YELLOW,3,1.5);
  if(e.type==='win')for(const color of [0xf08183,0x66bfc9,YELLOW,0xb69bd5])this.burst({x:0,y:3,z:0},color,20,6);
 }
 update(game:Demolition,dt:number,alpha=1){
  if(this.stage!==game.level)this.rebuild(game);this.time+=dt;this.shake=Math.max(0,this.shake-dt);this.angle=T.MathUtils.lerp(this.angle,this.targetAngle,1-Math.exp(-dt*8));
  const look=new T.Vector3(0,game.config.floors>=4?2.4:1.65,.4);this.camera.position.set(Math.sin(this.angle)*16,12,Math.cos(this.angle)*16);this.camera.lookAt(look);
  const toolStart=new T.Vector3(-4.65,1.15,3.2),rest=new T.Vector3(-3.2,1.2,2.4);let target=rest.clone();
  if(this.swing){this.swing.age+=dt;const {age,duration,tool,position}=this.swing,t=Math.min(1,age/duration),hit=tool==='blast'?.72:.46;const travel=t<hit?t/hit:1-(t-hit)/(1-hit);target.lerpVectors(rest,position,Math.max(0,travel));target.y+=Math.sin(Math.min(1,travel)*Math.PI)*(tool==='ball'?2:.9);if(age>=duration)this.swing=null;}
  const elbow=toolStart.clone().lerp(target,.48);elbow.y=Math.max(3.25,target.y+1.1);this.link(this.arm1,toolStart,elbow);this.link(this.arm2,elbow,target.clone().add(new T.Vector3(0,.45,0)));this.head.position.copy(target);this.head.rotation.x=this.swing?Math.sin(this.swing.age*12)*.15:0;
  this.chain.visible=this.swing?.tool==='ball';this.claw.visible=this.swing?.tool!=='ball';this.wreckBall.visible=this.swing?.tool==='ball';this.head.visible=this.swing?.tool!=='blast';this.charge.visible=this.swing?.tool==='blast';if(this.charge.visible&&this.swing){const t=Math.min(1,this.swing.age/.5);this.charge.position.lerpVectors(rest,this.swing.position,t);this.charge.position.y+=Math.sin(t*Math.PI)*2+.15;this.charge.rotation.y=this.time*2;}if(this.chain.visible)this.link(this.chain,target.clone().add(new T.Vector3(0,1.25,0)),target);
  this.turret.rotation.y=this.swing?Math.atan2(target.x-toolStart.x,target.z-toolStart.z)*.2:0;
  for(const n of game.modules){const g=this.moduleMeshes.get(n.id)!;g.visible=n.state!=='rubble';if(!g.visible||!n.body)continue;const p=n.body.translation(),r=n.body.rotation();g.position.set(T.MathUtils.lerp(n.previous.x,p.x,alpha),T.MathUtils.lerp(n.previous.y,p.y,alpha),T.MathUtils.lerp(n.previous.z,p.z,alpha));g.quaternion.set(n.rotation.x,n.rotation.y,n.rotation.z,n.rotation.w).slerp(new T.Quaternion(r.x,r.y,r.z,r.w),alpha);g.userData.crack.visible=n.hp<n.maxHp*.85;}
  const colors=[THEMES[game.config.theme].wall,THEMES[game.config.theme].trim,CREAM,THEMES[game.config.theme].roof];
  for(const p of game.pieces){let mesh=this.pieceMeshes.get(p.id);if(!mesh){mesh=this.box(p.size*2,p.size*1.3,p.size*1.4,colors[p.color%4],this.scene);this.pieceMeshes.set(p.id,mesh);}if(p.collectAt>=0){const t=Math.min(1,(game.cleanupTime-p.collectAt)/.8);mesh.position.set(p.origin.x,p.origin.y,p.origin.z).lerp(new T.Vector3(this.collector.position.x,1.35,5.5),t);mesh.position.y+=Math.sin(t*Math.PI)*2;mesh.scale.setScalar(1-t*.9);mesh.visible=t<1;}else if(p.body){const pos=p.body.translation(),rot=p.body.rotation();mesh.position.set(T.MathUtils.lerp(p.previous.x,pos.x,alpha),T.MathUtils.lerp(p.previous.y,pos.y,alpha),T.MathUtils.lerp(p.previous.z,pos.z,alpha));mesh.quaternion.set(p.rotation.x,p.rotation.y,p.rotation.z,p.rotation.w).slerp(new T.Quaternion(rot.x,rot.y,rot.z,rot.w),alpha);}}
  const selected=game.modules.find(n=>n.id===this.targetId&&n.state==='standing');this.hover.visible=!!selected&&game.phase==='active';if(selected){const p=selected.position;this.hover.box.min.set(p.x-.715,p.y-.72,p.z-.715);this.hover.box.max.set(p.x+.715,p.y+.77,p.z+.715);}
  if(game.phase==='cleanup'||game.phase==='won'){this.collector.position.x=T.MathUtils.lerp(this.collector.position.x,3.2,1-Math.exp(-dt*1.8));for(const w of this.wheelMeshes)w.rotation.x-=dt*(this.collector.position.x>3.3?4:0);}
  if(game.config.protected){const label=`♥ ${Math.round(game.neighbor)}%`;if(label!==this.lastNeighbor){this.clear(this.neighborSign);this.neighborSign.add(this.label(label,1.5,.42,game.neighbor<90?'#a35142':'#48616b','#fff5d8'));this.lastNeighbor=label;}}
  for(const f of [...this.fx]){f.life-=dt;f.vel.y-=dt*7;f.mesh.position.addScaledVector(f.vel,dt);f.mesh.rotation.x+=dt*f.spin;f.mesh.scale.setScalar(Math.max(0,f.life/f.max));if(f.life<=0){this.scene.remove(f.mesh);f.mesh.geometry.dispose();this.fx.splice(this.fx.indexOf(f),1);}}
  this.renderer.render(this.scene,this.camera);
 }
 clear(g:T.Group){g.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){o.geometry.dispose();const m=o.material;if(m instanceof T.MeshBasicMaterial){m.map?.dispose();m.dispose();}else if(m instanceof T.LineBasicMaterial)m.dispose();}});g.clear();}
 clearFX(){for(const f of this.fx){this.scene.remove(f.mesh);f.mesh.geometry.dispose();}this.fx=[];}
 reset(){this.stage=-1;this.targetId=-1;this.swing=null;}
}
