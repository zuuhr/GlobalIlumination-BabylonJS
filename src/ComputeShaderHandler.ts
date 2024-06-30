// Mariam Baradi del Alamo - 2024
// Compute shader handler: this file dispatches and manages all shader resources

import {
    Color3, ComputeShader, Constants, CreateResizedCopy, DirectionalLight, 
    GeometryBufferRenderer, Matrix, PostProcess, 
    RawTexture, Texture, TextureSampler, UniformBuffer, Vector2, 
    Vector3, Vector4, float, int
        } from "@babylonjs/core";
import { GameSingleton, StateScene } from "./GameManager";

// Hardcoded Noise Texture size value, update when changing the texture
const NOISE_SIZE = 64;

export class ComputeShaderHandler
{
    // Parameters
    private static areComputeShadersEnabled : boolean = false;
    private static isSSAOActive : boolean = true;
    private static isSSDOActive : boolean = true;
    private static isSSSActive : boolean = true;
    private static isBlurActive : boolean = true;

    private static ssgiIterations: int = 16;
    private static ssgiHistoryWeight: float = 0; 
    private static ssgiStaticHistoryWeight: float = 0.99; 
    private static ssgiMovingHistoryWeight: float = 0.7; 
    private static ssgiAOIntensityMultiplier: float = 1.0; 
    private static ssgiAORadious: float = 250; 
    private static ssgiDOIntensityMultiplier: float = 2.0; 
    private static ssgiDORadious: float = 2000; 

    // Directional = 0, Point = 1
    public static lightType : float;
    private static sssShadowLength: float = 0.5;
    private static sssShadowBias: float = 0.008;
    private static sssIntensityMultiplier: float = 0.73;
    private static sssStepSize: float = 0.008;

    // GBuffer
    private static geometryBuffer: GeometryBufferRenderer;
    private static colorTexture: Texture;
    private static noiseTexture: Texture;
    private static positionTexture: Texture;
    private static depthTexture: Texture;
    private static normalTexture: Texture;
    private static velocityTexture: Texture;
    
    // PostProcesses
    private static combinePostProcess: PostProcess;

    // Compute Shaders
    private static ssaoCS: ComputeShader;
    private static ssdoCS: ComputeShader;
    private static ssgiCS: ComputeShader;
    private static blurVerticalCS: ComputeShader;
    private static blurHorizontalCS: ComputeShader;
    private static sssCS: ComputeShader;

    // Compute Shader Texture Handling
    private static outputSSGITexture: Texture;
    private static blurredOutputTexture: Texture;
    private static shadowOutputTexture: Texture;
    private static screenSamplerMirror: TextureSampler;

    // Compute Shader Data Handling
    private static cameraDataBuffer: UniformBuffer;
    private static ssaoParametersBuffer: UniformBuffer;
    private static ssdoParametersBuffer: UniformBuffer;
    private static ssgiParametersBuffer: UniformBuffer;
    private static sssParametersBuffer: UniformBuffer;

    private static async SetupGBuffer(){
        GameSingleton.scene.enableGeometryBufferRenderer();
        this.geometryBuffer = GameSingleton.scene.geometryBufferRenderer ? 
            GameSingleton.scene.geometryBufferRenderer : 
            new GeometryBufferRenderer(GameSingleton.scene);
        this.geometryBuffer.enablePosition = true;
        this.geometryBuffer.enableVelocity = true;
    }

    private static async SetupComputeSSAO(){
        this.ssaoCS = new ComputeShader("ScreenSpaceAmbientOclussionCompute", GameSingleton.engine, 
        "./shaders/csSSAO", 
        { bindingsMapping:
            {
                "outputTex": { group: 0, binding: 0 },
                "positionTex": { group: 0, binding: 1 },
                "normalTex": { group: 0, binding: 2 },
                "velocityTex": { group: 0, binding: 3 },
                "noiseTex": { group: 0, binding: 4 },
                "previousFrameTex": { group: 0, binding: 5 },
                "cameraData": { group: 0, binding: 6 },
                "ssaoParams": { group: 0, binding: 7 },
            } 
        });

        this.ssaoCS.setStorageTexture("outputTex", this.outputSSGITexture);
        this.ssaoCS.setTexture("positionTex", this.positionTexture, false);
        this.ssaoCS.setTexture("normalTex", this.normalTexture, false);
        this.ssaoCS.setTexture("velocityTex", this.velocityTexture, false);
        this.ssaoCS.setTexture("noiseTex", this.noiseTexture, false);
        this.ssaoCS.setUniformBuffer("cameraData", this.cameraDataBuffer);

        // SSAO PARAMETERS
        this.ssaoParametersBuffer = new UniformBuffer(GameSingleton.engine, [16], true, "SSAOParamenters", false);
        this.ssaoParametersBuffer.addUniform("Iterations", 1);
        this.ssaoParametersBuffer.addUniform("HistoryWeight", 1);
        this.ssaoParametersBuffer.addUniform("IntensityMultiplier", 1);
        this.ssaoParametersBuffer.addUniform("AORadious", 1, 0);
        this.ssaoParametersBuffer.addFloat2("NoiseTiling", 1, 1);
        this.ssaoParametersBuffer.addFloat2("RandomKernel", 0, 0);

        this.ssaoCS.setUniformBuffer("ssaoParams", this.ssaoParametersBuffer);
        
        this.ssaoParametersBuffer.updateInt("Iterations", this.ssgiIterations);
        this.ssaoParametersBuffer.updateFloat("HistoryWeight", this.ssgiHistoryWeight);
        this.ssaoParametersBuffer.updateFloat("IntensityMultiplier", this.ssgiAOIntensityMultiplier);
        this.ssaoParametersBuffer.updateFloat("AORadious", this.ssgiAORadious);
        this.ssaoParametersBuffer.updateInt2("NoiseTiling", NOISE_SIZE, NOISE_SIZE);
        this.ssaoParametersBuffer.update();
    }

