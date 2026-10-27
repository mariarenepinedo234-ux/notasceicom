"use client";
import { useState } from "react";
import { catalogAction } from "@/app/actions";
type Props = { kind: "users" | "students" | "teachers"; recordId?: number; initial?: Record<string, unknown> };
export function PersonForm({ kind, recordId, initial = {} }: Props) {
  const fixedRole = kind === "students" ? "STUDENT" : kind === "teachers" ? "TEACHER" : "";
  const [role, setRole] = useState(fixedRole || String(initial.role ?? "STUDENT"));
  const editing = Boolean(recordId), ciRequired = role !== "ADMIN";
  const val = (key: string) => typeof initial[key] === "string" || typeof initial[key] === "number" ? String(initial[key]) : "";
  return <form action={catalogAction}>
    <input type="hidden" name="kind" value={kind} /><input type="hidden" name="recordId" value={recordId ?? ""} />
    <label>Rol<select aria-label="Rol" name={fixedRole ? undefined : "role"} value={role} disabled={Boolean(fixedRole)} onChange={e => setRole(e.target.value)}>
      <option value="STUDENT">Estudiante</option><option value="TEACHER">Docente</option><option value="ADMIN">Administrador</option></select></label>
    {fixedRole && <input type="hidden" name="role" value={fixedRole} />}
    <label>Carnet de identidad (CI)<input name="ci" defaultValue={val("ci")} required={ciRequired} minLength={4} maxLength={30} autoComplete="off" placeholder="Ej. 1234567 o 1234567-1A" /></label>
    <label>Nombres<input name="firstName" defaultValue={val("firstName")} required={ciRequired} maxLength={150} autoComplete="given-name" /></label>
    <label>Apellidos<input name="lastName" defaultValue={val("lastName")} required={ciRequired} maxLength={150} autoComplete="family-name" /></label>
    <label>Correo electrónico<input name="email" type="email" defaultValue={val("email")} maxLength={254} autoComplete="email" /></label>
    {role === "STUDENT" && <>
      <label>N.º de matrícula / código institucional<input name="code" defaultValue={val("code")} required maxLength={30} /></label>
      <label>Gestión de ingreso<input name="entryYear" type="number" defaultValue={val("entryYear") || new Date().getFullYear()} min={1900} max={2200} required /></label>
      <p className="muted">Este número identifica su expediente. La matrícula anual de carrera, gestión y turno se registra después en Matrículas anuales.</p>
    </>}
    {(editing || role === "ADMIN") ? <>
      <label>Usuario<input name="username" defaultValue={val("username")} required maxLength={150} autoComplete="off" /></label>
      <label>{editing ? "Nueva contraseña (opcional)" : "Contraseña"}<input name="password" type="password" minLength={10} maxLength={256} required={!editing} autoComplete="new-password" /></label>
      {editing && <p className="muted">Deja la contraseña vacía para conservarla. Una contraseña restablecida debe cambiarse al entrar; los cambios de CI no restablecen credenciales.</p>}
    </> : <div className="notice">El usuario y la contraseña temporal serán el CI, escrito sin espacios y con letras en mayúsculas si tiene complemento. Al entrar deberá cambiar la contraseña.</div>}
    <label className="checkbox-label">Cuenta activa<input name="isActive" type="checkbox" defaultChecked={editing ? Boolean(initial.isActive) : true} /></label>
    <button>{editing ? "Guardar cambios" : role === "STUDENT" ? "Registrar estudiante" : role === "TEACHER" ? "Registrar docente" : "Registrar administrador"}</button>
  </form>;
}
