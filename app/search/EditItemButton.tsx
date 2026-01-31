import EditIconButton from "../components/EditIconButton";

export function EditItemButton({ itemId, boxCode }: { itemId: string, boxCode: string }) {
  function openEditModal() {
    // If already on the box page, dispatch the event
    if (window.location.pathname.startsWith(`/box/${encodeURIComponent(boxCode)}`)) {
      window.dispatchEvent(new CustomEvent("open-edit-item-modal", { detail: { itemId, boxCode } }));
    } else {
      // Otherwise, navigate to the box page with a query param
      window.location.href = `/box/${encodeURIComponent(boxCode)}?editItem=${encodeURIComponent(itemId)}`;
    }
  }
  return (
    <EditIconButton
      onClick={openEditModal}
      title="Edit item"
    />
  );
}
