import ContactsPagination from "./ContactsPagination";
import ContactsTable from "./ContactsTable";
import type { ContactItem, ContactsPaginationMeta } from "../../types/contacts";

interface ContactsTableSectionProps {
  contacts: ContactItem[];
  isLoading: boolean;
  pagination: ContactsPaginationMeta;
  onToggleStar: (contact: ContactItem) => void;
  onEdit: (contact: ContactItem) => void;
  onDelete: (contact: ContactItem) => void;
  onPageChange: (page: number) => void;
}

function ContactsTableSection({
  contacts,
  isLoading,
  pagination,
  onToggleStar,
  onEdit,
  onDelete,
  onPageChange,
}: ContactsTableSectionProps) {
  return (
    <div>
      <ContactsTable
        contacts={contacts}
        isLoading={isLoading}
        onToggleStar={onToggleStar}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      <ContactsPagination
        pagination={pagination}
        isLoading={isLoading}
        onPageChange={onPageChange}
      />
    </div>
  );
}

export default ContactsTableSection;
