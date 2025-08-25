import React, { useState, useEffect, useRef } from "react";
import { Textarea } from "./ui/Input";
import { loadLS, saveLS } from "../lib/storage";

// Storage key for the notepad contents
const K_NOTE = "mgym.note.v1";

/**
 * Standalone notepad that stores its content in localStorage.
 * This version auto‑expands as you type until it reaches a
 * maximum of roughly 80% of the viewport height. Once the
 * content grows beyond that, the textarea becomes scrollable.
 */
export default function Notepad() {
  // Load existing note from localStorage on mount
  const [content, setContent] = useState(() => loadLS(K_NOTE, ""));
  // Ref for dynamically sizing the textarea
  const textareaRef = useRef(null);

  // Persist changes to localStorage whenever content updates and
  // adjust the textarea height based on its scrollHeight
  useEffect(() => {
    saveLS(K_NOTE, content);
    const el = textareaRef.current;
    if (el) {
      // Reset height to auto to calculate the true scrollHeight
      el.style.height = "auto";
      const maxHeight = window.innerHeight * 0.8;
      // Set the height to either scrollHeight or the viewport limit
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    }
  }, [content]);

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-2">Notepad</h2>
      <Textarea
        ref={textareaRef}
        placeholder="Write your notes here..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full resize-none overflow-auto border rounded p-2"
      />
    </div>
  );
}
