import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Every surface, animal, and light is geometry or an analytic shader. No image assets.
const root = document.querySelector('#lake');
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }); }
catch { document.querySelector('#unavailable').hidden = false; throw new Error('WebGL 2 is unavailable.'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
root.append(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, .08, 430);
camera.position.set(0, -.6, 20);
const clock = new THREE.Clock();
let seed = 8731;
function rand() { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; }
const range = (a, b) => a + (b - a) * rand();
const shared = { uTime: { value: 0 }, uFlow: { value: 0 }, uCamera: { value: camera.position }, uDensity: { value: .85 } };
const sun = new THREE.Vector3(-24, 13, -78);

const noiseGLSL = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float fbm(vec2 p){return .53*noise(p)+.27*noise(p*2.03)+.13*noise(p*4.07)+.07*noise(p*8.11);}
`;

// The water's depth, the sunlit opening, and distant amber clouds share one atmosphere.
const sky = new THREE.Mesh(new THREE.SphereGeometry(390, 32, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { ...shared, uSun: { value: sun } },
  vertexShader: `varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader: `${noiseGLSL} uniform float uTime;uniform vec3 uCamera,uSun;varying vec3 vWorld;
  void main(){vec3 d=normalize(vWorld-uCamera);float elevation=smoothstep(-.65,.7,d.y);
  vec3 color=mix(vec3(.006,.075,.095),vec3(.048,.28,.24),elevation);
  float light=pow(max(0.,dot(d,normalize(uSun-uCamera))),9.);
  color+=vec3(.14,.22,.09)*light;
  float clouds=fbm(d.xz*9.+d.y*3.);color+=vec3(.12,.105,.025)*smoothstep(.4,.78,clouds)*(1.-abs(d.y))*.45;
  color+=vec3(.25,.29,.1)*pow(max(0.,dot(d,normalize(uSun-uCamera))),75.);
  gl_FragColor=vec4(color,1.);}`
}));
scene.add(sky);

