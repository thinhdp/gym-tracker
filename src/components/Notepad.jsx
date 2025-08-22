import React, { useState, useEffect } from "react";
import { Card, CardContent } from "./ui/Card";
import { Textarea } from "./ui/Input";
import { loadLS, saveLS } from "../lib/storage";

// Storage key for the notepad contents
const K_NOTE = "mgym.note.v1";

/**
 * Standalone notepad that stores its content in localStorage.
 * This component is simple: one free-form note that persists between sessions.
 */
export default function Notepad() {
  // Load existing note from localStorage on mount
  const [content, setContent] = useState(() => loadLS(K_NOTE, ""));

  // Persist changes to localStorage whenever content updates
  useEffect(() => {
    saveLS(K_NOTE, content);
  }, [content]);

  return (
    <Card className="mb-4">
      <CardContent>
        <h2 className="text-lg font-semibold mb-2">Notepad</h2>
        <Textarea
          rows={10}
          placeholder="Write your notes here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </CardContent>
    </Card>
  );
}
