// Mariam Baradi del Alamo - 2024
// Bilateral blur WGSL compute shader: Horizontal blur
// 9/13 pixel kernel -> Gaussian Blur using Fixed GPU Linear Interpolation Optimization with 2/3 loops instead of 4/6

// Output Texture
@group(0) @binding(0) var outputTex : texture_storage_2d<rgba16float, write>;
// Input Texture
@group(0) @binding(1) var inputTex : texture_2d<f32>;
// Depth Texture
@group(0) @binding(2) var depthTex : texture_2d<f32>;
// Sampler
@group(0) @binding(3) var screenSampler : sampler;

// Constants
const DEFAULT_RESULT = vec4<f32>(0.0, 0.0, 0.0, 1.0);

const ITERATIONS = 4;
// https://github.com/Experience-Monks/glsl-fast-gaussian-blur/blob/master/9.glsl
const OFFSETS_3 : array<f32, 3> = array<f32, 3>(0.0, 1.3846153846, 3.2307692308);
const WEIGHTS_3 : array<f32, 3> = array<f32, 3>(0.2270270270, 0.3162162162, 0.0702702703);

// https://github.com/Experience-Monks/glsl-fast-gaussian-blur/blob/master/13.glsl
const OFFSETS_4 : array<f32, 4> = array<f32, 4>(0.0, 1.411764705882353, 3.2941176470588234, 5.176470588235294);
const WEIGHTS_4 : array<f32, 4> = array<f32, 4>(0.1964825501511404, 0.2969069646728344, 0.09447039785044732, 0.010381362401148057);

// Shader-scope variables
var<private> iid : vec2<i32>;
var<private> currentUV : vec2<f32>;
var<private> screenDims : vec2<f32>;

var<private> fragDepth : f32;
var<private> blurWeight : f32;
var<private> blurredColor : vec4<f32>;
var<private> offsetLDepthDistance : f32;
var<private> offsetRDepthDistance : f32;
var<private> leftRangeCheck : f32;
var<private> rightRangeCheck : f32;

fn verticalBlur() -> vec4<f32> {

    for (var i : i32 = 1; i < ITERATIONS; i = i + 1) {
        let offsetUV = vec2<f32>(0.0, OFFSETS_4[i]) / screenDims.y;
        offsetLDepthDistance = abs(textureSampleLevel(depthTex, screenSampler, currentUV - offsetUV, 0.0).r - fragDepth);
        offsetRDepthDistance = abs(textureSampleLevel(depthTex, screenSampler, currentUV + offsetUV, 0.0).r - fragDepth);

        offsetLDepthDistance *= offsetLDepthDistance;
        offsetRDepthDistance *= offsetRDepthDistance;
        leftRangeCheck = smoothstep(0.05, 0.9, offsetLDepthDistance);
        rightRangeCheck = smoothstep(0.05, 0.9, offsetRDepthDistance);

        blurWeight += WEIGHTS_4[i] * (1 - leftRangeCheck);
        blurWeight += WEIGHTS_4[i] * (1 - rightRangeCheck);
        blurredColor += textureSampleLevel(inputTex, screenSampler, currentUV - offsetUV, 0.0) * WEIGHTS_4[i] * (1 - leftRangeCheck);
        blurredColor += textureSampleLevel(inputTex, screenSampler, currentUV + offsetUV, 0.0) * WEIGHTS_4[i] * (1 - rightRangeCheck);
    }
    // final weight
    blurWeight = 1 - blurWeight;
    blurredColor += textureLoad(inputTex, iid, 0) * blurWeight;
    return blurredColor;
}

// Max value 256 = x * y * z
@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>)
{
    iid = vec2<i32>(global_id.xy);
    screenDims = vec2<f32>(textureDimensions(depthTex, 0));
    currentUV = vec2<f32>(global_id.xy) / screenDims;

    fragDepth = textureLoad(depthTex, iid, 0).r;

    // Return if pixel is skybox
    if (fragDepth < 1.0) { 
        textureStore(outputTex, iid.xy, DEFAULT_RESULT);
        return; 
    }
    blurredColor = verticalBlur();
    
    textureStore(outputTex, iid, blurredColor);
}
