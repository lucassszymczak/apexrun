// ============================================================================
// MOTOR DO APEX — extraído AUTOMATICAMENTE de analise/index.html (Etapa 0 da Fase 1).
// NÃO EDITE À MÃO. Cada declaração abaixo é cópia byte a byte da página original;
// analise/engine.test.mjs falha se alguma divergir. Regenere com:
//   node scripts/extract-engine.mjs
// Só a "cola" de módulo (estado e toast injetáveis + exports) é código novo.
// ============================================================================
/* eslint-disable */

// ---- cola de módulo: o estado do app (antes uma variável global da página) ----
var state = null;
export function setState(s) { state = s; return state; }
export function getState() { return state; }
// toast usado por save() quando o armazenamento enche; a interface injeta o seu.
var toast = function () {};
export function setToast(fn) { toast = typeof fn === "function" ? fn : function () {}; }

// ---- declarações copiadas de analise/index.html ----
var GAP_UP=0.035, GAP_DOWN=0.015;
function clamp(x,lo,hi){return Math.max(lo,Math.min(hi,x));}
function mean(a){return a.length?a.reduce(function(x,y){return x+y;},0)/a.length:0;}
function std(a){if(a.length<2)return 0;var m=mean(a);return Math.sqrt(a.reduce(function(x,y){return x+(y-m)*(y-m);},0)/(a.length-1));}
function paceStr(s){if(!isFinite(s)||s<=0)return"—";var m=Math.floor(s/60),sec=Math.round(s-m*60);if(sec===60){sec=0;m++;}return m+":"+String(sec).padStart(2,"0");}
function hms(sec){if(!isFinite(sec)||sec<0)return"—";var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=Math.round(sec%60);return h>0?h+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0"):m+":"+String(s).padStart(2,"0");}
function hmsShort(sec){if(!isFinite(sec)||sec<0)return"—";var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60);return h>0?h+"h"+String(m).padStart(2,"0"):m+"min";}
function gradeCostMult(g){var k=g>=0?GAP_UP:GAP_DOWN;return 1+k*g;}
function gapTimeFromSplits(sp){var t=0;for(var i=0;i<sp.length;i++){var s=sp[i],d=s.distKm||1;var g=clamp((s.elevDeltaM||0)/(d*10),-35,35);t+=s.timeSec/gradeCostMult(g);}return t;}
function gapTimeEstimate(dur,dist,gain,loss){var p=dur/dist;return dur-(GAP_UP/10)*p*(gain||0)+(GAP_DOWN/10)*p*(loss||0);}
function computeGap(w){
  var dist=w.distKm;
  if(!dist||!w.durationSec)return{gapTimeSec:null,gapSpeed:null,gapPace:null,confidence:"sem dados"};
  if(w.splits&&w.splits.length&&w.splits.some(function(s){return s.elevDeltaM!=null;})){
    var gt=gapTimeFromSplits(w.splits.map(function(s){return{timeSec:s.timeSec,distKm:s.distKm||1,elevDeltaM:s.elevDeltaM||0};}));
    return finishGap(gt,dist,"alta");
  }
  if((w.gainM!=null&&w.gainM>0)||(w.lossM!=null&&w.lossM>0))return finishGap(gapTimeEstimate(w.durationSec,dist,w.gainM||0,w.lossM||0),dist,"estimada");
  return finishGap(w.durationSec,dist,"plano");
}
function finishGap(gt,dist,c){return{gapTimeSec:gt,gapSpeed:(dist*1000)/gt,gapPace:gt/dist,confidence:c};}
function computeEF(w){var g=computeGap(w);if(!g.gapSpeed||!w.hrAvg)return null;return g.gapSpeed/w.hrAvg;}
function splitIntoHalves(sp){var tot=sp.reduce(function(a,s){return a+(s.distKm||1);},0),acc=0,f=[],se=[];for(var i=0;i<sp.length;i++){var s=sp[i];if(acc+(s.distKm||1)/2<=tot/2)f.push(s);else se.push(s);acc+=s.distKm||1;}if(!f.length||!se.length)return null;return{first:f,second:se};}
function halfEFfromSplits(sp){var d=sp.reduce(function(a,s){return a+(s.distKm||1);},0);var num=0,den=0;for(var i=0;i<sp.length;i++){if(sp[i].hrAvg){num+=sp[i].hrAvg*sp[i].timeSec;den+=sp[i].timeSec;}}if(!den)return null;var gt=gapTimeFromSplits(sp);return((d*1000)/gt)/(num/den);}
function computeDecoupling(w){
  if(w.decouplingPct!=null)return w.decouplingPct;
  // Robusto a quedas de FC: não exige FC em TODOS os km (o .FIT frequentemente perde 1–2 km de
  // FC por dropout). Basta cobertura suficiente — halfEFfromSplits já pondera só os km com FC.
  if(w.splits&&w.splits.length>=4&&w.splits.filter(function(s){return s.hrAvg;}).length>=4){
    var h=splitIntoHalves(w.splits);if(h){var e1=halfEFfromSplits(h.first),e2=halfEFfromSplits(h.second);if(e1&&e2)return((e1-e2)/e1)*100;}
  }
  return null;
}
function computePacing(w){
  if(!w.splits||w.splits.length<2)return null;
  var h=splitIntoHalves(w.splits);if(!h)return null;
  function paceOf(sp){var d=sp.reduce(function(a,s){return a+(s.distKm||1);},0),t=sp.reduce(function(a,s){return a+s.timeSec;},0);return t/d;}
  var p1=paceOf(h.first),p2=paceOf(h.second),delta=(p2-p1)/p1;
  var label=delta<-0.01?"negative split":delta>0.01?"positive split":"even";
  var paces=w.splits.map(function(s){return s.timeSec/(s.distKm||1);});
  var last=paces[paces.length-1],prev=paces.slice(0,-1);
  var prevAvg=prev.reduce(function(a,b){return a+b;},0)/prev.length;
  return{label:label,deltaPct:delta*100,closer:last<prevAvg*0.95,lastGainSec:prevAvg-last};
}
function computePaceStability(w){
  if(!w.splits||w.splits.length<3)return null;
  var gp=w.splits.map(function(s){return computeGap({distKm:s.distKm||1,durationSec:s.timeSec,gainM:s.elevDeltaM>0?s.elevDeltaM:0,lossM:s.elevDeltaM<0?-s.elevDeltaM:0}).gapPace;});
  return{stdSec:std(gp),cvPct:(std(gp)/mean(gp))*100};
}
function trimpSeg(min,hr,rep,max){if(!hr||!rep||!max||max<=rep)return null;var fcr=clamp((hr-rep)/(max-rep),0,1);return min*fcr*0.64*Math.exp(1.92*fcr);}
function maxFor(w,a){return (isBike(w)&&a.bikeFcMax)?a.bikeFcMax:a.fcMax;}
function computeTrimp(w,a){
  if(!a.fcRep||!a.fcMax)return null;
  var mx=maxFor(w,a);
  if(w.splits&&w.splits.length&&w.splits.every(function(s){return s.hrAvg;})){var t=0;for(var i=0;i<w.splits.length;i++)t+=trimpSeg(w.splits[i].timeSec/60,w.splits[i].hrAvg,a.fcRep,mx)||0;return t;}
  if(!w.hrAvg||!w.durationSec)return null;
  return trimpSeg(w.durationSec/60,w.hrAvg,a.fcRep,mx);
}
function computeHrCostKm(w){var g=computeGap(w);if(!g.gapSpeed||!w.hrAvg)return null;return w.hrAvg/g.gapSpeed;}
function hrZone(hr,rep,max){if(!hr||!rep||!max||max<=rep)return null;var p=(hr-rep)/(max-rep);return p<0.59?1:p<0.74?2:p<0.84?3:p<0.88?4:5;}
function zoneBoundsFor(w,a){if(isBike(w)&&a.bikeZones&&a.bikeZones.length===5)return [a.bikeZones[1],a.bikeZones[2],a.bikeZones[3],a.bikeZones[4]];return null;}
function hrZoneBounds(hr,b){if(!hr)return null;if(hr<b[0])return 1;if(hr<b[1])return 2;if(hr<b[2])return 3;if(hr<b[3])return 4;return 5;}
function zonesFromHist(hist,rep,max){if(!hist)return null;var z=[0,0,0,0,0];for(var bpm in hist){var zone=hrZone(+bpm,rep,max);if(zone)z[zone-1]+=hist[bpm];}return z;}
function zonesFromHistBounds(hist,b){if(!hist)return null;var z=[0,0,0,0,0];for(var bpm in hist){var zn=hrZoneBounds(+bpm,b);if(zn)z[zn-1]+=hist[bpm];}return z;}
function zoneSeconds(w,a){var b=zoneBoundsFor(w,a),mx=maxFor(w,a);
  if(w.hrHist){var z=b?zonesFromHistBounds(w.hrHist,b):zonesFromHist(w.hrHist,a.fcRep,mx);if(z&&z.some(function(x){return x>0;}))return z;}
  if(w.hrAvg&&w.durationSec){var zn=b?hrZoneBounds(w.hrAvg,b):hrZone(w.hrAvg,a.fcRep,mx);if(zn){var zz=[0,0,0,0,0];zz[zn-1]=w.durationSec;return zz;}}
  return null;}
