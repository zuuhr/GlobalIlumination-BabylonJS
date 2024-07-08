
# WebGPU real-time screen-space global illumination for BabylonJS
![SSGIBabylonJS](https://github.com/zuuhr/GlobalIlumination-BabylonJS/assets/43469859/d6dab4a8-46ef-4286-90f4-36d31400b727)


## Principal elements
### 1. Screen-space ambient occlusion
![Result_SSAO](https://github.com/zuuhr/GlobalIlumination-BabylonJS/assets/43469859/2b060e19-7cd2-49fb-9ce7-0059ed2346ce)

### 2. Screen-space directonal occlusion
![Result_SSDO](https://github.com/zuuhr/GlobalIlumination-BabylonJS/assets/43469859/c4562d29-a7f7-427f-b74e-04b480af7e69)

### 3. Two-pass bilateral gaussian blur
![Blur](https://github.com/zuuhr/GlobalIlumination-BabylonJS/assets/43469859/5367a666-1344-49c0-b558-0425be70d79d)

### 4. Screen-space shadows
![Result_SSS](https://github.com/zuuhr/GlobalIlumination-BabylonJS/assets/43469859/e4575d37-d1e2-4017-9e75-4610e5f6bc5f)

## Features
<p align="center">
  <img src="https://github.com/zuuhr/GlobalIlumination-BabylonJS/assets/43469859/dde20286-627b-4c55-a441-920ac00ec06b" width=60% height=60% align="center">
</p>

### Temporal reprojection
Every frame, the final SSAO + SSDO combination will be weighted with previous frames. In order to avoid ghosting, there is a shift on weight percentages when the camera is moving, giving eventually more weight to the historic values when static.
### Jittering
<p align="center">
  <img src="https://github.com/zuuhr/GlobalIlumination-BabylonJS/assets/43469859/60d79925-4690-431b-ab4e-35698c5844bb" width=40% height=40% align="center">
</p>

**Radious**: Every frame, the projected circle where samples are evaluated gets the radious scaled by a random scalar read from a noise texture.

**Angle**: Every frame, if the number of evaluated samples is smaller than all KERNEL_SIZE samples. A jittering along evenly divided circunference sections will be applied.

### Pixel rejection on skybox pixels
This is an optimization that reduces computation costs if large areas of the screen are skybox. 

## Acknowledgements
I’m very grateful for **Jorge Felix-López Moreno**’s help throughout my work, especially on answering my questions on rendering!
