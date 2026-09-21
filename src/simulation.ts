import R from '@dimforge/rapier3d-compat';
export type Vec={x:number;y:number;z:number};
export type Tool='breaker'|'ball'|'blast';
export type Upgrade='power'|'reach'|'salvage';
export type Phase='active'|'cleanup'|'won'|'failed';
export interface Profile{coins:number;unlocked:number;stars:number[];upgrades:Record<Upgrade,number>}
export const freshProfile=():Profile=>({coins:0,unlocked:0,stars:Array(9).fill(0),upgrades:{power:0,reach:0,salvage:0}});
export const TOOLS={breaker:{name:'Breaker',cost:1,unlock:0,delay:.2,cooldown:.44},ball:{name:'Wrecking ball',cost:3,unlock:2,delay:.4,cooldown:.85},blast:{name:'Dynamite',cost:4,unlock:4,delay:.9,cooldown:1.2}} as const;
export const UPGRADE_COSTS={power:[120,230,380],reach:[100,200,330],salvage:[90,170,280]};
export const LEVELS=[
 {name:'Peach Corner',area:'CORAL QUARTER',cols:2,depth:2,floors:2,hp:65,energy:12,par:30,theme:0,protected:false,reward:140,brief:'Start at the striped supports. Watch the floors follow.'},
 {name:'Bluebell Bakery',area:'BLUEBELL BLOCK',cols:2,depth:2,floors:3,hp:78,energy:13,par:34,theme:1,protected:false,reward:175,brief:'One more floor. The bottom of a stack is the best place to start.'},
 {name:'Lemon Arcade',area:'CITRUS SQUARE',cols:3,depth:2,floors:3,hp:92,energy:18,par:38,theme:2,protected:false,reward:210,brief:'Meet the wrecking ball. A wider swing catches nearby supports.'},
 {name:'Mint & Co.',area:'GARDEN DISTRICT',cols:3,depth:2,floors:3,hp:105,energy:19,par:40,theme:3,protected:true,reward:245,brief:'Keep the pink neighbor safe. Aim your big swings away from it.'},
 {name:'Apricot Hotel',area:'SUNSET AVENUE',cols:3,depth:2,floors:4,hp:125,energy:22,par:43,theme:0,protected:false,reward:280,brief:'Dynamite is ready. One charge, one satisfying chain reaction.'},
 {name:'Violet Works',area:'LILAC LANE',cols:3,depth:2,floors:4,hp:145,energy:24,par:46,theme:4,protected:true,reward:315,brief:'Reinforced corners. Upgrade your power and choose your shots.'},
 {name:'Poolside Plaza',area:'TURQUOISE TERRACE',cols:4,depth:2,floors:4,hp:160,energy:28,par:49,theme:1,protected:true,reward:350,brief:'A wider footprint. Rotate the view to reach the back row.'},
 {name:'Candy Heights',area:'PINK SKYLINE',cols:4,depth:2,floors:5,hp:180,energy:30,par:53,theme:5,protected:true,reward:385,brief:'Five colorful floors. Keep the neighboring shop above 75%.'},
 {name:'The Grand Crunch',area:'CONFETTI DISTRICT',cols:4,depth:2,floors:5,hp:205,energy:32,par:57,theme:2,protected:true,reward:450,brief:'Your biggest job. Strong supports, a tight budget, one tiny crew.'},
] as const;
export interface Module {id:number;col:number;row:number;floor:number;position:Vec;hp:number;maxHp:number;state:'standing'|'falling'|'rubble';body:R.RigidBody|null;previous:Vec;rotation:{x:number;y:number;z:number;w:number};fallTime:number;reinforced:boolean}
export interface Piece {id:number;body:R.RigidBody|null;size:number;color:number;previous:Vec;rotation:{x:number;y:number;z:number;w:number};collectAt:number;origin:Vec;struckNeighbor:boolean}
export interface Event {type:'swing'|'hit'|'break'|'collapse'|'impact'|'danger'|'collect'|'win'|'fail';position?:Vec;id?:number;amount?:number;tool?:Tool}
export function sanitizeProfile(input:unknown):Profile{const p=freshProfile();if(!input||typeof input!=='object')return p;const d=input as Partial<Profile>;p.coins=Number.isFinite(d.coins)?Math.max(0,Math.min(999999,Math.floor(d.coins!))):0;p.unlocked=Number.isFinite(d.unlocked)?Math.max(0,Math.min(8,Math.floor(d.unlocked!))):0;if(Array.isArray(d.stars))p.stars=Array.from({length:9},(_,i)=>Number.isFinite(d.stars![i])?Math.max(0,Math.min(3,Math.floor(d.stars![i]))):0);for(const k of Object.keys(p.upgrades) as Upgrade[]){const n=d.upgrades?.[k];p.upgrades[k]=Number.isFinite(n)?Math.max(0,Math.min(3,Math.floor(n!))):0;}return p;}
export function buyUpgrade(p:Profile,key:Upgrade){const rank=p.upgrades[key],cost=UPGRADE_COSTS[key][rank];if(cost===undefined||p.coins<cost)return false;p.coins-=cost;p.upgrades[key]++;return true;}
export function award(p:Profile,level:number,stars:number){if(stars<1||level<0||level>=9)return 0;const first=p.stars[level]===0,bonus=Math.max(0,stars-p.stars[level])*20;const coins=Math.round((first?LEVELS[level].reward:45)*(1+p.upgrades.salvage*.15))+bonus;p.coins+=coins;p.stars[level]=Math.max(p.stars[level],stars);p.unlocked=Math.max(p.unlocked,Math.min(8,level+1));return coins;}
export class Demolition {
 world:R.World;modules:Module[]=[];pieces:Piece[]=[];events:Event[]=[];phase:Phase='active';paused=false;energy:number;elapsed=0;cooldown=0;cleanupTime=0;stars=0;neighbor=100;hits=0;chain=0;maxChain=0;impact=0;nextPiece=1;lastGroundSound=0;
 pending:{id:number;tool:Tool;time:number;position:Vec}|null=null;queue:R.EventQueue;neighborCollider:number|null=null;neighborHits=new Set<number>();
 level:number;profile:Profile;
 constructor(level:number,profile:Profile=freshProfile()){
  this.level=level;this.profile=profile;
  if(!Number.isInteger(level)||level<0||level>=LEVELS.length)throw new RangeError('Unknown site');
  this.energy=this.config.energy;this.world=new R.World({x:0,y:-12,z:0});this.queue=new R.EventQueue(true);
  const ground=this.world.createRigidBody(R.RigidBodyDesc.fixed());this.world.createCollider(R.ColliderDesc.cuboid(35,.2,35).setTranslation(0,-.2,0).setFriction(.8),ground);
  for(let f=0;f<this.config.floors;f++)for(let r=0;r<this.config.depth;r++)for(let c=0;c<this.config.cols;c++){
   const position={x:(c-(this.config.cols-1)/2)*1.42,y:.7+f*1.43,z:(r-.5)*1.42};const reinforced=level>=5&&f===0&&c===0;
   const hp=this.config.hp*(f===0?(reinforced?1.18:1):.62);
   const body=this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(position.x,position.y,position.z));
   this.world.createCollider(R.ColliderDesc.cuboid(.665,.69,.665).setMass(4).setFriction(.65).setRestitution(.04),body);
   this.modules.push({id:this.modules.length+1,col:c,row:r,floor:f,position,hp,maxHp:hp,state:'standing',body,previous:{...position},rotation:{x:0,y:0,z:0,w:1},fallTime:0,reinforced});
  }
  if(this.config.protected){const p=this.neighborPosition,b=this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(p.x,1.1,p.z));this.neighborCollider=this.world.createCollider(R.ColliderDesc.cuboid(1.15,1.1,1.25).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(18),b).handle;}
 }
 get config(){return LEVELS[this.level];}
 get neighborPosition(){return {x:this.config.cols*.71+2.35,y:0,z:.1};}
 get progress(){return 1-this.modules.filter(n=>n.state==='standing').length/this.modules.length;}
 get power(){return 52*(1+this.profile.upgrades.power*.22);}
 radius(tool:Tool){return tool==='breaker'?0:tool==='ball'?1.52+this.profile.upgrades.reach*.14:2.05+this.profile.upgrades.reach*.17;}
 canUse(tool:Tool){return this.profile.unlocked>=TOOLS[tool].unlock;}
 strike(id:number,tool:Tool){
  if(this.phase!=='active'||this.paused||this.cooldown>0||this.pending||!this.canUse(tool)||this.energy<TOOLS[tool].cost)return false;
  const node=this.modules.find(n=>n.id===id&&n.state==='standing');if(!node)return false;
  this.energy-=TOOLS[tool].cost;this.hits++;this.cooldown=TOOLS[tool].cooldown;this.pending={id,tool,time:TOOLS[tool].delay,position:{...node.position}};this.events.push({type:'swing',position:node.position,id,tool});return true;
 }
 impactTarget(id:number,tool:Tool,position:Vec){
  const radius=this.radius(tool),power=this.power*(tool==='ball'?.88:tool==='blast'?1.45:1);this.chain=0;
  const targets=this.modules.filter(n=>n.state==='standing'&&(n.id===id||radius>0&&Math.hypot(n.position.x-position.x,n.position.y-position.y,n.position.z-position.z)<radius));
  for(const n of targets){const distance=Math.hypot(n.position.x-position.x,n.position.y-position.y,n.position.z-position.z);n.hp=Math.max(0,n.hp-power*(n.id===id?1:Math.max(.6,1-distance/radius*.25)));if(n.hp===0)this.breakModule(n,tool==='blast'?3.4:2);}
  this.events.push({type:'hit',position,tool,amount:targets.length});this.impact=tool==='blast'?.3:.16;
  if(this.config.protected&&radius>0){const p=this.neighborPosition,edge=Math.max(0,Math.hypot(position.x-p.x,position.z-p.z)-1.15);if(edge<radius){const damage=(radius-edge)*(tool==='blast'?28:12);this.neighbor=Math.max(0,this.neighbor-damage);this.events.push({type:'danger',amount:damage});}}
  this.propagate();this.maxChain=Math.max(this.maxChain,this.chain);
 }
 breakModule(n:Module,force=1){
  if(n.state==='rubble')return;const pos=n.body?{...n.body.translation()}:n.position;
  if(n.body)this.world.removeRigidBody(n.body);n.body=null;n.state='rubble';this.spawnPieces(pos,n.floor,force);this.chain++;this.events.push({type:'break',position:pos,id:n.id});
 }
 propagate(){
  // A room is carried by the room directly beneath it. Removing a ground
  // support starts a visible, delayed cascade up that column.
  for(const n of this.modules)if(n.floor>0&&n.state==='standing'){
   const below=this.modules.find(b=>b.col===n.col&&b.row===n.row&&b.floor===n.floor-1);
   if(below?.state!=='standing'){
    n.state='falling';n.fallTime=0;n.body!.setBodyType(R.RigidBodyType.Dynamic,true);n.body!.setLinearDamping(.18);n.body!.setAngularDamping(.35);
    n.body!.applyImpulse({x:-Math.sign(n.position.x||1)*.5,y:.1,z:n.row===0?.6:-.6},true);n.body!.applyTorqueImpulse({x:(n.row===0?1:-1)*.7,y:.15,z:.6},true);
    this.chain++;this.events.push({type:'collapse',position:n.position,id:n.id});
   }
  }
 }
 spawnPieces(p:Vec,color:number,force:number){
  const count=4;
  for(let i=0;i<count;i++){
   const size=.36+(i%2)*.09,pos={x:p.x+(i%2?1:-1)*.3,y:p.y+.06,z:p.z+(i<2?-1:1)*.3};
   const body=this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos.x,pos.y,pos.z).setLinearDamping(.6).setAngularDamping(.7).setCcdEnabled(true));
   this.world.createCollider(R.ColliderDesc.cuboid(size,size*.65,size*.7).setMass(.45).setFriction(.85).setRestitution(.12),body);
   body.setLinvel({x:(i%2?1:-1)*force*.36,y:force*.7,z:(i<2?-1:1)*force*.42},true);body.setAngvel({x:1+i*.25,y:.5,z:-.8},true);
   this.pieces.push({id:this.nextPiece++,body,size,color,previous:pos,rotation:{x:0,y:0,z:0,w:1},collectAt:-1,origin:pos,struckNeighbor:false});
  }
 }
 tick(dt:number){
  if(this.paused||this.phase==='won'||this.phase==='failed')return;
  this.cooldown=Math.max(0,this.cooldown-dt);this.impact=Math.max(0,this.impact-dt);this.lastGroundSound=Math.max(0,this.lastGroundSound-dt);
  if(this.phase==='active'&&this.hits>0)this.elapsed+=dt;
  if(this.pending){this.pending.time-=dt;if(this.pending.time<=0){const {id,tool,position}=this.pending;this.pending=null;this.impactTarget(id,tool,position);}}
  for(const n of this.modules)if(n.body){n.previous={...n.body.translation()};n.rotation={...n.body.rotation()};}
  for(const p of this.pieces)if(p.body){p.previous={...p.body.translation()};p.rotation={...p.body.rotation()};}
  this.world.timestep=dt;this.world.step(this.queue);
  this.queue.drainContactForceEvents(e=>{
   if(this.neighborCollider===null)return;const other=e.collider1()===this.neighborCollider?e.collider2():e.collider2()===this.neighborCollider?e.collider1():null;
   if(other===null||this.neighborHits.has(other)||e.totalForceMagnitude()<25)return;
   this.neighborHits.add(other);const damage=Math.min(5,e.totalForceMagnitude()/400);this.neighbor=Math.max(0,this.neighbor-damage);this.events.push({type:'danger',amount:damage});
  });
  for(const n of this.modules)if(n.state==='falling'&&n.body){n.fallTime+=dt;const p=n.body.translation();if(p.y<.95&&n.fallTime>.2||n.fallTime>2.2){this.breakModule(n,.8);if(this.lastGroundSound===0){this.events.push({type:'impact',position:{...p}});this.lastGroundSound=.12;}}}
  if(this.neighbor<75){this.phase='failed';this.events.push({type:'fail'});return;}
  if(this.phase==='active'){
   if(this.progress===1&&!this.pending){this.phase='cleanup';this.cooldown=0;}
   else if(this.energy===0&&!this.pending&&this.cooldown===0){this.phase='failed';this.events.push({type:'fail'});}
  }
  if(this.phase==='cleanup'){
   this.cleanupTime+=dt;
   if(this.cleanupTime>2.4){let count=0;for(const p of this.pieces)if(p.collectAt<0){count++;if(count>Math.ceil((1+this.profile.upgrades.salvage*.4)*2))break;p.collectAt=this.cleanupTime;p.origin=p.body?{...p.body.translation()}:p.previous;if(p.body)this.world.removeRigidBody(p.body);p.body=null;this.events.push({type:'collect',position:p.origin});}}
   if(this.cleanupTime>4&&this.pieces.every(p=>p.collectAt>=0&&this.cleanupTime-p.collectAt>1.1)&&this.modules.every(n=>n.state==='rubble')){this.phase='won';this.stars=1+Number(this.neighbor>=95)+Number(this.neighbor>=95&&this.elapsed<=this.config.par&&this.energy>=Math.floor(this.config.energy*.15));this.events.push({type:'win'});}
  }
 }
 dispose(){this.queue.free();this.world.free();}
 snapshot(){return {level:this.level+1,phase:this.phase,energy:this.energy,progress:this.progress,neighbor:this.neighbor,elapsed:this.elapsed,stars:this.stars,modules:this.modules.map(n=>({id:n.id,floor:n.floor,col:n.col,row:n.row,state:n.state,hp:n.hp})),debris:this.pieces.length};}
}
export async function initPhysics(){await R.init();}
