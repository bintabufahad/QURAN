import React, { useEffect, useRef } from 'react';

interface LightBeam {
  xFrac: number;
  width: number;
  opacity: number;
  speed: number;
  phase: number;
  swayAmp: number;
}

interface GlitterParticle {
  xFrac: number;
  yFrac: number;
  size: number;
  speedY: number;
  driftFreq: number;
  driftAmp: number;
  opacity: number;
  pulse: number;
  pulseSpeed: number;
  isStar: boolean;
  isBokeh: boolean;
}

export const PistachioParticles: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Vertical luminous pistachio (#B6CDA2) light curtains descending from top edge (matching reference image)
    const beams: LightBeam[] = Array.from({ length: 40 }, (_, i) => {
      const spread = (i / 39) * 1.04 - 0.02;
      const distFromCenter = Math.abs(spread - 0.5) * 2;
      const centerWeight = 1 - Math.min(1, distFromCenter * 0.65);
      // Create bright clusters left-of-center & right-of-center like reference image
      const clusterBoost =
        Math.exp(-Math.pow((spread - 0.25) / 0.14, 2)) +
        Math.exp(-Math.pow((spread - 0.72) / 0.15, 2)) +
        Math.exp(-Math.pow((spread - 0.52) / 0.18, 2)) * 0.8;
      return {
        xFrac: spread + (Math.random() - 0.5) * 0.025,
        width: 10 + Math.random() * 52 * (0.55 + centerWeight * 0.75),
        opacity: Math.min(
          0.34,
          (0.06 + Math.random() * 0.15) * (0.5 + clusterBoost * 0.65)
        ),
        speed: 0.006 + Math.random() * 0.013,
        phase: Math.random() * Math.PI * 2,
        swayAmp: 2 + Math.random() * 8,
      };
    });

    // Dense pistachio glitter specks, glowing bokeh orbs, and sharp 4-point star sparkles
    const particles: GlitterParticle[] = Array.from({ length: 380 }, (_, i) => {
      const isStar = i < 24;
      const isBokeh = !isStar && i < 130;
      // Concentrate slightly denser glitter near top curtain & bottom horizon splash
      const yBias = i % 3 === 0 ? 0.55 + Math.random() * 0.18 : Math.random() * 0.725;
      return {
        xFrac: Math.random(),
        yFrac: yBias,
        size: isStar
          ? 5 + Math.random() * 6.5
          : isBokeh
          ? 2.0 + Math.random() * 4.0
          : 0.7 + Math.random() * 1.6,
        speedY: 0.00022 + Math.random() * 0.00058,
        driftFreq: 0.4 + Math.random() * 1.1,
        driftAmp: 0.003 + Math.random() * 0.01,
        opacity: isStar ? 0.8 + Math.random() * 0.2 : 0.28 + Math.random() * 0.72,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.022 + Math.random() * 0.048,
        isStar,
        isBokeh,
      };
    });

    let time = 0;

    const drawFourPointStar = (
      x: number,
      y: number,
      radius: number,
      alpha: number
    ) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.8);
      glow.addColorStop(0, 'rgba(242, 249, 236, 0.98)');
      glow.addColorStop(0.32, 'rgba(182, 205, 162, 0.65)');
      glow.addColorStop(1, 'rgba(182, 205, 162, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#F2F9EC';
      ctx.beginPath();
      ctx.ellipse(x, y, radius * 1.6, Math.max(0.8, radius * 0.14), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(0.8, radius * 0.14), radius * 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const render = () => {
      if (!prefersReducedMotion) {
        time += 0.016;
      }

      const horizonY = Math.round(height * 0.725);

      // 0. Solid pitch-black canvas
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // 1. Intense top-edge radiant pistachio glow pouring down
      const topGlow = ctx.createLinearGradient(0, 0, 0, horizonY * 0.55);
      topGlow.addColorStop(0, 'rgba(182, 205, 162, 0.32)');
      topGlow.addColorStop(0.35, 'rgba(182, 205, 162, 0.12)');
      topGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = topGlow;
      ctx.fillRect(0, 0, width, horizonY * 0.55);

      // 2. Vertical shimmering light curtain rays
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const b of beams) {
        if (!prefersReducedMotion) {
          b.phase += b.speed;
        }
        const bx = b.xFrac * width + Math.sin(b.phase) * b.swayAmp;
        const alpha = b.opacity * (0.76 + 0.24 * Math.sin(b.phase * 1.25));

        const hGrad = ctx.createLinearGradient(bx - b.width / 2, 0, bx + b.width / 2, 0);
        hGrad.addColorStop(0, 'rgba(182, 205, 162, 0)');
        hGrad.addColorStop(0.28, `rgba(182, 205, 162, ${alpha * 0.45})`);
        hGrad.addColorStop(0.5, `rgba(232, 244, 222, ${alpha})`);
        hGrad.addColorStop(0.72, `rgba(182, 205, 162, ${alpha * 0.45})`);
        hGrad.addColorStop(1, 'rgba(182, 205, 162, 0)');

        ctx.fillStyle = hGrad;
        ctx.fillRect(bx - b.width / 2, 0, b.width, horizonY);
      }

      // Soft mid-dark vertical attenuation so beams fade subtly before hitting the bright horizon pool
      ctx.globalCompositeOperation = 'source-over';
      const beamVignette = ctx.createLinearGradient(0, 0, 0, horizonY);
      beamVignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      beamVignette.addColorStop(0.55, 'rgba(0, 0, 0, 0.34)');
      beamVignette.addColorStop(0.88, 'rgba(0, 0, 0, 0.45)');
      beamVignette.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
      ctx.fillStyle = beamVignette;
      ctx.fillRect(0, 0, width, horizonY);
      ctx.restore();

      // 3. Dense pistachio glitter particles, bokeh & 4-point star sparkles
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles) {
        if (!prefersReducedMotion) {
          p.yFrac += p.speedY;
          p.pulse += p.pulseSpeed;
          if (p.yFrac > 0.72) {
            p.yFrac = -0.02;
            p.xFrac = Math.random();
          }
        }

        const px =
          (p.xFrac + Math.sin(time * p.driftFreq + p.pulse) * p.driftAmp) * width;
        const py = p.yFrac * height;
        const twinkle = 0.5 + 0.5 * Math.sin(p.pulse);
        const alpha = Math.max(0.08, Math.min(1, p.opacity * (0.45 + 0.55 * twinkle)));

        if (p.isStar) {
          drawFourPointStar(px, py, p.size * (0.72 + 0.36 * twinkle), alpha);
        } else if (p.isBokeh) {
          const g = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2.1);
          g.addColorStop(0, `rgba(238, 247, 230, ${alpha})`);
          g.addColorStop(0.45, `rgba(182, 205, 162, ${alpha * 0.65})`);
          g.addColorStop(1, 'rgba(182, 205, 162, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, p.size * 2.1, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = twinkle > 0.75 ? '#F2F9EC' : '#B6CDA2';
          ctx.beginPath();
          ctx.arc(px, py, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 4. Dazzling centered horizon glow pool where light meets water
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const poolGlow = ctx.createRadialGradient(
        width * 0.5,
        horizonY,
        4,
        width * 0.5,
        horizonY,
        width * 0.44
      );
      poolGlow.addColorStop(0, 'rgba(246, 251, 241, 0.98)');
      poolGlow.addColorStop(0.14, 'rgba(208, 226, 192, 0.85)');
      poolGlow.addColorStop(0.38, 'rgba(182, 205, 162, 0.35)');
      poolGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.translate(width * 0.5, horizonY);
      ctx.scale(1.45, 0.18);
      ctx.translate(-width * 0.5, -horizonY);
      ctx.fillStyle = poolGlow;
      ctx.fillRect(0, horizonY - width * 0.5, width, width);
      ctx.restore();

      // Crisp horizontal horizon shimmer line
      const hLine = ctx.createLinearGradient(0, horizonY, width, horizonY);
      hLine.addColorStop(0, 'rgba(182, 205, 162, 0.05)');
      hLine.addColorStop(0.25, 'rgba(182, 205, 162, 0.4)');
      hLine.addColorStop(0.5, 'rgba(242, 249, 236, 0.96)');
      hLine.addColorStop(0.75, 'rgba(182, 205, 162, 0.4)');
      hLine.addColorStop(1, 'rgba(182, 205, 162, 0.05)');
      ctx.fillStyle = hLine;
      ctx.fillRect(0, horizonY - 1.5, width, 3);
      ctx.restore();

      // 5. Bottom 27.5%: Glossy black water surface with crisp horizontal ripple reflections
      const waterHeight = height - horizonY;
      if (waterHeight > 0) {
        ctx.save();
        ctx.fillStyle = '#020301';
        ctx.fillRect(0, horizonY, width, waterHeight);

        ctx.globalCompositeOperation = 'lighter';
        const stripH = 2.5;
        for (let dy = 0; dy < waterHeight; dy += stripH) {
          const depthRatio = dy / waterHeight;
          // Multi-frequency wave crest simulation creating dark liquid troughs & bright specular bands
          const wave =
            Math.sin(dy * 0.24 - time * 2.1) * 0.55 +
            Math.cos(dy * 0.11 + time * 1.3) * 0.3 +
            Math.sin(dy * 0.48 - time * 2.9) * 0.15;

          const crest = Math.max(0, wave + 0.18);
          if (crest <= 0.04) continue;

          const fadeOut = Math.pow(1 - depthRatio, 0.72);
          const spreadHalfWidth =
            width * (0.14 + depthRatio * 0.25 + crest * 0.07);
          const shiftX = Math.sin(dy * 0.13 + time * 1.7) * (3 + depthRatio * 20);
          const centerX = width * 0.5 + shiftX;

          const peakAlpha = Math.min(0.78, crest * fadeOut * 0.72);
          const rippleGrad = ctx.createLinearGradient(
            centerX - spreadHalfWidth,
            0,
            centerX + spreadHalfWidth,
            0
          );
          rippleGrad.addColorStop(0, 'rgba(182, 205, 162, 0)');
          rippleGrad.addColorStop(0.26, `rgba(182, 205, 162, ${peakAlpha * 0.38})`);
          rippleGrad.addColorStop(0.5, `rgba(232, 244, 222, ${peakAlpha})`);
          rippleGrad.addColorStop(0.74, `rgba(182, 205, 162, ${peakAlpha * 0.38})`);
          rippleGrad.addColorStop(1, 'rgba(182, 205, 162, 0)');

          ctx.fillStyle = rippleGrad;
          ctx.fillRect(centerX - spreadHalfWidth, horizonY + dy, spreadHalfWidth * 2, stripH - 0.5);

          // Flanking horizontal shimmer ripples under left & right light curtains
          if (crest > 0.38) {
            const sideAlpha = (crest - 0.38) * fadeOut * 0.36;
            const leftX = width * 0.22 + Math.cos(dy * 0.16 - time * 1.4) * 14;
            const rightX = width * 0.78 + Math.sin(dy * 0.16 + time * 1.4) * 14;
            ctx.fillStyle = `rgba(182, 205, 162, ${sideAlpha})`;
            ctx.fillRect(leftX - 55, horizonY + dy, 110, 1.6);
            ctx.fillRect(rightX - 55, horizonY + dy, 110, 1.6);
          }
        }
        ctx.restore();
      }

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: '#000000' }}
    />
  );
};
