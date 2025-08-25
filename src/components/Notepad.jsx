import React, { useState, useEffect, useRef } from "react";
import { Textarea } from "./ui/Input";
import { loadLS, saveLS } from "../lib/storage";

// Storage key for the notepad contents
const K_NOTE = "mgym.note.v1";

/**
 * Standalone notepad that stores its content in localStorage.
 * This version auto-expands as you type while respecting a maximum
 * height. It allows manual resizing and ensures the initial height
 * isn't too small.
 */
export default function Notepad() {
  // Load existing note from localStorage on mount
  const [content, setContent] = useState(() => loadLS(K_NOTE, ""));
  // Ref for dynamically sizing the textarea
  const textareaRef = useRef(null);

  /*
   * Persist changes to localStorage whenever content updates. Dynamically
   * adjust the textarea height based on its scrollHeight so that the
   * notepad expands to show its content up to a limit. If the user
   * manually resizes the textarea to be larger than the content requires,
   * we respect that size until the content grows beyond it. The height
   * is clamped between a reasonable minimum and a maximum of ~80% of
   * the viewport height.
   */
  useEffect(() => {
    saveLS(K_NOTE, content);
    const el = textareaRef.current;
    if (!el) return;
    const minHeight = 160; // px (roughly 10rem) baseline height
    const maxHeight = window.innerHeight * 0.8;
    // Calculate the ideal height to fit the content
    const neededHeight = Math.min(el.scrollHeight, maxHeight);
    // If the current height is smaller than neededHeight, grow it
    if (el.clientHeight < neededHeight) {
      el.style.height = `${Math.max(neededHeight, minHeight)}px`;
    } else {
      // Otherwise, keep the current height but clamp it to maxHeight
      const current = Math.max(el.clientHeight, minHeight);
      el.style.height = `${Math.min(current, maxHeight)}px`;
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
        className="w-full resize-y overflow-auto border rounded p-2"
        // Set a baseline minHeight via inline style to ensure the textarea
        // isn't extremely short when empty. maxHeight is enforced in
        // the effect above.
        style={{ minHeight: 160 }}
      />
    </div>
  );
}
