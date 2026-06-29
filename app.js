const APP_DATA = {
  modes:{
    current:"Entre les valeurs dans l'ordre ou l'appareil les affiche. Le retour se met a jour a chaque champ.",
    strip:"Lecture de bandelette par photo : selectionne une pastille, puis les couleurs de reference visibles sur la meme image."
  },
  meter:{
    info:{
      title:"COMMENT UTILISER",
      icon:"info",
      paragraphs:[
        "Le canal <strong>FAC</strong> de cet appareil est calibre chlore, pas brome. La cible 1,3-2,2 ppm correspond a un brome reel de 3-5 ppm via la conversion FAC x 2,25.",
        "Les canaux chlore et ORP peuvent varier selon l'appareil. Traite ces valeurs comme indicatives et recoupe-les de temps en temps avec une bandelette brome."
      ]
    },
    rowsLabel:"Parametres de l'eau",
    derivedTitle:"Valeurs calculees",
    derivedLabel:"Valeurs indirectes",
    summaryAria:"Synthese des valeurs",
    resetLabel:"Reinitialiser",
    copy:{
      unitFallback:"unite",
      emptyValue:"-",
      emptyAction:"Renseigne la valeur pour obtenir une recommandation.",
      defaultOkAction:"Eau dans la cible - rien a faire.",
      defaultLowAction:"Valeur basse - surveille et reteste prochainement.",
      defaultHighAction:"Valeur haute - surveille et reteste prochainement.",
      summaryOk:"OK",
      summaryWarn:"limite",
      summaryBad:"hors cible",
      summaryEmpty:"a renseigner",
      statusEmpty:"-",
      statusLow:"Bas",
      statusLowWarn:"Bas (limite)",
      statusHigh:"Haut",
      statusHighWarn:"Haut (limite)",
      statusOk:"OK",
      derived:{
        bromeLow:"Sous la cible (3-5 ppm) - ajoute une pastille ou augmente le dosage.",
        bromeHigh:"Au-dessus de la cible (3-5 ppm) - reduis le dosage.",
        bromeOk:"Dans la cible (3-5 ppm).",
        saltShareOver:"Le sel depasse le TDS total : verifie les deux lectures sur l'appareil.",
        saltShareLow:"Le TDS vient surtout de residus autres que le sel. Une vidange clarifie l'eau si ca persiste.",
        saltShareOk:"Le TDS reflete surtout le sel dissous, peu de residus organiques.",
        saltConsOk:"Coherent avec la lecture en ppm.",
        saltConsWarn:"Ecart avec la lecture en ppm - probablement un arrondi de l'appareil."
      }
    },
    params:[
      { id:'ph', order:1, label:'pH', unit:'', min:7.2, max:7.6, softMax:7.8, displayMin:6.0, displayMax:9.0, step:'0.01', placeholder:'7,40',
        actionOk:"Eau dans la cible - rien a faire.",
        actionLow:"Ajoute du pH+ par petites doses, laisse circuler 1 a 2 h, puis reteste.",
        actionHigh:"Ajoute du pH- par petites doses, laisse circuler 1 a 2 h, puis reteste.",
        actionWarnHigh:"Limite haute : surveille. Une petite dose de pH- suffit souvent a le ramener sous 7,6." },
      { id:'ec', order:2, label:'Conductivite', unit:'uS/cm', min:250, max:1000, displayMin:0, displayMax:1500, step:'1', placeholder:'650',
        actionOk:"Eau dans la cible - rien a faire.",
        actionLow:"Rarement genant en soi. Verifie juste que ce n'est pas lie a un remplissage recent.",
        actionHigh:"Eau chargee en mineraux dissous. Une vidange partielle suivie d'un appoint d'eau claire fait redescendre la conductivite." },
      { id:'tds', order:3, label:'TDS', unit:'ppm', min:0, max:1000, displayMin:0, displayMax:1500, step:'1', placeholder:'520',
        actionOk:"Eau dans la cible - rien a faire.",
        actionHigh:"TDS eleve : programme une vidange partielle, ou totale si l'eau a plus de 3 mois." },
      { id:'selppm', order:4, label:'Sel', unit:'ppm', min:0, max:500, displayMin:0, displayMax:800, step:'1', placeholder:'180',
        actionOk:"Eau dans la cible - rien a faire.",
        actionHigh:"Taux de sel eleve pour un usage sans electrolyseur. Une vidange partielle dilue le taux." },
      { id:'selpct', order:5, label:'Sel', unit:'%', min:0, max:0.05, displayMin:0, displayMax:0.08, step:'0.001', placeholder:'0,018',
        actionOk:"Eau dans la cible - rien a faire.",
        actionHigh:"Meme lecture que le sel en ppm : vidange partielle si ca reste eleve." },
      { id:'orp', order:6, label:'ORP', unit:'mV', min:400, max:500, displayMin:0, displayMax:700, step:'1', placeholder:'450',
        actionOk:"Pouvoir desinfectant correct - rien a faire.",
        actionLow:"Pouvoir desinfectant insuffisant. Augmente la dose de brome ; si ca reste bas apres 24 h, fais un choc oxydant non chlore.",
        actionHigh:"Eau tres oxydee, rarement genant. Laisse le taux redescendre avant la prochaine baignade." },
      { id:'fac', order:7, label:'FAC', unit:'ppm', min:1.3, max:2.2, displayMin:0, displayMax:3.5, step:'0.01', placeholder:'1,80',
        note:'Canal chlore - brome reel environ FAC x 2,25',
        actionOk:"Brome reel dans la cible - rien a faire.",
        actionLow:"Brome reel sous la cible. Ajoute une pastille ou augmente le dosage, puis reteste dans quelques heures.",
        actionHigh:"Brome reel au-dessus de la cible. Reduis le dosage et attends avant de te baigner." }
    ],
    derived:[
      { id:'bromereal', label:'Brome reel estime', emptyValue:'-', emptyNote:'Renseigne le FAC pour estimer le brome reel (FAC x 2,25).' },
      { id:'saltshare', label:'Part du sel dans le TDS', emptyValue:'-', emptyNote:"Renseigne le sel (ppm) et le TDS pour voir la composition de l'eau." },
      { id:'saltcons', label:'Coherence sel ppm / %', emptyValue:'-', emptyNote:'Renseigne les deux lectures de sel pour verifier leur coherence.' }
    ]
  },
  strip:{
    parameters:[
      { id:'ph', label:'pH', unit:'', references:['6.8','7.2','7.6','8.0'] },
      { id:'brome', label:'Brome', unit:'ppm', references:['0','1','3','5','10'] },
      { id:'alcalinite', label:'Alcalinite', unit:'ppm', references:['40','80','120','180','240'] },
      { id:'durete', label:'Durete', unit:'ppm', references:['0','100','250','500'] },
      { id:'stabilisant', label:'Stabilisant', unit:'ppm', references:['0','30','50','100'] }
    ],
    copy:{
      title:"Lecture de bandelette",
      intro:"Importe une photo ou la bandelette et la gamme couleur sont visibles. Trace une zone sur la pastille, puis une zone sur chaque reference.",
      upload:"Importer une photo",
      sampleMode:"Selection bandelette",
      referenceMode:"Selection gamme",
      analyze:"Analyser",
      clear:"Effacer les zones",
      noImage:"Importe une photo pour commencer. La comparaison se fait uniquement entre couleurs de la meme image.",
      drawHint:"Glisse sur l'image pour tracer un rectangle. Utilise une zone au centre des couleurs, sans bord ni reflet.",
      sampleMissing:"Selectionne d'abord une zone sur la bandelette.",
      refsMissing:"Selectionne au moins deux cases de reference pour comparer.",
      noResult:"Les resultats apparaitront ici apres analyse.",
      closeTo:"proche de",
      between:"probablement entre",
      confidence:"Ecart Delta E"
    }
  }
};