// An undulating ceiling: submerged reflections, ripples, and the green canopy beyond.
const surface = new THREE.Mesh(new THREE.PlaneGeometry(650, 650, 120, 120), new THREE.ShaderMaterial({
  side: THREE.DoubleSide, uniforms: shared,
  vertexShader: `uniform float uTime;varying vec3 vP;void main(){vec3 p=position;p.z+=sin(p.x*.13+uTime*.24)*.13+sin(p.y*.18-uTime*.18)*.17;vec4 w=modelMatrix*vec4(p,1.);vP=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader: `${noiseGLSL} uniform float uTime;uniform vec3 uCamera;varying vec3 vP;
  void main(){vec2 p=vP.xz;vec2 w=p+vec2(sin(p.y*.19+uTime*.33),sin(p.x*.23-uTime*.21))*1.5;
  float dist=length((w-vec2(-16,-45))*vec2(.82,1.));
  float canopy=smoothstep(40.,89.,dist+fbm(w*.07)*30.);
  float leaves=fbm(w*.24+fbm(w*.048)*6.);
  vec3 green=mix(vec3(.018,.12,.068),vec3(.22,.37,.075),leaves);
  vec3 open=mix(vec3(.07,.32,.24),vec3(.3,.49,.27),fbm(w*.045));
  vec3 color=mix(open,green,canopy*.91);
  float ripple=pow(1.-abs(sin(w.x*.6+w.y*.37+sin(w.y*.45+uTime*.25)*1.4)),10.);
  float veins=pow(1.-abs(sin(w.x*.27-w.y*.38+fbm(w*.2)*6.+uTime*.18)),16.);
  color+=vec3(.22,.29,.12)*(ripple*.15+veins*.2);
  float glow=exp(-length((p-vec2(-24,-78))*.043));color+=vec3(.26,.30,.11)*glow;
  float fog=1.-exp(-distance(vP,uCamera)*.005);color=mix(color,vec3(.09,.43,.38),fog*.65);
  gl_FragColor=vec4(color,1.);}`
}));
surface.rotation.x = -Math.PI / 2;
surface.position.y = 12;
scene.add(surface);

// A medusa combines a scalloped dome, four glowing internal lobes, and ruffled oral arms.
function medusaGeometry(radial = 24, rows = 13, arms = true) {
  const pos=[], norm=[], uv=[], part=[], indices=[];
  const push=(x,y,z,nx,ny,nz,u,v,p)=>{pos.push(x,y,z);norm.push(nx,ny,nz);uv.push(u,v);part.push(p);};
  for(let j=0;j<=rows;j++){
    const t=j/rows, a=t*Math.PI*.52;
    for(let i=0;i<=radial;i++){
      const u=i/radial, p=u*Math.PI*2, r=Math.sin(a)*(1.+Math.pow(t,8)*(.045*Math.cos(p*16.)));
      push(Math.cos(p)*r,Math.cos(a)*.72+.14,Math.sin(p)*r,Math.cos(p)*Math.sin(a),Math.cos(a),Math.sin(p)*Math.sin(a),u,t,0);
    }
  }
  for(let j=0;j<rows;j++)for(let i=0;i<radial;i++){const a=j*(radial+1)+i,b=a+radial+1;indices.push(a,b,a+1,b,b+1,a+1);}
  // Inner lobes are actual geometry rather than just a painted disc.
  const lobes=arms?4:0;
  for(let k=0;k<lobes;k++){
    const start=pos.length/3, seg=8, rings=6;
    const phi=k/lobes*Math.PI*2;
    for(let j=0;j<=rings;j++)for(let i=0;i<=seg;i++){
      const a=j/rings*Math.PI,b=i/seg*Math.PI*2;
      push(Math.cos(phi)*.25+Math.sin(a)*Math.cos(b)*.19,.2+Math.cos(a)*.22,Math.sin(phi)*.25+Math.sin(a)*Math.sin(b)*.19,Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b),i/seg,j/rings,2);
    }
    for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){const a=start+j*(seg+1)+i,b=a+seg+1;indices.push(a,b,a+1,b,b+1,a+1);}
  }
  const armCount=arms?7:4, armRows=arms?12:4, armSides=arms?5:3;
  for(let k=0;k<armCount;k++){
    const start=pos.length/3,phi=k/armCount*Math.PI*2;
    for(let j=0;j<=armRows;j++)for(let i=0;i<=armSides;i++){
      const t=j/armRows,p=i/armSides*Math.PI*2;
      const r=(.095*(1.-t)+.016)*(1.+Math.sin(t*62.+k)*.35), spread=.23+t*.18;
      push(Math.cos(phi)*spread+Math.cos(p)*r,-t*(1.13+(k%3)*.17)+.1,Math.sin(phi)*spread+Math.sin(p)*r,Math.cos(p),.1,Math.sin(p),i/armSides,t,1);
    }
    for(let j=0;j<armRows;j++)for(let i=0;i<armSides;i++){const a=start+j*(armSides+1)+i,b=a+armSides+1;indices.push(a,b,a+1,b,b+1,a+1);}
  }
  const g=new THREE.InstancedBufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('part',new THREE.Float32BufferAttribute(part,1));g.setIndex(indices);return g;
}

const motionGLSL=`
uniform float uTime,uFlow,uDensity;uniform vec3 uCamera;
attribute vec3 aOffset;attribute vec4 aData;
varying float vSeed,vDistance,vTouch,vPart,vPulse;varying vec3 vNormal,vWorld;varying vec2 vUv;
vec3 jellyCenter(){
  vec3 c=aOffset;
  c.z=mod(c.z-uFlow*(.16+aData.z*.065)+610.,400.)-210.;
  c.x+=sin(c.z*.021+uTime*.025)*4.;
  c.y+=sin(uTime*.55+aData.y)*.22;
  vec3 delta=c-uCamera;float d=length(delta);float reach=2.8+aData.x;
  c+=normalize(delta+vec3(.0001))*(1.-smoothstep(.4,reach,d))*1.9;
  return c;
}`;
function jellyMaterial(near){return new THREE.ShaderMaterial({
  uniforms:shared,transparent:true,depthWrite:false,side:THREE.DoubleSide,
  vertexShader:`attribute float part;${motionGLSL}
  void main(){
    vec3 center=jellyCenter();vTouch=1.-smoothstep(1.5,5.,distance(center,uCamera));
    float pulse=sin(uTime*(1.14+aData.z*.15)+aData.y);vPulse=pulse;
    vec3 p=position;float squeeze=1.-.105*pow(.5+.5*pulse,2.);
    p.xz*=squeeze;p.y*=1.+.09*pulse;
    if(part>.5&&part<1.5){float t=uv.y;p.x+=sin(t*5.+uTime*.86+aData.y)*t*.16;p.z+=cos(t*4.-uTime*.72+aData.y)*t*.12;}
    float tilt=sin(aData.y+uTime*.13)*.12;
    p.xy=mat2(cos(tilt),-sin(tilt),sin(tilt),cos(tilt))*p.xy;
    vec3 w=center+p*aData.x;
    vWorld=w;vNormal=normal;vUv=uv;vPart=part;vSeed=aData.z;vDistance=distance(w,uCamera);
    gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);
    ${near?'':'if(vDistance<24.)gl_Position=vec4(2.,2.,2.,1.);'}
    if(aData.w>uDensity)gl_Position=vec4(2.,2.,2.,1.);
  }`,
  fragmentShader:`uniform vec3 uCamera;uniform float uTime;varying float vSeed,vDistance,vTouch,vPart,vPulse;varying vec3 vNormal,vWorld;varying vec2 vUv;
  void main(){
    vec3 eye=normalize(uCamera-vWorld);float fres=pow(1.-abs(dot(normalize(vNormal),eye)),2.8);
    float rim=pow(smoothstep(.79,1.,vUv.y),3.);
    vec3 amber=mix(vec3(.56,.16,.014),vec3(1.,.49,.055),vSeed*.45+.25);
    float caustic=pow(.5+.5*sin(vWorld.x*2.4+vWorld.z*1.6+uTime*.7+sin(vWorld.z*2.)),8.);
    vec3 c=amber*(.75+fres*.67)+vec3(1.,.66,.22)*(fres*.30+rim*.24+caustic*.13);
    float alpha=${near?'.36':'.61'}+fres*.40+rim*.24;
    if(vPart>1.5){c=vec3(1.,.46,.065)*(.86+vSeed*.28);alpha=.82;}
    else if(vPart>.5){c=mix(amber,vec3(1.,.83,.39),.24+vUv.y*.22);alpha=.52*(1.-vUv.y*.4);}
    c+=vec3(.7,.39,.10)*vTouch;
    float fog=1.-exp(-vDistance*.012);vec3 water=mix(vec3(.007,.11,.13),vec3(.048,.28,.23),smoothstep(-17.,12.,vWorld.y));
    c=mix(c,water,fog);alpha*=1.-smoothstep(135.,245.,vDistance);
    ${near?'alpha*=smoothstep(.8,1.7,vDistance);':''}
    gl_FragColor=vec4(c,alpha);
  }`
});}

function populate(g,count,near){
  const offsets=new Float32Array(count*3), data=new Float32Array(count*4);
  for(let i=0;i<count;i++){
    let z=near?range(-105,82):range(-210,190), river=rand()<.79;
    let x=river?(range(-1,1)+range(-1,1))* (near?24:45)-10+Math.sin(z*.021)*9:range(-145,145);
    let y=range(-23,10.5);
    if(near&&i<18){x=range(-10,10);y=range(-5,8);z=range(4,14);}
    offsets.set([x,y,z],i*3);
    const size=near?range(.3,.93)*(rand()<.045?1.6:1):range(.22,.68);
    data.set([size,range(0,Math.PI*2),rand(),rand()],i*4);
  }
  g.setAttribute('aOffset',new THREE.InstancedBufferAttribute(offsets,3));
  g.setAttribute('aData',new THREE.InstancedBufferAttribute(data,4));g.instanceCount=count;
  const mesh=new THREE.Mesh(g,jellyMaterial(near));mesh.frustumCulled=false;mesh.renderOrder=near?4:3;scene.add(mesh);return mesh;
}
const mid=populate(medusaGeometry(9,5,false),12500,false);
const near=populate(medusaGeometry(18,9,true),1800,true);

// A million warm pinpricks carry the bloom beyond readable geometry. Shader LOD
// removes nearby particles so they never replace the detailed translucent bells.
const hazeCount=1080000;
const hazePos=new Float32Array(hazeCount*3),hazeData=new Float32Array(hazeCount*2);
for(let i=0;i<hazeCount;i++){
  const z=range(-310,190), river=rand()<.88;
  const x=river?(range(-1,1)+range(-1,1))*56-13+Math.sin(z*.021)*12:range(-200,200);
  hazePos.set([x,range(-35,11),z],i*3);hazeData.set([rand(),rand()],i*2);
}
const hazeGeometry=new THREE.BufferGeometry();
hazeGeometry.setAttribute('position',new THREE.BufferAttribute(hazePos,3));
hazeGeometry.setAttribute('aData',new THREE.BufferAttribute(hazeData,2));
const haze=new THREE.Points(hazeGeometry,new THREE.ShaderMaterial({
  uniforms:{...shared,uPixelRatio:{value:renderer.getPixelRatio()}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`uniform float uTime,uFlow,uDensity,uPixelRatio;uniform vec3 uCamera;attribute vec2 aData;varying float vAlpha,vSeed;
  void main(){vec3 p=position;p.y+=sin(uTime*.3+aData.x*30.)*.13;p.z=mod(p.z-uFlow*.13+810.,500.)-310.;
  vec4 mv=modelViewMatrix*vec4(p,1.);float d=length(p-uCamera);vSeed=aData.x;
  vAlpha=smoothstep(38.,75.,d)*(1.-smoothstep(180.,340.,d))*(.15+aData.x*.35);
  gl_PointSize=clamp((26.+aData.x*38.)/max(1.,-mv.z),.65,3.2)*uPixelRatio;
  gl_Position=projectionMatrix*mv;if(aData.y>uDensity||d<35.)gl_Position=vec4(2.,2.,2.,1.);}`,
  fragmentShader:`varying float vAlpha,vSeed;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);if(d>.5)discard;float a=pow(1.-d*2.,1.8)*vAlpha;gl_FragColor=vec4(mix(vec3(.45,.17,.015),vec3(.85,.45,.06),vSeed),a*.15);}`
}));haze.frustumCulled=false;haze.renderOrder=1;scene.add(haze);

// Cathedral light is softly feathered geometry, not expensive volumetric raymarching.
const beamGeometry=new THREE.PlaneGeometry(1,1,1,24);
const beamMaterial=new THREE.ShaderMaterial({
  uniforms:shared,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
  vertexShader:`varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`${noiseGLSL}uniform float uTime;uniform vec3 uCamera;varying vec2 vUv;varying vec3 vWorld;
  void main(){float side=pow(max(0.,1.-abs(vUv.x-.5)*2.),2.5);float ends=sin(vUv.y*3.14159);float flicker=.7+.3*noise(vec2(vUv.y*4.+uTime*.12,vWorld.x*.2));float alpha=side*ends*flicker*.10;
  gl_FragColor=vec4(.78,.87,.48,alpha);}`
});
const beams=[];
for(let i=0;i<30;i++){
  const beam=new THREE.Mesh(beamGeometry,beamMaterial);beam.position.set(-25+range(-30,38),-4,range(-115,35));beam.scale.set(range(1.5,5.5),range(36,54),1);beam.rotation.z=-.29+range(-.08,.08);beam.renderOrder=2;scene.add(beam);beams.push(beam);
}

