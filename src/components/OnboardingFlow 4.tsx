import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft } from 'lucide-react';
import { onboardingSlides } from '../data/mockOnboarding';

interface OnboardingFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
  }),
};

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ isOpen, onClose }) => {
  const [[page, direction], setPage] = useState([0, 0]);

  const paginate = (newDirection: number) => {
    setPage([page + newDirection, newDirection]);
  };

  const handleNext = () => {
    if (page < onboardingSlides.length - 1) {
      paginate(1);
    }
  };

  const handleBack = () => {
    if (page > 0) {
      paginate(-1);
    }
  };

  const currentSlide = onboardingSlides[page];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-deep-navy z-[100] flex flex-col items-center justify-center p-4">
      <button onClick={onClose} className="absolute top-4 right-4 p-2 text-text-secondary hover:bg-white/10 rounded-full z-20">
        <X size={24} />
      </button>

      <div className="relative w-full max-w-md h-[80vh] overflow-hidden flex flex-col justify-between">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={page}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            className="absolute w-full h-full flex flex-col justify-center items-center text-center p-6"
          >
            {/* Visual Placeholder */}
            <div className="w-48 h-48 bg-navy-accent rounded-full flex items-center justify-center mb-8 border-4 border-electric-blue/50">
              <p className="text-text-secondary text-sm p-4">{currentSlide.visual_description}</p>
            </div>
            
            <h2 className="text-3xl font-bold text-text-primary mb-2">{currentSlide.title}</h2>
            <p className="text-text-secondary max-w-xs mx-auto">{currentSlide.subtitle}</p>
          </motion.div>
        </AnimatePresence>

        {/* Controls */}
        <div className="relative z-10 w-full px-6 pb-6">
          {/* Progress Dots */}
          <div className="flex justify-center items-center gap-2 mb-8">
            {onboardingSlides.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i === page ? 'bg-electric-blue scale-125' : 'bg-disabled'
                }`}
              />
            ))}
          </div>

          {/* CTA Buttons */}
          {page < onboardingSlides.length - 1 ? (
            // Not the last slide
            <div className="flex items-center gap-4">
              {page > 0 && (
                <button onClick={handleBack} className="p-3 text-text-secondary hover:bg-white/10 rounded-xl">
                  <ArrowLeft size={20} />
                </button>
              )}
              <button onClick={handleNext} className="primary-button flex-1">
                {currentSlide.cta_text as string}
              </button>
            </div>
          ) : (
            // Last slide
            <div className="space-y-3">
              <button onClick={onClose} className="primary-button w-full">
                {typeof currentSlide.cta_text !== 'string' && currentSlide.cta_text.primary}
              </button>
              <button onClick={onClose} className="w-full py-3 text-sm font-semibold text-text-secondary hover:bg-white/10 rounded-xl">
                {typeof currentSlide.cta_text !== 'string' && currentSlide.cta_text.secondary}
              </button>
              <button onClick={handleBack} className="w-full py-3 text-sm font-semibold text-text-disabled hover:text-text-secondary rounded-xl flex items-center justify-center gap-2">
                <ArrowLeft size={16} />
                Go Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