const state = {
  mode:'current',
  strip:{
    image:null,
    imageName:'',
    displayScale:1,
    activeTool:'sample',
    activeParam:'ph',
    activeReference:'6.8',
    drag:null,
    zones:{}
  }
};

const appContent = document.getElementById('app-content');
const modeSwitch = document.getElementById('mode-switch');
const modeDescription = document.getElementById('mode-description');

function render(){
  if (state.mode === 'strip') renderStripMode();
  else renderMeterMode();
  setDisplayMode(state.mode);
}

function setDisplayMode(mode){
  const nextMode = mode === 'strip' ? 'strip' : 'current';
  state.mode = nextMode;
  document.body.dataset.displayMode = nextMode;
  modeSwitch.setAttribute('aria-pressed', nextMode === 'strip' ? 'true' : 'false');
  modeSwitch.setAttribute('aria-label', nextMode === 'strip' ? "Revenir au mode YUMKI" : "Passer en mode lecture de bandelette");
  modeDescription.textContent = APP_DATA.modes[nextMode];
}

modeSwitch.addEventListener('click', () => {
  state.mode = state.mode === 'strip' ? 'current' : 'strip';
  render();
});

function clampPct(v, lo, hi){
  const pct = ((v - lo) / (hi - lo)) * 100;
  return Math.max(0, Math.min(100, pct));
}

