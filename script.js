import * as THREE from "three";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, 0.1, 100);
camera.position.set(0,1,8); camera.lookAt(0,0.6,0);
const renderer = new THREE.WebGLRenderer({ canvas:document.querySelector("#scene"), antialias:true, alpha:true });
renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio,2));

const world = new THREE.Group(); scene.add(world);
scene.add(new THREE.AmbientLight(0xffffff,0.75));
const dir=new THREE.DirectionalLight(0xffffff,1.1); dir.position.set(3,5,4); scene.add(dir);
const fill=new THREE.PointLight(0xff9ecf,30,30); fill.position.set(-4,1,3); scene.add(fill);

/* ════════ САР ════════ */
const moon = new THREE.Group();
moon.add(new THREE.Mesh(new THREE.SphereGeometry(1.1,40,40),
  new THREE.MeshStandardMaterial({color:0xfff3d6, emissive:0xffe6ad, emissiveIntensity:0.6, roughness:1})));
moon.add(new THREE.Mesh(new THREE.SphereGeometry(1.7,32,32),   // зөөлөн туяа
  new THREE.MeshBasicMaterial({color:0xffe6ad, transparent:true, opacity:0.13, blending:THREE.AdditiveBlending})));
moon.position.set(-5.5, 3.6, -7); world.add(moon);

/* ════════ САНЧИР (Saturn) ════════ */
const saturn=new THREE.Group();
saturn.add(new THREE.Mesh(new THREE.SphereGeometry(1.3,40,40),
  new THREE.MeshStandardMaterial({color:0xe3c9a0,roughness:1,emissive:0x4a3a22,emissiveIntensity:0.35})));
function sRing(inner,outer,op){
  const r=new THREE.Mesh(new THREE.RingGeometry(inner,outer,90),
    new THREE.MeshBasicMaterial({color:0xe8d6b0,transparent:true,opacity:op,side:THREE.DoubleSide}));
  r.rotation.x=-1.15; return r;
}
saturn.add(sRing(1.75,2.25,0.5)); saturn.add(sRing(2.32,2.7,0.32)); saturn.add(sRing(2.77,2.95,0.18));
saturn.position.set(6.2,2.4,-13); saturn.rotation.z=0.25; world.add(saturn);

/* ════════ ОД (2 давхарга — жижиг + том анивчигч) ════════ */
function starField(count,size,spread,op){
  const p=new Float32Array(count*3);
  for(let i=0;i<count;i++){p[i*3]=(Math.random()-0.5)*spread;p[i*3+1]=(Math.random()-0.15)*spread*0.6;p[i*3+2]=(Math.random()-0.5)*spread*0.5-8;}
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(p,3));
  const m=new THREE.PointsMaterial({size,color:0xffffff,transparent:true,opacity:op});
  const pts=new THREE.Points(g,m); scene.add(pts); return m;
}
starField(1400,0.05,55,0.7);
const bigStarsMat = starField(120,0.12,50,0.9);  // том одод — анивчина

/* ════════ ТУЙЛЫН ТУЯА (aurora) — жинхэнэ shader-аар долгилох гэрэл ════════
   Хуучин canvas+blur хувилбарыг GLSL shader-аар сольсон:
   • fbm чимээ (noise) ашиглан босоо хөшгүүд урсана → бодит харагдана
   • өнгө дээшээ ногоон→хөх→ягаан болж аяндаа уусна
   • uIntensity uniform → 2-р хуудас руу шилжихэд гэрэл бялхана           */
