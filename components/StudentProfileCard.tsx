"use client";

import React, { useState } from "react";
import { GraduationCap, Pencil } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import StudentFields, { EMPTY_STUDENT, StudentDraft } from "@/components/StudentFields";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { studentProfileErrors } from "@/lib/validation";

/**
 * Who this student is: name, college, roll number, year and branch, read from
 * the signed-in account's own profile. An account created before these fields
 * existed sees a prompt to add them instead of a blank or invented value.
 */
export default function StudentProfileCard() {
  const { userProfile, updateStudentProfile } = useAuthContext();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<StudentDraft>(EMPTY_STUDENT);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!userProfile) return null;
  const student = userProfile.student;
  const errors = studentProfileErrors(draft);

  const start = () => {
    setDraft(student ? { ...student } : EMPTY_STUDENT);
    setSubmitted(false);
    setError("");
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSubmitted(true);
    setError("");
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      await updateStudentProfile(draft);
      toast.success("Details saved", "They now appear on your dashboard.");
      setOpen(false);
    } catch (err) {
      logError("updateStudentProfile", err);
      setError(getFriendlyErrorMessage(err, "Couldn't save your details. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="mb-6 flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5" aria-label="Student details">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand-fg">
          <GraduationCap className="h-5 w-5" aria-hidden="true" />
        </span>
        {student ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-fg">{userProfile.name}</p>
            <p className="text-[13px] text-fg-muted">
              <span>{student.college}</span>
              <span aria-hidden="true"> · </span>
              <span>Roll no. {student.rollNumber}</span>
              <span aria-hidden="true"> · </span>
              <span>{student.academicYear}</span>
              <span aria-hidden="true"> · </span>
              <span>{student.branch}</span>
            </p>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">Add your student details</p>
            <p className="text-[13px] text-fg-muted">College, roll number, academic year and branch. They appear here and help staff recognise your reports.</p>
          </div>
        )}
        <Button size="sm" variant="secondary" onClick={start} icon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />}>
          {student ? "Edit" : "Add details"}
        </Button>
      </Card>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        dismissible={!saving}
        title="Student details"
        description="Only you and campus staff can see these."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="student-details-form" isLoading={saving}>
              Save details
            </Button>
          </>
        }
      >
        <form id="student-details-form" onSubmit={save} className="space-y-4 px-5 py-4" noValidate>
          <StudentFields value={draft} onChange={setDraft} errors={errors} showErrors={submitted} idPrefix="profile" />
          {error && <Notice tone="danger">{error}</Notice>}
        </form>
      </Dialog>
    </>
  );
}