// Suspended plankton: a much quieter, cool counterpoint to the amber medusae.
const dustPos=new Float32Array(3500*3);
for(let i=0;i<3500;i++)dustPos.set([range(-60,60),range(-24,11),range(-120,65)],i*3);
const dustG=new THREE.BufferGeometry();dustG.setAttribute('position',new THREE.BufferAttribute(dustPos,3));
const dust=new THREE.Points(dustG,new THREE.ShaderMaterial({uniforms:shared,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`uniform float uTime;varying float vFade;void main(){vec3 p=position;p.x+=sin(uTime*.12+p.z)*.16;vec4 m=modelViewMatrix*vec4(p,1.);vFade=1.-smoothstep(10.,100.,-m.z);gl_PointSize=clamp(15./max(1.,-m.z),.7,2.2);gl_Position=projectionMatrix*m;}`,
  fragmentShader:`varying float vFade;void main(){float a=1.-length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(.54,.82,.66,max(0.,a)*vFade*.38);}`}));scene.add(dust);

// The jungle rim and its tangled roots sit beyond the stream of gold.
scene.fog=new THREE.FogExp2(0x126561,.014);
scene.add(new THREE.HemisphereLight(0xb5d9a0,0x16433b,2));
const jungleMat=new THREE.MeshLambertMaterial({color:0x244b26});
const rootMat=new THREE.MeshLambertMaterial({color:0x24433a});
const leafGeo=new THREE.IcosahedronGeometry(1,1);
const leaves=new THREE.InstancedMesh(leafGeo,jungleMat,380);
const dummy=new THREE.Object3D();
for(let i=0;i<380;i++){
  const angle=range(0,Math.PI*2),r=range(93,118);
  dummy.position.set(Math.cos(angle)*r,range(11,19),Math.sin(angle)*r-35);dummy.scale.set(range(3,8),range(1,4),range(3,8));dummy.rotation.set(rand(),rand()*6,rand());dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
}scene.add(leaves);
for(let i=0;i<95;i++){
  const a=range(0,Math.PI*2),r=range(94,104),x=Math.cos(a)*r,z=Math.sin(a)*r-35;
  const points=[];for(let j=0;j<6;j++)points.push(new THREE.Vector3(x+Math.sin(j*1.4+i)*j*.25,12-j*range(1.5,3),z+Math.cos(j+i)*j*.4));
  const rootMesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),12,range(.08,.32),5,false),rootMat);scene.add(rootMesh);
}

