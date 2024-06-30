// Mariam Baradi del Alamo - 2024
// Scene handler: Imports GLTF scenes, scene loading/undloading, and PostConstructor event calling

import "@babylonjs/loaders/glTF";
import {
    Color3, Color4, CreateGround, DirectionalLight, FreeCamera, HemisphericLight,
    Material, Mesh, Nullable, PBRMaterial, PointLight, Scene, SceneLoader,
    ShadowGenerator, StandardMaterial, Vector3
        } from "@babylonjs/core";
import { GameSingleton, StateScene } from "./GameManager";
import { UIHandler } from "./UIHandler";
import { ComputeShaderHandler } from "./ComputeShaderHandler";

export class SceneHandler
{
    static displacementObject: Nullable<Mesh>;
    static displacementIntenisty: number = 0.0;
    
    private static async BeginSceneLoading()
    {
        GameSingleton.engine.displayLoadingUI();

        this.displacementObject = null;

        if (GameSingleton.scene) 
        {
            GameSingleton.scene.detachControl();
            GameSingleton.scene.dispose();
        }

        let scene = new Scene(GameSingleton.engine);
        scene.clearColor = new Color4(0.1, 0.1, 0.1, 1.0);
        GameSingleton.scene = scene;

        const camera = new FreeCamera("camera", new Vector3(0, 2, 3), GameSingleton.scene);
        camera.attachControl(GameSingleton.canvas, true);
        camera.setTarget(new Vector3(0, 1, 0));
        camera.speed = 0.5;
        // Increase elevation 'E'
        camera.keysUpward.push(69);
        // Decrease elevation 'Q'
        camera.keysDownward.push(81);
        // Move forward 'W'
        camera.keysUp.push(87);
        // Move backwards 'S'
        camera.keysDown.push(83);
        // Move left 'A'
        camera.keysLeft.push(65);
        // Move right 'D'
        camera.keysRight.push(68);
        console.log("Camera near: " + camera.minZ + " far: " + camera.maxZ);
        GameSingleton.camera = camera;
    }

    private static async EndSceneLoading()
    {
        await GameSingleton.scene.whenReadyAsync();
        ComputeShaderHandler.PostConstructor();
        await UIHandler.PostConstructor(); 
        GameSingleton.engine.hideLoadingUI();
    }

    public static SetDisplacementIntensity(intensity: number)
    {
        if (intensity < 0 || GameSingleton.stateScene != StateScene.CORNELLBOX) return;
        if (this.displacementObject != null) {
            this.displacementIntenisty = intensity;

            this.displacementObject.dispose();
            this.displacementObject = null;

            const dispObject = CreateGround("Normal", { subdivisions: 1024, height: 3, width: 4, updatable: true }, GameSingleton.scene);
            dispObject.position = new Vector3(0, 1.5, -2.1);
            dispObject.rotateAround(dispObject.position, Vector3.Right(), Math.PI / 2.0);
            const pbrMat = new PBRMaterial("toit", GameSingleton.scene);
            pbrMat.albedoColor = Color3.White();
            pbrMat.metallic = 0.0;
            dispObject.material = pbrMat;
            this.displacementObject = dispObject;
            // Texture source: https://polyhaven.com/a/rock_wall_09 by Dimitrios Savva
            dispObject.applyDisplacementMap("./textures/rockWall_bump.png", 0, this.displacementIntenisty);
        }
    }

    public static GetDisplacementIntensity()
    {
        return this.displacementIntenisty;
    }

    public static async LoadCornellBoxScene()
    {
        await this.BeginSceneLoading();
        GameSingleton.stateScene = StateScene.CORNELLBOX;
        
        SceneLoader.Append("./scenes/", "cornellBox.glb", GameSingleton.scene, function (scene) {
            var ground = scene.getMeshById("BackgroundPlane");
            if (ground) ground.dispose();

            var sceneLight = scene.getTransformNodeById("light.000");
            var pointLight = new PointLight("pointLight", new Vector3(0, 0, 0), scene);
            if(sceneLight){
                pointLight.position = sceneLight.position;
                var lightColor = new Color3(1.0, 1.0, 1.0);
                pointLight.intensity = 3;
                pointLight.diffuse = lightColor;
                sceneLight.setAbsolutePosition(sceneLight.getAbsolutePosition().subtract(new Vector3(0.0, 0.08, 0.0)));
            }
            
            var meshSceneLight = scene.getMeshById("lamp.000");
            if (meshSceneLight){
                const emissiveMat = new StandardMaterial("sceneLight", scene);
                emissiveMat.emissiveColor = new Color3(1.0, 1.0, 1.0);
                meshSceneLight.material = emissiveMat;
            }

            // Shadows
            const shadowGenerator = new ShadowGenerator(512, pointLight);
            const suzanne = scene.getMeshById("suzanne.000");
            if (suzanne){
                shadowGenerator.addShadowCaster(suzanne);
            }
            const bloc = scene.getMeshById("bloc.000");
            if (bloc){
                shadowGenerator.addShadowCaster(bloc);
            }
            const box = scene.getTransformNodeById("cornellBox.000");
            if (box){
                box.getChildMeshes().forEach(element => {
                    element.receiveShadows = true;
                });
            }

            // Displacement Object
            const dispObject = CreateGround("Normal", { subdivisions: 1024, height: 3, width: 4, updatable: true }, GameSingleton.scene);
            dispObject.position = new Vector3(0, 1.5, -2.1);
            dispObject.rotateAround(dispObject.position, Vector3.Right(), Math.PI / 2.0);
            const pbrMat = new PBRMaterial("toit", GameSingleton.scene);
            pbrMat.albedoColor = Color3.White();
            pbrMat.metallic = 0.0;
            dispObject.material = pbrMat;
            SceneHandler.displacementObject = dispObject;
            // shadowGenerator.addShadowCaster(dispObject);
        });

        
        await this.EndSceneLoading();
    }

    // Initialize after object initialization phase
    public static async PostConstructor()
    {
        this.LoadCornellBoxScene();
    }
}