function parseValue(str){
  if (!str) return null;
  const cleaned = str.replace(',', '.').trim();
  if (cleaned === '') return null;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

function renderMeterMode(){
  const data = APP_DATA.meter;
  appContent.innerHTML = `
    <details class="info">
      <summary><span class="material-symbols-outlined" aria-hidden="true">${data.info.icon}</span>${data.info.title}</summary>
      ${data.info.paragraphs.map(text => `<p>${text}</p>`).join('')}
    </details>
    <section class="rows" id="rows" aria-label="${data.rowsLabel}"></section>
    <h2 class="derived-title">${data.derivedTitle}</h2>
    <section class="derived" id="derived" aria-label="${data.derivedLabel}">
      ${data.derived.map(item => `
        <div class="drow">
          <div class="drow-top">
            <span class="dlabel">${item.label}</span>
            <span class="dvalue" id="dval-${item.id}">${item.emptyValue}</span>
          </div>
          <p class="dnote" id="dnote-${item.id}">${item.emptyNote}</p>
        </div>
      `).join('')}
    </section>
    <p class="summary" id="summary" aria-live="polite" aria-label="${data.summaryAria}"></p>
    <button class="reset" id="reset" type="button">${data.resetLabel}</button>
  `;
  initMeter();
}

function fmtTarget(p){
  const fmt = n => Number.isInteger(n) ? n : n.toString().replace('.', ',');
  if (p.min === 0 && p.max !== undefined && p.softMax === undefined && p.id !== 'selpct') return `cible < ${fmt(p.max)}`;
  return `cible ${fmt(p.min)}-${fmt(p.max)}`;
}

function statusFor(p, value){
  const copy = APP_DATA.meter.copy;
  if (value === null) return { state:'empty', text:copy.statusEmpty, dir:null };
  if (value < p.min){
    if (p.softMin !== undefined && value >= p.softMin) return { state:'warn', text:copy.statusLowWarn, dir:'low' };
    return { state:'bad', text:copy.statusLow, dir:'low' };
  }
  if (value > p.max){
    if (p.softMax !== undefined && value <= p.softMax) return { state:'warn', text:copy.statusHighWarn, dir:'high' };
    return { state:'bad', text:copy.statusHigh, dir:'high' };
  }
  return { state:'ok', text:copy.statusOk, dir:null };
}

function actionFor(p, status){
  const copy = APP_DATA.meter.copy;
  if (status.state === 'empty') return copy.emptyAction;
  if (status.state === 'ok') return p.actionOk || copy.defaultOkAction;
  if (status.dir === 'low'){
    if (status.state === 'warn' && p.actionWarnLow) return p.actionWarnLow;
    return p.actionLow || copy.defaultLowAction;
  }
  if (status.state === 'warn' && p.actionWarnHigh) return p.actionWarnHigh;
  return p.actionHigh || copy.defaultHighAction;
}

function initMeter(){
  const rowsEl = document.getElementById('rows');
  const summaryEl = document.getElementById('summary');
  const resetBtn = document.getElementById('reset');
  const params = APP_DATA.meter.params;
  const copy = APP_DATA.meter.copy;
  rowsEl.innerHTML = params.map(p => {
    const zoneLeft = clampPct(p.min, p.displayMin, p.displayMax);
    const zoneRight = clampPct(p.max, p.displayMin, p.displayMax);
    const zoneWidth = zoneRight - zoneLeft;
    return `
      <div class="row" data-id="${p.id}">
        <div class="row-top">
          <div class="row-id"><span class="order">${p.order}</span><span class="label">${p.label}</span></div>
          <span class="target">${fmtTarget(p)}</span>
        </div>
        <div class="input-line">
          <input class="value" id="input-${p.id}" type="text" inputmode="decimal" placeholder="${p.placeholder}" aria-label="${p.label} en ${p.unit || copy.unitFallback}">
          <span class="unit">${p.unit}</span>
        </div>
        <div class="gauge">
          <div class="zone" style="left:${zoneLeft}%; width:${zoneWidth}%;"></div>
          <div class="marker" id="marker-${p.id}"></div>
        </div>
        <div class="row-bottom">
          <p class="note">${p.note || ''}</p>
          <span class="badge empty" id="badge-${p.id}">${copy.emptyValue}</span>
        </div>
        <p class="action empty" id="action-${p.id}">${copy.emptyAction}</p>
      </div>
    `;
  }).join('');

  function updateRow(p){
    const input = document.getElementById(`input-${p.id}`);
    const marker = document.getElementById(`marker-${p.id}`);
    const badge = document.getElementById(`badge-${p.id}`);
    const action = document.getElementById(`action-${p.id}`);
    const value = parseValue(input.value);
    const status = statusFor(p, value);
    badge.textContent = status.text;
    badge.className = `badge ${status.state}`;
    action.textContent = actionFor(p, status);
    action.className = `action ${status.state}`;
    if (value === null){
      marker.style.opacity = '0';
    } else {
      marker.style.left = `${clampPct(value, p.displayMin, p.displayMax)}%`;
      marker.style.opacity = '1';
      marker.style.backgroundColor = status.state === 'ok' ? 'var(--ok)' : status.state === 'warn' ? 'var(--warn)' : 'var(--bad)';
    }
  }

  function updateSummary(){
    const counts = { ok:0, warn:0, bad:0, empty:0 };
    params.forEach(p => {
      const value = parseValue(document.getElementById(`input-${p.id}`).value);
      counts[statusFor(p, value).state]++;
    });
    summaryEl.innerHTML =
      `<span class="ok">${counts.ok} ${copy.summaryOk}</span> - ` +
      `<span class="warn">${counts.warn} ${copy.summaryWarn}</span> - ` +
      `<span class="bad">${counts.bad} ${copy.summaryBad}</span> - ` +
      `<b>${counts.empty}</b> ${copy.summaryEmpty}`;
  }

  function updateDerived(){
    const derived = Object.fromEntries(APP_DATA.meter.derived.map(item => [item.id, item]));
    const dcopy = copy.derived;
    const fac = parseValue(document.getElementById('input-fac').value);
    const selppm = parseValue(document.getElementById('input-selppm').value);
    const selpct = parseValue(document.getElementById('input-selpct').value);
    const tds = parseValue(document.getElementById('input-tds').value);
    setDerived('bromereal', derived.bromereal.emptyValue, derived.bromereal.emptyNote, '');
    if (fac !== null){
      const real = fac * 2.25;
      setDerived('bromereal', `${real.toFixed(2).replace('.', ',')} ppm`, real < 3 ? dcopy.bromeLow : real > 5 ? dcopy.bromeHigh : dcopy.bromeOk, real < 3 || real > 5 ? 'bad' : 'ok');
    }
    setDerived('saltshare', derived.saltshare.emptyValue, derived.saltshare.emptyNote, '');
    if (selppm !== null && tds !== null && tds !== 0){
      const share = (selppm / tds) * 100;
      setDerived('saltshare', `${share.toFixed(0)} %`, share > 100 ? dcopy.saltShareOver : share < 30 ? dcopy.saltShareLow : dcopy.saltShareOk, share > 100 ? 'warn' : share < 30 ? '' : 'ok');
    }
    setDerived('saltcons', derived.saltcons.emptyValue, derived.saltcons.emptyNote, '');
    if (selppm !== null && selpct !== null){
      const expectedPct = selppm / 10000;
      const diff = Math.abs(selpct - expectedPct);
      const tolerance = Math.max(0.003, expectedPct * 0.15);
      setDerived('saltcons', `${expectedPct.toFixed(3).replace('.', ',')} % attendu`, diff <= tolerance ? dcopy.saltConsOk : dcopy.saltConsWarn, diff <= tolerance ? 'ok' : 'warn');
    }
  }

  function setDerived(id, value, note, stateClass){
    document.getElementById(`dval-${id}`).textContent = value;
    const noteEl = document.getElementById(`dnote-${id}`);
    noteEl.textContent = note;
    noteEl.className = `dnote ${stateClass}`.trim();
  }

  params.forEach(p => {
    const input = document.getElementById(`input-${p.id}`);
    input.addEventListener('input', () => { updateRow(p); updateSummary(); updateDerived(); });
    updateRow(p);
  });
  updateSummary();
  updateDerived();

  resetBtn.addEventListener('click', () => {
    params.forEach(p => {
      document.getElementById(`input-${p.id}`).value = '';
      updateRow(p);
    });
    updateSummary();
    updateDerived();
  });
}

function renderStripMode(){
  const strip = APP_DATA.strip;
  const activeParam = getActiveParam();
  appContent.innerHTML = `
    <section class="strip-app">
      <div class="strip-panel">
        <h2 class="strip-panel-title"><span class="material-symbols-outlined" aria-hidden="true">add_a_photo</span>${strip.copy.title}</h2>
        <p class="strip-copy">${strip.copy.intro}</p>
        <div class="strip-toolbar">
          <label class="file-button" for="strip-upload"><span class="material-symbols-outlined" aria-hidden="true">photo_library</span>${strip.copy.upload}</label>
          <input class="file-input" id="strip-upload" type="file" accept="image/*" capture="environment">
        </div>
        <div class="canvas-shell" id="canvas-shell">
          <canvas id="strip-canvas"></canvas>
          <div class="canvas-empty" id="canvas-empty">${strip.copy.noImage}</div>
        </div>
        <p class="canvas-hint">${strip.copy.drawHint}</p>
      </div>
      <div class="strip-panel">
        <h2 class="strip-panel-title"><span class="material-symbols-outlined" aria-hidden="true">science</span>Zones</h2>
        <div class="mode-pills">
          <button class="mode-pill ${state.strip.activeTool === 'sample' ? 'active' : ''}" data-tool="sample" type="button">${strip.copy.sampleMode}</button>
          <button class="mode-pill ${state.strip.activeTool === 'reference' ? 'active' : ''}" data-tool="reference" type="button">${strip.copy.referenceMode}</button>
        </div>
        <h3 class="derived-title">Parametre</h3>
        <div class="param-tabs">
          ${strip.parameters.map(p => `<button class="param-button ${p.id === state.strip.activeParam ? 'active' : ''}" data-param="${p.id}" type="button">${p.label}</button>`).join('')}
        </div>
        <h3 class="derived-title">References ${activeParam.label}</h3>
        <div class="ref-list">
          ${activeParam.references.map(value => renderReferenceButton(activeParam, value)).join('')}
        </div>
      </div>
      <div class="strip-panel strip-panel-wide">
        <h2 class="strip-panel-title"><span class="material-symbols-outlined" aria-hidden="true">analytics</span>Analyse</h2>
        <div class="strip-actions">
          <button class="primary-action" id="analyze-strip" type="button">${strip.copy.analyze}</button>
          <button class="secondary-action" id="clear-strip" type="button">${strip.copy.clear}</button>
        </div>
        <div class="zone-list" id="zone-list"></div>
        <div class="result-list" id="strip-results"><div class="result-card"><p>${strip.copy.noResult}</p></div></div>
      </div>
    </section>
  `;
  initStrip();
}

function getActiveParam(){
  return APP_DATA.strip.parameters.find(p => p.id === state.strip.activeParam) || APP_DATA.strip.parameters[0];
}

function getParamState(paramId){
  if (!state.strip.zones[paramId]) state.strip.zones[paramId] = { sample:null, references:{} };
  return state.strip.zones[paramId];
}

function renderReferenceButton(param, value){
  const zone = getParamState(param.id).references[value];
  const style = zone?.color ? `style="background:rgb(${zone.color.r}, ${zone.color.g}, ${zone.color.b})"` : '';
  const active = value === state.strip.activeReference && state.strip.activeTool === 'reference';
  return `<button class="ref-button ${active ? 'active' : ''}" data-ref="${value}" type="button"><span>${value}${param.unit ? ` ${param.unit}` : ''}</span><span class="swatch" ${style}></span></button>`;
}

function initStrip(){
  const upload = document.getElementById('strip-upload');
  const canvas = document.getElementById('strip-canvas');
  const shell = document.getElementById('canvas-shell');
  const ctx = canvas.getContext('2d', { willReadFrequently:true });
  upload.addEventListener('change', event => loadStripImage(event.target.files?.[0]));
  document.querySelectorAll('.mode-pill').forEach(btn => btn.addEventListener('click', () => {
    state.strip.activeTool = btn.dataset.tool;
    renderStripMode();
  }));
  document.querySelectorAll('.param-button').forEach(btn => btn.addEventListener('click', () => {
    state.strip.activeParam = btn.dataset.param;
    state.strip.activeReference = getActiveParam().references[0];
    renderStripMode();
  }));
  document.querySelectorAll('.ref-button').forEach(btn => btn.addEventListener('click', () => {
    state.strip.activeTool = 'reference';
    state.strip.activeReference = btn.dataset.ref;
    renderStripMode();
  }));
  document.getElementById('analyze-strip').addEventListener('click', analyzeStrip);
  document.getElementById('clear-strip').addEventListener('click', () => {
    state.strip.zones = {};
    drawStripCanvas();
    renderStripSideData();
  });
  shell.addEventListener('pointerdown', startSelection);
  shell.addEventListener('pointermove', moveSelection);
  shell.addEventListener('pointerup', endSelection);
  shell.addEventListener('pointercancel', cancelSelection);
  drawStripCanvas();
  renderStripSideData();

  function loadStripImage(file){
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        state.strip.image = img;
        state.strip.imageName = file.name;
        state.strip.zones = {};
        drawStripCanvas();
        renderStripSideData();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function canvasPoint(event){
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x:Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * scaleX)),
      y:Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * scaleY))
    };
  }

  function startSelection(event){
    if (!state.strip.image) return;
    event.preventDefault();
    shell.setPointerCapture(event.pointerId);
    const point = canvasPoint(event);
    state.strip.drag = { start:point, current:point };
  }

  function moveSelection(event){
    if (!state.strip.drag) return;
    event.preventDefault();
    state.strip.drag.current = canvasPoint(event);
    drawStripCanvas();
  }

  function endSelection(event){
    if (!state.strip.drag) return;
    event.preventDefault();
    state.strip.drag.current = canvasPoint(event);
    const rect = normalizeRect(state.strip.drag.start, state.strip.drag.current);
    state.strip.drag = null;
    if (rect.w < 6 || rect.h < 6){
      drawStripCanvas();
      return;
    }
    const color = averageColor(ctx, rect);
    const paramState = getParamState(state.strip.activeParam);
    const zone = { ...rect, color, lab:rgbToLab(color.r, color.g, color.b) };
    if (state.strip.activeTool === 'sample') paramState.sample = zone;
    else paramState.references[state.strip.activeReference] = zone;
    drawStripCanvas();
    renderStripSideData();
  }

  function cancelSelection(){
    state.strip.drag = null;
    drawStripCanvas();
  }
}