// A lone swimmer near the distant ceiling gives the multitude a human scale.
const swimmer=new THREE.Group();const silhouette=new THREE.MeshBasicMaterial({color:0x174d48,fog:true});
function limb(a,b,r){const v=new THREE.Vector3().subVectors(b,a);const m=new THREE.Mesh(new THREE.CylinderGeometry(r*.8,r,v.length(),6),silhouette);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());swimmer.add(m);return m;}
limb(new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,1),.18);
const head=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8),silhouette);head.position.z=-.24;swimmer.add(head);
limb(new THREE.Vector3(-.12,0,.2),new THREE.Vector3(-.57,-.1,-.35),.055);
limb(new THREE.Vector3(.12,0,.2),new THREE.Vector3(.58,-.05,-.26),.055);
const legs=[limb(new THREE.Vector3(-.1,0,.9),new THREE.Vector3(-.25,-.08,1.8),.075),limb(new THREE.Vector3(.1,0,.9),new THREE.Vector3(.38,.12,1.8),.075)];
for(const x of [-.25,.38]){const fin=new THREE.Mesh(new THREE.BoxGeometry(.27,.05,.4),silhouette);fin.position.set(x,0,1.94);swimmer.add(fin);}
swimmer.position.set(13,10.9,-47);swimmer.rotation.y=-.55;scene.add(swimmer);

