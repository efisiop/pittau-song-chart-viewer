(function(root){
 const Rhythm=typeof module==='object'&&module.exports?require('./rhythm-notation'):root.ChartRhythmNotation;
 const VIEWS={pianoBacking:{label:'BV1 · lead cues',lyrics:true,chords:false,snippets:false,backing:true},vocal:{label:'Vocal · lyrics',lyrics:true,chords:false,snippets:false},piano:{label:'Piano · chords + lyrics',lyrics:true,chords:true,snippets:false,backing:true},instrumental:{label:'Instrumental · chords',lyrics:false,chords:true,snippets:false},specialist:{label:'Specialist · chords + score snippets',lyrics:false,chords:true,snippets:true}};
 function normalizeView(value){return Object.hasOwn(VIEWS,value)?value:'piano'}
 function viewOptions(value){return VIEWS[normalizeView(value)]}
 function normalizeSnippets(value,bars){return (Array.isArray(value)?value:[]).filter(s=>s&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(String(s.image||''))).map(s=>({title:String(s.title||'Score snippet'),instrument:String(s.instrument||'').trim(),caption:String(s.caption||''),startBar:Math.max(1,Math.min(bars,Math.round(Number(s.startBar)||1))),endBar:Math.max(1,Math.min(bars,Math.round(Number(s.endBar)||Number(s.startBar)||1))),image:s.image,...(Rhythm.normalize(s.rhythm)?{rhythm:Rhythm.normalize(s.rhythm)}:{}),...(s.inline===true?{inline:true}:{})})).map(s=>({...s,endBar:Math.max(s.startBar,s.endBar)}))}
 function visibleSnippets(snippets,instrument){const wanted=String(instrument||'').trim().toLowerCase();return snippets.filter(s=>!wanted||!s.instrument||s.instrument.toLowerCase()===wanted)}
 // Keep every stored horizontal anchor. Additional rails accommodate full words;
 // they never redistribute words or claim exact musical attack detection.
 function normalizeQuantization(value){return value==='eighth'?'eighth':'off'}
 function meterInfo(meter='4/4'){
  const match=String(meter).trim().match(/^(\d+)\s*\/\s*(\d+)$/),n=Number(match?.[1]),d=Number(match?.[2]);
  if(!match||n<1||n>32||![1,2,4,8,16,32,64].includes(d))return {numerator:4,denominator:4,quarterBeats:4,step:.5};
  return {numerator:n,denominator:d,quarterBeats:n*4/d,step:Math.min(.5,4/d)};
 }
 function quantizeLyrics(events,mode,meter='4/4',anchors={}){
  if(normalizeQuantization(mode)!=='eighth')return events;
  const {quarterBeats,step}=meterInfo(meter),divisor=1/step,last=Math.round(quarterBeats/step)-1;
  return events.map((event,index)=>{
   const anchor=anchors?.[index];
   const source=anchor&&Number.isInteger(anchor.numerator)&&Number.isInteger(anchor.denominator)&&anchor.denominator>0&&anchor.numerator>=0&&anchor.numerator/anchor.denominator<quarterBeats?anchor:event.onset;
   const units=Math.max(0,Math.min(last,Math.round(source.numerator/source.denominator/step)));
   let n=units,d=divisor;while(d>1&&n%2===0){n/=2;d/=2;}
   return {...event,onset:{numerator:n,denominator:d}};
  });
 }
 function visualLayout(events,widthEstimator,beats=4){
  const ends=[],out=[];
  for(const event of events){
   const leftPercent=event.onset.numerator/event.onset.denominator/beats*100;
   const continuation=/^_+$/.test(event.text),width=Math.max(1,Number(widthEstimator(event.text))||1);
   let track=0;while((ends[track]??-Infinity)>leftPercent)track++;
   ends[track]=leftPercent+width+1;
   out.push({...event,text:event.text.replace(/-/g,''),leftPercent,displayLeftPercent:leftPercent,track,fitScale:1,visualContinuation:continuation});
  }
  return out;
 }
 // Display-only fitting with a comfortable word gap and balanced typography.
 // Source beat-1/3 attacks are immovable; other starts have bounded flexibility.
 function singleLineLayout(events,widthEstimator,{beats=4,minScale=.92,maxShift=9.375,wordGap=1,profiles=null}={}){
  const base=events.map(event=>({...event,leftPercent:event.onset.numerator/event.onset.denominator/beats*100}));
  function attempt(profile){
   const widths=base.map(e=>Math.max(.2,widthEstimator(e.text,profile.scale,profile))),gap=wordGap;
   const fixed=e=>e.fixedAnchor??(e.leftPercent===0||e.leftPercent===200/beats);
   const lower=base.map(e=>fixed(e)?e.leftPercent:Math.max(0,e.leftPercent-maxShift));
   const upper=base.map((e,i)=>fixed(e)?e.leftPercent:Math.min(100-widths[i],e.leftPercent+maxShift));
   for(let i=base.length-2;i>=0;i--)upper[i]=Math.min(upper[i],upper[i+1]-widths[i]-gap);
   const out=[];let end=-gap;
   for(let i=0;i<base.length;i++){
    const lo=Math.max(lower[i],end+gap),hi=Math.min(upper[i],100-widths[i]);
    if(lo>hi+1e-7)return null;
    const x=Math.min(hi,Math.max(lo,base[i].leftPercent));
    out.push({...base[i],text:base[i].text.replace(/-/g,''),displayLeftPercent:x,track:0,fitScale:profile.scale,visualContinuation:/^_+$/.test(base[i].text)});end=x+widths[i];
   }
   return out;
  }
  const candidates=profiles||[1,.98,.96,.94,.92].filter(scale=>scale>=minScale-1e-7).map(scale=>({scale,widthScale:1,tracking:0}));
  let best=null;
  for(const profile of candidates){
   if(profile.scale<minScale-1e-7)continue;
   const out=attempt(profile);if(!out)continue;
   const shifts=out.map(e=>Math.abs(e.displayLeftPercent-e.leftPercent)/maxShift);
   const cost=2*((1-profile.scale)/.08)**2+((1-profile.widthScale)/.08)**2+.5*(profile.tracking/.01)**2+shifts.reduce((n,v)=>n+v*v,0)/Math.max(1,out.length);
   if(!best||cost<best.cost)best={events:out,fit:true,fitScale:profile.scale,widthScale:profile.widthScale,tracking:profile.tracking,cost};
  }
  // Preserve readability and flag impossible bars; never conceal an overflow.
  return best||{events:visualLayout(events,text=>widthEstimator(text,1,{widthScale:1,tracking:0}),beats),fit:false,fitScale:1,widthScale:1,tracking:0};
 }
 const api={VIEWS,normalizeView,viewOptions,normalizeSnippets,visibleSnippets,normalizeQuantization,meterInfo,quantizeLyrics,visualLayout,singleLineLayout};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ChartMusicianViews=api;
})(typeof window==='undefined'?globalThis:window);
