import React, { useState, useEffect, useRef } from "react";
// We no longer import the Textarea component from the UI library. A native
// <textarea> is used instead so that we can directly control its height.
import { loadLS, saveLS } from "../lib/storage";

// Storage key for the notepad contents
const K_NOTE = "mgym.note.v1";

/**
 * Standalone notepad that stores its content in localStorage.
 * This version auto-expands as you type until it reaches a
 * maximum of roughly 80% of the viewport height. Once the
 * content grows beyond that, the textarea becomes scrollable.
 */
export default function Notepad() {
  // Load existing note from localStorage on mount
  const [content, setContent] = useState(() => loadLS(K_NOTE, ""));
  // Ref for dynamically sizing the textarea
  const textareaRef = useRef(null);

  /*
   * Persist changes to localStorage whenever content updates and
   * automatically adjust the textarea height. By resetting the height
   * to "auto" before reading scrollHeight, we measure the natural
   * content height. We then set the height to either the content
   * height or a maximum of ~80% of the viewport. We also specify a
   * minimum height (8rem) to avoid a tiny starting box. Users can drag
   * vertically to resize via the Tailwind `resize-y` class.
   */
  useEffect(() => {
    saveLS(K_NOTE, content);
    const el = textareaRef.current;
    if (el) {
      // Ensure a baseline height
      el.style.minHeight = "8rem";
      // Reset height to compute scrollHeight accurately
      el.style.height = "auto";
      const maxHeight = window.innerHeight * 0.8;
      // Limit height to content or maxHeight
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    }
  }, [content]);

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-2">Notepad</h2>
      <textarea
        ref={textareaRef}
        placeholder="Write your notes here..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full resize-y overflow-auto border rounded p-2"
      />
    </div>
  );
}
