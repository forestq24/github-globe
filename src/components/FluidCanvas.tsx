import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { vertexShader, fluidShader, displayShader } from '../lib/shaders';
import { config } from '../lib/config';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

function hexToThreeColor(hex: string): THREE.Color {
  const c = hexToRgb(hex);
  return new THREE.Color(c.r, c.g, c.b);
}

export default function FluidCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sceneRef = useRef<{
    camera: THREE.OrthographicCamera;
    renderer: THREE.WebGLRenderer;
    fluidTarget1: THREE.WebGLRenderTarget;
    fluidTarget2: THREE.WebGLRenderTarget;
    currentFluidTarget: THREE.WebGLRenderTarget;
    previousFluidTarget: THREE.WebGLRenderTarget;
    fluidMaterial: THREE.ShaderMaterial;
    displayMaterial: THREE.ShaderMaterial;
    fluidPlane: THREE.Mesh;
    displayPlane: THREE.Mesh;
    frameCount: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Initialize Three.js
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create render targets for ping-pong buffer
    const fluidTarget1 = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    const fluidTarget2 = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    let currentFluidTarget = fluidTarget1;
    let previousFluidTarget = fluidTarget2;
    let frameCount = 0;

    // Create fluid simulation material
    const fluidMaterial = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(width, height) },
        iMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
        iFrame: { value: 0 },
        iPreviousFrame: { value: null },
        uBrushSize: { value: config.brushSize },
        uBrushStrength: { value: config.brushStrength },
        uFluidDecay: { value: config.fluidDecay },
        uTrailLength: { value: config.trailLength },
        uStopDecay: { value: config.stopDecay },
      },
      vertexShader: vertexShader,
      fragmentShader: fluidShader,
    });

    // Create display material
    const displayMaterial = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(width, height) },
        iFluid: { value: null },
        uDistortionAmount: { value: config.distortionAmount },
        uColor1: { value: hexToThreeColor(config.color1) },
        uColor2: { value: hexToThreeColor(config.color2) },
        uColor3: { value: hexToThreeColor(config.color3) },
        uColor4: { value: hexToThreeColor(config.color4) },
        uColorIntensity: { value: config.colorIntensity },
        uSoftness: { value: config.softness },
      },
      vertexShader: vertexShader,
      fragmentShader: displayShader,
    });

    // Create fullscreen planes
    const fluidPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      fluidMaterial
    );

    const displayPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      displayMaterial
    );

    // Store scene state
    sceneRef.current = {
      camera,
      renderer,
      fluidTarget1,
      fluidTarget2,
      currentFluidTarget,
      previousFluidTarget,
      fluidMaterial,
      displayMaterial,
      fluidPlane,
      displayPlane,
      frameCount,
    };

    // Animation loop
    const animate = () => {
      if (!sceneRef.current) return;

      const time = performance.now() * 0.001;
      const scene = sceneRef.current;

      scene.fluidMaterial.uniforms.iTime.value = time;
      scene.displayMaterial.uniforms.iTime.value = time;
      scene.fluidMaterial.uniforms.iFrame.value = scene.frameCount;

      // Update config values
      scene.fluidMaterial.uniforms.uBrushSize.value = config.brushSize;
      scene.fluidMaterial.uniforms.uBrushStrength.value = config.brushStrength;
      scene.fluidMaterial.uniforms.uFluidDecay.value = config.fluidDecay;
      scene.fluidMaterial.uniforms.uTrailLength.value = config.trailLength;
      scene.fluidMaterial.uniforms.uStopDecay.value = config.stopDecay;

      scene.displayMaterial.uniforms.uDistortionAmount.value = config.distortionAmount;
      scene.displayMaterial.uniforms.uColorIntensity.value = config.colorIntensity;
      scene.displayMaterial.uniforms.uSoftness.value = config.softness;
      scene.displayMaterial.uniforms.uColor1.value = hexToThreeColor(config.color1);
      scene.displayMaterial.uniforms.uColor2.value = hexToThreeColor(config.color2);
      scene.displayMaterial.uniforms.uColor3.value = hexToThreeColor(config.color3);
      scene.displayMaterial.uniforms.uColor4.value = hexToThreeColor(config.color4);

      // Render fluid simulation to render target
      scene.fluidMaterial.uniforms.iPreviousFrame.value = scene.previousFluidTarget.texture;
      renderer.setRenderTarget(scene.currentFluidTarget);
      renderer.render(scene.fluidPlane, camera);

      // Render display to screen
      scene.displayMaterial.uniforms.iFluid.value = scene.currentFluidTarget.texture;
      renderer.setRenderTarget(null);
      renderer.render(scene.displayPlane, camera);

      // Swap render targets (ping-pong buffer)
      const temp = scene.currentFluidTarget;
      scene.currentFluidTarget = scene.previousFluidTarget;
      scene.previousFluidTarget = temp;

      scene.frameCount++;
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Resize handler
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      renderer.setSize(width, height);
      fluidMaterial.uniforms.iResolution.value.set(width, height);
      displayMaterial.uniforms.iResolution.value.set(width, height);

      fluidTarget1.setSize(width, height);
      fluidTarget2.setSize(width, height);
      
      if (sceneRef.current) {
        sceneRef.current.frameCount = 0;
      }
    };

    // Add event listeners
    window.addEventListener('resize', handleResize);

    // Start animation
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Dispose of Three.js resources
      fluidMaterial.dispose();
      displayMaterial.dispose();
      fluidPlane.geometry.dispose();
      displayPlane.geometry.dispose();
      fluidTarget1.dispose();
      fluidTarget2.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      sceneRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="gradient-canvas" />;
}