function normalizeRect(a, b){
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w:Math.abs(a.x - b.x), h:Math.abs(a.y - b.y) };
}

function drawStripCanvas(){
  const canvas = document.getElementById('strip-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { willReadFrequently:true });
  const empty = document.getElementById('canvas-empty');
  if (!state.strip.image){
    canvas.width = 640;
    canvas.height = 380;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (empty) empty.style.display = 'grid';
    return;
  }
  if (empty) empty.style.display = 'none';
  const maxWidth = 1400;
  const scale = Math.min(1, maxWidth / state.strip.image.naturalWidth);
  canvas.width = Math.round(state.strip.image.naturalWidth * scale);
  canvas.height = Math.round(state.strip.image.naturalHeight * scale);
  state.strip.displayScale = scale;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(state.strip.image, 0, 0, canvas.width, canvas.height);
  drawAllZones(ctx);
  if (state.strip.drag){
    drawRect(ctx, normalizeRect(state.strip.drag.start, state.strip.drag.current), '#B45309', 'Selection');
  }
}

function drawAllZones(ctx){
  Object.entries(state.strip.zones).forEach(([paramId, zones]) => {
    if (zones.sample) drawRect(ctx, zones.sample, '#0047AB', `${paramId} bandelette`);
    Object.entries(zones.references).forEach(([value, zone]) => drawRect(ctx, zone, '#006400', value));
  });
}

function drawRect(ctx, rect, color, label){
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.font = '700 15px Quicksand, sans-serif';
  const labelWidth = ctx.measureText(label).width + 12;
  ctx.fillRect(rect.x, Math.max(0, rect.y - 24), labelWidth, 22);
  ctx.fillStyle = color;
  ctx.fillText(label, rect.x + 6, Math.max(16, rect.y - 8));
  ctx.restore();
}

function averageColor(ctx, rect){
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const w = Math.max(1, Math.floor(rect.w));
  const h = Math.max(1, Math.floor(rect.h));
  const pixels = ctx.getImageData(x, y, w, h).data;
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < pixels.length; i += 4){
    const pr = pixels[i], pg = pixels[i + 1], pb = pixels[i + 2], pa = pixels[i + 3];
    const max = Math.max(pr, pg, pb);
    const min = Math.min(pr, pg, pb);
    if (pa < 220) continue;
    if (max > 248 && min > 235) continue;
    if (max < 18) continue;
    r += pr; g += pg; b += pb; count++;
  }
  if (!count){
    for (let i = 0; i < pixels.length; i += 4){
      r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; count++;
    }
  }
  return { r:Math.round(r / count), g:Math.round(g / count), b:Math.round(b / count) };
}

