// Mariam Baradi del Alamo - 2024
// Screen-space global illumination WGSL compute shader

// Output Texture
@group(0) @binding(0) var outputTex : texture_storage_2d<rgba16float, write>;

// Input Textures
@group(0) @binding(1) var colorTex : texture_2d<f32>;
@group(0) @binding(2) var positionTex : texture_2d<f32>;
@group(0) @binding(3) var normalTex : texture_2d<f32>;
@group(0) @binding(4) var velocityTex : texture_2d<f32>;
@group(0) @binding(5) var noiseTex : texture_2d<f32>;
@group(0) @binding(6) var previousFrameTex : texture_2d<f32>;

// Uniform Buffers
struct SceneData{
    ViewMat : mat4x4<f32>,
    ProjMat : mat4x4<f32>,
    CameraPos : vec3<f32>,
    Padding : i32,
};
@group(0) @binding(7) var<uniform> sceneData : SceneData;

struct SSGIParameters{
    Iterations : i32,
    HistoryWeight : f32,
    AOIntensityMultiplier : f32,
    AORadious : f32,
    DOIntensityMultiplier : f32,
    DORadious : f32,
    NoiseTiling : vec2<i32>,
    RandomKernel : vec2<i32>,
    Padding1 : i32,
    Padding2 : i32,
};
@group(0) @binding(8) var<uniform> ssgiParams : SSGIParameters;

// Constants
// Tweak these to reduce artifacts. Do so with care.
const AO_DISTANCE_BIAS = 0.01;
const AO_DISTANCE_MAX = 0.1;

const DO_DISTANCE_BIAS = 0.0;
const DO_DISTANCE_MAX = 2.0;

// Circular kernels
const CIRCLE_4 : array<vec2<f32>, 4> = array<vec2<f32>, 4>(
    vec2<f32>(0.707107, 0.707107),
    vec2<f32>(-0.707107, 0.707107),
    vec2<f32>(-0.707107, -0.707107),
    vec2<f32>(0.707107, -0.707107)
);

const CIRCLE_8 : array<vec2<f32>, 8> = array<vec2<f32>, 8>(
    vec2<f32>(1, 0), vec2<f32>(0.707107, 0.707107),
    vec2<f32>(0, 1), vec2<f32>(-0.707107, 0.707107),
    vec2<f32>(-1, 0), vec2<f32>(-0.707107, -0.707107),
    vec2<f32>(0, -1), vec2<f32>(0.707107, -0.707107)
);

const CIRCLE_16 : array<vec2<f32>, 16> = array<vec2<f32>, 16>(
    vec2<f32>(1, 0), vec2<f32>(0.923880, 0.382683), vec2<f32>(0.707107, 0.707107), vec2<f32>(0.382683, 0.923880),
    vec2<f32>(0, 1), vec2<f32>(-0.382683, 0.923880), vec2<f32>(-0.707107, 0.707107), vec2<f32>(-0.923880, 0.382683),
    vec2<f32>(-1, 0), vec2<f32>(-0.923880, -0.382683), vec2<f32>(-0.707107, -0.707107), vec2<f32>(-0.382683, -0.923880),
    vec2<f32>(0, -1), vec2<f32>(0.382683, -0.923880), vec2<f32>(0.707107, -0.707107), vec2<f32>(0.923880, -0.382683)
);

const CIRCLE_32 : array<vec2<f32>, 32> = array<vec2<f32>, 32>(
    vec2<f32>(1, 0), vec2<f32>(0.980785, 0.195090), vec2<f32>(0.923880, 0.382683), vec2<f32>(0.831470, 0.555570), 
    vec2<f32>(0.707107, 0.707107), vec2<f32>(0.555570, 0.831470), vec2<f32>(0.382683, 0.923880), vec2<f32>(0.195090, 0.980785),
    vec2<f32>(0, 1), vec2<f32>(-0.195090, 0.980785), vec2<f32>(-0.382683, 0.923880), vec2<f32>(-0.555570, 0.831470), 
    vec2<f32>(-0.707107, 0.707107), vec2<f32>(-0.831470, 0.555570), vec2<f32>(-0.923880, 0.382683), vec2<f32>(-0.980785, 0.195090),
    vec2<f32>(-1, 0), vec2<f32>(-0.980785, -0.195090), vec2<f32>(-0.923880, -0.382683), vec2<f32>(-0.831470, -0.555570),
    vec2<f32>(-0.707107, -0.707107), vec2<f32>(-0.555570, -0.831470), vec2<f32>(-0.382683, -0.923880), vec2<f32>(-0.195090, -0.980785),
    vec2<f32>(0, -1), vec2<f32>(0.195090, -0.980785), vec2<f32>(0.382683, -0.923880), vec2<f32>(0.555570, -0.831470),
    vec2<f32>(0.707107, -0.707107), vec2<f32>(0.831470, -0.555570), vec2<f32>(0.923880, -0.382683), vec2<f32>(0.980785, -0.195090)
);

