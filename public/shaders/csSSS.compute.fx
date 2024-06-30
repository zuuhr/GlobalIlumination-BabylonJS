// Mariam Baradi del Alamo - 2024
// Screen-space shadows WGSL compute shader

// Output Texture
@group(0) @binding(0) var outputTex : texture_storage_2d<rgba16float, write>;
// Input Textures
@group(0) @binding(1) var positionTex : texture_2d<f32>;

struct CameraData{
    ViewMat : mat4x4<f32>,
    ProjMat : mat4x4<f32>,
    CameraPos : vec3<f32>,
    Far : f32,
};
@group(0) @binding(2) var<uniform> cameraData : CameraData;

struct SSSParameters
{
    // Length of shadow from contact point
    ShadowLength : f32,
    // Minimum depth difference to avoid artifacts
    ShadowBias : f32,
    // How far each step goes in View Space
    StepSize : f32,
    // Opacity
    IntensityMultiplier : f32,
    // Light direction or position 'xyz' and type 'w'
    LightVector : vec4<f32>,
}
@group(0) @binding(3) var<uniform> sssParams : SSSParameters;

// Shader-scope variables
var<private> fragPosVS : vec3<f32>;
var<private> rayStepVS : vec3<f32>;
var<private> stepPosSS : vec2<f32>;
var<private> tempStepPosPS : vec4<f32>;
var<private> shadowed : f32;
var<private> depthDifference : f32;

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>)
{
    let iid = vec3<i32>(global_id);
    let screenDims = vec2<f32>(textureDimensions(positionTex, 0));
    let fragUV : vec2<f32> = vec2<f32>(global_id.xy) / screenDims;

    fragPosVS = (cameraData.ViewMat * textureLoad(positionTex, iid.xy, 0)).xyz;
    
    // Return if pixel is skybox
    if (fragPosVS.z < 1) {
        textureStore(outputTex, iid.xy, vec4<f32>(1.0, 0.0, 0.0, 1.0));
        return;
    }
    
    let steps : i32 = 16;
    // Evaluate type of light. Directional Light = 0, Point Light = 1
    if (sssParams.LightVector.w == 0){
         rayStepVS = normalize(sssParams.LightVector.xyz) * sssParams.StepSize; 
    } else {
         rayStepVS = normalize(sssParams.LightVector.xyz - fragPosVS) * sssParams.StepSize; 
    }

    // Ray marching
    for(var i : i32 = 0; i < steps; i = i + 1){
        fragPosVS += rayStepVS;
        tempStepPosPS = (cameraData.ProjMat * vec4<f32>(fragPosVS, 1));
        stepPosSS = tempStepPosPS.xy / tempStepPosPS.w;
        stepPosSS = (stepPosSS + 1) / 2.0;

        depthDifference = (cameraData.ViewMat * textureLoad(positionTex, vec2<i32>(stepPosSS.xy * screenDims), 0)).z;
        depthDifference = fragPosVS.z - depthDifference;

        if ((depthDifference > sssParams.ShadowBias) && (depthDifference < sssParams.ShadowLength)){
                shadowed = 1;
                // Fade out edges to avoid artifacts from texture limits
                let edgeUV : vec2<f32> = abs(fragUV - 0.5) * 10 - 4;
                let edgeScreenFade : f32 = clamp(max(edgeUV.x, edgeUV.y), 0.0, 1.0);
                shadowed = shadowed * sssParams.IntensityMultiplier * (1.0 - edgeScreenFade);
                // If shadowed, stop 
                break;
        }
    }

    shadowed = 1.0 - shadowed;

    textureStore(outputTex, iid.xy, vec4<f32>(shadowed, 0.0, 0.0, 1.0));
}
