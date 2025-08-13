import React from 'react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, message }) => {
  if (!isOpen) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 transform transition-all text-center"
      >
        <p className="text-gray-200 whitespace-pre-wrap">{message}</p>
        <button
          onClick={onClose}
          className="mt-6 w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default InfoModal;

