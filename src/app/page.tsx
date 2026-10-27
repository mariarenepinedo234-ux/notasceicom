import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { studentResults } from "@/lib/academic";
import { deadlineFor, displayName, localTime, result, shiftName } from "@/lib/rules";
import { Empty, Notice, PageTitle, queryValue, Shell, type Query } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Dashboard({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireUser(), query = await searchParams;
  const student = user.isSuperuser ? null : await db.student.findUnique({ where: { userId: user.id } });
  const offerings = !student ? await db.offering.findMany({
    where: user.isSuperuser ? {} : { teacherId: user.id },
    include: { subject: { include: { career: true } }, module: { include: { year: true } }, teacher: true },
    orderBy: [{ module: { year: { year: "desc" } } }, { module: { number: "asc" } }, { subject: { name: "asc" } }],
  }) : [];
  const enrollments = user.isSuperuser ? await db.enrollment.findMany({
    include: { student: { include: { user: true } }, career: true, year: true },
    orderBy: [{ year: { year: "desc" } }, { student: { code: "asc" } }],
  }) : [];
  const count = user.isSuperuser ? await db.student.count() : 0;
  const events = user.isSuperuser ? await db.auditEvent.findMany({ take: 10, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { actor: true } }) : [];
  const year = queryValue(query, "year"), module = queryValue(query, "module");
  const rows = student ? await studentResults(user.id, year, module) : [];
  const years = student ? await db.enrollment.findMany({ where: { studentId: student.id }, distinct: ["yearId"],
    include: { year: true }, orderBy: { year: { year: "desc" } } }) : [];
  return <Shell><PageTitle eyebrow={user.isSuperuser ? "ADMINISTRACIÓN" : student ? "PORTAL DEL ESTUDIANTE" : "ESPACIO DOCENTE"}
    title={user.isSuperuser ? "Un expediente. Toda su trayectoria." : student ? "Hola, " + (user.firstName || user.username) + "." : "Tus materias, en un solo lugar."}
    description={student ? "Consulta tus resultados publicados, por gestión y módulo." : "Organiza, acompaña y da seguimiento a los resultados académicos."} />
    <Notice query={query} />
    {user.isSuperuser && <>
      <div className="stats"><div className="stat"><small>Estudiantes registrados</small><strong>{count}</strong><Link href="/admin/students">Registrar estudiante →</Link></div>
        <div className="stat"><small>Matrículas anuales</small><strong>{enrollments.length}</strong><Link href="/admin/enrollments">Crear matrícula →</Link></div>
        <div className="stat"><small>Gestiones y módulos</small><strong>4 <em>módulos / gestión</em></strong><Link href="/admin/modules">Administrar períodos →</Link></div></div>
      <section className="panel"><div className="panel-head"><h2>Estudiantes y matrículas</h2><Link href="/admin">Catálogos y usuarios →</Link></div>
        <div className="table-wrap"><table><thead><tr><th>Estudiante</th><th>Carrera / gestión</th><th>Nivel / turno</th><th>Acciones</th></tr></thead><tbody>
          {enrollments.map(e => <tr key={e.id}><td><strong>{displayName(e.student.user)}</strong><small>{e.student.code} · Ingreso {e.student.entryYear}</small></td>
            <td>{e.career.name}<small>Gestión {e.year.year}</small></td><td>Año {e.level} · {shiftName(e.shift)}</td><td className="actions">
              <Link href={"/traslado/" + e.id}>Cambiar turno</Link><Link href={"/consulta/" + e.studentId}>{e.student.canViewGrades ? "Restringir consulta" : "Habilitar consulta"}</Link></td></tr>)}
          {!enrollments.length && <tr><td colSpan={4}>Aún no hay matrículas. Completa los catálogos para empezar.</td></tr>}
        </tbody></table></div></section>
    </>}
    {!student && <section className="panel"><div className="panel-head"><h2>Materias asignadas <span className="count">{offerings.length}</span></h2>
      {user.isSuperuser && <Link href="/admin/offerings">Nueva asignación →</Link>}</div>
      {offerings.map(o => <div className="module" key={o.id}><div><h3>{o.subject.name} <span className="part">Parte {o.subject.part}</span></h3>
        <p>{o.subject.career.name} · Año {o.subject.level} · {o.module.year.year} / Módulo {o.module.number} · {shiftName(o.shift)}</p>
        <small>Docente: {displayName(o.teacher)} · Fin: {o.module.ends.toISOString().slice(0, 10)} · Cierre exclusivo: {localTime(deadlineFor(o.module.ends))}</small></div>
        <Link className="button secondary" href={"/materia/" + o.id}>Abrir planilla →</Link></div>)}
      {!offerings.length && <Empty>No hay materias asignadas a tu cuenta.</Empty>}</section>}
    {student && <>
      <div className="student-summary"><strong>{student.code}</strong><span>Ingreso {student.entryYear}</span><span>Cada parte se aprueba con 61/100. No se promedian las partes.</span></div>
      {!student.canViewGrades ? <section className="notice error"><h2>Consulta de notas temporalmente suspendida</h2><p>Comunícate con administración para habilitar la consulta. Tus notas se conservan.</p></section> :
        <section className="panel"><div className="panel-head"><h2>Mi historial académico</h2><form className="filters" method="get">
          <label>Gestión<select name="year" defaultValue={year}><option value="">Todas</option>{years.map(e => <option key={e.yearId} value={e.year.year}>{e.year.year}</option>)}</select></label>
          <label>Módulo<select name="module" defaultValue={module}><option value="">Todos</option>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></label><button>Filtrar</button></form></div>
          <div className="table-wrap"><table><thead><tr><th>Materia / parte</th><th>Gestión / módulo</th><th>Turno cursado</th><th>Nota</th><th>Resultado</th></tr></thead><tbody>
            {rows.map(r => <tr key={r.id}><td><strong>{r.offering.subject.name} · Parte {r.offering.subject.part}</strong><small>{r.offering.subject.career.name}</small></td>
              <td>{r.enrollment.year.year} · Módulo {r.offering.module.number}</td><td>{shiftName(r.offering.shift)}</td><td className="grade">{r.grade?.toString()} <small>/ 100</small></td>
              <td><span className={"tag " + (Number(r.grade) < 61 ? "locked" : "")}>{result(r.grade)}</span></td></tr>)}
            {!rows.length && <tr><td colSpan={5}>No hay notas publicadas para esta selección.</td></tr>}
          </tbody></table></div></section>}
    </>}
    {user.isSuperuser && <section className="panel"><div className="panel-head"><h2>Últimos movimientos</h2><Link href="/admin/auditoria">Ver auditoría →</Link></div>
      {events.map(e => <div className="module" key={e.id}><div><h3>{e.action}</h3><p>{e.details}</p><small>{displayName(e.actor)} · {localTime(e.createdAt)}</small></div></div>)}
      {!events.length && <Empty>Todavía no hay movimientos.</Empty>}</section>}
  </Shell>;
}
