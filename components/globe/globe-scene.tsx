"use client";

import { Canvas } from "@react-three/fiber";
import { RotatingGlobe } from "./rotating-globe";
import { GlobeRouteAnimation } from "@/lib/globe/types";
import { GLOBE_DEFAULTS } from "@/lib/globe/config";

interface GlobeSceneProps {
  airRoutes: GlobeRouteAnimation[];
  oceanRoutes: GlobeRouteAnimation[];
  className?: string;
}

const GlobeScene = ({ airRoutes, oceanRoutes, className }: GlobeSceneProps) => {
  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <Canvas
        gl={{ antialias: false }}
        camera={{
          fov: 45,
          near: 1,
          far: 500,
          zoom: 1,
          position: [0, 0, 65],
        }}
      >
        <RotatingGlobe
          routes={[airRoutes, oceanRoutes]}
          rotationSpeed={GLOBE_DEFAULTS.rotationSpeed}
          paused={false}
          tilt={GLOBE_DEFAULTS.tilt}
          sphereColor={GLOBE_DEFAULTS.sphereColor}
          dotDensity={GLOBE_DEFAULTS.dotDensity}
          dotColor={GLOBE_DEFAULTS.dotColor}
          twinkleStrength={GLOBE_DEFAULTS.twinkleStrength}
          arcColor={GLOBE_DEFAULTS.arcColor}
          pathColor={GLOBE_DEFAULTS.pathColor}
          animationSpeed={GLOBE_DEFAULTS.animationSpeed}
          ambientIntensity={GLOBE_DEFAULTS.ambientIntensity}
          directionalIntensity={GLOBE_DEFAULTS.directionalIntensity}
        />
      </Canvas>
    </div>
  );
};

export { GlobeScene };
