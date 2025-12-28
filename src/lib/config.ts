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

