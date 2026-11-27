/* =========================================================
   app.js — Prototipo Clínica Pediátrica Pequeños Pasos
   SPA con rutas por hash. Estado en localStorage (con respaldo en
   memoria) y sincronización entre pestañas (BroadcastChannel +
   evento storage) para simular el "tiempo real" del panel médico.
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

  function ageText(birth) {
    const b = parseYmd(birth), n = new Date();
    let months = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
    if (n.getDate() < b.getDate()) months--;
    if (months < 24) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
    const y = Math.floor(months / 12);
    return `${y} años`;
  }

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
      if (raw) {
        const s = JSON.parse(raw);
        if (s.meta && s.meta.seedDate === todayStr()) return s;
      }
    } catch (e) { /* ignorar */ }
    const s = window.buildSeed();
    store.set(KEY, JSON.stringify(s));
    return s;
  }
  let state = loadState();
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('pp_clinic') : null;
  function save() { store.set(KEY, JSON.stringify(state)); if (channel) channel.postMessage('update'); }

  /* ---------- Preferencias de accesibilidad ---------- */
  const PREF_DEFAULTS = { size: 100, contrast: false, spacing: false, links: false, plain: false };
  let prefs = Object.assign({}, PREF_DEFAULTS, JSON.parse(store.get(PREFS) || '{}'));
  function applyPrefs() {
    const h = document.documentElement;
    h.style.fontSize = prefs.size + '%';
    h.dataset.contrast = prefs.contrast ? 'high' : 'normal';
    h.dataset.spacing = prefs.spacing ? 'on' : 'off';
    h.dataset.links = prefs.links ? 'on' : 'off';
    h.dataset.plain = prefs.plain ? 'on' : 'off';
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

  /* ---------- Anuncios (lector de pantalla + aviso visual) ---------- */
  function announce(msg, visual = true) {
    const live = $('#live'); live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30);
    if (visual) {
      const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('#toasts').appendChild(t);
      setTimeout(() => t.remove(), 4500);
    }
  }

  /* ---------- Datos: consultas ---------- */
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

  /* Horarios disponibles */
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
      if (taken.has(t)) return false;
      if (date < todayStr()) return false;
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
    return `<p class="visually-hidden" role="status">${s.length} horarios disponibles</p><div class="slot-grid">${s.map((t, i) => `
      <div class="choice"><input type="radio" name="time" id="slot-${t.replace(':', '')}" value="${t}" ${selected === t ? 'checked' : ''} ${booking ? 'data-booking="time"' : ''}>
      <label for="slot-${t.replace(':', '')}">${fmtTime(t)}</label></div>`).join('')}</div>`;
  }

  /* ---------- Enrutamiento ---------- */
  const ui = { agendaDate: null, agendaDoctor: 'all', patientQuery: '', booking: null };
  function route() { const h = location.hash.replace(/^#\/?/, ''); return h.split('/').filter(Boolean).map(decodeURIComponent); }
  const defaultAgendaDate = () => { let d = new Date(); while (!isBiz(d)) d = addDays(d, 1); return ymd(d); };

  function navFor(parts) {
    const role = parts[0];
    if (role === 'familia') {
      const items = [['familia', '🏠', 'Inicio'], ['familia/citas', '🗓', 'Mis citas'], ['familia/expediente', '📋', 'Expediente'], ['medico', '↔', 'Personal médico']];
      return items;
    }
    if (role === 'medico') {
      return [['medico', '🗓', 'Agenda'], ['medico/pacientes', '👥', 'Pacientes'], ['familia', '↔', 'Familias']];
    }
    return [];
  }
  function renderNav(parts) {
    const items = navFor(parts), nav = $('#nav');
    nav.hidden = !items.length;
    const cur = parts.slice(0, 2).join('/');
    nav.innerHTML = `<ul>${items.map(([href, ico, label]) => {
      const active = href === parts[0] ? parts.length === 1 : (cur === href || (parts.join('/').startsWith(href) && href.includes('/')));
      return `<li><a href="#/${href}" ${active ? 'aria-current="page"' : ''}><span class="ico" aria-hidden="true">${ico}</span><span>${label}</span></a></li>`;
    }).join('')}</ul>`;
  }

  let lastFocusId = null;
  function render(keepFocus) {
    const active = document.activeElement;
    lastFocusId = keepFocus && active && active.dataset ? active.dataset.fid || active.id || null : null;
    const parts = route();
    renderNav(parts);
    const [role, sec, a, b] = parts;
    let out;
    if (!role) out = viewLanding();
    else if (role === 'familia') {
      if (!sec) out = viewFamHome();
      else if (sec === 'citas' && a === 'nueva') out = viewBooking();
      else if (sec === 'citas') out = viewFamAppts();
      else if (sec === 'expediente') out = viewRecord(a, b, false);
      else out = notFound();
    } else if (role === 'medico') {
      if (!sec) out = viewAgenda();
      else if (sec === 'pacientes') out = viewPatients();
      else if (sec === 'paciente') out = viewRecord(a, b, true);
      else out = notFound();
    } else out = notFound();
    const main = $('#main');
    main.innerHTML = out.html;
    document.title = `${out.title} — Pequeños Pasos`;
    if (keepFocus && lastFocusId) {
      const el = document.getElementById(lastFocusId) || $(`[data-fid="${lastFocusId}"]`);
      if (el) { el.focus(); return; }
    }
    if (!keepFocus) { window.scrollTo(0, 0); const h1 = $('h1', main); if (h1) { h1.tabIndex = -1; h1.focus(); } }
  }
  const notFound = () => ({ title: 'No encontrado', html: '<h1>Página no encontrada</h1><p><a href="#/">Volver al inicio</a></p>' });

  /* =========================================================
     VISTAS — General
     ========================================================= */
  function viewLanding() {
    const c = window.CLINIC;
    return {
      title: 'Inicio',
      html: `
      <section class="hero" aria-labelledby="h-hero">
        <h1 id="h-hero">Bienvenidos a ${esc(c.name)}</h1>
        <p>Agende citas, consulte el expediente de sus hijos e hijas y reciba seguimiento de tratamientos, todo desde su celular. Sin filas y sin llamadas.</p>
        <p class="hero__meta">${esc(c.address)}, ${esc(c.city)} · ${esc(c.hours)} · Tel. ${esc(c.phone)}</p>
      </section>
      <ul class="features" aria-label="Beneficios">
        <li><span class="fi" aria-hidden="true">🗓</span>Citas en minutos, sin filas ni llamadas</li>
        <li><span class="fi" aria-hidden="true">📋</span>Expediente y resultados en su celular</li>
        <li><span class="fi" aria-hidden="true">💊</span>Seguimiento de recetas y dosis</li>
        <li><span class="fi" aria-hidden="true">🩺</span>Agenda médica en tiempo real</li>
      </ul>
      <h2>¿Cómo desea ingresar?</h2>
      <p class="muted">En este prototipo no se pide contraseña; elija un perfil para explorar.</p>
      <div class="role-cards">
        <a class="card role-card" href="#/familia"><span class="big-ico" aria-hidden="true">👪</span><h3>Soy padre, madre o encargado</h3><p>Citas, expediente, resultados de laboratorio y recetas.</p></a>
        <a class="card role-card" href="#/medico"><span class="big-ico" aria-hidden="true">🩺</span><h3>Soy personal de la clínica</h3><p>Agenda en tiempo real, registro de llegada y expedientes.</p></a>
      </div>`
    };
  }

  function apptCard(a, opts = {}) {
    const p = patient(a.patientId), d = doctor(a.doctorId);
    const future = ['programada'].includes(a.status) && apptTime(a) >= new Date();
    return `
      <article class="card appt" aria-label="Cita de ${esc(p.name)}, ${esc(fmtDate(a.date))}">
        <div class="appt__when">${esc(fmtDate(a.date))} · ${fmtTime(a.time)}</div>
        <div><strong>${esc(p.name)}</strong> · ${esc(a.reason)}</div>
        <div class="muted">${esc(d.name)} — ${esc(d.specialty)}</div>
        <div>${badge(a.status)}</div>
        ${future && !opts.readonly ? `<div class="actions">
          <button class="btn btn--sm" data-action="reschedule" data-id="${a.id}" data-fid="re-${a.id}">Reprogramar<span class="visually-hidden"> cita de ${esc(p.name)}</span></button>
          <button class="btn btn--sm btn--danger" data-action="cancel" data-id="${a.id}" data-fid="ca-${a.id}">Cancelar<span class="visually-hidden"> cita de ${esc(p.name)}</span></button>
        </div>` : ''}
      </article>`;
  }

  /* =========================================================
     VISTAS — Familias
     ========================================================= */
  function myUpcoming() {
    const ids = myKidIds(), now = new Date();
    return state.appointments.filter((a) => ids.includes(a.patientId) && a.status === 'programada' && apptTime(a) >= now).sort((x, y) => apptTime(x) - apptTime(y));
  }
  function activeTreatments(ids) {
    const t = todayStr();
    return state.treatments.filter((x) => ids.includes(x.patientId) && x.start <= t && x.end >= t);
  }
  function treatmentRow(t) {
    const p = patient(t.patientId), n = (t.doses[todayStr()] || 0), done = n >= t.perDay;
    return `<li class="card">
      <h3>${esc(t.med)}</h3>
      <p class="muted">${esc(p.name)} · ${esc(t.dose)}, ${t.perDay} ${t.perDay === 1 ? 'vez' : 'veces'} al día · hasta el ${fmtShort(t.end)}${t.instructions ? ' · ' + esc(t.instructions) : ''}</p>
      <div class="progress-row">
        <progress max="${t.perDay}" value="${n}" aria-label="Dosis de hoy de ${esc(t.med)}">${n} de ${t.perDay}</progress>
        <span>Hoy: <strong>${n} de ${t.perDay}</strong> dosis</span>
        <button class="btn btn--sm" data-action="dose" data-id="${t.id}" data-fid="dose-${t.id}" ${done ? 'disabled' : ''}>${done ? 'Dosis de hoy completas ✔' : 'Registrar dosis dada'}<span class="visually-hidden"> de ${esc(t.med)} a ${esc(p.name)}</span></button>
      </div></li>`;
  }

  function viewFamHome() {
    const g = state.guardians[0], next = myUpcoming()[0];
    const kids = myKids(), tr = activeTreatments(myKidIds());
    const labs = state.labs.filter((l) => myKidIds().includes(l.patientId)).sort((a, b) => b.date.localeCompare(a.date))[0];
    return {
      title: 'Inicio',
      html: `
      <div class="page-head"><div><h1>Hola, ${esc(g.name.split(' ')[0])}</h1><p>Esto es lo más importante para hoy.</p></div>
        <a class="btn btn--primary" href="#/familia/citas/nueva">+ Agendar una cita</a></div>
      <div class="grid grid--2">
        <section aria-labelledby="h-next"><h2 id="h-next">Próxima cita</h2>
          ${next ? apptCard(next) : '<div class="card"><p>No tiene citas programadas.</p><a class="btn btn--primary" href="#/familia/citas/nueva">Agendar ahora</a></div>'}
        </section>
        <section aria-labelledby="h-kids"><h2 id="h-kids">Mis hijos e hijas</h2>
          <ul class="list">${kids.map((k) => `<li class="card"><strong>${esc(k.name)}</strong> · ${ageText(k.birth)}
            ${k.allergies.length ? `<div>Alergias: ${k.allergies.map((x) => `<span class="allergy">${esc(x)}</span>`).join('')}</div>` : ''}
            <div class="actions"><a class="btn btn--sm" href="#/familia/expediente/${k.id}">Ver expediente<span class="visually-hidden"> de ${esc(k.name)}</span></a></div></li>`).join('')}</ul>
        </section>
      </div>
      <section aria-labelledby="h-tr" style="margin-top:1.2rem"><h2 id="h-tr">Tratamientos de hoy</h2>
        ${tr.length ? `<ul class="list">${tr.map(treatmentRow).join('')}</ul>` : '<p class="card">No hay tratamientos activos.</p>'}
      </section>
      ${labs ? `<section aria-labelledby="h-lab" style="margin-top:1.2rem"><h2 id="h-lab">Último resultado de laboratorio</h2>
        <div class="card"><strong>${esc(labs.name)}</strong> · ${esc(patient(labs.patientId).name)} · ${fmtShort(labs.date)}
        <div class="actions"><a class="btn btn--sm" href="#/familia/expediente/${labs.patientId}/laboratorio">Ver resultado</a></div></div></section>` : ''}`
    };
  }

  function viewFamAppts() {
    const ids = myKidIds(), now = new Date();
    const all = state.appointments.filter((a) => ids.includes(a.patientId));
    const up = all.filter((a) => a.status === 'programada' && apptTime(a) >= now).sort((x, y) => apptTime(x) - apptTime(y));
    const past = all.filter((a) => !up.includes(a)).sort((x, y) => apptTime(y) - apptTime(x));
    return {
      title: 'Mis citas',
      html: `
      <div class="page-head"><div><h1>Mis citas</h1><p>Reprograme o cancele sin llamar a la clínica.</p></div>
        <a class="btn btn--primary" href="#/familia/citas/nueva">+ Agendar una cita</a></div>
      <section aria-labelledby="h-up"><h2 id="h-up">Próximas (${up.length})</h2>
        ${up.length ? `<div class="stack">${up.map((a) => apptCard(a)).join('')}</div>` : '<p class="card">No tiene citas próximas.</p>'}</section>
      <section aria-labelledby="h-past" style="margin-top:1.4rem"><h2 id="h-past">Historial</h2>
        ${past.length ? `<div class="stack">${past.map((a) => apptCard(a, { readonly: true })).join('')}</div>` : '<p class="card">Aún no hay historial.</p>'}</section>`
    };
  }

  /* ---------- Asistente de nueva cita ---------- */
  function viewBooking() {
    if (!ui.booking) ui.booking = { step: 1, patientId: myKids().length === 1 ? myKids()[0].id : '', reason: '', detail: '', doctorId: '', date: '', time: '', error: null, done: null };
    const b = ui.booking;
    if (b.done) {
      const a = state.appointments.find((x) => x.id === b.done), p = patient(a.patientId), d = doctor(a.doctorId);
      return {
        title: 'Cita confirmada',
        html: `<h1>¡Cita confirmada!</h1>
        <div class="alert alert--ok" role="status"><strong>${esc(p.name)}</strong> tiene cita con ${esc(d.name)} el <strong>${esc(fmtDate(a.date))} a las ${fmtTime(a.time)}</strong></div>
        <p>Llegue 10 minutos antes. Si no puede asistir, cancele o reprograme con anticipación para que otra familia use ese espacio.</p>
        <div class="actions"><a class="btn btn--primary" href="#/familia/citas" data-action="booking-reset">Ver mis citas</a><a class="btn" href="#/familia" data-action="booking-reset">Ir al inicio</a></div>`
      };
    }
    const names = ['Paciente', 'Motivo y médico', 'Fecha y hora', 'Confirmar'];
    const stepper = `<ol class="steps" aria-label="Pasos para agendar">${names.map((n, i) => `<li ${b.step === i + 1 ? 'aria-current="step"' : ''} class="${b.step > i + 1 ? 'done' : ''}"><span class="visually-hidden">Paso </span>${i + 1}. ${n}${b.step > i + 1 ? '<span class="visually-hidden"> (completado)</span>' : ''}</li>`).join('')}</ol>`;
    const err = b.error ? `<div class="error-summary" role="alert" tabindex="-1" id="booking-error"><strong>Revise lo siguiente:</strong><ul><li>${esc(b.error)}</li></ul></div>` : '';
    let body = '';
    if (b.step === 1) {
      body = `<fieldset><legend>¿Para quién es la cita?</legend><div class="choice-grid">${myKids().map((k) => `
        <div class="choice"><input type="radio" name="patientId" id="k-${k.id}" value="${k.id}" ${b.patientId === k.id ? 'checked' : ''} data-booking="patientId"><label for="k-${k.id}">${esc(k.name)}<small>${ageText(k.birth)}</small></label></div>`).join('')}</div></fieldset>`;
    } else if (b.step === 2) {
      body = `<div class="field"><label for="reason">Motivo de la consulta</label>
        <select id="reason" data-booking="reason" ${b.error ? 'aria-invalid="true"' : ''}><option value="">Seleccione un motivo…</option>${window.REASONS.map((r) => `<option ${b.reason === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></div>
        <div class="field"><label for="detail">Detalle <span class="hint">Opcional. Por ejemplo: síntomas o dudas que quiera comentar.</span></label>
        <textarea id="detail" data-booking="detail">${esc(b.detail)}</textarea></div>
        <fieldset><legend>Médico o especialista</legend><div class="choice-grid">${window.DOCTORS.map((d) => `
        <div class="choice"><input type="radio" name="doctorId" id="d-${d.id}" value="${d.id}" ${b.doctorId === d.id ? 'checked' : ''} data-booking="doctorId"><label for="d-${d.id}">${esc(d.name)}<small>${esc(d.specialty)}</small></label></div>`).join('')}</div></fieldset>`;
    } else if (b.step === 3) {
      const max = ymd(addDays(new Date(), 60));
      body = `<div class="field"><label for="date">Fecha <span class="hint">La clínica atiende de lunes a viernes. Puede agendar hasta con 60 días de anticipación.</span></label>
        <input type="date" id="date" min="${todayStr()}" max="${max}" value="${esc(b.date)}" data-slot-date data-box="#slotbox" data-booking="date"></div>
        <fieldset><legend>Horarios disponibles</legend><div id="slotbox" data-doctor="${b.doctorId}" data-booking-box="1">${slotsHtml(b.doctorId, b.date, b.time, null, true)}</div></fieldset>`;
    } else {
      const p = patient(b.patientId), d = doctor(b.doctorId);
      body = `<h2>Revise los datos</h2><dl class="card" style="margin:0 0 1rem">
        <dt><strong>Paciente</strong></dt><dd>${esc(p.name)}</dd>
        <dt><strong>Motivo</strong></dt><dd>${esc(b.reason)}${b.detail ? ' — ' + esc(b.detail) : ''}</dd>
        <dt><strong>Médico</strong></dt><dd>${esc(d.name)} (${esc(d.specialty)})</dd>
        <dt><strong>Fecha y hora</strong></dt><dd>${esc(fmtDate(b.date))}, ${fmtTime(b.time)}</dd></dl>`;
    }
    return {
      title: 'Agendar cita',
      html: `<p class="crumbs"><a href="#/familia/citas" data-action="booking-reset">← Mis citas</a></p>
      <h1>Agendar una cita</h1>${stepper}${err}
      <form data-form="booking" novalidate>${body}
        <div class="actions">
          ${b.step > 1 ? '<button type="button" class="btn" data-action="booking-back">Atrás</button>' : ''}
          <button type="submit" class="btn btn--primary">${b.step === 4 ? 'Confirmar cita' : 'Continuar'}</button>
        </div></form>`
    };
  }
  function bookingNext() {
    const b = ui.booking; b.error = null;
    if (b.step === 1 && !b.patientId) b.error = 'Seleccione para quién es la cita.';
    else if (b.step === 2 && !b.reason) b.error = 'Seleccione el motivo de la consulta.';
    else if (b.step === 2 && !b.doctorId) b.error = 'Seleccione un médico o especialista.';
    else if (b.step === 3 && !b.date) b.error = 'Elija una fecha.';
    else if (b.step === 3 && !b.time) b.error = 'Elija un horario disponible.';
    if (b.error) { render(); const e = $('#booking-error'); if (e) e.focus(); return; }
    if (b.step < 4) { b.step++; render(); return; }
    // Confirmar
    if (!slotsFor(b.doctorId, b.date).includes(b.time)) { b.error = 'Ese horario acaba de ser ocupado. Elija otro.'; b.step = 3; b.time = ''; render(); const e = $('#booking-error'); if (e) e.focus(); return; }
    const a = { id: uid('a'), patientId: b.patientId, doctorId: b.doctorId, date: b.date, time: b.time, reason: b.reason + (b.detail ? ` — ${b.detail}` : ''), status: 'programada', createdAt: new Date().toISOString() };
    state.appointments.push(a); save(); b.done = a.id; render();
    announce('Cita confirmada.', false);
  }

  /* =========================================================
     EXPEDIENTE (compartido: familias y personal)
     ========================================================= */
  const SECTIONS = [['resumen', 'Resumen'], ['vacunas', 'Vacunas'], ['crecimiento', 'Crecimiento'], ['laboratorio', 'Laboratorio'], ['recetas', 'Recetas y tratamientos']];

  function viewRecord(pid, sec, staff) {
    const base = staff ? '#/medico/paciente' : '#/familia/expediente';
    if (!staff && !pid) {
      const kids = myKids();
      if (kids.length === 1) { pid = kids[0].id; }
      else return {
        title: 'Expediente', html: `<h1>Expediente electrónico</h1><p>Elija a quién desea consultar.</p>
        <div class="role-cards">${kids.map((k) => `<a class="card role-card" href="#/familia/expediente/${k.id}"><h3>${esc(k.name)}</h3><p>${ageText(k.birth)}</p></a>`).join('')}</div>`
      };
    }
    const p = patient(pid);
    if (!p || (!staff && p.guardianId !== FAMILY)) return notFound();
    sec = SECTIONS.some((s) => s[0] === sec) ? sec : 'resumen';
    const fns = { resumen: secResumen, vacunas: secVacunas, crecimiento: secCrecimiento, laboratorio: secLab, recetas: secRecetas };
    const secTitle = SECTIONS.find((s) => s[0] === sec)[1];
    return {
      title: `${p.name} — ${secTitle}`,
      html: `
      ${staff ? '<p class="crumbs"><a href="#/medico/pacientes">← Pacientes</a></p>' : ''}
      <div class="page-head"><div><h1>${esc(p.name)}</h1>
        <p>${ageText(p.birth)} · Nacimiento: ${fmtShort(p.birth)} · Sangre: ${esc(p.blood)}${staff ? ` · Encargado/a: ${esc(p.guardianName)} (${esc(p.phone)})` : ''}</p></div>
        <button class="btn btn--sm no-print" data-action="print">Imprimir esta sección</button></div>
      ${p.allergies.length ? `<div class="alert alert--bad" role="note"><strong>Alergias:</strong> ${p.allergies.map((x) => `<span class="allergy">${esc(x)}</span>`).join('')}</div>` : ''}
      <nav aria-label="Secciones del expediente"><ul class="subnav">${SECTIONS.map(([k, l]) => `<li><a href="${base}/${p.id}/${k}" ${k === sec ? 'aria-current="page"' : ''}>${l}</a></li>`).join('')}</ul></nav>
      <section aria-labelledby="h-sec"><h2 id="h-sec">${secTitle}</h2>${fns[sec](p, staff)}</section>`
    };
  }

  function secResumen(p, staff) {
    const cons = state.consultations.filter((c) => c.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
    const next = state.appointments.filter((a) => a.patientId === p.id && a.status === 'programada' && apptTime(a) >= new Date()).sort((a, b) => apptTime(a) - apptTime(b))[0];
    return `
      <div class="grid grid--2">
        <div class="card"><h3>Datos generales</h3>
          <p><strong>Condiciones:</strong> ${p.conditions.length ? p.conditions.map(esc).join(', ') : 'Ninguna registrada'}</p>
          <p><strong>Próxima cita:</strong> ${next ? `${esc(fmtDate(next.date))}, ${fmtTime(next.time)}` : 'Sin cita programada'}</p></div>
        <div class="card"><h3>Último peso y talla</h3>${p.growth.length ? (() => { const g = p.growth[p.growth.length - 1]; return `<p>${g.weight} kg · ${g.height} cm <span class="muted">(${fmtShort(g.date)})</span></p>`; })() : '<p>Sin mediciones registradas.</p>'}</div>
      </div>
      <h3 style="margin-top:1.2rem">Historial de consultas</h3>
      ${cons.length ? `<ul class="list">${cons.map((c) => `<li class="card"><strong>${esc(fmtShort(c.date))}</strong> · ${esc(doctor(c.doctorId)?.name || '')}<br><strong>Motivo:</strong> ${esc(c.reason)}<br><strong>Diagnóstico:</strong> ${esc(c.diagnosis)}<br><span class="muted">${esc(c.notes)}</span></li>`).join('')}</ul>` : '<p class="card">Sin consultas registradas.</p>'}
      ${staff ? `<h3 style="margin-top:1.2rem">Registrar nota de consulta</h3>
      <form class="card" data-form="note" data-pid="${p.id}" novalidate>
        <div class="field"><label for="n-reason">Motivo de consulta</label><input type="text" id="n-reason" name="reason"></div>
        <div class="field"><label for="n-dx">Diagnóstico</label><input type="text" id="n-dx" name="diagnosis"></div>
        <div class="field"><label for="n-notes">Observaciones y plan</label><textarea id="n-notes" name="notes"></textarea></div>
        <button class="btn btn--primary" type="submit">Guardar nota</button></form>` : ''}`;
  }

  function secVacunas(p) {
    const done = p.vaccines.filter((v) => v.status === 'aplicada').length;
    return `<p class="muted">${done} dosis aplicadas. Esquema de ejemplo para la demostración.</p>
      <div class="table-wrap"><table class="responsive"><caption class="visually-hidden">Vacunas de ${esc(p.name)}</caption>
      <thead><tr><th scope="col">Vacuna</th><th scope="col">Dosis</th><th scope="col">Fecha</th><th scope="col">Estado</th></tr></thead><tbody>
      ${p.vaccines.map((v) => `<tr><td data-label="Vacuna">${esc(v.name)}</td><td data-label="Dosis">${esc(v.dose)}</td><td data-label="Fecha">${fmtShort(v.date)}</td>
      <td data-label="Estado"><span class="badge badge--${v.status}"><span aria-hidden="true">${v.status === 'aplicada' ? '✔' : '⏳'}</span> ${v.status === 'aplicada' ? 'Aplicada' : 'Pendiente'}</span></td></tr>`).join('')}</tbody></table></div>`;
  }

  function secCrecimiento(p) {
    const g = p.growth;
    if (!g.length) return '<p class="card">Aún no hay mediciones registradas.</p>';
    const W = 560, H = 230, L = 46, R = 20, T = 20, B = 40;
    const ws = g.map((x) => x.weight), minW = Math.floor(Math.min(...ws) - 1), maxW = Math.ceil(Math.max(...ws) + 1);
    const x = (i) => L + (g.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (g.length - 1));
    const y = (v) => T + (H - T - B) * (1 - (v - minW) / (maxW - minW));
    const pts = g.map((m, i) => `${x(i)},${y(m.weight)}`).join(' ');
    const desc = `Gráfico de peso: ${g.map((m) => `${fmtShort(m.date)}, ${m.weight} kilogramos`).join('; ')}.`;
    return `<figure style="margin:0 0 1rem"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}">
      <line class="axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/><line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>
      <text x="6" y="${T + 4}">${maxW} kg</text><text x="6" y="${H - B}">${minW} kg</text>
      <polyline class="line" points="${pts}"/>
      ${g.map((m, i) => `<circle class="dot" cx="${x(i)}" cy="${y(m.weight)}" r="6"/><text x="${x(i)}" y="${y(m.weight) - 12}" text-anchor="middle">${m.weight} kg</text><text x="${x(i)}" y="${H - 14}" text-anchor="middle">${fmtShort(m.date)}</text>`).join('')}
      </svg><figcaption class="muted">Evolución del peso. La tabla de abajo tiene los mismos datos.</figcaption></figure>
      <div class="table-wrap"><table class="responsive"><caption class="visually-hidden">Mediciones de peso y talla</caption>
      <thead><tr><th scope="col">Fecha</th><th scope="col">Peso</th><th scope="col">Talla</th></tr></thead>
      <tbody>${g.slice().reverse().map((m) => `<tr><td data-label="Fecha">${fmtShort(m.date)}</td><td data-label="Peso">${m.weight} kg</td><td data-label="Talla">${m.height} cm</td></tr>`).join('')}</tbody></table></div>`;
  }

  function secLab(p) {
    const labs = state.labs.filter((l) => l.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
    if (!labs.length) return '<p class="card">No hay resultados de laboratorio.</p>';
    return `<div class="stack">${labs.map((l) => `<article class="card" aria-label="${esc(l.name)}">
      <h3>${esc(l.name)}</h3><p class="muted">${fmtShort(l.date)} · ${esc(l.lab)}</p>
      <div class="table-wrap"><table class="responsive"><caption class="visually-hidden">Resultados de ${esc(l.name)}</caption>
      <thead><tr><th scope="col">Parámetro</th><th scope="col">Resultado</th><th scope="col">Valores de referencia</th><th scope="col">Estado</th></tr></thead><tbody>
      ${l.items.map((i) => `<tr><td data-label="Parámetro">${esc(i.param)}</td><td data-label="Resultado"><strong>${esc(i.value)}</strong> ${esc(i.unit)}</td><td data-label="Referencia">${esc(i.ref)}</td>
      <td data-label="Estado"><span class="badge badge--${i.flag}"><span aria-hidden="true">${i.flag === 'normal' ? '✔' : i.flag === 'alto' ? '▲' : '▼'}</span> ${i.flag === 'normal' ? 'Normal' : i.flag === 'alto' ? 'Alto' : 'Bajo'}</span></td></tr>`).join('')}</tbody></table></div>
      ${l.note ? `<p class="alert alert--info" style="margin-top:.8rem"><strong>Nota del laboratorio/médico:</strong> ${esc(l.note)}</p>` : ''}
      <p class="muted no-print">Los resultados no sustituyen la valoración médica. Consulte a su pediatra.</p></article>`).join('')}</div>`;
  }

  function secRecetas(p, staff) {
    const rx = state.prescriptions.filter((r) => r.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
    const tr = state.treatments.filter((t) => t.patientId === p.id).sort((a, b) => b.start.localeCompare(a.start));
    const t = todayStr();
    return `
      <h3>Tratamientos en curso</h3>
      ${tr.filter((x) => x.end >= t).length ? `<ul class="list">${tr.filter((x) => x.end >= t).map(treatmentRow).join('')}</ul>` : '<p class="card">No hay tratamientos activos.</p>'}
      <h3 style="margin-top:1.2rem">Recetas</h3>
      ${rx.length ? `<div class="stack">${rx.map((r) => `<article class="card" aria-label="Receta del ${fmtShort(r.date)}"><h4 style="margin:0 0 .4rem">Receta del ${fmtShort(r.date)}</h4><p class="muted">${esc(doctor(r.doctorId)?.name || '')}</p>
        <ul>${r.items.map((i) => `<li><strong>${esc(i.med)}</strong> — ${esc(i.dose)}. ${esc(i.instructions)}</li>`).join('')}</ul></article>`).join('')}</div>` : '<p class="card">No hay recetas.</p>'}
      ${staff ? `<h3 style="margin-top:1.2rem">Nueva receta</h3>
      <form class="card" data-form="rx" data-pid="${p.id}" novalidate>
        <div class="field"><label for="rx-med">Medicamento y concentración</label><input type="text" id="rx-med" name="med"></div>
        <div class="field"><label for="rx-dose">Dosis por toma <span class="hint">Ejemplo: 5 mL por vía oral</span></label><input type="text" id="rx-dose" name="dose"></div>
        <div class="grid grid--2"><div class="field"><label for="rx-per">Veces al día</label><select id="rx-per" name="perDay"><option>1</option><option>2</option><option>3</option><option>4</option></select></div>
        <div class="field"><label for="rx-days">Duración (días)</label><input type="number" id="rx-days" name="days" min="1" max="90" value="7"></div></div>
        <div class="field"><label for="rx-ins">Indicaciones</label><textarea id="rx-ins" name="instructions"></textarea></div>
        <button class="btn btn--primary" type="submit">Emitir receta</button></form>` : ''}`;
  }

  /* =========================================================
     VISTAS — Panel médico
     ========================================================= */
  function waitText(a) {
    if (a.status !== 'esperando' || !a.arrivedAt) return '';
    const min = Math.max(0, Math.round((Date.now() - new Date(a.arrivedAt)) / 60000));
    return `<div class="muted">Espera: <span data-wait="${a.arrivedAt}">${min} min</span></div>`;
  }
  function viewAgenda() {
    if (!ui.agendaDate) ui.agendaDate = defaultAgendaDate();
    const d = ui.agendaDate;
    let list = state.appointments.filter((a) => a.date === d && (ui.agendaDoctor === 'all' || a.doctorId === ui.agendaDoctor)).sort((a, b) => a.time.localeCompare(b.time));
    const act = list.filter((a) => a.status !== 'cancelada');
    const cnt = (s) => act.filter((a) => a.status === s).length;
    const row = (a) => {
      const p = patient(a.patientId), doc = doctor(a.doctorId), k = a.id;
      let btns = '';
      if (a.status === 'programada') btns = `<button class="btn btn--sm" data-action="st" data-st="esperando" data-id="${k}" data-fid="b1-${k}">Registrar llegada<span class="visually-hidden"> de ${esc(p.name)}</span></button><button class="btn btn--sm btn--ghost" data-action="st" data-st="ausente" data-id="${k}" data-fid="b2-${k}">No asistió<span class="visually-hidden">: ${esc(p.name)}</span></button>`;
      else if (a.status === 'esperando') btns = `<button class="btn btn--sm btn--primary" data-action="st" data-st="en_consulta" data-id="${k}" data-fid="b1-${k}">Iniciar consulta<span class="visually-hidden"> de ${esc(p.name)}</span></button>`;
      else if (a.status === 'en_consulta') btns = `<button class="btn btn--sm btn--primary" data-action="st" data-st="atendida" data-id="${k}" data-fid="b1-${k}">Finalizar consulta<span class="visually-hidden"> de ${esc(p.name)}</span></button>`;
      return `<tr>
        <td data-label="Hora"><strong>${fmtTime(a.time)}</strong></td>
        <td data-label="Paciente"><a href="#/medico/paciente/${p.id}">${esc(p.name)}</a><div class="muted">${ageText(p.birth)}</div>${p.allergies.length ? `<div><span class="allergy">Alergia: ${esc(p.allergies.join(', '))}</span></div>` : ''}</td>
        <td data-label="Motivo">${esc(a.reason)}</td>
        <td data-label="Médico">${esc(doc.name)}</td>
        <td data-label="Estado">${badge(a.status)}${waitText(a)}</td>
        <td data-label="Acciones"><div class="actions" style="margin:0">${btns}<a class="btn btn--sm btn--ghost" href="#/medico/paciente/${p.id}">Expediente<span class="visually-hidden"> de ${esc(p.name)}</span></a></div></td></tr>`;
    };
    return {
      title: 'Agenda',
      html: `
      <div class="page-head"><div><h1>Agenda médica</h1><p><span class="live-dot" aria-hidden="true"></span>En vivo — se actualiza cuando una familia agenda o cambia una cita.</p></div></div>
      <div class="card no-print"><div class="grid grid--2">
        <div class="field" style="margin:0"><label for="ag-date">Fecha</label>
          <div class="actions" style="margin:0"><button class="btn btn--sm" data-action="day" data-n="-1" aria-label="Día anterior">←</button>
          <input type="date" id="ag-date" value="${d}" style="max-width:220px" data-ag="date">
          <button class="btn btn--sm" data-action="day" data-n="1" aria-label="Día siguiente">→</button>
          <button class="btn btn--sm" data-action="day-today">Hoy</button></div></div>
        <div class="field" style="margin:0"><label for="ag-doc">Médico</label>
          <select id="ag-doc" data-ag="doctor"><option value="all">Todos</option>${window.DOCTORS.map((x) => `<option value="${x.id}" ${ui.agendaDoctor === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div></div></div>
      <h2 style="margin-top:1.2rem">${esc(fmtDate(d))}</h2>
      <div class="grid grid--stats" role="group" aria-label="Resumen del día" style="margin-bottom:1rem">
        <div class="card stat"><div class="stat__n">${act.length}</div><div class="stat__l">Citas</div></div>
        <div class="card stat"><div class="stat__n">${cnt('esperando')}</div><div class="stat__l">En espera</div></div>
        <div class="card stat"><div class="stat__n">${cnt('en_consulta')}</div><div class="stat__l">En consulta</div></div>
        <div class="card stat"><div class="stat__n">${cnt('atendida')}</div><div class="stat__l">Atendidas</div></div>
      </div>
      ${list.length ? `<div class="table-wrap"><table class="responsive"><caption class="visually-hidden">Citas del ${esc(fmtDate(d))}</caption>
        <thead><tr><th scope="col">Hora</th><th scope="col">Paciente</th><th scope="col">Motivo</th><th scope="col">Médico</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
        <tbody>${list.map(row).join('')}</tbody></table></div>` : '<p class="card">No hay citas para este día.</p>'}`
    };
  }

  function viewPatients() {
    const q = ui.patientQuery.trim().toLowerCase();
    const list = state.patients.filter((p) => !q || p.name.toLowerCase().includes(q) || p.guardianName.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
    return {
      title: 'Pacientes',
      html: `<div class="page-head"><div><h1>Pacientes</h1><p>Busque por nombre del paciente o del encargado.</p></div></div>
      <div class="field"><label for="pq">Buscar</label><input type="search" id="pq" value="${esc(ui.patientQuery)}" data-ag="query" autocomplete="off"></div>
      <p role="status" id="pq-count">${list.length} ${list.length === 1 ? 'paciente' : 'pacientes'}</p>
      <div id="pq-results">${patientTable(list)}</div>`
    };
  }
  function patientTable(list) {
    if (!list.length) return '<p class="card">No se encontraron pacientes.</p>';
    return `<div class="table-wrap"><table class="responsive"><caption class="visually-hidden">Lista de pacientes</caption>
      <thead><tr><th scope="col">Paciente</th><th scope="col">Edad</th><th scope="col">Encargado/a</th><th scope="col">Alertas</th></tr></thead><tbody>
      ${list.map((p) => `<tr><td data-label="Paciente"><a href="#/medico/paciente/${p.id}">${esc(p.name)}</a></td><td data-label="Edad">${ageText(p.birth)}</td><td data-label="Encargado/a">${esc(p.guardianName)}<div class="muted">${esc(p.phone)}</div></td>
      <td data-label="Alertas">${p.allergies.length ? p.allergies.map((x) => `<span class="allergy">${esc(x)}</span>`).join('') : '<span class="muted">Ninguna</span>'}</td></tr>`).join('')}</tbody></table></div>`;
  }

  /* =========================================================
     Diálogos
     ========================================================= */
  function openDialog(html) {
    const d = document.createElement('dialog'); d.className = 'modal'; d.innerHTML = html; d.setAttribute('aria-labelledby', 'dlg-title');
    document.body.appendChild(d); d.addEventListener('close', () => d.remove()); d.showModal(); return d;
  }
  function confirmDialog({ title, body, ok = 'Confirmar', cancel = 'Volver', danger = false }) {
    return new Promise((res) => {
      const d = openDialog(`<form method="dialog"><h2 id="dlg-title">${esc(title)}</h2><p>${body}</p>
        <div class="actions"><button value="cancel" class="btn btn--ghost">${esc(cancel)}</button><button value="ok" class="btn ${danger ? 'btn--danger' : 'btn--primary'}">${esc(ok)}</button></div></form>`);
      d.addEventListener('close', () => res(d.returnValue === 'ok'));
    });
  }
  function rescheduleDialog(a) {
    const p = patient(a.patientId), doc = doctor(a.doctorId);
    openDialog(`<form data-form="reschedule" data-id="${a.id}" novalidate>
      <h2 id="dlg-title">Reprogramar cita</h2>
      <p>${esc(p.name)} con ${esc(doc.name)}. Cita actual: <strong>${esc(fmtDate(a.date))}, ${fmtTime(a.time)}</strong>.</p>
      <div id="dlg-error"></div>
      <div class="field"><label for="rs-date">Nueva fecha</label><input type="date" id="rs-date" name="date" min="${todayStr()}" max="${ymd(addDays(new Date(), 60))}" data-slot-date data-box="#rs-box"></div>
      <fieldset><legend>Horarios disponibles</legend><div id="rs-box" data-doctor="${a.doctorId}" data-ignore="${a.id}"><p class="muted">Elija primero una fecha.</p></div></fieldset>
      <div class="actions"><button type="button" class="btn btn--ghost" data-action="close-dialog">Volver</button><button type="submit" class="btn btn--primary">Guardar cambio</button></div></form>`);
  }

  /* =========================================================
     Eventos
     ========================================================= */
  function setStatus(id, st) {
    const a = state.appointments.find((x) => x.id === id); if (!a) return;
    a.status = st;
    if (st === 'esperando') a.arrivedAt = new Date().toISOString();
    save();
    const p = patient(a.patientId);
    announce(`${p.name}: ${STATUS[st][0].toLowerCase()}.`);
    render(true);
  }

  $('#a11y-fab').addEventListener('click', () => toggleA11y());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#a11y-panel').hidden) toggleA11y(false); });
  document.addEventListener('click', (e) => { const w = e.target.closest('.a11y-widget'); if (!w && !$('#a11y-panel').hidden) toggleA11y(false); });
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-action]'); if (!t) return;
    const act = t.dataset.action, id = t.dataset.id;
    switch (act) {
      case 'font+': prefs.size = Math.min(150, prefs.size + 10); applyPrefs(); break;
      case 'font-': prefs.size = Math.max(90, prefs.size - 10); applyPrefs(); break;
      case 'pref': prefs[t.dataset.pref] = !prefs[t.dataset.pref]; applyPrefs(); break;
      case 'a11y-reset': prefs = Object.assign({}, PREF_DEFAULTS); applyPrefs(); announce('Ajustes de accesibilidad quitados.', false); break;
      case 'print': window.print(); break;
      case 'device': {
        const base = location.href.split('#')[0].split('?')[0];
        const d = openDialog(`<div class="phone-wrap"><div class="phone"><iframe title="Vista de celular de la aplicación" src="${base}?embed=1${location.hash}"></iframe></div>
          <button type="button" class="btn btn--primary" data-action="close-dialog">Volver a vista de escritorio</button></div>`);
        d.classList.add('device-modal'); d.setAttribute('aria-label', 'Vista de celular'); d.removeAttribute('aria-labelledby');
        break;
      }
      case 'close-dialog': t.closest('dialog').close('cancel'); break;
      case 'booking-reset': ui.booking = null; break;
      case 'booking-back': ui.booking.step--; ui.booking.error = null; render(); break;
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
        const ok = await confirmDialog({ title: '¿Cancelar la cita?', body: `Cita de <strong>${esc(p.name)}</strong> el ${esc(fmtDate(a.date))} a las ${fmtTime(a.time)}. El espacio quedará libre para otra familia.`, ok: 'Sí, cancelar cita', cancel: 'No, mantener', danger: true });
        if (ok) { a.status = 'cancelada'; save(); announce('Cita cancelada.'); render(); const h = $('h1'); if (h) h.focus(); }
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
    if (t.dataset.booking && (t.tagName === 'TEXTAREA')) ui.booking[t.dataset.booking] = t.value;
    if (t.dataset.ag === 'query') {
      ui.patientQuery = t.value;
      const q = t.value.trim().toLowerCase();
      const list = state.patients.filter((p) => !q || p.name.toLowerCase().includes(q) || p.guardianName.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
      $('#pq-results').innerHTML = patientTable(list);
      $('#pq-count').textContent = `${list.length} ${list.length === 1 ? 'paciente' : 'pacientes'}`;
    }
  });

  function formErrors(form, errs) {
    let box = $('.error-summary', form);
    if (box) box.remove();
    $$('[aria-invalid]', form).forEach((x) => x.removeAttribute('aria-invalid'));
    if (!errs.length) return false;
    box = document.createElement('div'); box.className = 'error-summary'; box.setAttribute('role', 'alert'); box.tabIndex = -1;
    box.innerHTML = `<strong>Revise lo siguiente:</strong><ul>${errs.map(([n, m]) => `<li>${esc(m)}</li>`).join('')}</ul>`;
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
      a.date = fd.date; a.time = fd.time; save(); form.closest('dialog').close('ok');
      announce(`Cita reprogramada para el ${fmtDate(a.date)} a las ${fmtTime(a.time)}.`); render();
    }
    if (kind === 'note') {
      const errs = [];
      if (!fd.reason.trim()) errs.push(['reason', 'Escriba el motivo de consulta.']);
      if (!fd.diagnosis.trim()) errs.push(['diagnosis', 'Escriba el diagnóstico.']);
      if (formErrors(form, errs)) return;
      state.consultations.push({ id: uid('c'), patientId: form.dataset.pid, date: todayStr(), doctorId: ui.agendaDoctor !== 'all' ? ui.agendaDoctor : 'd1', reason: fd.reason.trim(), diagnosis: fd.diagnosis.trim(), notes: (fd.notes || '').trim() });
      save(); announce('Nota de consulta guardada.'); render(true); const h = $('#h-sec'); if (h) { h.tabIndex = -1; h.focus(); }
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
      save(); announce('Receta emitida. La familia la verá en su expediente.'); render(true); const h = $('#h-sec'); if (h) { h.tabIndex = -1; h.focus(); }
    }
  });

  /* ---------- Sincronización "en tiempo real" entre pestañas ---------- */
  function onExternalUpdate() {
    const before = new Set(state.appointments.map((a) => a.id));
    try { state = JSON.parse(store.get(KEY)); } catch (e) { return; }
    const fresh = state.appointments.filter((a) => !before.has(a.id));
    const parts = route();
    if (fresh.length && parts[0] === 'medico') {
      const a = fresh[0], p = patient(a.patientId);
      announce(`Nueva cita agendada: ${p.name}, ${fmtDate(a.date)} a las ${fmtTime(a.time)}.`);
    }
    const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (!typing && !$('dialog[open]')) render(true);
  }
  if (channel) channel.onmessage = onExternalUpdate;
  window.addEventListener('storage', (e) => { if (e.key === KEY) onExternalUpdate(); });
  setInterval(() => {
    $$('[data-wait]').forEach((el) => { el.textContent = Math.max(0, Math.round((Date.now() - new Date(el.dataset.wait)) / 60000)) + ' min'; });
  }, 30000);

  window.addEventListener('hashchange', () => { if (!location.hash.includes('citas/nueva')) { if (ui.booking && ui.booking.done) ui.booking = null; } render(); });
  if (/[?&]embed=1/.test(location.search)) { const b = $('#device-btn'); if (b) b.remove(); document.documentElement.dataset.embed = 'on'; }
  applyPrefs();
  render();
})();
