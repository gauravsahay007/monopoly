<script setup lang="ts">
import { onMounted, ref, watch, onBeforeUnmount } from 'vue';
import * as THREE from 'three';

const props = defineProps<{
  diceMain: number;
  diceSec: number;
  isRolling: boolean;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let diceMesh1: THREE.Mesh;
let diceMesh2: THREE.Mesh;
let animationId: number;

const createFaceTexture = (value: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    // Clean white, no border
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);
    
    // Border removed per request ("completely white")
    
    ctx.fillStyle = '#000000';
    
    const dotSize = 25;
    const drawDot = (x: number, y: number) => {
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fill();
    };

    const mid = 128;
    const low = 64;
    const high = 192;

    if (value === 1) {
        drawDot(mid, mid);
    } else if (value === 2) {
        drawDot(low, low); drawDot(high, high);
    } else if (value === 3) {
        drawDot(low, low); drawDot(mid, mid); drawDot(high, high);
    } else if (value === 4) {
        drawDot(low, low); drawDot(high, low);
        drawDot(low, high); drawDot(high, high);
    } else if (value === 5) {
        drawDot(low, low); drawDot(high, low);
        drawDot(mid, mid);
        drawDot(low, high); drawDot(high, high);
    } else if (value === 6) {
        drawDot(low, low); drawDot(high, low);
        drawDot(low, mid); drawDot(high, mid);
        drawDot(low, high); drawDot(high, high);
    }

    const texture = new THREE.CanvasTexture(canvas);
    return new THREE.MeshPhongMaterial({ map: texture });
};

// Create the 6 materials once
let diceMaterials: THREE.Material[] = [];

onMounted(() => {
    if (!containerRef.value) return;

    // init three js
    const width = containerRef.value.clientWidth;
    const height = containerRef.value.clientHeight;

    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    // Move to Top-Down view so result (Top Face) faces screen
    camera.position.set(0, 10, 0.1); 
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    containerRef.value.appendChild(renderer.domElement);

    // Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // Dice Materials
    diceMaterials = [];
    for(let i=1; i<=6; i++) {
        diceMaterials.push(createFaceTexture(i));
    }

    // Bigger Dice
    const geometry = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    
    diceMesh1 = new THREE.Mesh(geometry, diceMaterials);
    diceMesh1.position.x = -1.2; // Space them out for bigger size
    scene.add(diceMesh1);

    diceMesh2 = new THREE.Mesh(geometry, diceMaterials);
    diceMesh2.position.x = 1.2;
    scene.add(diceMesh2);

    updateDiceVisuals(props.diceMain, props.diceSec);
    animate();
});

onBeforeUnmount(() => {
    cancelAnimationFrame(animationId);
    renderer?.dispose();
});

function animate() {
    animationId = requestAnimationFrame(animate);
    
    if (props.isRolling) {
        // Random spin
        if (diceMesh1) {
            diceMesh1.rotation.x += 0.2;
            diceMesh1.rotation.y += 0.3;
        }
        if (diceMesh2) {
            diceMesh2.rotation.x += 0.3;
            diceMesh2.rotation.y += 0.2;
        }
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

function getRotationForValue(val: number): THREE.Euler {
     // Material indices: 0..(1), 1..(2), 2..(3), 3..(4), 4..(5), 5..(6)
     // Faces: Right, Left, Top, Bottom, Front, Back.
     
     const rot = new THREE.Euler();
     
     // 1 (Right): Z+90 to face Up
     // 2 (Left): Z-90 to face Up
     // 3 (Top): X0
     // 4 (Bottom): X180
     // 5 (Front): X-90
     // 6 (Back): X+90

     switch(val) {
         case 1: rot.z = Math.PI / 2; break; 
         case 2: rot.z = -Math.PI / 2; break;
         case 3: rot.x = 0; break; 
         case 4: rot.x = Math.PI; break;
         case 5: rot.x = -Math.PI / 2; break;
         case 6: rot.x = Math.PI / 2; break;
     }

     return rot;
}

function updateDiceVisuals(v1: number, v2: number) {
    if (!diceMesh1 || !diceMesh2) return;
    
    const r1 = getRotationForValue(v1 || 1);
    diceMesh1.rotation.set(r1.x, r1.y, r1.z);

    const r2 = getRotationForValue(v2 || 1);
    diceMesh2.rotation.set(r2.x, r2.y, r2.z);
}

watch(() => props.isRolling, (rolling) => {
    if (!rolling) {
        updateDiceVisuals(props.diceMain, props.diceSec);
    }
});

watch(() => [props.diceMain, props.diceSec], ([v1, v2]) => {
    if (!props.isRolling) {
        updateDiceVisuals(v1 || 1, v2 || 1);
    }
});

</script>

<template>
  <div ref="containerRef" class="three-dice-container"></div>
</template>

<style scoped>
.three-dice-container {
    width: 200px;
    height: 150px;
    margin: 0 auto;
}
</style>
