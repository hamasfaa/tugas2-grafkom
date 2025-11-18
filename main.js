import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

class ArchimedesSimulation {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('canvas'),
            antialias: true,
            alpha: true
        });

        this.loader = new GLTFLoader();
        this.models = {
            pool: null,
            ship: null,
            duck: null
        };

        this.currentObject = null;
        this.currentObjectType = 'ship';
        this.water = null;
        this.waterLevel = 0.5;
        this.objectDensity = 0.7;

        // Physics constants
        this.gravity = 9.8;
        this.waterDensity = 1000;
        this.objectVolume = 0.5;
        this.objectMass = this.objectVolume * this.objectDensity * 1000;

        this.objectVelocity = 0;
        this.targetY = 0;

        this.init();
        this.loadModels();
        this.setupControls();
        this.animate();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.camera.position.set(5, 4, 8);
        this.camera.lookAt(0, 0, 0);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0x87ceeb, 10, 50);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x6c8ba6, 0.5);
        this.scene.add(hemisphereLight);

        // const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
        // gridHelper.position.y = -2;
        // this.scene.add(gridHelper);

        window.addEventListener('resize', () => this.onWindowResize());
    }

    async loadModels() {
        const loadingEl = document.getElementById('loading');

        try {
            const poolGltf = await this.loader.loadAsync('/assets/pool.glb');
            this.models.pool = poolGltf.scene;
            this.models.pool.position.y = -2.5;
            this.models.pool.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            this.scene.add(this.models.pool);

            this.createWater();

            const shipGltf = await this.loader.loadAsync('/assets/ship.glb');
            this.models.ship = shipGltf.scene;
            this.models.ship.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            const duckGltf = await this.loader.loadAsync('/assets/duck.glb');
            this.models.duck = duckGltf.scene;
            this.models.duck.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            this.switchObject('ship');

            loadingEl.classList.add('hidden');

        } catch (error) {
            console.error('Error loading models:', error);
            loadingEl.querySelector('p').textContent = 'Error loading models. Check console.';
        }
    }

    createWater() {
        const waterGeometry = new THREE.PlaneGeometry(14, 10.5, 50, 50);

        const waterMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x1e90ff,
            transparent: true,
            opacity: 0.7,
            metalness: 0.1,
            roughness: 0.1,
            transmission: 0.9,
            thickness: 0.5,
            side: THREE.DoubleSide
        });

        this.water = new THREE.Mesh(waterGeometry, waterMaterial);
        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = -2.25;
        this.water.receiveShadow = true;

        this.scene.add(this.water);

        this.waterGeometry = waterGeometry;
        this.waterOriginalPositions = waterGeometry.attributes.position.array.slice();
    }

    switchObject(type) {
        if (this.currentObject) {
            this.scene.remove(this.currentObject);
        }

        this.currentObjectType = type;
        this.currentObject = this.models[type];

        if (this.currentObject) {
            this.currentObject.position.set(0, 2, 0);
            this.scene.add(this.currentObject);

            const box = new THREE.Box3().setFromObject(this.currentObject);
            const size = box.getSize(new THREE.Vector3());
            this.objectVolume = size.x * size.y * size.z * 0.5;

            this.updatePhysics();
        }
    }

    updatePhysics() {
        if (!this.currentObject) return;

        // Calculate mass
        this.objectMass = this.objectVolume * this.objectDensity * 1000;

        // Calculate gravity force
        const gravityForce = this.objectMass * this.gravity;

        // Calculate submerged volume
        const objectY = this.currentObject.position.y;
        const waterY = this.water.position.y;
        const box = new THREE.Box3().setFromObject(this.currentObject);
        const size = box.getSize(new THREE.Vector3());

        let submergedRatio = 0;
        if (objectY - size.y / 2 < waterY) {
            const submergedDepth = Math.min(size.y, waterY - (objectY - size.y / 2));
            submergedRatio = Math.max(0, Math.min(1, submergedDepth / size.y));
        }

        const submergedVolume = this.objectVolume * submergedRatio;

        // Calculate buoyancy force (Archimedes principle: F = ρ * V * g)
        const buoyancyForce = this.waterDensity * submergedVolume * this.gravity;

        // Net force
        const netForce = buoyancyForce - gravityForce;

        // Update velocity and position
        const acceleration = netForce / this.objectMass;
        this.objectVelocity += acceleration * 0.016; // assuming 60fps
        this.objectVelocity *= 0.98; // damping

        this.currentObject.position.y += this.objectVelocity * 0.016;

        // Constraints
        const poolBottom = -5.85;
        const minY = poolBottom + size.y / 2;

        if (this.currentObject.position.y < minY) {
            this.currentObject.position.y = minY;
            this.objectVelocity = 0;
        }

        this.currentObject.rotation.z = Math.sin(Date.now() * 0.001) * 0.05 * submergedRatio;
        this.currentObject.rotation.x = Math.cos(Date.now() * 0.0015) * 0.03 * submergedRatio;

        this.updateUI(buoyancyForce, gravityForce, submergedRatio);
    }

    updateUI(buoyancy, gravity, submergedRatio) {
        document.getElementById('buoyancyForce').textContent = buoyancy.toFixed(2);
        document.getElementById('gravityForce').textContent = gravity.toFixed(2);
        document.getElementById('positionY').textContent = this.currentObject ? (this.currentObject.position.y + 2).toFixed(3) : '0';

        let status = 'Tenggelam';
        if (buoyancy > gravity * 0.95) {
            status = 'Mengapung';
        } else if (submergedRatio > 0.4 && submergedRatio < 0.8) {
            status = 'Melayang';
        }
        document.getElementById('status').textContent = status;
    }

    animateWater(time) {
        if (!this.waterGeometry) return;

        const positions = this.waterGeometry.attributes.position.array;

        for (let i = 0; i < positions.length; i += 3) {
            const x = this.waterOriginalPositions[i];
            const y = this.waterOriginalPositions[i + 1];

            positions[i + 2] = Math.sin(x * 2 + time) * 0.05 +
                Math.cos(y * 2 + time * 1.5) * 0.05;
        }

        this.waterGeometry.attributes.position.needsUpdate = true;
        this.waterGeometry.computeVertexNormals();
    }

    setupControls() {
        const shipBtn = document.getElementById('shipBtn');
        const duckBtn = document.getElementById('duckBtn');

        shipBtn.addEventListener('click', () => {
            this.switchObject('ship');
            shipBtn.classList.add('!bg-gradient-to-r', 'from-blue-500', 'to-cyan-500', 'border-white', 'scale-105', 'shadow-xl');
            shipBtn.classList.remove('bg-white/20');
            duckBtn.classList.remove('!bg-gradient-to-r', 'from-blue-500', 'to-cyan-500', 'border-white', 'scale-105', 'shadow-xl');
            duckBtn.classList.add('bg-white/20');
        });

        duckBtn.addEventListener('click', () => {
            this.switchObject('duck');
            duckBtn.classList.add('!bg-gradient-to-r', 'from-blue-500', 'to-cyan-500', 'border-white', 'scale-105', 'shadow-xl');
            duckBtn.classList.remove('bg-white/20');
            shipBtn.classList.remove('!bg-gradient-to-r', 'from-blue-500', 'to-cyan-500', 'border-white', 'scale-105', 'shadow-xl');
            shipBtn.classList.add('bg-white/20');
        });

        shipBtn.classList.add('!bg-gradient-to-r', 'from-blue-500', 'to-cyan-500', 'border-white', 'scale-105', 'shadow-xl');

        const waterLevelSlider = document.getElementById('waterLevel');
        waterLevelSlider.addEventListener('input', (e) => {
            this.waterLevel = parseFloat(e.target.value);
            this.water.position.y = (this.waterLevel - 0.5) * 4;
            document.getElementById('waterLevelValue').textContent = this.waterLevel.toFixed(2);
        });

        const densitySlider = document.getElementById('objectDensity');
        densitySlider.addEventListener('input', (e) => {
            this.objectDensity = parseFloat(e.target.value);
            document.getElementById('densityValue').textContent = this.objectDensity.toFixed(2);
            this.updatePhysics();
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            this.waterLevel = 0.5;
            this.objectDensity = 0.7;
            waterLevelSlider.value = 0.5;
            densitySlider.value = 0.7;
            document.getElementById('waterLevelValue').textContent = '0.50';
            document.getElementById('densityValue').textContent = '0.70';

            if (this.currentObject) {
                this.currentObject.position.y = 2;
                this.objectVelocity = 0;
            }

            this.water.position.y = -2.25;
            this.updatePhysics();
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const time = Date.now() * 0.001;

        this.controls.update();

        this.animateWater(time);

        this.updatePhysics();

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

new ArchimedesSimulation();