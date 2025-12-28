import { useEffect, useRef } from 'react';
import ThreeGlobe from 'three-globe';
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  OrthographicCamera,
  AmbientLight,
  DirectionalLight,
  Color,
  Fog,
  PointLight,
  MeshPhongMaterial,
  PlaneGeometry,
  MeshBasicMaterial,
  ShaderMaterial,
  Mesh,
  Shape,
  ShapeGeometry,
  Group,
  WebGLRenderTarget,
  Vector2,
  Vector4,
  LinearFilter,
  RGBAFormat,
  FloatType,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import countries from '../files/globe-data-min.json';
import cities from '../files/cities.json';
import { vertexShader, fluidShader, displayShader } from '../lib/shaders';
import { config } from '../lib/config';

interface GlobeProps {
  className?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

function hexToThreeColor(hex: string): Color {
  const c = hexToRgb(hex);
  return new Color(c.r, c.g, c.b);
}

const Globe: React.FC<GlobeProps> = ({ className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const globeRef = useRef<ThreeGlobe | null>(null);
  const planeRef = useRef<Mesh | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fluidSimRef = useRef<{
    fluidTarget1: WebGLRenderTarget;
    fluidTarget2: WebGLRenderTarget;
    currentFluidTarget: WebGLRenderTarget;
    previousFluidTarget: WebGLRenderTarget;
    fluidMaterial: ShaderMaterial;
    displayMaterial: ShaderMaterial;
    fluidPlane: Mesh;
    fluidCamera: OrthographicCamera;
    frameCount: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let mouseX = 0;
    let mouseY = 0;
    let windowHalfX = window.innerWidth / 2;
    let windowHalfY = window.innerHeight / 2;

    // Initialize renderer
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Initialize scene, light
    const scene = new Scene();
    scene.add(new AmbientLight(0xbbbbbb, 0.3));
    scene.background = new Color(0x040d21);
    sceneRef.current = scene;

    // Set up fluid simulation render targets
    const width = window.innerWidth;
    const height = window.innerHeight;

    const fluidTarget1 = new WebGLRenderTarget(width, height, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      format: RGBAFormat,
      type: FloatType,
    });

    const fluidTarget2 = new WebGLRenderTarget(width, height, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      format: RGBAFormat,
      type: FloatType,
    });

    let currentFluidTarget = fluidTarget1;
    let previousFluidTarget = fluidTarget2;
    let frameCount = 0;

    // Create fluid simulation material
    const fluidMaterial = new ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Vector2(width, height) },
        iMouse: { value: new Vector4(0, 0, 0, 0) },
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