function polarization(ws,a){var zt=[0,0,0,0,0];ws.forEach(function(w){var z=zoneSeconds(w,a);if(z)for(var i=0;i<5;i++)zt[i]+=z[i];});var tot=zt.reduce(function(x,y){return x+y;},0);if(!tot)return null;return{easyPct:((zt[0]+zt[1])/tot)*100,totalSec:tot,zones:zt};}
function trainingDistribution(ws,a){var pol=polarization(ws,a);if(!pol)return null;var z=pol.zones,t=pol.totalSec;return{zones:z,totalSec:t,bands:{facil:z[0]+z[1],moderado:z[2],forte:z[3]+z[4]},pct:{facil:(z[0]+z[1])/t*100,moderado:z[2]/t*100,forte:(z[3]+z[4])/t*100}};}
function hillPerformance(w){
  if(!w.splits||w.splits.length<3)return null;
  var km=w.splits.filter(function(s){return s.elevDeltaM!=null&&s.timeSec>0;}).map(function(s){var dist=(s.distKm||1)*1000;return{grade:s.elevDeltaM/((s.distKm||1)*10),speed:dist/s.timeSec,hr:s.hrAvg,gain:s.elevDeltaM>0?s.elevDeltaM:0};});
  if(!km.length)return null;
  var flat=km.filter(function(k){return Math.abs(k.grade)<1;}),up=km.filter(function(k){return k.grade>=1.5;});
  var flatSpeed=flat.length?median(flat.map(function(k){return k.speed;})):null;
  var flatHr=flat.length?mean(flat.filter(function(k){return k.hr;}).map(function(k){return k.hr;})):null;
  var gain=km.reduce(function(a2,k){return a2+k.gain;},0);
  if(!up.length||!flatSpeed)return{climbKm:up.length,gainM:Math.round(gain),effVsModel:null,speedLossPctPerGrade:null,hrExtra:null};
  var effs=up.map(function(k){return k.speed/(flatSpeed/gradeCostMult(k.grade));});
  var lossPer=mean(up.map(function(k){return (flatSpeed-k.speed)/flatSpeed*100/k.grade;}));
  var hrExtra=flatHr&&up.some(function(k){return k.hr;})?mean(up.filter(function(k){return k.hr;}).map(function(k){return k.hr;}))-flatHr:null;
  return{climbKm:up.length,gainM:Math.round(gain),effVsModel:mean(effs),speedLossPctPerGrade:lossPer,hrExtra:hrExtra!=null?Math.round(hrExtra):null};
}
function hillAggregate(ws){var rows=ws.map(hillPerformance).filter(function(h){return h&&h.effVsModel!=null;});if(!rows.length)return null;return{sessions:rows.length,effVsModel:mean(rows.map(function(r){return r.effVsModel;})),speedLossPctPerGrade:mean(rows.map(function(r){return r.speedLossPctPerGrade;})),totalClimbM:ws.reduce(function(a2,w){var h=hillPerformance(w);return a2+(h?h.gainM:0);},0)};}
function median(arr){if(!arr.length)return 0;var s=arr.slice().sort(function(x,y){return x-y;});var m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;}
function hrGradeBand(g){if(g>5)return 0;if(g>2)return 1;if(g>=-2)return 2;if(g>=-5)return 3;return 4;}
var HR_GRADE_BANDS=[">5%","2–5%","±2% (plano)","−5 a −2%","<−5%"];
function hrGradeCost(runs){
  var ok={facil:1,"longão":1,regenerativo:1,tempo:1};
  var cand=(runs||[]).filter(function(w){return !isBike(w)&&w.splits&&w.splits.length&&ok[w.type];})
    .sort(function(x,y){return x.date<y.date?1:-1;}).slice(0,12);
  var pool=[];
  cand.forEach(function(w){w.splits.forEach(function(s){
    if(s.hrAvg==null||!s.timeSec||s.elevDeltaM==null)return;
    var d=s.distKm||1,grade=clamp(s.elevDeltaM/(d*10),-35,35),gt=s.timeSec/gradeCostMult(grade);
    pool.push({grade:grade,vgap:(d*1000)/gt,hr:s.hrAvg,min:s.timeSec/60});
  });});
  if(pool.length<10)return null;
  var flat=pool.filter(function(p){return Math.abs(p.grade)<=2;});
  if(flat.length<5)return null;
  // base robusta: FC média no plano (ponderada por minuto) — sempre vale, mesmo em ritmo estável
  var fm=0,fw=0;flat.forEach(function(p){fm+=p.min*p.hr;fw+=p.min;});
  var meanFlatHr=fm/fw;
  var predict=function(){return meanFlatHr;};
  // refinamento: regressão FC ≈ a + b·v_GAP só quando há variação real de v_GAP (senão é instável)
  if(flat.length>=8&&std(flat.map(function(p){return p.vgap;}))>=0.15){
    var n=0,sx=0,sy=0,sxx=0,sxy=0;
    flat.forEach(function(p){n++;sx+=p.vgap;sy+=p.hr;sxx+=p.vgap*p.vgap;sxy+=p.vgap*p.hr;});
    var den=n*sxx-sx*sx;
    if(den>0){var b=(n*sxy-sx*sy)/den,a=(sy-b*sx)/n;if(b>0&&b<80)predict=function(v){return a+b*v;};}
  }
  var acc=HR_GRADE_BANDS.map(function(){return{min:0,wr:0};});
  pool.forEach(function(p){var bi=hrGradeBand(p.grade),r=p.hr-predict(p.vgap);acc[bi].min+=p.min;acc[bi].wr+=p.min*r;});
  var bands=acc.map(function(x,i){return{lab:HR_GRADE_BANDS[i],min:x.min,resid:x.min>0?x.wr/x.min:null};});
  function wres(idxs){var m=0,w=0;idxs.forEach(function(i){m+=acc[i].min;w+=acc[i].wr;});return m>0?w/m:null;}
  return {bands:bands,upCost:wres([0,1]),downDev:wres([3,4]),nSplits:pool.length,nRuns:cand.length,flatN:flat.length};
}
function metricTrend(entries,key,refDate,baseDays){baseDays=baseDays||14;var rows=entries.filter(function(e){return e[key]!=null&&(!refDate||e.date<=refDate);}).sort(function(a,b){return a.date<b.date?1:-1;});if(!rows.length)return null;var latest=rows[0];var ref=refDate?new Date(refDate+"T00:00:00"):new Date(latest.date+"T00:00:00");var base=rows.slice(1).filter(function(e){var days=Math.round((ref-new Date(e.date+"T00:00:00"))/86400000);return days>=1&&days<=baseDays;});var baseline=base.length?median(base.map(function(e){return e[key];})):null;var deltaAbs=baseline!=null?latest[key]-baseline:null;var deltaPct=baseline?deltaAbs/baseline*100:null;return{latest:latest[key],date:latest.date,baseline:baseline,deltaAbs:deltaAbs,deltaPct:deltaPct};}
function latestDaily(entries,key,refDate){var rows=entries.filter(function(e){return e[key]!=null&&(!refDate||e.date<=refDate);}).sort(function(a,b){return a.date<b.date?1:-1;});return rows.length?{value:rows[0][key],date:rows[0].date}:null;}
function sleepEntriesAll(){
  var by={};
  (state.daily||[]).forEach(function(e){if(e&&e.sleepH!=null)by[e.date]={date:e.date,sleepH:e.sleepH};});
  (state.workouts||[]).forEach(function(w){if(w&&w.sleepH!=null&&!by[w.date])by[w.date]={date:w.date,sleepH:w.sleepH};});
  return Object.keys(by).sort().map(function(k){return by[k];});
}
function sleepLatest(refDate){return latestDaily(sleepEntriesAll(),"sleepH",refDate);}
function recoveryStatus(c){var s=100;if(c.restingDelta!=null)s-=clamp(c.restingDelta*5,-8,30);if(c.hrvDeltaPct!=null)s+=clamp(c.hrvDeltaPct*0.5,-25,12);if(c.sleepH!=null)s-=clamp((7.5-c.sleepH)*6,-6,24);if(c.tsb!=null&&c.tsb<-20)s-=clamp((-c.tsb-20)*0.6,0,15);s=Math.round(clamp(s,0,100));return{score:s,label:s>=75?"Good":s>=55?"Moderate":"Needs Recovery"};}
function dailyLoads(ws,a){var m={};ws.forEach(function(w){var t=computeTrimp(w,a);if(t==null)return;m[w.date]=(m[w.date]||0)+t;});return m;}
function fitnessSeries(ws,a,asOf){
  var loads=dailyLoads(ws,a),dates=Object.keys(loads).sort();
  if(!dates.length)return[];
  var out=[],ctl=0,atl=0,kC=1-Math.exp(-1/42),kA=1-Math.exp(-1/7);
  var d=new Date(dates[0]+"T00:00:00"),end=new Date(dates[dates.length-1]+"T00:00:00");
  // Estende a série até hoje (ou asOf) com cargas zero: assim CTL/ATL/TSB refletem o
  // frescor REAL de hoje, decaindo nos dias de descanso — e não congelam no último treino.
  var ref=asOf?new Date(asOf+"T00:00:00"):new Date();ref.setHours(0,0,0,0);
  if(ref>end)end=ref;
  while(d<=end){var iso=mIsoLocal(d),load=loads[iso]||0,tsb=ctl-atl;ctl+=kC*(load-ctl);atl+=kA*(load-atl);out.push({date:iso,load:load,ctl:ctl,atl:atl,tsb:tsb});d.setDate(d.getDate()+1);}
  return out;
}
function acuteChronic(ws,a,refDate){
  var loads=dailyLoads(ws,a);var keys=Object.keys(loads);if(!keys.length)return null;
  // Referência = hoje por padrão (ou asOf), nunca antes do último treino: a janela aguda
  // (7d) decai nos dias de descanso em vez de ficar presa na data do último treino.
  var ref;
  if(refDate){ref=new Date(refDate+"T00:00:00");}
  else{ref=new Date();ref.setHours(0,0,0,0);var last=new Date(keys.sort()[keys.length-1]+"T00:00:00");if(last>ref)ref=last;}
  var acute=0,chronic=0;
  keys.forEach(function(iso){var days=Math.round((ref-new Date(iso+"T00:00:00"))/86400000);if(days>=0&&days<7)acute+=loads[iso];if(days>=0&&days<28)chronic+=loads[iso];});
  var c7=chronic/4;if(c7<=0)return null;var r=acute/c7;
  var zone=r<0.8?"baixa":r<=1.3?"sweet spot":r<=1.5?"atenção":"risco";
  return{ratio:r,zone:zone,acute:acute,chronicAvg7:c7};
}
function performanceTrend(series,win){
  win=win||4;if(series.length<2)return null;
  var cur=series.slice(-win),prev=series.slice(-2*win,-win);if(!prev.length)return null;
  var dc=mean(cur.map(function(x){return x.value;})),dp=mean(prev.map(function(x){return x.value;}));
  var delta=(dc-dp)/dp,arrow=delta>0.02?"↗":delta<-0.02?"↘":"→";
  return{arrow:arrow,deltaPct:delta*100,enough:cur.length>=3&&prev.length>=3};
}
function riegel(d1,t1,d2){return t1*Math.pow(d2/d1,1.06);}
function racePredictions(d1,t1){return[{name:"5 km",d:5},{name:"10 km",d:10},{name:"21,1 km",d:21.0975},{name:"42,2 km",d:42.195}].map(function(t){var tm=riegel(d1,t1,t.d);return{name:t.name,d:t.d,timeSec:tm,paceSec:tm/t.d};});}
function vo2Band(v){if(v==null)return null;return v<36?"abaixo":v<=42?"bom":v<=52?"excelente":"superior";}
function isoWeekKey(iso){var d=new Date(iso+"T00:00:00");var day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day+3);var f=new Date(Date.UTC(d.getUTCFullYear(),0,4));var wk=1+Math.round(((d-f)/86400000-3+((f.getUTCDay()+6)%7))/7);return d.getUTCFullYear()+"-W"+String(wk).padStart(2,"0");}
function consistency(ws,target){
  if(!ws.length)return null;var days={};ws.forEach(function(w){days[w.date]=1;});
  var byWeek={};ws.forEach(function(w){var k=isoWeekKey(w.date);byWeek[k]=(byWeek[k]||0)+1;});
  var weeks=Object.keys(byWeek),tgt=target||1;
  // crédito parcial: cada semana vale min(1, sessões/alvo) — degrada com suavidade
  var credit=weeks.reduce(function(s,k){return s+Math.min(1,byWeek[k]/tgt);},0);
  var met=weeks.filter(function(k){return byWeek[k]>=tgt;}).length;
  return{activeDays:Object.keys(days).length,weeks:weeks.length,metWeeks:met,adherencePct:weeks.length?(credit/weeks.length)*100:0};
}
function performanceScore(c){
  var eff=clamp(50+(c.efTrendPct||0)*5,0,100);
  var cons=clamp(c.adherencePct!=null?c.adherencePct:60,0,100);
  var fat=c.decoupling!=null?clamp(100-Math.max(0,c.decoupling)*8,0,100):70;
  var vol=c.targetKm?clamp((c.weeklyKm/c.targetKm)*100,0,100):clamp((c.weeklyKm||0)*2,0,100);
  var recup=c.recovery!=null?clamp(c.recovery,0,100):70;  // recuperação (sono + HRV + FC repouso) — quando sem dado, neutro
  var overall=Math.round(0.26*eff+0.22*cons+0.22*fat+0.15*vol+0.15*recup);
  return{overall:overall,parts:{"Eficiência":Math.round(eff),"Consistência":Math.round(cons),"Resist. fadiga":Math.round(fat),"Volume":Math.round(vol),"Recuperação":Math.round(recup)}};
}
function readiness(c){
  var s=75;
  if(c.tsb!=null)s+=clamp(c.tsb,-25,15);
  if(c.adherencePct!=null)s+=(c.adherencePct-70)*0.1;
  if(c.sleepH!=null)s+=clamp((c.sleepH-7)*4,-12,8);
  if(c.soreness!=null)s-=c.soreness*2.5;
  if(c.pain)s-=25;
  if(c.restingDelta!=null)s-=clamp(c.restingDelta*3,-6,18);
  if(c.hrvDeltaPct!=null)s+=clamp(c.hrvDeltaPct*0.3,-12,8);
  s=Math.round(clamp(s,0,100));
  var band=s>=90?"Peak Ready":s>=80?"Ready":s>=70?"Moderate":s>=60?"Caution":"Recovery";
  return{score:s,band:band};
}
function fitNum(x){return typeof x==="number"&&isFinite(x)?x:null;}
function fitISODate(d){if(!(d instanceof Date)||isNaN(d))return null;return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function fitCadence(rpm){if(rpm==null)return null;return rpm<130?Math.round(rpm*2):Math.round(rpm);}
var SEMI=180/2147483648;
function fitNormRecords(rec){
  return (rec||[]).map(function(r){return{
    t:r.timestamp instanceof Date?r.timestamp.getTime()/1000:fitNum(r.timestamp),
    dist:fitNum(r.distance),
    speed:fitNum(r.enhancedSpeed)!=null?fitNum(r.enhancedSpeed):fitNum(r.speed),
    hr:fitNum(r.heartRate),
    alt:fitNum(r.enhancedAltitude)!=null?fitNum(r.enhancedAltitude):fitNum(r.altitude),
    cad:fitNum(r.cadence)!=null?fitNum(r.cadence)+(fitNum(r.fractionalCadence)||0):null,
    lat:fitNum(r.positionLat)!=null?r.positionLat*SEMI:null,
    lon:fitNum(r.positionLong)!=null?r.positionLong*SEMI:null,
    temp:fitNum(r.temperature)
  };}).filter(function(r){return r.t!=null;}).sort(function(a,b){return a.t-b.t;});
}
function fitInterpAlt(records,target){
  for(var i=1;i<records.length;i++){var a=records[i-1],b=records[i];if(a.dist==null||b.dist==null)continue;
    if(b.dist>=target&&a.dist<=target){var span=b.dist-a.dist,f=span>0?(target-a.dist)/span:0;var va=a.alt,vb=b.alt;if(va==null||vb==null)return vb!=null?vb:va;return va+(vb-va)*f;}}
  return null;
}
function fitInterpTime(records,target){
  for(var i=1;i<records.length;i++){var a=records[i-1],b=records[i];if(a.dist==null||b.dist==null)continue;
    if(b.dist>=target&&a.dist<=target){var span=b.dist-a.dist,f=span>0?(target-a.dist)/span:0;return a.t+(b.t-a.t)*f;}}
  return null;
}
function fitBuildSplits(records){
  if(records.length<8)return null;
  var totalDist=records[records.length-1].dist;
  if(!totalDist||totalDist<1200)return null;
  var nKm=Math.floor(totalDist/1000),splits=[],prevT=records[0].t;
  var prevAlt=fitInterpAlt(records,0);if(prevAlt==null)prevAlt=records[0].alt;
  for(var k=1;k<=nKm;k++){
    var target=k*1000,tAt=fitInterpTime(records,target),altAt=fitInterpAlt(records,target);
    if(tAt==null)break;
    var seg=records.filter(function(r){return r.dist!=null&&r.dist>=(k-1)*1000&&r.dist<target&&r.hr!=null;});
    var hrAvg=seg.length?Math.round(seg.reduce(function(s,r){return s+r.hr;},0)/seg.length):null;
    var elev=altAt!=null&&prevAlt!=null?Math.round((altAt-prevAlt)*10)/10:null;
    splits.push({distKm:1,timeSec:Math.round(tAt-prevT),hrAvg:hrAvg,elevDeltaM:elev});
    prevT=tAt;prevAlt=altAt;
  }
  var rest=totalDist-nKm*1000;
  if(rest>150){
    var tEnd=records[records.length-1].t;
    var seg2=records.filter(function(r){return r.dist!=null&&r.dist>=nKm*1000&&r.hr!=null;});
    var hr2=seg2.length?Math.round(seg2.reduce(function(s,r){return s+r.hr;},0)/seg2.length):null;
    var altEnd=records[records.length-1].alt;
    var elev2=altEnd!=null&&prevAlt!=null?Math.round((altEnd-prevAlt)*10)/10:null;
    splits.push({distKm:Math.round(rest/10)/100,timeSec:Math.round(tEnd-prevT),hrAvg:hr2,elevDeltaM:elev2});
  }
  return splits.length?splits:null;
}
function fitAscentDescent(records){
  var up=0,down=0,last=null;
  for(var i=0;i<records.length;i++){var r=records[i];if(r.alt==null)continue;if(last!=null){var d=r.alt-last;if(d>0.2)up+=d;else if(d<-0.2)down+=-d;}last=r.alt;}
  return{up:Math.round(up),down:Math.round(down)};
}
function fitHrHist(records){
  var hist={},any=false;
  for(var i=0;i<records.length;i++){
    var r=records[i];if(r.hr==null)continue;any=true;
    var dt=i<records.length-1?records[i+1].t-r.t:1;
    if(!(dt>0)||dt>30)dt=1;
    var k=Math.round(r.hr);hist[k]=(hist[k]||0)+dt;
  }
  return any?hist:null;
}
function strSpm(cad){if(cad==null)return null;return cad<130?Math.round(cad*2):Math.round(cad);}
function vGap(speed,grade){if(speed==null||grade==null)return null;return speed*gradeCostMult(grade);}
function recordingMode(records,smartThresholdS){smartThresholdS=smartThresholdS||1.5;
  var recs=(records||[]).filter(function(r){return r&&fitNum(r.t)!=null;}).sort(function(a,b){return a.t-b.t;}),dts=[];
  for(var i=1;i<recs.length;i++){var d=recs[i].t-recs[i-1].t;if(d>0)dts.push(d);}
  var medianDt=dts.length?median(dts):1;return{medianDt:medianDt,smart:medianDt>smartThresholdS};}
function pauseWindows(events){var evs=(events||[]).filter(function(e){return e&&fitNum(e.t)!=null;}).sort(function(a,b){return a.t-b.t;}),wins=[],openStop=null;
  for(var i=0;i<evs.length;i++){var e=evs[i];if(e.type==="stop"){if(openStop==null)openStop=e.t;}else if(e.type==="start"){if(openStop!=null){wins.push([openStop,e.t]);openStop=null;}}}
  return wins;}
function resampleHz(records,opts){
  var o={hz:1,lacunaMaxS:30,impliedTol:0.3,pauseGapS:3,pauseMaxSpeed:0.3,pauses:[]};if(opts)for(var kk in opts)o[kk]=opts[kk];
  var recs=(records||[]).filter(function(r){return r&&fitNum(r.t)!=null;}).sort(function(a,b){return a.t-b.t;});
  var step=1/o.hz,meta={pauseSec:0,interpSec:0,invalidSec:0,movingSec:0};
  if(recs.length<2)return{samples:[],meta:meta};
  var pw=(o.pauses||[]).map(function(p){return[p[0],p[1]];}),fields=["dist","speed","hr","alt","cad"];
  function inPauseWin(ta,tb){var c=(ta+tb)/2;for(var i=0;i<pw.length;i++)if(c>=pw[i][0]-1&&c<=pw[i][1]+1)return true;return false;}
  function lerp(a,b,f,k){var va=fitNum(a[k]),vb=fitNum(b[k]);return va==null?vb:(vb==null?va:va+(vb-va)*f);}
  var out=[],movT=0;
  for(var i=0;i<recs.length-1;i++){
    var a=recs[i],b=recs[i+1],dt=b.t-a.t;if(dt<=0)continue;
    var dd=(fitNum(a.dist)!=null&&fitNum(b.dist)!=null)?b.dist-a.dist:null,vimp=dd!=null?dd/dt:null;
    var sp=[a.speed,b.speed].filter(function(x){return fitNum(x)!=null;}),vnb=sp.length?sp.reduce(function(s,x){return s+x;},0)/sp.length:vimp;
    var isPause=inPauseWin(a.t,b.t)||(dt>o.pauseGapS&&((vimp!=null&&vimp<o.pauseMaxSpeed)||(dd!=null&&dd<1))),cls;
    if(isPause)cls="pause";
    else if(dt<=step+1e-6)cls="normal";
    else if(dt<=o.lacunaMaxS&&(vimp==null||vnb==null||Math.abs(vimp-vnb)<=o.impliedTol*Math.max(vnb,0.3)))cls="interp";
    else cls="invalid";
    if(cls==="pause"){meta.pauseSec+=dt;continue;}
    if(cls==="invalid"){meta.invalidSec+=dt;movT+=dt;continue;}
    if(cls==="interp")meta.interpSec+=dt;
    var steps=Math.max(1,Math.round(dt/step));
    for(var s2=0;s2<steps;s2++){var f=s2/steps,smp={t:Math.round((movT+s2*step)*1000)/1000,interp:cls==="interp"};for(var k=0;k<fields.length;k++)smp[fields[k]]=lerp(a,b,f,fields[k]);out.push(smp);}
    movT+=dt;
  }
  var last=recs[recs.length-1],lf={t:Math.round(movT*1000)/1000,interp:false};for(var k2=0;k2<fields.length;k2++)lf[fields[k2]]=fitNum(last[fields[k2]]);out.push(lf);
  meta.movingSec=movT;return{samples:out,meta:meta};
}
function gradeSeries(samples,winM,clipPct){
  winM=winM||50;clipPct=clipPct||25;var n=samples.length,grade=[];for(var q=0;q<n;q++)grade.push(null);
  if(!n||samples[0].dist==null)return grade;
  var half=winM/2,altSm=[];
  for(var i=0;i<n;i++){var d=samples[i].dist;if(d==null){altSm.push(null);continue;}var sum=0,cnt=0;
    for(var k=i;k>=0&&d-samples[k].dist<=half;k--){if(samples[k].alt!=null){sum+=samples[k].alt;cnt++;}}
    for(var k2=i+1;k2<n&&samples[k2].dist-d<=half;k2++){if(samples[k2].alt!=null){sum+=samples[k2].alt;cnt++;}}
    altSm.push(cnt?sum/cnt:samples[i].alt);}
  for(var m=0;m<n;m++){var dm=samples[m].dist;if(dm==null)continue;var lo=m,hi=m;
    while(lo>0&&dm-samples[lo].dist<half)lo--;while(hi<n-1&&samples[hi].dist-dm<half)hi++;
    var dd=samples[hi].dist-samples[lo].dist;
    if(dd>1&&altSm[lo]!=null&&altSm[hi]!=null)grade[m]=clamp(((altSm[hi]-altSm[lo])/dd)*100,-clipPct,clipPct);else grade[m]=0;}
  return grade;
}
function preprocess(records,opts){
  var o={hz:1,lacunaMaxS:30,smartThresholdS:1.5,impliedTol:0.3,pauseGapS:3,pauseMaxSpeed:0.3,pauses:[],winM:50,firstMin:10,minSpeed:1.5,walkSpm:140,hrJump:15,gradeRegLimit:15};
  if(opts)for(var kk in opts)o[kk]=opts[kk];
  var mode=recordingMode(records,o.smartThresholdS);
  var rsOut=resampleHz(records,o),raw=rsOut.samples,meta=rsOut.meta,grade=gradeSeries(raw,o.winM);
  var hasHR=raw.some(function(s){return s.hr!=null;}),hasCad=raw.some(function(s){return s.cad!=null;}),hasAlt=raw.some(function(s){return s.alt!=null;});
  var reasons={},samples=[],prevHr=null,prevT=null,firstMinSec=0;
  function bump(k){reasons[k]=(reasons[k]||0)+1;}
  for(var i=0;i<raw.length;i++){
    var r=raw[i],spm=strSpm(r.cad),g=grade[i];
    var s={t:r.t,spd:r.speed!=null?Math.round(r.speed*1000)/1000:null,grade:g!=null?Math.round(g*10)/10:null,hr:r.hr!=null?Math.round(r.hr):null,spm:spm,vgap:vGap(r.speed,g),valid:true,inReg:true,interp:!!r.interp};
    var hrArt=false;
    if(s.hr!=null&&prevHr!=null&&prevT!=null){var dt=r.t-prevT;if(dt>0&&Math.abs(s.hr-prevHr)/dt>o.hrJump)hrArt=true;}
    if(s.hr!=null){prevHr=s.hr;prevT=r.t;}
    if(r.t<o.firstMin*60){s.valid=false;bump("primeiros "+o.firstMin+" min");firstMinSec++;}
    if(s.spd!=null&&s.spd<o.minSpeed){s.valid=false;bump("parado/<"+o.minSpeed+" m/s");}
    if(spm!=null&&spm<o.walkSpm){s.valid=false;bump("caminhada (spm<"+o.walkSpm+")");}
    if(hrArt){s.valid=false;bump("artefato de FC");}
    if(s.hr==null){s.valid=false;bump("sem FC");}
    if(g!=null&&Math.abs(g)>o.gradeRegLimit)s.inReg=false;
    samples.push(s);
  }
  var movingSec=samples.length,validArr=samples.filter(function(s){return s.valid;}),validN=validArr.length;
  var excludedPct=movingSec?Math.round((1-validN/movingSec)*1000)/10:100;
  var hrValid=validArr.map(function(s){return s.hr;}).filter(function(x){return x!=null;}),medianHrValid=hrValid.length?Math.round(median(hrValid)):null;
  var quality={movingSec:movingSec,pauseSec:Math.round(meta.pauseSec),interpSec:Math.round(meta.interpSec),invalidGapSec:Math.round(meta.invalidSec),
    firstMinSec:firstMinSec,validSec:validN,validMin:Math.round(validN/60*10)/10,excludedPct:excludedPct,reasons:reasons,hasHR:hasHR,hasCad:hasCad,hasAlt:hasAlt,
    smart:mode.smart,medianDt:Math.round(mode.medianDt*10)/10,medianHrValid:medianHrValid,
    needsConfirm:(!hasHR||!hasCad||!hasAlt||excludedPct>20||meta.invalidSec>60)};
  return{samples:samples,grade:grade,quality:quality};
}
function reduceStream(samples,everyS){everyS=everyS||3;var s=[],next=0;for(var i=0;i<samples.length;i++){var x=samples[i];if(x.t+1e-9>=next){s.push({t:Math.round(x.t),spd:x.spd,grade:x.grade,hr:x.hr,spm:x.spm,v:x.valid?1:0});next=x.t+everyS;}}return{everyS:everyS,n:s.length,s:s};}
function expandStream(stream){if(!stream||!stream.s)return [];return stream.s.map(function(x){return{t:x.t,spd:x.spd,grade:x.grade,hr:x.hr,spm:x.spm,vgap:vGap(x.spd,x.grade),valid:x.v!==0,inReg:true};});}
function theilSen(xs,ys){var n=xs.length,slopes=[];for(var i=0;i<n;i++)for(var j=i+1;j<n;j++){var dx=xs[j]-xs[i];if(Math.abs(dx)<1e-9)continue;slopes.push((ys[j]-ys[i])/dx);}if(!slopes.length)return null;var b=median(slopes);var a=median(xs.map(function(x,ii){return ys[ii]-b*x;}));var yb=ys.reduce(function(s,y){return s+y;},0)/n,ssTot=0,ssRes=0;for(var m=0;m<n;m++){var pred=a+b*xs[m];ssRes+=(ys[m]-pred)*(ys[m]-pred);ssTot+=(ys[m]-yb)*(ys[m]-yb);}var r2=ssTot>0?1-ssRes/ssTot:0;return{a:a,b:b,r2:r2,n:n};}
function sampleDt(samples){var d=[];for(var i=1;i<samples.length;i++){var x=samples[i].t-samples[i-1].t;if(x>0)d.push(x);}return median(d)||1;}
function hrLag(samples,maxLagS){maxLagS=maxLagS||90;var dt=sampleDt(samples);
  var v=samples.map(function(s){return s.valid?s.vgap:null;}),hr=samples.map(function(s){return s.valid?s.hr:null;});
  function corrAt(lagIdx){var xs=[],ys=[];for(var i=0;i+lagIdx<samples.length;i++)if(v[i]!=null&&hr[i+lagIdx]!=null){xs.push(v[i]);ys.push(hr[i+lagIdx]);}
    if(xs.length<30)return -2;var mx=xs.reduce(function(s,x){return s+x;},0)/xs.length,my=ys.reduce(function(s,y){return s+y;},0)/ys.length,nu=0,dx=0,dy=0;
    for(var k=0;k<xs.length;k++){var a=xs[k]-mx,bb=ys[k]-my;nu+=a*bb;dx+=a*a;dy+=bb*bb;}return dx>0&&dy>0?nu/Math.sqrt(dx*dy):-2;}
  var best=0,bestC=-2;for(var lag=0;lag<=maxLagS;lag+=dt){var c=corrAt(Math.round(lag/dt));if(c>bestC){bestC=c;best=Math.round(lag);}}
  return{lagSec:best,corr:bestC>=-1?Math.round(bestC*1000)/1000:null};}
function paceGapAtHR(samples,opts){
  var o={fcRef:145,band:3,lagSec:0,win:[10,45]};if(opts)for(var kk in opts)o[kk]=opts[kk];
  var w0=o.win[0]*60,w1=o.win[1]*60,dt=sampleDt(samples),lagIdx=Math.round(o.lagSec/dt),inWin=[];
  for(var i=0;i<samples.length;i++){var s=samples[i],j=i+lagIdx;if(!s.valid||s.vgap==null||s.t<w0||s.t>w1)continue;
    var hrL=(j<samples.length&&samples[j]&&samples[j].hr!=null&&samples[j].valid)?samples[j].hr:null;if(hrL==null)continue;inWin.push({vgap:s.vgap,hr:hrL});}
  function toPace(v){return v>0?1000/v:null;}
  if(!inWin.length)return{paceSec:null,vGap:null,confidence:"Dados insuficientes",minInBand:0,method:null};
  var hrs=inWin.map(function(p){return p.hr;}),hrMin=Math.min.apply(null,hrs),hrMax=Math.max.apply(null,hrs);
  var band=inWin.filter(function(p){return Math.abs(p.hr-o.fcRef)<=o.band;}),minInBand=Math.round((band.length*dt)/60*10)/10;
  if(minInBand>=8){var v=median(band.map(function(p){return p.vgap;}));return{paceSec:toPace(v),vGap:v,confidence:minInBand>=15?"Alta":"Moderada",minInBand:minInBand,method:"mediana"};}
  if(o.fcRef>=hrMin&&o.fcRef<=hrMax){var fit=theilSen(inWin.map(function(p){return p.vgap;}),inWin.map(function(p){return p.hr;}));
    if(fit&&Math.abs(fit.b)>1e-6){var vv=(o.fcRef-fit.a)/fit.b;if(vv>0)return{paceSec:toPace(vv),vGap:vv,confidence:fit.r2>=0.5?"Moderada":"Baixa",minInBand:minInBand,method:"regressão",r2:Math.round(fit.r2*100)/100};}
    if(band.length){var v2=median(band.map(function(p){return p.vgap;}));return{paceSec:toPace(v2),vGap:v2,confidence:"Baixa",minInBand:minInBand,method:"mediana"};}}
  return{paceSec:null,vGap:null,confidence:"Dados insuficientes",minInBand:0,method:null,hrRange:[hrMin,hrMax]};
}
function pruneStreams(workouts,keepRecent){keepRecent=keepRecent||20;var ws=(workouts||[]).filter(function(w){return w&&w.stream;}).sort(function(a,b){return a.date<b.date?1:(a.date>b.date?-1:0);});var dropped=0;ws.forEach(function(w,i){if(i>=keepRecent){delete w.stream;w.streamPruned=true;dropped++;}});return dropped;}
function sessionEff(samples,win){win=win||[10,1e9];var w0=win[0]*60,w1=win[1]*60,dt=sampleDt(samples),vg=[],hr=[],spm=[];
  for(var i=0;i<samples.length;i++){var s=samples[i];if(!s.valid||s.t<w0||s.t>w1||s.vgap==null||s.hr==null||s.spm==null)continue;vg.push(s.vgap);hr.push(s.hr);spm.push(s.spm);}
  var validMin=Math.round((vg.length*dt)/60*10)/10;if(vg.length<30)return null;
  function mean(a){return a.reduce(function(s,x){return s+x;},0)/a.length;}
  var vgapMean=mean(vg),hrMean=mean(hr),spmMean=mean(spm);
  return{vgapMean:vgapMean,hrMean:hrMean,spmMean:spmMean,mPerBeat:vgapMean*60/hrMean,stepsPerBeat:spmMean/hrMean,mPerStep:vgapMean*60/spmMean,validMin:validMin,n:vg.length};}
function effTree(cur,prevAvg,neutralPct){neutralPct=neutralPct||2;if(!cur)return null;var out={cur:cur,prevAvg:prevAvg||null};
  if(!prevAvg){out.label="Primeira sessão com stream — sem comparação ainda";return out;}
  function ln(a,b){return a>0&&b>0?Math.log(a/b):0;}
  var dSb=ln(cur.stepsPerBeat,prevAvg.stepsPerBeat),dMs=ln(cur.mPerStep,prevAvg.mPerStep);
  out.dln={mPerBeat:dSb+dMs,stepsPerBeat:dSb,mPerStep:dMs};
  var denom=Math.abs(dSb)+Math.abs(dMs);out.contribPct=denom>1e-9?{stepsPerBeat:dSb/denom*100,mPerStep:dMs/denom*100}:{stepsPerBeat:0,mPerStep:0};
  var cadDeltaPct=(cur.spmMean/prevAvg.spmMean-1)*100,efDeltaPct=(cur.mPerBeat/prevAvg.mPerBeat-1)*100;out.cadDeltaPct=cadDeltaPct;out.efDeltaPct=efDeltaPct;
  var cadUp=cadDeltaPct>neutralPct,cadStable=Math.abs(cadDeltaPct)<=neutralPct,efUp=efDeltaPct>neutralPct,efDown=efDeltaPct<-neutralPct,efNeutral=Math.abs(efDeltaPct)<=neutralPct;
  var label="Variação dentro do normal";
  if(cadUp&&efNeutral)label="Passada encurtou sem custo — ganho mecânico";else if(cadUp&&efUp)label="Economia";else if(cadUp&&efDown)label="Cadência com custo — revisar";else if(cadStable&&efUp)label="Motor: mais passada na mesma FC";
  out.label=label;return out;}
function cadenceAtPace(samples,opts){var o={paceRef:null,tol:15,win:[10,45],adher:[170,176],minMin:5};if(opts)for(var kk in opts)o[kk]=opts[kk];
  var w0=o.win[0]*60,w1=o.win[1]*60,dt=sampleDt(samples),inRange=[],moving=0,adhN=0;
  for(var i=0;i<samples.length;i++){var s=samples[i];if(!s.valid||s.t<w0||s.t>w1||s.spm==null)continue;moving++;if(s.spm>=o.adher[0]&&s.spm<=o.adher[1])adhN++;if(o.paceRef!=null&&s.vgap!=null&&s.vgap>0&&Math.abs(1000/s.vgap-o.paceRef)<=o.tol)inRange.push(s.spm);}
  var adherencePct=moving?Math.round(adhN/moving*1000)/10:null,minInRange=Math.round((inRange.length*dt)/60*10)/10;
  if(o.paceRef==null||minInRange<o.minMin)return{spm:null,confidence:"Dados insuficientes",minInRange:minInRange,adherencePct:adherencePct};
  return{spm:Math.round(median(inRange)),confidence:minInRange>=10?"Alta":"Moderada",minInRange:minInRange,adherencePct:adherencePct};}
function mechDecoupling(samples,win,minMin){win=win||[10,1e9];minMin=minMin||40;var w0=win[0]*60,w1=win[1]*60,dt=sampleDt(samples),pts=[];
  for(var i=0;i<samples.length;i++){var s=samples[i];if(!s.valid||s.t<w0||s.t>w1||s.vgap==null||s.spm==null||s.spm<=0)continue;pts.push(s.vgap*60/s.spm);}
  var validMin=Math.round((pts.length*dt)/60*10)/10;if(validMin<minMin||pts.length<4)return{pct:null,confidence:"Dados insuficientes",validMin:validMin};
  var mid=Math.floor(pts.length/2);function mean(a){return a.reduce(function(s,x){return s+x;},0)/a.length;}
  var h1=mean(pts.slice(0,mid)),h2=mean(pts.slice(mid)),pct=h1>0?(h1-h2)/h1*100:null;
  return{pct:pct!=null?Math.round(pct*10)/10:null,confidence:"Moderada",half1:h1,half2:h2,validMin:validMin};}
function medianLag(workouts){var vals=(workouts||[]).filter(function(w){return w&&w.hrLagSec!=null&&!(w.quality&&w.quality.needsConfirm);}).map(function(w){return w.hrLagSec;});if(!vals.length)return{lagSec:0,n:0};return{lagSec:Math.round(median(vals)),n:vals.length};}
function decoupleMatrix(cardiacPct,mechPct,opts){var o={neutralPct:2,cardiacThresh:5};if(opts)for(var kk in opts)o[kk]=opts[kk];
  if(cardiacPct==null&&mechPct==null)return"Sem dados";var drift=cardiacPct!=null&&cardiacPct>o.cardiacThresh,strideFell=mechPct!=null&&mechPct>o.neutralPct;
  if(drift&&!strideFell)return"Deriva cardiovascular (calor/hidratação/duração)";if(drift&&strideFell)return"Fadiga global";if(!drift&&!strideFell)return"Sessão sob controle";return"Passada cedeu sem custo cardíaco — forma/força";}
function paceRefSuggest(workouts){var vals=(workouts||[]).filter(function(w){return w&&w.paceGap&&w.paceGap.paceSec!=null&&w.paceGap.confidence!=="Dados insuficientes";}).map(function(w){return w.paceGap.paceSec;});if(vals.length<2)return null;return Math.round(median(vals)/5)*5;}
function downgradeConf(conf){var order=["Alta","Moderada","Baixa","Dados insuficientes"],i=order.indexOf(conf);return i<0||i>=order.length-1?conf:order[i+1];}
function gradeBandIdx(g){if(g<=-5)return 0;if(g<-2)return 1;if(g<=2)return 2;if(g<=5)return 3;return 4;}
function capArr(arr,max){if(arr.length<=max)return arr;var step=arr.length/max,out=[];for(var i=0;i<arr.length;i+=step)out.push(arr[Math.floor(i)]);return out;}
function gradeProfile(sessions,opts){var o={lagSec:0,flatGrade:2,minMinPerBand:3,maxFit:500};if(opts)for(var kk in opts)o[kk]=opts[kk];
  var BANDS=["<−5%","−5 a −2%","±2%","2 a 5%",">5%"];function mean(a){return a.length?a.reduce(function(s,x){return s+x;},0)/a.length:null;}
  var perSession=[],pool=[];
  for(var si=0;si<sessions.length;si++){var s=sessions[si];if(!s||!s.length)continue;var dt=sampleDt(s),lagIdx=Math.round(o.lagSec/dt),al=[];
    for(var i=0;i<s.length;i++){var a=s[i],j=i+lagIdx;if(!a.valid||a.vgap==null||a.grade==null)continue;var hr=(j<s.length&&s[j]&&s[j].valid&&s[j].hr!=null)?s[j].hr:null;if(hr==null)continue;var smp={vgap:a.vgap,hr:hr,spm:a.spm,grade:a.grade,dt:dt};al.push(smp);pool.push(smp);}
    if(al.length)perSession.push(al);}
  var flat=pool.filter(function(p){return Math.abs(p.grade)<=o.flatGrade;});
  if(flat.length<20)return{ok:false,reason:"poucas amostras planas",nSessions:perSession.length};
  var flatCap=capArr(flat,o.maxFit),fit=theilSen(flatCap.map(function(p){return p.vgap;}),flatCap.map(function(p){return p.hr;}));
  if(!fit)return{ok:false,reason:"regressão falhou",nSessions:perSession.length};
  function predict(vg){return fit.a+fit.b*vg;}
  var agg=BANDS.map(function(){return{res:[],spm:[],mps:[],sec:0};});
  for(var k=0;k<pool.length;k++){var p=pool[k],A=agg[gradeBandIdx(p.grade)];A.res.push(p.hr-predict(p.vgap));if(p.spm!=null&&p.spm>0){A.spm.push(p.spm);A.mps.push(p.vgap*60/p.spm);}A.sec+=p.dt;}
  var rows=BANDS.map(function(b,i){var A=agg[i],min=Math.round(A.sec/60*10)/10;return{band:b,residual:A.res.length?Math.round(mean(A.res)*10)/10:null,spm:A.spm.length?Math.round(mean(A.spm)):null,mPerStep:A.mps.length?Math.round(mean(A.mps)*1000)/1000:null,minutes:min,show:min>=o.minMinPerBand};});
  var upPool=pool.filter(function(p){return p.grade>2;}),upResidual=upPool.length?mean(upPool.map(function(p){return p.hr-predict(p.vgap);})):null,upPosSessions=0;
  for(var m=0;m<perSession.length;m++){var up=perSession[m].filter(function(p){return p.grade>2;});if(up.length){var r=mean(up.map(function(p){return p.hr-predict(p.vgap);}));if(r!=null&&r>0)upPosSessions++;}}
  var upShown=rows[3].show||rows[4].show,label="Sem subida suficiente para avaliar";
  if(upShown&&upResidual!=null){if(upResidual>1&&upPosSessions>=3)label="Subida custa mais que o modelo GAP prevê";else if(Math.abs(upResidual)<=1)label="GAP calibrado para o atleta";else label="Subida: resíduo "+(upResidual>=0?"+":"")+upResidual.toFixed(1)+" bpm";}
  return{ok:true,rows:rows,fit:{a:fit.a,b:fit.b,r2:Math.round(fit.r2*100)/100,n:fit.n},nSessions:perSession.length,upPosSessions:upPosSessions,upResidual:upResidual!=null?Math.round(upResidual*10)/10:null,label:label};}
function weatherUrl(geo,when,archive){var d=when instanceof Date?when:new Date(when),date=d.toISOString().slice(0,10);
  var base=archive?"https://archive-api.open-meteo.com/v1/archive":"https://api.open-meteo.com/v1/forecast";
  var lat=Math.round(geo.lat*1e4)/1e4,lon=Math.round(geo.lon*1e4)/1e4;
  return base+"?latitude="+lat+"&longitude="+lon+"&start_date="+date+"&end_date="+date+"&hourly=temperature_2m,dew_point_2m,relative_humidity_2m,wind_speed_10m&timezone=UTC";}
function pickHour(hourly,when){if(!hourly||!hourly.time||!hourly.time.length)return null;var d=when instanceof Date?when:new Date(when),target=d.getTime(),best=-1,bestDiff=Infinity;
  for(var i=0;i<hourly.time.length;i++){var t=Date.parse(hourly.time[i]+"Z");if(isNaN(t))continue;var diff=Math.abs(t-target);if(diff<bestDiff){bestDiff=diff;best=i;}}
  if(best<0||bestDiff>3*3600*1000)return null;function g(k){return hourly[k]&&hourly[k][best]!=null?hourly[k][best]:null;}
  var dew=g("dew_point_2m")!=null?g("dew_point_2m"):g("dewpoint_2m");
  return{tempC:g("temperature_2m"),dewC:dew,rh:g("relative_humidity_2m"),windKmh:g("wind_speed_10m"),hour:hourly.time[best]};}
function climateTags(w,opts){var o={tempLo:8,tempHi:18,dewMax:14,windMax:20,altMax:200,baseAlt:null,alt:null};if(opts)for(var kk in opts)o[kk]=opts[kk];
  var tags=[],inStandard=false;
  if(w&&w.tempC!=null){inStandard=w.tempC>=o.tempLo&&w.tempC<=o.tempHi&&(w.dewC==null||w.dewC<=o.dewMax);
    if(w.tempC>o.tempHi)tags.push("acima da faixa-padrão");if(w.tempC<o.tempLo)tags.push("abaixo da faixa-padrão");if(w.dewC!=null&&w.dewC>o.dewMax)tags.push("úmido");if(w.windKmh!=null&&w.windKmh>o.windMax)tags.push("vento");}
  if(o.alt!=null&&o.baseAlt!=null&&Math.abs(o.alt-o.baseAlt)>o.altMax)tags.push("fora da base");
  return{tags:tags,inStandard:inStandard};}
function climateOpts(a,geo){a=a||{};return{tempLo:a.climTempLo!=null?a.climTempLo:8,tempHi:a.climTempHi!=null?a.climTempHi:18,dewMax:a.climDewMax!=null?a.climDewMax:14,windMax:a.windMax!=null?a.windMax:20,altMax:200,baseAlt:a.baseAltM!=null?a.baseAltM:null,alt:geo&&geo.alt!=null?geo.alt:null};}
function fetchWeather(geo,when,a){
  if(!geo||geo.lat==null||geo.lon==null||typeof fetch==="undefined")return Promise.resolve(null);
  function tryOne(archive){var ctrl=typeof AbortController!=="undefined"?new AbortController():null,timer=ctrl?setTimeout(function(){ctrl.abort();},8000):null;
    return fetch(weatherUrl(geo,when,archive),ctrl?{signal:ctrl.signal}:{}).then(function(r){if(!r||!r.ok)return null;return r.json();}).then(function(j){var h=j?pickHour(j.hourly,when):null;return h&&h.tempC!=null?Object.assign(h,{source:archive?"open-meteo/archive":"open-meteo/forecast"}):null;}).catch(function(){return null;}).then(function(x){if(timer)clearTimeout(timer);return x;});}
  var whenD=when instanceof Date?when:new Date(when),ageDays=(Date.now()-whenD.getTime())/86400000;
  return tryOne(ageDays>5).then(function(h){return h||tryOne(ageDays<=5);}).then(function(h){if(!h)return null;var c=climateTags(h,climateOpts(a,geo));
    var loc=new Date(whenD.getTime()-3*3600*1000),localTime=loc.toISOString().slice(0,16).replace("T"," ")+" (UTC−3)";
    return Object.assign(h,{tags:c.tags,inStandard:c.inStandard,localTime:localTime});});}
function impSample(samples,opts){var o={fcRef:145,band:3,lagSec:0,plano:2,win:[10,30]};if(opts)for(var kk in opts)o[kk]=opts[kk];
  var w0=o.win[0]*60,w1=o.win[1]*60,dt=sampleDt(samples),lagIdx=Math.round(o.lagSec/dt),vg=[];
  for(var i=0;i<samples.length;i++){var s=samples[i],j=i+lagIdx;if(!s.valid||s.vgap==null||s.grade==null||Math.abs(s.grade)>o.plano||s.t<w0||s.t>w1)continue;
    var hr=(j<samples.length&&samples[j]&&samples[j].valid&&samples[j].hr!=null)?samples[j].hr:null;if(hr==null||Math.abs(hr-o.fcRef)>o.band)continue;vg.push(s.vgap);}
  var minInBand=Math.round((vg.length*dt)/60*10)/10;if(minInBand<5)return{vPadrao:null,minInBand:minInBand,confidence:"Dados insuficientes"};
  return{vPadrao:median(vg),minInBand:minInBand,confidence:minInBand>=8?"Moderada":"Baixa"};}
function impBaseline(workouts,qualifies){var q=(workouts||[]).filter(function(w){return w&&w.imp&&w.imp.vPadrao!=null&&(qualifies?qualifies(w):true);}).sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0;});
  var first3=q.slice(0,3);if(first3.length<3)return{vBaseline:null,n:first3.length};
  return{vBaseline:first3.reduce(function(s,w){return s+w.imp.vPadrao;},0)/first3.length,n:3,dates:first3.map(function(w){return w.date;})};}