    private static async SetupComputeSSDO(){
        this.ssdoCS = new ComputeShader("ScreenSpaceDirectionalOclussionCompute", GameSingleton.engine, 
        "./shaders/csSSDO", 
        { bindingsMapping:
            {
                "outputTex": { group: 0, binding: 0 },
                "colorTex": { group: 0, binding: 1 },
                "positionTex": { group: 0, binding: 2 },
                "normalTex": { group: 0, binding: 3 },
                "velocityTex": { group: 0, binding: 4 },
                "noiseTex": { group: 0, binding: 5 },
                "previousFrameTex": { group: 0, binding: 6 },
                "cameraData": { group: 0, binding: 7 },
                "ssdoParams": { group: 0, binding: 8 },
            } 
        });

        this.ssdoCS.setStorageTexture("outputTex", this.outputSSGITexture);
        this.ssdoCS.setTexture("colorTex", this.colorTexture, false);
        this.ssdoCS.setTexture("positionTex", this.positionTexture, false);
        this.ssdoCS.setTexture("normalTex", this.normalTexture, false);
        this.ssdoCS.setTexture("noiseTex", this.noiseTexture, false);
        this.ssdoCS.setTexture("velocityTex", this.velocityTexture, false);
        this.ssdoCS.setUniformBuffer("cameraData", this.cameraDataBuffer);

        // SSDO PARAMETERS
        this.ssdoParametersBuffer = new UniformBuffer(GameSingleton.engine, [16], true, "SSDOParamenters", false);
        this.ssdoParametersBuffer.addUniform("Iterations", 1);
        this.ssdoParametersBuffer.addUniform("HistoryWeight", 1);
        this.ssdoParametersBuffer.addUniform("IntensityMultiplier", 1);
        this.ssdoParametersBuffer.addUniform("DORadious", 1, 0);
        this.ssdoParametersBuffer.addFloat2("NoiseTiling", 1, 1);
        this.ssdoParametersBuffer.addFloat2("RandomKernel", 0, 0);

        this.ssdoCS.setUniformBuffer("ssdoParams", this.ssdoParametersBuffer);

        this.ssdoParametersBuffer.updateInt("Iterations", this.ssgiIterations);
        this.ssdoParametersBuffer.updateFloat("HistoryWeight", this.ssgiHistoryWeight);
        this.ssdoParametersBuffer.updateFloat("IntensityMultiplier", this.ssgiDOIntensityMultiplier);
        this.ssdoParametersBuffer.updateFloat("DORadious", this.ssgiDORadious);
        this.ssdoParametersBuffer.updateInt2("NoiseTiling", NOISE_SIZE, NOISE_SIZE);
        this.ssdoParametersBuffer.update();

    }

