import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { Toast } from "../types";

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: Toast["type"] = "info", duration = 3000) => {
      const id = uuidv4();
      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast],
  );

  return { toasts, addToast, removeToast };
};