function impIndex(vPadrao,vBaseline){if(vPadrao==null||!vBaseline)return null;return Math.round((100*vPadrao/vBaseline)*10)/10;}
function matInv(A){var n=A.length,M=A.map(function(row,i){return row.concat(Array.apply(null,{length:n}).map(function(_,j){return i===j?1:0;}));});
  for(var col=0;col<n;col++){var piv=col;for(var r=col+1;r<n;r++)if(Math.abs(M[r][col])>Math.abs(M[piv][col]))piv=r;
    if(Math.abs(M[piv][col])<1e-12)return null;var tmp=M[col];M[col]=M[piv];M[piv]=tmp;var d=M[col][col];
    for(var j=0;j<2*n;j++)M[col][j]/=d;
    for(var rr=0;rr<n;rr++){if(rr===col)continue;var f=M[rr][col];for(var jj=0;jj<2*n;jj++)M[rr][jj]-=f*M[col][jj];}}
  return M.map(function(row){return row.slice(n);});}
function mlr(X,y,weights){var n=X.length,p=X[0].length,w=weights||X.map(function(){return 1;});
  var XtX=[],Xty=[];for(var q=0;q<p;q++){XtX.push(new Array(p));for(var qq=0;qq<p;qq++)XtX[q][qq]=0;Xty.push(0);}
  for(var i=0;i<n;i++){var wi=w[i];for(var a=0;a<p;a++){Xty[a]+=wi*X[i][a]*y[i];for(var b=0;b<p;b++)XtX[a][b]+=wi*X[i][a]*X[i][b];}}
  var inv=matInv(XtX);if(!inv)return null;var beta=new Array(p);
  for(var a2=0;a2<p;a2++){var s=0;for(var b2=0;b2<p;b2++)s+=inv[a2][b2]*Xty[b2];beta[a2]=s;}
  var ssr=0,res=new Array(n);for(var k=0;k<n;k++){var pred=0;for(var a3=0;a3<p;a3++)pred+=beta[a3]*X[k][a3];res[k]=y[k]-pred;ssr+=w[k]*res[k]*res[k];}
  var sigma2=ssr/Math.max(1,n-p),se=new Array(p);for(var a4=0;a4<p;a4++)se[a4]=Math.sqrt(Math.max(0,sigma2*inv[a4][a4]));
  return{beta:beta,se:se,n:n,res:res};}
