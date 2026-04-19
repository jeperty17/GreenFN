import { Plus } from "lucide-react";
import { Button } from "../ui/button";

interface ContactsHubHeaderProps {
  totalContacts: number;
  onAddContact: () => void;
}

function ContactsHubHeader({
  totalContacts,
  onAddContact,
}: ContactsHubHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1>Contacts</h1>
        <span className="rounded-full bg-secondary px-3 py-0.5 text-sm font-semibold text-primary">
          {totalContacts} contact{totalContacts !== 1 && "s"}
        </span>
      </div>
      <Button
        type="button"
        onClick={onAddContact}
        className="flex items-center gap-1.5"
      >
        <Plus className="h-4 w-4" />
        Add Contact
      </Button>
    </div>
  );
}

export default ContactsHubHeader;