    private static async SetupComputeSSGI(){
        this.ssgiCS = new ComputeShader("ScreenSpaceGlobalIlluminationCompute", GameSingleton.engine, 
        "./shaders/csSSGI", 
        { bindingsMapping:
            {
                "outputTex": { group: 0, binding: 0 },
                "colorTex": { group: 0, binding: 1 },
                "positionTex": { group: 0, binding: 2 },
                "normalTex": { group: 0, binding: 3 },
                "velocityTex": { group: 0, binding: 4 },
                "noiseTex": { group: 0, binding: 5 },
                "previousFrameTex": { group: 0, binding: 6 },
                "cameraData": { group: 0, binding: 7 },
                "ssgiParams": { group: 0, binding: 8 },
            } 
        });

        this.ssgiCS.setStorageTexture("outputTex", this.outputSSGITexture);
        this.ssgiCS.setTexture("colorTex", this.colorTexture, false);
        this.ssgiCS.setTexture("positionTex", this.positionTexture, false);
        this.ssgiCS.setTexture("normalTex", this.normalTexture, false);
        this.ssgiCS.setTexture("velocityTex", this.velocityTexture, false);
        this.ssgiCS.setTexture("noiseTex", this.noiseTexture, false);
        this.ssgiCS.setUniformBuffer("cameraData", this.cameraDataBuffer);

        // SSGI PARAMETERS
        this.ssgiParametersBuffer = new UniformBuffer(GameSingleton.engine, [16], true, "SSGIParamenters", false);
        this.ssgiParametersBuffer.addUniform("Iterations", 1);
        this.ssgiParametersBuffer.addUniform("HistoryWeight", 1);
        this.ssgiParametersBuffer.addUniform("AOIntensityMultiplier", 1);
        this.ssgiParametersBuffer.addUniform("AORadious", 1);
        this.ssgiParametersBuffer.addUniform("DOIntensityMultiplier", 1);
        this.ssgiParametersBuffer.addUniform("DORadious", 1);
        this.ssgiParametersBuffer.addFloat2("NoiseTiling", 1, 1);
        this.ssgiParametersBuffer.addFloat2("RandomKernel", 0, 0);

        this.ssgiCS.setUniformBuffer("ssgiParams", this.ssgiParametersBuffer);

        this.ssgiParametersBuffer.updateInt("Iterations", this.ssgiIterations);
        this.ssgiParametersBuffer.updateFloat("HistoryWeight", this.ssgiHistoryWeight);
        this.ssgiParametersBuffer.updateFloat("AOIntensityMultiplier", this.ssgiAOIntensityMultiplier);
        this.ssgiParametersBuffer.updateFloat("AORadious", this.ssgiAORadious);
        this.ssgiParametersBuffer.updateFloat("DOIntensityMultiplier", this.ssgiDOIntensityMultiplier);
        this.ssgiParametersBuffer.updateFloat("DORadious", this.ssgiDORadious);
        this.ssgiParametersBuffer.updateInt2("NoiseTiling", NOISE_SIZE, NOISE_SIZE);
        this.ssgiParametersBuffer.update();
    }
    
    private static async SetupComputeBlur()
    {
        this.blurVerticalCS = new ComputeShader("BilateralVerticalBlurCompute", GameSingleton.engine, "./shaders/csBlurVertical",
        { bindingsMapping:
            {
                "outputTex": { group: 0, binding: 0 },
                "inputTex": { group: 0, binding: 1 },
                "depthTex": { group: 0, binding: 2 },
                "screenSampler": { group: 0, binding: 3 },
            }
        });

        this.blurHorizontalCS = new ComputeShader("BilateralHorizontalBlurCompute", GameSingleton.engine, "./shaders/csBlurHorizontal",
        { bindingsMapping:
            {
                "outputTex": { group: 0, binding: 0 },
                "inputTex": { group: 0, binding: 1 },
                "depthTex": { group: 0, binding: 2 },
                "screenSampler": { group: 0, binding: 3 },
            }
        });

        this.blurVerticalCS.setStorageTexture("outputTex", this.blurredOutputTexture);
        this.blurHorizontalCS.setStorageTexture("outputTex", this.blurredOutputTexture);

        this.blurVerticalCS.setTexture("depthTex", this.depthTexture, false);
        this.blurHorizontalCS.setTexture("depthTex", this.depthTexture, false);

        this.blurVerticalCS.setTextureSampler("screenSampler", this.screenSamplerMirror);
        this.blurHorizontalCS.setTextureSampler("screenSampler", this.screenSamplerMirror);
    }

    private static async SetupComputeShadows()
    {
        this.sssCS = new ComputeShader("ScreenSpaceShadowsCompute", GameSingleton.engine, "./shaders/csSSS",
        { 
            bindingsMapping:
            {
                "outputTex": { group: 0, binding: 0 },
                "depthTex": { group: 0, binding: 1 },
                "cameraData": { group:0, binding: 2 },
                "sssParams": { group:0, binding: 3 },
            }
        });

        this.sssCS.setStorageTexture("outputTex", this.shadowOutputTexture);
        this.sssCS.setTexture("depthTex", this.positionTexture, false);
        this.sssCS.setUniformBuffer("cameraData", this.cameraDataBuffer);

        // SSS PARAMETERS
        this.sssParametersBuffer = new UniformBuffer(GameSingleton.engine, [12], true, "SSSParameters", false);
        this.sssParametersBuffer.addUniform("ShadowLength", 1);
        this.sssParametersBuffer.addUniform("ShadowBias", 1);
        this.sssParametersBuffer.addUniform("StepSize", 1);
        this.sssParametersBuffer.addUniform("IntensityMultiplier", 1);
        this.sssParametersBuffer.addColor4("LightVector", Color3.Black(), 0);

        this.sssCS.setUniformBuffer("sssParams", this.sssParametersBuffer);

        this.sssParametersBuffer.updateFloat("ShadowLength", this.sssShadowLength);
        this.sssParametersBuffer.updateFloat("ShadowBias", this.sssShadowBias);
        this.sssParametersBuffer.updateFloat("StepSize", this.sssStepSize);
        this.sssParametersBuffer.updateFloat("IntensityMultiplier", this.sssIntensityMultiplier);
        this.sssParametersBuffer.update();
    }

