/* =========================================================
   data.js — Datos FICTICIOS de demostración
   Clínica Pediátrica Pequeños Pasos (Heredia, Costa Rica)
   Todas las fechas se generan relativas a "hoy" para que
   la demo siempre se vea actual.
   ========================================================= */
(function () {
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
  const isBiz = (d) => d.getDay() !== 0 && d.getDay() !== 6;
  function nextBiz(d, n) { let x = new Date(d), c = 0; while (c < n) { x = addDays(x, 1); if (isBiz(x)) c++; } return x; }
  function bizOnOrAfter(d) { let x = new Date(d); while (!isBiz(x)) x = addDays(x, 1); return x; }

  window.CLINIC = {
    name: 'Clínica Pediátrica Pequeños Pasos',
    city: 'Heredia, Costa Rica',
    address: '200 m norte de la Catedral de Heredia',
    phone: '2260-0000',
    whatsapp: '8800-0000',
    hours: 'Lunes a viernes, de 8:00 a. m. a 4:00 p. m.'
  };

  window.DOCTORS = [
    { id: 'd1', name: 'Dra. Andrea Solís Mora', specialty: 'Pediatría general', days: [1, 2, 3, 4, 5] },
    { id: 'd2', name: 'Dr. Luis Fernando Araya', specialty: 'Pediatría general', days: [1, 2, 3, 4, 5] },
    { id: 'd3', name: 'Dra. Karla Jiménez Brenes', specialty: 'Nutrición pediátrica', days: [2, 4] }
  ];

  window.REASONS = [
    'Control de niño sano',
    'Fiebre, tos o gripe',
    'Dolor de estómago o diarrea',
    'Control de alergias o asma',
    'Vacunación',
    'Revisión de resultados',
    'Chequeo escolar',
    'Otro motivo'
  ];

  /* Esquema de vacunación DE EJEMPLO (no es el esquema oficial) */
  const VACC = [
    ['BCG', 'Dosis única', 0], ['Hepatitis B', '1.ª dosis', 0],
    ['Pentavalente', '1.ª dosis', 2], ['Polio (VPI)', '1.ª dosis', 2], ['Rotavirus', '1.ª dosis', 2], ['Neumococo conjugada', '1.ª dosis', 2],
    ['Pentavalente', '2.ª dosis', 4], ['Polio (VPI)', '2.ª dosis', 4], ['Rotavirus', '2.ª dosis', 4], ['Neumococo conjugada', '2.ª dosis', 4],
    ['Pentavalente', '3.ª dosis', 6], ['Polio (VPI)', '3.ª dosis', 6],
    ['SRP (sarampión, rubéola, paperas)', '1.ª dosis', 12], ['Neumococo conjugada', 'Refuerzo', 12],
    ['Varicela', '1.ª dosis', 15], ['DTP', 'Refuerzo', 18],
    ['SRP (sarampión, rubéola, paperas)', 'Refuerzo', 72], ['Varicela', 'Refuerzo', 72]
  ];
  function vaccinesFor(birth, today) {
    const b = new Date(birth + 'T00:00:00');
    const out = []; let pending = 0;
    VACC.forEach(([name, dose, m], i) => {
      const due = addMonths(b, m);
      if (due <= today) out.push({ id: 'v' + i, name, dose, date: ymd(due), status: 'aplicada' });
      else if (pending < 2) { out.push({ id: 'v' + i, name, dose, date: ymd(due), status: 'pendiente' }); pending++; }
    });
    return out;
  }

  window.buildSeed = function () {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const agendaDay = bizOnOrAfter(today);
    const T = ymd(agendaDay);
    const bd = (years, extraDays) => ymd(addDays(new Date(today.getFullYear() - years, today.getMonth(), today.getDate()), extraDays || 0));
    const now = new Date();

    const patients = [
      { id: 'p1', name: 'Mateo Rojas Vargas', birth: bd(6, -40), sex: 'M', blood: 'O+', cedula: '1-2345-6789', guardianId: 'fam1', guardianName: 'Laura Rojas Vargas', phone: '8888-1234', allergies: ['Penicilina'], conditions: ['Rinitis alérgica'] },
      { id: 'p2', name: 'Sofía Rojas Vargas', birth: bd(2, -20), sex: 'F', blood: 'O+', cedula: '1-2999-1111', guardianId: 'fam1', guardianName: 'Laura Rojas Vargas', phone: '8888-1234', allergies: [], conditions: [] },
      { id: 'p3', name: 'Emma Jiménez Solano', birth: bd(4, -10), sex: 'F', blood: 'A+', guardianId: 'fam2', guardianName: 'Carlos Jiménez', phone: '8777-2200', allergies: [], conditions: [] },
      { id: 'p4', name: 'Santiago Mora Arce', birth: ymd(addDays(today, -280)), sex: 'M', blood: 'B+', guardianId: 'fam3', guardianName: 'Daniela Arce', phone: '8666-3300', allergies: [], conditions: [] },
      { id: 'p5', name: 'Valentina Cruz Brenes', birth: bd(11, -60), sex: 'F', blood: 'O-', guardianId: 'fam4', guardianName: 'Marta Brenes', phone: '8555-4400', allergies: ['Mariscos'], conditions: [] },
      { id: 'p6', name: 'Gabriel Alfaro Quesada', birth: bd(7, -100), sex: 'M', blood: 'A-', guardianId: 'fam5', guardianName: 'Jorge Alfaro', phone: '8444-5500', allergies: ['Ácaros del polvo'], conditions: ['Asma leve'] },
      { id: 'p7', name: 'Camila Soto Chaves', birth: bd(3, -30), sex: 'F', blood: 'AB+', guardianId: 'fam6', guardianName: 'Paola Chaves', phone: '8333-6600', allergies: [], conditions: [] },
      { id: 'p8', name: 'Isabella Vargas Ruiz', birth: bd(5, -15), sex: 'F', blood: 'O+', guardianId: 'fam7', guardianName: 'Ana Ruiz', phone: '8222-7700', allergies: [], conditions: [] },
      { id: 'p9', name: 'Daniel Murillo Campos', birth: bd(8, -90), sex: 'M', blood: 'B+', guardianId: 'fam8', guardianName: 'Esteban Murillo', phone: '8111-8800', allergies: ['Polen'], conditions: ['Rinitis alérgica'] }
    ];
    patients.forEach((p) => { p.vaccines = vaccinesFor(p.birth, today); });

    const bm = (p, months) => ymd(addMonths(new Date(p.birth + 'T00:00:00'), months));
    const P = (id) => patients.find((p) => p.id === id);
    P('p1').growth = [
      { date: bm(P('p1'), 48), weight: 16.5, height: 101 },
      { date: bm(P('p1'), 60), weight: 18.8, height: 108 },
      { date: bm(P('p1'), 72), weight: 21.0, height: 115 }
    ];
    P('p2').growth = [
      { date: bm(P('p2'), 12), weight: 9.4, height: 75 },
      { date: bm(P('p2'), 18), weight: 10.6, height: 81 },
      { date: bm(P('p2'), 24), weight: 11.8, height: 86 }
    ];
    patients.forEach((p) => { if (!p.growth) p.growth = []; });

    const labs = [
      {
        id: 'l1', patientId: 'p1', name: 'Hemograma completo', date: ymd(addDays(today, -28)), lab: 'Laboratorio Clínico Heredia',
        items: [
          { param: 'Hemoglobina', value: '13.1', unit: 'g/dL', ref: '11.5 – 14.5', flag: 'normal' },
          { param: 'Hematocrito', value: '39', unit: '%', ref: '34 – 40', flag: 'normal' },
          { param: 'Leucocitos', value: '7.8', unit: '×10³/µL', ref: '5.0 – 14.5', flag: 'normal' },
          { param: 'Plaquetas', value: '310', unit: '×10³/µL', ref: '150 – 450', flag: 'normal' },
          { param: 'Eosinófilos', value: '6', unit: '%', ref: '0 – 5', flag: 'alto' }
        ],
        note: 'Eosinófilos levemente elevados, compatible con cuadro alérgico. Comentar en el próximo control.'
      },
      {
        id: 'l2', patientId: 'p2', name: 'Hemoglobina, ferritina y vitamina D', date: ymd(addDays(today, -30)), lab: 'Laboratorio Clínico Heredia',
        items: [
          { param: 'Hemoglobina', value: '11.0', unit: 'g/dL', ref: '10.5 – 13.5', flag: 'normal' },
          { param: 'Ferritina', value: '22', unit: 'ng/mL', ref: '12 – 60', flag: 'normal' },
          { param: 'Vitamina D (25-OH)', value: '24', unit: 'ng/mL', ref: '30 – 100', flag: 'bajo' }
        ],
        note: 'Vitamina D baja. Se indicó suplemento (ver tratamientos).'
      }
    ];

    const prescriptions = [
      {
        id: 'r1', patientId: 'p1', date: ymd(addDays(today, -5)), doctorId: 'd1',
        items: [
          { med: 'Loratadina jarabe 5 mg/5 mL', dose: '5 mL por vía oral', instructions: 'Una vez al día, preferiblemente en la noche, durante 14 días.' },
          { med: 'Solución salina nasal', dose: '2 aplicaciones por fosa nasal', instructions: 'Dos veces al día antes de dormir y al levantarse.' }
        ]
      },
      {
        id: 'r2', patientId: 'p2', date: ymd(addDays(today, -30)), doctorId: 'd2',
        items: [{ med: 'Vitamina D3 400 UI gotas', dose: '1 gota', instructions: 'Una vez al día con una comida, durante 60 días.' }]
      }
    ];

    const treatments = [
      { id: 't1', patientId: 'p1', med: 'Loratadina jarabe 5 mg/5 mL', dose: '5 mL', perDay: 1, start: ymd(addDays(today, -5)), end: ymd(addDays(today, 8)), instructions: 'En la noche.', doses: {} },
      { id: 't2', patientId: 'p2', med: 'Vitamina D3 400 UI gotas', dose: '1 gota', perDay: 1, start: ymd(addDays(today, -30)), end: ymd(addDays(today, 30)), instructions: 'Con una comida.', doses: {} }
    ];

    const consultations = [
      { id: 'c1', patientId: 'p1', date: ymd(addDays(today, -5)), doctorId: 'd1', reason: 'Congestión nasal y estornudos', diagnosis: 'Rinitis alérgica', notes: 'Sin fiebre. Mucosa nasal pálida. Se indica antihistamínico y lavados nasales. Evitar penicilina (alergia registrada). Control en 1–2 semanas.' },
      { id: 'c2', patientId: 'p2', date: ymd(addDays(today, -30)), doctorId: 'd2', reason: 'Control de niño sano, 2 años', diagnosis: 'Niña sana. Déficit de vitamina D', notes: 'Peso y talla adecuados para la edad. Desarrollo normal. Se solicita laboratorio y se inicia suplemento.' }
    ];

    const A = (id, patientId, doctorId, date, time, reason, status, extra) =>
      Object.assign({ id, patientId, doctorId, date, time, reason, status, createdAt: new Date().toISOString() }, extra || {});
    const appointments = [
      A('a1', 'p3', 'd1', T, '08:00', 'Control de crecimiento', 'atendida'),
      A('a2', 'p4', 'd1', T, '08:30', 'Vacunación de 9 meses', 'atendida'),
      A('a3', 'p5', 'd1', T, '09:00', 'Dolor de estómago recurrente', 'en_consulta'),
      A('a4', 'p6', 'd1', T, '09:30', 'Seguimiento de asma', 'esperando', { arrivedAt: new Date(now.getTime() - 14 * 60000).toISOString() }),
      A('a5', 'p7', 'd1', T, '10:00', 'Fiebre y tos', 'programada'),
      A('a6', 'p8', 'd2', T, '09:00', 'Chequeo escolar', 'programada'),
      A('a7', 'p9', 'd2', T, '10:00', 'Control de alergias', 'programada'),
      // Familia demo (Laura Rojas)
      A('a8', 'p1', 'd1', ymd(nextBiz(today, 3)), '10:30', 'Control de alergias o asma', 'programada'),
      A('a9', 'p1', 'd1', ymd(addDays(today, -5)), '09:00', 'Fiebre, tos o gripe', 'atendida'),
      A('a10', 'p2', 'd2', ymd(addDays(today, -30)), '09:00', 'Control de niño sano', 'atendida')
    ];

    return {
      meta: { seedDate: ymd(today), v: 1 },
      guardians: [{ id: 'fam1', name: 'Laura Rojas Vargas', phone: '8888-1234', email: 'laura.rojas@ejemplo.cr' }],
      patients, labs, prescriptions, treatments, consultations, appointments
    };
  };
})();
