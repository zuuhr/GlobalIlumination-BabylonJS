// Mariam Baradi del Alamo - 2024
// Screen-space directional occlusion WGSL compute shader

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

struct SSDOParameters{
    Iterations : i32,
    HistoryWeight : f32,
    IntensityMultiplier : f32,
    DORadious : f32,
    NoiseTiling : vec2<i32>,
    RandomKernel : vec2<i32>,
};
@group(0) @binding(8) var<uniform> ssdoParams : SSDOParameters;

// Constants
// Tweak these to reduce artifacts. Do so with care.
const DISTANCE_BIAS = 0.00;
const DISTANCE_MAX = 1.0;

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
const ITERATIONS = 16;
// Optimization [4 = 0.25, 8 = 0.125, 16 = 0.0625, 32 = 0.03125, 64 = 0.015625]
const ITERATIONS_INV = 0.0625;
// Value = [Number] in CIRCLE_[Number], which is the chosen kernel.
const KERNEL_SIZE = 64;

// Shader-scope variables
var<private> sampleCoord : vec2<i32>;
var<private> samplePosVS : vec3<f32>;
var<private> sampleNVS : vec3<f32>;
var<private> sampleColor : vec3<f32>;
var<private> posDifferenceVS : vec3<f32>;
var<private> dist : f32;
var<private> rangeCheck : f32;
var<private> offsetNAngle : f32;
var<private> fragNAngle : f32;

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
    let previousFrameSSDO : vec3<f32> = textureLoad(previousFrameTex, iid - fragVelocity, 0).xyz;
    
    // The further the distance the bigger the radius in view space 
    let scale : f32 = min(ssdoParams.DORadious, ssdoParams.DORadious / fragPosVS.z);
    
    let noise = textureLoad(noiseTex, vec2<i32>((iid.x + ssdoParams.RandomKernel.x) % ssdoParams.NoiseTiling.x, (iid.y + ssdoParams.RandomKernel.y) % ssdoParams.NoiseTiling.y), 0).xy;
    let angularJitterScope : i32 = KERNEL_SIZE / ITERATIONS;
    let angularJitter : i32 = i32(noise.y * f32(angularJitterScope));

    var ssdo : vec3<f32> = DEFAULT_RESULT.xyz;
    for(var i : i32 = 0; i < ITERATIONS; i = i + 1) 
    {
        // Random Sample around current fragment
        sampleCoord = vec2<i32>(vec2<f32>(iid) + CIRCLE_64[i * angularJitterScope + angularJitter] * noise.x * scale);
        samplePosVS = (sceneData.ViewMat * textureLoad(positionTex, sampleCoord, 0)).xyz;
        sampleNVS = textureLoad(normalTex, sampleCoord, 0).xyz;
        sampleColor = textureLoad(colorTex, sampleCoord, 0).xyz;

        // Range Check
        posDifferenceVS = samplePosVS - fragPosVS;
        dist = length(posDifferenceVS);
        rangeCheck = step(DISTANCE_BIAS, dist) * smoothstep(0, 1, DISTANCE_MAX / dist);

        // Evaluate concavity-convexity of fragments
        offsetNAngle =  saturate(dot(sampleNVS, -normalize(posDifferenceVS)));
        // Evaluate normal incidency of fragments
        fragNAngle = saturate(dot(fragNVS, normalize(posDifferenceVS)));

        ssdo = ssdo + sampleColor * offsetNAngle * fragNAngle * rangeCheck;
    }

    ssdo = ssdo * ssdoParams.IntensityMultiplier * ITERATIONS_INV;
    ssdo = (1 - ssdoParams.HistoryWeight) * ssdo + previousFrameSSDO * ssdoParams.HistoryWeight; 

    textureStore(outputTex, iid.xy, vec4<f32>(ssdo, 1.0));
}
