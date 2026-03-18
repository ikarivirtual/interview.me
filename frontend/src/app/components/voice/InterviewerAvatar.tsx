import { useEffect, useRef } from "react";

interface InterviewerAvatarProps {
  isSpeaking: boolean;
  isProcessing: boolean;
}

export default function InterviewerAvatar({ isSpeaking, isProcessing }: InterviewerAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const stateRef = useRef({ isSpeaking, isProcessing });

  stateRef.current = { isSpeaking, isProcessing };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 240;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const center = size / 2;
    const radius = size / 2;

    const layers = [
      { x: 0.3, y: 0.2, r: 0.5, color: [255, 255, 255], speed: 0.08, phase: 0 },
      { x: 0.6, y: 0.35, r: 0.4, color: [190, 220, 255], speed: 0.06, phase: 1.5 },
      { x: 0.35, y: 0.55, r: 0.45, color: [60, 140, 255], speed: 0.09, phase: 2.8 },
      { x: 0.65, y: 0.6, r: 0.35, color: [30, 110, 240], speed: 0.07, phase: 4.0 },
      { x: 0.25, y: 0.4, r: 0.3, color: [200, 230, 255], speed: 0.1, phase: 5.2 },
      { x: 0.5, y: 0.75, r: 0.4, color: [20, 100, 230], speed: 0.11, phase: 1.0 },
      { x: 0.7, y: 0.25, r: 0.3, color: [140, 200, 255], speed: 0.05, phase: 3.5 },
    ];

    let time = 0;
    // Smoothly interpolated intensity (0 = idle, 1 = speaking)
    let intensity = 0;

    const draw = () => {
      const { isSpeaking: speaking, isProcessing: processing } = stateRef.current;

      // Target intensity and smooth lerp toward it
      const target = speaking ? 1 : processing ? 0.4 : 0;
      intensity += (target - intensity) * 0.08;

      const speed = 0.005 + intensity * 0.035;
      time += speed;

      // Cloud drift range scales with intensity
      const drift = 0.03 + intensity * 0.22;

      ctx.clearRect(0, 0, size, size);

      // Circular clip
      ctx.save();
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Base gradient — brightens when speaking
      const baseGrad = ctx.createLinearGradient(0, 0, 0, size);
      baseGrad.addColorStop(0, `rgba(${220 + 35 * intensity}, ${240 + 15 * intensity}, 255, 1)`);
      baseGrad.addColorStop(0.45, `rgba(${128 + 40 * intensity}, ${184 + 30 * intensity}, 255, 1)`);
      baseGrad.addColorStop(0.75, `rgba(${48 + 20 * intensity}, ${128 + 20 * intensity}, 255, 1)`);
      baseGrad.addColorStop(1, `rgba(${24 + 10 * intensity}, ${96 + 15 * intensity}, ${224 + 16 * intensity}, 1)`);
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, size, size);

      // Cloud layers — move more and get brighter with intensity
      for (const layer of layers) {
        // Per-layer orbital rotation when speaking — creates visible swirling
        const orbit = intensity * 0.12;
        const orbitAngle = time * layer.speed * 2 + layer.phase;
        const lx = (layer.x + Math.sin(time * layer.speed + layer.phase) * drift + Math.cos(orbitAngle) * orbit) * size;
        const ly = (layer.y + Math.cos(time * layer.speed * 0.7 + layer.phase) * drift * 0.7 + Math.sin(orbitAngle) * orbit) * size;
        const lr = layer.r * size * (0.9 + Math.sin(time * layer.speed * 1.2 + layer.phase) * (0.08 + intensity * 0.2));

        const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
        const [r, g, b] = layer.color;
        const alpha = 0.4 + intensity * 0.2;
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
        grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.35})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
      }

      // Soft white highlight — stronger when speaking
      const sy = center + Math.sin(time * 0.3) * 15;
      const sg = ctx.createRadialGradient(center - 15, sy, 0, center - 15, sy, radius * 0.7);
      const hlAlpha = 0.25 + intensity * 0.2;
      sg.addColorStop(0, `rgba(255, 255, 255, ${hlAlpha})`);
      sg.addColorStop(0.4, `rgba(230, 240, 255, ${hlAlpha * 0.4})`);
      sg.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, size, size);

      ctx.restore();

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div className="relative flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="rounded-full"
        style={{ width: 240, height: 240 }}
      />
    </div>
  );
}
