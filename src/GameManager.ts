// Mariam Baradi del Alamo - 2024
// Game Manage: Singleton class for project-scope access

import { Camera, Scene, Vector2, WebGPUEngine } from "@babylonjs/core";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D";

export enum StateScene { CORNELLBOX = 0 }

export class GameSingleton {
    static engine : WebGPUEngine;
    static canvas : HTMLCanvasElement;
    static screenSize : Vector2;
    static scene : Scene;
    static camera : Camera;
    static gameGUI: AdvancedDynamicTexture;
    static stateScene: StateScene = StateScene.CORNELLBOX;
}
