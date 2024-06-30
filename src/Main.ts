// Mariam Baradi del Alamo - 2024
// Main: Entry point of the project code

import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import { Vector2, WebGPUEngine} from "@babylonjs/core";
import { GameSingleton } from "./GameManager";
import { SceneHandler } from "./SceneHandler";
import { ComputeShaderHandler } from "./ComputeShaderHandler";

class Main
{
    private CreateCanvas(): HTMLCanvasElement
    {
        document.documentElement.style["overflow"] = "hidden";
        document.documentElement.style.overflow = "hidden";
        document.documentElement.style.width = "100%";
        document.documentElement.style.height = "100%";
        document.documentElement.style.margin = "0";
        document.documentElement.style.padding = "0";
        document.body.style.overflow = "hidden";
        document.body.style.width = "100%";
        document.body.style.height = "100%";
        document.body.style.margin = "0";
        document.body.style.padding = "0";

        let canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.id = "canvas";
        document.body.appendChild(canvas);
        return canvas;
    }

    private async Init()
    {
        // Initialize babylon scene and engine
        GameSingleton.engine = new WebGPUEngine(GameSingleton.canvas);
        await GameSingleton.engine.initAsync();
        GameSingleton.screenSize = new Vector2(GameSingleton.engine.getRenderWidth(), GameSingleton.engine.getRenderHeight());
        
        // Set up scene and shaders
        await SceneHandler.PostConstructor();
        
        // Render Loop
        GameSingleton.engine.runRenderLoop(() => { GameSingleton.scene.render(); });

        // Hide/show the Inspector
        window.addEventListener("keydown", (eventKey) =>
        {
            // Ctrl+I
            if (eventKey.ctrlKey && eventKey.key === 'i')
            {
                if (GameSingleton.scene.debugLayer.isVisible())
                {
                    GameSingleton.scene.debugLayer.hide();
                } else
                {
                    GameSingleton.scene.debugLayer.show();
                }
            }
            if (eventKey.key === 't') ComputeShaderHandler.ToggleAllComputeShaders(); 
            if (eventKey.key === 'u'){
                if (GameSingleton.gameGUI.layer) GameSingleton.gameGUI.layer.isEnabled = !GameSingleton.gameGUI.layer.isEnabled;
                
            }
        });

        // Responsive rendering
        window.addEventListener('resize', () =>
        {
            GameSingleton.engine.resize(true);
            GameSingleton.screenSize = new Vector2(GameSingleton.engine.getRenderWidth(), GameSingleton.engine.getRenderHeight());
            ComputeShaderHandler.ScreenResize();
        });
    }

    constructor()
    {
        GameSingleton.canvas = this.CreateCanvas();
        this.Init();   
    }
}

new Main();