    public static async SetupComputeShaders(){
        console.log("Objection!");

        this.SetupGBuffer();

        // Allocate Output Textures
        this.outputSSGITexture = new RawTexture(null, GameSingleton.screenSize.x, GameSingleton.screenSize.y, 
            Constants.TEXTUREFORMAT_RGBA, GameSingleton.scene, false, false, Constants.TEXTURE_BILINEAR_SAMPLINGMODE, 
            Constants.TEXTURETYPE_HALF_FLOAT, Constants.TEXTURE_CREATIONFLAG_STORAGE);
        this.outputSSGITexture.name = "SSGIStorageTexture"

        this.blurredOutputTexture = new RawTexture(null, GameSingleton.screenSize.x, GameSingleton.screenSize.y, 
            Constants.TEXTUREFORMAT_RGBA, GameSingleton.scene, false, false, Constants.TEXTURE_BILINEAR_SAMPLINGMODE, 
            Constants.TEXTURETYPE_HALF_FLOAT, Constants.TEXTURE_CREATIONFLAG_STORAGE);
        this.blurredOutputTexture.name = "BlurredStorageTexture"

        this.shadowOutputTexture = new RawTexture(null, GameSingleton.screenSize.x, GameSingleton.screenSize.y, 
            Constants.TEXTUREFORMAT_RGBA, GameSingleton.scene, false, false, Constants.TEXTURE_NEAREST_SAMPLINGMODE, 
            Constants.TEXTURETYPE_HALF_FLOAT, Constants.TEXTURE_CREATIONFLAG_STORAGE);
        this.shadowOutputTexture.name = "ShadowStorageTexture"

        // Input textures
        this.colorTexture = new Texture(null, GameSingleton.scene);
        this.colorTexture.name = "CameraColorTexture";
        this.positionTexture = this.geometryBuffer.getGBuffer().textures[GeometryBufferRenderer.POSITION_TEXTURE_TYPE];
        this.depthTexture = this.geometryBuffer.getGBuffer().textures[GeometryBufferRenderer.DEPTH_TEXTURE_TYPE];
        this.normalTexture = this.geometryBuffer.getGBuffer().textures[GeometryBufferRenderer.NORMAL_TEXTURE_TYPE];
        this.velocityTexture = this.geometryBuffer.getGBuffer().textures[GeometryBufferRenderer.VELOCITY_TEXTURE_TYPE];
        // You may test other noises to see differences. Remember to change variable NOISE_SIZE accordingly
        this.noiseTexture = new Texture("./textures/LDR_RGB1_3.png", GameSingleton.scene, false, false, Texture.NEAREST_SAMPLINGMODE);
        this.noiseTexture.wrapU = Texture.WRAP_ADDRESSMODE;
        this.noiseTexture.wrapV = Texture.WRAP_ADDRESSMODE;

        console.log("Engine Size width " + GameSingleton.engine.getRenderWidth(false));

        // Binding Sampler
        this.screenSamplerMirror = new TextureSampler().setParameters(Texture.MIRROR_ADDRESSMODE, Texture.MIRROR_ADDRESSMODE, 
            Texture.WRAP_ADDRESSMODE, 0, Texture.BILINEAR_SAMPLINGMODE);

        // Input camera data
        this.cameraDataBuffer = new UniformBuffer(GameSingleton.engine, [80], true, "CameraData", false);
        const mat : Matrix = new Matrix();
        this.cameraDataBuffer.addMatrix("ViewMat", mat);
        this.cameraDataBuffer.addMatrix("ProjMat", mat);
        this.cameraDataBuffer.addVector3("CameraPos", new Vector3());
        this.cameraDataBuffer.addUniform("Padding", 1, 0);
        
        // Per-shader data set-up
        this.SetupComputeSSAO();
        this.SetupComputeSSDO();
        this.SetupComputeSSGI();
        this.SetupComputeBlur();
        this.SetupComputeShadows();
        
        // Composite post-process
        this.combinePostProcess = new PostProcess(
            "Combine",
            "./shaders/combineCS",
            [ 'isSSSActive', 'isSSGIActive' ],
            ['ssgiTex', 'shadowTex', 'textureSampler'],
            1.0,
            null, // Camera
            0, // Sampling mode
            GameSingleton.engine, // Engine
            true, // Reusable
            null, // Defines
            0, // TextureType
            undefined, // Vertex URL
            null, // Index Parameters
            true // Block Compilation
            // . . .
            );
    }
    
