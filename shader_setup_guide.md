# Shader Setup Guide

This guide explains how to set up and use the shader systems in a new project. This project contains two main shader implementations:

1. **Fluid Shader** - Interactive fluid simulation using Three.js
2. **Dithering Shader** - Animated shapes with dithering effects using WebGL2

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Fluid Shader Setup](#fluid-shader-setup)
- [Dithering Shader Setup](#dithering-shader-setup)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- A React/Next.js project (or vanilla JavaScript project)
- Basic understanding of WebGL/GLSL shaders

---

## Installation

### 1. Install Dependencies

For the **Fluid Shader** (Three.js-based):
```bash
npm install three @types/three
```

For the **Dithering Shader** (WebGL2-based):
```bash
# No additional dependencies required - uses native WebGL2 API
```

For a **Next.js project** (recommended):
```bash
npm install next react react-dom three @types/three
npm install -D typescript @types/node @types/react @types/react-dom
```

---

## Fluid Shader Setup

The Fluid Shader creates an interactive fluid simulation that responds to mouse movement.

### File Structure

Create the following files:

```
your-project/
├── lib/
│   ├── shaders.ts          # Shader source code
│   └── config.ts           # Configuration settings
└── components/
    └── FluidCanvas.tsx     # React component
```

### Step 1: Create Shader Files

**`lib/shaders.ts`** - Contains the GLSL shader code:

```typescript
export const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const fluidShader = `
uniform float iTime;
uniform vec2 iResolution;
uniform vec4 iMouse;
uniform int iFrame;
uniform sampler2D iPreviousFrame;
uniform float uBrushSize;
uniform float uBrushStrength;
uniform float uFluidDecay;
uniform float uTrailLength;
uniform float uStopDecay;
varying vec2 vUv;

vec2 ur, U;

float ln(vec2 p, vec2 a, vec2 b) {
    return length(p-a-(b-a)*clamp(dot(p-a,b-a)/dot(b-a,b-a),0., 1.));
}

vec4 t(vec2 v, int a, int b) {
    return texture2D(iPreviousFrame, fract((v+vec2(float(a), float(b)))/ur));
}

vec4 t(vec2 v) {
    return texture2D(iPreviousFrame, fract(v/ur));
}

float area (vec2 a, vec2 b, vec2 c) {
    float A = length(b-c), B = length(c-a), C = length(a-b), s = 0.5*(A+B+C);
    return sqrt(s*(s-A)*(s-B)*(s-C));
}

void main() {
    U = vUv * iResolution;
    ur = iResolution.xy;
    
    if (iFrame < 1) {
        float w = 0.5+sin(0.2*U.x)*0.5;
        float q = length(U-0.5*ur);
        gl_FragColor = vec4(0.1*exp(-0.001*q*q),0,0,w);
    } else {
        vec2 v = U,
            A = v + vec2(1, 1), 
            B = v + vec2(1,-1), 
            C = v + vec2(-1, 1), 
            D = v + vec2(-1,-1);
        
        for (int i = 0; i < 8; i++) {
            v -= t(v).xy;
            A -= t(A).xy;
            B -= t(B).xy;
            C -= t(C).xy;
            D -= t(D).xy;
        }
        
        vec4 me = t(v);
        vec4 n = t(v, 0, 1),
            e = t(v, 1, 0),
            s = t(v, 0, -1),
            w = t(v, -1, 0);
        vec4 ne = .25*(n+e+s+w);
        me = mix(t(v), ne, vec4(0.15,0.15,0.95,0.));
        me.z = me.z - 0.01*((area(A,B,C)+area(B,C,D))-4.);
        
        vec4 pr = vec4(e.z,w.z,n.z,s.z);
        me.xy = me.xy + 100.*vec2(pr.x-pr.y, pr.z-pr.w)/ur;
        
        me.xy *= uFluidDecay;
        me.z *= uTrailLength;
        
        if (iMouse.z > 0.0) {
            vec2 mousePos = iMouse.xy;
            vec2 mousePrev = iMouse.zw;
            vec2 mouseVel = mousePos - mousePrev;
            float velMagnitude = length(mouseVel);
            float q = ln(U, mousePos, mousePrev);
            vec2 m = mousePos - mousePrev;
            float l = length(m);
            if (l > 0.0) m = min(l, 10.0) * m / l;
            
            float brushSizeFactor = 1e-4 / uBrushSize;
            float strengthFactor = 0.03 * uBrushStrength;
            
            float falloff = exp(-brushSizeFactor*q*q*q);
            falloff = pow(falloff, 0.5);
            
            me.xyw += strengthFactor * falloff * vec3(m, 10.);
            
            if (velMagnitude < 2.0) {
                float distToCursor = length(U - mousePos);
                float influence = exp(-distToCursor * 0.01);
                float cursorDecay = mix(1.0, uStopDecay, influence);
                me.xy *= cursorDecay;
                me.z *= cursorDecay;
            }
        }

        gl_FragColor = clamp(me, -0.4, 0.4);
    }
}
`;

export const displayShader = `
    uniform float iTime;
    uniform vec2 iResolution;
    uniform sampler2D iFluid;
    uniform float uDistortionAmount;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform vec4 uColor4;
    uniform float uColorIntensity;
    uniform float uSoftness;
    varying vec2 vUv;
    
    void main() {
        vec2 fragCoord = vUv * iResolution;
        
        vec4 fluid = texture2D(iFluid, vUv);
        vec2 fluidVel = fluid.xy;
        
        float mr = min(iResolution.x, iResolution.y);
        vec2 uv = (fragCoord * 2.0 - iResolution.xy) / mr;
        
        uv += fluidVel * (0.5 * uDistortionAmount);
        
        float d = -iTime * 0.5;
        float a = 0.0;
        for (float i = 0.0; i < 8.0; ++i) {
            a += cos(i - d - a * uv.x);
            d += sin(uv.y * i + a);
        }
        d += iTime * 0.5;

        float mixer1 = cos(uv.x * d) * 0.5 + 0.5;
        float mixer2 = cos(uv.y * a) * 0.5 + 0.5;
        float mixer3 = sin(d + a) * 0.5 + 0.5;
        
        float smoothAmount = clamp(uSoftness * 0.1, 0.0, 0.9);
        mixer1 = mix(mixer1, 0.5, smoothAmount);
        mixer2 = mix(mixer2, 0.5, smoothAmount);
        mixer3 = mix(mixer3, 0.5, smoothAmount);
        
        vec3 col = mix(uColor1, uColor2, mixer1);
        col = mix(col, uColor3, mixer2);
        col = mix(col, uColor4, mixer3 * 0.4);
        
        col *= uColorIntensity;
        
        gl_FragColor = vec4(col, 1.0);
    }
`;
```

**`lib/config.ts`** - Configuration settings:

```typescript
export interface FluidConfig {
    brushSize: number;
    brushStrength: number;
    distortionAmount: number;
    fluidDecay: number;
    trailLength: number;
    stopDecay: number;
    color1: string;
    color2: string;
    color3: string;
    color4: string;
    colorIntensity: number;
    softness: number;
}

export const config: FluidConfig = {
    brushSize: 25.0,
    brushStrength: 0.5,
    distortionAmount: 2.5,
    fluidDecay: 0.98,
    trailLength: 0.8,
    stopDecay: 0.85,
    color1: "#E9D8A6", // beige/cream
    color2: "#FBA91A", // gold
    color3: "#0B1B4B", // dark blue
    color4: "#66d1fe", // light blue
    colorIntensity: 1.0,
    softness: 1.0,
};
```

### Step 2: Create the React Component

**`components/FluidCanvas.tsx`** - Main component:

```typescript
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { vertexShader, fluidShader, displayShader } from '@/lib/shaders';
import { config } from '@/lib/config';

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
    mouseX: number;
    mouseY: number;
    prevMouseX: number;
    prevMouseY: number;
    lastMoveTime: number;
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

    // Mouse tracking
    let mouseX = 0;
    let mouseY = 0;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let lastMoveTime = 0;

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
      mouseX,
      mouseY,
      prevMouseX,
      prevMouseY,
      lastMoveTime,
    };

    // Mouse event handlers
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      prevMouseX = mouseX;
      prevMouseY = mouseY;
      mouseX = e.clientX - rect.left;
      // Flip Y coordinate: WebGL uses bottom-left origin, screen uses top-left
      mouseY = rect.height - (e.clientY - rect.top);
      lastMoveTime = performance.now();
      fluidMaterial.uniforms.iMouse.value.set(mouseX, mouseY, prevMouseX, prevMouseY);
      
      if (sceneRef.current) {
        sceneRef.current.mouseX = mouseX;
        sceneRef.current.mouseY = mouseY;
        sceneRef.current.prevMouseX = prevMouseX;
        sceneRef.current.prevMouseY = prevMouseY;
        sceneRef.current.lastMoveTime = lastMoveTime;
      }
    };

    const handleMouseLeave = () => {
      fluidMaterial.uniforms.iMouse.value.set(0, 0, 0, 0);
    };

    // Animation loop
    const animate = () => {
      if (!sceneRef.current) return;

      const time = performance.now() * 0.001;
      const scene = sceneRef.current;

      scene.fluidMaterial.uniforms.iTime.value = time;
      scene.displayMaterial.uniforms.iTime.value = time;
      scene.fluidMaterial.uniforms.iFrame.value = scene.frameCount;

      if (performance.now() - scene.lastMoveTime > 100) {
        scene.fluidMaterial.uniforms.iMouse.value.set(0, 0, 0, 0);
      }

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
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('resize', handleResize);

    // Start animation
    animate();

    // Cleanup
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
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
```

### Step 3: Use the Component

In your page or component:

```typescript
import FluidCanvas from '@/components/FluidCanvas';

export default function Home() {
  return (
    <div>
      <FluidCanvas />
    </div>
  );
}
```

---

## Dithering Shader Setup

The Dithering Shader creates animated shapes with various dithering effects using WebGL2.

### File Structure

```
your-project/
└── components/
    └── ui/
        └── dithering-shader.tsx
```

### Step 1: Create the Component

Copy the entire `dithering-shader.tsx` file from this project. The component is self-contained and includes:

- GLSL shader code (vertex and fragment shaders)
- WebGL2 setup and rendering
- Multiple shape types (simplex, warp, dots, wave, ripple, swirl, sphere)
- Multiple dithering types (random, 2x2, 4x4, 8x8)
- Optional Earth texture support for sphere shape

### Step 2: Use the Component

```typescript
import { DitheringShader } from '@/components/ui/dithering-shader';

export default function Page() {
  return (
    <DitheringShader
      width={800}
      height={800}
      colorBack="#000000"
      colorFront="#ffffff"
      shape="sphere"
      type="8x8"
      pxSize={4}
      speed={1}
      earthTextureUrl="/images/earthmap1k.jpg"
    />
  );
}
```

### Available Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `number` | `800` | Canvas width in pixels |
| `height` | `number` | `800` | Canvas height in pixels |
| `colorBack` | `string` | `"#000000"` | Background color (hex) |
| `colorFront` | `string` | `"#ffffff"` | Foreground color (hex) |
| `shape` | `DitheringShape` | `"simplex"` | Shape type: `"simplex"`, `"warp"`, `"dots"`, `"wave"`, `"ripple"`, `"swirl"`, `"sphere"` |
| `type` | `DitheringType` | `"8x8"` | Dithering type: `"random"`, `"2x2"`, `"4x4"`, `"8x8"` |
| `pxSize` | `number` | `4` | Pixel size for pixelization effect |
| `speed` | `number` | `1` | Animation speed multiplier |
| `earthTextureUrl` | `string` | `undefined` | Optional Earth texture URL for sphere shape |
| `className` | `string` | `""` | CSS class name |
| `style` | `React.CSSProperties` | `{}` | Inline styles |

---

## Configuration

### Fluid Shader Configuration

Edit `lib/config.ts` to customize the fluid simulation:

```typescript
export const config: FluidConfig = {
    brushSize: 25.0,        // Size of brush interaction (larger = bigger area)
    brushStrength: 0.5,     // Strength of brush interaction (0-1)
    distortionAmount: 2.5,  // How much the fluid distorts colors (higher = more distortion)
    fluidDecay: 0.98,       // How quickly fluid velocity decays (0-1, higher = slower decay)
    trailLength: 0.8,       // How long trails persist (0-1, higher = longer trails)
    stopDecay: 0.85,        // Decay when cursor stops moving (0-1)
    color1: "#E9D8A6",      // First color in gradient
    color2: "#FBA91A",      // Second color in gradient
    color3: "#0B1B4B",      // Third color in gradient
    color4: "#66d1fe",      // Fourth color in gradient
    colorIntensity: 1.0,     // Overall color intensity multiplier
    softness: 1.0,          // Softness of color transitions (0-1)
};
```

### Dithering Shader Configuration

Configure via component props (see [Available Props](#available-props) above).

---

## Usage Examples

### Example 1: Fullscreen Fluid Background

```typescript
// app/page.tsx
import FluidCanvas from '@/components/FluidCanvas';

export default function Home() {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}>
      <FluidCanvas />
    </div>
  );
}
```

### Example 2: Dithering Shader with Earth Texture

```typescript
import { DitheringShader } from '@/components/ui/dithering-shader';

export default function GlobePage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <DitheringShader
        width={1000}
        height={1000}
        colorBack="#0B1B4B"
        colorFront="#FBA91A"
        shape="sphere"
        type="8x8"
        pxSize={6}
        speed={0.5}
        earthTextureUrl="/images/earthmap1k.jpg"
      />
    </div>
  );
}
```

### Example 3: Multiple Dithering Shapes

```typescript
import { DitheringShader } from '@/components/ui/dithering-shader';

export default function ShapesPage() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', padding: '20px' }}>
      <DitheringShader shape="simplex" type="4x4" pxSize={3} />
      <DitheringShader shape="wave" type="8x8" pxSize={4} />
      <DitheringShader shape="ripple" type="random" pxSize={5} />
      <DitheringShader shape="swirl" type="2x2" pxSize={6} />
    </div>
  );
}
```

---

## Troubleshooting

### Common Issues

#### 1. **WebGL Context Creation Failed**

**Problem**: `getContext('webgl2')` returns `null`

**Solutions**:
- Ensure your browser supports WebGL2 (Chrome 56+, Firefox 51+, Safari 15.1+)
- Check if hardware acceleration is enabled
- Try using `webgl` instead of `webgl2` (requires shader modifications)

#### 2. **Three.js Renderer Not Initializing**

**Problem**: Canvas is blank or errors in console

**Solutions**:
- Verify Three.js is installed: `npm list three`
- Check browser console for specific errors
- Ensure the container element exists before initializing

#### 3. **Shaders Not Compiling**

**Problem**: Shader compilation errors in console

**Solutions**:
- Check GLSL syntax (semicolons, type declarations)
- Verify all uniforms are declared and used correctly
- Ensure shader version compatibility (`#version 300 es` for WebGL2)

#### 4. **Performance Issues**

**Problem**: Low frame rate or stuttering

**Solutions**:
- Reduce canvas resolution
- Lower `pxSize` for dithering shader
- Reduce number of iterations in shader loops
- Use `requestAnimationFrame` properly (already implemented)

#### 5. **Texture Not Loading (Dithering Shader)**

**Problem**: Earth texture doesn't appear

**Solutions**:
- Verify texture URL is correct and accessible
- Check CORS settings if loading from external source
- Ensure texture is loaded before rendering (component handles this)
- Verify `shape="sphere"` is set

#### 6. **Mouse Interaction Not Working (Fluid Shader)**

**Problem**: Fluid doesn't respond to mouse movement

**Solutions**:
- Check mouse event listeners are attached
- Verify container ref is set correctly
- Ensure mouse coordinates are being calculated properly
- Check `iMouse` uniform is being updated

### Browser Compatibility

- **WebGL2**: Chrome 56+, Firefox 51+, Safari 15.1+, Edge 79+
- **WebGL**: All modern browsers (fallback option)

### Performance Tips

1. **Reduce Resolution**: Lower canvas dimensions for better performance
2. **Optimize Shaders**: Reduce loop iterations if needed
3. **Use RequestAnimationFrame**: Already implemented, but ensure no blocking operations
4. **Dispose Resources**: Always clean up Three.js objects (already implemented)
5. **Limit Uniform Updates**: Only update uniforms when values change

---

## Advanced Customization

### Custom Shader Modifications

To modify the shaders:

1. **Edit shader code** in `lib/shaders.ts` (Fluid) or `dithering-shader.tsx` (Dithering)
2. **Add new uniforms** by:
   - Declaring in shader code
   - Adding to material uniforms object
   - Updating in animation loop

### Adding New Shapes (Dithering Shader)

1. Add shape logic in fragment shader `main()` function
2. Add shape constant to `DitheringShapes` object
3. Update TypeScript types

### Custom Color Schemes

For Fluid Shader, modify colors in `lib/config.ts`:
```typescript
color1: "#YOUR_COLOR_1",
color2: "#YOUR_COLOR_2",
color3: "#YOUR_COLOR_3",
color4: "#YOUR_COLOR_4",
```

For Dithering Shader, pass colors as props:
```typescript
<DitheringShader colorBack="#000000" colorFront="#ffffff" />
```

---

## Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [WebGL2 Specification](https://www.khronos.org/registry/webgl/specs/latest/2.0/)
- [GLSL Reference](https://www.khronos.org/opengl/wiki/OpenGL_Shading_Language)
- [WebGL Fundamentals](https://webglfundamentals.org/)

---

## License

Use these shaders according to your project's license requirements.

---

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review browser console for errors
3. Verify all dependencies are installed correctly
4. Ensure WebGL2 is supported in your browser

