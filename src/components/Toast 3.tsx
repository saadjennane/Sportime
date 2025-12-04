import React from 'react';
import { Toast } from '../types';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

const toastIcons = {
  success: <CheckCircle className="text-green-500" />,
  error: <XCircle className="text-red-500" />,
  info: <Info className="text-blue-500" />,
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-5 right-5 z-[100] w-full max-w-xs space-y-2">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: -50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-white rounded-xl shadow-lg p-4 flex items-start gap-3"
          >
            <div className="flex-shrink-0 mt-0.5">{toastIcons[toast.type]}</div>
            <p className="flex-1 text-sm font-medium text-gray-800">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