function rgbToLab(r, g, b){
  const srgb = [r, g, b].map(v => {
    v /= 255;
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
  });
  let x = (srgb[0] * 0.4124 + srgb[1] * 0.3576 + srgb[2] * 0.1805) / 0.95047;
  let y = (srgb[0] * 0.2126 + srgb[1] * 0.7152 + srgb[2] * 0.0722) / 1.00000;
  let z = (srgb[0] * 0.0193 + srgb[1] * 0.1192 + srgb[2] * 0.9505) / 1.08883;
  [x, y, z] = [x, y, z].map(v => v > 0.008856 ? Math.cbrt(v) : (7.787 * v) + (16 / 116));
  return { l:(116 * y) - 16, a:500 * (x - y), b:200 * (y - z) };
}

function deltaE(lab1, lab2){
  return Math.sqrt(
    Math.pow(lab1.l - lab2.l, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

function renderStripSideData(){
  renderZoneList();
  drawStripCanvas();
}

function renderZoneList(){
  const list = document.getElementById('zone-list');
  if (!list) return;
  const items = [];
  APP_DATA.strip.parameters.forEach(param => {
    const zones = getParamState(param.id);
    if (zones.sample) items.push(zoneItemHtml(param.id, 'Bandelette', zones.sample));
    Object.entries(zones.references).forEach(([value, zone]) => items.push(zoneItemHtml(param.id, `${param.label} ${value}${param.unit ? ` ${param.unit}` : ''}`, zone, value)));
  });
  list.innerHTML = items.length ? items.join('') : '<div class="zone-item"><span>Aucune zone selectionnee pour le moment.</span></div>';
  list.querySelectorAll('.delete-zone').forEach(btn => btn.addEventListener('click', () => {
    const zones = getParamState(btn.dataset.param);
    if (btn.dataset.kind === 'sample') zones.sample = null;
    else delete zones.references[btn.dataset.ref];
    renderStripSideData();
  }));
}

function zoneItemHtml(paramId, label, zone, refValue = ''){
  const color = `rgb(${zone.color.r}, ${zone.color.g}, ${zone.color.b})`;
  return `
    <div class="zone-item">
      <span><strong>${label}</strong><span>RGB ${zone.color.r}, ${zone.color.g}, ${zone.color.b}</span></span>
      <span class="swatch" style="background:${color}"></span>
      <button class="delete-zone" type="button" data-param="${paramId}" data-kind="${refValue ? 'reference' : 'sample'}" data-ref="${refValue}" aria-label="Supprimer ${label}">
        <span class="material-symbols-outlined" aria-hidden="true">delete</span>
      </button>
    </div>
  `;
}

function analyzeStrip(){
  const resultsEl = document.getElementById('strip-results');
  const cards = [];
  APP_DATA.strip.parameters.forEach(param => {
    const zones = getParamState(param.id);
    if (!zones.sample){
      cards.push(resultCard(param.label, APP_DATA.strip.copy.sampleMissing));
      return;
    }
    const refs = Object.entries(zones.references);
    if (refs.length < 2){
      cards.push(resultCard(param.label, APP_DATA.strip.copy.refsMissing));
      return;
    }
    const ranked = refs
      .map(([value, zone]) => ({ value, distance:deltaE(zones.sample.lab, zone.lab) }))
      .sort((a, b) => a.distance - b.distance);
    const best = ranked[0];
    const second = ranked[1];
    const unit = param.unit ? ` ${param.unit}` : '';
    const close = Math.abs(second.distance - best.distance) <= Math.max(3, best.distance * 0.18);
    const phrase = close
      ? `${APP_DATA.strip.copy.between} ${best.value}${unit} et ${second.value}${unit}`
      : `${APP_DATA.strip.copy.closeTo} ${best.value}${unit}`;
    cards.push(resultCard(param.label, `${param.label} : ${phrase}`, `${APP_DATA.strip.copy.confidence} ${best.distance.toFixed(1)} / second ${second.distance.toFixed(1)}`));
  });
  resultsEl.innerHTML = cards.join('');
}

function resultCard(title, body, note = ''){
  return `<div class="result-card"><strong>${title}</strong><p>${body}</p>${note ? `<p>${note}</p>` : ''}</div>`;
}

const initialMode = new URLSearchParams(window.location.search).get('mode');
if (initialMode === 'strip') state.mode = 'strip';

render();
