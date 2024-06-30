// Mariam Baradi del Alamo - 2024
// Combine compute shaders GLSL shader: Combine Base Color + Compute SSGI + Compute SSShadows 

precision highp float;

// Commented for WebGPU, uncomment for WebGL
// in vec2 vUV;

uniform sampler2D textureSampler;
uniform sampler2D ssgiTex;
uniform sampler2D shadowTex;
uniform bool isSSSActive;
uniform bool isSSGIActive;

void main(){
    vec3 baseColor = texture2DLodEXT(textureSampler, vUV, 0.0).rgb;
    vec4 ssgi = texture2DLodEXT(ssgiTex, vUV, 0.0);
    vec3 ssdo = ssgi.rgb;
    float ssao = ssgi.a;
    float shadow = texture2DLodEXT(shadowTex, vUV, 0.0).r;
    if (isSSSActive)
    {
        if (isSSGIActive) gl_FragColor = vec4((baseColor * shadow * ssao + ssdo), 1.0);
        else gl_FragColor = vec4((baseColor * shadow), 1.0);
    } else 
    {
        if (isSSGIActive) gl_FragColor = vec4((baseColor * ssao + ssdo), 1.0);
        else gl_FragColor = vec4((baseColor), 1.0);
    }  
}
