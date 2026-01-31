import { useRouter } from "next/navigation";
import EditIconButton from "../components/EditIconButton";

export function EditItemButton({ itemId, boxCode }: { itemId: string, boxCode: string }) {
  const router = useRouter();
  return (
    <EditIconButton
      onClick={() => router.push(`/box/${encodeURIComponent(boxCode)}?editItem=${itemId}`)}
      title="Edit item"
    />
  );
}
