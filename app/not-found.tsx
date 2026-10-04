import Link from "next/link";
import StatusScreen from "@/components/shell/StatusScreen";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <StatusScreen
      code="404"
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved."
      actions={
        <Link href="/" className={buttonClasses("primary")}>
          Back to UniFix
        </Link>
      }
    />
  );
}
