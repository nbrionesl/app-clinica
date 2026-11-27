/* =========================================================
   app.js — Prototipo Clínica Pediátrica Pequeños Pasos (v3)
   SPA con rutas por hash. Estado en localStorage (con respaldo en
   memoria) y sincronización entre pestañas (BroadcastChannel +
   evento storage) para simular el "tiempo real" del panel médico.
   Modo "app" (familias): diseño de celular; en escritorio se muestra
   dentro de un marco de teléfono. Modo "web" (personal médico).
   ========================================================= */
(() => {
  'use strict';

  /* ---------- Utilidades ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const todayStr = () => ymd(new Date());
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const fmtDate = (s) => cap(parseYmd(s).toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' }));
  const fmtShort = (s) => parseYmd(s).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtTime = (t) => { const [h, m] = t.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString('es-CR', { hour: 'numeric', minute: '2-digit', hour12: true }); };
  const uid = (p) => p + Math.random().toString(36).slice(2, 8);
  const isBiz = (d) => d.getDay() !== 0 && d.getDay() !== 6;
  const firstName = (n) => n.split(' ')[0];

  function ageText(birth) {
    const b = parseYmd(birth), n = new Date();
    let months = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
    if (n.getDate() < b.getDate()) months--;
    if (months < 24) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
    return `${Math.floor(months / 12)} años`;
  }

  /* ---------- Íconos y avatares ---------- */
  const ICONS = {
    home: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    calendar: 'M6 5h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM3 10h18M8 3v4M16 3v4',
    plus: 'M12 5v14M5 12h14',
    file: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6',
    user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c0-4 4-6 8-6s8 2 8 6',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    chev: 'M9 5l7 7-7 7',
    back: 'M15 5l-7 7 7 7',
    phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
    chat: 'M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z',
    pill: 'M10.5 3.5a4.5 4.5 0 0 1 6.4 6.4l-7 7a4.5 4.5 0 0 1-6.4-6.4zM8 8l6 6',
    flask: 'M9 3h6M10 3v6L5 19a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 19l-5-10V3M8 15h8',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
    growth: 'M3 17l6-6 4 4 8-8M15 7h6v6',
    swap: 'M7 7h13l-3-3M17 17H4l3 3',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
    access: 'M12 4a1.800 1.800 0 1 0 0 3.600A1.800 1.800 0 0 0 12 4zM5 9h14M12 9v5M9 21l3-7 3 7',
    heart: 'M12 20C5 15 3 11 3 8a4.500 4.500 0 0 1 9-1.500A4.500 4.500 0 0 1 21 8c0 3-2 7-9 12z',
    alert: 'M12 4l9 16H3zM12 10v4M12 17.500v.01'
  };
  const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICONS[n]}"/></svg>`;
  const PAL = [['#d8f0f1', '#064e55'], ['#ffe5cf', '#8a3600'], ['#e8e3fb', '#3d2a8a'], ['#fff1b8', '#6b4a00'], ['#dcf3e4', '#14532d'], ['#fde0e3', '#8c1d2c']];
  function avatar(name, size = 'md') {
    const i = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length;
    const ini = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return `<span class="avatar avatar--${size}" style="background:${PAL[i][0]};color:${PAL[i][1]}" aria-hidden="true">${esc(ini)}</span>`;
  }
  function dateBox(s) {
    const d = parseYmd(s);
    return `<div class="datebox" aria-hidden="true"><span>${d.toLocaleDateString('es-CR', { month: 'short' }).replace('.', '')}</span><strong>${d.getDate()}</strong></div>`;
  }
  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; };

  /* ---------- Almacenamiento seguro ---------- */
  const mem = {};
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] ?? null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } }
  };
  const KEY = 'pp_state_v1', PREFS = 'pp_prefs_v1';
  function loadState() {
    try {
      const raw = store.get(KEY);
      if (raw) { const s = JSON.parse(raw); if (s.meta && s.meta.seedDate === todayStr()) return s; }
    } catch (e) { /* ignorar */ }
    const s = window.buildSeed(); store.set(KEY, JSON.stringify(s)); return s;
  }
  let state = loadState();
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('pp_clinic') : null;
  function save() { store.set(KEY, JSON.stringify(state)); if (channel) channel.postMessage('update'); }

  /* ---------- Preferencias de accesibilidad ---------- */
  const PREF_DEFAULTS = { size: 100, contrast: false, spacing: false, links: false, plain: false, theme: 'auto' };
  const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
  const THEME_NAMES = { auto: 'Automático', light: 'Claro', dark: 'Oscuro' };
  let prefs = Object.assign({}, PREF_DEFAULTS, JSON.parse(store.get(PREFS) || '{}'));
  function applyPrefs() {
    const h = document.documentElement;
    h.style.fontSize = prefs.size + '%';
    h.dataset.contrast = prefs.contrast ? 'high' : 'normal';
    h.dataset.spacing = prefs.spacing ? 'on' : 'off';
    h.dataset.links = prefs.links ? 'on' : 'off';
    h.dataset.plain = prefs.plain ? 'on' : 'off';
    h.dataset.theme = prefs.theme === 'auto' ? (mqDark.matches ? 'dark' : 'light') : prefs.theme;
    const tb = $('#theme-btn'); if (tb) tb.textContent = 'Tema: ' + THEME_NAMES[prefs.theme];
    $$('[data-pref]').forEach((b) => b.setAttribute('aria-pressed', String(!!prefs[b.dataset.pref])));
    const o = $('#size-out'); if (o) o.textContent = prefs.size + '%';
    store.set(PREFS, JSON.stringify(prefs));
  }
  function toggleA11y(open) {
    const p = $('#a11y-panel'), f = $('#a11y-fab');
    const show = open === undefined ? p.hidden : open;
    p.hidden = !show; f.setAttribute('aria-expanded', String(show));
    if (show) { const first = $('button', p); if (first) first.focus(); } else if (open === false) f.focus();
  }

  function announce(msg, visual = true) {
    const live = $('#live'); live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30);
    if (visual) {
      const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('#toasts').appendChild(t);
      setTimeout(() => t.remove(), 4500);
    }
  }

  /* ---------- Datos ---------- */
  const doctor = (id) => window.DOCTORS.find((d) => d.id === id);
  const patient = (id) => state.patients.find((p) => p.id === id);
  const FAMILY = 'fam1';
  const myKids = () => state.patients.filter((p) => p.guardianId === FAMILY);
  const myKidIds = () => myKids().map((p) => p.id);
  const STATUS = {
    programada: ['Programada', '🗓'], esperando: ['En sala de espera', '⏳'], en_consulta: ['En consulta', '🩺'],
    atendida: ['Atendida', '✔'], cancelada: ['Cancelada', '✖'], ausente: ['No asistió', '⚠']
  };
  const badge = (st) => `<span class="badge badge--${st}"><span aria-hidden="true">${STATUS[st][1]}</span> ${STATUS[st][0]}</span>`;
  const apptTime = (a) => new Date(`${a.date}T${a.time}:00`);

  function allTimes() {
    const r = [];
    for (let m = 8 * 60; m < 16 * 60; m += 30) { if (m >= 12 * 60 && m < 13 * 60) continue; r.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`); }
    return r;
  }
  function slotsFor(doctorId, date, ignoreId) {
    if (!doctorId || !date) return [];
    const d = parseYmd(date), doc = doctor(doctorId);
    if (!doc.days.includes(d.getDay())) return [];
    const taken = new Set(state.appointments.filter((a) => a.doctorId === doctorId && a.date === date && a.status !== 'cancelada' && a.id !== ignoreId).map((a) => a.time));
    const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    return allTimes().filter((t) => {
      if (taken.has(t) || date < todayStr()) return false;
      if (date === todayStr()) { const [h, m] = t.split(':').map(Number); if (h * 60 + m <= nowMin) return false; }
      return true;
    });
  }
  function slotsHtml(doctorId, date, selected, ignoreId, booking) {
    if (!date) return '<p class="muted">Elija primero una fecha.</p>';
    const doc = doctor(doctorId), d = parseYmd(date);
    if (!doc.days.includes(d.getDay())) {
      const names = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      return `<p class="alert alert--info" role="status">${esc(doc.name)} atiende ${doc.days.map((x) => names[x]).join(', ')}. Elija otra fecha.</p>`;
    }
    const s = slotsFor(doctorId, date, ignoreId);
    if (!s.length) return '<p class="alert alert--info" role="status">No hay horarios libres para esta fecha. Pruebe con otro día.</p>';
    return `<p class="visually-hidden" role="status">${s.length} horarios disponibles</p><div class="slot-grid">${s.map((t) => `
      <div class="choice"><input type="radio" name="time" id="slot-${t.replace(':', '')}" value="${t}" ${selected === t ? 'checked' : ''} ${booking ? 'data-booking="time"' : ''}>
      <label for="slot-${t.replace(':', '')}">${fmtTime(t)}</label></div>`).join('')}</div>`;
  }

  /* ---------- Enrutamiento y modo de interfaz ---------- */
  const ui = { agendaDate: null, agendaDoctor: 'all', patientQuery: '', booking: null, apptTab: 'prox' };
  const route = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const defaultAgendaDate = () => { let d = new Date(); while (!isBiz(d)) d = addDays(d, 1); return ymd(d); };
  const mqWide = window.matchMedia('(min-width: 820px)');

  function setUiMode(parts) {
    const h = document.documentElement, web = parts[0] === 'medico';
    h.dataset.ui = web ? 'web' : 'app';
    h.dataset.frame = !web && mqWide.matches ? 'on' : 'off';
    const dark = !parts[0];
    h.dataset.top = dark ? 'dark' : 'light';
    h.dataset.booking = parts[0] === 'familia' && parts[1] === 'citas' && parts[2] === 'nueva' ? 'on' : 'off';
  }
  function fitDevice() {
    const z = Math.max(.5, Math.min(1.5, (window.innerHeight - 16) / 866, (window.innerWidth - 24) / 412));
    document.documentElement.style.setProperty('--dz', z.toFixed(3));
  }
  window.addEventListener('resize', fitDevice);
  const resetScroll = () => { const s = $('#scroller'); if (s) s.scrollTop = 0; window.scrollTo(0, 0); };

  function navFor(parts) {
    if (parts[0] === 'familia') {
      if (parts[1] === 'citas' && parts[2] === 'nueva') return [];
      return [['familia', 'home', 'Inicio'], ['familia/citas', 'calendar', 'Citas'], ['familia/expediente', 'file', 'Expediente'], ['familia/perfil', 'user', 'Perfil']];
    }
    if (parts[0] === 'medico') return [['medico', 'calendar', 'Agenda'], ['medico/pacientes', 'user', 'Pacientes'], ['familia', 'swap', 'Ir a familias']];
    return [];
  }
  function renderNav(parts) {
    const items = navFor(parts), nav = $('#nav');
    nav.hidden = !items.length;
    const path = parts.join('/');
    nav.innerHTML = `<ul>${items.map(([href, ico, label, kind]) => {
      let active = path === href;
      if (href === 'familia/expediente') active = path.startsWith(href);
      if (href === 'familia/citas') active = path === href;
      if (href === 'medico/pacientes') active = path.startsWith('medico/pacientes') || path.startsWith('medico/paciente');
      if (kind === 'add') return `<li class="tab-add"><a href="#/${href}" aria-label="${label}">${ic(ico)}</a></li>`;
      return `<li><a href="#/${href}" ${active ? 'aria-current="page"' : ''}><span class="tab-ic">${ic(ico)}</span><span>${label}</span></a></li>`;
    }).join('')}</ul>`;
  }

  function render(keepFocus) {
    const active = document.activeElement;
    const focusId = keepFocus && active && active.dataset ? active.dataset.fid || active.id || null : null;
    const parts = route();
    setUiMode(parts); renderNav(parts);
    const [role, sec, a, b] = parts;
    let out;
    if (!role) out = viewLanding();
    else if (role === 'familia') {
      if (!sec) out = viewFamHome();
      else if (sec === 'citas' && a === 'nueva') out = viewBooking();
      else if (sec === 'citas') out = viewFamAppts();
      else if (sec === 'expediente') out = viewRecord(a, b, false);
      else if (sec === 'perfil') out = viewProfile();
      else out = notFound();
    } else if (role === 'medico') {
      if (!sec) out = viewAgenda();
      else if (sec === 'pacientes') out = viewPatients();
      else if (sec === 'paciente') out = viewRecord(a, b, true);
      else out = notFound();
    } else out = notFound();
    const main = $('#main');
    main.innerHTML = out.html;
    if (!keepFocus) { main.classList.remove('page-in'); void main.offsetWidth; main.classList.add('page-in'); }
    document.title = `${out.title} — Pequeños Pasos`;
    const cur = $('.chips-nav [aria-current]', main); if (cur) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
    if (keepFocus && focusId) { const el = document.getElementById(focusId) || $(`[data-fid="${focusId}"]`); if (el) { el.focus({ preventScroll: true }); return; } }
    if (!keepFocus) { resetScroll(); const h1 = $('h1', main); if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); } }
  }
  const notFound = () => ({ title: 'No encontrado', html: '<div class="pad"><h1>Página no encontrada</h1><p><a href="#/">Volver al inicio</a></p></div>' });

  /* =========================================================
     Portada
     ========================================================= */
  function viewLanding() {
    const c = window.CLINIC;
    return {
      title: 'Inicio',
      html: `<div class="splash">
        <img class="splash__logo" src="logo.svg" alt="" width="96" height="96">
        <h1>Pequeños Pasos</h1>
        <p class="splash__sub">Clínica pediátrica · ${esc(c.city.split(',')[0])}</p>
        <p class="splash__txt">Citas, expediente y seguimiento de tratamientos de sus hijos e hijas, desde el celular.</p>
        <div class="splash__btns">
          <a class="btn-big btn-big--light" href="#/familia">${ic('heart')} Soy familia o encargado/a</a>
          <a class="btn-big btn-big--ghost" href="#/medico">${ic('calendar')} Soy personal de la clínica</a>
        </div>
        <ul class="splash__feats" aria-label="Beneficios">
          <li>${ic('check')} Citas sin filas ni llamadas</li>
          <li>${ic('check')} Resultados y recetas en su celular</li>
          <li>${ic('check')} Recordatorios de tratamiento</li>
        </ul>
        <p class="splash__meta">${esc(c.hours)}<br>Tel. ${esc(c.phone)}</p>
      </div>`
    };
  }

  /* =========================================================
     Familias
     ========================================================= */
  const myUpcoming = () => {
    const ids = myKidIds(), now = new Date();
    return state.appointments.filter((a) => ids.includes(a.patientId) && a.status === 'programada' && apptTime(a) >= now).sort((x, y) => apptTime(x) - apptTime(y));
  };
  const activeTreatments = (ids) => { const t = todayStr(); return state.treatments.filter((x) => ids.includes(x.patientId) && x.start <= t && x.end >= t); };

  function treatmentRow(t) {
    const p = patient(t.patientId), n = t.doses[todayStr()] || 0, done = n >= t.perDay;
    return `<li class="row">
      <span class="bubble bubble--warm">${ic('pill')}</span>
      <div class="row__main"><strong>${esc(t.med)}</strong><span>${esc(firstName(p.name))} · ${esc(t.dose)} · ${t.perDay} ${t.perDay === 1 ? 'vez' : 'veces'} al día</span>
        <span class="dots" role="img" aria-label="Hoy: ${n} de ${t.perDay} dosis">${Array.from({ length: t.perDay }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span></div>
      <button class="btn btn--sm" data-action="dose" data-id="${t.id}" data-fid="dose-${t.id}" ${done ? 'disabled' : ''}>${done ? ic('check') + ' Listo' : 'Dar dosis'}<span class="visually-hidden"> de ${esc(t.med)} a ${esc(p.name)}</span></button></li>`;
  }

  function apptActions(a, p) {
    return `<div class="actions actions--2">
      <button class="btn btn--sm" data-action="reschedule" data-id="${a.id}" data-fid="re-${a.id}">Reprogramar<span class="visually-hidden"> cita de ${esc(p.name)}</span></button>
      <button class="btn btn--sm btn--danger" data-action="cancel" data-id="${a.id}" data-fid="ca-${a.id}">Cancelar<span class="visually-hidden"> cita de ${esc(p.name)}</span></button></div>`;
  }
  function ticket(a, readonly) {
    const p = patient(a.patientId), d = doctor(a.doctorId);
    const future = a.status === 'programada' && apptTime(a) >= new Date();
    return `<article class="ticket" aria-label="Cita de ${esc(p.name)}, ${esc(fmtDate(a.date))}">
      <div class="ticket__top">${dateBox(a.date)}<div class="ticket__info"><strong>${fmtTime(a.time)} · ${esc(firstName(p.name))}</strong><span>${esc(a.reason)}</span><span>${esc(d.name)}</span></div></div>
      ${badge(a.status)}${future && !readonly ? apptActions(a, p) : ''}</article>`;
  }

  function viewFamHome() {
    const g = state.guardians[0], next = myUpcoming()[0], kids = myKids(), tr = activeTreatments(myKidIds());
    const lab = state.labs.filter((l) => myKidIds().includes(l.patientId)).sort((a, b) => b.date.localeCompare(a.date))[0];
    let nextHtml;
    if (next) {
      const p = patient(next.patientId), d = doctor(next.doctorId);
      nextHtml = `<section class="card next-card next-card--hero" aria-labelledby="h-next"><h2 id="h-next" class="visually-hidden">Próxima cita</h2>
        <div class="next-card__top">${dateBox(next.date)}<div class="next-card__info"><span>Próxima cita · ${esc(fmtDate(next.date).split(',')[0])}</span><strong>${fmtTime(next.time)} · ${esc(firstName(p.name))}</strong><span>${esc(next.reason)}</span><span>${esc(d.name)}</span></div></div>
        ${apptActions(next, p)}</section>`;
    } else {
      nextHtml = `<section class="card empty" aria-labelledby="h-next"><span class="bubble">${ic('calendar')}</span><h2 id="h-next">No tiene citas próximas</h2><a class="btn btn--primary" href="#/familia/citas/nueva">Agendar ahora</a></section>`;
    }
    const kid1 = kids.length === 1 ? '/' + kids[0].id : '';
    return {
      title: 'Inicio',
      html: `
      <div class="large-title"><div><p class="eyebrow">${greeting()}</p><h1>${esc(g.name.split(' ').slice(0, 2).join(' '))}</h1></div>
        <a class="avlink" href="#/familia/perfil" aria-label="Mi perfil">${avatar(g.name, 'md')}</a></div>
      <div class="pad">${nextHtml}</div>
      <div class="sec"><div class="tiles">
        <a class="tile tile--primary" href="#/familia/citas/nueva"><span class="bubble">${ic('plus')}</span>Agendar una cita</a>
        <a class="tile" href="#/familia/expediente"><span class="bubble">${ic('file')}</span>Expediente</a>
        <a class="tile" href="#/familia/expediente${kid1}${kids.length === 1 ? '/laboratorio' : ''}"><span class="bubble bubble--violet">${ic('flask')}</span>Resultados</a>
        <a class="tile" href="#/familia/expediente${kid1}${kids.length === 1 ? '/recetas' : ''}"><span class="bubble bubble--warm">${ic('pill')}</span>Recetas</a></div></div>
      <section class="sec" aria-labelledby="h-kids"><div class="sec__head"><h2 id="h-kids">Mis hijos e hijas</h2></div>
        <div class="strip">${kids.map((k) => `<a class="kid-card" href="#/familia/expediente/${k.id}">${avatar(k.name, 'md')}<strong>${esc(firstName(k.name))}</strong><span>${ageText(k.birth)}</span>${k.allergies.length ? `<span class="allergy">Alergia: ${esc(k.allergies[0])}</span>` : '<span>Sin alergias</span>'}</a>`).join('')}</div></section>
      <section class="sec" aria-labelledby="h-tr"><div class="sec__head"><h2 id="h-tr">Tratamientos de hoy</h2></div><div class="pad">
        ${tr.length ? `<ul class="rows">${tr.map(treatmentRow).join('')}</ul>` : '<div class="card empty">No hay tratamientos activos.</div>'}</div></section>
      ${lab ? `<section class="sec" aria-labelledby="h-lab"><div class="sec__head"><h2 id="h-lab">Último resultado</h2></div><div class="pad"><ul class="rows">
        <li><a class="row" href="#/familia/expediente/${lab.patientId}/laboratorio"><span class="bubble bubble--violet">${ic('flask')}</span><div class="row__main"><strong>${esc(lab.name)}</strong><span>${esc(firstName(patient(lab.patientId).name))} · ${fmtShort(lab.date)}</span></div>${ic('chev', 'chev')}</a></li></ul></div></section>` : ''}`
    };
  }

  function viewFamAppts() {
    const ids = myKidIds(), now = new Date();
    const all = state.appointments.filter((a) => ids.includes(a.patientId));
    const up = all.filter((a) => a.status === 'programada' && apptTime(a) >= now).sort((x, y) => apptTime(x) - apptTime(y));
    const past = all.filter((a) => !up.includes(a)).sort((x, y) => apptTime(y) - apptTime(x));
    const list = ui.apptTab === 'hist' ? past : up;
    return {
      title: 'Mis citas',
      html: `<div class="large-title"><div><h1>Citas</h1><p class="eyebrow">Reprograme o cancele sin llamar</p></div><a class="icon-btn icon-btn--tint" href="#/familia/citas/nueva" aria-label="Agendar una cita">${ic('plus')}</a></div>
      <div class="segmented" role="group" aria-label="Ver citas">
        <button type="button" data-action="tab-appt" data-tab="prox" data-fid="tab-prox" aria-pressed="${ui.apptTab !== 'hist'}">Próximas (${up.length})</button>
        <button type="button" data-action="tab-appt" data-tab="hist" data-fid="tab-hist" aria-pressed="${ui.apptTab === 'hist'}">Historial (${past.length})</button></div>
      <div class="pad stack">${list.length ? list.map((a) => ticket(a, ui.apptTab === 'hist')).join('') : `<div class="card empty"><span class="bubble">${ic('calendar')}</span>${ui.apptTab === 'hist' ? 'Aún no hay historial.' : 'No tiene citas próximas.'}${ui.apptTab === 'hist' ? '' : '<div class="actions" style="justify-content:center"><a class="btn btn--primary" href="#/familia/citas/nueva">Agendar una cita</a></div>'}</div>`}</div>`
    };
  }

  /* ---------- Asistente de nueva cita ---------- */
  function dayChips(doctorId, selected, ignoreId, box = '#slotbox', booking = true) {
    const out = [], doc = doctor(doctorId);
    for (let i = 0; i < 45 && out.length < 14; i++) {
      const d = addDays(new Date(), i); if (!doc.days.includes(d.getDay())) continue;
      const k = ymd(d); if (!slotsFor(doctorId, k, ignoreId).length) continue;
      const wd = d.toLocaleDateString('es-CR', { weekday: 'short' }).replace('.', ''), mo = d.toLocaleDateString('es-CR', { month: 'short' }).replace('.', '');
      out.push(`<div class="daychip"><input type="radio" name="date" id="dc-${k}" value="${k}" ${selected === k ? 'checked' : ''} data-slot-date data-box="${box}" ${booking ? 'data-booking="date"' : ''}><label for="dc-${k}"><small>${wd}</small><strong>${d.getDate()}</strong><small>${mo}</small></label></div>`);
    }
    return out.join('') || '<p class="alert alert--info">No hay fechas disponibles pronto con este médico.</p>';
  }

  function viewBooking() {
    if (!ui.booking) ui.booking = { step: 1, patientId: myKids().length === 1 ? myKids()[0].id : '', reason: '', detail: '', doctorId: '', date: '', time: '', error: null, done: null };
    const b = ui.booking;
    if (b.done) {
      const a = state.appointments.find((x) => x.id === b.done), p = patient(a.patientId), d = doctor(a.doctorId);
      return {
        title: 'Cita confirmada',
        html: `<div class="pad" style="text-align:center;padding-top:3rem"><span class="bubble bubble--ok" style="width:84px;height:84px;border-radius:50%;margin:0 auto 1rem"><svg class="ic" style="width:44px;height:44px;stroke-width:2.6" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS.check}"/></svg></span>
        <h1>¡Cita confirmada!</h1><p class="muted">Le enviaremos un recordatorio antes de la cita.</p>
        <div class="ticket" style="text-align:left;margin:1.2rem 0"><div class="ticket__top">${dateBox(a.date)}<div class="ticket__info"><strong>${esc(fmtDate(a.date))}</strong><span>${fmtTime(a.time)} · ${esc(p.name)}</span><span>${esc(d.name)}</span></div></div></div>
        <p class="muted">Llegue 10 minutos antes.</p>
        <div class="actions actions--2"><a class="btn" href="#/familia" data-action="booking-reset">Ir al inicio</a><a class="btn btn--primary" href="#/familia/citas" data-action="booking-reset">Ver mis citas</a></div></div>`
      };
    }
    const titles = ['¿Para quién es?', 'Motivo y médico', 'Fecha y hora', 'Confirme su cita'];
    const err = b.error ? `<div class="error-summary" role="alert" tabindex="-1" id="booking-error"><strong>Revise lo siguiente:</strong><ul><li>${esc(b.error)}</li></ul></div>` : '';
    let body = '';
    if (b.step === 1) {
      body = `<fieldset><legend class="visually-hidden">¿Para quién es la cita?</legend><div class="choice-grid">${myKids().map((k) => `
        <div class="choice"><input type="radio" name="patientId" id="k-${k.id}" value="${k.id}" ${b.patientId === k.id ? 'checked' : ''} data-booking="patientId"><label for="k-${k.id}">${avatar(k.name, 'sm')}<span>${esc(k.name)}<small>${ageText(k.birth)}</small></span></label></div>`).join('')}</div></fieldset>`;
    } else if (b.step === 2) {
      body = `<fieldset><legend>Motivo de la consulta</legend><div class="chip-grid">${window.REASONS.map((r, i) => `
        <div class="chip"><input type="radio" name="reason" id="rs${i}" value="${esc(r)}" ${b.reason === r ? 'checked' : ''} data-booking="reason"><label for="rs${i}">${esc(r)}</label></div>`).join('')}</div></fieldset>
        <fieldset><legend>Médico o especialista</legend><div class="choice-grid">${window.DOCTORS.map((d) => `
        <div class="choice"><input type="radio" name="doctorId" id="d-${d.id}" value="${d.id}" ${b.doctorId === d.id ? 'checked' : ''} data-booking="doctorId"><label for="d-${d.id}">${avatar(d.name.replace(/^Dra?\.\s/, ''), 'sm')}<span>${esc(d.name)}<small>${esc(d.specialty)}</small></span></label></div>`).join('')}</div></fieldset>
        <div class="field"><label for="detail">Detalle <span class="hint">Opcional: síntomas o dudas que quiera comentar.</span></label><textarea id="detail" data-booking="detail">${esc(b.detail)}</textarea></div>`;
    } else if (b.step === 3) {
      body = `<fieldset><legend>Elija un día</legend><div class="days" role="radiogroup" aria-label="Días disponibles">${dayChips(b.doctorId, b.date)}</div></fieldset>
        <fieldset><legend>Horarios disponibles</legend><div id="slotbox" data-doctor="${b.doctorId}" data-booking-box="1">${slotsHtml(b.doctorId, b.date, b.time, null, true)}</div></fieldset>`;
    } else {
      const p = patient(b.patientId), d = doctor(b.doctorId);
      body = `<ul class="rows" style="margin-bottom:1rem">
        <li class="row"><span class="bubble">${ic('user')}</span><div class="row__main"><span>Paciente</span><strong>${esc(p.name)}</strong></div></li>
        <li class="row"><span class="bubble bubble--warm">${ic('heart')}</span><div class="row__main"><span>Motivo</span><strong>${esc(b.reason)}</strong>${b.detail ? `<span>${esc(b.detail)}</span>` : ''}</div></li>
        <li class="row"><span class="bubble bubble--violet">${ic('file')}</span><div class="row__main"><span>Médico</span><strong>${esc(d.name)}</strong></div></li>
        <li class="row"><span class="bubble bubble--ok">${ic('calendar')}</span><div class="row__main"><span>Fecha y hora</span><strong>${esc(fmtDate(b.date))}, ${fmtTime(b.time)}</strong></div></li></ul>`;
    }
    const back = b.step > 1 ? `<button type="button" class="back" data-action="booking-back">${ic('back')}<span>Atrás</span></button>` : '';
    return {
      title: 'Agendar cita',
      html: `<div class="navbar"><div class="navbar__l">${back}</div><h1 class="navbar__t">${titles[b.step - 1]}</h1><div class="navbar__r"><a class="back back--plain" href="#/familia/citas" data-action="booking-reset">Cancelar</a></div></div>
      <div class="progress-bar" role="progressbar" aria-label="Progreso" aria-valuemin="1" aria-valuemax="4" aria-valuenow="${b.step}"><span style="width:${b.step * 25}%"></span></div>
      <p class="step-label">Paso ${b.step} de 4</p>
      <form class="pad" data-form="booking" novalidate>${err}${body}
        <div class="sticky-actions"><button type="submit" class="btn btn--primary">${b.step === 4 ? 'Confirmar cita' : 'Continuar'}</button></div></form>`
    };
  }
  function bookingNext() {
    const b = ui.booking; b.error = null;
    if (b.step === 1 && !b.patientId) b.error = 'Seleccione para quién es la cita.';
    else if (b.step === 2 && !b.reason) b.error = 'Seleccione el motivo de la consulta.';
    else if (b.step === 2 && !b.doctorId) b.error = 'Seleccione un médico o especialista.';
    else if (b.step === 3 && !b.date) b.error = 'Elija un día.';
    else if (b.step === 3 && !b.time) b.error = 'Elija un horario disponible.';
    if (b.error) { render(); const e = $('#booking-error'); if (e) e.focus(); return; }
    if (b.step < 4) { b.step++; render(); return; }
    if (!slotsFor(b.doctorId, b.date).includes(b.time)) { b.error = 'Ese horario acaba de ser ocupado. Elija otro.'; b.step = 3; b.time = ''; render(); const e = $('#booking-error'); if (e) e.focus(); return; }
    const a = { id: uid('a'), patientId: b.patientId, doctorId: b.doctorId, date: b.date, time: b.time, reason: b.reason + (b.detail ? ` — ${b.detail}` : ''), status: 'programada', createdAt: new Date().toISOString() };
    state.appointments.push(a); save(); b.done = a.id; render();
    announce('Cita confirmada.', false);
  }

  /* ---------- Perfil ---------- */
  function viewProfile() {
    const g = state.guardians[0], c = window.CLINIC;
    const rowBtn = (cls, ico, t, s, extra) => `<span class="bubble ${cls}">${ic(ico)}</span><div class="row__main"><strong>${t}</strong>${s ? `<span>${s}</span>` : ''}</div>${extra || ''}`;
    return {
      title: 'Perfil',
      html: `<div class="large-title"><h1>Perfil</h1></div>
      <div class="pad"><ul class="rows"><li class="row row--profile">${avatar(g.name, 'lg')}<div class="row__main"><strong style="font-size:1.1rem">${esc(g.name)}</strong><span>${esc(g.email)}</span><span>${esc(g.phone)}</span></div></li></ul></div>
      <section class="sec pad" aria-labelledby="h-cl"><h2 id="h-cl" class="group-title">La clínica</h2><ul class="rows">
        <li><a class="row" href="tel:${esc(c.phone.replace(/\D/g, ''))}">${rowBtn('', 'phone', 'Llamar a la clínica', `${esc(c.phone)} · ${esc(c.hours)}`, ic('chev', 'chev'))}</a></li>
        <li class="row">${rowBtn('bubble--ok', 'chat', 'WhatsApp', esc(c.whatsapp))}</li>
        <li class="row">${rowBtn('bubble--violet', 'home', 'Dirección', `${esc(c.address)}, ${esc(c.city)}`)}</li></ul></section>
      <section class="sec pad" aria-labelledby="h-ct"><h2 id="h-ct" class="group-title">Ajustes</h2><ul class="rows">
        <li><button type="button" class="row row--btn" data-action="a11y-open">${rowBtn('bubble--warn', 'access', 'Accesibilidad y apariencia', 'Texto, contraste, tema claro u oscuro', ic('chev', 'chev'))}</button></li>
        <li><a class="row" href="#/medico">${rowBtn('bubble--warm', 'swap', 'Cambiar a personal de la clínica', 'Ver el panel médico (demostración)', ic('chev', 'chev'))}</a></li>
        <li><a class="row" href="#/">${rowBtn('', 'back', 'Volver a la portada', '', ic('chev', 'chev'))}</a></li></ul>
        <p class="group-foot">Versión de demostración con datos ficticios.</p></section>`
    };
  }

  /* =========================================================
     Expediente (familias y personal)
     ========================================================= */
  const SECTIONS = [['resumen', 'Resumen', 'heart'], ['vacunas', 'Vacunas', 'shield'], ['crecimiento', 'Crecimiento', 'growth'], ['laboratorio', 'Laboratorio', 'flask'], ['recetas', 'Recetas', 'pill']];

  function viewRecord(pid, sec, staff) {
    const base = staff ? '#/medico/paciente' : '#/familia/expediente';
    if (!staff && !pid) {
      const kids = myKids();
      if (kids.length === 1) pid = kids[0].id;
      else return { title: 'Expediente', html: `<div class="large-title"><div><h1>Expediente</h1><p class="eyebrow">Elija a quién desea consultar</p></div></div>
        <div class="pad"><ul class="rows">${kids.map((k) => `<li><a class="row" href="#/familia/expediente/${k.id}">${avatar(k.name, 'md')}<div class="row__main"><strong>${esc(k.name)}</strong><span>${ageText(k.birth)}${k.allergies.length ? ' · Alergia: ' + esc(k.allergies.join(', ')) : ''}</span></div>${ic('chev', 'chev')}</a></li>`).join('')}</ul></div>` };
    }
    const p = patient(pid);
    if (!p || (!staff && p.guardianId !== FAMILY)) return notFound();
    sec = SECTIONS.some((s) => s[0] === sec) ? sec : 'resumen';
    const fns = { resumen: secResumen, vacunas: secVacunas, crecimiento: secCrecimiento, laboratorio: secLab, recetas: secRecetas };
    const secTitle = SECTIONS.find((s) => s[0] === sec)[1];
    const backLabel = staff ? 'Pacientes' : (myKids().length > 1 ? 'Expediente' : 'Inicio');
    const backHref = staff ? '#/medico/pacientes' : (myKids().length > 1 ? '#/familia/expediente' : '#/familia');
    return {
      title: `${p.name} — ${secTitle}`,
      html: `<div class="navbar"><div class="navbar__l"><a class="back" href="${backHref}">${ic('back')}<span>${backLabel}</span></a></div><h1 class="navbar__t">${staff ? 'Expediente' : esc(firstName(p.name))}</h1><div class="navbar__r"></div></div>
      <div class="pad"><div class="card"><div class="profile">${avatar(p.name, 'lg')}<div><h2>${esc(p.name)}</h2><p>${ageText(p.birth)} · Nac. ${fmtShort(p.birth)}</p>
        <div class="pills"><span class="pill">Sangre ${esc(p.blood)}</span>${staff ? `<span class="pill">${esc(p.guardianName)} · ${esc(p.phone)}</span>` : ''}</div></div></div>
        ${p.allergies.length ? `<p class="alert alert--bad" role="note" style="margin:.9rem 0 0"><strong>Alergias:</strong> ${p.allergies.map((x) => `<span class="allergy">${esc(x)}</span>`).join('')}</p>` : ''}</div></div>
      <nav aria-label="Secciones del expediente" style="margin-top:1rem"><ul class="chips-nav">${SECTIONS.map(([k, l, i]) => `<li><a href="${base}/${p.id}/${k}" ${k === sec ? 'aria-current="page"' : ''}>${ic(i)} ${l}</a></li>`).join('')}</ul></nav>
      <section class="pad" aria-labelledby="h-sec"><h2 id="h-sec" class="visually-hidden">${secTitle}</h2>${fns[sec](p, staff)}
        <div class="actions no-print" style="justify-content:center"><button class="btn btn--ghost btn--sm" data-action="print">Imprimir esta sección</button></div></section>`
    };
  }

  function secResumen(p, staff) {
    const cons = state.consultations.filter((c) => c.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
    const next = state.appointments.filter((a) => a.patientId === p.id && a.status === 'programada' && apptTime(a) >= new Date()).sort((a, b) => apptTime(a) - apptTime(b))[0];
    const g = p.growth[p.growth.length - 1];
    return `<ul class="rows">
      <li class="row"><span class="bubble bubble--bad">${ic('alert')}</span><div class="row__main"><span>Condiciones</span><strong>${p.conditions.length ? p.conditions.map(esc).join(', ') : 'Ninguna registrada'}</strong></div></li>
      <li class="row"><span class="bubble">${ic('calendar')}</span><div class="row__main"><span>Próxima cita</span><strong>${next ? `${esc(fmtDate(next.date))}, ${fmtTime(next.time)}` : 'Sin cita programada'}</strong></div></li>
      <li class="row"><span class="bubble bubble--ok">${ic('growth')}</span><div class="row__main"><span>Último peso y talla</span><strong>${g ? `${g.weight} kg · ${g.height} cm` : 'Sin mediciones'}</strong></div></li></ul>
      <h3 style="margin:1.3rem 0 .6rem">Historial de consultas</h3>
      ${cons.length ? `<div class="stack">${cons.map((c) => `<article class="card card--flat"><div style="display:flex;justify-content:space-between;gap:.5rem"><strong>${esc(c.reason)}</strong><span class="muted" style="font-size:.85rem;white-space:nowrap">${fmtShort(c.date)}</span></div>
        <p class="muted" style="margin:.1rem 0 .4rem;font-size:.85rem">${esc(doctor(c.doctorId)?.name || '')}</p><p style="margin:0 0 .3rem"><strong>Diagnóstico:</strong> ${esc(c.diagnosis)}</p><p class="muted" style="margin:0;font-size:.9rem">${esc(c.notes)}</p></article>`).join('')}</div>` : '<div class="card empty">Sin consultas registradas.</div>'}
      ${staff ? `<h3 style="margin:1.3rem 0 .6rem">Registrar nota de consulta</h3>
      <form class="card" data-form="note" data-pid="${p.id}" novalidate>
        <div class="field"><label for="n-reason">Motivo de consulta</label><input type="text" id="n-reason" name="reason"></div>
        <div class="field"><label for="n-dx">Diagnóstico</label><input type="text" id="n-dx" name="diagnosis"></div>
        <div class="field"><label for="n-notes">Observaciones y plan</label><textarea id="n-notes" name="notes"></textarea></div>
        <button class="btn btn--primary" type="submit">Guardar nota</button></form>` : ''}`;
  }

  function secVacunas(p) {
    const pend = p.vaccines.filter((v) => v.status !== 'aplicada'), done = p.vaccines.filter((v) => v.status === 'aplicada');
    const row = (v) => `<li class="row"><span class="bubble ${v.status === 'aplicada' ? 'bubble--ok' : 'bubble--warn'}">${ic(v.status === 'aplicada' ? 'check' : 'clock')}</span>
      <div class="row__main"><strong>${esc(v.name)}</strong><span>${esc(v.dose)} · ${fmtShort(v.date)}</span></div>
      <span class="badge badge--${v.status}">${v.status === 'aplicada' ? 'Aplicada' : 'Pendiente'}</span></li>`;
    return `<p class="muted" style="font-size:.88rem">${done.length} dosis aplicadas. Esquema de ejemplo para la demostración.</p>
      ${pend.length ? `<h3 style="margin:.4rem 0 .6rem">Próximas</h3><ul class="rows" style="margin-bottom:1.2rem">${pend.map(row).join('')}</ul>` : ''}
      <h3 style="margin:.4rem 0 .6rem">Aplicadas</h3><ul class="rows">${done.slice().reverse().map(row).join('')}</ul>`;
  }

  function secCrecimiento(p) {
    const g = p.growth;
    if (!g.length) return '<div class="card empty">Aún no hay mediciones registradas.</div>';
    const W = 360, H = 220, L = 44, R = 22, T = 24, B = 42;
    const ws = g.map((x) => x.weight), minW = Math.floor(Math.min(...ws) - 1), maxW = Math.ceil(Math.max(...ws) + 1);
    const x = (i) => L + (g.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (g.length - 1));
    const y = (v) => T + (H - T - B) * (1 - (v - minW) / (maxW - minW));
    const desc = `Gráfico de peso: ${g.map((m) => `${fmtShort(m.date)}, ${m.weight} kilogramos`).join('; ')}.`;
    return `<figure style="margin:0 0 1rem"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}">
      <line class="axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/><line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>
      <text x="4" y="${T + 4}">${maxW} kg</text><text x="4" y="${H - B}">${minW} kg</text>
      <polyline class="line" points="${g.map((m, i) => `${x(i)},${y(m.weight)}`).join(' ')}"/>
      ${g.map((m, i) => `<circle class="dot" cx="${x(i)}" cy="${y(m.weight)}" r="6"/><text x="${x(i)}" y="${y(m.weight) - 12}" text-anchor="middle">${m.weight}</text><text x="${x(i)}" y="${H - 16}" text-anchor="middle">${parseYmd(m.date).toLocaleDateString('es-CR', { month: 'short', year: '2-digit' })}</text>`).join('')}
      </svg><figcaption class="muted" style="font-size:.85rem;margin-top:.4rem">Evolución del peso (kg).</figcaption></figure>
      <ul class="rows">${g.slice().reverse().map((m) => `<li class="row"><span class="bubble bubble--ok">${ic('growth')}</span><div class="row__main"><strong>${m.weight} kg · ${m.height} cm</strong><span>${fmtShort(m.date)}</span></div></li>`).join('')}</ul>`;
  }

  function secLab(p) {
    const labs = state.labs.filter((l) => l.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
    if (!labs.length) return '<div class="card empty">No hay resultados de laboratorio.</div>';
    return `<div class="stack">${labs.map((l) => `<article class="card lab" aria-label="${esc(l.name)}">
      <div class="lab__head"><h3>${esc(l.name)}</h3><span class="muted" style="font-size:.85rem">${fmtShort(l.date)} · ${esc(l.lab)}</span></div>
      <ul class="rows">${l.items.map((i) => `<li class="row"><div class="row__main"><strong>${esc(i.param)}</strong><span>Ref. ${esc(i.ref)}</span></div>
        <div class="row__end"><span class="value">${esc(i.value)}</span> <span class="muted">${esc(i.unit)}</span><br><span class="badge badge--${i.flag}"><span aria-hidden="true">${i.flag === 'normal' ? '✔' : i.flag === 'alto' ? '▲' : '▼'}</span> ${i.flag === 'normal' ? 'Normal' : i.flag === 'alto' ? 'Alto' : 'Bajo'}</span></div></li>`).join('')}</ul>
      ${l.note ? `<p class="lab__note"><strong>Nota:</strong> ${esc(l.note)}</p>` : ''}</article>`).join('')}
      <p class="muted" style="font-size:.82rem">Los resultados no sustituyen la valoración médica. Consulte a su pediatra.</p></div>`;
  }

  function secRecetas(p, staff) {
    const rx = state.prescriptions.filter((r) => r.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
    const t = todayStr(), tr = state.treatments.filter((x) => x.patientId === p.id && x.end >= t).sort((a, b) => b.start.localeCompare(a.start));
    return `<h3 style="margin:.2rem 0 .6rem">Tratamientos en curso</h3>
      ${tr.length ? `<ul class="rows">${tr.map(treatmentRow).join('')}</ul>` : '<div class="card empty">No hay tratamientos activos.</div>'}
      <h3 style="margin:1.3rem 0 .6rem">Recetas</h3>
      ${rx.length ? `<div class="stack">${rx.map((r) => `<article class="card rx" aria-label="Receta del ${fmtShort(r.date)}"><h3>Receta del ${fmtShort(r.date)}</h3><p class="muted" style="margin:0;font-size:.85rem">${esc(doctor(r.doctorId)?.name || '')}</p>
        <ul>${r.items.map((i) => `<li><strong>${esc(i.med)}</strong> — ${esc(i.dose)}. ${esc(i.instructions)}</li>`).join('')}</ul></article>`).join('')}</div>` : '<div class="card empty">No hay recetas.</div>'}
      ${staff ? `<h3 style="margin:1.3rem 0 .6rem">Nueva receta</h3>
      <form class="card" data-form="rx" data-pid="${p.id}" novalidate>
        <div class="field"><label for="rx-med">Medicamento y concentración</label><input type="text" id="rx-med" name="med"></div>
        <div class="field"><label for="rx-dose">Dosis por toma <span class="hint">Ejemplo: 5 mL por vía oral</span></label><input type="text" id="rx-dose" name="dose"></div>
        <div class="grid grid--2"><div class="field"><label for="rx-per">Veces al día</label><select id="rx-per" name="perDay"><option>1</option><option>2</option><option>3</option><option>4</option></select></div>
        <div class="field"><label for="rx-days">Duración (días)</label><input type="number" id="rx-days" name="days" min="1" max="90" value="7"></div></div>
        <div class="field"><label for="rx-ins">Indicaciones</label><textarea id="rx-ins" name="instructions"></textarea></div>
        <button class="btn btn--primary" type="submit">Emitir receta</button></form>` : ''}`;
  }

  /* =========================================================
     Panel médico (modo web)
     ========================================================= */
  const waitText = (a) => {
    if (a.status !== 'esperando' || !a.arrivedAt) return '';
    const min = Math.max(0, Math.round((Date.now() - new Date(a.arrivedAt)) / 60000));
    return ` <span class="muted" style="font-size:.85rem">Espera: <span data-wait="${a.arrivedAt}">${min} min</span></span>`;
  };
  function viewAgenda() {
    if (!ui.agendaDate) ui.agendaDate = defaultAgendaDate();
    const d = ui.agendaDate;
    const list = state.appointments.filter((a) => a.date === d && (ui.agendaDoctor === 'all' || a.doctorId === ui.agendaDoctor)).sort((a, b) => a.time.localeCompare(b.time));
    const act = list.filter((a) => a.status !== 'cancelada'), cnt = (s) => act.filter((a) => a.status === s).length;
    const row = (a) => {
      const p = patient(a.patientId), doc = doctor(a.doctorId), k = a.id;
      let btns = '';
      if (a.status === 'programada') btns = `<button class="btn btn--sm" data-action="st" data-st="esperando" data-id="${k}" data-fid="b1-${k}">Registrar llegada<span class="visually-hidden"> de ${esc(p.name)}</span></button><button class="btn btn--sm btn--ghost" data-action="st" data-st="ausente" data-id="${k}" data-fid="b2-${k}">No asistió<span class="visually-hidden">: ${esc(p.name)}</span></button>`;
      else if (a.status === 'esperando') btns = `<button class="btn btn--sm btn--primary" data-action="st" data-st="en_consulta" data-id="${k}" data-fid="b1-${k}">Iniciar consulta<span class="visually-hidden"> de ${esc(p.name)}</span></button>`;
      else if (a.status === 'en_consulta') btns = `<button class="btn btn--sm btn--primary" data-action="st" data-st="atendida" data-id="${k}" data-fid="b1-${k}">Finalizar consulta<span class="visually-hidden"> de ${esc(p.name)}</span></button>`;
      return `<li class="appt-row appt-row--${a.status}">
        <div class="appt-row__time"><strong>${fmtTime(a.time)}</strong><span>${esc(doc.name.split(' ').slice(0, 2).join(' '))}</span></div>
        <div class="appt-row__main">
          <div class="who">${avatar(p.name, 'sm')}<div><a href="#/medico/paciente/${p.id}">${esc(p.name)}</a><span>${ageText(p.birth)} · ${esc(a.reason)}</span></div></div>
          ${p.allergies.length ? `<div><span class="allergy">Alergia: ${esc(p.allergies.join(', '))}</span></div>` : ''}
          <div>${badge(a.status)}${waitText(a)}</div>
          <div class="actions">${btns}<a class="btn btn--sm btn--ghost" href="#/medico/paciente/${p.id}">Expediente<span class="visually-hidden"> de ${esc(p.name)}</span></a></div></div></li>`;
    };
    return {
      title: 'Agenda',
      html: `<div class="app-bar"><div style="flex:1"><h1>Agenda médica</h1><p><span class="live-dot" aria-hidden="true"></span>En vivo: se actualiza cuando una familia agenda o cambia una cita.</p></div></div>
      <div class="card filters no-print">
        <div class="field" style="margin:0"><label for="ag-date">Fecha</label><div class="datebar">
          <button class="icon-btn" data-action="day" data-n="-1" aria-label="Día anterior">${ic('back')}</button>
          <input type="date" id="ag-date" value="${d}" data-ag="date">
          <button class="icon-btn" data-action="day" data-n="1" aria-label="Día siguiente">${ic('chev')}</button>
          <button class="btn btn--sm" data-action="day-today">Hoy</button></div></div>
        <div class="field" style="margin:0"><label for="ag-doc">Médico</label>
          <select id="ag-doc" data-ag="doctor"><option value="all">Todos</option>${window.DOCTORS.map((x) => `<option value="${x.id}" ${ui.agendaDoctor === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div></div>
      <h2 style="margin-bottom:.7rem">${esc(fmtDate(d))}</h2>
      <div class="stats" role="group" aria-label="Resumen del día">
        <div class="stat"><div class="stat__n">${act.length}</div><div class="stat__l">Citas</div></div>
        <div class="stat"><div class="stat__n">${cnt('esperando')}</div><div class="stat__l">En espera</div></div>
        <div class="stat"><div class="stat__n">${cnt('en_consulta')}</div><div class="stat__l">En consulta</div></div>
        <div class="stat"><div class="stat__n">${cnt('atendida')}</div><div class="stat__l">Atendidas</div></div></div>
      ${list.length ? `<ul class="agenda" aria-label="Citas del ${esc(fmtDate(d))}">${list.map(row).join('')}</ul>` : '<div class="card empty">No hay citas para este día.</div>'}`
    };
  }

  const filterPatients = () => {
    const q = ui.patientQuery.trim().toLowerCase();
    return state.patients.filter((p) => !q || p.name.toLowerCase().includes(q) || p.guardianName.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  };
  function patientList(list) {
    if (!list.length) return '<div class="card empty">No se encontraron pacientes.</div>';
    return `<ul class="rows">${list.map((p) => `<li><a class="row" href="#/medico/paciente/${p.id}">${avatar(p.name, 'sm')}<div class="row__main"><strong>${esc(p.name)}</strong><span>${ageText(p.birth)} · ${esc(p.guardianName)} · ${esc(p.phone)}</span></div>
      ${p.allergies.length ? `<span class="allergy">${esc(p.allergies[0])}</span>` : ''}${ic('chev', 'chev')}</a></li>`).join('')}</ul>`;
  }
  function viewPatients() {
    const list = filterPatients();
    return {
      title: 'Pacientes',
      html: `<div class="app-bar"><div style="flex:1"><h1>Pacientes</h1><p>Busque por nombre del paciente o del encargado.</p></div></div>
      <div class="field"><label for="pq">Buscar</label><input type="search" id="pq" value="${esc(ui.patientQuery)}" data-ag="query" autocomplete="off"></div>
      <p role="status" id="pq-count" class="muted">${list.length} ${list.length === 1 ? 'paciente' : 'pacientes'}</p>
      <div id="pq-results">${patientList(list)}</div>`
    };
  }

  /* =========================================================
     Diálogos
     ========================================================= */
  /* Hojas que suben desde abajo, dentro del teléfono (como en iOS) */
  function openSheet(html) {
    const prev = document.activeElement, root = $('#shell');
    const wrap = document.createElement('div'); wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="sheet-backdrop" data-action="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1"><span class="grabber" aria-hidden="true"></span>${html}</div>`;
    const others = Array.from(root.children).filter((el) => el !== wrap && el.id !== 'toasts');
    others.forEach((el) => { el.inert = true; });
    root.appendChild(wrap);
    const sheet = $('.sheet', wrap);
    const focusables = () => $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', sheet).filter((el) => !el.disabled && el.offsetParent !== null);
    wrap._close = (val) => {
      if (!wrap.isConnected) return;
      wrap.remove(); others.forEach((el) => { el.inert = false; });
      if (prev && prev.isConnected) prev.focus({ preventScroll: true });
      wrap.dispatchEvent(new CustomEvent('sheetclose', { detail: val }));
    };
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); wrap._close('cancel'); }
      if (e.key === 'Tab') {
        const f = focusables(); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    const f = focusables(); (f[0] || sheet).focus({ preventScroll: true });
    return wrap;
  }
  function confirmDialog({ title, body, ok = 'Confirmar', cancel = 'Volver', danger = false }) {
    return new Promise((res) => {
      const w = openSheet(`<div class="actionsheet"><div class="as-group"><h2 id="sheet-title" class="as-title">${esc(title)}</h2><p class="as-msg">${body}</p>
        <button type="button" class="as-btn ${danger ? 'as-btn--danger' : ''}" data-action="sheet-ok">${esc(ok)}</button></div>
        <button type="button" class="as-btn as-btn--cancel" data-action="close-sheet">${esc(cancel)}</button></div>`);
      w.addEventListener('sheetclose', (e) => res(e.detail === 'ok'));
    });
  }
  function rescheduleDialog(a) {
    const p = patient(a.patientId), doc = doctor(a.doctorId);
    openSheet(`<form data-form="reschedule" data-id="${a.id}" novalidate>
      <div class="sheet-nav"><button type="button" class="link-btn" data-action="close-sheet">Cancelar</button><h2 id="sheet-title">Reprogramar</h2><button type="submit" class="link-btn link-btn--bold">Guardar</button></div>
      <div class="sheet-body">
        <p class="muted" style="margin-bottom:.9rem">${esc(p.name)} con ${esc(doc.name)}.<br>Cita actual: <strong>${esc(fmtDate(a.date))}, ${fmtTime(a.time)}</strong></p>
        <fieldset><legend>Elija un día</legend><div class="days" role="radiogroup" aria-label="Días disponibles">${dayChips(a.doctorId, '', a.id, '#rs-box', false)}</div></fieldset>
        <fieldset><legend>Horarios disponibles</legend><div id="rs-box" data-doctor="${a.doctorId}" data-ignore="${a.id}"><p class="muted">Elija primero un día.</p></div></fieldset>
      </div></form>`);
  }

  /* =========================================================
     Eventos
     ========================================================= */
  function setStatus(id, st) {
    const a = state.appointments.find((x) => x.id === id); if (!a) return;
    a.status = st; if (st === 'esperando') a.arrivedAt = new Date().toISOString();
    save(); announce(`${patient(a.patientId).name}: ${STATUS[st][0].toLowerCase()}.`); render(true);
  }

  $('#a11y-fab').addEventListener('click', () => toggleA11y());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#a11y-panel').hidden) toggleA11y(false); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.a11y-widget') && !e.target.closest('[data-action="a11y-open"]') && !$('#a11y-panel').hidden) toggleA11y(false); });

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-action]'); if (!t) return;
    const act = t.dataset.action, id = t.dataset.id;
    switch (act) {
      case 'font+': prefs.size = Math.min(150, prefs.size + 10); applyPrefs(); break;
      case 'font-': prefs.size = Math.max(90, prefs.size - 10); applyPrefs(); break;
      case 'pref': prefs[t.dataset.pref] = !prefs[t.dataset.pref]; applyPrefs(); break;
      case 'a11y-reset': prefs = Object.assign({}, PREF_DEFAULTS); applyPrefs(); announce('Ajustes de accesibilidad quitados.', false); break;
      case 'a11y-open': toggleA11y(true); break;
      case 'print': window.print(); break;
      case 'close-sheet': { const w = t.closest('.sheet-wrap'); if (w) w._close('cancel'); break; }
      case 'sheet-ok': { const w = t.closest('.sheet-wrap'); if (w) w._close('ok'); break; }
      case 'theme': { const o = ['auto', 'light', 'dark']; prefs.theme = o[(o.indexOf(prefs.theme) + 1) % 3]; applyPrefs(); announce('Tema ' + THEME_NAMES[prefs.theme].toLowerCase(), false); break; }
      case 'booking-reset': ui.booking = null; break;
      case 'booking-back': ui.booking.step--; ui.booking.error = null; render(); break;
      case 'tab-appt': ui.apptTab = t.dataset.tab; render(true); break;
      case 'day': ui.agendaDate = ymd(addDays(parseYmd(ui.agendaDate), Number(t.dataset.n))); render(); break;
      case 'day-today': ui.agendaDate = defaultAgendaDate(); render(); break;
      case 'st': setStatus(id, t.dataset.st); break;
      case 'dose': {
        const tr = state.treatments.find((x) => x.id === id), k = todayStr();
        tr.doses[k] = Math.min(tr.perDay, (tr.doses[k] || 0) + 1); save();
        announce(`Dosis registrada: ${tr.doses[k]} de ${tr.perDay} hoy.`); render(true); break;
      }
      case 'cancel': {
        const a = state.appointments.find((x) => x.id === id), p = patient(a.patientId);
        const ok = await confirmDialog({ title: '¿Cancelar la cita?', body: `Cita de <strong>${esc(p.name)}</strong> el ${esc(fmtDate(a.date))} a las ${fmtTime(a.time)} El espacio quedará libre para otra familia.`, ok: 'Sí, cancelar', cancel: 'No, mantener', danger: true });
        if (ok) { a.status = 'cancelada'; save(); announce('Cita cancelada.'); render(); }
        break;
      }
      case 'reschedule': rescheduleDialog(state.appointments.find((x) => x.id === id)); break;
    }
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-slot-date]')) {
      const box = $(t.dataset.box);
      if (t.dataset.booking) { ui.booking.date = t.value; ui.booking.time = ''; }
      box.innerHTML = slotsHtml(box.dataset.doctor, t.value, '', box.dataset.ignore || null, !!box.dataset.bookingBox);
      return;
    }
    if (t.dataset.booking) { ui.booking[t.dataset.booking] = t.value; if (t.dataset.booking === 'doctorId') { ui.booking.date = ''; ui.booking.time = ''; } }
    if (t.dataset.ag === 'date') { ui.agendaDate = t.value || ui.agendaDate; render(); }
    if (t.dataset.ag === 'doctor') { ui.agendaDoctor = t.value; render(); }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.booking && t.tagName === 'TEXTAREA') ui.booking[t.dataset.booking] = t.value;
    if (t.dataset.ag === 'query') {
      ui.patientQuery = t.value; const list = filterPatients();
      $('#pq-results').innerHTML = patientList(list);
      $('#pq-count').textContent = `${list.length} ${list.length === 1 ? 'paciente' : 'pacientes'}`;
    }
  });

  function formErrors(form, errs) {
    let box = $('.error-summary', form); if (box) box.remove();
    $$('[aria-invalid]', form).forEach((x) => x.removeAttribute('aria-invalid'));
    if (!errs.length) return false;
    box = document.createElement('div'); box.className = 'error-summary'; box.setAttribute('role', 'alert'); box.tabIndex = -1;
    box.innerHTML = `<strong>Revise lo siguiente:</strong><ul>${errs.map(([, m]) => `<li>${esc(m)}</li>`).join('')}</ul>`;
    form.prepend(box);
    errs.forEach(([n]) => { const f = form.elements[n]; if (f && f.setAttribute) f.setAttribute('aria-invalid', 'true'); });
    box.focus(); return true;
  }

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]'); if (!form) return;
    e.preventDefault();
    const kind = form.dataset.form, fd = Object.fromEntries(new FormData(form).entries());
    if (kind === 'booking') return bookingNext();
    if (kind === 'reschedule') {
      const errs = [];
      if (!fd.date) errs.push(['date', 'Elija una nueva fecha.']); else if (!fd.time) errs.push(['time', 'Elija un horario disponible.']);
      if (formErrors(form, errs)) return;
      const a = state.appointments.find((x) => x.id === form.dataset.id);
      if (!slotsFor(a.doctorId, fd.date, a.id).includes(fd.time)) { formErrors(form, [['time', 'Ese horario ya no está disponible. Elija otro.']]); return; }
      a.date = fd.date; a.time = fd.time; save(); form.closest('.sheet-wrap')._close('ok');
      announce(`Cita reprogramada para el ${fmtDate(a.date)} a las ${fmtTime(a.time)}.`); render();
    }
    if (kind === 'note') {
      const errs = [];
      if (!fd.reason.trim()) errs.push(['reason', 'Escriba el motivo de consulta.']);
      if (!fd.diagnosis.trim()) errs.push(['diagnosis', 'Escriba el diagnóstico.']);
      if (formErrors(form, errs)) return;
      state.consultations.push({ id: uid('c'), patientId: form.dataset.pid, date: todayStr(), doctorId: ui.agendaDoctor !== 'all' ? ui.agendaDoctor : 'd1', reason: fd.reason.trim(), diagnosis: fd.diagnosis.trim(), notes: (fd.notes || '').trim() });
      save(); announce('Nota de consulta guardada.'); render(true);
    }
    if (kind === 'rx') {
      const errs = [], days = Number(fd.days);
      if (!fd.med.trim()) errs.push(['med', 'Escriba el medicamento.']);
      if (!fd.dose.trim()) errs.push(['dose', 'Escriba la dosis por toma.']);
      if (!(days >= 1 && days <= 90)) errs.push(['days', 'La duración debe estar entre 1 y 90 días.']);
      if (formErrors(form, errs)) return;
      const docId = ui.agendaDoctor !== 'all' ? ui.agendaDoctor : 'd1', per = Number(fd.perDay);
      const ins = `${per} ${per === 1 ? 'vez' : 'veces'} al día durante ${days} días. ${(fd.instructions || '').trim()}`.trim();
      state.prescriptions.push({ id: uid('r'), patientId: form.dataset.pid, date: todayStr(), doctorId: docId, items: [{ med: fd.med.trim(), dose: fd.dose.trim(), instructions: ins }] });
      state.treatments.push({ id: uid('t'), patientId: form.dataset.pid, med: fd.med.trim(), dose: fd.dose.trim(), perDay: per, start: todayStr(), end: ymd(addDays(new Date(), days - 1)), instructions: (fd.instructions || '').trim(), doses: {} });
      save(); announce('Receta emitida. La familia la verá en su expediente.'); render(true);
    }
  });

  /* ---------- Sincronización "en tiempo real" entre pestañas ---------- */
  function onExternalUpdate() {
    const before = new Set(state.appointments.map((a) => a.id));
    try { state = JSON.parse(store.get(KEY)); } catch (e) { return; }
    const fresh = state.appointments.filter((a) => !before.has(a.id));
    if (fresh.length && route()[0] === 'medico') {
      const a = fresh[0], p = patient(a.patientId);
      announce(`Nueva cita agendada: ${p.name}, ${fmtDate(a.date)} a las ${fmtTime(a.time)}.`);
    }
    const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (!typing && !$('.sheet-wrap')) render(true);
  }
  if (channel) channel.onmessage = onExternalUpdate;
  window.addEventListener('storage', (e) => { if (e.key === KEY) onExternalUpdate(); });

  /* ---------- Reloj de la barra de estado y tiempos de espera ---------- */
  const clock = () => new Date().toLocaleTimeString('es-CR', { hour: 'numeric', minute: '2-digit', hour12: false });
  function tick() {
    const c = $('.sb-time'); if (c) c.textContent = clock();
    $$('[data-wait]').forEach((el) => { el.textContent = Math.max(0, Math.round((Date.now() - new Date(el.dataset.wait)) / 60000)) + ' min'; });
  }
  setInterval(tick, 30000);

  window.addEventListener('hashchange', () => { if (!location.hash.includes('citas/nueva') && ui.booking && ui.booking.done) ui.booking = null; render(); });
  if (mqWide.addEventListener) { mqWide.addEventListener('change', () => setUiMode(route())); mqDark.addEventListener('change', applyPrefs); }
  applyPrefs(); fitDevice(); tick(); render();
})();
