// Mariam Baradi del Alamo - 2024
// UI handler: Imports GUI and UI events handling

import { AdvancedDynamicTexture, Button, Grid, Slider, Rectangle, InputText, TextBlock } from "@babylonjs/gui/2D";
import { SceneHandler } from "./SceneHandler";
import { ComputeShaderHandler } from "./ComputeShaderHandler";
import { GameSingleton } from "./GameManager";
import { Camera, Vector3 } from "@babylonjs/core";

export class UIHandler
{
    private static gameGUICamera : Camera;
    
    private static btnSceneCornellBox : Button;

    private static btnToggleAll : Button;
    private static btnToggleSSAO : Button;
    private static btnToggleSSDO : Button;
    private static btnToggleSSS : Button;
    private static btnToggleBlur : Button;

    private static itDisplacementIntensity : InputText;
    private static itSSAOIntensity : InputText;
    private static itSSAORadious : InputText;
    private static sdrSSAORadious : Slider;
    private static itSSDOIntensity : InputText;
    private static itSSDORadious : InputText;
    private static sdrSSDORadious : Slider;
    
    private static itSSSIntensity : InputText;
    private static itSSShadowLength : InputText;
    private static sdrSSSShadowLength : Slider;
    private static itSSShadowBias : InputText;
    private static sdrSSSShadowBias : Slider;
    private static itSSStepSize : InputText;
    private static sdrSSSStepSize : Slider;

