import React from 'react';
import { motion } from 'framer-motion';

const confettiColors = ['#FFBA08', '#1E90FF', '#4AF626', '#FF3355', '#A78BFA'];

const ConfettiPiece: React.FC = () => {
  const x = Math.random() * 100;
  const y = -10 - Math.random() * 20;
  const rotation = Math.random() * 360;
  const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: `${x}vw`,
        top: `${y}vh`,
        width: '8px',
        height: '16px',
        backgroundColor: color,
        rotate: rotation,
      }}
      animate={{
        y: '120vh',
        x: x + (Math.random() - 0.5) * 400,
        rotate: rotation + (Math.random() - 0.5) * 720,
      }}
      transition={{
        duration: 3 + Math.random() * 2,
        ease: 'linear',
      }}
    />
  );
};

export const ConfettiExplosion: React.FC = () => {
  const pieces = Array.from({ length: 100 }).map((_, i) => <ConfettiPiece key={i} />);
  return <>{pieces}</>;
};
