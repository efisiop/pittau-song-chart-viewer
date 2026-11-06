(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SongChartPractice=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
 const normalizeTempo=value=>Math.round(clamp(Number(value)||120,30,300)*100)/100;
 const parseTempo=value=>{const match=String(value||'').match(/\d+(?:\.\d+)?/),number=match?Number(match[0]):120;return normalizeTempo(Number.isFinite(number)?number:120)};
 const parseMeter=value=>{const match=String(value||'').match(/(\d+)\s*\//),number=match?Number(match[1]):4;return clamp(Number.isFinite(number)?Math.round(number):4,1,16)};

 function create(callbacks={},dependencies={}){
  const now=dependencies.now||(()=>performance.now()),schedule=dependencies.schedule||((fn,delay)=>setTimeout(fn,delay)),cancel=dependencies.cancel||clearTimeout;
  let bpm=120,beatsPerMeasure=4,totalMeasures=1,measure=1,beat=1,playing=false,metronome=true,timer=null,nextAt=0,audioContext=null;
  function state(){return {bpm,beatsPerMeasure,totalMeasures,measure,beat,playing,metronome}}
  function emitState(){callbacks.onState?.(state())}
  function prepareAudio(){
   if(dependencies.click)return;
   const AudioContextClass=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);
   if(!AudioContextClass)return;
   if(!audioContext)audioContext=new AudioContextClass();
   if(audioContext.state==='suspended')audioContext.resume();
  }
  function sound(currentBeat){
   if(!metronome)return;
   if(dependencies.click){dependencies.click(currentBeat);return}
   if(!audioContext)return;
   const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),start=audioContext.currentTime;
   oscillator.frequency.value=currentBeat===1?1180:820;gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(currentBeat===1?.22:.13,start+.004);gain.gain.exponentialRampToValueAtTime(.0001,start+.055);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(start);oscillator.stop(start+.06);
  }
  function stopTimer(){if(timer!==null){cancel(timer);timer=null}}
  function finish(){playing=false;stopTimer();emitState()}
  function tick(){
   if(!playing)return;
   const current={measure,beat,totalMeasures};sound(beat);callbacks.onBeat?.(current);
   const atEnd=measure===totalMeasures&&beat===beatsPerMeasure;
   if(atEnd){finish();return}
   if(beat===beatsPerMeasure){beat=1;measure+=1}else beat+=1;
   nextAt+=60000/bpm;timer=schedule(tick,Math.max(0,nextAt-now()));
  }
  function start(){if(playing||!totalMeasures)return;if(measure===totalMeasures&&beat===beatsPerMeasure){measure=1;beat=1}prepareAudio();playing=true;nextAt=now();emitState();tick()}
  function pause(){if(!playing)return;playing=false;stopTimer();emitState()}
  function reset(){pause();measure=1;beat=1;callbacks.onPosition?.({measure,beat,totalMeasures});emitState()}
  function seek(value){
   const wasPlaying=playing;stopTimer();measure=clamp(Math.round(Number(value)||1),1,totalMeasures);beat=1;callbacks.onPosition?.({measure,beat,totalMeasures});emitState();
   if(wasPlaying){nextAt=now();tick()}
  }
  function setTempo(value){bpm=normalizeTempo(value);emitState()}
  function setMetronome(value){metronome=Boolean(value);if(metronome)prepareAudio();emitState()}
  function configure(options={}){
   if(options.bpm!==undefined)bpm=parseTempo(options.bpm);
   if(options.beatsPerMeasure!==undefined)beatsPerMeasure=clamp(Math.round(Number(options.beatsPerMeasure)||4),1,16);
   if(options.totalMeasures!==undefined)totalMeasures=Math.max(1,Math.round(Number(options.totalMeasures)||1));
   measure=clamp(measure,1,totalMeasures);beat=clamp(beat,1,beatsPerMeasure);emitState();
  }
  return {configure,start,pause,reset,seek,setTempo,setMetronome,getState:state};
 }
 return {create,parseTempo,parseMeter};
});