const auroraUniforms = {
  uTime:      { value: 0 },
  uIntensity: { value: 1.6 },   // суурь гэрэлтэлт — бүх хуудсанд тод харагдана
};
const auroraMat = new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  uniforms: auroraUniforms,
  vertexShader:`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader:`
    precision highp float;
    varying vec2 vUv;
    uniform float uTime;
    uniform float uIntensity;

    // --- value noise + fbm ---
    float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float noise(vec2 p){
      vec2 i=floor(p), f=fract(p);
      vec2 u=f*f*(3.0-2.0*f);
      float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
      return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
    }
    float fbm(vec2 p){
      float v=0.0, a=0.5;
      for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=0.5; }
      return v;
    }

    void main(){
      vec2 uv = vUv;
      float t = uTime*0.06;

      // хөшгүүдийн зөөлөн налалт (доороос дээш урсах хэлбэр)
      float sway = (fbm(vec2(uv.x*2.0, t)) - 0.5)*0.45;

      // босоо туяанууд — нарийн судлууд хажуу тийш аажуу хөдөлнө
      float rays = fbm(vec2(uv.x*9.0 + t*3.0, uv.y*1.4 - t*4.0));
      rays = pow(rays, 1.6);

      // өндрийн профиль: гэрэл тодорхой түвшинд хөвж, дээш сарнина
      float baseY = 0.42 + sway + 0.07*sin(uv.x*6.2831 + uTime*0.25);
      float body  = smoothstep(0.0, 0.42, uv.y-baseY+0.42) * smoothstep(1.0, 0.5, uv.y);

      // дотоод анивчилт (flicker) — амьд мэт
      float flick = 0.75 + 0.25*sin(uTime*1.3 + uv.x*14.0 + rays*6.0);

      float a = body * rays * flick;

      // ирмэгийг зүүн/баруун талд уусгана
      a *= smoothstep(0.0,0.14,uv.x) * smoothstep(1.0,0.86,uv.x);

      // өнгө: доод хэсэг ногоон → дунд хөх → дээд ягаан
      vec3 col = mix(vec3(0.30,1.0,0.62), vec3(0.36,0.70,1.0), smoothstep(0.2,0.6,uv.y));
      col = mix(col, vec3(0.78,0.45,1.0), smoothstep(0.6,0.95,uv.y));

      a *= uIntensity;
      gl_FragColor = vec4(col*a, a);
    }
  `
});
const aurora = new THREE.Mesh(new THREE.PlaneGeometry(54,22), auroraMat);
aurora.position.set(0,5,-12); scene.add(aurora);

/* ════════ РЕТРО КОМПЬЮТЕР ════════ */
const pc=new THREE.Group();
const caseMat=new THREE.MeshStandardMaterial({color:0xe9dec9,roughness:0.65});
const darkMat=new THREE.MeshStandardMaterial({color:0x3a3550,roughness:0.5});
pc.add(new THREE.Mesh(new THREE.BoxGeometry(3,2.5,2.4),caseMat));
const bezel=new THREE.Mesh(new THREE.BoxGeometry(2.5,2,0.1),darkMat); bezel.position.set(0,0.15,1.2); pc.add(bezel);
const scv=document.createElement("canvas"); scv.width=256; scv.height=200; const sctx=scv.getContext("2d");
const screenTex=new THREE.CanvasTexture(scv);
const screen=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.7),new THREE.MeshBasicMaterial({map:screenTex})); screen.position.set(0,0.15,1.27); pc.add(screen);
pc.add(new THREE.Mesh(new THREE.PlaneGeometry(2.6,2.1),new THREE.MeshBasicMaterial({color:0x5effc8,transparent:true,opacity:0.12,blending:THREE.AdditiveBlending}))).position.set(0,0.15,1.22);
const stand=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.5,1.2),caseMat); stand.position.set(0,-1.5,0.2); pc.add(stand);
const keyboard=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.25,1),caseMat); keyboard.position.set(0,-1.85,1.7); keyboard.rotation.x=-0.15; pc.add(keyboard);
for(let r=0;r<3;r++)for(let c=0;c<9;c++){ const k=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.06,0.18),darkMat); k.position.set(-0.95+c*0.24,-1.74,1.45-r*0.22); k.rotation.x=-0.15; pc.add(k); }
pc.position.set(0,0.5,-3.7); pc.scale.setScalar(0.82); world.add(pc);
// дэлгэц дээр бичигдэх C++ код (мөрүүдээ энд солиж болно)
const CODE=[
  "#include <iostream>",
  "using namespace std;",
  "",
  "int main() {",
  '  cout << "Tenuun";',
  '  cout << "interested in";',
  '  cout << "CyberSecurity";',
  "  return 0;",
  "}"
];
// мөр бүрийг энгийн дүрмээр өнгөлнө (syntax highlight)
function lineColor(line){
  const s=line.trim();
  if(s.startsWith("#"))                       return "#ff9ecf"; // #include — ягаан
  if(/^(int|return|using|namespace)/.test(s)) return "#7fd6ff"; // түлхүүр үг — цэнхэр
  if(s.includes("cout"))                      return "#9effd0"; // cout — ногоон
  if(s.includes('"'))                         return "#ffe066"; // текст — шар
  return "#cfe8ff";
}
function drawScreen(t){
  sctx.fillStyle="#0c1830"; sctx.fillRect(0,0,256,200);            // бараан дэлгэц
  // дээд талын цонхны мөр (улаан/шар/ногоон цэг + файлын нэр)
  sctx.fillStyle="#1b2a4a"; sctx.fillRect(0,0,256,18);
  sctx.fillStyle="#ff6b6b"; sctx.beginPath(); sctx.arc(10,9,3,0,7); sctx.fill();
  sctx.fillStyle="#ffd86b"; sctx.beginPath(); sctx.arc(22,9,3,0,7); sctx.fill();
  sctx.fillStyle="#5effc8"; sctx.beginPath(); sctx.arc(34,9,3,0,7); sctx.fill();
  sctx.fillStyle="#88a"; sctx.font="9px monospace"; sctx.textBaseline="alphabetic"; sctx.fillText("main.cpp",115,12);

  // typewriter — бичиж буй мэт, тэмдэгт нэгbyнэгээр гарч ирнэ
  const full=CODE.join("\n"); const total=full.length;
  const cycle=Math.floor(t*18)%(total+30);          // бичээд жоохон зогсоод дахин эхэлнэ
  const reveal=Math.min(cycle,total);
  sctx.font="11px monospace"; sctx.textBaseline="top";
  let printed=0, y=26;
  for(const line of CODE){
    let x=8; sctx.fillStyle=lineColor(line);
    let i=0;
    for(;i<line.length && printed<reveal;i++){ sctx.fillText(line[i],x,y); x+=6.4; printed++; }
    if(printed>=reveal){ if(Math.sin(t*9)>0){ sctx.fillStyle="#5effc8"; sctx.fillRect(x,y,5,11); } break; } // курсор анивчина
    printed++; y+=18;                                 // мөр шилжих
  }
  // scanline (CRT мэдрэмж)
  sctx.fillStyle="rgba(0,0,0,0.10)"; for(let yy=18;yy<200;yy+=4) sctx.fillRect(0,yy,256,2);
  screenTex.needsUpdate=true;
}

/* ════════ ХӨВӨГЧ ФЛОППИ ════════ */
const disks=[];
[{c:0xff6ec7,x:-3.2,y:1.4},{c:0x5ee7ff,x:3.4,y:0.6},{c:0xffe066,x:2.6,y:2.0}].forEach((d,i)=>{
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7,0.7,0.1),new THREE.MeshStandardMaterial({color:d.c,roughness:0.5})));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.4,0.25,0.12),darkMat));
  g.position.set(d.x,d.y,-1); g.rotation.set(0.3,0.4,0.2); g.userData={phase:i*1.3,baseY:d.y}; world.add(g); disks.push(g);
});

/* ════════ ДҮР устгагдсан (охин SVG + ягаан цагираг авсан) ════════ */

/* ════════ НЕОН КРИСТАЛУУД ════════ */
const GEMS=[
  {type:"octa",color:0xff6ec7,x:-3.8,y:1.8,z:-1,s:0.9},{type:"ico",color:0x5ee7ff,x:4.0,y:2.2,z:-2,s:1.1},
  {type:"octa",color:0xb07cff,x:-3.0,y:-0.6,z:0,s:0.7},{type:"ico",color:0xffe066,x:3.6,y:-0.4,z:0,s:0.8},
  {type:"octa",color:0xff9ecf,x:2.0,y:2.8,z:-3,s:0.6},{type:"ico",color:0x9effd0,x:-4.6,y:0.4,z:-2,s:0.6},
];
const gemMeshes=[]; const gemHit=[];
GEMS.forEach((g,i)=>{ const geo=g.type==="octa"?new THREE.OctahedronGeometry(g.s,0):new THREE.IcosahedronGeometry(g.s,0);
  const grp=new THREE.Group();
  const fillM=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:g.color,transparent:true,opacity:0.12}));
  const edgeMat=new THREE.LineBasicMaterial({color:g.color,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending});
  grp.add(fillM); grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),edgeMat));
  grp.position.set(g.x,g.y,g.z); grp.userData={phase:i*0.7,baseY:g.y,edgeMat}; fillM.userData.grp=grp;
  world.add(grp); gemMeshes.push(grp); gemHit.push(fillM); });

/* ════════ ШАТРЫН ТАВЦАН ════════ */
const cv=document.createElement("canvas"); cv.width=cv.height=256; const cx=cv.getContext("2d");
for(let i=0;i<8;i++)for(let j=0;j<8;j++){cx.fillStyle=(i+j)%2?"#d9c2ff":"#ffd6ec"; cx.fillRect(i*32,j*32,32,32);}
const tex=new THREE.CanvasTexture(cv);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(14,14),new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:0.55}));
floor.rotation.x=-Math.PI/2; floor.position.y=-2.2; world.add(floor);

let mx=0,my=0, curTX=innerWidth/2, curTY=innerHeight/2, curX=curTX, curY=curTY;
const pointer=new THREE.Vector2(-2,-2);
const raycaster=new THREE.Raycaster();
const cursorEl=document.getElementById("cursorGlow");
addEventListener("mousemove",e=>{
  mx=e.clientX/innerWidth-0.5; my=e.clientY/innerHeight-0.5;
  curTX=e.clientX; curTY=e.clientY;
  pointer.x=(e.clientX/innerWidth)*2-1; pointer.y=-(e.clientY/innerHeight)*2+1;
});

const clock=new THREE.Clock();
function loop(){
  requestAnimationFrame(loop);
  const t=clock.getElapsedTime();
  drawScreen(t);
  auroraUniforms.uTime.value = t;        // shader aurora-г урсгана
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(gemHit,false);
  const hitGrp = hits.length ? hits[0].object.userData.grp : null;
  gemMeshes.forEach(g=>{
    const hov = g===hitGrp;
    const sp = hov?0.045:0.006;
    g.rotation.x += hov?0.03:0.004; g.rotation.y += sp;
    const ts = hov?1.4:1; g.scale.x += (ts-g.scale.x)*0.15; g.scale.y=g.scale.z=g.scale.x;
    g.userData.edgeMat.opacity += ((hov?1:0.95)-g.userData.edgeMat.opacity)*0.2;
    g.position.y=g.userData.baseY+Math.sin(t+g.userData.phase)*0.35;
  });
  disks.forEach(d=>{d.rotation.y+=0.01; d.position.y=d.userData.baseY+Math.sin(t*0.8+d.userData.phase)*0.3;});
  pc.position.y=0.1+Math.sin(t*0.6)*0.08;
  moon.position.y=3.6+Math.sin(t*0.4)*0.15;
  saturn.rotation.y+=0.0015;
  bigStarsMat.opacity=0.7+Math.sin(t*2)*0.25;          // одод анивчина
  world.rotation.y+=((mx*0.3)-world.rotation.y)*0.04;
  world.rotation.x+=((my*0.12)-world.rotation.x)*0.04;
  curX+=(curTX-curX)*0.18; curY+=(curTY-curY)*0.18;
  if(cursorEl) cursorEl.style.transform=`translate(${curX}px,${curY}px) translate(-50%,-50%)`;
  renderer.render(scene,camera);
}
loop();
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight);});

/* ════════ ХАРВАЖ БУЙ ОД — хааяа тэнгэрээр гулсана ════════ */
const ssMat=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0,blending:THREE.AdditiveBlending});
const ssGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(1.4,-0.6,0)]);
const shootingStar=new THREE.Line(ssGeo, ssMat); scene.add(shootingStar);
function shoot(){
  const sx=1+Math.random()*7, sy=3+Math.random()*4, z=-7-Math.random()*5;
  shootingStar.position.set(sx,sy,z); ssMat.opacity=0;
  gsap.timeline({onComplete:()=>gsap.delayedCall(2.5+Math.random()*4, shoot)})
    .to(ssMat,{opacity:0.9,duration:0.18},0)
    .to(shootingStar.position,{x:sx-7,y:sy-3,duration:0.9,ease:"power1.in"},0)
    .to(ssMat,{opacity:0,duration:0.4},0.55);
}
gsap.delayedCall(1.5, shoot);

/* ════════════════════════════════════════════════════════════════
   СЛАЙД — олон төрлийн pull/slide шилжилт
════════════════════════════════════════════════════════════════ */
const slides=[...document.querySelectorAll(".slide")];
const dotsBox=document.getElementById("dots");

/* Future слайдын 2 aesthetic зураг — линкээ энд солиж болно */
const IMG1="https://i.postimg.cc/rmdNQ7mX/image.jpg";
const IMG2="https://i.postimg.cc/xTQLzXKY/smoking-black-cat.jpg";
{ const a=document.getElementById("img1"), b=document.getElementById("img2");
  if(a) a.style.backgroundImage=`url('${IMG1}')`;
  if(b) b.style.backgroundImage=`url('${IMG2}')`; }

let current=0, animating=false;
slides.forEach((_,i)=>{ const b=document.createElement("button"); if(i===0)b.classList.add("on"); b.onclick=()=>go(i); dotsBox.appendChild(b); });
const dots=[...dotsBox.children];

/* хуудасны дугаар заагч (01 — 12) */
const counterEl=document.getElementById("counter");
const pad=v=>String(v).padStart(2,"0");
function setCounter(n){ counterEl.textContent=pad(n+1)+" — "+pad(slides.length); }
setCounter(0);

/* тоо 0-оос зорилтот руу зөөлөн тоологдоно */
function countUp(el){
  const target=+el.dataset.count; if(isNaN(target)) return;
  const o={v:0}; el.textContent="0";
  gsap.to(o,{v:target,duration:1.1,ease:"power2.out",delay:0.3,
    onUpdate:()=>{ el.textContent=Math.round(o.v); }});
}

/* нүүр слайдын орох анимэйшн — preloader дууссаны дараа ажиллана */
function revealSite(){
  gsap.from(".slide.first .eyebrow, .slide.first h1",{y:45,opacity:0,duration:1.2,ease:"expo.out",stagger:0.18});
  gsap.from("#scene",{autoAlpha:0,duration:1.8,ease:"power2.out"});
}

/* ════ PRELOADER — ТОМ ГАЛАКТИК + BOOM ════
   спираль галактик эргэлдэнэ → төв рүү шахагдана → БУУМ хийж тарж бутарна → сайт нээгдэнэ */
function runPreloader(){
  const pl=document.getElementById("preloader");
  const pct=document.getElementById("plPct");
  const flash=document.getElementById("plFlash");
  const cvs=document.getElementById("plCanvas");
  const g=cvs.getContext("2d");

  let W,H,CX,CY,R,bgGrad,bgStars=[];
  function plResize(){
    W=cvs.width=innerWidth; H=cvs.height=innerHeight; CX=W/2; CY=H/2;
    R=Math.max(W,H)*0.62;                                  // ТОМ галактик
    bgGrad=g.createRadialGradient(CX,CY*0.85,0,CX,CY,Math.max(W,H)*0.9);
    bgGrad.addColorStop(0,"#1d1547"); bgGrad.addColorStop(0.5,"#120d31"); bgGrad.addColorStop(1,"#07051a");
    bgStars=[]; const ns=Math.round(W*H/6000);
    for(let i=0;i<ns;i++) bgStars.push({x:Math.random()*W,y:Math.random()*H,s:Math.random()*1.3+0.3,tw:Math.random()*6.28,sp:0.01+Math.random()*0.04});
  }
  plResize(); addEventListener("resize",plResize);

  // ── tilt: галактикийг налуу зууван хавтгай болгоно (зураг шиг) ──
  const TILT=-0.42, cosT=Math.cos(TILT), sinT=Math.sin(TILT), SQUASH=0.5;
  function pos(ca,r){
    const lx=Math.cos(ca)*r, ly=Math.sin(ca)*r*SQUASH;
    return [CX+lx*cosT-ly*sinT, CY+lx*sinT+ly*cosT];
  }
  // радиусаар nebula өнгө: цөм цагаан-ягаан → нил ягаан → нил → цэнхэр
  function nebColor(t){
    if(t<0.22) return "255,205,232";
    if(t<0.45) return "242,120,198";
    if(t<0.70) return "168,108,236";
    return "92,118,236";
  }

  // ── nebula үүлс (зөөлөн өнгөт толбо) — олон, нарийн ──
  const nebs=[]; const NB = innerWidth<700 ? 110 : 230;
  for(let i=0;i<NB;i++){
    const arm=i%3, dist=Math.pow(Math.random(),0.6)*R;
    const ang=arm*(Math.PI*2/3)+dist*0.014+(Math.random()-0.5)*0.42, t=dist/R;
    nebs.push({ ang, dist, size:34+Math.random()*95*(1-t*0.35), c:nebColor(t) });
  }

  // ── одод (twinkle + тэсрэлт) — нягт ──
  const STAR_COLORS=["#ffffff","#dbe6ff","#bcc4ff","#e6c2ff","#ffd0ec"];
  const N = innerWidth<700 ? 1300 : 2800;
  const parts=[];
  for(let i=0;i<N;i++){
    const arm=(Math.random()*3)|0, dist=Math.pow(Math.random(),0.5)*R;
    const ang=arm*(Math.PI*2/3)+dist*0.014+(Math.random()-0.5)*0.45;
    parts.push({ ang, dist, size:Math.random()*1.5+0.3,
      color:STAR_COLORS[(Math.random()*STAR_COLORS.length)|0],
      tw:Math.random()*6.28, vx:0, vy:0, ex:0, ey:0, bx:0, by:0 });
  }

  let rot=0, contract=1, exploding=false, boomP=0, running=true;

  function triggerBoom(){
    for(const p of parts){
      const [bx,by]=pos(p.ang+rot, p.dist*contract);
      p.bx=bx; p.by=by;
      const dx=bx-CX, dy=by-CY, d=Math.hypot(dx,dy)||1;
      const sp=10+Math.random()*22;
      p.vx=dx/d*sp; p.vy=dy/d*sp; p.ex=0; p.ey=0;
    }
    exploding=true;
  }

  function frame(){
    if(!running) return;
    requestAnimationFrame(frame);
    // дэвсгэр: бараан gradient + тэнгэр даяар одод (бүтэн цэвэрлэнэ → цав цагаан болохгүй)
    g.globalCompositeOperation="source-over";
    g.fillStyle=bgGrad; g.fillRect(0,0,W,H);
    const bgA = exploding ? Math.max(0,1-boomP) : 1;
    for(const s of bgStars){ s.tw+=s.sp; g.globalAlpha=(0.22+0.5*Math.abs(Math.sin(s.tw)))*bgA;
      g.fillStyle="#fff"; g.fillRect(s.x,s.y,s.s,s.s); }
    g.globalAlpha=1;

    rot+=0.0011;
    const nebA = exploding ? Math.max(0,1-boomP*1.6) : 1;
    g.globalCompositeOperation="lighter";
    if(nebA>0){
      // nebula үүлс (сул alpha → спираль гар тод харагдана)
      for(const p of nebs){
        const [x,y]=pos(p.ang+rot*0.5, p.dist*contract);
        const rad=p.size*contract; if(rad<1) continue;
        const grd=g.createRadialGradient(x,y,0,x,y,rad);
        grd.addColorStop(0,`rgba(${p.c},${0.07*nebA})`);
        grd.addColorStop(1,`rgba(${p.c},0)`);
        g.fillStyle=grd; g.beginPath(); g.arc(x,y,rad,0,6.2832); g.fill();
      }
      // гэрэлт цөм
      const cr=R*0.2*contract;
      const cg2=g.createRadialGradient(CX,CY,0,CX,CY,cr);
      cg2.addColorStop(0,`rgba(255,255,255,${0.72*nebA})`);
      cg2.addColorStop(0.3,`rgba(255,226,247,${0.32*nebA})`);
      cg2.addColorStop(0.7,`rgba(255,165,214,${0.08*nebA})`);
      cg2.addColorStop(1,`rgba(255,165,214,0)`);
      g.fillStyle=cg2; g.beginPath(); g.arc(CX,CY,cr,0,6.2832); g.fill();
    }
    // галактикийн одод
    for(const p of parts){
      let x,y,a;
      if(!exploding){
        const r=p.dist*contract; [x,y]=pos(p.ang+rot,r);
        p.tw+=0.06; a=0.35+0.55*Math.sin(p.tw);
      }else{
        p.ex+=p.vx; p.ey+=p.vy; p.vx*=0.985; p.vy*=0.985;
        x=p.bx+p.ex; y=p.by+p.ey; a=Math.max(0,1-boomP);
      }
      g.globalAlpha=Math.max(0,a); g.fillStyle=p.color;
      g.beginPath(); g.arc(x,y,p.size,0,6.2832); g.fill();
    }
    g.globalAlpha=1; g.globalCompositeOperation="source-over";
  }
  frame();

  // ── найрлага (timeline) ──
  const o={v:0}, boomObj={p:0}, conObj={c:1};
  gsap.timeline()
    .from(".pl-inner",{y:14,opacity:0,duration:0.9,ease:"power3.out"})
    .to(o,{v:100,duration:2.0,ease:"power1.inOut",
      onUpdate:()=>{ pct.textContent=Math.round(o.v); }},"-=0.3")
    // төв рүү шахагдах (амьсгаа авах мэт)
    .to(conObj,{c:0.34,duration:0.55,ease:"power2.in",onUpdate:()=>{ contract=conObj.c; }})
    .to(".pl-inner",{opacity:0,duration:0.4,ease:"power2.in"},"<")
    // 💥 BOOM
    .add(triggerBoom)
    .to(flash,{opacity:0.95,duration:0.14,ease:"power2.out"},"<")
    .to(boomObj,{p:1,duration:0.95,ease:"power2.out",
      onUpdate:()=>{ boomP=boomObj.p; }},"<")
    .to(flash,{opacity:0,duration:0.6,ease:"power2.in"},">-0.45")
    .to(pl,{opacity:0,duration:0.55,ease:"power2.in",
      onComplete:()=>{ running=false; pl.style.display="none"; removeEventListener("resize",plResize); }},"<")
    .add(revealSite,"<");
}
runPreloader();

/* ════════ AURORA — хуудас шилжих бүрд богино зуур бялхана ════════ */
function auroraBurst(){
  gsap.killTweensOf(auroraUniforms.uIntensity);
  gsap.timeline()
    .to(auroraUniforms.uIntensity,{value:2.7,duration:0.6,ease:"power2.out"})
    .to(auroraUniforms.uIntensity,{value:1.6,duration:1.3,ease:"power2.inOut"});
}

/* ── Шилжилтийн төрлүүд: хуудас бүр өөр маягаар солигдоно ──
   pullIn → холоос ойртох, pullOut → холдох, slide* → гулсалт */
const ORDER = ['pullIn','slideLeft','pullOut','slideUp','slideRight','slideDown'];
function transFor(a,b){ return ORDER[Math.min(a,b) % ORDER.length]; }

function transStates(kind, fwd){
  switch(kind){
    case 'pullIn':  return fwd ? {from:{scale:0.8 ,opacity:0}, to:{scale:1.22,opacity:0}}
                               : {from:{scale:1.22,opacity:0}, to:{scale:0.8 ,opacity:0}};
    case 'pullOut': return fwd ? {from:{scale:1.25,opacity:0}, to:{scale:0.8 ,opacity:0}}
                               : {from:{scale:0.8 ,opacity:0}, to:{scale:1.25,opacity:0}};
    case 'slideLeft':  return fwd ? {from:{xPercent: 100,opacity:0}, to:{xPercent:-100,opacity:0}}
                                  : {from:{xPercent:-100,opacity:0}, to:{xPercent: 100,opacity:0}};
    case 'slideRight': return fwd ? {from:{xPercent:-100,opacity:0}, to:{xPercent: 100,opacity:0}}
                                  : {from:{xPercent: 100,opacity:0}, to:{xPercent:-100,opacity:0}};
    case 'slideUp':    return fwd ? {from:{yPercent: 100,opacity:0}, to:{yPercent:-100,opacity:0}}
                                  : {from:{yPercent:-100,opacity:0}, to:{yPercent: 100,opacity:0}};
    case 'slideDown':  return fwd ? {from:{yPercent:-100,opacity:0}, to:{yPercent: 100,opacity:0}}
                                  : {from:{yPercent: 100,opacity:0}, to:{yPercent:-100,opacity:0}};
  }
}

function go(n){
  if(animating||n===current||n<0||n>=slides.length) return;
  animating=true;
  const fwd = n>current;

  auroraBurst();                                     // туйлын туяа шилжилт бүрд бялхана

  const kind = transFor(current,n);
  const {from,to} = transStates(kind,fwd);

  const o=slides[current], inc=slides[n];
  gsap.killTweensOf([o,inc,world.position]);

  // гарч буй хуудас
  gsap.to(o,{ ...to, duration:0.62, ease:"power2.in",
    onComplete:()=>{ o.style.visibility="hidden"; o.style.pointerEvents="none";
      gsap.set(o,{scale:1,xPercent:0,yPercent:0,opacity:0}); }});

  // орж буй хуудас (scale+x+y бүгдийг 0/1 рүү буцаана → гөлгөр)
  inc.style.visibility="visible"; inc.style.pointerEvents="auto";
  gsap.fromTo(inc, { ...from },
    { scale:1, xPercent:0, yPercent:0, opacity:1, duration:0.9, ease:"power3.out",
      onComplete:()=>{animating=false;} });
  // слайд доторх текст/картууд дараалан зөөлөн мацаж орно
  const kids=inc.querySelectorAll(".eyebrow, h1, .lead, .cards, .gallery, .links");
  gsap.from(kids,{y:30,opacity:0,duration:0.8,ease:"power3.out",stagger:0.09,delay:0.12});
  // тоонууд тоологдож, доод заагч шинэчлэгдэнэ
  inc.querySelectorAll("[data-count]").forEach(countUp);
  setCounter(n);

  // 3D ертөнц шилжилтийн чиглэлд нийцүүлэн зөөлөн хөдөлж тогтоно
  let wf={x:0,y:0,z:0};
  if(kind==='pullIn')       wf.z = fwd?-0.7:0.7;
  else if(kind==='pullOut') wf.z = fwd? 0.7:-0.7;
  else if(from.xPercent!==undefined) wf.x = (from.xPercent>0? 0.5:-0.5);
  else if(from.yPercent!==undefined) wf.y = (from.yPercent>0?-0.5: 0.5);
  gsap.fromTo(world.position, wf, {x:0,y:0,z:0,duration:1.1,ease:"power3.out"});

  dots[current].classList.remove("on"); dots[n].classList.add("on"); current=n;
}

let lock=false;
addEventListener("wheel",e=>{ if(lock||animating)return; if(e.deltaY>15){go(current+1);lock=true;setTimeout(()=>lock=false,950);} else if(e.deltaY<-15){go(current-1);lock=true;setTimeout(()=>lock=false,950);} },{passive:true});
addEventListener("keydown",e=>{ if(["ArrowDown","ArrowRight"," "].includes(e.key))go(current+1); if(["ArrowUp","ArrowLeft"].includes(e.key))go(current-1); });
let tx0=0,ty0=0;
addEventListener("touchstart",e=>{tx0=e.touches[0].clientX; ty0=e.touches[0].clientY;},{passive:true});
addEventListener("touchend",e=>{ const dx=tx0-e.changedTouches[0].clientX, dy=ty0-e.changedTouches[0].clientY;
  if(Math.max(Math.abs(dx),Math.abs(dy))>40){ (Math.abs(dx)>Math.abs(dy)?dx:dy)>0?go(current+1):go(current-1); } },{passive:true});

/* ════════════════════════════════════════════════════════════════
   ТУРШИЛТ:
   • body градиент (styles.css) → тэнгэрийн өнгө
   • runPreloader доторх R → галактикийн хэмжээ
   • auroraUniforms.uIntensity.value → туйлын туяаны суурь гэрэлтэлт
════════════════════════════════════════════════════════════════ */