// Small silver fry cluster beneath a handful of the closest bells.
const fishG=new THREE.ConeGeometry(.045,.23,4);fishG.rotateZ(-Math.PI/2);
const fish=new THREE.InstancedMesh(fishG,new THREE.MeshBasicMaterial({color:0xb7d2b4,transparent:true,opacity:.65}),120);
fish.frustumCulled=false;scene.add(fish);
const fishHomes=[];
for(let i=0;i<120;i++){const n=Math.floor(i/6);fishHomes.push({index:n,phase:range(0,6.28),r:range(.35,.85)});}

// A subtle optical finish, retaining the golden bell edges and turquoise shadows.
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.42,.52,.72);composer.addPass(bloom);
const finish=new ShaderPass({uniforms:{tDiffuse:{value:null},uTime:shared.uTime},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;vec2 p=vUv-.5;float vignette=1.-dot(p*vec2(.9,1.),p*vec2(.9,1.))*.61;c*=vignette;float grain=fract(sin(dot(vUv+fract(uTime),vec2(12.9898,78.233)))*43758.5453);c+=(grain-.5)*.004;gl_FragColor=vec4(c,1.);}`});composer.addPass(finish);composer.addPass(new OutputPass());

const pointer=new THREE.Vector2(),smoothPointer=new THREE.Vector2();
let yaw=0,pitch=.04,tour=false,currentView='galaxy',transition=null,flowOrigin=0;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const poses={galaxy:{position:new THREE.Vector3(0,-.6,20),yaw:0,pitch:.04},surface:{position:new THREE.Vector3(-8,6.4,2),yaw:-.23,pitch:.42},edge:{position:new THREE.Vector3(73,-1.8,-3),yaw:1.03,pitch:.13}};
const forward=new THREE.Vector3();const lookQuaternion=new THREE.Quaternion();const euler=new THREE.Euler(0,0,0,'YXZ');
function chooseView(name){
  currentView=name;const p=poses[name];transition={start:camera.position.clone(),end:p.position.clone(),yawStart:yaw,pitchStart:pitch,yaw:p.yaw,pitch:p.pitch,t:0};pointer.set(0,0);
  document.querySelectorAll('[data-view]').forEach(b=>{const active=b.dataset.view===name;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
}
window.addEventListener('pointermove',e=>{
  if(e.target.closest?.('.controls')){pointer.set(0,0);return;}
  pointer.set((e.clientX/innerWidth-.5)*2,(e.clientY/innerHeight-.5)*2);
});
window.addEventListener('pointerout',e=>{if(!e.relatedTarget)pointer.set(0,0);});
window.addEventListener('blur',()=>pointer.set(0,0));
document.querySelector('#expand').addEventListener('click',e=>{const button=e.currentTarget,open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));document.querySelector('#drawer').hidden=!open;});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>chooseView(b.dataset.view)));
document.querySelector('#reset').addEventListener('click',()=>{tour=false;flowOrigin=shared.uTime.value;document.querySelector('#tour').setAttribute('aria-checked','false');chooseView('galaxy');});
document.querySelector('#tour').addEventListener('click',e=>{tour=!tour;e.currentTarget.setAttribute('aria-checked',String(tour));pointer.set(0,0);});
document.querySelector('#density').addEventListener('input',e=>{const v=Number(e.target.value);shared.uDensity.value=v/100;document.querySelector('#density-value').textContent=v<55?'Scattered':v<80?'Plentiful':v<98?'Abundant':'Endless';e.target.style.background=`linear-gradient(to right,#bca56b ${(v-35)/65*100}%,#b9c9ad30 ${(v-35)/65*100}%)`;});
function quality(value){
  hazeGeometry.setDrawRange(0,value==='high'?hazeCount:value==='balanced'?340000:110000);
  // Preserve close medusae and the full set of sunbeams at every quality level.
  mid.geometry.instanceCount=value==='gentle'?6500:value==='balanced'?9500:12500;
  renderer.setPixelRatio(Math.min(devicePixelRatio,value==='high'?2:value==='balanced'?1.5:1));
  composer.setPixelRatio(renderer.getPixelRatio());haze.material.uniforms.uPixelRatio.value=renderer.getPixelRatio();
}
document.querySelector('#quality').addEventListener('change',e=>quality(e.target.value));
if(innerWidth<700 || innerWidth*innerHeight*devicePixelRatio*devicePixelRatio>4000000){document.querySelector('#quality').value='balanced';quality('balanced');}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);});

