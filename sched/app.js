const icons = {
calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
today:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18"/><circle cx="12" cy="16" r="2"/>',
moon:'<path d="M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z"/>',
search:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
sliders:'<path d="M4 7h8m4 0h4M4 17h4m4 0h8"/><circle cx="14" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2"/>',
left:'<path d="m14 6-6 6 6 6"/>',right:'<path d="m10 6 6 6-6 6"/>',
close:'<path d="m6 6 12 12M18 6 6 18"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',leaf:'<path d="M20 4C8 2 2 8 6 16s16 2 14-12ZM6 18 16 8"/>'};
const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.calendar}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=svg(el.dataset.icon));
const $ = id => document.getElementById(id);
const escapeHTML = text => String(text).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = {get(k,f=''){try{return localStorage.getItem(k)??f;}catch{return f;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
const paris = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'});
const dayKey = value => paris.format(new Date(value));
const clock = value => new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
// Civil dates are kept at UTC noon; calendar navigation is independent of device timezone.
const civil = key => new Date(key+'T12:00:00Z');
const keyOf = d => d.toISOString().slice(0,10);
const addDays = (key, n) => {const d=civil(key);d.setUTCDate(d.getUTCDate()+n);return keyOf(d);};
const monday = key => addDays(key,-((civil(key).getUTCDay()+6)%7));
const dateLabel = (key, options) => new Intl.DateTimeFormat('fr-FR',{timeZone:'UTC',...options}).format(civil(key));
const duration = events => events.reduce((sum,e)=>sum+(new Date(e.end)-new Date(e.start))/36e5,0);
const hours = n => {const min=Math.round(n*60);return `${Math.floor(min/60)}h${min%60?String(min%60).padStart(2,'0'):''}`;};
let selected=dayKey(new Date()), view='day', events=[], data=null, query='', group=store.get('campus-group','all'), nextEvent=null;
if(!['all','1','2'].includes(group))group='all';
let dark=store.get('campus-theme')==='dark';document.documentElement.dataset.theme=dark?'dark':'light';
$('english-group').value=group;
const activeEvents = () => events.filter(e=>(group==='all'||!e.englishGroup||String(e.englishGroup)===group)&&(!query||`${e.title} ${e.description} ${e.location}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query)));
const onDay = (list,key) => list.filter(e=>dayKey(e.start)===key || (e.allDay && dayKey(e.start)<=key && dayKey(new Date(new Date(e.end)-1))>=key));
function color(title){let h=0;for(const c of title)h=(h*31+c.charCodeAt(0))|0;return ['purple','green','peach','blue'][Math.abs(h)%4];}
function teacher(e){return [...new Set(e.description.split('\n').map(x=>x.trim()).filter(x=>x&&!/^M[12]\b|^Livrable|^Présence|^RDV|^\(Export/i.test(x)))].join(' · ');}
function openDetails(e){$('detail-content').innerHTML=`<span class="course-badge ${color(e.title)}">${e.englishGroup?'Anglais · Groupe '+e.englishGroup:'M2 EGEDD'}</span><h2>${escapeHTML(e.title)}</h2><div class="detail-row">${svg('calendar')}<span>${dateLabel(dayKey(e.start),{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span></div><div class="detail-row">${svg('clock')}<span>${e.allDay?'Toute la journée':`${clock(e.start)} — ${clock(e.end)} · ${hours(duration([e]))}`}</span></div><div class="detail-row">${svg('pin')}<span>${escapeHTML(e.location||'Salle non renseignée')}</span></div><div class="description">${escapeHTML(e.description||'Aucune information complémentaire.').replace(/\n/g,'<br>')}</div>`;$('details').showModal();}
function card(e){const ongoing=new Date(e.start)<=new Date()&&new Date(e.end)>new Date();return `<button class="course-card ${color(e.title)} ${ongoing?'ongoing':''}" data-event="${escapeHTML(e.id)}"><div class="card-top"><span class="course-badge">${e.englishGroup?'Groupe '+e.englishGroup:'M2 EGEDD'}</span><span class="card-duration">${ongoing?'<span class="live-dot"></span> En cours':hours(duration([e]))}</span></div><h3>${escapeHTML(e.title)}</h3><div class="card-meta"><span>${svg('pin')}${escapeHTML(e.location||'Salle à préciser')}</span>${teacher(e)?`<span>${svg('user')}${escapeHTML(teacher(e))}</span>`:''}</div><span class="card-arrow">↗</span></button>`;}
function render(){const visible=activeEvents(), weekStart=monday(selected), currentToday=dayKey(new Date()), week=visible.filter(e=>dayKey(e.start)>=weekStart&&dayKey(e.start)<addDays(weekStart,7));
$('month-label').textContent=dateLabel(selected,{month:'long',year:'numeric'});$('date-picker').value=selected;
$('week-hours').textContent=hours(duration(week));$('week-count').textContent=`${week.length} cours · semaine du ${dateLabel(weekStart,{day:'numeric',month:'short'})}`;
$('mini-bars').innerHTML=Array.from({length:5},(_,i)=>{const k=addDays(weekStart,i),n=duration(onDay(week,k));return `<div><span style="height:${Math.max(4,Math.min(46,n*6))}px" class="${k===selected?'current':''}"></span><small>${['L','M','M','J','V'][i]}</small></div>`;}).join('');
$('days').innerHTML=Array.from({length:7},(_,i)=>{const k=addDays(weekStart,i),count=onDay(visible,k).length;return `<button data-day="${k}" class="${k===selected?'selected':''} ${k===currentToday?'is-today':''}" aria-label="${dateLabel(k,{weekday:'long',day:'numeric',month:'long'})}, ${count} cours" aria-pressed="${k===selected}"><span>${dateLabel(k,{weekday:'short'}).replace('.','')}</span><b>${civil(k).getUTCDate()}</b><i class="${count?'has-courses':''}"></i></button>`;}).join('');
$('filter-notice').hidden=group==='all';$('filter-notice').textContent=`Anglais : groupe ${group} uniquement · autres cours inclus`;
const daily=onDay(visible,selected);
$('day-title').textContent=view==='day'?dateLabel(selected,{weekday:'long',day:'numeric',month:'long'}):`Semaine du ${dateLabel(weekStart,{day:'numeric',month:'long'})}`;
$('day-total').textContent=`${(view==='day'?daily:week).length} cours · ${hours(duration(view==='day'?daily:week))}`;
if(query){const matches=visible.filter(e=>new Date(e.end)>new Date()).slice(0,80);$('day-title').textContent='Résultats de recherche';$('day-total').textContent=`${matches.length} cours à venir`;$('schedule').innerHTML=matches.length?matches.map(e=>`<div class="search-result"><div class="result-date">${dateLabel(dayKey(e.start),{weekday:'short',day:'numeric',month:'short'})} · ${clock(e.start)}</div>${card(e)}</div>`).join(''):`<div class="empty">${svg('search')}<h3>Aucun cours trouvé</h3><p>Essaie une matière, un nom ou une salle.</p></div>`;
}else if(view==='day'){
let html='';daily.forEach((e,i)=>{if(i&&new Date(e.start)>new Date(daily[i-1].end)){const gap=(new Date(e.start)-new Date(daily[i-1].end))/36e5;if(gap>=.5)html+=`<div class="break"><span></span>${hours(gap)} de pause<span></span></div>`;}html+=`<div class="event-row"><div class="event-time"><b>${e.allDay?'Journée':clock(e.start)}</b><span>${e.allDay?'':clock(e.end)}</span></div>${card(e)}</div>`;});$('schedule').innerHTML=html||`<div class="empty">${svg('leaf')}<h3>${events.length?'Une journée sans cours.':'Aucun calendrier chargé'}</h3><p>${events.length?'Aucun cours dans le flux pour cette journée.':'Réessaie avec le bouton d’actualisation.'}</p>${events.length?'<button class="text-button" id="jump-next">Aller au prochain cours →</button>':''}</div>`;
}else{$('schedule').innerHTML=`<div class="week-grid">${Array.from({length:7},(_,i)=>{const k=addDays(weekStart,i),items=onDay(visible,k);return `<section class="week-column ${k===currentToday?'today-column':''}"><h3>${dateLabel(k,{weekday:'short',day:'numeric'})}<span>${hours(duration(items))}</span></h3>${items.map(e=>`<div class="week-event"><div class="week-time">${clock(e.start)} — ${clock(e.end)}</div>${card(e)}</div>`).join('')||'<p class="no-class">Pas de cours</p>'}</section>`;}).join('')}</div>`;}
nextEvent=visible.find(e=>new Date(e.end)>new Date());$('next-detail').hidden=!nextEvent;
if(nextEvent){const inProgress=new Date(nextEvent.start)<=new Date();$('hero-label').textContent=inProgress?'EN CE MOMENT':'PROCHAIN COURS';$('next-title').textContent=nextEvent.title;$('next-meta').innerHTML=`<span>${svg('clock')}${dayKey(nextEvent.start)===currentToday?'Aujourd’hui':dateLabel(dayKey(nextEvent.start),{weekday:'short',day:'numeric',month:'short'})} · ${clock(nextEvent.start)} — ${clock(nextEvent.end)}</span><span>${svg('pin')}${escapeHTML(nextEvent.location||'Salle à préciser')}</span>`;}else{$('hero-label').textContent='LE TEMPS DE SOUFFLER';$('next-title').textContent='Rien à l’horizon.';$('next-meta').textContent='Aucun prochain cours dans le calendrier chargé.';}
document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('selected',b.dataset.view===view);b.setAttribute('aria-selected',String(b.dataset.view===view));});
}
function status(cached=false,error=false){if(!data)return;const age=Date.now()-new Date(data.updatedAt);$('sync-status').className=age>6*36e5||cached?'stale':'';$('sync-status').textContent=`${cached?'Hors connexion · dernière copie':age>6*36e5?'Données à actualiser':'Dernière synchronisation'} : ${new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(data.updatedAt))}${error?' · rechargement impossible':''}`;}
async function load(){const button=$('refresh');button.disabled=true;button.classList.add('spinning');try{const response=await fetch(`./data/schedule.json?t=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('HTTP '+response.status);const json=await response.json();if(!Array.isArray(json.events)||!json.updatedAt)throw Error('Données invalides');data=json;events=json.events;store.set('campus-cache',JSON.stringify(data));status();render();}catch{if(!data){try{const saved=JSON.parse(store.get('campus-cache','null'));if(saved?.events){data=saved;events=saved.events;}}catch{}}if(data){status(true,true);render();}else{$('sync-status').textContent='Calendrier indisponible. Vérifie ta connexion et réessaie.';$('next-title').textContent='Connexion au calendrier impossible';$('next-meta').textContent='Le bouton ↻ permet de réessayer.';render();}}finally{button.disabled=false;button.classList.remove('spinning');}}
document.addEventListener('click',e=>{const eventButton=e.target.closest('[data-event]');if(eventButton){const item=events.find(x=>x.id===eventButton.dataset.event);if(item)openDetails(item);}const day=e.target.closest('[data-day]');if(day){selected=day.dataset.day;render();}const tab=e.target.closest('[data-view]');if(tab){view=tab.dataset.view;render();}if(e.target.closest('#jump-next')){const next=activeEvents().find(x=>dayKey(x.start)>selected);if(next){selected=dayKey(next.start);render();}else{$('jump-next').textContent='Aucun cours après cette date';}}});
function today(){selected=dayKey(new Date());query='';$('search').value='';render();}
$('previous').onclick=()=>{selected=addDays(selected,-7);render();};$('following').onclick=()=>{selected=addDays(selected,7);render();};$('today').onclick=today;$('mobile-today').onclick=today;
$('date-picker').onchange=e=>{if(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){selected=e.target.value;render();}};
$('next-detail').onclick=()=>{if(nextEvent)openDetails(nextEvent);};
for(const id of ['filters','open-settings','mobile-settings'])$(id).onclick=()=>$('settings').showModal();
for(const id of ['side-agenda','mobile-agenda'])$(id).onclick=()=>{view='day';query='';$('search').value='';render();$('days').scrollIntoView({behavior:'smooth',block:'center'});};
document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('english-group').onchange=e=>{group=e.target.value;store.set('campus-group',group);render();};
$('theme').onclick=()=>{dark=!dark;document.documentElement.dataset.theme=dark?'dark':'light';store.set('campus-theme',dark?'dark':'light');};
$('export').onclick=()=>{const a=document.createElement('a');a.href='./data/calendar.ics';a.download='emploi-du-temps-ulco.ics';a.click();};
$('refresh').onclick=load;$('search-toggle').onclick=()=>{$('search-box').hidden=!$('search-box').hidden;if(!$('search-box').hidden)$('search').focus();else{query='';$('search').value='';render();}};
$('search').oninput=e=>{query=e.target.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();render();};
render();load();setInterval(()=>{render();if(data)status(!navigator.onLine);},60000);