function mlrRobust(X,y,iters){iters=iters==null?2:iters;var fit=mlr(X,y);if(!fit)return null;
  for(var it=0;it<iters;it++){var mad=median(fit.res.map(Math.abs))||1,scale=1.4826*mad||1,kk=1.345*scale;
    var w=fit.res.map(function(r){var a=Math.abs(r);return a<=kk?1:kk/a;});var f2=mlr(X,y,w);if(!f2)break;fit=f2;}
  return fit;}
function impPhase2(sessions,opts){var o={fcRef:145,tRef:13,minRef:20,minSessions:10,tempAmp:8,maxLosoBpm:4};if(opts)for(var kk in opts)o[kk]=opts[kk];
  var valid=(sessions||[]).filter(function(s){return s&&s.temp!=null&&s.aligned&&s.aligned.length>30;});
  var temps=valid.map(function(s){return s.temp;}),amp=temps.length?Math.max.apply(null,temps)-Math.min.apply(null,temps):0;
  if(valid.length<o.minSessions||amp<o.tempAmp)return{ok:false,reason:"gatilho não atingido",nSessions:valid.length,tempAmp:Math.round(amp*10)/10};
  function rows(sess){var X=[],y=[];for(var i=0;i<sess.length;i++)for(var j=0;j<sess[i].aligned.length;j++){var a=sess[i].aligned[j];X.push([1,a.vgap,sess[i].temp,a.minute]);y.push(a.hr);}return{X:X,y:y};}
  var all=rows(valid),fit=mlrRobust(all.X,all.y);if(!fit)return{ok:false,reason:"regressão falhou",nSessions:valid.length};
  var a=fit.beta[0],b=fit.beta[1],c=fit.beta[2],d=fit.beta[3];if(Math.abs(b)<1e-6)return{ok:false,reason:"b≈0",nSessions:valid.length};
  var cLo=c-1.96*fit.se[2],cHi=c+1.96*fit.se[2],cZero=cLo<=0&&cHi>=0,cEff=cZero?0:c;
  var errs=[];for(var kx=0;kx<valid.length;kx++){var train=valid.filter(function(_,i){return i!==kx;}),tr=rows(train),f=mlrRobust(tr.X,tr.y);if(!f)continue;
    for(var m=0;m<valid[kx].aligned.length;m++){var al=valid[kx].aligned[m],pr=f.beta[0]+f.beta[1]*al.vgap+f.beta[2]*valid[kx].temp+f.beta[3]*al.minute;errs.push(Math.abs(al.hr-pr));}}
  var losoMedAbs=errs.length?Math.round(median(errs)*10)/10:Infinity,usable=losoMedAbs<=o.maxLosoBpm;
  function mean(arr){return arr.length?arr.reduce(function(s,x){return s+x;},0)/arr.length:0;}
  var perSession=valid.map(function(s){var rs=mean(s.aligned.map(function(al){return al.hr-(a+b*al.vgap+c*s.temp+d*al.minute);}));
    var vPad=(o.fcRef-(a+rs)-cEff*o.tRef-d*o.minRef)/b;return{date:s.date,vPadrao:vPad>0?Math.round(vPad*1000)/1000:null,temp:s.temp};});
  return{ok:true,usable:usable,nSessions:valid.length,tempAmp:Math.round(amp*10)/10,coef:{a:a,b:b,c:c,d:d},heatSens:Math.round(c*100)/100,heatCI:[Math.round(cLo*100)/100,Math.round(cHi*100)/100],cZero:cZero,losoMedAbs:losoMedAbs,perSession:perSession};}
function motorTest(samples,stages,opts){var o={tol:3,lastMin:3};if(opts)for(var kk in opts)o[kk]=opts[kk];var t0=0,out=[];
  for(var si=0;si<(stages||[]).length;si++){var st=stages[si],start=t0,end=t0+st.min*60;t0=end;var w0=Math.max(start,end-o.lastMin*60);
    var seg=samples.filter(function(s){return s.t>=w0&&s.t<end&&s.spd!=null;});
    if(seg.length<10){out.push({name:st.name,targetHr:st.targetHr,speed:null,pace:null,hrMean:null,min:st.min,flagged:st.targetHr!=null,reason:"sem dados"});continue;}
    var speed=median(seg.map(function(s){return s.spd;})),hrs=seg.filter(function(s){return s.hr!=null;}).map(function(s){return s.hr;}),hrMean=hrs.length?hrs.reduce(function(a,b){return a+b;},0)/hrs.length:null;
    var flagged=st.targetHr!=null&&hrMean!=null&&Math.abs(hrMean-st.targetHr)>o.tol;
    out.push({name:st.name,targetHr:st.targetHr,speed:Math.round(speed*1000)/1000,pace:speed>0?Math.round(1000/speed):null,hrMean:hrMean!=null?Math.round(hrMean):null,min:st.min,flagged:flagged});}
  return out;}
function alignForModel(samples,lagSec){var dt=sampleDt(samples),lagIdx=Math.round((lagSec||0)/dt),out=[];
  for(var i=0;i<samples.length;i++){var s=samples[i],j=i+lagIdx;if(!s.valid||s.vgap==null)continue;var hr=(j<samples.length&&samples[j]&&samples[j].valid&&samples[j].hr!=null)?samples[j].hr:null;if(hr==null)continue;out.push({vgap:s.vgap,hr:hr,minute:s.t/60});}
  return out;}
