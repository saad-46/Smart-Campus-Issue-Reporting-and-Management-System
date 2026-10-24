"use client";

import React, { useMemo, useState } from "react";
import Combobox from "@/components/Combobox";
import { Input, Select } from "@/components/ui/Field";
import { COLLEGE_OPTIONS, OTHER_VALUE, branchOptions } from "@/lib/academics";
import { ACADEMIC_YEARS, LIMITS } from "@/lib/constants";
import { StudentProfileErrors } from "@/lib/validation";
import { StudentProfile } from "@/types";

export type StudentDraft = Record<keyof StudentProfile, string>;
export const EMPTY_STUDENT: StudentDraft = { college: "", rollNumber: "", academicYear: "", branch: "" };

/**
 * College, roll number, academic year and branch: the same four fields at
 * sign-up and when an existing account completes its profile.
 *
 * College and branch are searchable lists. A college or branch that isn't
 * listed is an explicit choice ("isn't listed") that reveals a text field,
 * so free text is never accepted by accident. `errors` are shown once the
 * form has been touched or submitted (`showErrors`).
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
  const collegeListed = COLLEGE_OPTIONS.some((o) => o.value === value.college);
  const [collegeOther, setCollegeOther] = useState(!!value.college && !collegeListed);
  const branches = useMemo(() => (collegeListed ? branchOptions(value.college) : []), [collegeListed, value.college]);
  const branchListed = branches.some((o) => o.value === value.branch);
  const [branchOther, setBranchOther] = useState(!!value.branch && !branchListed && branches.length > 0);

  const collegeChoice = collegeOther ? OTHER_VALUE : collegeListed ? value.college : "";
  const branchChoice = branchOther ? OTHER_VALUE : branchListed ? value.branch : "";
  const err = (key: keyof StudentDraft) => (showErrors ? errors[key] : undefined);

  const pickCollege = (v: string) => {
    if (v === OTHER_VALUE) {
      setCollegeOther(true);
      setBranchOther(false);
      onChange({ ...value, college: collegeListed ? "" : value.college, branch: "" });
      return;
    }
    setCollegeOther(false);
    setBranchOther(false);
    // The branch list belongs to the college: keep the branch only if the new college offers it.
    onChange({ ...value, college: v, branch: branchOptions(v).some((o) => o.value === value.branch) ? value.branch : "" });
  };

  const pickBranch = (v: string) => {
    if (v === OTHER_VALUE) {
      setBranchOther(true);
      onChange({ ...value, branch: "" });
      return;
    }
    setBranchOther(false);
    onChange({ ...value, branch: v });
  };

  const collegeError = err("college") && !collegeOther ? "Choose your college from the list." : err("college");
  const branchError = err("branch") && branches.length > 0 && !branchOther ? "Choose your branch from the list." : err("branch");
  const needCollegeFirst = !collegeListed && !collegeOther;

  return (
    <>
      <Combobox
        id={`${idPrefix}-college`}
        label="College / institution"
        options={COLLEGE_OPTIONS}
        value={collegeChoice}
        onChange={pickCollege}
        otherLabel="My institution isn't listed"
        placeholder="Search for your college"
        error={collegeError}
        required
      />
      {collegeOther && (
        <Input id={`${idPrefix}-college-other`} label="Institution name" autoComplete="organization" maxLength={LIMITS.college} value={value.college} onChange={(e) => onChange({ ...value, college: e.target.value })} error={err("college")} required />
      )}
      <Input id={`${idPrefix}-roll`} label="Roll number" autoComplete="off" autoCapitalize="characters" maxLength={LIMITS.rollNumber} value={value.rollNumber} onChange={(e) => onChange({ ...value, rollNumber: e.target.value })} error={err("rollNumber")} required />
      <Select id={`${idPrefix}-year`} label="Academic year" value={value.academicYear} onChange={(e) => onChange({ ...value, academicYear: e.target.value })} error={err("academicYear")} required>
          <option value="">Choose…</option>
          {ACADEMIC_YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
        {needCollegeFirst ? (
          <Combobox id={`${idPrefix}-branch`} label="Branch / department" options={[]} value="" onChange={() => undefined} disabled placeholder="Choose your college first" error={branchError} required />
        ) : branches.length > 0 ? (
          <Combobox
            id={`${idPrefix}-branch`}
            label="Branch / department"
            options={branches}
            value={branchChoice}
            onChange={pickBranch}
            otherLabel="My branch isn't listed"
            placeholder="Search for your branch"
            error={branchError}
            required
          />
        ) : (
          <Input id={`${idPrefix}-branch`} label="Branch / department" autoComplete="off" maxLength={LIMITS.branch} value={value.branch} onChange={(e) => onChange({ ...value, branch: e.target.value })} error={err("branch")} hint={collegeListed ? "No branch list is available for this college yet." : undefined} required />
        )}
      {branches.length > 0 && branchOther && (
        <Input id={`${idPrefix}-branch-other`} label="Your branch / department" autoComplete="off" maxLength={LIMITS.branch} value={value.branch} onChange={(e) => onChange({ ...value, branch: e.target.value })} error={err("branch")} required />
      )}
    </>
  );
}
