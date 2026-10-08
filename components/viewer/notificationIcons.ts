import type React from "react";
import { AlarmClock, ClipboardCheck, FilePlus2, Star, UserCheck, Wallet } from "lucide-react";
import type { DemoNotificationKind } from "@/lib/viewer/demoFeed";

export const NOTIFICATION_ICONS: Record<DemoNotificationKind, React.ElementType> = {
  assigned: UserCheck,
  status: ClipboardCheck,
  claim: Wallet,
  access: UserCheck,
  deadline: AlarmClock,
  feedback: Star,
  report: FilePlus2,
};