const CIRCLE_64 : array<vec2<f32>, 64> = array<vec2<f32>, 64>(
    vec2<f32>(1, 0), vec2<f32>(0.995185, 0.098017), vec2<f32>(0.980785, 0.195090), vec2<f32>(0.956940, 0.290285),
    vec2<f32>(0.923880, 0.382683), vec2<f32>(0.881921, 0.471397), vec2<f32>(0.831470, 0.555570), vec2<f32>(0.773010, 0.634393),
    vec2<f32>(0.707107, 0.707107), vec2<f32>(0.634393, 0.773010), vec2<f32>(0.555570, 0.831470), vec2<f32>(0.471397, 0.881921),
    vec2<f32>(0.382683, 0.923880), vec2<f32>(0.290285, 0.956940), vec2<f32>(0.195090, 0.980785), vec2<f32>(0.098017, 0.995185),
    vec2<f32>(0, 1), vec2<f32>(-0.098017, 0.995185), vec2<f32>(-0.195090, 0.980785), vec2<f32>(-0.290285, 0.956940),
    vec2<f32>(-0.382683, 0.923880), vec2<f32>(-0.471397, 0.881921), vec2<f32>(-0.555570, 0.831470), vec2<f32>(-0.634393, 0.773010),
    vec2<f32>(-0.707107, 0.707107), vec2<f32>(-0.773010, 0.634393), vec2<f32>(-0.831470, 0.555570), vec2<f32>(-0.881921, 0.471397),
    vec2<f32>(-0.923880, 0.382683), vec2<f32>(-0.956940, 0.290285), vec2<f32>(-0.980785, 0.195090), vec2<f32>(-0.995185, 0.098017), 
    vec2<f32>(-1, 0), vec2<f32>(-0.995185, -0.098017), vec2<f32>(-0.980785, -0.195090), vec2<f32>(-0.956940, -0.290285),
    vec2<f32>(-0.923880, -0.382683), vec2<f32>(-0.881921, -0.471397), vec2<f32>(-0.831470, -0.555570), vec2<f32>(-0.773010, -0.634393),
    vec2<f32>(-0.707107, -0.707107), vec2<f32>(-0.634393, -0.773010), vec2<f32>(-0.555570, -0.831470), vec2<f32>(-0.471397, -0.881921),
    vec2<f32>(-0.382683, -0.923880), vec2<f32>(-0.290285, -0.956940), vec2<f32>(-0.195090, -0.980785), vec2<f32>(-0.098017, -0.995185),
    vec2<f32>(0, -1), vec2<f32>(0.098017, -0.995185), vec2<f32>(0.195090, -0.980785),  vec2<f32>(0.290285, -0.956940),
    vec2<f32>(0.382683, -0.923880), vec2<f32>(0.471397, -0.881921), vec2<f32>(0.555570, -0.831470), vec2<f32>(0.634393, -0.773010),
    vec2<f32>(0.707107, -0.707107), vec2<f32>(0.773010, -0.634393), vec2<f32>(0.831470, -0.555570), vec2<f32>(0.881921, -0.098017),
    vec2<f32>(0.923880, -0.382683), vec2<f32>(0.956940, -0.290285), vec2<f32>(0.980785, -0.195090), vec2<f32>(0.995185, -0.098017)
);

const DEFAULT_RESULT = vec4<f32>(0.0, 0.0, 0.0, 1.0);

// Tweak these and CIRCLE_[Number] to balance between noise reduction and performance. 
// Pre-Computed Inverse Value [4 = 0.25, 8 = 0.125, 16 = 0.0625, 32 = 0.03125, 64 = 0.015625]
const ITERATIONS = 8;
const ITERATIONS_INV = 0.125;
// Value = [Number] in CIRCLE_[Number], which is the chosen kernel.
const KERNEL_SIZE = 64;

// Shader-scope variables
var<private> aoSampleCoord : vec2<i32>;
var<private> aoSamplePosVS : vec3<f32>;
var<private> aoPosDifferenceVS : vec3<f32>;
var<private> aoDist : f32;
var<private> aoRangeCheck : f32;
var<private> aoOffsetNAngle : f32;

var<private> doSampleCoord : vec2<i32>;
var<private> doSamplePosVS : vec3<f32>;
var<private> doSampleNVS : vec3<f32>;
var<private> doSampleColor : vec3<f32>;
var<private> doPosDifferenceVS : vec3<f32>;
var<private> doDist : f32;
var<private> doRangeCheck : f32;
var<private> doOffsetNAngle : f32;
var<private> doFragNAngle : f32;

