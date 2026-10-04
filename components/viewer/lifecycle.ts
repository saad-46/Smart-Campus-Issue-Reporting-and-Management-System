// The issue lifecycle as implemented (see README "Features"). Keep this in
// step with the product — Viewer Mode must not describe capabilities that
// don't exist.

export const LIFECYCLE: { title: string; short: string; detail: string; who: string }[] = [
  {
    title: "Report",
    short: "Students report a campus issue.",
    detail: "A title, description and location, with up to three photos — or scan a location's QR code so the place is filled in.",
    who: "Students and staff",
  },
  {
    title: "Classify",
    short: "The system suggests a category and priority.",
    detail: "Keyword rules suggest a category, priority and responsible team with a short explanation. It is not a language model, and staff can change the result.",
    who: "Automatic",
  },
  {
    title: "Detect",
    short: "Possible duplicates and incidents are flagged.",
    detail: "Similar open reports from the last 14 days are suggested before submitting, so repeated reports can be linked into one incident. Nothing is merged or deleted.",
    who: "Automatic, confirmed by people",
  },
  {
    title: "Assign",
    short: "The right worker is assigned.",
    detail: "Administrators assign a worker using ranked suggestions based on category experience, current workload and ratings. Workers can also take open issues from the pool.",
    who: "Administrators and workers",
  },
  {
    title: "Resolve",
    short: "The worker fixes and resolves it.",
    detail: "The worker starts the work, marks it resolved and can attach an expense claim — amount, what it was spent on and a receipt — for an administrator to review.",
    who: "Workers",
  },
  {
    title: "Verify",
    short: "The reporter rates the fix.",
    detail: "The person who reported the issue rates the resolution once, from 1 to 5 stars, with an optional comment.",
    who: "The reporter",
  },
  {
    title: "Analyze",
    short: "Admins monitor SLAs, trends and satisfaction.",
    detail: "Deadlines per priority, trends, the campus map, incidents, worker workload and satisfaction — with CSV/JSON exports that leave out reporter identities.",
    who: "Administrators",
  },
];
