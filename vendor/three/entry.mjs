import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const ns = Object.assign({}, THREE, { GLTFLoader });
globalThis.THREE = ns;
