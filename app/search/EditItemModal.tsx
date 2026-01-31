import React, { useState } from "react";
import Modal from "../components/Modal";

export default function EditItemModal({
  open,
  item,
  onClose,
  onSave
}: {
  open: boolean;
  item: any;
  onClose: () => void;
  onSave: (updated: any) => void;
}) {
  const [name, setName] = useState(item?.name || "");
  const [desc, setDesc] = useState(item?.description || "");
  const [qty, setQty] = useState(item?.quantity || 0);

  // Add more fields as needed

  function handleSave() {
    onSave({ ...item, name, description: desc, quantity: qty });
  }

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="Edit Item">
      <div className="p-4">
        <h2 className="text-lg font-bold mb-2">Edit Item</h2>
        <label className="block mb-2">
          Name
          <input className="border p-1 w-full" value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label className="block mb-2">
          Description
          <input className="border p-1 w-full" value={desc} onChange={e => setDesc(e.target.value)} />
        </label>
        <label className="block mb-2">
          Quantity
          <input type="number" className="border p-1 w-full" value={qty} onChange={e => setQty(Number(e.target.value))} />
        </label>
        <div className="flex gap-2 mt-4">
          <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={handleSave}>Save</button>
          <button className="bg-gray-300 px-4 py-2 rounded" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