let running=true;document.addEventListener('visibilitychange',()=>{running=!document.hidden;clock.getDelta();});
function animate(){
  requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);if(!running)return;
  shared.uTime.value+=dt;shared.uFlow.value=shared.uTime.value-flowOrigin;const t=shared.uTime.value;
  smoothPointer.lerp(pointer,1.-Math.exp(-dt*1.4));
  if(transition){
    transition.t=Math.min(1,transition.t+dt/3.);const k=transition.t*transition.t*(3.-2.*transition.t);
    camera.position.lerpVectors(transition.start,transition.end,k);yaw=THREE.MathUtils.lerp(transition.yawStart,transition.yaw,k);pitch=THREE.MathUtils.lerp(transition.pitchStart,transition.pitch,k);if(transition.t===1)transition=null;
  }else{
    const base=poses[currentView];
    const desiredYaw=base.yaw+(tour?Math.sin(t*.045)*.58:smoothPointer.x*-.66);
    const desiredPitch=base.pitch+(tour?Math.sin(t*.061)*.18:smoothPointer.y*-.32);
    yaw=THREE.MathUtils.damp(yaw,desiredYaw,1.15,dt);pitch=THREE.MathUtils.damp(pitch,desiredPitch,1.15,dt);
    forward.set(-Math.sin(yaw),Math.sin(pitch)*.2,-Math.cos(yaw));
    camera.position.addScaledVector(forward,dt*(reducedMotion?.045:.31));
    // A gentle current always returns the swimmer toward the interior of the lake.
    const centerDistance=Math.hypot(camera.position.x,camera.position.z+30);
    if(centerDistance>65){camera.position.x-=camera.position.x*dt*.008;camera.position.z-=(camera.position.z+30)*dt*.008;}
    camera.position.y=THREE.MathUtils.damp(camera.position.y,base.position.y+Math.sin(t*.36)*.1,.3,dt);
  }
  euler.set(pitch,yaw,Math.sin(t*.17)*.006,'YXZ');lookQuaternion.setFromEuler(euler);camera.quaternion.copy(lookQuaternion);
  sky.position.copy(camera.position);
  beams.forEach(b=>{b.rotation.y=Math.atan2(camera.position.x-b.position.x,camera.position.z-b.position.z);});
  swimmer.position.x=13+Math.sin(t*.1)*1.8;swimmer.position.y=10.9+Math.sin(t*.5)*.06;legs[0].rotation.x=Math.sin(t*1.2)*.09;legs[1].rotation.x=-Math.sin(t*1.2)*.09;
  const offsets=near.geometry.attributes.aOffset.array,data=near.geometry.attributes.aData.array;
  for(let i=0;i<fishHomes.length;i++){
    const f=fishHomes[i],j=f.index,ph=f.phase+t*.44;
    const z=THREE.MathUtils.euclideanModulo(offsets[j*3+2]-shared.uFlow.value*(.16+data[j*4+2]*.065)+210,400)-210;
    dummy.position.set(offsets[j*3]+Math.sin(z*.021+t*.025)*4+Math.cos(ph)*f.r,-1.05+offsets[j*3+1]+Math.sin(ph*2)*.12,z+Math.sin(ph)*f.r);
    dummy.scale.setScalar(1);dummy.rotation.set(0,-ph,Math.sin(t*4+i)*.1);dummy.updateMatrix();fish.setMatrixAt(i,dummy.matrix);
  }fish.instanceMatrix.needsUpdate=true;
  composer.render();
}
animate();

// Read-only diagnostics for local verification.
window.lakeDiagnostics=()=>({view:currentView,tour,density:shared.uDensity.value,quality:document.querySelector('#quality').value,near:near.geometry.instanceCount,mid:mid.geometry.instanceCount,far:haze.geometry.drawRange.count,pixelRatio:renderer.getPixelRatio(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,position:camera.position.toArray(),time:shared.uTime.value});
