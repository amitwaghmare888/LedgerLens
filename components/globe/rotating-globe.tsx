import { useState, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector2 } from "three";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { OrbitControls } from "@react-three/drei";
import { Globe } from "./globe";
import { SceneLights } from "./scene-lights";
import { GlobeRouteAnimation } from "@/lib/globe/types";
import { GLOBE_DEFAULTS } from "@/lib/globe/config";

interface RotatingGlobeProps {
  routes: GlobeRouteAnimation[][];
  rotationSpeed?: number;
  paused?: boolean;
  tilt?: number;
  sphereColor?: string;
  dotDensity?: number;
  dotColor?: string;
  twinkleStrength?: number;
  arcColor?: string;
  pathColor?: string;
  animationSpeed?: number;
  ambientIntensity?: number;
  directionalIntensity?: number;
}

const RotatingGlobe = ({
  routes,
  rotationSpeed = GLOBE_DEFAULTS.rotationSpeed,
  paused = false,
  tilt = GLOBE_DEFAULTS.tilt,
  sphereColor = GLOBE_DEFAULTS.sphereColor,
  dotDensity = GLOBE_DEFAULTS.dotDensity,
  dotColor = GLOBE_DEFAULTS.dotColor,
  twinkleStrength = GLOBE_DEFAULTS.twinkleStrength,
  arcColor = GLOBE_DEFAULTS.arcColor,
  pathColor = GLOBE_DEFAULTS.pathColor,
  animationSpeed = GLOBE_DEFAULTS.animationSpeed,
  ambientIntensity = GLOBE_DEFAULTS.ambientIntensity,
  directionalIntensity = GLOBE_DEFAULTS.directionalIntensity,
}: RotatingGlobeProps) => {
  const globeRef = useRef<Group>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  
  // Auto-rotation for the globe object itself
  const autoRotationRef = useRef(0);
  
  // Mouse tracking (refs only - no state updates)
  const mouseRef = useRef(new Vector2(0, 0));
  const isUserDraggingRef = useRef(false);
  
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  // Check for prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Track OrbitControls interaction
  useEffect(() => {
    if (!controlsRef.current) return;

    const controls = controlsRef.current;

    const handleStart = () => {
      isUserDraggingRef.current = true;
    };

    const handleEnd = () => {
      isUserDraggingRef.current = false;
    };

    controls.addEventListener('start', handleStart);
    controls.addEventListener('end', handleEnd);

    return () => {
      controls.removeEventListener('start', handleStart);
      controls.removeEventListener('end', handleEnd);
    };
  }, []);

  useFrame(() => {
    if (!globeRef.current) return;

    // Auto-rotation for globe object
    if (!paused) {
      autoRotationRef.current -= rotationSpeed;
      globeRef.current.rotation.y = autoRotationRef.current;
    }

    // Mouse-follow: Use R3F's pointer events via canvas
    // The canvas receives pointer events automatically from R3F
    if (!reducedMotion && !isUserDraggingRef.current && controlsRef.current) {
      // STRONG mouse influence for VISIBLE response
      const horizontalInfluence = 0.45; // ~26 degrees
      const verticalInfluence = 0.22;   // ~13 degrees
      
      // Calculate target camera angles from mouse position
      const targetAzimuth = mouseRef.current.x * horizontalInfluence;
      const targetPolar = (Math.PI / 2) - (mouseRef.current.y * verticalInfluence);
      
      // Get current OrbitControls angles
      const currentAzimuth = controlsRef.current.getAzimuthalAngle();
      const currentPolar = controlsRef.current.getPolarAngle();
      
      // Smooth interpolation (FAST for visible response)
      const lerpSpeed = 0.12;
      const newAzimuth = currentAzimuth + (targetAzimuth - currentAzimuth) * lerpSpeed;
      const newPolar = currentPolar + (targetPolar - currentPolar) * lerpSpeed;
      
      // Apply through OrbitControls API
      controlsRef.current.setAzimuthalAngle(newAzimuth);
      controlsRef.current.setPolarAngle(newPolar);
    }
  });

  // Register pointer move handler on the canvas
  useEffect(() => {
    if (reducedMotion) return;
    
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      
      // Normalize to -1 to 1 range relative to canvas
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      mouseRef.current.set(x, y);
    };

    const handlePointerLeave = () => {
      // Smoothly return to center when pointer leaves
      mouseRef.current.set(0, 0);
    };

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [reducedMotion]);

  return (
    <>
      <Globe
        ref={globeRef}
        position={[0, 0, 0]}
        routes={routes}
        rotation={[tilt, 0, 0]}
        sphereColor={sphereColor}
        dotDensity={dotDensity}
        dotColor={dotColor}
        twinkleStrength={twinkleStrength}
        arcColor={arcColor}
        pathColor={pathColor}
        animationSpeed={animationSpeed}
      />
      <SceneLights ambientIntensity={ambientIntensity} directionalIntensity={directionalIntensity} />
      <OrbitControls 
        ref={controlsRef}
        enableDamping={false}
        rotateSpeed={0.5}
        enableZoom={true}
        enablePan={false}
        minDistance={30}
        maxDistance={100}
        autoRotate={false}
      />
    </>
  );
};

export { RotatingGlobe };