function computeStreamKpis(records,a,pauses){
  var pp=preprocess(records,{pauses:pauses||[]});
  var lag=hrLag(pp.samples,90);
  var fcRef=(a&&a.fcRef)||145,bandFc=(a&&a.bandFc)||3;
  var pg=paceGapAtHR(pp.samples,{fcRef:fcRef,band:bandFc,lagSec:lag.lagSec,win:[10,45]});
  var eff=sessionEff(pp.samples);
  var mech=mechDecoupling(pp.samples);
  var cadAdh=cadenceAtPace(pp.samples,{paceRef:null}).adherencePct; // adesão 170–176 (independe do PACE_REF)
  var imp=impSample(pp.samples,{fcRef:fcRef,band:bandFc,lagSec:lag.lagSec}); // IMP Fase 1 (v_padrao)
  pp.quality.minInBand=pg?pg.minInBand:0; // §2: minutos na banda 145±3
  // §1: gravação inteligente → rebaixa a confiança dos KPIs um nível (sem excluir dados)
  if(pp.quality.smart){
    if(pg)pg.confidence=downgradeConf(pg.confidence);
    if(imp&&imp.confidence)imp.confidence=downgradeConf(imp.confidence);
  }
  return{quality:pp.quality,hrLagSec:lag.lagSec,paceGap:pg,eff:eff,mech:mech,cadAdherencePct:cadAdh,imp:imp,stream:reduceStream(pp.samples,3)};
}
function modalFromSport(sport){return /cycl|bike|bicicl/i.test((sport||"").toString())?"bike":"corrida";}
function fitMessagesToWorkout(messages){
  var records=fitNormRecords(messages.recordMesgs);
  if(!records.length)throw new Error("Arquivo .FIT sem registros de trajeto (record messages).");
  var session=(messages.sessionMesgs&&messages.sessionMesgs[0])||{};
  var sport=(session.sport||"").toString().toLowerCase();
  var subSport=(session.subSport||"").toString().toLowerCase();
  var modal=modalFromSport(sport);
  var startDate=session.startTime instanceof Date?session.startTime:(typeof records[0].t==="number"?new Date(records[0].t*1000):null);
  var lastDist=records[records.length-1].dist;
  var distKm=(fitNum(session.totalDistance)!=null?session.totalDistance:lastDist)/1000;
  var durationSec=Math.round(fitNum(session.totalTimerTime)!=null?session.totalTimerTime:(fitNum(session.totalElapsedTime)!=null?session.totalElapsedTime:(records[records.length-1].t-records[0].t)));
  var hrs=records.map(function(r){return r.hr;}).filter(function(x){return x!=null;});
  var hrAvg=fitNum(session.avgHeartRate)!=null?session.avgHeartRate:(hrs.length?Math.round(hrs.reduce(function(a,b){return a+b;},0)/hrs.length):null);
  var hrMax=fitNum(session.maxHeartRate)!=null?session.maxHeartRate:(hrs.length?Math.max.apply(null,hrs):null);
  var cads=records.map(function(r){return r.cad;}).filter(function(x){return x!=null;});
  var rawCad=fitNum(session.avgCadence)!=null?session.avgCadence:(cads.length?cads.reduce(function(a,b){return a+b;},0)/cads.length:null);
  var stream=fitAscentDescent(records);
  var gainM=fitNum(session.totalAscent)!=null?Math.round(session.totalAscent):(stream.up||null);
  var lossM=fitNum(session.totalDescent)!=null?Math.round(session.totalDescent):(stream.down||null);
  var temps=records.map(function(r){return r.temp;}).filter(function(x){return x!=null;});
  var temp=temps.length?Math.round(temps.reduce(function(a,b){return a+b;},0)/temps.length):null;
  var isBk=modal==="bike";
  var indoor=isBk&&(subSport.indexOf("indoor")>=0||subSport.indexOf("virtual")>=0||!(distKm>0.05));
  var kcal=fitNum(session.totalCalories)!=null?Math.round(session.totalCalories):null;
  var te=fitNum(session.totalTrainingEffect);
  // GPS inicial (para clima futuro) e KPIs por amostra — só corrida com trajeto
  var geo=null;for(var gi=0;gi<records.length;gi++){if(records[gi].lat!=null&&records[gi].lon!=null){geo={lat:Math.round(records[gi].lat*1e5)/1e5,lon:Math.round(records[gi].lon*1e5)/1e5,alt:fitNum(records[gi].alt)!=null?Math.round(records[gi].alt):null};break;}}
  // pausas pelos eventos timer stop/start do .FIT (segundos absolutos, mesma escala de record.t)
  var fitEvents=(messages.eventMesgs||[]).filter(function(e){return e&&(e.event==="timer"||e.event==null)&&e.timestamp instanceof Date;}).map(function(e){
    var et=(e.eventType||"").toString().toLowerCase();return{t:e.timestamp.getTime()/1000,type:/stop/.test(et)?"stop":(/start/.test(et)?"start":null)};}).filter(function(e){return e.type;});
  var pauses=pauseWindows(fitEvents);
  var sk=null;if(!isBk){try{sk=computeStreamKpis(records,(typeof state!=="undefined"&&state.athlete)||null,pauses);}catch(e){sk=null;}}
  return{
    date:fitISODate(startDate)||new Date().toISOString().slice(0,10),
    modal:modal,
    indoor:isBk?!!indoor:undefined,
    type:isBk?"bike":"facil",
    distKm:Math.round(distKm*100)/100,
    durationSec:durationSec,
    hrAvg:hrAvg||null,hrMax:hrMax||null,
    cadence:isBk?null:(fitCadence(rawCad)||null),
    bikeRpm:isBk&&rawCad!=null?Math.round(rawCad):null,
    gainM:gainM,lossM:lossM,temp:temp,
    kcal:kcal,
    trainingEffect:te!=null?Math.round(te*10)/10:null,
    splits:isBk?null:fitBuildSplits(records),
    hrHist:fitHrHist(records),
    geo:geo,
    stream:sk?sk.stream:null,
    quality:sk?sk.quality:null,
    hrLagSec:sk?sk.hrLagSec:null,
    paceGap:sk?sk.paceGap:null,
    eff:sk?sk.eff:null,
    mech:sk?sk.mech:null,
    cadAdherencePct:sk?sk.cadAdherencePct:null,
    imp:sk?sk.imp:null,
    weather:null,
    sport:session.sport||null
  };
}
var HK_TYPES={resting:"HKQuantityTypeIdentifierRestingHeartRate",hrv:"HKQuantityTypeIdentifierHeartRateVariabilitySDNN",vo2:"HKQuantityTypeIdentifierVO2Max",sleep:"HKCategoryTypeIdentifierSleepAnalysis"};
function appleDateMs(s){if(!s)return null;var iso=s.trim().replace(" ","T").replace(/\s*([+-]\d{2})(\d{2})$/,"$1:$2");var t=Date.parse(iso);return isNaN(t)?null:t;}
function localDay(s){return s?s.slice(0,10):null;}
function extractHealthRecords(text){
  var out=[],wanted={};for(var k in HK_TYPES)wanted[HK_TYPES[k]]=1;
  var recRe=/<Record\b([^>]*?)\/?>/g,m;
  while((m=recRe.exec(text))!==null){
    var attrs=m[1];var tm=attrs.match(/\btype="([^"]*)"/);if(!tm||!wanted[tm[1]])continue;
    function g(k){var mm=attrs.match(new RegExp("\\b"+k+'="([^"]*)"'));return mm?mm[1]:undefined;}
    out.push({type:tm[1],value:g("value"),startDate:g("startDate"),endDate:g("endDate")});
  }
  return out;
}
function aggregateDaily(records){
  var acc={};function ensure(d){return acc[d]=acc[d]||{rest:[],hrv:[],vo2:null,vo2t:0,sleepMs:0};}
  for(var i=0;i<records.length;i++){var r=records[i];
    if(r.type===HK_TYPES.resting){var d=localDay(r.startDate),v=+r.value;if(d&&isFinite(v))ensure(d).rest.push(v);}
    else if(r.type===HK_TYPES.hrv){var d2=localDay(r.startDate),v2=+r.value;if(d2&&isFinite(v2))ensure(d2).hrv.push(v2);}
    else if(r.type===HK_TYPES.vo2){var d3=localDay(r.startDate),v3=+r.value,t3=appleDateMs(r.startDate)||0;if(d3&&isFinite(v3)){var a3=ensure(d3);if(t3>=a3.vo2t){a3.vo2=v3;a3.vo2t=t3;}}}
    else if(r.type===HK_TYPES.sleep){if(!/Asleep/i.test(r.value||""))continue;var s=appleDateMs(r.startDate),e=appleDateMs(r.endDate),d4=localDay(r.endDate);if(d4&&s!=null&&e!=null&&e>s)ensure(d4).sleepMs+=e-s;}
  }
  return Object.keys(acc).sort().map(function(d){var a=acc[d],row={date:d};if(a.rest.length)row.restingHR=Math.round(median(a.rest));if(a.hrv.length)row.hrv=Math.round(median(a.hrv));if(a.vo2!=null)row.vo2=Math.round(a.vo2*10)/10;if(a.sleepMs>0)row.sleepH=Math.round(a.sleepMs/3600000*10)/10;return row;}).filter(function(r){return r.restingHR!=null||r.hrv!=null||r.vo2!=null||r.sleepH!=null;});
}
function readHealthFile(file,onDone,onErr){
  var CHUNK=4*1024*1024,offset=0,carry="",records=[];
  var reader=new FileReader();
  function step(){
    if(offset>=file.size){onDone(aggregateDaily(records));return;}
    var slice=file.slice(offset,offset+CHUNK);
    reader.onload=function(){
      var text=carry+reader.result;
      var lastGt=text.lastIndexOf(">");
      var head=lastGt>=0?text.slice(0,lastGt+1):text;
      carry=lastGt>=0?text.slice(lastGt+1):"";
      var recs=extractHealthRecords(head);for(var i=0;i<recs.length;i++)records.push(recs[i]);
      offset+=CHUNK;setTimeout(step,0);
    };
    reader.onerror=function(){onErr&&onErr(reader.error||new Error("Falha ao ler o arquivo."));};
    reader.readAsText(slice);
  }
  step();
}
var LS_KEY="apex.analise.v1";
var DEFAULT_ATHLETE={
  name:"Lucas",city:"Guarapuava/PR",fcRep:67,fcMax:198,fcMaxProv:true,vo2:39.4,weight:82,age:34,
  cadenceTarget:173,efBaseline:0.0139,efGainPct:6.5,decouplingTarget:7,weeklyTargetKm:35,sessionsTarget:3,showBaseline5k:false,
  bikeFcMax:186,bikeZones:[123,138,145,167,179], // zonas do Garmin (bike): início Z1..Z5 em bpm
  baseAltM:1120,climTempLo:8,climTempHi:18,climDewMax:14,windMax:20, // Guarapuava ~1120 m · PADRÃO_CLIMA
  motorStages:[{name:"Aquecimento",min:10,targetHr:null},{name:"135 bpm",min:6,targetHr:135},{name:"145 bpm",min:6,targetHr:145}], // Teste do Motor (estágios superiores liberam com a tíbia)
  cycleName:"Base & Pace",cycleWeeks:10,
  alert:"⚠ PAUSA PROTETORA · sensibilidade na tíbia direita (08/09). Corrida suspensa; foco em reforço estrutural, bike e reab. Baseline 5K (6:21) segue como marco zero."
};
var DEFAULT_RACE={name:"Maratona",type:"maratona",date:"2027-03-28",distKm:42.195,goal:"finish",objective:"",startDate:"2026-10-06",longRunTargetKm:30,peakKmTarget:50,updatedAt:null};
function defaultRace(){return Object.assign({},DEFAULT_RACE);}
var RACE_TYPES={
  maratona:{label:"Maratona",dist:42.195,longRunTargetKm:30,peakKmTarget:50,phases:[0.40,0.30,0.20,0.10]},
  meia:{label:"Meia maratona",dist:21.0975,longRunTargetKm:18,peakKmTarget:35,phases:[0.35,0.30,0.25,0.10]},
  custom:{label:"Personalizada",dist:null,longRunTargetKm:20,peakKmTarget:40,phases:[0.40,0.30,0.20,0.10]}
};
var PHASE_META=[
  {k:"base",name:"Base aeróbica",emoji:"🔵",desc:"Construir volume fácil e consistência em Z1–Z2. Sem pressa, sem dor."},
  {k:"build",name:"Construção",emoji:"🟢",desc:"Sobe o longão e o volume semanal, ainda majoritariamente em Z2."},
  {k:"peak",name:"Pico",emoji:"🟡",desc:"Longões mais altos e ritmo de prova por FC. Fase de carga máxima."},
  {k:"taper",name:"Taper",emoji:"🟠",desc:"Reduz o volume e mantém as pernas leves. Chegar descansado e inteiro."}
];
function raceTypeOf(race){return (race&&race.type&&RACE_TYPES[race.type])?race.type:"maratona";}
function seedWorkouts(){
  // Dados reais do dashboard/relatório (calibração Floripa + baseline).
  function mkSplits(arr){return arr.map(function(x){return{distKm:x[0],timeSec:x[1],hrAvg:x[2]!=null?x[2]:null,elevDeltaM:x[3]!=null?x[3]:null};});}
  return [
    {id:uid(),date:"2026-08-06",type:"facil",distKm:8.0,durationSec:8*460,hrAvg:160,cadence:165,gainM:40,lossM:38,rpe:4,temp:16,terrain:"ondulado",notes:"Calibração Floripa — EF documentado 0,0136"},
    {id:uid(),date:"2026-08-12",type:"facil",distKm:9.0,durationSec:9*450,hrAvg:162,cadence:165,gainM:45,lossM:42,rpe:4,temp:15,terrain:"ondulado",notes:"Calibração Floripa — EF documentado 0,0137"},
    {id:uid(),date:"2026-08-15",type:"longão",distKm:17.0,durationSec:17*465,hrAvg:166,hrMax:190,cadence:166,gainM:120,lossM:118,rpe:6,temp:17,terrain:"ondulado",decouplingPct:-0.4,notes:"Longão 3 · pico (Floripa)"},
    {id:uid(),date:"2026-08-18",type:"facil",distKm:8.0,durationSec:8*445,hrAvg:156,cadence:166,gainM:35,lossM:33,rpe:3,temp:14,terrain:"plano",notes:"Calibração Floripa — EF documentado 0,0144"},
    {id:uid(),date:"2026-08-21",type:"facil",distKm:10.0,durationSec:10*455,hrAvg:159,cadence:166,gainM:50,lossM:48,rpe:4,temp:16,terrain:"ondulado",notes:"Calibração Floripa — EF documentado 0,0138"},
    {id:uid(),date:"2026-08-29",type:"prova",distKm:21.2,durationSec:9723,hrAvg:167,hrMax:196,cadence:167,gainM:80,lossM:78,rpe:8,temp:19,terrain:"plano/urbano",decouplingPct:2.6,notes:"Meia de Floripa · 2:42:03"},
    {id:uid(),date:"2026-09-07",type:"teste",distKm:5.02,durationSec:1910,hrAvg:174,hrMax:192,cadence:174,gainM:35,lossM:30,rpe:9,temp:20,terrain:"ondulado",decouplingPct:5.0,
      splits:mkSplits([[1,396,168,12],[1,391,172,-8],[1,393,175,10],[1,395,178,6],[1.02,335,190,5]]),
      notes:"Teste 5K · BASELINE · marco zero · corpo aguentava, fôlego cansou (RPE 9 no fim)"},
    {id:uid(),date:"2026-09-10",modal:"bike",indoor:true,type:"bike",distKm:0,durationSec:3605,hrAvg:124,hrMax:135,kcal:316,trainingEffect:2.0,rpe:4,notes:"Bike indoor · base aeróbica na pausa protetora (canela)"},
    {id:uid(),date:"2026-09-13",modal:"bike",indoor:false,type:"bike",distKm:32.4,durationSec:4260,hrAvg:138,hrMax:158,gainM:410,lossM:405,kcal:640,rpe:5,temp:19,terrain:"ondulado",notes:"Pedal outdoor · rodízio longo de baixo impacto"}
  ];
}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function seedDaily(){
  // dias de recuperação de exemplo (o que o Apple Watch mediria) — edite/importe os seus
  return [
    {date:"2026-09-03",restingHR:69,hrv:52,sleepH:6.8},
    {date:"2026-09-04",restingHR:68,hrv:55,sleepH:7.4},
    {date:"2026-09-05",restingHR:67,hrv:57,sleepH:7.1},
    {date:"2026-09-06",restingHR:67,hrv:58,sleepH:7.6,vo2:39.4},
    {date:"2026-09-07",restingHR:67,hrv:54,sleepH:6.9},
    {date:"2026-09-08",restingHR:70,hrv:49,sleepH:6.2,note:"canela sensível"}
  ];
}
function load(){
  try{var raw=localStorage.getItem(LS_KEY);if(raw){var p=JSON.parse(raw);return{athlete:Object.assign({},DEFAULT_ATHLETE,p.athlete||{}),workouts:p.workouts||[],daily:p.daily||[],deleted:p.deleted||[],race:(p.race!==undefined?p.race:defaultRace()),races:p.races||[],planWeeks:p.planWeeks||{},updatedAt:p.updatedAt||null,lastSyncAt:p.lastSyncAt||null};}}catch(e){}
  return{athlete:Object.assign({},DEFAULT_ATHLETE),workouts:seedWorkouts(),daily:seedDaily(),deleted:[],race:defaultRace(),races:[],planWeeks:{},updatedAt:null,lastSyncAt:null,seeded:true};
}
function touch(){state.updatedAt=new Date().toISOString();}
var _saveWarned=false;
function _isQuotaErr(e){return !!e&&(e.name==="QuotaExceededError"||e.name==="NS_ERROR_DOM_QUOTA_REACHED"||e.code===22||e.code===1014||/quota|exceeded/i.test((e.message||"")));}
function _stripStream(w){if(!w||!w.stream)return w;var c=Object.assign({},w);delete c.stream;c.streamPruned=true;return c;}
function save(){
  var base={athlete:state.athlete,workouts:state.workouts,daily:state.daily,deleted:state.deleted||[],race:state.race||null,races:state.races||[],planWeeks:state.planWeeks||{},updatedAt:state.updatedAt,lastSyncAt:state.lastSyncAt};
  try{localStorage.setItem(LS_KEY,JSON.stringify(base));return true;}
  catch(e){
    if(!_isQuotaErr(e)){try{console.error("save falhou:",e);}catch(_){}return false;}
    // Cota estourada (streams .FIT pesados). Tenta versões mais enxutas para NÃO perder o treino.
    try{var l1=Object.assign({},base);l1.workouts=state.workouts.map(_stripStream);localStorage.setItem(LS_KEY,JSON.stringify(l1));
      if(!_saveWarned){_saveWarned=true;try{toast("Espaço local quase cheio — guardei o treino sem os dados brutos do .FIT (os indicadores seguem). Exporte um backup ou ligue a sincronização.");}catch(_){}}
      return true;}
    catch(e2){
      try{var l2=Object.assign({},base);l2.workouts=state.workouts.map(function(w){var c=_stripStream(w);c=Object.assign({},c);delete c.hrHist;return c;});localStorage.setItem(LS_KEY,JSON.stringify(l2));
        try{toast("Armazenamento do aparelho cheio — salvei uma versão enxuta. Exporte um backup / ligue a sincronização.");}catch(_){}
        return true;}
      catch(e3){try{toast("⚠ Não consegui salvar no aparelho (armazenamento cheio). Exporte um backup ou ligue a sincronização para não perder o treino.");}catch(_){}return false;}
    }
  }
}
function sortedWorkouts(){return state.workouts.slice().sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0;});}
function sortedDaily(){return (state.daily||[]).slice().sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0;});}
function _dailyByDate(){var m={};(state.daily||[]).forEach(function(d){if(d&&d.date)m[d.date]=d;});return m;}
function linkSleepToWorkouts(){
  var m=_dailyByDate(),n=0;
  (state.workouts||[]).forEach(function(w){
    if(!w||!w.date)return;
    var d=m[w.date];
    if(d&&d.sleepH!=null&&(w.sleepH==null||w.sleepH===""||w.sleepSrc==="apple")){
      if(w.sleepH!==d.sleepH||w.sleepSrc!=="apple"){w.sleepH=d.sleepH;w.sleepSrc="apple";n++;}
    }
  });
  return n;
}
function workoutDayReadiness(w){
  if(!w||!w.date)return null;
  var fitArr=[];try{fitArr=fitnessSeries(state.workouts,state.athlete)||[];}catch(e){}
  var tsbAt=null;for(var i=0;i<fitArr.length;i++){if(fitArr[i].date===w.date){tsbAt=fitArr[i].tsb;break;}}
  var sh=(w.sleepH!=null&&w.sleepH!=="")?+w.sleepH:null;
  var rd=readiness({tsb:tsbAt,sleepH:sh,soreness:w.soreness,pain:w.pain});
  return {rd:rd,tsb:tsbAt,sleepH:sh};
}
function nextWorkoutSuggestion(rd,tsb,ac,shinProtect){
  var band=rd?rd.band:null,acHot=ac&&ac.ratio>1.3;
  if(shinProtect||band==="Recovery")
    return {type:"Descanso ou regenerativo",detail:"folga, ou bike/elíptico de baixo impacto",c:"var(--crit)",
      read:shinProtect?"Sinal de proteção da tíbia ativo — <b>sem impacto hoje</b>. Bike/elíptico mantêm a base; qualidade só quando a canela liberar."
                      :"Prontidão baixa — priorize recuperar. Se quiser se mover, bike/elíptico leves mantêm a base sem cobrar da perna."};
  if(acHot)
    return {type:"Leve / rodagem fácil",detail:"30–45 min em Z1–Z2 (conversa fácil)",c:"var(--warn)",
      read:"Sua carga subiu rápido (A:C "+(ac?ac.ratio.toFixed(2):"")+") — <b>segure a intensidade</b> esta semana. Um fácil de verdade protege a adaptação (e a tíbia)."};
  if(band==="Caution")
    return {type:"Leve / rodagem fácil",detail:"35–45 min em Z1–Z2 (conversa fácil)",c:"var(--warn)",
      read:"Prontidão em cautela — <b>segure a qualidade</b> para quando ela subir. Hoje, fácil."};
  if(band==="Moderate")
    return {type:"Fácil a moderado",detail:"rodagem fácil; só puxe se o corpo pedir",c:"var(--warn)",
      read:"Prontidão mediana — fácil a moderado. Deixe a qualidade para um dia mais verde."};
  return {type:"Qualidade liberada",detail:"ex.: intervalado ou tempo · com aquecimento",c:"var(--good)",
    read:"Forma e recuperação boas — <b>verde para uma sessão forte</b>. Aqueça bem e cuide da técnica quando cansar."};
}
function mergeDaily(rows){
  state.daily=state.daily||[];
  var byDate={};state.daily.forEach(function(e){byDate[e.date]=e;});
  var added=0,updated=0;
  rows.forEach(function(r){if(!r.date)return;r.updatedAt=new Date().toISOString();if(byDate[r.date]){var e=byDate[r.date];["restingHR","hrv","vo2","sleepH","sleepQuality","mood","note"].forEach(function(k){if(r[k]!=null&&r[k]!=="")e[k]=r[k];});e.updatedAt=r.updatedAt;updated++;}else{byDate[r.date]=r;state.daily.push(r);added++;}});
  var linked=linkSleepToWorkouts();
  return{added:added,updated:updated,linked:linked};
}
function normalizeSyncCode(raw){return (raw||"").toString().trim().toLowerCase().replace(/\s+/g,"");}
function newSyncCode(){var alpha="23456789abcdefghjkmnpqrstuvwxyz";function g(){var s="";for(var i=0;i<4;i++)s+=alpha[Math.floor(Math.random()*alpha.length)];return s;}return "apex-"+g()+"-"+g()+"-"+g();}
function syncHashId(code){var data=new TextEncoder().encode("apexv1:"+normalizeSyncCode(code));return crypto.subtle.digest("SHA-256",data).then(function(buf){var b=new Uint8Array(buf),h="";for(var i=0;i<b.length;i++)h+=("0"+b[i].toString(16)).slice(-2);return h;});}
function syncTs(x){if(x==null)return 0;if(typeof x==="number")return x;var t=Date.parse(x);return isNaN(t)?0:t;}
function syncStripEmpty(o){var out={};for(var k in o)if(o[k]!=null&&o[k]!=="")out[k]=o[k];return out;}
function syncMergeDeleted(a,b){var m={};(a||[]).concat(b||[]).forEach(function(d){if(d&&d.id){if(!m[d.id]||syncTs(d.at)>syncTs(m[d.id].at))m[d.id]={id:d.id,at:d.at};}});return Object.keys(m).map(function(k){return m[k];});}
function syncMergeWorkouts(aw,bw,deleted){var byId={};(aw||[]).concat(bw||[]).forEach(function(w){if(w&&w.id){if(!byId[w.id]||syncTs(w.updatedAt)>=syncTs(byId[w.id].updatedAt))byId[w.id]=w;}});var tomb={};(deleted||[]).forEach(function(d){tomb[d.id]=syncTs(d.at);});var out=[];for(var id in byId){var w=byId[id];if(tomb[id]!=null&&tomb[id]>=syncTs(w.updatedAt))continue;out.push(w);}return out.sort(function(x,y){return x.date<y.date?-1:x.date>y.date?1:0;});}
function syncMergeDaily(ad,bd){var byDate={};(ad||[]).concat(bd||[]).forEach(function(r){if(!r||!r.date)return;var prev=byDate[r.date];if(!prev){byDate[r.date]=r;return;}var newer=syncTs(r.updatedAt)>=syncTs(prev.updatedAt)?r:prev,older=newer===r?prev:r;byDate[r.date]=Object.assign({},syncStripEmpty(older),syncStripEmpty(newer));});return Object.keys(byDate).map(function(k){return byDate[k];}).sort(function(x,y){return x.date<y.date?-1:1;});}
function syncMergeRace(ar,br){if(!ar)return br||null;if(!br)return ar||null;return syncTs(ar.updatedAt)>=syncTs(br.updatedAt)?ar:br;}
function syncMergePlanWeeks(ap,bp){ap=ap||{};bp=bp||{};var out={};for(var k in ap)out[k]=ap[k];for(var j in bp){var cur=out[j];if(!cur||syncTs(bp[j]&&bp[j].updatedAt)>=syncTs(cur.updatedAt))out[j]=bp[j];}return out;}
function syncMergeStates(a,b){a=a||{};b=b||{};var deleted=syncMergeDeleted(a.deleted,b.deleted);var workouts=syncMergeWorkouts(a.workouts,b.workouts,deleted);var daily=syncMergeDaily(a.daily,b.daily);var aa=a.athlete||{},ba=b.athlete||{};var athlete=syncTs(aa.updatedAt)>=syncTs(ba.updatedAt)?(a.athlete||b.athlete||{}):(b.athlete||a.athlete||{});var race=syncMergeRace(a.race,b.race);var planWeeks=syncMergePlanWeeks(a.planWeeks,b.planWeeks);var updatedAt=new Date(Math.max(syncTs(a.updatedAt),syncTs(b.updatedAt))).toISOString();return{athlete:athlete,workouts:workouts,daily:daily,deleted:deleted,race:race,planWeeks:planWeeks,updatedAt:updatedAt};}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function fmtDate(iso){if(!iso)return"—";var p=iso.split("-");return p[2]+"/"+p[1];}
function fmtDateFull(iso){var d=new Date(iso+"T00:00:00");return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});}
function parseDur(str){if(!str)return null;str=str.trim();var p=str.split(":").map(Number);if(p.some(isNaN))return null;if(p.length===3)return p[0]*3600+p[1]*60+p[2];if(p.length===2)return p[0]*60+p[1];if(p.length===1)return p[0]*60;return null;}
function easyRuns(ws){return ws.filter(function(w){return(w.type==="facil"||w.type==="longão"||w.type==="regenerativo")&&w.hrAvg&&w.durationSec;});}
function isBike(w){return !!w&&(w.modal==="bike"||/cycl|bike|bicicl/i.test((w.sport||"").toString()));}
function isRun(w){return !isBike(w);}
function runsOnly(ws){return (ws||[]).filter(isRun);}
function bikesOnly(ws){return (ws||[]).filter(isBike);}
function bikeSummary(ws,a){
  var bikes=bikesOnly(ws);if(!bikes.length)return null;
  var totalSec=0,totalKm=0,totalKcal=0,totalTrimp=0,indoor=0,outdoor=0,totalGain=0,hrs=[];
  bikes.forEach(function(w){
    totalSec+=w.durationSec||0;totalKm+=w.distKm||0;totalKcal+=w.kcal||0;totalGain+=w.gainM||0;
    var t=computeTrimp(w,a);if(t!=null)totalTrimp+=t;
    if(w.hrAvg)hrs.push(w.hrAvg);
    if(w.indoor||!(w.distKm>0.05))indoor++;else outdoor++;
  });
  return{sessions:bikes.length,totalSec:totalSec,totalKm:Math.round(totalKm*10)/10,totalKcal:totalKcal,
    totalTrimp:Math.round(totalTrimp),totalGain:Math.round(totalGain),
    avgHr:hrs.length?Math.round(hrs.reduce(function(x,y){return x+y;},0)/hrs.length):null,indoor:indoor,outdoor:outdoor};
}
function kmH(w){if(!w.distKm||!w.durationSec)return null;return w.distKm/(w.durationSec/3600);}
function coachContext(ws,a){
  ws=ws||sortedWorkouts();a=a||state.athlete;
  var runs=runsOnly(ws),bike=bikeSummary(ws,a);
  var easy=easyRuns(runs);
  var efPts=easy.map(function(w){var ef=computeEF(w);return ef?{y:ef}:null;}).filter(Boolean);
  var cadPts=runs.filter(function(w){return w.cadence;}).map(function(w){return{y:w.cadence};});
  var decPts=runs.map(function(w){return computeDecoupling(w);}).filter(function(d){return d!=null;});
  var fit=[];try{fit=fitnessSeries(ws,a)||[];}catch(e){}
  var ac=null;try{ac=acuteChronic(ws,a);}catch(e){}
  var pol=polarization(ws,a),cons=consistency(ws,a.sessionsTarget);
  var trend=performanceTrend(efPts.map(function(p){return{value:p.y};}));
  var latestEF=efPts.length?efPts[efPts.length-1].y:null,firstEF=efPts.length?efPts[0].y:null;
  var efDelta=(latestEF&&firstEF)?((latestEF-firstEF)/firstEF)*100:null;
  var latestCad=cadPts.length?cadPts[cadPts.length-1].y:null;
  var latestDec=decPts.length?decPts[decPts.length-1]:null;
  var tsb=fit.length?fit[fit.length-1].tsb:null,ctl=fit.length?fit[fit.length-1].ctl:null;
  var last=ws.length?ws[ws.length-1]:null;
  var dailyArr=sortedDaily(),lastDailyDate=dailyArr.length?dailyArr[dailyArr.length-1].date:null;
  var refDate2=last?last.date:null;if(lastDailyDate&&(!refDate2||lastDailyDate>refDate2))refDate2=lastDailyDate;
  var restTr=metricTrend(dailyArr,"restingHR",refDate2),hrvTr=metricTrend(dailyArr,"hrv",refDate2);
  var sleepLast=sleepLatest(refDate2),vo2Last=latestDaily(dailyArr,"vo2");
  var dctx={tsb:tsb,restingDelta:restTr?restTr.deltaAbs:null,hrvDeltaPct:hrvTr?hrvTr.deltaPct:null,sleepH:sleepLast?sleepLast.value:(last&&last.sleepH!=null?last.sleepH:null)};
  var recov=recoveryStatus(dctx),vo2Eff=vo2Last?vo2Last.value:a.vo2;
  var td=trainingDistribution(ws,a),hillAgg=hillAggregate(runs);
  var refDate=last?new Date(last.date+"T00:00:00"):new Date();
  var km28=runs.filter(function(w){return Math.round((refDate-new Date(w.date+"T00:00:00"))/86400000)<28;}).reduce(function(s,w){return s+(w.distKm||0);},0);
  var avgWeeklyKm=km28/4;
  var score=performanceScore({efTrendPct:trend?trend.deltaPct:0,decoupling:latestDec,adherencePct:cons?cons.adherencePct:null,weeklyKm:avgWeeklyKm,targetKm:a.weeklyTargetKm,recovery:recov?recov.score:null});
  // prontidão = recuperação (sono/HRV/FC rep) + forma (TSB) + risco de carga (A:C)
  var rd=readiness({tsb:tsb,adherencePct:cons?cons.adherencePct:null,sleepH:dctx.sleepH,soreness:last?last.soreness:null,pain:last?last.pain:false,restingDelta:dctx.restingDelta,hrvDeltaPct:dctx.hrvDeltaPct});
  if(ac&&ac.ratio!=null&&ac.ratio>1.3)rd.score=Math.round(clamp(rd.score-(ac.ratio-1.3)*22,0,100));
  var rb=readyBand(rd.score);rd.band=rb[0];
  return {runs:runs,bike:bike,fit:fit,ac:ac,pol:pol,cons:cons,trend:trend,latestEF:latestEF,efDelta:efDelta,latestCad:latestCad,latestDec:latestDec,tsb:tsb,ctl:ctl,last:last,restTr:restTr,hrvTr:hrvTr,sleepLast:sleepLast,vo2Last:vo2Last,recov:recov,vo2Eff:vo2Eff,td:td,hillAgg:hillAgg,score:score,rd:rd,avgWeeklyKm:avgWeeklyKm};
}
function week7Km(runs){var cut=mIsoLocal(mAddDays(new Date(),-6));return (runs||[]).filter(function(w){return w.date>=cut;}).reduce(function(s,w){return s+(w.distKm||0);},0);}
function hojeVerdict(cx){var s=cx.rd.score;
  if(cx.last&&cx.last.pain)return "Sinal de dor — priorize recuperar; no máximo bike/elíptico leve.";
  if(cx.ac&&cx.ac.ratio>1.5)return "Carga saltou (A:C "+cx.ac.ratio.toFixed(2).replace(".",",")+") — fácil hoje pra não virar risco.";
  if(s>=80)return "Dia verde — pode puxar a qualidade se o plano pedir.";
  if(s>=70)return "Prontidão moderada — fácil a moderado; segure a qualidade.";
  if(s>=60)return "Cautela — mantenha fácil; a qualidade fica pra quando subir.";
  return "Recuperar — sono e um dia leve; o motor agradece.";}