    // Initialize after object initialization phase
    public static async PostConstructor()
    {
        // Create UI camera
        this.gameGUICamera = new Camera("", Vector3.Zero(), GameSingleton.scene, false);
        this.gameGUICamera.layerMask = 0x10000000;
        GameSingleton.scene.activeCameras = [GameSingleton.camera, this.gameGUICamera];

        // Fetch UI file
        GameSingleton.gameGUI = AdvancedDynamicTexture.CreateFullscreenUI("Game GUI");
        GameSingleton.gameGUI = await GameSingleton.gameGUI.parseFromURLAsync("./ui/gameGUI.json");
        if (GameSingleton.gameGUI.layer) GameSingleton.gameGUI.layer.layerMask = 0x10000000;

        // Disable blocking UI
        let background = GameSingleton.gameGUI.getControlByName("Rectangle") as Rectangle;
        background.isPointerBlocker = false;
        let gridLeft = GameSingleton.gameGUI.getControlByName("G_Left") as Grid;
        gridLeft.isPointerBlocker = false;
        let gridRight = GameSingleton.gameGUI.getControlByName("G_Right") as Grid;
        gridRight.isPointerBlocker = false;

        // Scene buttons
        this.btnSceneCornellBox = GameSingleton.gameGUI.getControlByName("B_CornellBox") as Button;
        this.btnSceneCornellBox.onPointerClickObservable.add(async () => { await SceneHandler.LoadCornellBoxScene(); });

        // Shader buttons
        this.btnToggleAll = GameSingleton.gameGUI.getControlByName("B_ToggleAll") as Button;
        this.btnToggleAll.onPointerDownObservable.add(() => { ComputeShaderHandler.ToggleAllComputeShaders(); });
        this.btnToggleSSAO = GameSingleton.gameGUI.getControlByName("B_ToggleSSAO") as Button;
        this.btnToggleSSAO.onPointerClickObservable.add(() => { ComputeShaderHandler.ToggleSSAO(); });
        this.btnToggleSSDO = GameSingleton.gameGUI.getControlByName("B_ToggleSSDO") as Button;
        this.btnToggleSSDO.onPointerClickObservable.add(() => { ComputeShaderHandler.ToggleSSDO(); });
        this.btnToggleSSS = GameSingleton.gameGUI.getControlByName("B_ToggleSSS") as Button;
        this.btnToggleSSS.onPointerClickObservable.add(() => { ComputeShaderHandler.ToggleSSS(); });
        this.btnToggleBlur = GameSingleton.gameGUI.getControlByName("B_ToggleBlur") as Button;
        this.btnToggleBlur.onPointerClickObservable.add(() => { ComputeShaderHandler.ToggleBlur(); });

        // Handle UI events
        const doNotCheckValidity : boolean = false;

        this.itDisplacementIntensity = GameSingleton.gameGUI.getControlByName("IT_Displacement") as InputText;
        this.itDisplacementIntensity.onBlurObservable.add(function(value)
        {
            let floatValue = parseFloat(value.text);
            SceneHandler.SetDisplacementIntensity(floatValue);
            UIHandler.itDisplacementIntensity.text = SceneHandler.GetDisplacementIntensity().toString();
        });

        this.itSSAOIntensity = GameSingleton.gameGUI.getControlByName("IT_AOIntensity") as InputText;
        this.itSSAOIntensity.onBlurObservable.add(function(value) 
        {
            let floatValue = parseFloat(value.text);
            ComputeShaderHandler.SetSSGIAOIntensity(floatValue, doNotCheckValidity);
            UIHandler.itSSAOIntensity.text = ComputeShaderHandler.GetSSGIAOIntensity().toString();
        });
        this.itSSAORadious = GameSingleton.gameGUI.getControlByName("IT_AORadious") as InputText;
        this.itSSAORadious.onBlurObservable.add(function(value) 
        {
            let floatValue = parseFloat(value.text);
            ComputeShaderHandler.SetSSGIAORadious(floatValue, doNotCheckValidity);
            UIHandler.sdrSSAORadious.value = ComputeShaderHandler.GetSSGIAORadious();
            UIHandler.itSSAORadious.text = ComputeShaderHandler.GetSSGIAORadious().toString();
        });
        this.sdrSSAORadious = GameSingleton.gameGUI.getControlByName("S_AORadious") as Slider;
        this.sdrSSAORadious.onValueChangedObservable.add(function(value) 
        { 
            ComputeShaderHandler.SetSSGIAORadious(value, !doNotCheckValidity); 
            UIHandler.sdrSSAORadious.value = ComputeShaderHandler.GetSSGIAORadious();
            UIHandler.itSSAORadious.text = ComputeShaderHandler.GetSSGIAORadious().toString();
        });

        this.itSSDOIntensity = GameSingleton.gameGUI.getControlByName("IT_DOIntensity") as InputText;
        this.itSSDOIntensity.onBlurObservable.add(function(value) 
        {
            let floatValue = parseFloat(value.text);
            ComputeShaderHandler.SetSSGIDOIntensity(floatValue, doNotCheckValidity);
            UIHandler.itSSDOIntensity.text = ComputeShaderHandler.GetSSGIDOIntensity().toString();
        });

        this.itSSDORadious = GameSingleton.gameGUI.getControlByName("IT_DORadious") as InputText;
        this.itSSDORadious.onBlurObservable.add(function(value) 
        {
            let floatValue = parseFloat(value.text);
            ComputeShaderHandler.SetSSGIDORadious(floatValue, doNotCheckValidity);
            UIHandler.sdrSSDORadious.value = ComputeShaderHandler.GetSSGIDORadious();
            UIHandler.itSSDORadious.text = ComputeShaderHandler.GetSSGIDORadious().toString();
        });
        this.sdrSSDORadious = GameSingleton.gameGUI.getControlByName("S_DORadious") as Slider;
        this.sdrSSDORadious.onValueChangedObservable.add(function(value) 
        { 
            ComputeShaderHandler.SetSSGIDORadious(value, !doNotCheckValidity); 
            UIHandler.sdrSSDORadious.value = ComputeShaderHandler.GetSSGIDORadious();
            UIHandler.itSSDORadious.text = ComputeShaderHandler.GetSSGIDORadious().toString();
        });
        
        this.itSSSIntensity = GameSingleton.gameGUI.getControlByName("IT_ShadowIntensity") as InputText;
        this.itSSSIntensity.onBlurObservable.add(function(value) 
        {
            let floatValue = parseFloat(value.text);
            ComputeShaderHandler.SetSSSIntensity(floatValue, doNotCheckValidity);
            UIHandler.itSSSIntensity.text = ComputeShaderHandler.GetSSSIntensity().toString();
        });

        this.itSSShadowLength = GameSingleton.gameGUI.getControlByName("IT_ShadowLength") as InputText;
        this.itSSShadowLength.onBlurObservable.add(function(value) 
        {
            let floatValue = parseFloat(value.text);
            ComputeShaderHandler.SetSSSShadowLength(floatValue, doNotCheckValidity);
            UIHandler.sdrSSSShadowLength.value = ComputeShaderHandler.GetSSSShadowLength();
            UIHandler.itSSShadowLength.text = ComputeShaderHandler.GetSSSShadowLength().toString();
        });
        this.sdrSSSShadowLength = GameSingleton.gameGUI.getControlByName("S_ShadowLength") as Slider;
        this.sdrSSSShadowLength.onValueChangedObservable.add(function(value) 
        { 
            ComputeShaderHandler.SetSSSShadowLength(value, !doNotCheckValidity); 
            UIHandler.sdrSSSShadowLength.value = ComputeShaderHandler.GetSSSShadowLength();
            UIHandler.itSSShadowLength.text = ComputeShaderHandler.GetSSSShadowLength().toString();
        });

        this.itSSShadowBias = GameSingleton.gameGUI.getControlByName("IT_ShadowBias") as InputText;
        this.itSSShadowBias.onBlurObservable.add(function(value) 
        {
            let floatValue = parseFloat(value.text);
            ComputeShaderHandler.SetSSSShadowBias(floatValue, doNotCheckValidity);
            UIHandler.itSSShadowBias.text = ComputeShaderHandler.GetSSSShadowBias().toString();
        });
        this.sdrSSSShadowBias = GameSingleton.gameGUI.getControlByName("S_ShadowBias") as Slider;
        this.sdrSSSShadowBias.onValueChangedObservable.add(function(value) 
        { 
            ComputeShaderHandler.SetSSSShadowBias(value, !doNotCheckValidity); 
            UIHandler.sdrSSSShadowBias.value = ComputeShaderHandler.GetSSSShadowBias();
        });

        this.itSSStepSize = GameSingleton.gameGUI.getControlByName("IT_StepSize") as InputText;
        this.itSSStepSize.onBlurObservable.add(function(value) 
        {
            console.log("Step size is now: " + value.text);
            let floatValue = parseFloat(value.text);
            ComputeShaderHandler.SetSSSStepSize(floatValue, doNotCheckValidity);
            UIHandler.sdrSSSStepSize.value = ComputeShaderHandler.GetSSSStepSize();
            UIHandler.itSSStepSize.text = ComputeShaderHandler.GetSSSStepSize().toString();
        });
        this.sdrSSSStepSize = GameSingleton.gameGUI.getControlByName("S_StepSize") as Slider;
        this.sdrSSSStepSize.onValueChangedObservable.add(function(value) 
        { 
            ComputeShaderHandler.SetSSSStepSize(value, !doNotCheckValidity); 
            UIHandler.sdrSSSStepSize.value = ComputeShaderHandler.GetSSSStepSize();
            UIHandler.itSSStepSize.text = ComputeShaderHandler.GetSSSStepSize().toString();
        });

        // Initialize all UI values
        this.itDisplacementIntensity.text = SceneHandler.GetDisplacementIntensity().toString();
        this.itSSAOIntensity.text = ComputeShaderHandler.GetSSGIAOIntensity().toString();
        this.itSSAORadious.text = ComputeShaderHandler.GetSSGIAORadious().toString();
        this.itSSDOIntensity.text = ComputeShaderHandler.GetSSGIDOIntensity().toString();
        this.itSSDORadious.text = ComputeShaderHandler.GetSSGIDORadious().toString();
        this.itSSSIntensity.text = ComputeShaderHandler.GetSSSIntensity().toString();
        this.itSSShadowLength.text = ComputeShaderHandler.GetSSSShadowLength().toString();
        this.itSSShadowBias.text = ComputeShaderHandler.GetSSSShadowBias().toString();
        this.itSSStepSize.text = ComputeShaderHandler.GetSSSStepSize().toString();

        // Show FPS
        const tFPS = GameSingleton.gameGUI.getControlByName("T_FPS") as TextBlock;
        GameSingleton.scene.onBeforeRenderObservable.add(() =>
        {
            tFPS.text = String("FPS: " + GameSingleton.engine.getFps().toFixed(0));
        });
    }
}
