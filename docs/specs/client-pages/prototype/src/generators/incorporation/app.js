(function(){
'use strict';
var PH=['Name Application','Incorporation','Post-Incorporation','Registration'];
var PH_KEY=['inc-phase-a','inc-phase','inc-phase-3','inc-phase-4'];
var PH_TIP=['SPICe+ Part A · name approval with MCA','SPICe+ Part B · the company is formed','Post-incorporation · the first 180 days','Registrations · tax, labour, trade and FEMA'];
var PH_INFO=['Name approval with MCA (SPICe+ Part A): your details, the board resolution, and the name application SBC files for you.','SPICe+ Part B: capital, registered office, directors and subscribers, KYC and DSC, the filing, and the Certificate of Incorporation.','What a new company must do in its first months: board meeting, bank account, share capital, share certificates and ROC filings.','The registrations the company needs to operate, grouped as in VCFO Suite: General, Customs, Foreign Trade, Labour, Local Compliance, IP/Brand and FEMA.'];
var PH_WHY=['Nothing else can start until MCA approves the company name.','It ends with the Certificate of Incorporation: your company exists from that date.','Most of these have legal deadlines counted from the incorporation date (30 to 180 days).','The company needs these to invoice, hire and trade; GST comes first.'];
var PH_SRC=['Companies Act 2013 · SPICe+ Part A (RUN)','Companies Act 2013 · SPICe+ Part B, AGILE-PRO-S','Companies Act 2013 · INC-20A, ADT-1, SH-1','GST, labour, trade and FEMA rules'];
var INFO_WHY={coi:'It is the date your company legally exists; everything after it is counted from that day.',phases:'It shows at a glance which phase is late, on time or not started.',docs:'Missing or old documents are the most common reason MCA sends a filing back.',noc:'Without it MCA rejects the registered office proof.',timeline:'It shows who did what and when, so nothing waits unnoticed.'};
var PH_WAIT=['','','Post-incorporation starts once the Certificate of Incorporation is issued.','Registrations start after the Certificate of Incorporation. GST comes first.'];
var KL={done:'Done',you:'Waiting on you',prog:'In progress',with:'With SBC',up:'Upcoming'};
var KCOL={done:'#15805f',you:'#c8620e',prog:'#0f2a4a',with:'#2453c7',up:'#8a97a8'};
var KORD=['done','you','prog','with','up'];
var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var DAY=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var TODAY_B='2026-10-06',TODAY_A='2026-11-12',WIN_END='2026-10-28',AX0='2026-09-08',AX1='2026-12-31';
var PLAN={1:['2026-09-08','2026-09-28'],2:['2026-09-29',WIN_END]};
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var AFTER_ON=readAfter(),openPh=null,briefOpen=false,firstPaint=true,pop=null,popBtn=null,lastFocus=null,railAll=false,zoom=1,checks={};
var main=document.getElementById('main');

/* ---------- helpers ---------- */
function readAfter(){try{return JSON.parse(localStorage.getItem('vcfo.after'))===true;}catch(e){return false;}}
function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function ic(n,c){return '<svg class="'+(c||'ic')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(IC[n]||'')+'</svg>';}
function sic(n,w){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(w||3)+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(IC[n]||'')+'</svg>';}
var GLY={done:sic('check',3.6),you:sic('user-round',3),prog:sic('clock',2.8),with:sic('trending-up',3),up:'',late:sic('x',3.4)};
function si(k,tip,cls){return '<span class="si '+k+(cls?' '+cls:'')+'"'+(tip?' role="img" aria-label="'+esc(tip)+'" data-tt="'+esc(tip)+'"':' aria-hidden="true"')+'>'+(GLY[k]||'')+'</span>';}
var BOTI='<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="15" y="2" width="2" height="5" rx="1" fill="#1e40af"/><circle cx="16" cy="3" r="2.2" fill="#2dd4bf"/><rect x="3" y="7" width="26" height="21" rx="9" fill="#2563eb"/><rect x="7" y="12" width="18" height="10" rx="5" fill="#0b1736"/><rect x="11" y="14.5" width="3" height="5" rx="1.5" fill="#7dd3fc"/><rect x="18" y="14.5" width="3" height="5" rx="1.5" fill="#7dd3fc"/></svg>';
function bmini(){return '<span class="bmini" aria-hidden="true">'+BOTI+'</span>';}
function pd(s){var a=s.split('-');return new Date(Date.UTC(+a[0],+a[1]-1,+a[2]));}
function isoD(d){return d.toISOString().slice(0,10);}
function addD(s,k){var d=pd(s);d.setUTCDate(d.getUTCDate()+k);return isoD(d);}
function fmt(s){var d=pd(s);return d.getUTCDate()+' '+MON[d.getUTCMonth()];}
function fmtY(s){return fmt(s)+' '+pd(s).getUTCFullYear();}
function wd(s){return DAY[pd(s).getUTCDay()];}
function days(a,b){return Math.round((pd(b)-pd(a))/864e5);}
function today(){return AFTER_ON?TODAY_A:TODAY_B;}
function ST(n){return (AFTER_ON?AFTER:BEFORE)[n-1];}
function KD(n){var s=ST(n);return s==='prog'&&STEPS[n-1].o!=='You'?'with':s;}
function DT(n){return (AFTER_ON?DATES_A:DATES_B)[n-1];}
function since(n){var d=addD(DT(n),-5);return d>today()?today():d;}
function coiDate(){return AFTER_ON?DT(14):WIN_END;}
function steps(p){return STEPS.filter(function(x){return x.p===p;});}
function cnt(list){var c={done:0,you:0,prog:0,with:0,up:0};list.forEach(function(x){c[KD(x.n)]++;});return c;}
function phState(p){var l=steps(p),c=cnt(l);return c.done===l.length?'done':(c.up===l.length?'up':'active');}
function phKind(p){var s=phState(p);return s==='done'?'done':(s==='up'?'up':'prog');}
function phEnd(p){var d=steps(p).map(function(x){return DT(x.n);}).sort();return d[d.length-1];}
function phPlan(p){if(PLAN[p])return PLAN[p];return [coiDate(),phEnd(p)];}
function curPhase(){for(var p=1;p<=4;p++){if(phState(p)!=='done')return p;}return 4;}
function doneN(list){return list.filter(function(x){return ST(x.n)==='done';}).length;}
function dateCell(n){var k=KD(n),d=fmt(DT(n));if(k==='done')return 'Done '+d;if(k==='you'||k==='prog')return 'Due '+d;if(k==='with')return 'since '+fmt(since(n));return n===14?'exp. '+fmt(coiDate()):'—';}
function tipTxt(n){var k=KD(n),d=fmt(DT(n));return KL[k]+' · '+(k==='done'?d:k==='with'?'since '+fmt(since(n))+' · due '+d:k==='up'?'planned '+d:'due '+d);}
function chip(k){return '<span class="chip '+k+'">'+KL[k]+'</span>';}
function own(o){return '<span class="own '+o+'" role="img" aria-label="Owner · '+o+'" data-tt="'+(o==='You'?'You own this step':'SBC owns this step')+'">'+o+'</span>';}
function short(l){l=String(l).replace(/\s*\(.*$/,'').replace(/,.*$/,'');return l.length>22?l.slice(0,20).replace(/\s+\S*$/,'')+'…':l;}
function toast(m,u){if(window.vcfoToast)window.vcfoToast(m,u);}
function chat(q){if(window.vcfoChat)window.vcfoChat(q);else toast('Ask VCFO · '+q);}
function touch(el){if(el&&el.setAttribute)el.setAttribute('data-hit',String(Date.now()));}
function drill(cfg){if(window.vcfoDrill)window.vcfoDrill(cfg);else toast(cfg.title);}
function botSay(text,btn,q,aria,go){return '<div class="bot"><span class="bav" aria-hidden="true">'+(window.vcfoBotSVG||'')+'</span><div class="bub">'+text+(btn?'<br><button type="button" class="btn"'+(go?' data-go="'+go+'"':' data-chatq="'+esc(q)+'"')+' aria-label="'+esc(aria||btn)+'">'+esc(btn)+'</button>':'')+'</div></div>';}
function stRow(x){return [esc(x.n+' · '+x.t),dateCell(x.n),KL[KD(x.n)],KCOL[KD(x.n)],'inc-step-'+x.n];}
function tabsFor(list){return KORD.map(function(k){return {k:k,label:KL[k],color:KCOL[k],rows:list.filter(function(x){return KD(x.n)===k;}).map(stRow)};}).filter(function(t){return t.rows.length;});}
function idx(tabs,k){for(var i=0;i<tabs.length;i++){if(tabs[i].k===k)return i;}return 0;}
function whats(x){return 'What’s this: '+x.t+'?';}
function regGroup(t){
  t=t.toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
  if(/\bfc\s*gpr\b|\bfdi\b|\bodi\b|\bfla\b|\bfctrs\b|\bfc\s*trs\b|\bfema\b/.test(t))return 'FEMA';
  if(/\bgst\b|\besi\b|(^| )pf( |$)|(^| )pt( |$)|\blei\b|\bmsme\b/.test(t))return 'General';
  if(/\bicegate\b|\biec\b|\blut\b/.test(t))return 'Customs';
  if(/\bnon stpi\b|\bstpi\b/.test(t))return 'Foreign Trade';
  if(/\bshops?\b|\bestablishment\b|\bclra\b|\bposh\b|\bshe box\b/.test(t))return 'Labour';
  if(/\btrade licen/.test(t))return 'Local Compliance';
  if(/\btrademark\b|\bpatent\b|\bicdr\b/.test(t))return 'IP/Brand';
  return 'General';
}

/* ---------- sub-steps ---------- */
var SUBS={6:['Share classes','Shares','Face value','Holding'],7:['Office address','State','NOC','Utility bill'],8:['Directors','DIN · DSC','ID proofs','Address proofs','Interests'],10:['KYC data','KYC review','DSC']};
var SUBK_B={7:['done','done','now','done'],8:['done','done','now','todo','todo'],10:['done','now','todo']};
function subList(x){
  var labels=SUBS[x.n]||((x.i&&x.i.length)?x.i.map(function(q){return short(q[0]);}):[short(x.t)]),k=ST(x.n),n=labels.length,st;
  if(k==='done')st=labels.map(function(){return 'done';});
  else if(k==='up')st=labels.map(function(){return 'todo';});
  else if(!AFTER_ON&&SUBK_B[x.n])st=SUBK_B[x.n];
  else{var m=k==='you'?n-1:Math.floor(n/2);st=labels.map(function(_,j){return j<m?'done':(j===m?'now':'todo');});}
  return labels.map(function(l,j){return {l:l,s:st[j]};});
}
function dots(x){return '<span class="dots" aria-hidden="true">'+subList(x).slice(0,6).map(function(s){return '<i class="'+(s.s==='done'?'on':s.s==='now'?'cu':'')+'"></i>';}).join('')+'</span>';}

/* ---------- shared: hero ---------- */
function ringSvg(pct,col){var R=20,C=2*Math.PI*R,l=C*pct/100;return '<svg viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="'+R+'" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="5"></circle><circle cx="25" cy="25" r="'+R+'" fill="none" stroke="'+(col||'#e6c46e')+'" stroke-width="5" stroke-linecap="round" stroke-dasharray="'+Math.max(l,.01).toFixed(2)+' '+C.toFixed(2)+'"></circle></svg>';}
function spice(){var sp=STEPS.filter(function(x){return x.p<=2;}),d=doneN(sp);return {d:d,t:sp.length,pct:Math.round(d/sp.length*100)};}

/* ---------- landing ---------- */
function heroLanding(){
  var all=doneN(STEPS),s=spice();
  return '<section class="hero" aria-label="Incorporation · Northwind Technologies India Pvt Ltd"><div class="hrow">'+
    '<div class="hl"><button type="button" class="hback" data-go="home" aria-label="Back to Home">'+ic('chevron-left')+'</button>'+
    '<div class="htx"><div class="eb">Incorporation · 4 phases</div><div class="ht"><h1>Northwind Technologies India Pvt Ltd</h1></div>'+
    '<div class="hm">'+all+'/48 · '+(AFTER_ON?'incorporated '+fmtY(DT(14)):'COI expected '+fmtY(WIN_END))+'</div></div></div>'+
    '<div class="hr"><button type="button" class="hbtn" data-brief aria-haspopup="dialog" aria-label="Monthly status brief" data-tt="Monthly status brief" data-notip>'+ic('download')+'<span class="lt">Monthly status brief</span></button>'+
    '<a href="#" class="hbtn" data-go="board-resolution" aria-label="Board resolution · ready" data-tt="Board resolution · signed copy received" data-notip>'+ic('file-text')+'<span class="lt">Board resolution</span><span class="rd">'+ic('check')+'Ready</span></a>'+
    '<button type="button" class="ring" data-ring aria-label="SPICe+ progress · '+s.pct+'% · '+s.d+' of '+s.t+' steps done" data-tt="SPICe+ · '+s.d+' of '+s.t+' steps done" data-notip><span class="rw">'+ringSvg(s.pct)+'<span class="pc">'+s.pct+'%</span></span><small>SPICe+</small></button></div>'+
  '</div></section>';
}
function coiTile(){
  var all=doneN(STEPS),pct=Math.round(all/48*100),h='<section class="coi" aria-label="'+(AFTER_ON?'Incorporated':'Days to COI')+'"><div class="t1">';
  if(!AFTER_ON){
    var d=days(TODAY_B,WIN_END),you=STEPS.filter(function(x){return KD(x.n)==='you';})[0];
    h+='<button type="button" class="big" data-coi aria-label="'+d+' days to COI · expected '+wd(WIN_END)+' '+fmtY(WIN_END)+'" data-tt="Expected '+wd(WIN_END)+' '+fmtY(WIN_END)+' · window set by Arjun Mehta" data-notip><b id="coiN">'+d+'</b><span>days to COI</span></button>'+
      '<button type="button" class="ibtn" data-info="coi" aria-expanded="false" aria-label="About days to COI" data-tt="About days to COI" data-notip>'+ic('info')+'</button>'+
      (you?'<a href="#" class="chip risk" data-go="inc-step-'+you.n+'" aria-label="At risk · step '+you.n+' · '+esc(you.t)+'" data-tt="Step '+you.n+' is waiting on you · due '+fmt(DT(you.n))+'" data-notip>At risk · step '+you.n+'</a>':'')+
      '</div><div class="sub"><span>Expected '+wd(WIN_END)+' '+fmt(WIN_END)+'</span><span class="mono">· from the incorporation date</span></div>';
  }else{
    var e=days(DT(14),WIN_END);
    h+='<button type="button" class="big" data-coi aria-label="Incorporated '+fmtY(DT(14))+'" data-tt="Certificate of Incorporation · '+wd(DT(14))+' '+fmtY(DT(14))+'" data-notip><b>'+fmt(DT(14))+'</b><span>incorporated</span></button>'+
      '<button type="button" class="ibtn" data-info="coi" aria-expanded="false" aria-label="About the incorporation date" data-tt="About the incorporation date" data-notip>'+ic('info')+'</button>'+
      '<span class="chip done" style="margin-left:auto;margin-top:8px" role="img" aria-label="'+e+' days early" data-tt="Window ended '+wd(WIN_END)+' '+fmt(WIN_END)+'">'+e+' days early</span>'+
      '</div><div class="sub"><span>Incorporated '+wd(DT(14))+' '+fmt(DT(14))+'</span><span class="mono">· CIN, PAN and TAN issued</span><a href="#" data-go="doc-viewer">Open certificate</a></div>';
  }
  h+='<button type="button" class="pill" data-allsteps aria-label="'+all+' of 48 steps done · '+pct+'%"><span>'+all+' / 48 steps</span><span class="tr"><i style="width:'+Math.max(pct,2)+'%"></i></span><b>'+pct+'%</b></button>';
  return h+'</section>';
}
var WEEK_B=[['You','Upload NOC · requested by Arjun','9 Oct',7],['You','Check & approve step 7','9 Oct',7],['SBC','KYC review & DSC','now',10],['SBC','Draft MOA & AOA','12 Oct',11]];
function weekCard(){
  var rows=AFTER_ON?STEPS.filter(function(x){var k=KD(x.n);return k==='with'||k==='you'||k==='prog';}).sort(function(a,b){return DT(a.n)<DT(b.n)?-1:1;}).slice(0,4).map(function(x){return [x.o,x.t,DT(x.n)<=addD(TODAY_A,3)?'now':fmt(DT(x.n)),x.n];}):WEEK_B;
  var range=AFTER_ON?'9 – 15 Nov':'6 – 12 Oct';
  var h='<section class="card week" aria-label="This week"><div class="ch"><h2 class="lbl">This week</h2><span class="cnt">'+range+'</span><span class="wbot">'+bmini()+'<span>'+(AFTER_ON?'Nothing is waiting on you this week.':'MCA: nothing pending this week.')+'</span></span></div>';
  rows.forEach(function(r){h+='<a href="#" class="wr" data-go="inc-step-'+r[3]+'" aria-label="'+esc(r[1])+' · '+r[0]+' · '+r[2]+'"><span class="own '+r[0]+'">'+r[0]+'</span><span class="t">'+esc(r[1])+'</span><span class="dt">'+r[2]+'</span></a>';});
  return h+'</section>';
}
function pos(s){return Math.max(0,Math.min(1,days(AX0,s)/days(AX0,AX1)))*100;}
function phLabel(p){
  var l=steps(p),d=doneN(l),t=l.length,pct=Math.round(d/t*100),ps=phState(p),pl=phPlan(p),e;
  if(ps==='done'){var end=phEnd(p),dl=days(pl[1],end);e='<span class="e'+(dl>0?' late':dl<0?' early':'')+'">Finished '+fmt(end)+(dl>0?' · '+dl+' day'+(dl===1?'':'s')+' late':dl<0?' · '+(-dl)+' days early':'')+'</span>';}
  else e='<span class="e">Ends '+fmt(pl[1])+'</span>';
  return '<b>'+pct+'%</b><span>'+d+' / '+t+' steps</span>'+e;
}
function phBar(p,inline){
  var l=steps(p),d=doneN(l),t=l.length,ps=phState(p),pl=phPlan(p),end=ps==='done'?phEnd(p):pl[1],last=end>pl[1]?end:pl[1];
  var a=pos(pl[0]),b=pos(last),w=Math.max(b-a,1.5),fill,late='',cls=ps==='done'?'s-done':(ps==='up'?'s-up':'s-active');
  if(ps==='done'){fill=100;if(end>pl[1]){var lp=days(pl[1],end)/Math.max(1,days(pl[0],end))*100;late='<i class="lt" style="width:'+lp.toFixed(1)+'%"></i>';}}
  else fill=Math.round(d/t*100);
  var tip='Phase '+p+' · '+PH[p-1]+' · '+d+' of '+t+' done · '+fmt(pl[0])+' → '+fmt(pl[1]);
  return '<button type="button" class="gbar '+cls+'" data-bar="'+p+'"'+(inline?'':' style="left:'+a.toFixed(2)+'%;width:'+w.toFixed(2)+'%"')+' aria-label="'+esc(tip)+'" data-tt="'+esc(tip)+'" data-notip><span class="in"><i class="f" style="width:'+fill+'%"></i>'+late+'</span>'+(p===2?'<i class="ms"></i>':'')+'</button>';
}
function axis(){
  var h='',d='2026-09-15';
  while(d<='2026-12-29'){h+='<span style="left:'+pos(d).toFixed(2)+'%">'+fmt(d)+'</span>';d=addD(d,7);}
  return '<div class="gax" aria-hidden="true"><span></span><div class="tl">'+h+'</div><span class="ob0"></span></div>';
}
function stepTable(p,cur){
  var h='<div class="stt"><div class="sth" aria-hidden="true"><span></span><span></span><span>Step</span><span class="c-own">Owner</span><span class="c-st">Status</span><span class="c-dt">Date</span><span class="lk c-lk">'+ic('external-link')+'·'+ic('paperclip')+'</span><span></span><span></span></div>',g='';
  if(phState(p)==='up'&&PH_WAIT[p-1])h=botSay(PH_WAIT[p-1],'Ask VCFO when it starts','When does Phase '+p+' · '+PH[p-1]+' start?','Ask VCFO when Phase '+p+' starts')+h;
  steps(p).forEach(function(x){
    if(p===4){var gg=regGroup(x.t);if(gg!==g){h+='<div class="grp">'+gg+'</div>';g=gg;}}
    var k=KD(x.n),lk='';
    if(x.n===6||x.n===7)lk='<a href="#" class="lkb" data-go="inc-step-'+x.n+'" aria-label="Attachments of step '+x.n+'" data-tt="Attachments · open the step" data-notip>'+ic('paperclip')+'</a>';
    else if(x.o==='SBC'&&x.f&&x.f.length)lk='<button type="button" class="lkb" data-portal="'+x.n+'" aria-label="Open '+esc(x.f[0])+' on the official portal" data-tt="'+esc(x.f[0])+' · official portal" data-notip>'+ic('external-link')+'</button>';
    h+='<div class="str k-'+k+(cur===x.n?' cur':'')+'" id="step-'+x.n+'">'+si(k,tipTxt(x.n))+'<span class="nb">'+x.n+'</span><span class="nm" title="'+esc(x.t)+'">'+esc(x.t)+(x.u?'<span class="urg">Urgent</span>':'')+'</span>'+
      '<span class="c-own">'+own(x.o)+'</span><span class="c-st">'+chip(k)+'</span><span class="dt c-dt">'+dateCell(x.n)+'</span><span class="lkc c-lk">'+lk+'</span>'+
      '<button type="button" class="sq" data-ask="'+x.n+'" aria-label="What’s this? '+esc(x.t)+'" data-tt="What’s this? · ask VCFO" data-notip>'+ic('circle-help')+'</button>'+
      '<a href="#" class="sq" data-go="inc-step-'+x.n+'" aria-label="Open step '+x.n+' · '+esc(x.t)+'" data-tt="Open step '+x.n+'" data-notip>'+ic('arrow-right')+'</a></div>';
  });
  return h+'</div>';
}
function todayLine(){var t=today();return '<button type="button" class="today" style="left:'+pos(t).toFixed(2)+'%" aria-label="Today · '+wd(t)+' '+fmt(t)+'" data-tt="Today · '+wd(t)+' '+fmt(t)+'" data-notip></button>';}
function phaseRow(p){
  var l=steps(p),open=openPh===p,ps=phState(p),k=phKind(p);
  return '<div class="phr'+(open?' open':'')+'" data-p="'+p+'"><div class="phh">'+
    '<div class="pnm">'+si(k,'Phase '+p+' · '+(ps==='done'?'done':ps==='up'?'upcoming':'in progress'),'xl')+'<div class="tx"><a href="#" data-go="'+PH_KEY[p-1]+'" aria-label="Open the Phase '+p+' page · '+PH[p-1]+'" data-tt="'+esc(PH_TIP[p-1])+'" data-notip>'+PH[p-1]+'</a><small>'+doneN(l)+' / '+l.length+' steps</small></div></div>'+
    '<div class="gl">'+phBar(p)+'<span class="glab">'+phLabel(p)+'</span>'+todayLine()+'</div>'+
    '<button type="button" class="btn sm ob" data-toggle="'+p+'" aria-expanded="'+open+'" aria-controls="phb-'+p+'" aria-label="'+(open?'Close':'Open')+' Phase '+p+' · '+PH[p-1]+'">'+(open?'Close':'Open')+ic('chevron-down')+'</button>'+
    '</div><div class="phb" id="phb-'+p+'" role="region" aria-label="Phase '+p+' steps">'+(open?stepTable(p):'')+'</div></div>';
}
function phasesCard(){
  var d=doneN(STEPS);
  var h='<section class="card phc" id="phc"><div class="ch"><h2 class="lbl">Phases<button type="button" class="ibtn" data-info="phases" aria-expanded="false" aria-label="About the phases" data-tt="About the phases" data-notip>'+ic('info')+'</button></h2><span class="sp"></span><span class="cnt">'+d+' of 48 steps · Sep – Dec 2026</span></div>'+axis();
  for(var p=1;p<=4;p++)h+=phaseRow(p);
  return h+'</section>';
}
/* donuts */
var DOCS_B={you:[['Submitted',8,'#15805f',['PAN · Rohan Kumar','Aadhaar · Rohan Kumar','Passport · J. Carter','Address proof · J. Carter','Photo · Rohan Kumar','Photo · J. Carter','Signed board resolution','Cap table']],['Under review',1,'#2453c7',['Utility bill · September']],['Pending',2,'#d9731f',['NOC from property owner','Bank statement · J. Carter']],['Sent back',1,'#cf3a2f',['Address proof · Rohan Kumar · older than two months']]],
  sbc:[['Generated',5,'#2f6fd0',['Board resolution draft','Name application (RUN)','Name approval letter','SPICe+ Part A','DIR-2 consent letters']],['Pending',7,'#dfe4ec',['MOA','AOA','INC-9','DIR-8','INC-22','AGILE-PRO-S','SPICe+ Part B']],['Signed by you',2,'#15805f',['Board resolution (signed)','DIR-2 · Rohan Kumar']]]};
var DOCS_A={you:[['Submitted',11,'#15805f',['PAN · Rohan Kumar','Aadhaar · Rohan Kumar','Passport · J. Carter','Address proof · J. Carter','Address proof · Rohan Kumar','Photo · Rohan Kumar','Photo · J. Carter','Signed board resolution','Cap table','Utility bill · September','NOC from property owner']],['Under review',0,'#2453c7',[]],['Pending',1,'#d9731f',['Bank KYC letter · FIRC']],['Sent back',0,'#cf3a2f',[]]],
  sbc:[['Generated',14,'#2f6fd0',['Certificate of Incorporation','PAN card','TAN card','MOA','AOA','INC-9','DIR-8','INC-22','AGILE-PRO-S','SPICe+ Part B','First board meeting minutes','ADT-1','Company letterhead','GST certificate']],['Pending',5,'#dfe4ec',['SH-1 share certificates','INC-20A','FC-GPR','MGT-4/5/6','PT certificate']],['Signed by you',3,'#15805f',['Board resolution (signed)','DIR-2 · Rohan Kumar','SPICe+ Part B']]]};
function donut(key,title,segs){
  var tot=segs.reduce(function(a,s){return a+s[1];},0),R=38,C=2*Math.PI*R,off=0,svg='',nz=segs.filter(function(q){return q[1];}).length;
  segs.forEach(function(s,i){if(!s[1])return;var l=C*s[1]/tot,g=nz>1?1.2:0;
    svg+='<circle class="sg" cx="48" cy="48" r="'+R+'" stroke="'+s[2]+'" stroke-dasharray="'+Math.max(l-g,.1).toFixed(2)+' '+(C-l+g).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'" data-seg="'+key+':'+i+'" data-tt="'+esc(s[0])+' · '+s[1]+'"></circle>';off+=l;});
  return '<section class="card acc dc" aria-label="'+esc(title)+'"><h2 class="lbl">'+title+'</h2><div class="dn"><div class="dnut"><svg viewBox="0 0 96 96" aria-hidden="true">'+svg+'</svg><span class="c">'+tot+'</span></div><div class="lgd">'+
    segs.map(function(s,i){return '<button type="button" class="lg" data-seg="'+key+':'+i+'" aria-label="'+esc(title)+' · '+esc(s[0])+' · '+s[1]+'"><i style="background:'+s[2]+'"></i><span>'+esc(s[0])+'</span><b>'+s[1]+'</b></button>';}).join('')+'</div></div></section>';
}
function segData(){
  var D=AFTER_ON?DOCS_A:DOCS_B,left=STEPS.filter(function(x){return ST(x.n)!=='done';});
  var you=left.filter(function(x){return x.o==='You';}),sbc=left.filter(function(x){return x.o!=='You';});
  var act=STEPS.filter(function(x){var k=KD(x.n);return k==='you'||k==='prog'||k==='with';});
  var risk=act.filter(function(x){return KD(x.n)==='you';}),ok=act.filter(function(x){return KD(x.n)!=='you';});
  return {you:D.you,sbc:D.sbc,who:[['You',you.length,'#c9a24b',you],['SBC',sbc.length,'#2f6fd0',sbc]],plan:[['On time',ok.length,'#15805f',ok],['At risk',risk.length,'#d9731f',risk],['Overdue',0,'#cf3a2f',[]]]};
}
var SEG_T={you:'Documents from you',sbc:'Documents SBC prepares',who:'Who’s working on what',plan:'On plan vs overdue'};
function donuts(){var s=segData();return '<div class="dg">'+donut('you',SEG_T.you,s.you)+donut('sbc',SEG_T.sbc,s.sbc)+donut('who',SEG_T.who,s.who)+donut('plan',SEG_T.plan,s.plan)+'</div>';}
function drillSeg(v){
  var a=v.split(':'),key=a[0],i=+a[1],s=segData()[key],docs=key==='you'||key==='sbc';
  var tabs=s.map(function(q,j){return {k:j,label:q[0],color:q[2],rows:(q[3]||[]).map(function(r){return typeof r==='string'?[esc(r),key==='you'?'From you':'Prepared by SBC','','','documents']:stRow(r);})};});
  var cfg={title:SEG_T[key],sub:s.reduce(function(t,q){return t+q[1];},0)+(docs?' documents':' steps'),tabs:tabs,active:i};
  if(docs)cfg.link={lead:'Every document, with versions',text:'Open Documents →',go:'documents',where:'Documents'};
  drill(cfg);
}
function renderLanding(){
  document.title='Incorporation · VCFO Suite';
  main.innerHTML='<div class="wrap">'+heroLanding()+'<div class="r2">'+coiTile()+weekCard()+'</div>'+phasesCard()+donuts()+'</div>';
  layoutGantt();
  if(firstPaint&&!AFTER_ON&&!reduce){var el=document.getElementById('coiN');if(el){var to=+el.textContent,t0=0;el.textContent='0';
    requestAnimationFrame(function f(ts){if(!t0)t0=ts;var k=Math.min(1,(ts-t0)/650);el.textContent=String(Math.round(to*(1-Math.pow(1-k,3))));if(k<1)requestAnimationFrame(f);});}}
}
function layoutGantt(){
  var c=document.getElementById('phc');if(!c)return;
  c.classList.remove('simple');
  var gl=c.querySelector('.gl');if(!gl)return;
  var W=gl.getBoundingClientRect().width,simple=W<500,ax=c.querySelector('.gax'),sp=W*7/days(AX0,AX1);
  if(ax){ax.classList.toggle('e2',sp<58&&sp>=29);ax.classList.toggle('e4',sp<29);}
  if(!simple)[].forEach.call(c.querySelectorAll('.gl'),function(g){
    var b=g.querySelector('.gbar'),lb=g.querySelector('.glab');if(!b||!lb)return;
    var a=parseFloat(b.style.left)/100*W,e=a+parseFloat(b.style.width)/100*W,lw=lb.getBoundingClientRect().width;
    lb.style.left='';lb.style.right='';
    if(W-e>=lw+18)lb.style.left=(e+14)+'px';
    else if(a>=lw+14)lb.style.right=(W-a+10)+'px';
    else simple=true;
  });
  if(simple){c.classList.add('simple');[].forEach.call(c.querySelectorAll('.glab'),function(lb){lb.style.left='';lb.style.right='';});}
}

/* ---------- journey rail (focus track) ---------- */
function railSub(x){var k=KD(x.n);return k==='done'?'Done · '+fmt(DT(x.n)):k==='you'?'Waiting on you · due '+fmt(DT(x.n)):k==='prog'?'In progress · due '+fmt(DT(x.n)):k==='with'?'With your project lead · since '+fmt(since(x.n)):'Opens later';}
function railHero(x,isPage){
  var k=KD(x.n),sl=subList(x),dn=sl.filter(function(s){return s.s==='done';}).length,lbl=(isPage?(k==='done'?'Done':k==='up'?'Upcoming':'Now'):'Now')+' · step '+x.n;
  var labels=sl.length<=4&&sl.every(function(s){return s.l.length<=14;});
  return '<div class="rh" role="group" aria-label="Step '+x.n+' · '+esc(x.t)+' · '+railSub(x)+'"><div class="hh">'+si(k,tipTxt(x.n))+'<div style="min-width:0"><div class="k">'+lbl+'</div><b>'+esc(x.t)+'</b><small>'+railSub(x)+'</small></div>'+
    '<button type="button" class="wq" data-ask="'+x.n+'" aria-label="What’s this? '+esc(x.t)+'" data-tt="What’s this? · ask VCFO" data-notip>'+ic('circle-help')+'</button></div>'+
    '<div class="subt">'+sl.map(function(s){return '<span class="sb '+(s.s==='done'?'on':s.s==='now'?'cu':'')+'" role="img" aria-label="'+esc(s.l)+' · '+(s.s==='done'?'done':s.s==='now'?'in progress':'to do')+'" data-tt="'+esc(s.l)+' · '+(s.s==='done'?'done':s.s==='now'?'in progress':'to do')+'"><i></i>'+(labels?'<span>'+esc(s.l)+'</span>':'')+'</span>';}).join('')+'</div>'+
    (labels?'':'<div class="subn">'+dn+' of '+sl.length+' sub-steps done</div>')+'</div>';
}
function rail(p,focus,isPage){
  var l=steps(p),d=doneN(l),list=l;
  if(l.length>11&&!railAll){var i=l.map(function(x){return x.n;}).indexOf(focus),s=Math.max(0,Math.min(l.length-9,i-4));list=l.slice(s,s+9);}
  var h='<section class="card acc rail" aria-label="Journey · Phase '+p+'"><div class="ch"><h2 class="lbl" style="font-size:11.5px">'+PH[p-1]+' · journey</h2><span class="sp"></span><span class="chip up" style="font-family:var(--mono);font-weight:600">'+d+' / '+l.length+'</span></div><div class="rl">';
  list.forEach(function(x,j){
    var k=KD(x.n),nx=list[j+1],ok=k==='done'&&nx&&KD(nx.n)==='done';
    if(x.n===focus){h+=railHero(x,isPage);return;}
    h+='<a href="#" class="rr'+(ok?' ok':'')+(j===list.length-1?' last':'')+'" data-go="inc-step-'+x.n+'" aria-label="Step '+x.n+' · '+esc(x.t)+' · '+railSub(x)+'">'+si(k,tipTxt(x.n))+'<span style="min-width:0"><b>'+x.n+' · '+esc(x.t)+'</b><small>'+railSub(x)+'</small>'+(k==='done'||k==='up'?'':dots(x))+'</span>'+own(x.o)+'</a>';
  });
  h+='</div>'+(l.length>11?'<button type="button" class="btn sm rmore" data-railall aria-expanded="'+railAll+'">'+(railAll?'Show fewer steps':'Show all '+l.length+' steps')+'</button>':'');
  return h+'</section>';
}

/* ---------- step page ---------- */
var X={
 6:{tab:'Capital structure',forms:['SPICe+ Part B'],pre:'Filled by Arjun Mehta from your cap table',
    f:[['Authorised capital','₹10,00,000'],['Paid-up capital','₹1,00,000'],['Face value','₹10 · 10,000 shares'],['Shareholding','Northwind Inc. 9,999 · nominee 1']],
    docs:[{t:'xlsx',n:'Cap table',f:'northwind-cap-table.xlsx',m:'you · 2 Oct',s:'Checked'}],
    tl:[['ok','Answers filled','Arjun Mehta','2 Oct'],['ok','Approved by your manager','Priya Raman','3 Oct'],['ok','Approved by you','You','4 Oct']],
    stg:['Arjun · 2 Oct','Arjun · 3 Oct','Priya · 3 Oct','4 Oct']},
 7:{tab:'Registered office',forms:['SPICe+ Part B','INC-22'],pre:'Pre-filled from project setup',
    f:[['Complete address of the proposed registered office','Plot 42, 3rd Floor, Cyber Towers, HITEC City, Madhapur, Hyderabad 500081'],['State / union territory of the registered office','Telangana'],['Utility bill type','Electricity bill'],['Utility bill number','TSSPDCL 1102 4587 66'],['Remarks (optional)','—']],
    banner:'Your team filled this step. Check it, upload the NOC Arjun asked for, then approve & submit.',bsub:'Prepared from your project setup; approved by Priya Raman on 6 Oct.',
    need:[['noc','Upload NOC from owner','9 Oct',false],['chk','Check the answers','9 Oct',true],['ok','Approve & submit','9 Oct',false]],
    tlB:[['ok','Pre-filled from project setup','Arjun Mehta · Project Lead','5 Oct'],['ok','Utility bill attached','Arjun Mehta','5 Oct'],['ok','Approved by your manager','Priya Raman','6 Oct'],['you','NOC requested from you','Arjun Mehta','6 Oct'],['you','Approve & submit','You','due 9 Oct'],['up','Step 8 opens','Proposed directors','after approval']],
    tlA:[['ok','Pre-filled from project setup','Arjun Mehta · Project Lead','5 Oct'],['ok','Approved by your manager','Priya Raman','6 Oct'],['ok','NOC uploaded','You','8 Oct'],['ok','Approved by you','You','9 Oct'],['ok','Step 8 opened','Proposed directors','9 Oct']],
    stgB:['Arjun · 2 Oct','You · due 9 Oct','Arjun Mehta','Priya Raman'],stgA:['Arjun · 2 Oct','You · 8 Oct','Arjun · 9 Oct','9 Oct']},
 8:{tab:'Directors',forms:['DIR-2','INC-9'],
    fB:[['Director name · gender · residency','Rohan Kumar · male · resident; J. Carter · male · non-resident'],['DIN · DSC status','Applying through SPICe+ (DIR-3)'],['Aadhaar + PAN (resident) / passport (non-resident)','2 of 3 uploaded'],['Utility bill · photograph','—'],['Other company interests','—']],
    fA:[['Director name · gender · residency','Rohan Kumar · male · resident; J. Carter · male · non-resident'],['DIN · DSC status','DIN allotted with the COI · DSC issued'],['Aadhaar + PAN (resident) / passport (non-resident)','3 of 3 uploaded'],['Utility bill · photograph','Uploaded for both directors'],['Other company interests','None declared (DIR-8)']],
    bubB:'You’ve started this step. Add the missing KYC for J. Carter and submit by 16 Oct. Your team reviews it once step 7 is approved.',
    need:[['kyc','Add J. Carter’s address proof','16 Oct',false],['ph','Upload both photographs','16 Oct',false],['sub','Submit for review','16 Oct',false]],
    tlB:[['ok','Director details pre-filled','Arjun Mehta · from project setup','5 Oct'],['ok','Passport · J. Carter uploaded','You','6 Oct'],['prog','Fill and submit','You · 2 of 5 answered','due 16 Oct'],['up','Review by your team','Arjun Mehta','after you submit']],
    tlA:[['ok','Director details filled','You','12 Oct'],['ok','Reviewed by your team','Arjun Mehta','14 Oct'],['ok','Approved by you','You','16 Oct']],
    stgB:['You · due 16 Oct','You','Arjun Mehta','Priya Raman'],stgA:['You · 10 Oct','You · 12 Oct','Arjun · 14 Oct','16 Oct']},
 10:{tab:'KYC & DSC',forms:['DSC · eMudhra'],
    fB:[['KYC review status','—'],['DSC success message · Non-resident director','—'],['DSC success message · Resident director','—'],['Date of signing','—'],['Place of signing','—'],['Witness to the subscribers','—'],['Other attachments','—']],
    fA:[['KYC review status','Cleared · 17 Oct'],['DSC success message · Non-resident director','Issued · eMudhra · 18 Oct'],['DSC success message · Resident director','Issued · eMudhra · 18 Oct'],['Date of signing','19 Oct 2026'],['Place of signing','Hyderabad'],['Witness to the subscribers','Priya Raman, CS'],['Other attachments','Video KYC recordings (2)']],
    bubB:'Your team prepares this step. You’ll see the KYC result and the DSC proof here when it is delivered.',
    tlB:[['ok','KYC data received','From your project setup','6 Oct'],['with','KYC review','Arjun Mehta · in progress','since 6 Oct'],['up','DSC creation (eMudhra)','Two 30-minute video slots','15 – 16 Oct'],['up','Delivered to you','You approve or request a change','19 Oct']],
    tlA:[['ok','KYC data received','From your project setup','6 Oct'],['ok','KYC review','Arjun Mehta','17 Oct'],['ok','DSC creation (eMudhra)','Both directors','18 Oct'],['ok','Delivered and approved','You','19 Oct']],
    stgB:['Arjun Mehta · since 6 Oct','19 Oct','You','Priya Raman'],stgA:['Arjun · 6 Oct','18 Oct','You · 19 Oct','19 Oct']}
};
function curN(){var m=(location.hash||'').match(/n=(\d+)/),n=m?+m[1]:7;return (n>=1&&n<=48)?n:7;}
function stages(x){
  var k=KD(x.n),you=x.o==='You',d=DT(x.n),c=X[x.n]||{},sg=c[AFTER_ON?'stgA':'stgB']||c.stg;
  if(sg&&(k==='up'))sg=null;
  var names=you?['Started','Submitted','Reviewed','Completed']:(k==='with'?['With SBC','Delivered to you','You approve','Completed']:k==='done'?['Started','Delivered to you','You approved','Completed']:['Started','Delivered to you','You approve','Completed']);
  if(k==='up')names=['','Delivered to you','You approve','Completed'];
  var subs=sg||(k==='done'?['Arjun · '+fmt(addD(d,-4)),'Arjun · '+fmt(addD(d,-2)),(you?'Priya · ':'You · ')+fmt(addD(d,-1)),fmt(d)]:k==='you'?['Arjun · '+fmt(addD(today(),-3)),'You · due '+fmt(d),'Arjun Mehta','Priya Raman']:k==='prog'?['You · due '+fmt(d),'You','Arjun Mehta','Priya Raman']:k==='with'?['Arjun Mehta · since '+fmt(since(x.n)),fmt(d),'You','Priya Raman']:['','~'+fmt(d),'',''] );
  var cur=k==='done'?3:k==='you'?(you?1:2):0,parts=[];
  names.forEach(function(nm,i){
    var state=k==='done'||i<cur?'ok':(i===cur?'now':'todo');
    if(i===cur){
      var hero;
      if(k==='done')hero=['ok','check','Completed',you?'Approved by you':'Completed',subs[3]];
      else if(k==='you')hero=['','upload','Now · '+(cur+1)+' of 4',nm,subs[cur],'Waiting on you'];
      else if(k==='prog')hero=['','pen-line','Now · 1 of 4','Filling in',subs[0]];
      else if(k==='with')hero=['','sun','Now · with SBC','SBC is working on it',subs[0]];
      else hero=['','lock','Opens after step '+(x.n-1),'Not started','Starts when step '+(x.n-1)+' is done'];
      parts.push('<div class="now'+(hero[0]?' '+hero[0]:'')+'" role="group" aria-label="'+esc(hero[2]+' · '+hero[3]+' · '+hero[4])+'">'+(hero[5]?'<span class="tag">'+hero[5]+'</span>':'')+'<span class="tile">'+ic(hero[1])+'</span><span class="tx"><span class="k">'+hero[2]+'</span><b>'+hero[3]+'</b><small>'+esc(hero[4])+'</small></span></div>');
    }else{
      parts.push('<div class="stg '+(state==='ok'?'ok':'todo')+'"><span class="o">'+(state==='ok'?sic('check',3.4):'')+'</span><span class="lb"><b>'+nm+'</b>'+(subs[i]?'<small>'+esc(subs[i])+'</small>':'')+'</span></div>');
    }
    if(i<3)parts.push('<span class="cn'+(k==='done'||i+1<=cur?' ok':' dot')+'" aria-hidden="true"></span>');
  });
  return '<section class="card trk" aria-label="Progress of this step"><div class="lc">'+parts.join('')+'</div></section>';
}
function fields(x){
  var c=X[x.n],k=ST(x.n);
  if(c){var f=c.f||c[AFTER_ON?'fA':'fB'];if(f)return f.map(function(r){return {l:r[0],v:r[1]};});}
  var it=(x.i&&x.i.length)?x.i:[[x.t,'']];
  return it.map(function(q){return {l:q[0],h:q[1],v:k==='done'?'✓':'—'};});
}
function kvRows(x){
  return fields(x).map(function(r){var v=r.v==='✓'?si('done')+'<span>Provided · '+fmt(DT(x.n))+'</span>':esc(r.v);
    return '<div class="kvr"><div class="k">'+esc(r.l)+(r.h?'<small>'+esc(r.h)+'</small>':'')+'</div><div class="v'+(r.v==='—'?' no':'')+'">'+v+'</div></div>';}).join('');
}
function formChips(x){var c=X[x.n],f=(c&&c.forms)||x.f||[];return f.length?'<span class="fchips">'+f.slice(0,3).map(function(n){return '<button type="button" class="fch" data-portal-f="'+esc(n)+'" aria-label="Open '+esc(n)+' on the official portal" data-tt="'+esc(n)+' · official portal" data-notip>'+esc(n)+ic('external-link')+'</button>';}).join('')+'</span>':'';}
function answersCard(x){
  var k=KD(x.n),c=X[x.n]||{};
  var title=(k==='done'||k==='you')?'Answers':'What this step captures';
  var h='<section class="card acc" aria-label="'+title+'"><div class="ch"><h2 class="lbl">'+title+'<button type="button" class="ibtn" data-info="answers" aria-expanded="false" aria-label="About this step" data-tt="About this step" data-notip>'+ic('info')+'</button></h2>'+formChips(x)+'</div>';
  if(c.tab&&(k==='done'||k==='you'))h+='<div class="tabs" role="tablist"><button type="button" class="tab" role="tab" aria-selected="true">'+esc(c.tab)+'</button></div>'+(c.pre?'<div class="pre">'+ic('refresh-cw')+esc(c.pre)+'</div>':'');
  if(k==='with'||k==='up'||k==='prog'){
    var msg,btn='',go='';
    if(k==='up'){var pv=STEPS[x.n-2];msg='This step opens after step '+(x.n-1)+' · '+esc(pv?pv.t:'')+'. Here is what it will ask for.';btn='Go to step '+(x.n-1);go='inc-step-'+(x.n-1);}
    else if(k==='with')msg=c.bubB&&!AFTER_ON?c.bubB:'Your team prepares this step. You’ll see the result here when it is delivered.';
    else msg=c.bubB&&!AFTER_ON?c.bubB:'You’ve started this step. Fill the remaining answers and submit by '+fmt(DT(x.n))+'.';
    h+='<div class="cbot">'+botSay(msg,btn,'',btn,go)+'</div>';
  }
  h+='<div class="kv">'+kvRows(x)+'</div>';
  if(k==='done')h+='<div class="cft"><span class="t">'+si('done')+(x.o==='You'?'Approved by you':'Completed by your team')+'</span><button type="button" class="btn" data-change="'+x.n+'">'+ic('message-square')+'Request a change</button></div>';
  else if(k==='with')h+='<div class="cft"><span class="t">'+si('with')+'Awaiting your team</span><button type="button" class="btn" data-msg>'+ic('message-square')+'Message Arjun</button></div>';
  else if(k==='prog')h+='<div class="cft"><span class="t">'+si('prog')+'In progress · due '+fmt(DT(x.n))+'</span><button type="button" class="btn" data-draft>'+ic('pen-line')+'Save draft</button></div>';
  else if(k==='up')h+='<div class="cft"><span class="t">'+si('up')+'Opens later</span></div>';
  return h+'</section>';
}
function fileRow(d){
  return '<div class="file"><span class="ft '+d.t+'">'+d.t.toUpperCase()+'</span><span class="tx"><b>'+esc(d.n)+'</b><small>'+esc(d.f)+' · '+esc(d.m)+'</small></span><span class="acts"><span class="chip done">'+esc(d.s)+'</span><button type="button" class="sq" data-view="'+esc(d.n)+'" aria-label="Preview '+esc(d.n)+'">'+ic('eye')+'</button><button type="button" class="sq" data-dl="'+esc(d.f)+'" aria-label="Download '+esc(d.f)+'">'+ic('download')+'</button></span></div>';
}
function docsCard(x){
  var c=X[x.n]||{},h='';
  if(x.n===7){
    var nocDone=AFTER_ON||checks['7:noc'];
    h+='<div class="dreq">'+si(nocDone?'done':'you')+'No-objection certificate from the owner · requested by Arjun</div>';
    h+=nocDone?fileRow({t:'pdf',n:'NOC from property owner',f:'noc-plot42-owner.pdf',m:'188 KB · You · '+(AFTER_ON?'8 Oct':'just now'),s:'Uploaded'}):
      '<div class="drop" data-drop="7"><button type="button" class="ut" data-upload="7" aria-label="Upload the NOC from the property owner">'+ic('upload')+'</button><span class="tx"><b>NOC from property owner<button type="button" class="ibtn" data-info="noc" aria-expanded="false" aria-label="About the NOC" data-tt="About the NOC" data-notip>'+ic('info')+'</button></b><span>Drop a file here or <button type="button" data-upload="7">browse</button></span></span><span class="chip you">Due 9 Oct</span></div>';
    h+='<div class="dreq">'+si('done')+'Copy of utility bill (not older than two months)</div>'+fileRow({t:'pdf',n:'Utility bill · September',f:'tsspdcl-sep-2026.pdf',m:'301 KB · Arjun · 5 Oct',s:'Uploaded'});
    var n2=nocDone?2:1;
    return '<section class="card acc" id="docs" aria-label="Documents"><div class="ch"><h2 class="lbl">Documents<button type="button" class="ibtn" data-info="docs" aria-expanded="false" aria-label="About these documents" data-tt="About these documents" data-notip>'+ic('info')+'</button></h2><span class="sp"></span><span class="chip '+(n2===2?'done':'you')+'">'+n2+' of 2</span></div>'+h+'</section>';
  }
  if(c.docs)return '<section class="card acc" id="docs" aria-label="Documents"><div class="ch"><h2 class="lbl">Documents</h2><span class="sp"></span><span class="cnt">'+c.docs.length+' file</span></div>'+c.docs.map(fileRow).join('')+'</section>';
  return '';
}
function timeline(x){
  var k=KD(x.n),c=X[x.n]||{},d=DT(x.n),ev=c[AFTER_ON?'tlA':'tlB']||c.tl,pv=STEPS[x.n-2];
  if(!ev){
    if(k==='done')ev=x.o==='You'?[['ok','Answers filled','Arjun Mehta',fmt(addD(d,-2))],['ok','Approved by your manager','Priya Raman',fmt(addD(d,-1))],['ok','Approved by you','You',fmt(d)]]:[['ok','Started by your team','Arjun Mehta',fmt(addD(d,-4))],['ok','Reviewed by your manager','Priya Raman',fmt(addD(d,-1))],['ok','Completed','Arjun Mehta',fmt(d)]];
    else if(k==='you')ev=[['ok','Prepared by your team','Arjun Mehta',fmt(addD(today(),-1))],['ok','Approved by your manager','Priya Raman',fmt(today())],['you','Approve & submit','You','due '+fmt(d)]];
    else if(k==='prog')ev=[['ok','Step opened','Arjun Mehta',fmt(since(x.n))],['prog','Fill and submit','You','due '+fmt(d)],['up','Review by your team','Arjun Mehta','after you submit']];
    else if(k==='with')ev=[['ok','Started by your team','Arjun Mehta',fmt(since(x.n))],['with','In progress','Arjun Mehta · Project Lead','now'],['up','Delivered to you','You approve or request a change',fmt(d)]];
    else{var pk=pv?KD(pv.n):'up';ev=[[pk==='done'?'ok':pk,'Step '+(x.n-1)+' · '+(pv?KL[pk].toLowerCase():''),pv?pv.t:'',pk==='up'?'later':'now'],['up','Opens for your team','Arjun Mehta','after step '+(x.n-1)],['up','Delivered to you','You approve','~'+fmt(d)]];}
  }
  return '<section class="card acc" aria-label="Timeline"><div class="ch"><h2 class="lbl">Timeline<button type="button" class="ibtn" data-info="timeline" aria-expanded="false" aria-label="About the timeline" data-tt="About the timeline" data-notip>'+ic('info')+'</button></h2></div><div class="tlst">'+
    ev.map(function(e){var g=e[0]==='ok'?'done':e[0];return '<div class="te'+(e[0]==='ok'?' ok':'')+'">'+si(g)+'<span style="min-width:0"><b>'+esc(e[1])+'</b><small>'+esc(e[2])+'</small></span><span class="dt">'+esc(e[3])+'</span></div>';}).join('')+'</div></section>';
}
function needItems(x){var k=KD(x.n),c=X[x.n]||{};if(k==='you')return c.need||[['chk','Check the answers',fmt(DT(x.n)),false],['ok','Approve & submit',fmt(DT(x.n)),false]];if(k==='prog')return c.need||[['fill','Fill the answers',fmt(DT(x.n)),false],['sub','Submit for review',fmt(DT(x.n)),false]];return null;}
function isOn(x,it){var key=x.n+':'+it[0];return (key in checks)?checks[key]:it[3];}
function needCard(x){
  var items=needItems(x);
  if(!items){
    return '<section class="card acc team" aria-label="Your team on this step"><div class="ch"><h2 class="lbl">Your team on this step</h2></div>'+
      '<div class="pr"><span class="av">AM</span><span><b>Arjun Mehta</b><small>Project Lead · '+(x.o==='You'?'reviews your answers':'does this step')+'</small></span><button type="button" class="sq" data-msg aria-label="Message Arjun Mehta">'+ic('message-square')+'</button></div>'+
      '<div class="pr"><span class="av" style="background:#2f6fd0">PR</span><span><b>Priya Raman</b><small>Project Manager · approves</small></span><button type="button" class="sq" data-msg aria-label="Message Priya Raman">'+ic('message-square')+'</button></div></section>';
  }
  var left=items.filter(function(it){return !isOn(x,it);}).length;
  return '<section class="card acc need" aria-label="Needed from you"><div class="ch"><h2 class="lbl">Needed from you</h2><span class="sp"></span><span class="chip '+(left?'you':'done')+'" id="needN">'+(left?left+' left':'All done')+'</span></div>'+
    items.map(function(it){return '<label class="nr"><input type="checkbox" data-need="'+x.n+':'+it[0]+'"'+(isOn(x,it)?' checked':'')+'><span>'+esc(it[1])+'</span><span class="dt">'+esc(it[2])+'</span></label>';}).join('')+'</section>';
}
function banner(x){
  var k=KD(x.n),c=X[x.n]||{};
  if(k==='you')return '<div class="ban">'+bmini()+'<span><b>'+esc(c.banner||'Your team filled this step. Check it, then approve & submit.')+'</b><span>'+esc(c.bsub||'Prepared by Arjun Mehta; approved by Priya Raman.')+'</span></span></div>';
  if(k==='done')return '<div class="ban ok">'+si('done')+'<span><b>'+(x.o==='You'?'Approved by you':'Completed by your team')+'</b><span>'+(x.o==='You'?'Accepted after submission on ':'Finished on ')+fmt(DT(x.n))+'.</span></span></div>';
  return '';
}
function actBar(x){
  if(KD(x.n)!=='you')return '';
  var items=needItems(x),done=items.filter(function(it){return isOn(x,it);}).length,pct=Math.round(done/items.length*100);
  return '<div class="act" role="region" aria-label="Approval"><div class="in"><div class="st">'+si('you')+'<span style="min-width:0;flex:1"><b>Awaiting your approval</b><span class="tr"><i style="width:'+Math.max(pct,6)+'%"></i></span></span></div><div class="bs"><button type="button" class="btn" data-change="'+x.n+'">'+ic('message-square')+'Request a change</button><button type="button" class="btn p" data-approve="'+x.n+'">'+ic('check')+'Approve & submit</button></div></div></div>';
}
function renderStep(){
  var n=curN(),x=STEPS[n-1],k=KD(n),pi=steps(x.p),pos1=pi.indexOf(x)+1,pv=STEPS[n-2],nx=STEPS[n];
  document.title='Step '+n+' · '+x.t+' · Incorporation · VCFO Suite';
  var cb=document.getElementById('crB');if(cb)cb.textContent=x.t;
  var meta=k==='done'?x.o+' · done '+fmt(DT(n)):k==='with'?'Project Lead · with SBC since '+fmt(since(n))+' · due '+fmt(DT(n)):k==='up'?x.o+' · '+esc(x.tl)+' · opens after step '+(n-1):x.o+' · '+esc(x.tl)+' · due '+fmt(DT(n))+' · reviewer Arjun Mehta';
  var h='<div class="wrap"><section class="hero" aria-label="Step '+n+' · '+esc(x.t)+'"><div class="hrow">'+
    '<div class="hl"><button type="button" class="hback" data-go="'+PH_KEY[x.p-1]+'" aria-label="Back to Phase '+x.p+' · '+PH[x.p-1]+'">'+ic('chevron-left')+'</button>'+
    '<div class="htx"><div class="eb">Phase '+x.p+' · '+PH[x.p-1]+' · step '+pos1+' of '+pi.length+'</div><div class="ht"><h1>'+esc(x.t)+'</h1><button type="button" class="wt" data-ask="'+n+'" aria-label="What’s this? '+esc(x.t)+'" data-tt="What’s this? · ask VCFO" data-notip>'+bmini()+'What’s this?</button></div><div class="hm">'+meta+'</div></div></div>'+
    '<div class="hr"><div class="hnav">'+(pv?'<a href="#" class="wbtn" data-go="inc-step-'+(n-1)+'" aria-label="Previous step · '+(n-1)+' · '+esc(pv.t)+'">'+ic('chevron-left')+'<span>'+(n-1)+' · '+esc(pv.t)+'</span></a>':'')+(nx?'<a href="#" class="wbtn" data-go="inc-step-'+(n+1)+'" aria-label="Next step · '+(n+1)+' · '+esc(nx.t)+'"><span>'+(n+1)+' · '+esc(nx.t)+'</span>'+ic('chevron-right')+'</a>':'')+'</div>'+si(k,tipTxt(n),'xl')+'</div>'+
  '</div></section>';
  h+=stages(x)+banner(x);
  h+='<div class="sgrid"><div class="scol">'+answersCard(x)+docsCard(x)+timeline(x)+'</div><div class="scol side2">'+rail(x.p,n,true)+needCard(x)+'</div></div>';
  h+='<nav class="pn" aria-label="Steps">'+(pv?'<button type="button" class="btn" data-go="inc-step-'+(n-1)+'">'+ic('arrow-left')+'<span>'+(n-1)+' · '+esc(pv.t)+'</span></button>':'<button type="button" class="btn" data-go="incorporation">'+ic('arrow-left')+'<span>All phases</span></button>')+(nx?'<button type="button" class="btn" data-go="inc-step-'+(n+1)+'"><span>'+(n+1)+' · '+esc(nx.t)+'</span>'+ic('arrow-right')+'</button>':'<button type="button" class="btn" data-go="incorporation"><span>All phases</span>'+ic('arrow-right')+'</button>')+'</nav>';
  h+=actBar(x)+'</div>';
  main.innerHTML=h;
  document.body.classList.toggle('has-act',k==='you');
  actH();
}
function actH(){var a=main.querySelector('.act');if(a)document.documentElement.style.setProperty('--acth',a.offsetHeight+'px');}

/* ---------- phase page ---------- */
function curP(){var m=(location.hash||'').match(/p=(\d)/),p=m?+m[1]:curPhase();return (p>=1&&p<=4)?p:curPhase();}
function renderPhase(){
  var p=curP(),l=steps(p),d=doneN(l),t=l.length,ps=phState(p),pl=phPlan(p),pct=Math.round(d/t*100),endD=ps==='done'?phEnd(p):pl[1];
  document.title='Phase '+p+' · '+PH[p-1]+' · Incorporation · VCFO Suite';
  var cb=document.getElementById('crB');if(cb)cb.textContent='Phase '+p+' · '+PH[p-1];
  var focus=(l.filter(function(x){return KD(x.n)==='you';})[0]||l.filter(function(x){return ST(x.n)!=='done';})[0]||l[l.length-1]).n,cur=STEPS[focus-1];
  var h='<div class="wrap"><section class="hero" aria-label="Phase '+p+' · '+PH[p-1]+'"><div class="hrow">'+
    '<div class="hl"><button type="button" class="hback" data-go="incorporation" aria-label="Back to Incorporation">'+ic('chevron-left')+'</button>'+
    '<div class="htx"><div class="eb">Incorporation · phase '+p+' of 4</div><div class="ht"><h1>'+PH[p-1]+'</h1><button type="button" class="wt" data-chatq="What’s this: Phase '+p+' · '+PH[p-1]+'?" aria-label="What’s this? Phase '+p+' · '+PH[p-1]+'" data-tt="What’s this? · ask VCFO" data-notip>'+bmini()+'What’s this?</button></div>'+
    '<div class="hm">'+d+'/'+t+' · '+fmt(pl[0])+' → '+fmt(endD)+' · '+(ps==='done'?'finished ':'ends ')+fmtY(endD)+'</div></div></div>'+
    '<div class="hr"><div class="hnav">'+(p>1?'<a href="#" class="wbtn" data-go="'+PH_KEY[p-2]+'" aria-label="Previous phase · '+PH[p-2]+'">'+ic('chevron-left')+'<span>Phase '+(p-1)+' · '+PH[p-2]+'</span></a>':'')+(p<4?'<a href="#" class="wbtn" data-go="'+PH_KEY[p]+'" aria-label="Next phase · '+PH[p]+'"><span>Phase '+(p+1)+' · '+PH[p]+'</span>'+ic('chevron-right')+'</a>':'')+'</div>'+
    '<button type="button" class="ring" data-bar="'+p+'" aria-label="Phase '+p+' · '+pct+'% · '+d+' of '+t+' steps done" data-tt="Phase '+p+' · '+d+' of '+t+' steps done" data-notip><span class="rw">'+ringSvg(pct,ps==='done'?'#2fd3a0':'#e6c46e')+'<span class="pc">'+pct+'%</span></span><small>Phase '+p+'</small></button></div>'+
  '</div></section>';
  h+='<section class="card acc psum" aria-label="Phase progress"><div class="ch" style="padding:0"><h2 class="lbl">Progress<button type="button" class="ibtn" data-info="phase" aria-expanded="false" aria-label="About this phase" data-tt="About this phase" data-notip>'+ic('info')+'</button></h2><span class="sp"></span><span class="cnt">'+d+' of '+t+' steps</span></div>'+
    '<div class="bw">'+phBar(p,true)+'<span class="glab">'+phLabel(p)+'</span></div>'+
    '<div class="kd"><span>Starts <b>'+fmt(pl[0])+'</b></span><span>'+(ps==='done'?'Finished':'Ends')+' <b>'+fmt(endD)+'</b></span>'+(ps!=='done'?'<span>Now <a href="#" data-go="inc-step-'+cur.n+'">Step '+cur.n+' · '+esc(cur.t)+'</a></span>':'')+(p===2?'<span>COI <b>'+fmt(coiDate())+(AFTER_ON?'':' (expected)')+'</b></span>':'')+'<span>Reviewer <b>Arjun Mehta</b></span></div></section>';
  var you=l.filter(function(x){return x.o==='You';}),sbc=l.filter(function(x){return x.o!=='You';}),O=[['You',you,'#c9a24b'],['SBC',sbc,'#2f6fd0']];
  var wh='<section class="card acc team" aria-label="Who’s doing it"><div class="ch"><h2 class="lbl">Who’s doing it</h2></div><div class="obar" role="group" aria-label="Owners in Phase '+p+'">'+
    O.filter(function(o){return o[1].length;}).map(function(o){return '<button type="button" style="flex:'+o[1].length+';background:'+o[2]+'" data-owner="'+o[0]+'" aria-label="'+o[0]+' · '+o[1].length+' steps" data-tt="'+o[0]+' · '+o[1].length+' of '+t+' steps" data-notip></button>';}).join('')+'</div>'+
    '<div class="lgd">'+O.map(function(o){return '<button type="button" class="lg" data-owner="'+o[0]+'" aria-label="Steps owned by '+o[0]+' · '+o[1].length+'"><i style="background:'+o[2]+'"></i><span>'+o[0]+'</span><b>'+o[1].length+'</b></button>';}).join('')+'</div></section>';
  h+='<div class="sgrid"><div class="scol"><section class="card acc" aria-label="Steps"><div class="ch"><h2 class="lbl">Steps</h2><span class="sp"></span><span class="cnt">'+t+' steps</span></div><div style="padding:0 8px 8px">'+stepTable(p,focus)+'</div></section></div><div class="scol side2">'+rail(p,focus,false)+wh+'</div></div>';
  h+='<nav class="pn" aria-label="Phases">'+(p>1?'<button type="button" class="btn" data-go="'+PH_KEY[p-2]+'">'+ic('arrow-left')+'<span>Phase '+(p-1)+'</span></button>':'<button type="button" class="btn" data-go="incorporation">'+ic('arrow-left')+'<span>All phases</span></button>')+(p<4?'<button type="button" class="btn" data-go="'+PH_KEY[p]+'"><span>Phase '+(p+1)+'</span>'+ic('arrow-right')+'</button>':'<button type="button" class="btn" data-go="incorporation"><span>All phases</span>'+ic('arrow-right')+'</button>')+'</nav></div>';
  main.innerHTML=h;
}

/* ---------- board resolution ---------- */
function renderBoard(){
  document.title='Board resolution · Incorporation · VCFO Suite';
  var stg=[['Drafted','SBC · 26 Sep'],['Released','28 Sep'],['Signed','You · 30 Sep']],parts=[];
  stg.forEach(function(s){parts.push('<div class="stg ok"><span class="o">'+sic('check',3.4)+'</span><span class="lb"><b>'+s[0]+'</b><small>'+s[1]+'</small></span></div>','<span class="cn ok" aria-hidden="true"></span>');});
  parts.push('<div class="now ok" role="group" aria-label="Received by SBC · Arjun · 30 Sep"><span class="tile">'+ic('check')+'</span><span class="tx"><span class="k">Received</span><b>Received by SBC</b><small>Arjun · 30 Sep</small></span></div>');
  var ln=function(w){return '<div class="ln" style="width:'+w+'%"></div>';};
  var h='<div class="wrap"><section class="hero" aria-label="Board resolution"><div class="hrow">'+
    '<div class="hl"><button type="button" class="hback" data-go="inc-phase-a" aria-label="Back to Phase 1 · Name Application">'+ic('chevron-left')+'</button>'+
    '<div class="htx"><div class="eb">Phase 1 · Name Application · steps 2–3</div><div class="ht"><h1>Board resolution</h1><button type="button" class="wt" data-chatq="What’s this: Board resolution?" aria-label="What’s this? Board resolution" data-tt="What’s this? · ask VCFO" data-notip>'+bmini()+'What’s this?</button></div>'+
    '<div class="hm" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px"><span class="chip done">Signed copy received · 30 Sep</span><span class="chip" style="background:rgba(255,255,255,.16);color:#fff">Certified true copy</span></div></div></div>'+
    '<div class="hr"><div class="hnav"><a href="#" class="wbtn" data-go="inc-step-2" aria-label="Step 2 · Draft Board Resolution"><span>2 · Draft Board Resolution</span>'+ic('chevron-right')+'</a><a href="#" class="wbtn" data-go="inc-step-3" aria-label="Step 3 · Signed Board Resolution"><span>3 · Signed Board Resolution</span>'+ic('chevron-right')+'</a></div>'+si('done','Done · received 30 Sep','xl')+'</div>'+
  '</div></section>';
  h+='<section class="card trk" aria-label="Progress of the board resolution"><div class="lc">'+parts.join('')+'</div></section>';
  h+='<div class="brg"><section class="card prv" aria-label="Preview"><div class="ch"><h2 class="lbl">Preview</h2><span class="cnt">page 1 of 2 · <span id="zv">'+Math.round(zoom*100)+'%</span></span><span class="sp"></span>'+
    '<button type="button" class="sq" data-zoom="-1" aria-label="Zoom out">'+ic('minus')+'</button><button type="button" class="sq" data-zoom="1" aria-label="Zoom in">'+ic('plus')+'</button><button type="button" class="sq" data-full aria-label="Open full screen">'+ic('maximize')+'</button></div>'+
    '<div class="pvw"><div class="paper" id="paper" style="transform:scale('+zoom+')"><div class="t">CERTIFIED TRUE COPY OF THE RESOLUTION PASSED BY THE BOARD OF DIRECTORS OF NORTHWIND INC. ON 24 SEPTEMBER 2026</div>'+ln(90)+ln(100)+ln(80)+'<h4>RESOLVED THAT</h4>'+ln(100)+ln(85)+ln(100)+ln(60)+'<h4>RESOLVED FURTHER THAT</h4>'+ln(100)+ln(75)+ln(100)+ln(50)+
    '<div class="sig"><div><div class="sg">J. Carter</div><div class="sgl">Director, Northwind Inc.</div></div><div class="stamp">NORTHWIND<br>INC.</div></div></div></div></section>';
  h+='<div class="scol"><section class="card acc files" aria-label="Files"><div class="ch"><h2 class="lbl">Files</h2><span class="sp"></span><span class="cnt">2 files</span></div>'+
    fileRow({t:'docx',n:'Draft · Word',f:'board-resolution.docx',m:'SBC · 26 Sep',s:'Released'})+fileRow({t:'pdf',n:'Signed copy',f:'br-signed-northwind.pdf',m:'You · 30 Sep',s:'Received'})+
    '<div class="drop blue"><button type="button" class="ut" data-upload="br" aria-label="Replace the signed copy">'+ic('refresh-cw')+'</button><span class="tx"><b>Replace signed copy</b><span>Drop a PDF or <button type="button" data-upload="br">browse</button></span></span><span class="mono">PDF · DOCX</span></div></section>'+
    '<section class="card acc team" aria-label="What happens with it"><div class="ch"><h2 class="lbl">What happens with it</h2></div>'+botSay('Your parent company’s board authorised the India subsidiary. SBC drafted it, J. Carter signed it, and it went with the name application in step 4.','Open step 3','','Open step 3 · Signed Board Resolution','inc-step-3')+'</section></div></div></div>';
  main.innerHTML=h;
}

/* ---------- status brief drawer ---------- */
function briefBody(){
  var s=spice();
  var h=AFTER_ON?'<p class="hl">Incorporated on <b>'+fmtY(DT(14))+'</b>. SPICe+ is <b>100%</b> done. Post-incorporation and Registration are under way.</p>'
    :'<p class="hl"><b>'+days(TODAY_B,WIN_END)+' days</b> to the expected COI ('+wd(WIN_END)+' '+fmt(WIN_END)+'). SPICe+ is <b>'+s.pct+'%</b> done: '+s.d+' of '+s.t+' steps.</p>';
  h+='<div class="sub-h">Phases</div>';
  for(var p=1;p<=4;p++){var l=steps(p),d=doneN(l),ps=phState(p);
    h+='<a href="#" class="bp" data-go="'+PH_KEY[p-1]+'" aria-label="Open Phase '+p+' · '+PH[p-1]+'">'+si(phKind(p))+'<span>Phase '+p+' · '+PH[p-1]+'<small>'+d+' of '+l.length+' · '+(ps==='done'?'done ':'ends ')+fmt(ps==='done'?phEnd(p):phPlan(p)[1])+'</small><span class="mini"><i style="width:'+Math.round(d/l.length*100)+'%"></i></span></span><span class="chip '+phKind(p)+'">'+(ps==='done'?'Done':ps==='up'?'Upcoming':'In progress')+'</span></a>';}
  var you=STEPS.filter(function(x){return KD(x.n)==='you';}),act=STEPS.filter(function(x){var k=KD(x.n);return k==='prog'||k==='with';});
  var row=function(x){return '<a href="#" class="bp" data-go="inc-step-'+x.n+'" aria-label="Open step '+x.n+' · '+esc(x.t)+'">'+si(KD(x.n))+'<span>'+x.n+' · '+esc(x.t)+'<small>'+dateCell(x.n)+'</small></span><span class="own '+x.o+'">'+x.o+'</span></a>';};
  h+='<div class="sub-h">Waiting on you</div>'+(you.length?you.map(row).join(''):botSay('Nothing is waiting on you.'));
  h+='<div class="sub-h">In progress</div>'+act.map(row).join('');
  return h;
}
function openBrief(btn){
  lastFocus=btn||document.activeElement;closeInfo();
  var sc=document.getElementById('ip-brief-scrim');if(sc)sc.remove();
  sc=document.createElement('div');sc.id='ip-brief-scrim';
  sc.innerHTML='<aside id="ip-brief" role="dialog" aria-modal="true" aria-labelledby="ip-brief-t"><div class="bh"><span class="si prog">'+GLY.prog+'</span><div style="flex:1;min-width:0"><b id="ip-brief-t">Monthly status brief</b><small>Northwind Technologies India Pvt Ltd · as of '+fmtY(today())+'</small></div><button type="button" class="sq" data-brief-close aria-label="Close status brief">'+ic('x')+'</button></div>'+
    '<div class="bb">'+briefBody()+'</div><div class="bf"><button type="button" class="btn" data-copy>'+ic('copy')+'Copy brief</button><button type="button" class="btn p" data-pdf>'+ic('download')+'Download PDF</button></div></aside>';
  document.body.appendChild(sc);briefOpen=true;
  if(btn)btn.setAttribute('aria-expanded','true');
  requestAnimationFrame(function(){sc.classList.add('on');});
  setTimeout(function(){var x=sc.querySelector('[data-brief-close]');x&&x.focus({preventScroll:true});},40);
}
function closeBrief(){
  var sc=document.getElementById('ip-brief-scrim');if(!sc)return;briefOpen=false;sc.classList.remove('on');
  setTimeout(function(){sc.remove();},reduce?0:180);
  var b=document.querySelector('[data-brief]');if(b)b.setAttribute('aria-expanded','false');
  if(lastFocus&&lastFocus.focus)lastFocus.focus({preventScroll:true});
}
function briefText(){var t=['Incorporation status brief · Northwind Technologies India Pvt Ltd'];for(var p=1;p<=4;p++){var l=steps(p);t.push('Phase '+p+' · '+PH[p-1]+': '+doneN(l)+' of '+l.length+' done');}return t.join('\n');}

/* ---------- info pop-over (rule 7) ---------- */
var INFO={coi:['Days to COI','Counts down to the end of the incorporation window your manager set (Wed 28 Oct 2026). After the Certificate of Incorporation it shows the real incorporation date.'],
  phases:['The phases','Each bar is the planned window of a phase. The fill is the share of steps done; red is time past the plan. The red line is today; the gold diamond is the COI.'],
  docs:['Documents','Files this step needs. SBC checks each one before it goes into the MCA filing.'],
  noc:['NOC from the owner','A no-objection certificate signed by the owner of the premises, needed when the company does not own the registered office.'],
  timeline:['Timeline','Everything that happened on this step, oldest first, with who did it.']};
function openInfo(btn){
  if(pop&&popBtn===btn){closeInfo();return;}closeInfo();
  var key=btn.getAttribute('data-info'),it=INFO[key]||['',''],title=it[0],txt=it[1];
  if(key==='answers'){var x=STEPS[curN()-1];title=x.t;txt=x.d||'';}
  if(key==='phase'){var p=curP();title='Phase '+p+' · '+PH[p-1];txt=PH_INFO[p-1];}
  pop=document.createElement('div');pop.className='ip-pop';pop.setAttribute('role','dialog');pop.setAttribute('aria-label','About '+title);
  pop.innerHTML='<p>'+esc(txt)+'</p><button type="button" data-chatq="What’s this: '+esc(title)+'?" aria-label="Ask VCFO: what’s this? '+esc(title)+'">'+bmini()+'Ask VCFO about this</button>';
  document.body.appendChild(pop);popBtn=btn;btn.setAttribute('aria-expanded','true');
  var r=btn.getBoundingClientRect(),w=pop.offsetWidth;pop.style.left=(Math.max(12,Math.min(innerWidth-w-12,r.left-8))+scrollX)+'px';pop.style.top=(r.bottom+scrollY+8)+'px';
}
function closeInfo(){if(pop){pop.remove();pop=null;}if(popBtn){popBtn.setAttribute('aria-expanded','false');popBtn=null;}}

/* ---------- tooltips (rules 14 + 17) ---------- */
var tt=null,ttT=0,lpT=0;
function tipEl(){if(!tt){tt=document.createElement('div');tt.id='ip-tt';tt.setAttribute('role','tooltip');document.body.appendChild(tt);}return tt;}
function showTip(el,x,y){
  var t=el.getAttribute('data-tt');if(!t)return;var d=tipEl();d.textContent=t;
  var r=el.getBoundingClientRect(),svg=(el instanceof SVGElement)&&x!=null,cx=svg?x:r.left+r.width/2,top=svg?y-10:r.top,w=d.offsetWidth,hgt=d.offsetHeight;
  d.style.left=Math.max(8,Math.min(innerWidth-w-8,cx-w/2))+'px';
  var ty=top-hgt-8;d.style.top=(ty<4?(svg?y+18:r.bottom+8):ty)+'px';
  clearTimeout(ttT);ttT=setTimeout(function(){d.classList.add('on');},100);
}
function hideTip(){if(tt){clearTimeout(ttT);tt.classList.remove('on');}}
document.addEventListener('mouseover',function(e){var el=e.target.closest&&e.target.closest('[data-tt]');if(el)showTip(el,e.clientX,e.clientY);else hideTip();});
document.addEventListener('focusin',function(e){var el=e.target.closest&&e.target.closest('[data-tt]');var fv=true;try{fv=e.target.matches(':focus-visible');}catch(x){}if(el&&fv)showTip(el);});
document.addEventListener('focusout',hideTip);
document.addEventListener('scroll',hideTip,true);
document.addEventListener('pointerdown',function(e){
  hideTip();clearTimeout(lpT);if(e.pointerType!=='touch')return;
  var el=e.target.closest&&e.target.closest('[data-tt]');if(!el)return;
  lpT=setTimeout(function(){showTip(el,e.clientX,e.clientY);setTimeout(hideTip,1800);},450);
},true);
['pointerup','pointercancel'].forEach(function(n){document.addEventListener(n,function(){clearTimeout(lpT);},true);});

/* ---------- interactions ---------- */
function togglePh(p){openPh=openPh===p?null:p;var c=document.getElementById('phc');if(!c)return;
  [].forEach.call(c.querySelectorAll('.phr'),function(r){var q=+r.getAttribute('data-p'),o=openPh===q;r.classList.toggle('open',o);var b=r.querySelector('[data-toggle]');
    b.setAttribute('aria-expanded',String(o));b.setAttribute('aria-label',(o?'Close':'Open')+' Phase '+q+' · '+PH[q-1]);b.innerHTML=(o?'Close':'Open')+ic('chevron-down');
    r.querySelector('.phb').innerHTML=o?stepTable(q):'';});}
function drillPhase(p){var l=steps(p),tabs=tabsFor(l),c=cnt(l),act=c.you?'you':c.with?'with':c.prog?'prog':c.done===l.length?'done':'up';
  var cfg={title:'Phase '+p+' · '+PH[p-1],sub:doneN(l)+' of '+l.length+' steps done',tabs:tabs,active:idx(tabs,act)};
  if(PAGE!=='phase')cfg.link={lead:'Every step of this phase',text:'Open the phase page →',go:PH_KEY[p-1],where:'the phase page'};drill(cfg);}
function drillRing(){var sp=STEPS.filter(function(x){return x.p<=2;}),tabs=tabsFor(sp);drill({title:'SPICe+ progress',sub:'Phases 1 and 2 · '+doneN(sp)+' of '+sp.length+' steps done',tabs:tabs,active:idx(tabs,'you'),link:{lead:'SPICe+ ends with the Certificate of Incorporation',text:'Open Phase 2 →',go:'inc-phase',where:'the phase pages'}});}
function drillAll(){var tabs=tabsFor(STEPS);drill({title:'All 48 steps',sub:doneN(STEPS)+' done · '+(48-doneN(STEPS))+' to go',tabs:tabs,active:idx(tabs,AFTER_ON?'with':'you')});}
function drillOwner(o){var p=curP(),l=steps(p),tabs=['You','SBC'].map(function(k){return {k:k,label:k,color:k==='You'?'#c9a24b':'#2f6fd0',rows:l.filter(function(x){return x.o===k;}).map(stRow)};}).filter(function(t){return t.rows.length;});
  drill({title:'Who’s doing it · Phase '+p,sub:PH[p-1]+' · '+l.length+' steps',tabs:tabs,active:idx(tabs,o)});}
function setNeed(key,on){
  checks[key]=on;
  if(key==='7:noc'){render();if(on)toast('NOC marked as uploaded',true);return;}
  var items=main.querySelectorAll('[data-need]'),left=[].filter.call(items,function(i){return !i.checked;}).length,c=document.getElementById('needN');
  if(c){c.className='chip '+(left?'you':'done');c.textContent=left?left+' left':'All done';}
  var bar=main.querySelector('.act .tr i');if(bar)bar.style.width=Math.max(6,Math.round((items.length-left)/items.length*100))+'%';
}
document.addEventListener('click',function(e){
  var t=e.target;if(!t||!t.closest)return;
  if(t.closest('#vp-bar,#vp-chat,#vp-launch,#vp-drill-scrim,.vps,#vp-drawer,#vp-toast'))return;
  var el;
  if(pop&&!t.closest('.ip-pop')&&!t.closest('[data-info]'))closeInfo();
  if((el=t.closest('#ip-brief-scrim'))&&t===el){e.preventDefault();closeBrief();return;}
  if(t.closest('[data-go]')){closeInfo();if(briefOpen)closeBrief();return;}   /* proto.js routes data-go */
  if((el=t.closest('[data-toggle]'))){e.preventDefault();togglePh(+el.getAttribute('data-toggle'));return;}
  if((el=t.closest('[data-ask]'))){e.preventDefault();touch(el);chat(whats(STEPS[+el.getAttribute('data-ask')-1]));return;}
  if((el=t.closest('[data-chatq]'))){e.preventDefault();touch(el);closeInfo();if(briefOpen)closeBrief();chat(el.getAttribute('data-chatq'));return;}
  if((el=t.closest('[data-bar]'))){e.preventDefault();touch(el);drillPhase(+el.getAttribute('data-bar'));return;}
  if((el=t.closest('[data-ring]'))){e.preventDefault();touch(el);drillRing();return;}
  if((el=t.closest('[data-coi]'))){e.preventDefault();touch(el);drillRing();return;}
  if((el=t.closest('[data-allsteps]'))){e.preventDefault();touch(el);drillAll();return;}
  if((el=t.closest('.today'))){e.preventDefault();touch(el);toast('Today · '+wd(today())+' '+fmtY(today()));return;}
  if((el=t.closest('[data-seg]'))){e.preventDefault();touch(el);drillSeg(el.getAttribute('data-seg'));return;}
  if((el=t.closest('[data-owner]'))){e.preventDefault();touch(el);drillOwner(el.getAttribute('data-owner'));return;}
  if((el=t.closest('[data-railall]'))){e.preventDefault();railAll=!railAll;render();return;}
  if((el=t.closest('[data-portal]'))){e.preventDefault();touch(el);toast('Opens '+STEPS[+el.getAttribute('data-portal')-1].f[0]+' on the official portal in a new tab');return;}
  if((el=t.closest('[data-portal-f]'))){e.preventDefault();touch(el);toast('Opens '+el.getAttribute('data-portal-f')+' on the official portal in a new tab');return;}
  if((el=t.closest('[data-upload]'))){e.preventDefault();touch(el);
    if(el.getAttribute('data-upload')==='7'){checks['7:noc']=true;render();toast('NOC from property owner uploaded · Arjun will check it',true);}else toast('Choose a PDF to replace the signed copy');return;}
  if((el=t.closest('[data-view]'))){e.preventDefault();touch(el);toast('Preview · '+el.getAttribute('data-view'));return;}
  if((el=t.closest('[data-dl]'))){e.preventDefault();touch(el);toast('Download started · '+el.getAttribute('data-dl'));return;}
  if((el=t.closest('[data-change]'))){e.preventDefault();touch(el);var cn=+el.getAttribute('data-change');chat('I want to request a change to step '+cn+' · '+STEPS[cn-1].t);return;}
  if((el=t.closest('[data-approve]'))){e.preventDefault();touch(el);var an=+el.getAttribute('data-approve');
    if(an===7&&!checks['7:noc']){toast('Upload the NOC first · it is still needed from you');return;}
    el.innerHTML=ic('check')+'Submitted';el.disabled=true;toast('Approved & submitted · Arjun Mehta files it next',true);return;}
  if((el=t.closest('[data-msg]'))){e.preventDefault();touch(el);chat('Message for Arjun Mehta about step '+curN()+' · '+STEPS[curN()-1].t);return;}
  if((el=t.closest('[data-draft]'))){e.preventDefault();touch(el);toast('Draft saved',true);return;}
  if((el=t.closest('[data-zoom]'))){e.preventDefault();zoom=Math.max(.6,Math.min(1.6,Math.round((zoom+(+el.getAttribute('data-zoom'))*.1)*10)/10));var pp=document.getElementById('paper');if(pp)pp.style.transform='scale('+zoom+')';var zv=document.getElementById('zv');if(zv)zv.textContent=Math.round(zoom*100)+'%';touch(el);return;}
  if((el=t.closest('[data-full]'))){e.preventDefault();touch(el);toast('Full screen · opens the document viewer in the full app');return;}
  if((el=t.closest('[data-brief]'))){e.preventDefault();openBrief(el);return;}
  if((el=t.closest('[data-brief-close]'))){e.preventDefault();closeBrief();return;}
  if((el=t.closest('[data-copy]'))){e.preventDefault();touch(el);try{var pr=navigator.clipboard&&navigator.clipboard.writeText(briefText());if(pr&&pr.catch)pr.catch(function(){});}catch(err){}toast('Status brief copied',false);return;}
  if((el=t.closest('[data-pdf]'))){e.preventDefault();touch(el);toast('Download started · status-brief-'+(AFTER_ON?'nov':'oct')+'-2026.pdf');return;}
  if((el=t.closest('[data-info]'))){e.preventDefault();openInfo(el);return;}
  if((el=t.closest('.tab'))){e.preventDefault();touch(el);toast('Already showing '+el.textContent);return;}
},true);
document.addEventListener('change',function(e){var el=e.target;if(el&&el.matches&&el.matches('[data-need]'))setNeed(el.getAttribute('data-need'),el.checked);});
document.addEventListener('keydown',function(e){if(e.key!=='Escape')return;if(pop){closeInfo();return;}if(briefOpen){e.stopPropagation();closeBrief();}},true);
var rzT=0;addEventListener('resize',function(){closeInfo();clearTimeout(rzT);rzT=setTimeout(function(){layoutGantt();actH();},80);});

function render(){closeInfo();hideTip();shownKey=viewKey();
  if(PAGE==='phase')renderPhase();else if(PAGE==='step')renderStep();else if(PAGE==='board')renderBoard();else renderLanding();
  if(briefOpen){var b=document.querySelector('#ip-brief .bb');if(b)b.innerHTML=briefBody();}
  firstPaint=false;}
function rerender(v){var nv=(v===undefined)?readAfter():!!v;if(nv===AFTER_ON)return;AFTER_ON=nv;render();}
/* What's this? answers for the Ask VCFO drawer: window.vcfoWhatsThis('What’s this: <step title>?') -> {title,text,why,source,go} or null */
window.vcfoWhatsThis=function(q){
  var m=String(q||'').match(/^What[’']s this:\s*(.+?)\?$/i);if(!m)return null;var t=m[1].toLowerCase(),x=null;
  STEPS.forEach(function(s){if(s.t.toLowerCase()===t)x=s;});
  var pm=t.match(/^phase\s*(\d)/),pi=pm?+pm[1]:0;
  if(!x&&!pi)PH.forEach(function(n,i){if(n.toLowerCase()===t&&i!==1)pi=i+1;});
  if(!x&&pi>=1&&pi<=4){var pl=steps(pi);return {title:'Phase '+pi+' · '+PH[pi-1],text:PH_INFO[pi-1],why:PH_WHY[pi-1],source:PH_SRC[pi-1]+' · VCFO Suite checklist, steps '+pl[0].n+'–'+pl[pl.length-1].n,go:PH_KEY[pi-1]};}
  if(!x){var ik=null;Object.keys(INFO).forEach(function(k){if(INFO[k][0].toLowerCase()===t)ik=k;});
    if(ik)return {title:INFO[ik][0],text:INFO[ik][1],why:INFO_WHY[ik],source:'VCFO Suite · your incorporation project',go:ik==='docs'||ik==='noc'||ik==='timeline'?'inc-step-'+curN():'incorporation'};}
  if(!x)return /board resolution/.test(t)?{title:'Board resolution',text:'Your parent company’s board authorises the India subsidiary. SBC drafts it, a director signs it, and you upload the signed copy.',why:'The name application in step 4 cannot be filed without it.',source:'Companies Act 2013 · SPICe+ Part A',go:'board-resolution'}:null;
  return {title:x.t,text:x.d,why:x.o==='You'?'You own this step: your answers and documents go into the '+(x.f[0]||'filing')+'.':'SBC does this step for you; you see the result and approve it.',source:(x.f.length?x.f.join(', ')+' · ':'')+'VCFO Suite checklist, step '+x.n,go:'inc-step-'+x.n};
};
window.__incRerender=rerender;
document.addEventListener('vcfo-after',function(e){rerender(e.detail);});
addEventListener('storage',function(e){if(e.key==='vcfo.after')rerender();});
var shownKey=null;function viewKey(){return PAGE==='phase'?'p'+curP():PAGE==='step'?'n'+curN():PAGE;}
if(PAGE==='phase'||PAGE==='step')addEventListener('hashchange',function(){if(viewKey()===shownKey)return;railAll=false;render();window.scrollTo(0,0);});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){layoutGantt();});
render();
})();
