import { AlertCircle } from "lucide-react";

interface ContactsErrorBannerProps {
  message: string;
}

function ContactsErrorBanner({ message }: ContactsErrorBannerProps) {
  if (!message) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

export default ContactsErrorBanner;