function hojeAction(cx){
  if(cx.last&&cx.last.pain)return "descanso ou bike leve — proteger a tíbia.";
  if(cx.rd.score>=80)return "pode puxar a qualidade se o plano pedir.";
  if(cx.rd.score>=70)return "fácil a moderado; segure a qualidade.";
  if(cx.rd.score>=60)return "mantenha fácil hoje.";
  return "recuperar — fácil leve ou descanso.";}
function hojeCoachLines(cx){
  var out=[];
  if(cx.efDelta!=null&&cx.efDelta>1)out.push({c:"g",t:"<b>Motor subindo</b> — EF "+(cx.efDelta>=0?"+":"")+cx.efDelta.toFixed(0)+"% no bloco."});
  else if(cx.latestDec!=null&&cx.latestDec<5)out.push({c:"g",t:"<b>Resistência sólida</b> — deriva "+cx.latestDec.toFixed(1)+"% nos longos."});
  if(cx.last&&cx.last.pain)out.push({c:"w",t:"<b>Dor registrada</b> — recuar cedo protege a tíbia."});
  else if(cx.ac&&cx.ac.ratio>1.5)out.push({c:"w",t:"<b>Salto de carga</b> (A:C "+cx.ac.ratio.toFixed(2).replace(".",",")+") — segure o volume."});
  else if(cx.latestDec!=null&&cx.latestDec>8)out.push({c:"w",t:"<b>Deriva alta</b> ("+cx.latestDec.toFixed(1)+"%) — revise hidratação e pacing."});
  else if(cx.recov&&cx.recov.score<55)out.push({c:"w",t:"<b>Recuperação baixa</b> — priorize sono antes da qualidade."});
  out.push({c:"a",t:"<b>Hoje:</b> "+hojeAction(cx)});
  return out.slice(0,3);}
