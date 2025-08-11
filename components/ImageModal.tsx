import React from 'react';
import { X } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
}

const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, imageUrl }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50"
      onClick={onClose}
    >
      <div 
        className="relative bg-gray-900 p-4 rounded-lg shadow-xl max-w-4xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()} // Prevents modal from closing when clicking on the image
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-white bg-gray-800 rounded-full p-1 hover:bg-gray-700 transition-colors"
          aria-label="Close image view"
        >
          <X className="w-6 h-6" />
        </button>
        <img src={imageUrl} alt="Puzzle full view" className="max-w-full max-h-[85vh] object-contain" />
      </div>
    </div>
  );
};

export default ImageModal; 