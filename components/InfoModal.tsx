import React, { useEffect, useRef } from 'react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, message }) => {
  if (!isOpen) return null;
  const okRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    setTimeout(() => okRef.current?.focus(), 0);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 transform transition-all text-center"
        role="dialog"
        aria-modal="true"
        aria-label="Information"
      >
        <p className="text-gray-200 whitespace-pre-wrap">{message}</p>
        <button
          onClick={onClose}
          ref={okRef}
          className="mt-6 w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default InfoModal;

