import { useEffect, useRef } from 'react';
import ThreeGlobe from 'three-globe';
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  Color,
  Fog,
  PointLight,
  MeshPhongMaterial,
  MeshBasicMaterial,
  Mesh,
  Shape,
  ShapeGeometry,
  Group,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import countries from '../files/globe-data-min.json';
import cities from '../files/cities.json';

interface GlobeProps {
  className?: string;
}

const Globe: React.FC<GlobeProps> = ({ className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const globeRef = useRef<ThreeGlobe | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let mouseX = 0;
    let mouseY = 0;
    let windowHalfX = window.innerWidth / 2;
    let windowHalfY = window.innerHeight / 2;

    // Initialize renderer with alpha support for transparency
    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Initialize scene, light
    const scene = new Scene();
    scene.add(new AmbientLight(0xbbbbbb, 0.3));
    scene.background = null;
    sceneRef.current = scene;

    // Initialize camera, light
    const camera = new PerspectiveCamera();
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    const dLight = new DirectionalLight(0xffffff, 0.8);
    dLight.position.set(-800, 2000, 400);
    camera.add(dLight);

    const dLight1 = new DirectionalLight(0xffffff, 1);
    dLight1.position.set(-200, 500, 200);
    camera.add(dLight1);

    const dLight2 = new PointLight(0x5b9bd5, 0.5);
    dLight2.position.set(-200, 500, 200);
    camera.add(dLight2);

    // Position camera at an angle to create tilt effect
    // Adjust these values to change the tilt:
    // - Increase Y position to tilt down (looking down at globe)
    // - Decrease Y position to tilt up (looking up at globe)
    // - Adjust Z distance to change how far/close the camera is
    const tiltAngle = Math.PI / 6; // 30 degrees tilt (adjust as needed)
    const cameraDistance = 400;

    camera.position.x = 0;
    camera.position.y = Math.sin(tiltAngle) * cameraDistance; // Vertical offset for tilt
    camera.position.z = Math.cos(tiltAngle) * cameraDistance; // Distance from globe

    // Always look at the center of the globe
    camera.lookAt(0, 0, 0);

    scene.add(camera);
    cameraRef.current = camera;

    // Additional effects
    scene.fog = new Fog(0x4a90e2, 400, 2000);

    // Initialize controls - disabled to keep camera fixed
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.enablePan = false; // Disable panning
    controls.enableRotate = false; // Disable rotation
    controls.enableZoom = false; // Disable zooming
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
      .pointColor(() => '#ffd700')
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
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      windowHalfX = window.innerWidth / 1.5;
      windowHalfY = window.innerHeight / 1.5;
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };

    // Animation loop
    const animate = () => {
      if (!cameraRef.current || !controlsRef.current || !rendererRef.current || !sceneRef.current) {
        return;
      }

      // Rotate globe to simulate Earth's daily rotation (one full rotation per day)
      // Rotating around Y-axis (vertical axis) at a rate that completes one rotation in ~24 seconds
      // Adjust the rotation speed: 0.001 = slow, 0.01 = faster
      if (globeRef.current) {
        globeRef.current.rotateY(0.005); // Rotate 0.005 radians per frame (~24 seconds per full rotation at 60fps)
      }

      // Mouse tracking disabled - camera movement is now fully controlled by OrbitControls
      // cameraRef.current.position.x +=
      //   Math.abs(mouseX) <= windowHalfX / 2
      //     ? (mouseX / 2 - cameraRef.current.position.x) * 0.005
      //     : 0;
      // cameraRef.current.position.y += (-mouseY / 2 - cameraRef.current.position.y) * 0.005;
      // cameraRef.current.lookAt(sceneRef.current.position);
      controlsRef.current.update();
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
      if (containerRef.current && rendererRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
    };
  }, []);

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Background with gradient and noise texture */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          background: `
            linear-gradient(to bottom, rgba(74, 109, 149, 0.9) 0%, rgba(232, 214, 190, 0.9) 100%),
            url('/noise.svg')
          `,
          backgroundColor: '#2C4563',
        }}
      />
      {/* Canvas container */}
      <div ref={containerRef} style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }} />
    </div>
  );
};

export default Globe;

