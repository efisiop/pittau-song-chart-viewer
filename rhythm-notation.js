(function(root){
 const VALUES=[4,2,1,.5,.25];
 function normalizeEvents(events){
  if(!Array.isArray(events)||events.length>64)return null;
  const result=events.map(e=>e&&['note','rest'].includes(e.kind)&&VALUES.includes(Number(e.duration))?{kind:e.kind,duration:Number(e.duration),...(e.dotted===true?{dotted:true}:{}),...(e.staccato===true?{staccato:true}:{}),...(Number.isInteger(e.string)&&e.string>=1&&e.string<=6&&Number.isInteger(e.fret)&&e.fret>=0&&e.fret<=24?{string:e.string,fret:e.fret}:{})}:null);
  return result.every(Boolean)?result:null;
 }
 function normalize(value){
  if(!value||typeof value!=='object')return null;
  const events=normalizeEvents(value.events),originalEvents=normalizeEvents(value.originalEvents||value.events);
  return events&&originalEvents?{events,originalEvents,head:value.head==='cross'?'cross':'normal',...(value.compact===true?{compact:true}:{}),display:['source','staff','tab','both'].includes(value.display)?value.display:'rhythm'}:null;
 }
 const total=events=>events.reduce((sum,e)=>sum+e.duration*(e.dotted?1.5:1),0);
 function validate(events,beats){const normalized=normalizeEvents(events);if(!normalized||!normalized.length)return {valid:false,message:'Add at least one note or rest.'};const length=total(normalized),valid=Math.abs(length-beats)<1e-8;return {valid,total:length,message:valid?`${length} of ${beats} quarter-note beats`:`${length} of ${beats} quarter-note beats — ${length<beats?'add':'remove'} ${Math.abs(beats-length)} to fill this bar.`}}
 function svg(events,beats=4,head='normal',compact=false){
  const check=validate(events,beats);if(!check.valid)return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 85"><text x="8" y="42" font-size="12">Rhythm needs review</text></svg>`;
  const y=54,left=16,right=226,scale=(right-left-8)/beats;let onset=0,compactX=left;
  const positions=events.map(e=>{const p={...e,x:compact?compactX:(events.length===1&&e.kind==='rest'?120:20+(onset+(e.kind==='rest'&&e.duration>=2?e.duration*(e.dotted?1.5:1)/2:0))/beats*200),onset};compactX+=Math.max(24,28*Math.sqrt(e.duration*(e.dotted?1.5:1)));onset+=e.duration*(e.dotted?1.5:1);return p});
  const w=compact?positions.at(-1).x+24:240,end=w-4;
  const ink='#111',parts=[`<path d="M4 ${y}H${end} M4 ${y-10}V${y+10} M${end} ${y-10}V${y+10}" fill="none" stroke="${ink}" stroke-width="1.1"/>`],beamed=new Set();
  for(let i=0;i<positions.length;i++){
   const a=positions[i];if(a.kind!=='note'||a.duration>.5||beamed.has(i))continue;
   let end=i;while(end+1<positions.length&&end-i<3&&positions[end+1].kind==='note'&&positions[end+1].duration===a.duration)end++;
   if(end===i)continue;
   for(let j=i;j<=end;j++)beamed.add(j);
   for(let beam=0;beam<(a.duration===.25?2:1);beam++)parts.push(`<path d="M${a.x+5} ${y-31+beam*7}H${positions[end].x+5}" stroke="${ink}" stroke-width="4"/>`);
  }
  positions.forEach((e,i)=>{
   const x=e.x,filled=e.duration<=1;
   if(e.kind==='note'){
    if(head==='cross')parts.push(`<path d="M${x-5} ${y-5}l10 10 M${x-5} ${y+5}l10 -10" stroke="${ink}" stroke-width="2"/>`);
    else parts.push(`<ellipse cx="${x}" cy="${y}" rx="5.5" ry="3.8" transform="rotate(-18 ${x} ${y})" fill="${filled?ink:'#fff'}" stroke="${ink}" stroke-width="1.5"/>`);
    if(e.duration<4)parts.push(`<path d="M${x+5} ${y}V${y-32}" stroke="${ink}" stroke-width="1.4"/>`);
    if(e.duration<1&&!beamed.has(i))for(let f=0;f<(e.duration===.25?2:1);f++)parts.push(`<path d="M${x+5} ${y-32+f*7}q16 7 7 21q5 -13 -7 -16" fill="${ink}"/>`);
   }else if(e.duration>=2){
    const ry=e.duration===4?y:y-5;parts.push(`<rect x="${x-5}" y="${ry}" width="11" height="5" fill="${ink}"/>`);
   }else if(e.duration===1){
    parts.push(`<path d="M${x-2} ${y-14}l7 9 -7 7 6 7q-11 -2 -7 8q-10 -9 1 -13l-6 -7 7 -7Z" fill="${ink}"/>`);
   }else{
    parts.push(`<path d="M${x+5} ${y-11}l-7 26" stroke="${ink}" stroke-width="1.8"/><circle cx="${x-1}" cy="${y-7}" r="3.6" fill="${ink}"/><path d="M${x-1} ${y-7}q6 4 6 -4" stroke="${ink}" fill="none"/>`);
    if(e.duration===.25)parts.push(`<circle cx="${x-3}" cy="${y+1}" r="3.6" fill="${ink}"/><path d="M${x-3} ${y+1}q6 4 6 -4" stroke="${ink}" fill="none"/>`);
   }
   if(e.staccato&&e.kind==='note')parts.push(`<circle cx="${x}" cy="${y+12}" r="1.8" fill="${ink}"/>`);
   if(e.dotted)parts.push(`<circle cx="${x+12}" cy="${y-4}" r="1.9" fill="${ink}"/>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="85" viewBox="0 0 ${w} 85" role="img" aria-label="Rhythm notation">${parts.join('')}</svg>`;
 }

 function guitarSvg(events,beats=4,mode='both'){
  const height=mode==='both'?160:85,staff=mode!=='tab',tab=mode!=='staff',tabTop=mode==='both'?102:20;
  if(!validate(events,beats).valid)return svg(events,beats);
  const parts=[];if(staff){for(let i=0;i<5;i++)parts.push(`<path d="M4 ${24+i*8}H236" stroke="#333" stroke-width=".7"/>`);parts.push('<text x="4" y="20" font-size="8">Guitar · treble, octave below</text>')}
  if(tab){for(let i=0;i<6;i++)parts.push(`<path d="M4 ${tabTop+i*8}H236" stroke="#555" stroke-width=".7"/>`);parts.push(`<text x="4" y="${tabTop-5}" font-size="8">TAB · E A D G B e</text>`)}
  let onset=0;
  for(const event of events){const x=events.length===1&&event.kind==='rest'?120:20+(onset+(event.kind==='rest'&&event.duration>=2?event.duration*(event.dotted?1.5:1)/2:0))/beats*200;onset+=event.duration*(event.dotted?1.5:1);
   if(event.kind==='rest'){const inner=svg([event],event.duration*(event.dotted?1.5:1)).split('aria-label="Rhythm notation">')[1]?.split('</svg>')[0];if(inner)parts.push(`<svg x="${x-12}" y="${staff?0:tabTop-24}" width="32" height="70" viewBox="0 0 40 85">${inner}</svg>`);continue}
   if(!Number.isInteger(event.string)||!Number.isInteger(event.fret)){parts.push(`<text x="${x}" y="${staff?45:tabTop+25}" font-size="12">?</text>`);continue}
   const midi=[64,59,55,50,45,40][event.string-1]+event.fret,pc=midi%12,steps=[0,0,1,1,2,3,3,4,4,5,5,6],diatonic=Math.floor(midi/12)*7+steps[pc],y=56-(diatonic-(4*7+2))*4;
   if(staff){for(let ly=64;ly<=y;ly+=8)parts.push(`<path d="M${x-8} ${ly}h16" stroke="#111"/>`);for(let ly=16;ly>=y;ly-=8)parts.push(`<path d="M${x-8} ${ly}h16" stroke="#111"/>`);if([1,3,6,8,10].includes(pc))parts.push(`<text x="${x-13}" y="${y+4}" font-size="12">♯</text>`);parts.push(`<ellipse cx="${x}" cy="${y}" rx="4.5" ry="3" fill="${event.duration<=1?'#111':'#fff'}" stroke="#111"/>`);if(event.duration<4)parts.push(`<path d="M${x+4} ${y}v-26" stroke="#111"/>`);if(event.duration<1)for(let f=0;f<(event.duration===.25?2:1);f++)parts.push(`<path d="M${x+4} ${y-26+f*6}q12 5 6 17" fill="none" stroke="#111" stroke-width="2"/>`);if(event.dotted)parts.push(`<circle cx="${x+9}" cy="${y-2}" r="1.5"/>`)}
   if(tab)parts.push(`<rect x="${x-6}" y="${tabTop+(event.string-1)*8-5}" width="14" height="11" fill="white"/><text x="${x}" y="${tabTop+(event.string-1)*8+4}" text-anchor="middle" font-family="Arial" font-size="11">${event.fret}</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 ${height}" role="img" aria-label="Guitar notation">${parts.join('')}</svg>`;
 }
 const api={guitarSvg,VALUES,normalizeEvents,normalize,total,validate,svg};if(typeof module==='object'&&module.exports)module.exports=api;else root.ChartRhythmNotation=api;
})(typeof window==='undefined'?globalThis:window);