    public static ClearAndDetachShaders()
    {
        GameSingleton.scene.onAfterRenderObservable.clear();
        this.combinePostProcess.onApplyObservable.clear();
        GameSingleton.camera.detachPostProcess(this.combinePostProcess);
    }

    public static UpdateAndAttachShaders()
    {     
        this.ClearAndDetachShaders();

        if (!this.areComputeShadersEnabled) return;
        
        this.combinePostProcess.onApplyObservable.add((effect) =>
        {
            effect.setBool("isSSSActive", this.isSSSActive);
            effect.setBool("isSSGIActive", this.isSSAOActive || this.isSSDOActive);
            if (this.isBlurActive) effect.setTexture("ssgiTex", this.blurredOutputTexture);
            else effect.setTexture("ssgiTex", this.outputSSGITexture);
            effect.setTexture("shadowTex", this.shadowOutputTexture);
        });
        GameSingleton.camera.attachPostProcess(this.combinePostProcess);

        GameSingleton.camera.onViewMatrixChangedObservable.add(() => {
            this.SetSSGIHistoryWeight(this.ssgiMovingHistoryWeight, false);
        });

        // Dispatch Compute Shaders After Renering is Done
        GameSingleton.scene.onAfterRenderObservable.add(() => {
            
            // Temp textures. Need to be created every frame. Will be disposed every frame.
            if (this.isSSAOActive || this.isSSDOActive) var tempPreviousFrameTexture;
            if (this.isBlurActive) var tempBlurPassInputTexture;

            // Only update parameters that change every frame
            this.cameraDataBuffer.updateMatrix("ViewMat", GameSingleton.camera.getViewMatrix());
            this.cameraDataBuffer.updateMatrix("ProjMat", GameSingleton.camera.getProjectionMatrix());
            this.cameraDataBuffer.updateVector3("CameraPos", GameSingleton.camera.position);
            this.cameraDataBuffer.update();
            
            // Camera Backbuffer
            this.colorTexture._texture = this.combinePostProcess.inputTexture.texture;

            // Dispatch only requested shaders
            if (this.isSSAOActive || this.isSSDOActive)
            {
                // Static Camera History Weight
                if (this.ssgiHistoryWeight + 0.1 <= this.ssgiStaticHistoryWeight) this.SetSSGIHistoryWeight(this.ssgiHistoryWeight + 0.1, false);
                else this.SetSSGIHistoryWeight(this.ssgiStaticHistoryWeight, false);

                // Generate Random Value
                var numSamples = 2;
                var kernelSphere: number[] = [];
                for (let index = 0; index < numSamples; index++) 
                {
                    var sample = new Vector2(
                        Math.random() * GameSingleton.screenSize.x,
                        Math.random() * GameSingleton.screenSize.y,
                    );
                    sample.x = +sample.x.toFixed(0);
                    sample.y = +sample.y.toFixed(0);
                    kernelSphere.push(parseFloat(sample.x.toString()));
                    kernelSphere.push(parseFloat(sample.y.toString()));
                }

                // Allocate previous Frame Result before computing this frame
                tempPreviousFrameTexture = CreateResizedCopy(this.outputSSGITexture, GameSingleton.screenSize.x, GameSingleton.screenSize.y, false);
                tempPreviousFrameTexture.name = "tempPreviousFrameTexture";
    
                // SSGI (SSAO + SSDO)
                if (this.isSSAOActive && this.isSSDOActive)
                {
                    this.ssgiParametersBuffer.updateInt2("RandomKernel", kernelSphere[0], kernelSphere[1]);
                    this.ssgiParametersBuffer.update();
                    this.ssgiCS.setTexture("previousFrameTex", tempPreviousFrameTexture, false);
                    this.ssgiCS.dispatchWhenReady(320, 160, 1);
                // Only SSDO
                } else if (this.isSSDOActive)
                {
                    this.ssdoParametersBuffer.updateInt2("RandomKernel", kernelSphere[0], kernelSphere[1]);
                    this.ssdoParametersBuffer.update();
                    this.ssdoCS.setTexture("previousFrameTex", tempPreviousFrameTexture, false);
                    this.ssdoCS.dispatchWhenReady(320, 160, 1);
                // Only SSAO
                } else 
                {
                    this.ssaoParametersBuffer.updateInt2("RandomKernel", kernelSphere[0], kernelSphere[1]);
                    this.ssaoParametersBuffer.update();
                    this.ssaoCS.setTexture("previousFrameTex", tempPreviousFrameTexture, false);
                    this.ssaoCS.dispatchWhenReady(320, 160, 1);
                }
                
                // Blur. Only applied when there is any of the SSGI active
                if (this.isBlurActive)
                {
                    tempBlurPassInputTexture = this.outputSSGITexture;
                    // Horizontal Blur
                    this.blurHorizontalCS.setTexture("inputTex", tempBlurPassInputTexture, false);
                    this.blurHorizontalCS.dispatchWhenReady(320, 160, 1);
                    
                    // Allocate temp texture and write result
                    tempBlurPassInputTexture = CreateResizedCopy(this.blurredOutputTexture, GameSingleton.screenSize.x, GameSingleton.screenSize.y, false);
                    tempBlurPassInputTexture.name = "tempBlurPassInputTexture";
                    
                    // Vertical Blur
                    this.blurVerticalCS.setTexture("inputTex", tempBlurPassInputTexture, false);
                    this.blurVerticalCS.dispatchWhenReady(320, 160, 1);
                }
            }

            // Shadows. Computed independently from SSGI
            if (this.isSSSActive)
            {
                let lightPos : Vector3;
                // Directional = 0, Point = 1
                if (this.lightType == 0){
                    const directional = GameSingleton.scene.lights[0] as DirectionalLight;
                    lightPos =  Vector3.TransformNormal(directional.direction, GameSingleton.camera.getViewMatrix());
                    lightPos.x = - lightPos.x;
                    lightPos.y = - lightPos.y;
                    lightPos.z = - lightPos.z;
                } else {
                    lightPos = GameSingleton.scene.lights[0].getAbsolutePosition();
                    lightPos = Vector4.TransformCoordinates(lightPos, GameSingleton.camera.getViewMatrix()).toVector3();
                }
                this.sssParametersBuffer.updateFloat4("LightVector", lightPos.x, lightPos.y, lightPos.z, this.lightType);
                this.sssParametersBuffer.update();
                this.sssCS.dispatchWhenReady(320, 160, 1);
            }

            // Send compute shaders' results to post process
            this.combinePostProcess.updateEffect();

            // Dispose temp textures
            if (tempPreviousFrameTexture) tempPreviousFrameTexture.dispose();
            if (tempBlurPassInputTexture) tempBlurPassInputTexture.dispose();
        });

    }