function progContext(){
  var a=state.athlete, ws=sortedWorkouts();
  var runs=runsOnly(ws), bikes=bikesOnly(ws), bike=bikeSummary(ws,a);
  var easy=easyRuns(runs);
  var efPts=easy.map(function(w){var ef=computeEF(w);return ef?{label:fmtDate(w.date),y:ef,extra:"FC "+w.hrAvg,w:w}:null;}).filter(Boolean);
  var gapPts=runs.filter(function(w){return computeGap(w).gapSpeed;}).map(function(w){var g=computeGap(w);return{label:fmtDate(w.date),y:g.gapPace,extra:w.type};});
  var cadPts=runs.filter(function(w){return w.cadence;}).map(function(w){return{label:fmtDate(w.date),y:w.cadence,extra:w.type};});
  var fit=fitnessSeries(ws,a);
  var ac=acuteChronic(ws,a);
  var pol=polarization(ws,a);
  var cons=consistency(ws,a.sessionsTarget);
  var trend=performanceTrend(efPts.map(function(p){return{value:p.y};}));
  var decPts=runs.map(function(w){var d=computeDecoupling(w);return d==null?null:{label:fmtDate(w.date),y:d,extra:w.type,color:d<5?"var(--good)":d<=8?"var(--warn)":"var(--crit)"};}).filter(Boolean);
  var loadByWeek={};ws.forEach(function(w){var t=computeTrimp(w,a);if(t==null)return;var k=isoWeekKey(w.date);loadByWeek[k]=(loadByWeek[k]||0)+t;});
  var weekKeys=Object.keys(loadByWeek).sort();
  var loadBars=weekKeys.map(function(k){return{label:k.replace(/^\d+-/,""),y:Math.round(loadByWeek[k])};});
  var lastWeek=weekKeys[weekKeys.length-1];
  var weeklyKm=runs.filter(function(w){return isoWeekKey(w.date)===lastWeek;}).reduce(function(a2,w){return a2+(w.distKm||0);},0);
  var refDate=new Date(ws[ws.length-1].date+"T00:00:00");
  var km28=runs.filter(function(w){return Math.round((refDate-new Date(w.date+"T00:00:00"))/86400000)<28;}).reduce(function(a2,w){return a2+(w.distKm||0);},0);
  var avgWeeklyKm=km28/4;
  var latestEF=efPts.length?efPts[efPts.length-1].y:null;
  var firstEF=efPts.length?efPts[0].y:null;
  var efDelta=(latestEF&&firstEF)?((latestEF-firstEF)/firstEF)*100:null;
  var efTarget=a.efBaseline*(1+(a.efGainPct||0)/100);
  var latestCad=cadPts.length?cadPts[cadPts.length-1].y:null;
  var latestDec=decPts.length?decPts[decPts.length-1].y:null;
  var tsb=fit.length?fit[fit.length-1].tsb:null;
  var ctl=fit.length?fit[fit.length-1].ctl:null;
  var last=ws[ws.length-1];
  var dailyArr=sortedDaily();
  var lastDailyDate=dailyArr.length?dailyArr[dailyArr.length-1].date:null;
  var refDate2=last.date;if(lastDailyDate&&lastDailyDate>refDate2)refDate2=lastDailyDate;
  var restTr=metricTrend(dailyArr,"restingHR",refDate2);
  var hrvTr=metricTrend(dailyArr,"hrv",refDate2);
  var sleepLast=sleepLatest(refDate2);
  var vo2Last=latestDaily(dailyArr,"vo2");
  var dctx={tsb:tsb,restingDelta:restTr?restTr.deltaAbs:null,hrvDeltaPct:hrvTr?hrvTr.deltaPct:null,sleepH:sleepLast?sleepLast.value:(last.sleepH!=null?last.sleepH:null)};
  var recov=recoveryStatus(dctx);
  var vo2Eff=vo2Last?vo2Last.value:a.vo2;
  var fcRepEff=restTr?restTr.latest:a.fcRep;
  var td=trainingDistribution(ws,a);
  var hillAgg=hillAggregate(runs);
  var score=performanceScore({efTrendPct:trend?trend.deltaPct:0,decoupling:latestDec,adherencePct:cons?cons.adherencePct:null,weeklyKm:avgWeeklyKm,targetKm:a.weeklyTargetKm,recovery:recov?recov.score:null});
  var rd=readiness({tsb:tsb,adherencePct:cons?cons.adherencePct:null,sleepH:dctx.sleepH,soreness:last.soreness,pain:last.pain,restingDelta:dctx.restingDelta,hrvDeltaPct:dctx.hrvDeltaPct});
  var confMap={"Alta":"alta","Moderada":"média","Baixa":"baixa","Dados insuficientes":"sem dados"};
  function byDateAsc(x,y){return x.date<y.date?-1:x.date>y.date?1:0;}
  var effHist=runs.filter(function(w){return w.eff;}).sort(byDateAsc);
  var mechHist=runs.filter(function(w){return w.mech&&w.mech.pct!=null;}).sort(byDateAsc);
  var easyR=easyRuns(runs);
  var ml=medianLag(easyR);
  var lagLow=ml.n<3;
  return {a:a,ws:ws,runs:runs,bikes:bikes,bike:bike,easy:easy,efPts:efPts,gapPts:gapPts,cadPts:cadPts,fit:fit,ac:ac,pol:pol,cons:cons,trend:trend,decPts:decPts,loadBars:loadBars,weeklyKm:weeklyKm,avgWeeklyKm:avgWeeklyKm,latestEF:latestEF,efDelta:efDelta,efTarget:efTarget,latestCad:latestCad,latestDec:latestDec,tsb:tsb,ctl:ctl,last:last,dailyArr:dailyArr,restTr:restTr,hrvTr:hrvTr,sleepLast:sleepLast,vo2Last:vo2Last,dctx:dctx,recov:recov,vo2Eff:vo2Eff,fcRepEff:fcRepEff,td:td,hillAgg:hillAgg,score:score,rd:rd,confMap:confMap,byDateAsc:byDateAsc,effHist:effHist,mechHist:mechHist,ml:ml,lagLow:lagLow};
}
function coachInsight(ws,a,x){
  var parts=[];
  // 1) perfil / baseline
  var baseline=ws.find(function(w){return w.type==="teste";});
  if(baseline){var p=computePacing(baseline);
    parts.push('<span class="lead">O baseline confirmou seu perfil.</span> '+baseline.distKm.toFixed(2)+' km a '+paceStr(baseline.durationSec/baseline.distKm)+'/km (GAP '+paceStr(computeGap(baseline).gapPace)+') com FC '+baseline.hrAvg+(p&&p.closer?', e o último km disparou '+Math.round(p.lastGainSec)+'s mais rápido — closer comprovado.':'.'));
  }
  // 2) motor: EF + decoupling
  if(x.latestEF){var efTxt=' Motor: EF fácil em <b>'+x.latestEF.toFixed(4)+'</b>'+(x.efDelta!=null?' ('+(x.efDelta>=0?'+':'')+x.efDelta.toFixed(1)+'% no bloco)':'')+' — meta +'+a.efGainPct+'%.';
    if(x.latestDec!=null)efTxt+=' Decoupling '+(x.latestDec<0?'negativo ('+x.latestDec.toFixed(1)+'%) — você fica mais eficiente no fim':x.latestDec.toFixed(1)+'%'+(x.latestDec>8?' (acima de 8% — investigar combustível/calor/pacing)':x.latestDec<7?' (base sólida)':''))+'.';
    parts.push(efTxt);}
  if(x.latestCad)parts.push(' Cadência em <b>'+x.latestCad+' spm</b> rumo a '+a.cadenceTarget+': a alavanca de maior retorno.');
  // 3) recuperação (Apple Watch): readiness + recovery + sono/HRV/FC repouso
  if(x.rd){var rec=[];
    if(x.sleepLast)rec.push('sono '+x.sleepLast.value+'h'+(x.sleepLast.value<6.5?' (curto)':''));
    if(x.hrvTr&&x.hrvTr.deltaPct!=null)rec.push('HRV '+(x.hrvTr.deltaPct>=0?'+':'')+x.hrvTr.deltaPct.toFixed(0)+'% vs base'+(x.hrvTr.deltaPct<-8?' (baixa)':''));
    if(x.restTr&&x.restTr.deltaAbs!=null)rec.push('FC repouso '+(x.restTr.deltaAbs<=0?'↓ '+Math.abs(x.restTr.deltaAbs).toFixed(0)+' (bom)':'↑ '+x.restTr.deltaAbs.toFixed(0)));
    var recWarn=(x.recov&&x.recov.label==="Needs Recovery")||(x.hrvTr&&x.hrvTr.deltaPct!=null&&x.hrvTr.deltaPct<-8)||(x.restTr&&x.restTr.deltaAbs>3);
    parts.push(' Recuperação: <b>Readiness '+x.rd.score+' ('+x.rd.band+')</b>'+(x.recov?' · Recovery '+x.recov.label:'')+(rec.length?' — '+rec.join(', ')+'.':'.')+(recWarn?' <b>Os sinais pedem cautela: priorize um dia leve antes de qualidade.</b>':(x.rd.score>=80?' Verde para uma sessão de qualidade.':'')));
  }
  // 4) distribuição de intensidade / 80-20
  if(x.pol){if(x.pol.easyPct<75)parts.push(' Distribuição: só <b>'+Math.round(x.pol.easyPct)+'% em zona fácil</b>'+(x.td?' (Z3 moderado em '+Math.round(x.td.pct.moderado)+'%)':'')+' — o histórico de correr o fácil forte demais aparece aqui; puxe o fácil para baixo.');
    else parts.push(' Distribuição saudável: <b>'+Math.round(x.pol.easyPct)+'% fácil</b> — polarização no rumo certo.');}
  // 5) carga: A:C + forma (TSB)
  var carga=[];
  if(x.ac)carga.push('A:C '+x.ac.ratio.toFixed(2)+' ('+x.ac.zone+')');
  if(x.tsb!=null)carga.push('forma '+(x.tsb>0?'+':'')+x.tsb.toFixed(0)+' ('+tsbState(x.tsb)+')');
  if(carga.length){var cargaWarn=x.ac&&(x.ac.zone==="atenção"||x.ac.zone==="risco");parts.push(' Carga: '+carga.join(' · ')+'.'+(cargaWarn?' <b>Salto de carga — segure a semana.</b>':''));}
  // 6) subida
  if(x.hillAgg)parts.push(' Subida: você sobe a <b>'+(x.hillAgg.effVsModel*100).toFixed(0)+'% do previsto</b> ('+x.hillAgg.totalClimbM+' m no ciclo) — '+(x.hillAgg.effVsModel>=1?'ponto forte no seu terreno':'espaço para ganhar força específica')+'.');
  // 6b) bike / cross-training
  if(x.bike)parts.push(' Cross-training: <b>'+x.bike.sessions+' sessão(ões) de bike</b> ('+hmsShort(x.bike.totalSec)+', TRIMP '+x.bike.totalTrimp+') sustentando a base aeróbica de baixo impacto — a carga da bike entra na forma (CTL·ATL·TSB) sem cobrar da tíbia. '+(x.bike.avgHr&&x.bike.avgHr<state.athlete.fcRep+(state.athlete.fcMax-state.athlete.fcRep)*0.74?'FC média em Z1–Z2: rodízio de base, exatamente o papel certo na pausa.':'Boa fatia de intensidade na bike — vale checar se não está competindo com a recuperação da canela.'));
  // 7) foco derivado do ponto mais fraco do score
  parts.push(' '+focusLine(x,a));
  return parts.join("");
}
function focusLine(x,a){
  if(x.rd&&x.rd.score<60)return '<b>Foco agora:</b> recuperar — sono e descarga antes de voltar à intensidade.';
  if(x.pol&&x.pol.easyPct<75)return '<b>Foco:</b> correr o fácil de verdade (FC em Z1–Z2) para liberar a adaptação da base.';
  if(x.score&&x.score.parts){var parts=x.score.parts,worst=null,wv=101;for(var k in parts)if(parts[k]<wv){wv=parts[k];worst=k;}
    var map={"Eficiência":"economia (EF) e cadência","Consistência":"regularidade — completar as sessões da semana","Resist. fadiga":"resistência aeróbica (longões que desacoplam menos)","Volume":"volume gradual (subir ~10%/semana)","Recuperação":"recuperação — sono, HRV e FC de repouso"};
    if(worst&&map[worst])return '<b>Foco da fase:</b> '+map[worst]+'.';}
  return '<b>Foco da fase:</b> economia (EF) e cadência para sustentar paces bons por mais tempo.';
}
function ciArrow(pct){if(pct==null)return null;if(pct>0.5)return{cls:"up",txt:"▲ +"+Math.abs(pct).toFixed(0)+"%"};if(pct<-0.5)return{cls:"down",txt:"▼ "+Math.abs(pct).toFixed(0)+"%"};return{cls:"flat",txt:"→"};}
function bestAnchor(ws){
  var cands=ws.filter(function(w){return(w.type==="teste"||w.type==="prova")&&w.distKm&&w.durationSec;});
  if(!cands.length)cands=ws.filter(function(w){return w.distKm&&w.durationSec;});
  if(!cands.length)return null;
  return cands.slice().sort(function(a,b){return a.date<b.date?1:-1;})[0];
}
var M_DOW=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
var M_MON=["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
var M_MONL=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
var M_ZONES=["Z1","Z2","Z3","Z4","Z5"];
var M_ZDESC={Z1:"muito leve",Z2:"fácil (base)",Z3:"moderado",Z4:"forte",Z5:"máximo"};
var M_TYPES=[
  {k:"rodagem",label:"Rodagem",emoji:"🏃",zone:"Z2"},
  {k:"longao",label:"Longão",emoji:"🛣️",zone:"Z2"},
  {k:"regenerativo",label:"Regenerativo",emoji:"💤",zone:"Z1"},
  {k:"tempo",label:"Tempo / Limiar",emoji:"🔥",zone:"Z3"},
  {k:"fartlek",label:"Fartlek",emoji:"⚡",zone:"Z3",structured:true},
  {k:"intervalado",label:"Qualidade / Intervalado",emoji:"🎯",zone:"Z4",structured:true},
  {k:"forca",label:"Força",emoji:"💪",zone:"",noRun:true},
  {k:"descanso",label:"Descanso",emoji:"😴",zone:"",noRun:true,rest:true}
];
var M_ADAPT=[{k:"esteira",label:"Esteira"},{k:"bike",label:"Bike indoor"},{k:"outro",label:"Outro"}];
function mType(k){for(var i=0;i<M_TYPES.length;i++)if(M_TYPES[i].k===k)return M_TYPES[i];return M_TYPES[0];}
function mIsStructured(s){return !!mType(s.type).structured;}
function mAdaptLabel(k){for(var i=0;i<M_ADAPT.length;i++)if(M_ADAPT[i].k===k)return M_ADAPT[i].label;return k||"alterado";}
function mParseClock(str){if(str==null)return null;str=(""+str).trim();if(!str)return null;
  if(str.indexOf(":")>=0){var p=str.split(":").map(Number);if(p.some(isNaN))return null;return p[0]*60+(p[1]||0);}
  var m=parseFloat(str.replace(",","."));if(isNaN(m))return null;return Math.round(m*60);}
function mClock(sec){if(sec==null)return"";var m=Math.floor(sec/60),s=Math.round(sec%60);return m+":"+mPad2(s);}
function mPad2(n){return (n<10?"0":"")+n;}
function mIsoLocal(d){return d.getFullYear()+"-"+mPad2(d.getMonth()+1)+"-"+mPad2(d.getDate());}
function mAddDays(d,n){var x=new Date(d.getTime());x.setDate(x.getDate()+n);return x;}
function mMonday(d){var x=new Date(d.getTime());x.setHours(0,0,0,0);var wd=(x.getDay()+6)%7;x.setDate(x.getDate()-wd);return x;}
function mDateBR(iso){if(!iso)return"—";var d=new Date(iso+"T00:00:00");return d.getDate()+" "+M_MON[d.getMonth()]+" "+d.getFullYear();}
function mKmTxt(km){if(km==null)return"—";var r=Math.round(km*10)/10;return (r%1===0?r.toFixed(0):r.toFixed(1)).replace(".",",");}
function mWeekInfo(offset){var mon=mMonday(mAddDays(new Date(),offset*7)),sun=mAddDays(mon,6);
  return {monday:mon,sunday:sun,key:isoWeekKey(mIsoLocal(mon)),monIso:mIsoLocal(mon),sunIso:mIsoLocal(sun)};}
function mWeekRange(info){var m=info.monday,s=info.sunday;
  var same=m.getMonth()===s.getMonth();
  return m.getDate()+(same?"":" "+M_MONL[m.getMonth()])+"–"+s.getDate()+" "+M_MONL[s.getMonth()];}
function mDaysToRace(race){if(!race||!race.date)return null;var r=new Date(race.date+"T00:00:00"),n=new Date();n.setHours(0,0,0,0);return Math.ceil((r-n)/86400000);}
function mBlock(race){var days=mDaysToRace(race);if(days==null)return null;var wkToGo=Math.max(0,Math.ceil(days/7));var N=wkToGo,cur;
  if(race.startDate){
    // Semana atual contada A PARTIR DO INÍCIO (alinhada à segunda): a semana do startDate é a "Semana 1".
    var WK=604800000;
    var sMon=mMonday(new Date(race.startDate+"T00:00:00"));
    var rMon=mMonday(new Date(race.date+"T00:00:00"));
    var tMon=mMonday(new Date());
    N=Math.round((rMon-sMon)/WK)+1;        // total de semanas do ciclo (início→prova), inclusivo
    cur=Math.round((tMon-sMon)/WK)+1;       // semana atual desde o início do ciclo
  } else { cur=N-wkToGo+1; }
  if(N<1)N=1;if(cur<1)cur=1;if(cur>N)cur=N;return {days:days,wkToGo:wkToGo,N:N,cur:cur};}
function mPhaseFracs(race){return (RACE_TYPES[raceTypeOf(race)]||RACE_TYPES.maratona).phases;}
function mPhase(blk,race){
  var fr=mPhaseFracs(race);
  var prog=(blk&&blk.N>0)?(blk.cur-0.5)/blk.N:1;
  var cum=0,idx=fr.length-1;
  for(var i=0;i<fr.length;i++){cum+=fr[i];if(prog<=cum+1e-9){idx=i;break;}}
  var m=PHASE_META[idx];
  return {k:m.k,name:m.name,emoji:m.emoji,desc:m.desc,idx:idx,fracs:fr};}
function cycleRunsInRange(race){
  var runs=runsOnly(sortedWorkouts()),s=race&&race.startDate,e=race&&race.date;
  return runs.filter(function(w){return (!s||w.date>=s)&&(!e||w.date<=e);});
}
function cycleSummary(race){
  if(!race)return null;
  var inR=cycleRunsInRange(race);
  var totalKm=0,maxLong=0;inR.forEach(function(w){totalKm+=(w.distKm||0);if((w.distKm||0)>maxLong)maxLong=w.distKm||0;});
  function efOf(w){return (!isBike(w)&&w.distKm&&w.durationSec&&w.hrAvg)?(w.distKm*1000/w.durationSec)/w.hrAvg:null;}
  var efRuns=inR.filter(function(w){return efOf(w)!=null;}).sort(function(a,b){return a.date<b.date?-1:1;});
  var efStart=efRuns.length?efOf(efRuns[0]):null,efEnd=efRuns.length?efOf(efRuns[efRuns.length-1]):null;
  var efDelta=(efStart&&efEnd)?(efEnd-efStart)/efStart*100:null;
  var ctlEnd=null;try{var fit=fitnessSeries(sortedWorkouts(),state.athlete)||[];ctlEnd=fit.length?fit[fit.length-1].ctl:null;}catch(e){}
  // adesão: sessões cumpridas vs programadas (não-descanso) nas semanas do ciclo
  var okN=0,totN=0,weeksN=0;
  Object.keys(state.planWeeks||{}).forEach(function(k){
    var wk=state.planWeeks[k];if(!wk||!wk.sessions||!wk.sessions.length)return;
    // só semanas cujo início cai dentro do ciclo
    var mon=mWeekMonFromKey(k);if(mon){var iso=mIsoLocal(mon);if((race.startDate&&iso<race.startDate)||(race.date&&iso>race.date))return;}
    var train=wk.sessions.filter(function(s){return !mType(s.type).rest;});if(!train.length)return;weeksN++;
    train.forEach(function(s){totN++;if(s.done||s.linkedWorkoutId||(s.adapt&&s.adapt.modal))okN++;});
  });
  var adesao=totN?Math.round(okN/totN*100):null;
  return {totalKm:totalKm,maxLong:maxLong,nRuns:inR.length,efStart:efStart,efEnd:efEnd,efDelta:efDelta,ctlEnd:ctlEnd,adesao:adesao,weeks:weeksN,okN:okN,totN:totN};
}
function mWeekMonFromKey(key){var m=/^(\d{4})-W(\d{2})$/.exec(key||"");if(!m)return null;
  var y=+m[1],w=+m[2];var simple=new Date(Date.UTC(y,0,1+(w-1)*7));var dow=(simple.getUTCDay()+6)%7;
  var mon=new Date(simple);mon.setUTCDate(simple.getUTCDate()-dow+(dow<=3?0:7)-0);
  // ajusta para a segunda da semana ISO
  var thursday=new Date(simple);thursday.setUTCDate(simple.getUTCDate()-dow+3);
  var monday=new Date(thursday);monday.setUTCDate(thursday.getUTCDate()-3);
  return new Date(monday.getUTCFullYear(),monday.getUTCMonth(),monday.getUTCDate());}
function cycleSummaryText(race,sum){
  sum=sum||cycleSummary(race);var t=RACE_TYPES[raceTypeOf(race)];
  var L=[];
  L.push("🏁 "+(race.name||"Ciclo")+" · "+(t?t.label:"Prova"));
  L.push((race.startDate?mDateBR(race.startDate):"—")+" → "+(race.date?mDateBR(race.date):"—")+" · "+mKmTxt(race.distKm)+" km");
  if(race.objective)L.push("🎯 "+race.objective);
  L.push("");
  L.push("📊 Volume total: "+mKmTxt(sum.totalKm)+" km em "+sum.nRuns+" corridas");
  L.push("🏃 Maior longão: "+mKmTxt(sum.maxLong)+" km");
  if(sum.efStart!=null&&sum.efEnd!=null)L.push("⚙️ EF (economia): "+(sum.efStart*1000).toFixed(1).replace(".",",")+" → "+(sum.efEnd*1000).toFixed(1).replace(".",",")+(sum.efDelta!=null?" ("+(sum.efDelta>=0?"+":"")+sum.efDelta.toFixed(0)+"%)":""));
  if(sum.ctlEnd!=null)L.push("📈 Forma final (CTL): "+Math.round(sum.ctlEnd));
  if(sum.adesao!=null)L.push("✅ Adesão: "+sum.adesao+"% ("+sum.okN+"/"+sum.totN+" sessões, "+sum.weeks+" semanas)");
  L.push("");
  L.push("— Apex Run Performance");
  return L.join("\n");
}
function runZoneHrRanges(a){
  var rep=a&&a.fcRep,mx=a&&a.fcMax;if(!rep||!mx||mx<=rep)return null;
  function hr(p){return Math.round(rep+p*(mx-rep));}
  return [
    {z:"Z1",lo:rep,hi:hr(0.59)-1,mid:hr(0.45)},
    {z:"Z2",lo:hr(0.59),hi:hr(0.74)-1,mid:hr(0.665)},
    {z:"Z3",lo:hr(0.74),hi:hr(0.84)-1,mid:hr(0.79)},
    {z:"Z4",lo:hr(0.84),hi:hr(0.88)-1,mid:hr(0.86)},
    {z:"Z5",lo:hr(0.88),hi:mx,mid:hr(0.94)}
  ];
}
function mPaceByZone(runs,a){
  var ranges=runZoneHrRanges(a);if(!ranges)return null;
  var pts=(runs||[]).filter(function(w){return !isBike(w)&&w.hrAvg&&(w.distKm||0)>=2&&w.durationSec;})
    .sort(function(x,y){return x.date<y.date?1:-1;}).slice(0,24)
    .map(function(w){return{hr:w.hrAvg,pace:w.durationSec/w.distKm};});
  if(pts.length<3)return null;
  var n=pts.length,sx=0,sy=0,sxx=0,sxy=0;
  pts.forEach(function(p){sx+=p.hr;sy+=p.pace;sxx+=p.hr*p.hr;sxy+=p.hr*p.pace;});
  var den=n*sxx-sx*sx;if(!den)return null;
  var b=(n*sxy-sx*sy)/den,aI=(sy-b*sx)/n;
  if(b>=0)return null; // esperado: FC maior → pace menor (seg/km). Sem relação clara, não estima.
  var minHr=Math.min.apply(null,pts.map(function(p){return p.hr;})),maxHr=Math.max.apply(null,pts.map(function(p){return p.hr;}));
  var zones=ranges.map(function(r){var pace=aI+b*r.mid;return{z:r.z,lo:r.lo,hi:r.hi,hr:r.mid,pace:pace>0?pace:null,extrap:(r.mid<minHr-8||r.mid>maxHr+8)};});
  return {zones:zones,n:n,minHr:minHr,maxHr:maxHr};
}
function weeklyReadiness(ws,a){
  var daily=sortedDaily();if(!daily.length)return null;
  var fit=[];try{fit=fitnessSeries(ws,a)||[];}catch(e){}
  var tsbBy={};fit.forEach(function(d){tsbBy[d.date]=d.tsb;});
  function tsbAt(date){if(tsbBy[date]!=null)return tsbBy[date];for(var i=fit.length-1;i>=0;i--){if(fit[i].date<=date)return fit[i].tsb;}return null;}
  var lastDate=daily[daily.length-1].date;
  var cut=mIsoLocal(mAddDays(new Date(lastDate+"T00:00:00"),-6));
  var days=daily.filter(function(d){return d.date>=cut;});
  if(!days.length)return null;
  var scores=[],sl=[],rhr=[],hv=[];
  days.forEach(function(d){
    var rt=metricTrend(daily,"restingHR",d.date),ht=metricTrend(daily,"hrv",d.date);
    var r=readiness({tsb:tsbAt(d.date),sleepH:d.sleepH,soreness:d.soreness,pain:d.pain,restingDelta:rt?rt.deltaAbs:null,hrvDeltaPct:ht?ht.deltaPct:null});
    scores.push(r.score);
    if(d.sleepH!=null)sl.push(d.sleepH);if(d.restingHR!=null)rhr.push(d.restingHR);if(d.hrv!=null)hv.push(d.hrv);
  });
  if(!scores.length)return null;
  function mean2(x){return x.length?x.reduce(function(p,q){return p+q;},0)/x.length:null;}
  var avg=Math.round(mean2(scores));
  var band=avg>=90?"Peak Ready":avg>=80?"Ready":avg>=70?"Moderate":avg>=60?"Caution":"Recovery";
  return {score:avg,band:band,n:scores.length,sleep:mean2(sl),rhr:rhr.length?Math.round(mean2(rhr)):null,hrv:hv.length?Math.round(mean2(hv)):null,
    tsb:fit.length?fit[fit.length-1].tsb:null,min:Math.min.apply(null,scores),max:Math.max.apply(null,scores),from:days[0].date,to:lastDate};
}
function readyBand(s){return s>=90?["Peak Ready","hi"]:s>=80?["Ready","hi"]:s>=70?["Moderate","mid"]:s>=60?["Caution","mid"]:["Recovery","lo"];}
function consistencyHeatmap(ws,a,weeks){
  weeks=weeks||18;
  var load={};(ws||[]).forEach(function(w){var t=computeTrimp(w,a)||0;load[w.date]=(load[w.date]||0)+t;});
  // ancora no domingo da semana atual
  var today=new Date();today.setHours(0,0,0,0);
  var dow=(today.getDay()+6)%7; // 0=seg
  var endSun=mAddDays(today,6-dow);
  var startMon=mAddDays(endSun,-(weeks*7-1));
  var vals=Object.keys(load).map(function(k){return load[k];}).filter(function(x){return x>0;}).sort(function(p,q){return p-q;});
  var q1=vals.length?vals[Math.floor(vals.length*0.25)]:0,q2=vals.length?vals[Math.floor(vals.length*0.5)]:0,q3=vals.length?vals[Math.floor(vals.length*0.75)]:0;
  function lvl(v){if(!v)return 0;if(v<=q1)return 1;if(v<=q2)return 2;if(v<=q3)return 3;return 4;}
  var cols=[];var active=0,total=0;
  for(var wkI=0;wkI<weeks;wkI++){
    var col=[];var monday=mAddDays(startMon,wkI*7);
    for(var dI=0;dI<7;dI++){var dd=mAddDays(monday,dI);var iso=mIsoLocal(dd);var v=load[iso]||0;var future=dd>today;
      if(!future)total++;if(v>0)active++;
      col.push({date:iso,v:v,lvl:future?-1:lvl(v),future:future,mon:dd.getDate()<=7});}
    cols.push({monIso:mIsoLocal(monday),month:M_MON[monday.getMonth()],cells:col});
  }
  return {cols:cols,active:active,total:total,q:[q1,q2,q3]};
}
function mSessSteps(s){return (s.steps&&s.steps.length)?s.steps:[];}
function mSessMinutes(s){
  if(mIsStructured(s)){var sec=0;mSessSteps(s).forEach(function(st){
    if(st.rep){var t=st.times||1;(st.segs||[]).forEach(function(g){sec+=t*(g.durSec||0);});}else sec+=st.durSec||0;});
    return sec?sec/60:null;}
  return (s.durMin!=null&&s.durMin!=="")?+s.durMin:null;}
function mSessKm(s){
  if(mIsStructured(s)){var km=0,any=false;mSessSteps(s).forEach(function(st){
    if(st.rep){var t=st.times||1;(st.segs||[]).forEach(function(g){if(g.distKm){km+=t*g.distKm;any=true;}});}
    else if(st.distKm){km+=st.distKm;any=true;}});return any?km:null;}
  return (s.distKm!=null&&s.distKm!=="")?+s.distKm:null;}
function mSessZoneSecs(s){var acc={Z1:0,Z2:0,Z3:0,Z4:0,Z5:0};
  if(mIsStructured(s)){mSessSteps(s).forEach(function(st){
    if(st.rep){var t=st.times||1;(st.segs||[]).forEach(function(g){if(M_ZONES.indexOf(g.zone)>=0)acc[g.zone]+=t*(g.durSec||0);});}
    else if(M_ZONES.indexOf(st.zone)>=0)acc[st.zone]+=st.durSec||0;});}
  else if(M_ZONES.indexOf(s.zone)>=0)acc[s.zone]+=((+s.durMin||30)*60);
  return acc;}
function mPeakZone(s){var z=mSessZoneSecs(s),best=null,bv=0;M_ZONES.forEach(function(k){if(z[k]>bv){bv=z[k];best=k;}});return best;}
function mZoneMix(sessions){var acc={Z1:0,Z2:0,Z3:0,Z4:0,Z5:0},tot=0;
  (sessions||[]).forEach(function(s){var z=mSessZoneSecs(s);M_ZONES.forEach(function(k){acc[k]+=z[k];tot+=z[k];});});
  if(!tot)return null;var out={};M_ZONES.forEach(function(k){out[k]=Math.round(acc[k]/tot*100);});return out;}
function mSessSummary(s){
  if(mIsStructured(s)){return mSessSteps(s).map(function(st){
    if(st.rep)return (st.times||1)+"×("+(st.segs||[]).map(function(g){return mClock(g.durSec)+(g.zone?" "+g.zone:"");}).join(" / ")+")";
    return mClock(st.durSec)+(st.zone?" "+st.zone:"");}).join(" · ");}
  var p=[],mins=mSessMinutes(s);if(mins)p.push(Math.round(mins)+" min");
  if(s.distKm)p.push(mKmTxt(s.distKm)+" km");if(M_ZONES.indexOf(s.zone)>=0)p.push(s.zone);
  return p.join(" · ");}
function mSessDate(info,s){return mIsoLocal(mAddDays(info.monday,(s.dow||1)-1));}
function mWorkoutById(id){var ws=state.workouts||[];for(var i=0;i<ws.length;i++)if(ws[i].id===id)return ws[i];return null;}
function mLinkWeek(info,sessions){
  if(!sessions||!sessions.length)return false;
  var byDate={};(state.workouts||[]).forEach(function(w){if(w&&w.date)(byDate[w.date]=byDate[w.date]||[]).push(w);});
  var used={},changed=false;
  sessions.forEach(function(s){if(s.linkedWorkoutId)used[s.linkedWorkoutId]=true;});
  sessions.forEach(function(s){
    if(mType(s.type).noRun)return;
    if(s.linkedWorkoutId){if(mWorkoutById(s.linkedWorkoutId))return;s.linkedWorkoutId=null;changed=true;}
    var cands=(byDate[mSessDate(info,s)]||[]).filter(function(w){return !used[w.id];});
    if(cands.length){s.linkedWorkoutId=cands[0].id;used[cands[0].id]=true;changed=true;}
  });
  return changed;}
function mSessStatus(s,info){
  var w=s.linkedWorkoutId?mWorkoutById(s.linkedWorkoutId):null;
  if(s.adapt&&s.adapt.modal)return "adapted";
  if(w)return (isBike(w)&&!mType(s.type).noRun)?"adapted":"done";
  if(s.done)return "done";
  var today=new Date();today.setHours(0,0,0,0);
  if(!mType(s.type).rest&&info.sunday<today)return "missed";
  return "planned";}
var M_STATUS={done:["✓ Cumprido","done"],adapted:["↺ Adaptado","adapt"],partial:["◧ Parcial","partial"],missed:["✗ Não cumprido","miss"],planned:["⏳ Programado","plan"]};
function mAnalyze(s,info){
  var st=mSessStatus(s,info),w=s.linkedWorkoutId?mWorkoutById(s.linkedWorkoutId):null;
  var planMin=mSessMinutes(s),planKm=mSessKm(s),planTxt=[];
  if(planMin)planTxt.push(Math.round(planMin)+" min");if(planKm)planTxt.push(mKmTxt(planKm)+" km");
  if(!w){
    if(st==="adapted")return {cls:"adapt",label:M_STATUS.adapted[0],txt:(s.adapt?mAdaptLabel(s.adapt.modal):"alterado")+(s.adapt&&s.adapt.note?" · "+s.adapt.note:"")};
    if(st==="done")return {cls:"done",label:M_STATUS.done[0],txt:"marcado como feito"};
    if(st==="missed")return {cls:"miss",label:M_STATUS.missed[0],txt:"sem treino vinculado"};
    return null;
  }
  var actMin=w.durationSec?w.durationSec/60:null,actKm=w.distKm||null,actTxt=[];
  if(actMin)actTxt.push(Math.round(actMin)+" min");if(actKm)actTxt.push(mKmTxt(actKm)+" km");
  var adapted=(isBike(w)&&!mType(s.type).noRun)||!!(s.adapt&&s.adapt.modal);
  var label=M_STATUS.done[0],cls="done";
  var base=planKm||planMin,act=planKm?actKm:actMin;
  if(base&&act){var r=act/base;if(r<0.85){label=M_STATUS.partial[0];cls="partial";}else if(r>1.15){label="✓ Acima do previsto";cls="done";}}
  if(adapted){label=M_STATUS.adapted[0];cls="adapt";}
  var note=(planTxt.length?"plan "+planTxt.join(" · "):"")+(actTxt.length?" · feito "+actTxt.join(" · "):"");
  if(s.adapt&&s.adapt.modal)note=mAdaptLabel(s.adapt.modal)+(s.adapt.note?" ("+s.adapt.note+")":"")+" · "+note;
  else if(isBike(w))note="feito de bike · "+note;
  return {cls:cls,label:label,txt:note};}
function tsbState(t){if(t==null)return"—";if(t>5)return"fresco (bom para teste/prova)";if(t>=-10)return"equilibrado";if(t>=-30)return"em treino pesado (normal na construção)";return"muito carregado";}
function hydroHas(w){return !!w&&(w.waterBefore!=null||w.waterDuring!=null||w.waterAfter!=null);}
function hydroTotal(w){if(!hydroHas(w))return null;return (w.waterBefore||0)+(w.waterDuring||0)+(w.waterAfter||0);}
function hydroRateMlH(w){if(!w||w.waterDuring==null||!w.durationSec)return null;return w.waterDuring/(w.durationSec/3600);}
function hydroStatus(rate){if(rate==null)return null;if(rate<400)return{label:"baixa",c:"var(--warn)"};if(rate<=900)return{label:"adequada",c:"var(--good)"};return{label:"alta",c:"var(--trend)"};}
function hydroPhaseAvg(rs,key){var v=(rs||[]).map(function(w){return w[key];}).filter(function(x){return x!=null;});return v.length?Math.round(v.reduce(function(a,b){return a+b;},0)/v.length):null;}
function hydroTotalAvg(rs){var v=(rs||[]).map(hydroTotal).filter(function(x){return x!=null;});return v.length?Math.round(v.reduce(function(a,b){return a+b;},0)/v.length):null;}
function hydroPlan(w,a){
  if(!w||!w.durationSec)return null;
  var kg=(a&&a.weight)||72,durH=w.durationSec/3600,durMin=w.durationSec/60,temp=(w.temp!=null)?w.temp:18;
  // ANTES: ~5 ml/kg base (ACSM), +2 ml/kg em longo (>90'), +1 ml/kg em calor (≥24°C)
  var kAntes=5+(durMin>90?2:durMin>60?1:0)+(temp>=24?1:temp>=20?0.5:0);
  var antesTarget=Math.round(kg*kAntes);
  // DURANTE: taxa ml/h; piso menor em treino curto e frio (beber na sede basta)
  var rate=(w.waterDuring!=null)?Math.round(w.waterDuring/durH):null;
  var durFloor=(durMin<60&&temp<20)?300:400;
  // DEPOIS: repor ~125% do déficit estimado (suor estimado − bebido durante)
  var sweatRate=clamp(kg*(9+Math.max(0,temp-15)*0.55),500,1600); // ml/h, cresce com peso e calor
  var estSweat=Math.round(sweatRate*durH);
  var deficit=Math.max(0,estSweat-(w.waterDuring||0));
  var depoisTarget=Math.max(250,Math.round(deficit*1.25));
  return {kg:kg,durMin:durMin,temp:temp,tempKnown:(w.temp!=null),antesTarget:antesTarget,antes:w.waterBefore,rate:rate,durFloor:durFloor,estSweat:estSweat,deficit:deficit,depoisTarget:depoisTarget,depois:w.waterAfter};
}
function hydroDurStat(rate,floor){if(rate==null)return{label:"—",c:"var(--muted)"};floor=floor||400;if(rate<floor)return{label:"baixa",c:"var(--warn)"};if(rate<=900)return{label:"adequada",c:"var(--good)"};return{label:"alta",c:"var(--trend)"};}
function hydroPhaseStat(val,target){if(val==null)return{label:"—",c:"var(--muted)"};if(val>=target*0.85)return{label:"bom",c:"var(--good)"};if(val>=target*0.5)return{label:"pouco",c:"var(--warn)"};return{label:"baixo",c:"var(--crit)"};}
function hydroNextDayRecovery(w){
  if(!w||!w.date)return null;var daily=sortedDaily();if(!daily.length)return null;
  var next=mIsoLocal(mAddDays(new Date(w.date+"T00:00:00"),1));
  var d=daily.filter(function(e){return e.date===next;})[0];if(!d)return null;
  var rt=metricTrend(daily,"restingHR",next),ht=metricTrend(daily,"hrv",next);
  return {date:next,restingDelta:rt?rt.deltaAbs:null,hrvDeltaPct:ht?ht.deltaPct:null,restingHR:d.restingHR,hrv:d.hrv};
}
function typeLabel(t){return{facil:"Fácil",longão:"Longão",tempo:"Tempo",limiar:"Limiar",intervalado:"Intervalado",regenerativo:"Regenerativo",teste:"Teste",prova:"Prova",bike:"Bike",bike_int:"Bike forte"}[t]||t;}
function parseSplits(txt){
  if(!txt||!txt.trim())return null;
  var out=[];var lines=txt.split(/\n/);
  for(var i=0;i<lines.length;i++){
    var ln=lines[i].trim();if(!ln)continue;
    var parts=ln.split(/[,;\t]+/).map(function(s){return s.trim();});
    var t=parseDur(parts[0]);if(t==null)continue;
    var hr=parts[1]!=null&&parts[1]!==""?+parts[1]:null;
    var elev=parts[2]!=null&&parts[2]!==""?+parts[2]:null;
    out.push({distKm:1,timeSec:t,hrAvg:isNaN(hr)?null:hr,elevDeltaM:isNaN(elev)?null:elev});
  }
  return out.length?out:null;
}

export {
  GAP_UP, GAP_DOWN, clamp, mean, std, paceStr,
  hms, hmsShort, gradeCostMult, gapTimeFromSplits, gapTimeEstimate, computeGap,
  finishGap, computeEF, splitIntoHalves, halfEFfromSplits, computeDecoupling, computePacing,
  computePaceStability, trimpSeg, maxFor, computeTrimp, computeHrCostKm, hrZone,
  zoneBoundsFor, hrZoneBounds, zonesFromHist, zonesFromHistBounds, zoneSeconds, polarization,
  trainingDistribution, hillPerformance, hillAggregate, median, hrGradeBand, HR_GRADE_BANDS,
  hrGradeCost, metricTrend, latestDaily, sleepEntriesAll, sleepLatest, recoveryStatus,
  dailyLoads, fitnessSeries, acuteChronic, performanceTrend, riegel, racePredictions,
  vo2Band, isoWeekKey, consistency, performanceScore, readiness, fitNum,
  fitISODate, fitCadence, SEMI, fitNormRecords, fitInterpAlt, fitInterpTime,
  fitBuildSplits, fitAscentDescent, fitHrHist, strSpm, vGap, recordingMode,
  pauseWindows, resampleHz, gradeSeries, preprocess, reduceStream, expandStream,
  theilSen, sampleDt, hrLag, paceGapAtHR, pruneStreams, sessionEff,
  effTree, cadenceAtPace, mechDecoupling, medianLag, decoupleMatrix, paceRefSuggest,
  downgradeConf, gradeBandIdx, capArr, gradeProfile, weatherUrl, pickHour,
  climateTags, climateOpts, fetchWeather, impSample, impBaseline, impIndex,
  matInv, mlr, mlrRobust, impPhase2, motorTest, alignForModel,
  computeStreamKpis, modalFromSport, fitMessagesToWorkout, HK_TYPES, appleDateMs, localDay,
  extractHealthRecords, aggregateDaily, readHealthFile, LS_KEY, DEFAULT_ATHLETE, DEFAULT_RACE,
  defaultRace, RACE_TYPES, PHASE_META, raceTypeOf, seedWorkouts, uid,
  seedDaily, load, touch, _saveWarned, _isQuotaErr, _stripStream,
  save, sortedWorkouts, sortedDaily, _dailyByDate, linkSleepToWorkouts, workoutDayReadiness,
  nextWorkoutSuggestion, mergeDaily, normalizeSyncCode, newSyncCode, syncHashId, syncTs,
  syncStripEmpty, syncMergeDeleted, syncMergeWorkouts, syncMergeDaily, syncMergeRace, syncMergePlanWeeks,
  syncMergeStates, esc, fmtDate, fmtDateFull, parseDur, easyRuns,
  isBike, isRun, runsOnly, bikesOnly, bikeSummary, kmH,
  coachContext, week7Km, hojeVerdict, hojeAction, hojeCoachLines, progContext,
  coachInsight, focusLine, ciArrow, bestAnchor, M_DOW, M_MON,
  M_MONL, M_ZONES, M_ZDESC, M_TYPES, M_ADAPT, mType,
  mIsStructured, mAdaptLabel, mParseClock, mClock, mPad2, mIsoLocal,
  mAddDays, mMonday, mDateBR, mKmTxt, mWeekInfo, mWeekRange,
  mDaysToRace, mBlock, mPhaseFracs, mPhase, cycleRunsInRange, cycleSummary,
  mWeekMonFromKey, cycleSummaryText, runZoneHrRanges, mPaceByZone, weeklyReadiness, readyBand,
  consistencyHeatmap, mSessSteps, mSessMinutes, mSessKm, mSessZoneSecs, mPeakZone,
  mZoneMix, mSessSummary, mSessDate, mWorkoutById, mLinkWeek, mSessStatus,
  M_STATUS, mAnalyze, tsbState, hydroHas, hydroTotal, hydroRateMlH,
  hydroStatus, hydroPhaseAvg, hydroTotalAvg, hydroPlan, hydroDurStat, hydroPhaseStat,
  hydroNextDayRecovery, typeLabel, parseSplits,
};
