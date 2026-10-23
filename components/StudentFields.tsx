"use client";

import React from "react";
import { Input, Select } from "@/components/ui/Field";
import { ACADEMIC_YEARS, LIMITS } from "@/lib/constants";
import { StudentProfileErrors } from "@/lib/validation";
import { StudentProfile } from "@/types";

export type StudentDraft = Record<keyof StudentProfile, string>;
export const EMPTY_STUDENT: StudentDraft = { college: "", rollNumber: "", academicYear: "", branch: "" };

/**
 * College, roll number, academic year and branch: the same four fields at
 * sign-up and when an existing account completes its profile. `errors` are
 * shown once the form has been touched or submitted (`showErrors`).
 */
export default function StudentFields({
  value,
  onChange,
  errors,
  showErrors,
  idPrefix = "student",
}: {
  value: StudentDraft;
  onChange: (next: StudentDraft) => void;
  errors: StudentProfileErrors;
  showErrors: boolean;
  idPrefix?: string;
}) {
  const set = (key: keyof StudentDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [key]: e.target.value });
  const err = (key: keyof StudentDraft) => (showErrors ? errors[key] : undefined);
  return (
    <>
      <Input id={`${idPrefix}-college`} label="College / institution" autoComplete="organization" maxLength={LIMITS.college} value={value.college} onChange={set("college")} error={err("college")} required />
      <Input id={`${idPrefix}-roll`} label="Roll number" autoComplete="off" autoCapitalize="characters" maxLength={LIMITS.rollNumber} value={value.rollNumber} onChange={set("rollNumber")} error={err("rollNumber")} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select id={`${idPrefix}-year`} label="Academic year" value={value.academicYear} onChange={set("academicYear")} error={err("academicYear")} required>
          <option value="">Choose…</option>
          {ACADEMIC_YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
        <Input id={`${idPrefix}-branch`} label="Branch / department" autoComplete="off" maxLength={LIMITS.branch} value={value.branch} onChange={set("branch")} error={err("branch")} required />
      </div>
    </>
  );
}
