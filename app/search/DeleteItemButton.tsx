import { useState } from "react";
import DeleteIconButton from "../components/DeleteIconButton";
import { supabase } from "../lib/supabaseClient";

export function DeleteItemButton({ itemId, onDeleted }: { itemId: string, onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("items").delete().eq("id", itemId);
    setBusy(false);
    if (error) {
      setError(error.message);
    } else {
      onDeleted();
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      <DeleteIconButton onClick={handleDelete} disabled={busy} />
      {error && <span style={{ color: "crimson", marginLeft: 8 }}>{error}</span>}
    </span>
  );
}