    // Responsive web resize handling
    public static ScreenResize()
    {
        this.positionTexture = this.geometryBuffer.getGBuffer().textures[GeometryBufferRenderer.POSITION_TEXTURE_TYPE];
        this.depthTexture = this.geometryBuffer.getGBuffer().textures[GeometryBufferRenderer.DEPTH_TEXTURE_TYPE];
        this.normalTexture = this.geometryBuffer.getGBuffer().textures[GeometryBufferRenderer.NORMAL_TEXTURE_TYPE];
        this.velocityTexture = this.geometryBuffer.getGBuffer().textures[GeometryBufferRenderer.VELOCITY_TEXTURE_TYPE];

        this.outputSSGITexture = new RawTexture(null, GameSingleton.screenSize.x, GameSingleton.screenSize.y, 
            Constants.TEXTUREFORMAT_RGBA, GameSingleton.scene, false, false, Constants.TEXTURE_NEAREST_SAMPLINGMODE, 
            Constants.TEXTURETYPE_HALF_FLOAT, Constants.TEXTURE_CREATIONFLAG_STORAGE
            );
        this.outputSSGITexture.name = "SSGIStorageTexture"

        this.blurredOutputTexture = new RawTexture(null, GameSingleton.screenSize.x, GameSingleton.screenSize.y, 
            Constants.TEXTUREFORMAT_RGBA, GameSingleton.scene, false, false, Constants.TEXTURE_BILINEAR_SAMPLINGMODE, 
            Constants.TEXTURETYPE_HALF_FLOAT, Constants.TEXTURE_CREATIONFLAG_STORAGE
            );
        this.blurredOutputTexture.name = "BlurredStorageTexture"

        this.shadowOutputTexture = new RawTexture(null, GameSingleton.screenSize.x, GameSingleton.screenSize.y, 
            Constants.TEXTUREFORMAT_RGBA, GameSingleton.scene, false, false, Constants.TEXTURE_BILINEAR_SAMPLINGMODE, 
            Constants.TEXTURETYPE_HALF_FLOAT, Constants.TEXTURE_CREATIONFLAG_STORAGE
            );
        this.shadowOutputTexture.name = "ShadowStorageTexture"

        this.ssaoCS.setStorageTexture("outputTex", this.outputSSGITexture);
        this.ssaoCS.setTexture("positionTex", this.positionTexture, false);
        this.ssaoCS.setTexture("normalTex", this.normalTexture, false);
        this.ssaoCS.setTexture("velocityTex", this.velocityTexture, false);
        this.ssaoCS.setTexture("noiseTex", this.noiseTexture, false);

        this.ssdoCS.setStorageTexture("outputTex", this.outputSSGITexture);
        this.ssdoCS.setTexture("colorTex", this.colorTexture, false);
        this.ssdoCS.setTexture("positionTex", this.positionTexture, false);
        this.ssdoCS.setTexture("normalTex", this.normalTexture, false);
        this.ssdoCS.setTexture("velocityTex", this.velocityTexture, false);
        this.ssdoCS.setTexture("noiseTex", this.noiseTexture, false);
        
        this.ssgiCS.setStorageTexture("outputTex", this.outputSSGITexture);
        this.ssgiCS.setTexture("colorTex", this.colorTexture, false);
        this.ssgiCS.setTexture("positionTex", this.positionTexture, false);
        this.ssgiCS.setTexture("normalTex", this.normalTexture, false);
        this.ssgiCS.setTexture("velocityTex", this.velocityTexture, false);
        this.ssgiCS.setTexture("noiseTex", this.noiseTexture, false);

        this.blurVerticalCS.setStorageTexture("outputTex", this.blurredOutputTexture);
        this.blurVerticalCS.setTexture("depthTex", this.depthTexture, false);
        this.blurHorizontalCS.setStorageTexture("outputTex", this.blurredOutputTexture);
        this.blurHorizontalCS.setTexture("depthTex", this.depthTexture, false);

        this.sssCS.setStorageTexture("outputTex", this.shadowOutputTexture);
        this.sssCS.setTexture("depthTex", this.positionTexture, false);
    }