// Max value 256 = x * y * z
@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>)
{
    let iid = vec2<i32>(global_id.xy);
    let fragPosVS : vec3<f32> = (sceneData.ViewMat * textureLoad(positionTex, iid, 0)).xyz;

    // Return if pixel is skybox
    if (fragPosVS.z < 1.0) { 
        textureStore(outputTex, iid.xy, DEFAULT_RESULT);
        return; 
    }

    // Sample View-Space Normal
    let fragNVS : vec3<f32> = textureLoad(normalTex, iid, 0).xyz;

    // Sample the result from last frame
    let fragVelocity : vec2<i32> = vec2<i32>( ( (textureLoad(velocityTex, iid, 0).xy * 2.0) - 1.0));
    let previousFrameSSGI : vec4<f32> = textureLoad(previousFrameTex, iid - fragVelocity, 0);

    // The further the distance the bigger the radius in view space 
    let doScale : f32 = ssgiParams.DORadious / fragPosVS.z;
    let aoScale : f32 = ssgiParams.AORadious / fragPosVS.z;
   
    let noise : vec2<f32> = textureLoad(noiseTex, vec2<i32>((iid.x + ssgiParams.RandomKernel.x) % ssgiParams.NoiseTiling.x, (iid.y + ssgiParams.RandomKernel.y) % ssgiParams.NoiseTiling.y), 0).xy;
    let angularJitterScope : i32 = KERNEL_SIZE / ITERATIONS;
    let angularJitter : i32 = i32(noise.y * f32(angularJitterScope));

    var ssdo : vec3<f32> = DEFAULT_RESULT.xyz;
    var ao : f32 = 0.0;
    for(var i : i32 = 0; i < ITERATIONS; i = i + 1)
    {
        // SSAO
        // Random Sample around current fragment
        aoSampleCoord = vec2<i32>(vec2<f32>(iid) + CIRCLE_64[i * angularJitterScope + angularJitter] * noise.x * aoScale);
        aoSamplePosVS = (sceneData.ViewMat * textureLoad(positionTex, aoSampleCoord, 0)).xyz;

        // Range Check
        aoPosDifferenceVS = aoSamplePosVS - fragPosVS;
        aoDist = length(aoPosDifferenceVS);
        aoRangeCheck = step(AO_DISTANCE_BIAS, aoDist) * smoothstep(0, 1, AO_DISTANCE_MAX / aoDist);
        
        // Evaluate concavity-convexity of fragments
        aoOffsetNAngle =  saturate(dot(fragNVS, normalize(aoPosDifferenceVS)));

        ao += aoOffsetNAngle * aoRangeCheck;

        // SSDO
        // Random Sample around current fragment
        doSampleCoord = vec2<i32>(vec2<f32>(iid) + CIRCLE_64[i * angularJitterScope + angularJitter] * noise.x * doScale);
        doSamplePosVS = (sceneData.ViewMat * textureLoad(positionTex, doSampleCoord, 0)).xyz;
        doSampleNVS = textureLoad(normalTex, doSampleCoord, 0).xyz;
        doSampleColor = textureLoad(colorTex, doSampleCoord, 0).xyz;

        // Range Check
        doPosDifferenceVS = doSamplePosVS - fragPosVS;
        doDist = length(doPosDifferenceVS);
        doRangeCheck = step(DO_DISTANCE_BIAS, doDist) * smoothstep(0, 1, DO_DISTANCE_MAX / doDist);

        // Evaluate concavity-convexity of fragments
        doOffsetNAngle =  saturate(dot(doSampleNVS, -normalize(doPosDifferenceVS)));
        // Evaluate normal incidency of fragments
        doFragNAngle = saturate(dot(fragNVS, normalize(doPosDifferenceVS)));
        
        ssdo += doSampleColor * doOffsetNAngle * doFragNAngle * doRangeCheck;
    }
    // Blend result with previous frames
    ssdo = ssdo * ssgiParams.DOIntensityMultiplier * ITERATIONS_INV;
    ssdo = (1 - ssgiParams.HistoryWeight) * ssdo + previousFrameSSGI.rgb * ssgiParams.HistoryWeight; 

    ao = 1.0 - ao * ssgiParams.AOIntensityMultiplier * ITERATIONS_INV;
    ao = (1 - ssgiParams.HistoryWeight) * ao + previousFrameSSGI.a * ssgiParams.HistoryWeight; 

    textureStore(outputTex, iid, vec4<f32>(ssdo, ao));
}
