import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  radius: number;
  speed: number;
  alpha: number;
  twinkleDelta: number;
}

export const StarfieldBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationId = 0;
    let width = 0;
    let height = 0;
    let stars: Star[] = [];

    const createStars = (w: number, h: number) => {
      const count = Math.min(180, Math.max(70, Math.floor((w * h) / 9500)));
      stars = Array.from({ length: count }, () => {
        const depth = Math.random();
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          radius: 0.6 + depth * 1.4,
          speed: 0.08 + depth * 0.28,
          alpha: 0.25 + depth * 0.65,
          twinkleDelta: (Math.random() - 0.5) * 0.008,
        };
      });
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      createStars(width, height);
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (const star of stars) {
        if (!prefersReducedMotion) {
          star.x -= star.speed;
          star.y += star.speed * 0.18;
          star.alpha += star.twinkleDelta;

          if (star.alpha > 0.9 || star.alpha < 0.2) {
            star.twinkleDelta *= -1;
          }
          if (star.x < -4) star.x = width + 4;
          if (star.y > height + 4) star.y = -4;
        }

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(219, 234, 254, ${star.alpha.toFixed(2)})`;
        ctx.fill();
      }

      if (!prefersReducedMotion) {
        animationId = window.requestAnimationFrame(render);
      }
    };

    resize();
    render();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      if (animationId) window.cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
};