    // Public Functions
    public static GetSSGIIterations() { return this.ssgiIterations };
    public static GetSSGIHistoryWeight() { return this.ssgiHistoryWeight };
    public static GetSSGIAOIntensity() { return this.ssgiAOIntensityMultiplier };
    public static GetSSGIAORadious() { return this.ssgiAORadious };
    public static GetSSGIDOIntensity() { return this.ssgiDOIntensityMultiplier };
    public static GetSSGIDORadious() { return this.ssgiDORadious };
    
    public static GetSSSIntensity() { return this.sssIntensityMultiplier };
    public static GetSSSShadowLength() { return this.sssShadowLength };
    public static GetSSSShadowBias() { return this.sssShadowBias };
    public static GetSSSStepSize() { return this.sssStepSize };

    public static SetSSGIIterations(value: number, checkValid: boolean)
    {
        const threshold = 1;
        if (checkValid && Math.abs(value - this.ssgiIterations) < threshold) return;
        this.ssgiIterations = value;
        this.ssaoParametersBuffer.updateFloat("Iterations", this.ssgiIterations);
        this.ssaoParametersBuffer.update();
        this.ssdoParametersBuffer.updateFloat("Iterations", this.ssgiIterations);
        this.ssdoParametersBuffer.update();
        this.ssgiParametersBuffer.updateFloat("Iterations", this.ssgiIterations);
        this.ssgiParametersBuffer.update();
    }

    public static SetSSGIHistoryWeight(value: number, checkValid: boolean)
    {
        const threshold = 0.05;
        if (checkValid && Math.abs(value - this.ssgiHistoryWeight) < threshold) return;
        this.ssgiHistoryWeight = value;
        this.ssaoParametersBuffer.updateFloat("HistoryWeight", this.ssgiHistoryWeight);
        this.ssaoParametersBuffer.update();
        this.ssdoParametersBuffer.updateFloat("HistoryWeight", this.ssgiHistoryWeight);
        this.ssdoParametersBuffer.update();
        this.ssgiParametersBuffer.updateFloat("HistoryWeight", this.ssgiHistoryWeight);
        this.ssgiParametersBuffer.update();
    }

    public static SetSSGIAOIntensity(value: number, checkValid: boolean)
    {
        const threshold = 0.01;
        if (checkValid && Math.abs(value - this.ssgiAOIntensityMultiplier) < threshold) return;
        this.ssgiAOIntensityMultiplier = value;
        this.ssaoParametersBuffer.updateFloat("IntensityMultiplier", this.ssgiAOIntensityMultiplier);
        this.ssaoParametersBuffer.update();
        this.ssgiParametersBuffer.updateFloat("AOIntensityMultiplier", this.ssgiAOIntensityMultiplier);
        this.ssgiParametersBuffer.update();
        this.SetSSGIHistoryWeight(this.ssgiMovingHistoryWeight, false);
    }
    public static SetSSGIAORadious(value: number, checkValid: boolean)
    {
        const threshold = 0.001;
        if (checkValid && Math.abs(value - this.ssgiAORadious) < threshold) return;
        this.ssgiAORadious = value;
        this.ssaoParametersBuffer.updateFloat("AORadious", this.ssgiAORadious);
        this.ssaoParametersBuffer.update();
        this.ssgiParametersBuffer.updateFloat("AORadious", this.ssgiAORadious);
        this.ssgiParametersBuffer.update();
        this.SetSSGIHistoryWeight(this.ssgiMovingHistoryWeight, false);
    }
    public static SetSSGIDOIntensity(value: number, checkValid: boolean)
    {
        const threshold = 0.01;
        if (checkValid && Math.abs(value - this.ssgiDOIntensityMultiplier) < threshold) return;
        this.ssgiDOIntensityMultiplier = value;
        this.ssdoParametersBuffer.updateFloat("IntensityMultiplier", this.ssgiDOIntensityMultiplier);
        this.ssdoParametersBuffer.update();
        this.ssgiParametersBuffer.updateFloat("DOIntensityMultiplier", this.ssgiDOIntensityMultiplier);
        this.ssgiParametersBuffer.update();
        this.SetSSGIHistoryWeight(this.ssgiMovingHistoryWeight, false);
    }
    public static SetSSGIDORadious(value: number, checkValid: boolean)
    {
        const threshold = 0.1;
        if (checkValid && Math.abs(value - this.ssgiDORadious) < threshold) return;
        this.ssgiDORadious = value;
        this.ssdoParametersBuffer.updateFloat("DORadious", this.ssgiDORadious);
        this.ssdoParametersBuffer.update();
        this.ssgiParametersBuffer.updateFloat("DORadious", this.ssgiDORadious);
        this.ssgiParametersBuffer.update();
        this.SetSSGIHistoryWeight(this.ssgiMovingHistoryWeight, false);
    }

