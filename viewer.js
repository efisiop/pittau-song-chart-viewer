(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const Views = window.ChartMusicianViews;
  const state = { chart: null, view: 'vocal', theme: '2', active: 1, loading: 0 };
  const player = window.SongChartPractice.create({
    onBeat: position => { state.active = position.measure; showPosition(position); highlight(); },
    onPosition: position => { state.active = position.measure; showPosition(position); highlight(true); },
    onState: current => { $('play').textContent = current.playing ? '❚❚ Pause' : '▶ Start'; }
  });

  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = String(text);
    return element;
  };
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const validData = chart => chart && typeof chart === 'object' && !Array.isArray(chart) && Array.isArray(chart.sections) && chart.schemaVersion === 5;
  const meterBeats = chart => Math.max(1, Math.min(16, window.SongChartPractice.parseMeter(chart.meter)));
  const barCount = chart => chart.sections.reduce((sum, section) => sum + Math.max(0, number(section.bars, section.chords?.length || section.lyricEvents?.length || 0)), 0);
  const viewHas = key => !!Views.viewOptions(state.view)[key];

  function showPosition(position) {
    $('position').textContent = `Measure ${position.measure} · Beat ${position.beat}`;
  }
  function highlight(scroll = false) {
    document.querySelectorAll('.measure.active').forEach(element => element.classList.remove('active'));
    const measure = document.querySelector(`.measure[data-number="${state.active}"]`);
    if (measure) {
      measure.classList.add('active');
      if (scroll) measure.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
  function clearChart(message = 'Choose a song or open a JSON file to begin.') {
    player.pause();
    state.chart = null;
    state.active = 1;
    $('chart').replaceChildren();
    $('chart').append(node('div', 'empty'));
    $('chart').firstChild.append(node('h2', '', 'Your chart begins here'), node('p', '', 'Choose a published song above, or open a chart JSON from your device.'));
    $('message').textContent = message;
    document.body.classList.remove('loaded');
    for (const id of ['play', 'reset', 'tempo', 'metronome', 'view', 'theme', 'print']) $(id).disabled = true;
    showPosition({ measure: 1, beat: 1 });
  }
  function prepareChart(chart, description) {
    if (!validData(chart)) throw new Error('This is not a schema-v5 Song Chart JSON file.');
    const count = barCount(chart);
    if (!count || count > 2000) throw new Error('The chart must contain between 1 and 2000 measures.');
    player.pause();
    state.chart = chart;
    state.active = 1;
    state.view = Views.normalizeView(chart.layout?.musicianView || 'vocal');
    state.theme = ['1', '2', '4'].includes(String(chart.layout?.previewLineMode)) ? String(chart.layout.previewLineMode) : '2';
    $('view').value = state.view;
    $('theme').value = state.theme;
    $('tempo').value = window.SongChartPractice.parseTempo(chart.tempo);
    $('message').textContent = `${chart.artist || 'Unknown artist'} · ${chart.title || 'Untitled song'} · ${count} measures · ${description}`;
    document.body.classList.add('loaded');
    for (const id of ['play', 'reset', 'tempo', 'metronome', 'view', 'theme', 'print']) $(id).disabled = false;
    player.configure({ bpm: $('tempo').value, beatsPerMeasure: meterBeats(chart), totalMeasures: count });
    player.reset();
    updateInstruments();
    render();
  }
  function updateInstruments() {
    const instruments = new Set();
    state.chart?.sections.forEach(section => section.scoreSnippets?.forEach(snippet => { if (snippet.instrument) instruments.add(String(snippet.instrument)); }));
    $('instrument').replaceChildren(node('option', '', 'All instruments'));
    $('instrument').firstChild.value = '';
    [...instruments].sort().forEach(value => { const option = node('option', '', value); option.value = value; $('instrument').append(option); });
    $('instrumentWrap').hidden = state.view !== 'specialist' || instruments.size === 0;
  }
  function positionedEvents(container, events, beats, className, columns = 2) {
    if (!Array.isArray(events)) return;
    const isLyric = className === 'lyric-event' || className === 'backing-event';
    const words = isLyric ? events.reduce((out, event) => {
      if (!event || typeof event.text !== 'string') return out;
      const previous = out.at(-1);
      if (previous && previous.continues) { previous.text += event.text.replace(/-/g, '').trim(); previous.continues = /-$/.test(event.text); }
      else out.push({ text: event.text.replace(/-/g, ''), onset: event.onset, continues: /-$/.test(event.text) });
      return out;
    }, []) : events;
    let arranged = words;
    if (isLyric && words.length) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const fontPx = className === 'backing-event' ? 10.7 : 11.5;
      context.font = `500 ${fontPx}px Arial`;
      const widthPx = (182 / columns - (columns - 1) * 3.7 / columns - 1) * 96 / 25.4;
      const width = (value, scale = 1) => context.measureText(value).width * scale / widthPx * 100;
      const fit = Views.singleLineLayout(words, (value, scale) => width(value, scale), { beats, wordGap: width(' '), minScale: .92 });
      arranged = fit.events;
    }
    for (const event of arranged) {
      if (!event || typeof event.text !== 'string') continue;
      const onset = event.onset;
      const beat = onset && number(onset.denominator, 0) > 0 ? number(onset.numerator, 0) / number(onset.denominator, 1) : 0;
      const span = node('span', `event ${className}${/^_+$/.test(event.text) ? ' continuation' : ''}`, event.text.replace(/-/g, ''));
      span.style.setProperty('--left', `${Math.max(0, Math.min(97, event.displayLeftPercent ?? beat / beats * 100))}%`);
      if (isLyric) span.style.setProperty('--top', `${Math.max(0, event.track || 0) * 4.8}mm`);
      container.append(span);
    }
  }
  function addMeasure(row, section, index, numberInSong, beats) {
    const measure = node('div', 'measure');
    measure.dataset.number = String(numberInSong);
    measure.tabIndex = 0;
    measure.setAttribute('role', 'button');
    measure.setAttribute('aria-label', `Start practice at measure ${numberInSong}`);
    const seek = () => { player.seek(numberInSong); highlight(true); };
    measure.addEventListener('click', seek);
    measure.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); seek(); } });
    measure.append(node('span', 'measure-number', `${section.approximate ? '≈' : ''}${numberInSong}`));
    const ruler = node('div', 'beat-ruler');
    ruler.setAttribute('aria-hidden', 'true');
    // One tick at each quarter-note boundary, including both ends of the bar.
    // Positions are percentages of the same ruler width, so every full quarter
    // occupies exactly the same visual distance at any screen or print size.
    for (let beat = 0; beat <= Math.ceil(beats); beat++) {
      const tick = node('i', 'beat-tick');
      tick.style.left = `${Math.min(100, beat / beats * 100)}%`;
      ruler.append(tick);
    }
    measure.append(ruler);
    const chords = node('div', 'chords');
    if (viewHas('chords')) {
      const events = section.chordEvents?.[index];
      if (Array.isArray(events) && events.length) positionedEvents(chords, events, beats, 'chord-event');
      else chords.textContent = section.chords?.[index] || '—';
      measure.append(chords);
    }
    if (viewHas('lyrics')) {
      const lyrics = node('div', 'lyrics');
      const events = section.lyricEvents?.[index];
      if (Array.isArray(events) && events.length) positionedEvents(lyrics, events, beats, 'lyric-event', Number(row.style.getPropertyValue('--columns')) || 2);
      else lyrics.textContent = section.lyrics?.[index] || '';
      measure.append(lyrics);
    }
    if (viewHas('backing')) {
      const backing = node('div', 'backing');
      positionedEvents(backing, section.backingVocalEvents?.[index], beats, 'backing-event');
      if (backing.childNodes.length) measure.append(backing);
    }
    if (viewHas('snippets')) {
      const snippet = section.scoreSnippets?.find(item => item.inline && number(item.startBar, 0) === index + 1 && number(item.endBar, 0) === index + 1 && (!$('instrument').value || !item.instrument || item.instrument === $('instrument').value));
      if (snippet && /^data:image\/(png|jpeg|webp);base64,/.test(snippet.image || '')) { const img = node('img', 'snippet'); img.src = snippet.image; img.alt = snippet.title || 'Score snippet'; measure.append(img); }
    }
    row.append(measure);
  }
  function render() {
    const chart = state.chart;
    if (!chart) return;
    const output = $('chart');
    output.replaceChildren();
    output.className = `chart view-${state.view}`;
    const page = node('article', 'page');
    const head = node('header', 'chart-head');
    const title = node('div');
    title.append(node('h2', '', chart.title || 'Untitled song'), node('p', '', chart.artist || ''));
    const meta = node('div', 'meta');
    meta.append(node('p', '', [chart.key, chart.meter, chart.tempo && `${chart.tempo} BPM`].filter(Boolean).join(' · ')), node('p', '', chart.version || ''));
    head.append(title, meta);
    page.append(head);
    const beats = Views.meterInfo(chart.meter).quarterBeats || 4;
    const columns = state.theme === '1' ? 1 : state.theme === '4' && ['instrumental', 'specialist'].includes(state.view) ? 4 : 2;
    let n = 1;
    for (const section of chart.sections) {
      const count = Math.max(0, number(section.bars, section.chords?.length || section.lyricEvents?.length || 0));
      if (!count) continue;
      const container = node('section', 'section');
      const heading = node('div', 'section-heading');
      heading.append(node('h3', '', section.name || 'Section'), node('small', '', `${count} measures`));
      container.append(heading);
      if (section.cue) container.append(node('p', 'section-cue', section.cue));
      for (let i = 0; i < count; i += columns) {
        const row = node('div', 'row');
        row.style.setProperty('--columns', String(columns));
        for (let j = i; j < Math.min(count, i + columns); j++) addMeasure(row, section, j, n++, beats);
        container.append(row);
      }
      if (viewHas('snippets')) for (const snippet of section.scoreSnippets || []) {
        if (snippet.inline || !/^data:image\/(png|jpeg|webp);base64,/.test(snippet.image || '')) continue;
        if ($('instrument').value && snippet.instrument && snippet.instrument !== $('instrument').value) continue;
        const block = node('div', 'snippet-block');
        block.append(node('strong', '', snippet.title || 'Score snippet'));
        const img = node('img'); img.src = snippet.image; img.alt = snippet.title || 'Score snippet'; block.append(img);
        if (snippet.caption) block.append(node('p', '', snippet.caption));
        container.append(block);
      }
      page.append(container);
    }
    output.append(page);
    highlight();
  }
  async function loadCatalog() {
    try {
      const response = await fetch('catalog.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
      const catalog = await response.json();
      if (!Array.isArray(catalog)) throw new Error('Invalid catalog');
      for (const item of catalog) {
        if (!/^songs\/\d+\.json$/.test(item.file)) continue;
        const option = node('option', '', `${item.artist} — ${item.title}`);
        option.value = item.file;
        $('songSelect').append(option);
      }
    } catch (error) { $('message').textContent = `The song list could not load: ${error.message}`; }
  }
  $('songSelect').addEventListener('change', async event => {
    const file = event.target.value;
    const request = ++state.loading;
    if (!file) { clearChart(); return; }
    $('message').textContent = 'Loading chart…';
    try {
      const response = await fetch(file);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const chart = await response.json();
      if (request === state.loading) prepareChart(chart, 'published chart');
    } catch (error) { if (request === state.loading) clearChart(`Could not load this chart: ${error.message}`); }
  });
  $('localFile').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    ++state.loading;
    $('songSelect').value = '';
    try { prepareChart(JSON.parse(await file.text()), `local file: ${file.name}`); }
    catch (error) { clearChart(`Could not open the JSON: ${error.message}`); }
    event.target.value = '';
  });
  $('view').addEventListener('change', () => { state.view = Views.normalizeView($('view').value); player.pause(); updateInstruments(); render(); });
  $('theme').addEventListener('change', () => { state.theme = $('theme').value; render(); });
  $('instrument').addEventListener('change', render);
  $('zoom').addEventListener('input', () => { $('chart').style.setProperty('--zoom', String(number($('zoom').value, 100) / 100)); $('zoomValue').textContent = `${$('zoom').value}%`; });
  $('play').addEventListener('click', () => player.getState().playing ? player.pause() : player.start());
  $('reset').addEventListener('click', () => player.reset());
  $('tempo').addEventListener('change', () => { player.setTempo($('tempo').value); $('tempo').value = player.getState().bpm; });
  $('metronome').addEventListener('change', () => player.setMetronome($('metronome').checked));
  $('print').addEventListener('click', () => { player.pause(); window.print(); });
  clearChart();
  loadCatalog();
})();
