import { validGrade, gradeStatus, thirdWeekdayAfter } from './academic-rules.mjs';

const students = [
  {id:1,name:'Ana López Vargas',code:'CEI-001',entry:2024,career:'Sistemas Informáticos',shift:'Mañana',visible:true},
  {id:2,name:'Diego Mamani Rojas',code:'CEI-002',entry:2025,career:'Sistemas Informáticos',shift:'Noche',visible:true},
  {id:3,name:'Lucía Pérez Flores',code:'CEI-003',entry:2024,career:'Contaduría General',shift:'Mañana',visible:false}
];
const records = [
  {student:1,year:2024,module:1,subject:'Programación I',part:1,shift:'Mañana',grade:78,published:true},
  {student:1,year:2024,module:2,subject:'Programación I',part:2,shift:'Mañana',grade:60,published:true},
  {student:1,year:2025,module:2,subject:'Base de datos I',shift:'Mañana',grade:84,published:true},
  {student:1,year:2026,module:1,subject:'Programación I',part:1,shift:'Mañana',grade:null,published:false},
  {student:2,year:2026,module:1,subject:'Programación I',part:1,shift:'Noche',grade:null,published:false},
  {student:3,year:2026,module:1,subject:'Contabilidad I',shift:'Mañana',grade:81,published:true}
];
const movements = [];
let sampleEndDate = '2026-03-31';
const subjectLabel = r => r.subject + (r.part ? ` · Parte ${r.part === 1 ? 'I' : 'II'}` : '');
const content = document.querySelector('#content');
const role = document.querySelector('#role');
let selectedStudent = 1, selectedYear = '', selectedModule = '';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title = (eyebrow,heading,subtitle) => `<div class="heading"><div><div class="eyebrow">${eyebrow}</div><h1>${heading}</h1><p>${subtitle}</p></div><span class="pill">Gestión de ejemplo · 2026</span></div>`;
const table = (heads, rows) => `<div class="table-wrap"><table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
function notify(message){ document.querySelector('#notice').textContent = message; }
function render(){
  document.querySelector('#breadcrumb').textContent = {admin:'Administración',teacher:'Docente',student:'Estudiante'}[role.value];
  notify('');
  if(role.value === 'admin') renderAdmin();
  else if(role.value === 'teacher') renderTeacher();
  else renderStudent();
}
function renderAdmin(){
  content.innerHTML = title('ADMINISTRACIÓN','Un expediente. Toda su trayectoria.','Organiza las matrículas y acompaña el avance de cada estudiante.') +
    `<div class="cards"><div class="card"><small>Estudiantes de muestra</small><div class="number">3</div><span>Dos carreras en esta demostración</span></div><div class="card"><small>Consulta habilitada</small><div class="number">${students.filter(s=>s.visible).length} / 3</div><span>Control manual por administración</span></div><div class="card"><small>Módulos por gestión</small><div class="number">4</div><span>Propuesta de períodos trimestrales</span></div></div>` +
    `<section class="panel"><div class="panel-head"><div><h2>Estudiantes y matrículas</h2><p>Cambia el turno actual sin sobrescribir las notas anteriores.</p></div></div>` +
    table(['ESTUDIANTE','CARRERA / INGRESO','TURNO ACTUAL','CONSULTA DE NOTAS'],students.map(s=>`<tr><td><strong>${s.name}</strong><small>${s.code}</small></td><td>${s.career}<small>Ingreso ${s.entry}</small></td><td><select aria-label="Turno de ${s.name}" data-shift="${s.id}">${['Mañana','Tarde','Noche'].map(v=>`<option ${v===s.shift?'selected':''}>${v}</option>`).join('')}</select></td><td><button class="secondary" data-visibility="${s.id}">${s.visible?'Restringir consulta':'Habilitar consulta'}</button><small>${s.visible?'Habilitada':'Restringida por mensualidades'}</small></td></tr>`)) +
    `<div class="help">Los cambios son solo de demostración. El traslado real validará las materias del destino y registrará responsable, fecha y motivo.</div></section>`+
    `<section class="panel"><div class="panel-head"><h2>Movimientos de turno en esta sesión</h2></div>${movements.length?table(['ESTUDIANTE','MOVIMIENTO','HISTORIAL'],movements.map(m=>`<tr><td>${m.name}</td><td>${m.from} → ${m.to}</td><td>Notas anteriores conservadas</td></tr>`)):'<div class="empty">Todavía no hay movimientos. Puedes probar un cambio de turno arriba.</div>'}</section>`;
  content.querySelectorAll('[data-shift]').forEach(el=>el.addEventListener('change',()=>{
    const s=students.find(s=>s.id===Number(el.dataset.shift));
    movements.push({name:s.name,from:s.shift,to:el.value});
    s.shift=el.value; render(); notify('Turno actual actualizado en la maqueta. El expediente histórico conserva sus turnos originales.');
  }));
  content.querySelectorAll('[data-visibility]').forEach(el=>el.addEventListener('click',()=>{
    const s=students.find(s=>s.id===Number(el.dataset.visibility));s.visible=!s.visible;render();notify(`Consulta de ${s.name}: ${s.visible?'habilitada':'restringida'}. Puedes comprobarlo en la vista Estudiante.`);
  }));
}
function renderTeacher(){
  const assigned=records.filter(r=>r.subject==='Programación I' && r.year===2026);
  content.innerHTML = title('ESPACIO DOCENTE','Tus materias, en un solo lugar.','Docente de ejemplo · Programación I · Parte I · Sistemas Informáticos')+
    `<section class="panel"><div class="module"><div><h2>Módulo 1 · Gestión 2026</h2><p>Escala de 1 a 100 · Aprobación desde 61.</p></div><span class="pill">Borrador de demostración</span></div><div class="help">Tres días completos para cargar notas, excluyendo sábados y domingos. La hora de corte y el tratamiento de feriados están pendientes. Guardar no publica las notas.</div>`+
    `<div class="module"><label>Fin del módulo (ejemplo) <input id="sample-end" type="date" value="${sampleEndDate}"></label><div><strong>Tercer día permitido: <span id="sample-deadline">${thirdWeekdayAfter(sampleEndDate)}</span></strong><small style="display:block">Simulación por fecha; todavía no aplica un bloqueo real.</small></div></div>`+
    `<form id="grades">${table(['ESTUDIANTE','CARRERA','TURNO DE INSCRIPCIÓN','NOTA DE EJEMPLO'],assigned.map(r=>{const s=students.find(s=>s.id===r.student);return `<tr><td>${s.name}<small>${s.code}</small></td><td>${s.career}</td><td>${r.shift}</td><td><input class="grade" aria-label="Nota de ${s.name}" type="number" min="1" max="100" step="any" name="grade-${s.id}" value="${r.grade??''}" placeholder="—"></td></tr>`;}))}<div class="module"><span>Solo datos ficticios · Cambios temporales</span><button type="submit">Guardar borrador</button></div></form></section>`;
  document.querySelector('#sample-end').addEventListener('change', event => {
    try {
      const deadline = thirdWeekdayAfter(event.target.value);
      sampleEndDate = event.target.value;
      document.querySelector('#sample-deadline').textContent = deadline;
    } catch {
      document.querySelector('#sample-deadline').textContent = 'Selecciona una fecha válida';
    }
  });
  document.querySelector('#grades').addEventListener('submit',event=>{
    event.preventDefault();const form=new FormData(event.target);
    const values = assigned.map(r => form.get(`grade-${r.student}`));
    if (values.some(value => value !== '' && !validGrade(Number(value)))) {
      notify('Cada nota debe estar entre 1 y 100. Deja el campo vacío si todavía está pendiente.');
      return;
    }
    assigned.forEach((r,index)=>{r.grade=values[index]===''?null:Number(values[index]);});
    notify('Borrador guardado en memoria. Estas notas todavía no aparecen publicadas para el estudiante.');
  });
}
function renderStudent(){
  const s=students.find(s=>s.id===selectedStudent);
  const published=records.filter(r=>r.student===s.id&&r.published);
  const filtered=published.filter(r=>(!selectedYear||r.year===Number(selectedYear))&&(!selectedModule||r.module===Number(selectedModule)));
  content.innerHTML=title('PORTAL DEL ESTUDIANTE',`Hola, ${esc(s.name.split(' ')[0])}.`,'Tu recorrido académico, materia por materia.')+
    `<section class="panel"><div class="panel-head"><div><h2>${s.career}</h2><p>${s.code} · Ingreso ${s.entry} · Turno actual: ${s.shift}</p></div><label>Estudiante de prueba <select id="student-choice">${students.map(v=>`<option value="${v.id}" ${v.id===s.id?'selected':''}>${v.name}</option>`).join('')}</select></label></div></section>`+
    (s.visible?`<section class="panel"><div class="panel-head"><div><h2>Mi historial de notas</h2><p>Solo resultados publicados. La gestión de ingreso se conserva.</p></div><div class="filters"><select id="year" aria-label="Filtrar por gestión"><option value="">Todas las gestiones</option>${[2024,2025,2026].map(y=>`<option ${selectedYear===String(y)?'selected':''}>${y}</option>`).join('')}</select><select id="module" aria-label="Filtrar por módulo"><option value="">Todos los módulos</option>${[1,2,3,4].map(m=>`<option value="${m}" ${selectedModule===String(m)?'selected':''}>Módulo ${m}</option>`).join('')}</select></div></div>`+
    (filtered.length?table(['MATERIA / PARTE','GESTIÓN','MÓDULO','TURNO CURSADO','NOTA','RESULTADO'],filtered.map(r=>`<tr><td><strong>${subjectLabel(r)}</strong><small><span class="tag">Publicada</span></small></td><td>${r.year}</td><td>Módulo ${r.module}</td><td>${r.shift}</td><td><strong>${r.grade} / 100</strong></td><td><span class="tag ${r.grade < 61 ? 'locked' : ''}">${gradeStatus(r.grade)}</span></td></tr>`)):'<div class="empty">No hay notas publicadas para este filtro.</div>')+`<div class="help">Cada parte se aprueba por separado desde 61/100. Las notas de la Parte I y la Parte II no se promedian ni se compensan entre sí.</div></section>`:
    `<section class="alert"><h2>Consulta de notas temporalmente suspendida</h2><p>Comunícate con administración para regularizar tus mensualidades. Una vez habilitada la consulta, podrás volver a ver tus notas.</p></section>`);
  document.querySelector('#student-choice').addEventListener('change',e=>{selectedStudent=Number(e.target.value);selectedYear='';selectedModule='';render();});
  document.querySelector('#year')?.addEventListener('change',e=>{selectedYear=e.target.value;render();});
  document.querySelector('#module')?.addEventListener('change',e=>{selectedModule=e.target.value;render();});
}
role.addEventListener('change',render);
render();
