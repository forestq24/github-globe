# Camera Implementation Documentation

## Overview
The camera system in this project uses Three.js `PerspectiveCamera` combined with `OrbitControls` to provide an interactive 3D viewing experience of the globe. The camera also includes mouse tracking functionality that subtly adjusts the camera position based on cursor movement.

## Camera Initialization

### Basic Setup
```typescript
const camera = new PerspectiveCamera();
camera.aspect = window.innerWidth / window.innerHeight;
camera.updateProjectionMatrix();
```

- **Type**: `PerspectiveCamera` - Creates a perspective projection (objects appear smaller as they get farther away)
- **Aspect Ratio**: Dynamically calculated based on window dimensions
- **Projection Matrix**: Updated after aspect ratio is set to ensure correct rendering

### Initial Position
```typescript
camera.position.z = 400;
camera.position.x = 0;
camera.position.y = 0;
```

- The camera starts at coordinates `(0, 0, 400)`
- This places it 400 units away from the origin along the Z-axis
- The globe is centered at the origin `(0, 0, 0)`

## Lighting Setup

The camera also carries directional lights attached to it:

```typescript
const dLight = new DirectionalLight(0xffffff, 0.8);
dLight.position.set(-800, 2000, 400);
camera.add(dLight);

const dLight1 = new DirectionalLight(0x7982f6, 1);
dLight1.position.set(-200, 500, 200);
camera.add(dLight1);

const dLight2 = new PointLight(0x8566cc, 0.5);
dLight2.position.set(-200, 500, 200);
camera.add(dLight2);
```

- Lights are attached to the camera, so they move with it
- This creates consistent lighting regardless of camera position
- Multiple lights create depth and atmosphere

## OrbitControls Configuration

```typescript
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.01;
controls.enablePan = false;
controls.minDistance = 200;
controls.maxDistance = 500;
controls.rotateSpeed = 0.8;
controls.zoomSpeed = 1;
controls.autoRotate = false;
controls.minPolarAngle = Math.PI / 3.5;
controls.maxPolarAngle = Math.PI - Math.PI / 3;
```

### Control Settings Explained

- **`enableDamping`**: Smooth, physics-based camera movement (inertia effect)
- **`dampingFactor`**: Controls how quickly the damping effect settles (0.01 = slow, smooth settling)
- **`enablePan`**: Currently `false` - prevents panning (sideways movement)
- **`minDistance`**: Minimum zoom distance (200 units) - prevents getting too close
- **`maxDistance`**: Maximum zoom distance (500 units) - prevents zooming too far out
- **`rotateSpeed`**: How fast the globe rotates when dragging (0.8 = slightly slower than default)
- **`zoomSpeed`**: How fast zooming occurs (1 = default speed)
- **`autoRotate`**: Currently `false` - no automatic rotation
- **`minPolarAngle`**: Minimum vertical angle (prevents camera from going below the globe)
- **`maxPolarAngle`**: Maximum vertical angle (prevents camera from flipping over the top)

## Mouse Tracking System

The camera includes a mouse tracking feature that subtly adjusts the camera position:

```typescript
let mouseX = 0;
let mouseY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

const onMouseMove = (event: MouseEvent) => {
  mouseX = event.clientX - windowHalfX;
  mouseY = event.clientY - windowHalfY;
};
```

### Mouse Position Calculation
- `mouseX` and `mouseY` are calculated relative to the center of the window
- Values range from negative (left/top) to positive (right/bottom)

### Camera Position Adjustment
```typescript
camera.position.x +=
  Math.abs(mouseX) <= windowHalfX / 2
    ? (mouseX / 2 - camera.position.x) * 0.005
    : 0;
camera.position.y += (-mouseY / 2 - camera.position.y) * 0.005;
```

- **X-axis movement**: Only occurs if mouse is within the center half of the screen
- **Y-axis movement**: Always adjusts based on mouse Y position
- **Interpolation factor**: `0.005` creates smooth, gradual movement
- The camera slowly "follows" the mouse cursor, creating a subtle parallax effect

## Animation Loop

```typescript
const animate = () => {
  camera.position.x += (mouseX / 2 - camera.position.x) * 0.005;
  camera.position.y += (-mouseY / 2 - camera.position.y) * 0.005;
  camera.lookAt(scene.position);
  controls.update();
  renderer.render(scene, camera);
  animationFrameRef.current = requestAnimationFrame(animate);
};
```

### Animation Steps
1. **Mouse tracking**: Adjusts camera X/Y position based on mouse
2. **Look at origin**: Camera always looks at the scene center (where the globe is)
3. **Update controls**: Applies OrbitControls transformations (rotation, zoom)
4. **Render**: Draws the scene from the camera's perspective
5. **Repeat**: Uses `requestAnimationFrame` for smooth 60fps animation

## Window Resize Handling

```typescript
const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  windowHalfX = window.innerWidth / 1.5;
  windowHalfY = window.innerHeight / 1.5;
  renderer.setSize(window.innerWidth, window.innerHeight);
};
```

- Updates camera aspect ratio when window is resized
- Recalculates mouse tracking boundaries
- Adjusts renderer size to match new window dimensions

## Current Limitations

1. **Panning disabled**: `enablePan = false` prevents lateral camera movement
2. **Zoom constraints**: Limited to 200-500 units distance
3. **Vertical angle limits**: Cannot view from extreme top/bottom angles
4. **Mouse tracking**: Only active in center portion of screen (X-axis)

## User Interaction

- **Drag**: Rotate the globe around
- **Scroll**: Zoom in/out (within min/max distance limits)
- **Mouse movement**: Subtle camera position adjustment (parallax effect)