    public static SetSSSIntensity(value: number, checkValid: boolean)
    {
        const threshold = 0.01;
        if (checkValid && Math.abs(value - this.sssIntensityMultiplier) < threshold) return;
        this.sssIntensityMultiplier = value;
        this.sssParametersBuffer.updateFloat("IntensityMultiplier", this.sssIntensityMultiplier);
        this.sssParametersBuffer.update();
    }

    public static SetSSSShadowLength(value: number, checkValid: boolean)
    {
        const threshold = 0.01;
        if (checkValid && Math.abs(value - this.sssShadowLength) < threshold) return;
        this.sssShadowLength = value;
        this.sssParametersBuffer.updateFloat("ShadowLength", this.sssShadowLength);
        this.sssParametersBuffer.update();
    }

    public static SetSSSShadowBias(value: number, checkValid: boolean)
    {
        const threshold = 0.01;
        if (checkValid && Math.abs(value - this.sssShadowBias) < threshold) return;
        this.sssShadowBias = value;
        this.sssParametersBuffer.updateFloat("ShadowBias", this.sssShadowBias);
        this.sssParametersBuffer.update();
    }

    public static SetSSSStepSize(value: number, checkValid: boolean)
    {
        const threshold = 0.0001;
        if (checkValid && Math.abs(value - this.sssStepSize) < threshold) return;
        this.sssStepSize = value;
        this.sssParametersBuffer.updateFloat("StepSize", this.sssStepSize);
        this.sssParametersBuffer.update();
    }

    public static ToggleAllComputeShaders()
    {
        this.SetSSGIHistoryWeight(this.ssgiMovingHistoryWeight, false);
        this.areComputeShadersEnabled = !this.areComputeShadersEnabled;
        console.log(this.areComputeShadersEnabled);
        this.UpdateAndAttachShaders(); 
    }
    public static ToggleSSAO() {
        this.SetSSGIHistoryWeight(this.ssgiMovingHistoryWeight, false);
        if (!this.areComputeShadersEnabled) return; 
        this.isSSAOActive = !this.isSSAOActive;
        this.UpdateAndAttachShaders();
    }
    public static ToggleSSDO() { 
        this.SetSSGIHistoryWeight(this.ssgiMovingHistoryWeight, false);
        if (!this.areComputeShadersEnabled) return; 
        this.isSSDOActive = !this.isSSDOActive;
        this.UpdateAndAttachShaders(); 
    }
    public static ToggleSSS(){ 
        if (!this.areComputeShadersEnabled) return; 
        console.log("You clicked on SSS");
        this.isSSSActive = !this.isSSSActive;
        this.UpdateAndAttachShaders();
    }
    public static ToggleBlur() { 
        this.SetSSGIHistoryWeight(this.ssgiMovingHistoryWeight, false);
        if (!this.areComputeShadersEnabled) return; 
        this.isBlurActive = !this.isBlurActive;
        this.UpdateAndAttachShaders(); 
    }

    // Initialize after object initialization phase
    public static async PostConstructor()
    {
        this.SetupComputeShaders();

        // Per-scene default values
        switch (GameSingleton.stateScene) {
            case StateScene.CORNELLBOX:
                this.SetSSGIAOIntensity(2, false);
                this.SetSSGIAORadious(250, false);
                this.SetSSGIDOIntensity(8, false);
                this.SetSSGIDORadious(4000, false);
                this.SetSSSIntensity(1, false);
                this.SetSSSShadowLength(1.2, false);
                this.SetSSSShadowBias(0.02, false);
                this.SetSSSStepSize(0.02, false);
                this.lightType = 1;
                break;
       }
    }
}
