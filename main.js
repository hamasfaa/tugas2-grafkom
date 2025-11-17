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
            alpha: false
        });

        this.loader = new GLTFLoader();
        this.models = {
            pool: null,
            ship: null,
            duck: null
        };

        this.currentObject = null;
        this.currentObjectType = 'duck';
        this.water = null;
        this.waterLevel = 0.5;
        this.objectDensity = 0.5;

        // Physics constants
        this.gravity = 9.8;
        this.waterDensity = 1000;
        this.objectVolume = 0.5;
        this.objectMass = this.objectVolume * this.objectDensity * 1000;

        this.objectVelocity = 0;
        this.targetY = 0;

        // Pool dimensions
        this.poolWidth = 10;
        this.poolDepth = 7;
        this.poolFloorY = -2.5;
        
        this.waterMinLevel = -2.8;
        this.waterMaxLevel = -0.9;          
        console.log('✅ FINAL Water range:', this.waterMinLevel, 'to', this.waterMaxLevel, '= ALWAYS VISIBLE!');

        this.init();
        this.createRoom();
        this.loadModels();
        this.setupControls();
        this.animate();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        this.camera.position.set(6, 3, 8);
        this.camera.lookAt(0, -1, 0);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2.1;
        this.controls.target.set(0, -1, 0);

        this.scene.background = new THREE.Color(0xececec);
        this.scene.fog = new THREE.Fog(0xececec, 25, 60);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(8, 12, 8);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.left = -20;
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
        this.scene.add(directionalLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-5, 5, -5);
        this.scene.add(fillLight);

        window.addEventListener('resize', () => this.onWindowResize());
    }

    createRoom() {
        // Create floor with a hole for the pool using a shape
        const floorShape = new THREE.Shape();
        // Outer rectangle (room floor)
        floorShape.moveTo(-15, -12.5);
        floorShape.lineTo(15, -12.5);
        floorShape.lineTo(15, 12.5);
        floorShape.lineTo(-15, 12.5);
        floorShape.lineTo(-15, -12.5);
        
        // Inner rectangle (pool hole) - slightly larger than pool
        const poolHole = new THREE.Path();
        poolHole.moveTo(-5.5, -4);
        poolHole.lineTo(5.5, -4);
        poolHole.lineTo(5.5, 4);
        poolHole.lineTo(-5.5, 4);
        poolHole.lineTo(-5.5, -4);
        floorShape.holes.push(poolHole);
        
        const floorGeometry = new THREE.ShapeGeometry(floorShape);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xe5e5e5,
            roughness: 0.9,
            metalness: 0.0,
            side: THREE.DoubleSide
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = this.waterMaxLevel;  // Floor at max water level
        floor.receiveShadow = true;
        this.scene.add(floor);

        const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xf2f2f2,
            roughness: 0.9
        });

        const backWallGeometry = new THREE.PlaneGeometry(30, 18);
        const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
        backWall.position.set(0, 6.5, -8);
        backWall.receiveShadow = true;
        this.scene.add(backWall);

        const frontWall = new THREE.Mesh(backWallGeometry, wallMaterial);
        frontWall.rotation.y = Math.PI;
        frontWall.position.set(0, 6.5, 12);
        frontWall.receiveShadow = true;
        this.scene.add(frontWall);

        const sideWallGeometry = new THREE.PlaneGeometry(25, 18);
        const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.position.set(-15, 6.5, 2);
        leftWall.receiveShadow = true;
        this.scene.add(leftWall);

        const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.position.set(15, 6.5, 2);
        rightWall.receiveShadow = true;
        this.scene.add(rightWall);

        const ceilingGeometry = new THREE.PlaneGeometry(30, 25);
        const ceilingMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xfafafa,
            roughness: 0.9
        });
        const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 15.5;
        this.scene.add(ceiling);

        // Furniture on the floor outside the pool
        this.createSimpleChair(-8, this.waterMaxLevel, 3, Math.PI / 4);
        this.createSimpleChair(-9, this.waterMaxLevel, 4.5, Math.PI / 6);
        this.createSimpleTable(10, this.waterMaxLevel, 3);
        this.createMop(12, this.waterMaxLevel, -3);
    }
    createSimpleChair(x, y, z, rotationY) {
        const chairGroup = new THREE.Group();
        const seatGeometry = new THREE.BoxGeometry(0.8, 0.1, 0.8);
        const chairMaterial = new THREE.MeshStandardMaterial({ color: 0x8b6f47, roughness: 0.7 });
        const seat = new THREE.Mesh(seatGeometry, chairMaterial);
        seat.position.y = 0.5;
        seat.castShadow = true;
        seat.receiveShadow = true;
        chairGroup.add(seat);

        const backGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.1);
        const back = new THREE.Mesh(backGeometry, chairMaterial);
        back.position.set(0, 0.9, -0.35);
        back.castShadow = true;
        back.receiveShadow = true;
        chairGroup.add(back);

        const legGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5);
        [[-0.3, 0.25, -0.3], [0.3, 0.25, -0.3], [-0.3, 0.25, 0.3], [0.3, 0.25, 0.3]].forEach(pos => {
            const leg = new THREE.Mesh(legGeometry, chairMaterial);
            leg.position.set(pos[0], pos[1], pos[2]);
            leg.castShadow = true;
            chairGroup.add(leg);
        });

        chairGroup.position.set(x, y, z);
        chairGroup.rotation.y = rotationY;
        this.scene.add(chairGroup);
    }

    createSimpleTable(x, y, z) {
        const tableGroup = new THREE.Group();
        const topGeometry = new THREE.BoxGeometry(1.5, 0.1, 1.2);
        const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.6 });
        const top = new THREE.Mesh(topGeometry, tableMaterial);
        top.position.y = 0.8;
        top.castShadow = true;
        top.receiveShadow = true;
        tableGroup.add(top);

        const legGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.8);
        [[-0.6, 0.4, -0.5], [0.6, 0.4, -0.5], [-0.6, 0.4, 0.5], [0.6, 0.4, 0.5]].forEach(pos => {
            const leg = new THREE.Mesh(legGeometry, tableMaterial);
            leg.position.set(pos[0], pos[1], pos[2]);
            leg.castShadow = true;
            tableGroup.add(leg);
        });

        tableGroup.position.set(x, y, z);
        this.scene.add(tableGroup);
    }

    createMop(x, y, z) {
        const mopGroup = new THREE.Group();
        const handleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 2.5);
        const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x8b7355 });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.y = 1.25;
        handle.castShadow = true;
        mopGroup.add(handle);

        const headGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.3);
        const headMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 0.15;
        head.castShadow = true;
        mopGroup.add(head);

        mopGroup.position.set(x, y, z);
        mopGroup.rotation.z = 0.15;
        this.scene.add(mopGroup);
    }

    async loadModels() {
        const loadingEl = document.getElementById('loading');

        try {
            const poolGltf = await this.loader.loadAsync('/assets/pool.glb');
            this.models.pool = poolGltf.scene;
            this.models.pool.position.y = this.poolFloorY;
            // VERY DEEP POOL - scale Y to 3.5!
            this.models.pool.scale.set(0.7, 3.5, 0.65);
            this.models.pool.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            this.scene.add(this.models.pool);

            this.createWater();

            const duckGltf = await this.loader.loadAsync('/assets/duck.glb');
            this.models.duck = duckGltf.scene;
            this.models.duck.scale.set(0.5, 0.5, 0.5);
            this.models.duck.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            const shipGltf = await this.loader.loadAsync('/assets/ship.glb');
            this.models.ship = shipGltf.scene;
            this.models.ship.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            this.createFormulaBoard();
            this.switchObject('duck');

            loadingEl.classList.add('hidden');

        } catch (error) {
            console.error('Error loading models:', error);
            loadingEl.querySelector('p').textContent = 'Error loading models. Check console.';
        }
    }

    createFormulaBoard() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1024, 512);
        ctx.strokeStyle = '#aaaaaa';
        ctx.lineWidth = 8;
        ctx.strokeRect(15, 15, 994, 482);
        ctx.fillStyle = '#4da6ff';
        ctx.font = 'bold 56px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Hukum Archimedes', 512, 90);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 64px Arial';
        ctx.fillText('F = ρ × V × g', 512, 200);
        ctx.font = '28px Arial';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#333333';
        ctx.fillText('F: Gaya Apung (N)', 70, 300);
        ctx.fillText('ρ: Massa Jenis Fluida (kg/m³)', 70, 350);
        ctx.fillText('V: Volume Benda Tercelup (m³)', 70, 400);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const boardMaterial = new THREE.MeshStandardMaterial({ 
            map: texture, roughness: 0.8, metalness: 0.0,
            emissive: 0xffffff, emissiveIntensity: 0.05
        });

        const board = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 1.75), boardMaterial);
        board.position.set(0, 5, -7.9);
        board.receiveShadow = true;
        this.scene.add(board);

        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(3.7, 1.95, 0.08),
            new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.2 })
        );
        frame.position.set(0, 5, -7.95);
        frame.castShadow = true;
        this.scene.add(frame);
    }

    createWater() {
        const waterGeometry = new THREE.PlaneGeometry(this.poolWidth, this.poolDepth, 150, 150);

        // BRIGHT VISIBLE BLUE WATER
        const waterMaterial = new THREE.MeshStandardMaterial({
            color: 0x3399ff,
            transparent: true,
            opacity: 0.7,
            roughness: 0.1,
            metalness: 0.1,
            side: THREE.DoubleSide
        });

        this.water = new THREE.Mesh(waterGeometry, waterMaterial);
        this.water.rotation.x = -Math.PI / 2;
        
        // Start at middle water level
        const waterRange = this.waterMaxLevel - this.waterMinLevel;
        const startY = this.waterMinLevel + (waterRange * 0.5);
        this.water.position.y = startY;
        this.water.receiveShadow = true;

        this.scene.add(this.water);

        this.waterGeometry = waterGeometry;
        this.waterOriginalPositions = waterGeometry.attributes.position.array.slice();

        console.log('✅ Water at Y =', startY, '| Min =', this.waterMinLevel, '| Max =', this.waterMaxLevel);
        console.log('   At slider 0.00, water will be at:', this.waterMinLevel);
        console.log('   At slider 1.00, water will be at:', this.waterMaxLevel);
    }

    switchObject(type) {
        if (this.currentObject) {
            this.scene.remove(this.currentObject);
        }

        this.currentObjectType = type;
        this.currentObject = this.models[type];

        if (this.currentObject) {
            this.currentObject.position.set(0, -2, 0);
            this.scene.add(this.currentObject);

            const box = new THREE.Box3().setFromObject(this.currentObject);
            const size = box.getSize(new THREE.Vector3());
            this.objectVolume = size.x * size.y * size.z * 0.6;

            this.objectVelocity = 0;
            this.updatePhysics();
        }
    }

    updatePhysics() {
        if (!this.currentObject) return;

        this.objectMass = this.objectVolume * this.objectDensity * 1000;
        const gravityForce = this.objectMass * this.gravity;

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
        const buoyancyForce = this.waterDensity * submergedVolume * this.gravity;
        const netForce = buoyancyForce - gravityForce;

        const acceleration = netForce / this.objectMass;
        this.objectVelocity += acceleration * 0.016;
        this.objectVelocity *= 0.96;

        this.currentObject.position.y += this.objectVelocity * 0.016;

        // VERY DEEP pool bottom
        const poolBottom = -8;
        const minObjectY = poolBottom + size.y / 2;

        if (this.currentObject.position.y < minObjectY) {
            this.currentObject.position.y = minObjectY;
            this.objectVelocity = 0;
        }

        if (this.objectDensity > 1.5 && objectY > waterY - size.y / 2) {
            this.objectVelocity -= 0.05;
        }

        if (submergedRatio > 0.3 && submergedRatio < 0.9) {
            this.currentObject.rotation.z = Math.sin(Date.now() * 0.0008) * 0.05;
            this.currentObject.rotation.x = Math.cos(Date.now() * 0.001) * 0.03;
        } else {
            this.currentObject.rotation.z *= 0.95;
            this.currentObject.rotation.x *= 0.95;
        }

        this.updateUI(buoyancyForce, gravityForce, submergedRatio);
    }

    updateUI(buoyancy, gravity, submergedRatio) {
        document.getElementById('buoyancyForce').textContent = buoyancy.toFixed(2);
        document.getElementById('gravityForce').textContent = gravity.toFixed(2);
        document.getElementById('positionY').textContent = this.currentObject ? 
            (this.currentObject.position.y + 2).toFixed(3) : '0';

        let status = 'Tenggelam';
        if (buoyancy > gravity * 0.98) {
            status = 'Mengapung';
        } else if (submergedRatio > 0.3 && submergedRatio < 0.85) {
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

            positions[i + 2] = 
                Math.sin(x * 0.8 + time * 0.4) * 0.02 +
                Math.cos(y * 0.8 + time * 0.6) * 0.02;
        }

        this.waterGeometry.attributes.position.needsUpdate = true;
        this.waterGeometry.computeVertexNormals();
    }

    setupControls() {
        const shipBtn = document.getElementById('shipBtn');
        const duckBtn = document.getElementById('duckBtn');

        duckBtn.addEventListener('click', () => {
            this.switchObject('duck');
            duckBtn.classList.add('!bg-gradient-to-r', 'from-blue-500', 'to-cyan-500', 'border-white', 'scale-105', 'shadow-xl');
            duckBtn.classList.remove('bg-white/20');
            shipBtn.classList.remove('!bg-gradient-to-r', 'from-blue-500', 'to-cyan-500', 'border-white', 'scale-105', 'shadow-xl');
            shipBtn.classList.add('bg-white/20');
        });

        shipBtn.addEventListener('click', () => {
            this.switchObject('ship');
            shipBtn.classList.add('!bg-gradient-to-r', 'from-blue-500', 'to-cyan-500', 'border-white', 'scale-105', 'shadow-xl');
            shipBtn.classList.remove('bg-white/20');
            duckBtn.classList.remove('!bg-gradient-to-r', 'from-blue-500', 'to-cyan-500', 'border-white', 'scale-105', 'shadow-xl');
            duckBtn.classList.add('bg-white/20');
        });

        duckBtn.classList.add('!bg-gradient-to-r', 'from-blue-500', 'to-cyan-500', 'border-white', 'scale-105', 'shadow-xl');

        const waterLevelSlider = document.getElementById('waterLevel');
        waterLevelSlider.addEventListener('input', (e) => {
            this.waterLevel = parseFloat(e.target.value);
            
            const waterRange = this.waterMaxLevel - this.waterMinLevel;
            const newWaterY = this.waterMinLevel + (this.waterLevel * waterRange);
            
            this.water.position.y = newWaterY;
            
            console.log('💧 Slider:', this.waterLevel.toFixed(2), '→ Water Y:', newWaterY.toFixed(2));
            
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
            this.objectDensity = 0.5;
            waterLevelSlider.value = 0.5;
            densitySlider.value = 0.5;
            document.getElementById('waterLevelValue').textContent = '0.50';
            document.getElementById('densityValue').textContent = '0.50';

            const waterRange = this.waterMaxLevel - this.waterMinLevel;
            this.water.position.y = this.waterMinLevel + (0.5 * waterRange);

            if (this.currentObject) {
                this.currentObject.position.y = -2;
                this.objectVelocity = 0;
                this.currentObject.rotation.z = 0;
                this.currentObject.rotation.x = 0;
            }

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