    // Create display material for the plane
    const displayMaterial = new ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Vector2(width, height) },
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

    // Create orthographic camera for fluid simulation
    const fluidCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create fullscreen plane for fluid simulation (not added to scene)
    const fluidPlane = new Mesh(
      new PlaneGeometry(2, 2),
      fluidMaterial
    );

    // Store fluid simulation state
    fluidSimRef.current = {
      fluidTarget1,
      fluidTarget2,
      currentFluidTarget,
      previousFluidTarget,
      fluidMaterial,
      displayMaterial,
      fluidPlane,
      fluidCamera,
      frameCount,
    };

    // Create vertical plane (horizontal along X axis) with fluid shader
    const planeGeometry = new PlaneGeometry(1200, 1200); // Reduced size, still larger than globe
    const plane = new Mesh(planeGeometry, displayMaterial);
    // Plane is vertical (in X/Y plane) - no rotation needed, default orientation is vertical
    plane.position.set(0, 0, 0); // Centered with the globe (fixed world position)
    scene.add(plane);
    planeRef.current = plane; // Store reference for billboard effect

    // Initialize camera, light
    const camera = new PerspectiveCamera();
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    const dLight = new DirectionalLight(0xffffff, 0.8);
    dLight.position.set(-800, 2000, 400);
    camera.add(dLight);

    const dLight1 = new DirectionalLight(0x4a90e2, 1);
    dLight1.position.set(-200, 500, 200);
    camera.add(dLight1);

    const dLight2 = new PointLight(0x5b9bd5, 0.5);
    dLight2.position.set(-200, 500, 200);
    camera.add(dLight2);

    camera.position.z = 400;
    camera.position.x = 0;
    camera.position.y = 0;

    scene.add(camera);
    cameraRef.current = camera;

    // Additional effects
    scene.fog = new Fog(0x4a90e2, 400, 2000);

    // Initialize controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.01;
    controls.enablePan = true; // Allow free panning
    controls.minDistance = 50; // Allow closer zoom
    controls.maxDistance = 1000; // Allow farther zoom
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1;
    controls.autoRotate = false;

    // Remove polar angle restrictions for free camera movement
    // controls.minPolarAngle = Math.PI / 3.5;
    // controls.maxPolarAngle = Math.PI - Math.PI / 3;
    controlsRef.current = controls;

    // Initialize the Globe
    const Globe = new ThreeGlobe({
      waitForGlobeReady: true,
      animateIn: false, // Disable automatic zoom-in animation
    })
      .hexPolygonsData((countries as any).features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.7)
      .showAtmosphere(false)
      .hexPolygonColor(() => 'rgba(255,255,255, 0.7)')
      // Labels hidden - keeping points visible only
      // .labelsData((cities as any).cities)
      // .labelColor(() => '#ffcb21')
      // .labelDotRadius(0.3)
      // .labelSize((e: any) => e.size)
      // .labelText('text')
      // .labelResolution(6)
      // .labelAltitude(0.01)
      .pointsData((cities as any).cities)
      .pointColor(() => '#ffffff')
      .pointsMerge(true)
      .pointAltitude(0.001)
      .pointRadius(0.1);

    // Rotate globe to show North America (US cities)
    Globe.rotateY(-Math.PI / 2);
    Globe.rotateZ(0);
    const globeMaterial = Globe.globeMaterial() as MeshPhongMaterial;
    globeMaterial.color = new Color(0x1e3a8a);
    globeMaterial.emissiveIntensity = 0;
    globeMaterial.shininess = 0.7;
    globeMaterial.transparent = true;
    globeMaterial.opacity = 0; // Base globe sphere is transparent, hex polygons remain visible

    scene.add(Globe);
    globeRef.current = Globe;

    // Create gold hexagons at the top of each point marker
    const createHexagon = (radius: number) => {
      const shape = new Shape();
      const sides = 6;
      for (let i = 0; i <= sides; i++) {
        const angle = (i / sides) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) {
          shape.moveTo(x, y);
        } else {
          shape.lineTo(x, y);
        }
      }
      return new ShapeGeometry(shape);
    };

    const hexagonGeometry = createHexagon(1); // Size of hexagon
    const hexagonMaterial = new MeshBasicMaterial({
      color: 0xffd700, // Gold color
      transparent: true,
      opacity: 0.9,
    });

    // Create gold hexagons at the top of each point marker
    // Use three-globe's coordinate conversion method
    const hexagonMarkersGroup = new Group();
    (cities as any).cities.forEach((city: any) => {
      const hexagon = new Mesh(hexagonGeometry, hexagonMaterial.clone());

      // Use three-globe's getCoords method to convert lat/lng to 3D position
      // This ensures we use the same coordinate system as the points
      const coords = Globe.getCoords(city.lat, city.lng, 0.001); // 0.01 matches pointAltitude

      hexagon.position.set(coords.x, coords.y, coords.z);

      // Orient hexagon to face outward from globe center
      const normal = hexagon.position.clone().normalize();
      const outwardPoint = hexagon.position.clone().add(normal);
      hexagon.lookAt(outwardPoint);
      hexagon.rotateZ(Math.PI / 6); // Rotate hexagon to be upright

      hexagonMarkersGroup.add(hexagon);
    });

    Globe.add(hexagonMarkersGroup);

    // Mouse move handler
    const onMouseMove = (event: MouseEvent) => {
      mouseX = event.clientX - windowHalfX;
      mouseY = event.clientY - windowHalfY;
    };

    // Window resize handler
    const onWindowResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;

      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      windowHalfX = newWidth / 1.5;
      windowHalfY = newHeight / 1.5;
      rendererRef.current.setSize(newWidth, newHeight);

      // Resize fluid simulation render targets
      if (fluidSimRef.current) {
        fluidSimRef.current.fluidTarget1.setSize(newWidth, newHeight);
        fluidSimRef.current.fluidTarget2.setSize(newWidth, newHeight);
        fluidSimRef.current.fluidMaterial.uniforms.iResolution.value.set(newWidth, newHeight);
        fluidSimRef.current.displayMaterial.uniforms.iResolution.value.set(newWidth, newHeight);
        fluidSimRef.current.frameCount = 0;
      }
    };

    // Animation loop
    const animate = () => {
      if (!cameraRef.current || !controlsRef.current || !rendererRef.current || !sceneRef.current) {
        return;
      }

      const time = performance.now() * 0.001;

      // Update fluid simulation
      if (fluidSimRef.current) {
        const fluid = fluidSimRef.current;

        // Update time and frame
        fluid.fluidMaterial.uniforms.iTime.value = time;
        fluid.displayMaterial.uniforms.iTime.value = time;
        fluid.fluidMaterial.uniforms.iFrame.value = fluid.frameCount;

        // Update config values
        fluid.fluidMaterial.uniforms.uBrushSize.value = config.brushSize;
        fluid.fluidMaterial.uniforms.uBrushStrength.value = config.brushStrength;
        fluid.fluidMaterial.uniforms.uFluidDecay.value = config.fluidDecay;
        fluid.fluidMaterial.uniforms.uTrailLength.value = config.trailLength;
        fluid.fluidMaterial.uniforms.uStopDecay.value = config.stopDecay;

        fluid.displayMaterial.uniforms.uDistortionAmount.value = config.distortionAmount;
        fluid.displayMaterial.uniforms.uColorIntensity.value = config.colorIntensity;
        fluid.displayMaterial.uniforms.uSoftness.value = config.softness;
        fluid.displayMaterial.uniforms.uColor1.value = hexToThreeColor(config.color1);
        fluid.displayMaterial.uniforms.uColor2.value = hexToThreeColor(config.color2);
        fluid.displayMaterial.uniforms.uColor3.value = hexToThreeColor(config.color3);
        fluid.displayMaterial.uniforms.uColor4.value = hexToThreeColor(config.color4);

        // Render fluid simulation to render target
        fluid.fluidMaterial.uniforms.iPreviousFrame.value = fluid.previousFluidTarget.texture;
        renderer.setRenderTarget(fluid.currentFluidTarget);
        renderer.render(fluid.fluidPlane, fluid.fluidCamera);

        // Update display material with fluid texture
        fluid.displayMaterial.uniforms.iFluid.value = fluid.currentFluidTarget.texture;

        // Swap render targets (ping-pong buffer)
        const temp = fluid.currentFluidTarget;
        fluid.currentFluidTarget = fluid.previousFluidTarget;
        fluid.previousFluidTarget = temp;

        fluid.frameCount++;
      }

      // Rotate globe to simulate Earth's daily rotation (one full rotation per day)
      // Rotating around Y-axis (vertical axis) at a rate that completes one rotation in ~24 seconds
      // Adjust the rotation speed: 0.001 = slow, 0.01 = faster
      if (globeRef.current) {
        globeRef.current.rotateY(0.005); // Rotate 0.005 radians per frame (~24 seconds per full rotation at 60fps)
      }

      // Make plane always face the camera (billboard effect)
      if (planeRef.current && cameraRef.current) {
        planeRef.current.lookAt(cameraRef.current.position);
      }

      // Mouse tracking disabled - camera movement is now fully controlled by OrbitControls
      // cameraRef.current.position.x +=
      //   Math.abs(mouseX) <= windowHalfX / 2
      //     ? (mouseX / 2 - cameraRef.current.position.x) * 0.005
      //     : 0;
      // cameraRef.current.position.y += (-mouseY / 2 - cameraRef.current.position.y) * 0.005;
      // cameraRef.current.lookAt(sceneRef.current.position);
      controlsRef.current.update();

      // Render main scene
      renderer.setRenderTarget(null);
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('mousemove', onMouseMove);
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', onWindowResize);
      document.removeEventListener('mousemove', onMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Dispose fluid simulation resources
      if (fluidSimRef.current) {
        fluidSimRef.current.fluidMaterial.dispose();
        fluidSimRef.current.displayMaterial.dispose();
        fluidSimRef.current.fluidPlane.geometry.dispose();
        fluidSimRef.current.fluidTarget1.dispose();
        fluidSimRef.current.fluidTarget2.dispose();
        fluidSimRef.current = null;
      }

      if (containerRef.current && rendererRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
    };
  }, []);

  return <div ref={containerRef} className={className} />;
};

export default Globe;

