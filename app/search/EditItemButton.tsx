import EditIconButton from "../components/EditIconButton";

export function EditItemButton({ itemId, boxCode }: { itemId: string, boxCode: string }) {
  function openEditModal() {
    // Dispatch a custom event to the box page to open the edit modal for this item
    window.dispatchEvent(new CustomEvent("open-edit-item-modal", { detail: { itemId, boxCode } }));
    // Navigate to the box page if not already there
    if (!window.location.pathname.startsWith(`/box/${encodeURIComponent(boxCode)}`)) {
      window.location.href = `/box/${encodeURIComponent(boxCode)}`;
    }
  }
  return (
    <EditIconButton
      onClick={openEditModal}
      title="Edit item"
    />
  );
}
