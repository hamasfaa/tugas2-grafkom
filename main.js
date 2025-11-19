import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

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
        this.fontLoader = new FontLoader();
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

        // Bubble system
        this.bubbles = [];
        this.bubblePool = [];
        this.maxBubbles = 50;
        this.bubbleSpawnRate = 99; 

        // Day/Night mode
        this.isNightMode = false;
        this.dayColors = {
            background: 0x87ceeb,
            fog: 0x87ceeb,
            ambientLight: 0xffffff,
            directionalLight: 0xffffff,
            hemisphereTop: 0x87ceeb,
            hemisphereBottom: 0x6c8ba6
        };
        this.nightColors = {
            background: 0x0a0e27,
            fog: 0x0a0e27,
            ambientLight: 0x4a5f8f,
            directionalLight: 0x6b8cce,
            hemisphereTop: 0x1a1f3a,
            hemisphereBottom: 0x0a0e27
        };

        // Lamp system
        this.lamps = [];
        this.lampLights = [];

        this.init();
        this.createRoom();
        this.createDecorations();
        this.createFormulaBoard();
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

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(this.ambientLight);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.directionalLight.position.set(10, 10, 5);
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.mapSize.width = 2048;
        this.directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(this.directionalLight);

        this.hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x6c8ba6, 0.5);
        this.scene.add(this.hemisphereLight);

        window.addEventListener('resize', () => this.onWindowResize());
    }

    createRoom() {
        const floorShape = new THREE.Shape();

        floorShape.moveTo(-15, -15);
        floorShape.lineTo(15, -15);
        floorShape.lineTo(15, 15);
        floorShape.lineTo(-15, 15);
        floorShape.lineTo(-15, -15);

        const poolWidth = 19.5;
        const poolDepth = 14;
        const holePath = new THREE.Path();
        holePath.moveTo(-poolWidth / 2, -poolDepth / 2);
        holePath.lineTo(poolWidth / 2, -poolDepth / 2);
        holePath.lineTo(poolWidth / 2, poolDepth / 2);
        holePath.lineTo(-poolWidth / 2, poolDepth / 2);
        holePath.lineTo(-poolWidth / 2, -poolDepth / 2);
        floorShape.holes.push(holePath);

        const floorGeometry = new THREE.ShapeGeometry(floorShape);
        const floorTexture = this.createTileTexture('#f5f5f5', '#e0e0e0');
        const floorMaterial = new THREE.MeshStandardMaterial({
            map: floorTexture,
            roughness: 0.8,
            metalness: 0.2,
            side: THREE.DoubleSide
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -2.05;
        floor.receiveShadow = true;
        this.scene.add(floor);
    }

    createTileTexture(color1, color2) {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const tileSize = size / 8;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                ctx.fillStyle = (i + j) % 2 === 0 ? color1 : color2;
                ctx.fillRect(i * tileSize, j * tileSize, tileSize, tileSize);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        return texture;
    }

    createDecorations() {
        const ballGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const ballMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6b6b,
            roughness: 0.3,
            metalness: 0.2
        });
        const ball1 = new THREE.Mesh(ballGeometry, ballMaterial);
        ball1.position.set(8, -1.53, 3);
        ball1.castShadow = true;
        ball1.receiveShadow = true;
        this.scene.add(ball1);

        const ball2Material = new THREE.MeshStandardMaterial({
            color: 0x4ecdc4,
            roughness: 0.3,
            metalness: 0.2
        });
        const ball2 = new THREE.Mesh(ballGeometry, ball2Material);
        ball2.position.set(-8, -1.53, -4);
        ball2.castShadow = true;
        ball2.receiveShadow = true;
        this.scene.add(ball2);

        this.createBeachUmbrella(9, -2.04, -3, 0xffd93d);
        this.createBeachUmbrella(-9, -2.04, 4, 0xff6bcb);

        this.createBeachChair(8.5, -2.04, -2.5, Math.PI / 4);
        this.createBeachChair(-8.5, -2.04, 4.5, -Math.PI / 4);

        const ringGeometry = new THREE.TorusGeometry(0.6, 0.2, 16, 32);
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: 0xffeb3b,
            roughness: 0.4,
            metalness: 0.1
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.set(-2, -1.9, 4);
        ring.rotation.x = Math.PI / 2;
        ring.castShadow = true;
        this.scene.add(ring);

        this.createTowel(8, -2.04, 5, 0xff6b9d);
        this.createTowel(-8, -2.04, -5, 0x95e1d3);

        this.createLamp(6, -2.04, -6, 0xffffff);
        this.createLamp(-6, -2.04, -6, 0xffffff);
        this.createLamp(6, -2.04, 6, 0xffffff);
        this.createLamp(-6, -2.04, 6, 0xffffff);
    }

    createBeachUmbrella(x, y, z, color) {
        const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8);
        const poleMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            roughness: 0.7
        });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.set(x, y + 1.25, z);
        pole.castShadow = true;
        this.scene.add(pole);

        const umbrellaGeometry = new THREE.ConeGeometry(1.5, 1, 8);
        const umbrellaMaterial = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.5,
            side: THREE.DoubleSide
        });
        const umbrella = new THREE.Mesh(umbrellaGeometry, umbrellaMaterial);
        umbrella.position.set(x, y + 3, z);
        umbrella.castShadow = true;
        this.scene.add(umbrella);
    }

    createBeachChair(x, y, z, rotation) {
        const group = new THREE.Group();

        const seatGeometry = new THREE.BoxGeometry(1, 0.1, 1);
        const seatMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.6
        });
        const seat = new THREE.Mesh(seatGeometry, seatMaterial);
        seat.position.y = 0.3;
        seat.castShadow = true;
        group.add(seat);

        const backGeometry = new THREE.BoxGeometry(1, 0.8, 0.1);
        const back = new THREE.Mesh(backGeometry, seatMaterial);
        back.position.set(0, 0.7, -0.45);
        back.rotation.x = -0.2;
        back.castShadow = true;
        group.add(back);

        const legGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8);
        const legMaterial = new THREE.MeshStandardMaterial({
            color: 0xc0c0c0,
            roughness: 0.3,
            metalness: 0.5
        });

        const positions = [
            [-0.4, 0.15, -0.4],
            [0.4, 0.15, -0.4],
            [-0.4, 0.15, 0.4],
            [0.4, 0.15, 0.4]
        ];

        positions.forEach(pos => {
            const leg = new THREE.Mesh(legGeometry, legMaterial);
            leg.position.set(...pos);
            leg.castShadow = true;
            group.add(leg);
        });

        group.position.set(x, y, z);
        group.rotation.y = rotation;
        this.scene.add(group);
    }

    createTowel(x, y, z, color) {
        const towelGeometry = new THREE.BoxGeometry(1.5, 0.05, 1);
        const towelMaterial = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.8
        });
        const towel = new THREE.Mesh(towelGeometry, towelMaterial);
        towel.position.set(x, y, z);
        towel.receiveShadow = true;
        this.scene.add(towel);
    }

    createLamp(x, y, z) {
        const lampGroup = new THREE.Group();
        
        const postGeometry = new THREE.CylinderGeometry(0.08, 0.08, 3, 8);
        const postMaterial = new THREE.MeshStandardMaterial({
            color: 0x2c2c2c,
            roughness: 0.4,
            metalness: 0.6
        });
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.y = 1.5;
        post.castShadow = true;
        lampGroup.add(post);
        
        const headGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.3, 8);
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.3,
            metalness: 0.7
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 3.15;
        head.castShadow = true;
        lampGroup.add(head);
        
        const bulbGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const bulbMaterial = new THREE.MeshStandardMaterial({
            color: 0xfff4e6,
            emissive: 0xfff4e6,
            emissiveIntensity: 0,
            roughness: 0.2,
            metalness: 0.1
        });
        const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
        bulb.position.y = 3;
        lampGroup.add(bulb);
        
        const lampLight = new THREE.PointLight(0xffd699, 0, 30);
        lampLight.position.set(0, 3, 0);
        lampLight.castShadow = true;
        lampLight.shadow.mapSize.width = 1024;
        lampLight.shadow.mapSize.height = 1024;
        lampGroup.add(lampLight);
        
        const baseGeometry = new THREE.CylinderGeometry(0.2, 0.25, 0.1, 8);
        const base = new THREE.Mesh(baseGeometry, postMaterial);
        base.position.y = 0;
        base.castShadow = true;
        lampGroup.add(base);
        
        lampGroup.position.set(x, y, z);
        this.scene.add(lampGroup);
        
        this.lamps.push({
            group: lampGroup,
            bulb: bulb,
            light: lampLight
        });
    }
    createFormulaBoard() {
        const boardGeometry = new THREE.BoxGeometry(5, 4, 0.2);
        const boardMaterial = new THREE.MeshStandardMaterial({
            color: 0x2c3e50,
            roughness: 0.7
        });
        const board = new THREE.Mesh(boardGeometry, boardMaterial);
        board.position.set(0, 2, -8);
        board.rotation.y = 0;
        board.castShadow = true;
        board.receiveShadow = true;
        this.scene.add(board);

        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ecf0f1';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('RUMUS FISIKA', canvas.width / 2, 120);

        ctx.strokeStyle = '#95a5a6';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(150, 180);
        ctx.lineTo(874, 180);
        ctx.stroke();

        ctx.font = 'bold 60px Arial';
        ctx.fillStyle = '#3498db';
        ctx.fillText('Prinsip Archimedes', canvas.width / 2, 280);

        ctx.font = 'bold 70px Arial';
        ctx.fillStyle = '#ecf0f1';
        ctx.fillText('F', canvas.width / 2 - 200, 380);
        ctx.font = '45px Arial';
        ctx.fillText('b', canvas.width / 2 - 160, 400);

        ctx.font = 'bold 70px Arial';
        ctx.fillText('= ρ × V × g', canvas.width / 2 + 20, 380);

        ctx.font = 'bold 60px Arial';
        ctx.fillStyle = '#e74c3c';
        ctx.fillText('Gaya Gravitasi', canvas.width / 2, 520);

        ctx.font = 'bold 70px Arial';
        ctx.fillStyle = '#ecf0f1';
        ctx.fillText('F', canvas.width / 2 - 140, 620);
        ctx.font = '45px Arial';
        ctx.fillText('g', canvas.width / 2 - 100, 640);

        ctx.font = 'bold 70px Arial';
        ctx.fillText('= m × g', canvas.width / 2 + 40, 620);

        ctx.font = 'bold 60px Arial';
        ctx.fillStyle = '#2ecc71';
        ctx.fillText('Resultan Gaya', canvas.width / 2, 760);

        ctx.font = 'bold 70px Arial';
        ctx.fillStyle = '#ecf0f1';
        ctx.fillText('F', canvas.width / 2 - 180, 860);
        ctx.font = '45px Arial';
        ctx.fillText('net', canvas.width / 2 - 135, 880);

        ctx.font = 'bold 70px Arial';
        ctx.fillText('=', canvas.width / 2 - 60, 860);

        ctx.fillText('F', canvas.width / 2 + 10, 860);
        ctx.font = '45px Arial';
        ctx.fillText('b', canvas.width / 2 + 50, 880);

        ctx.font = 'bold 70px Arial';
        ctx.fillText('- F', canvas.width / 2 + 100, 860);
        ctx.font = '45px Arial';
        ctx.fillText('g', canvas.width / 2 + 150, 880);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const textPlaneGeometry = new THREE.PlaneGeometry(4.8, 3.8);
        const textPlaneMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide
        });
        const textPlane = new THREE.Mesh(textPlaneGeometry, textPlaneMaterial);
        textPlane.position.set(0, 2, -7.89);
        textPlane.rotation.y = 0;
        this.scene.add(textPlane);

        const frameGeometry = new THREE.BoxGeometry(5.1, 4.1, 0.1);
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0xd4af37,
            roughness: 0.3,
            metalness: 0.8
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.set(0, 2, -7.95);
        frame.rotation.y = 0;
        this.scene.add(frame);

        const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 4, 16);
        const poleMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            roughness: 0.6,
            metalness: 0.2
        });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.set(0, 0, -8);
        pole.castShadow = true;
        this.scene.add(pole);

        const baseGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.2, 16);
        const base = new THREE.Mesh(baseGeometry, poleMaterial);
        base.position.set(0, -2.04, -8);
        base.castShadow = true;
        this.scene.add(base);
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

    toggleDayNight() {
        this.isNightMode = !this.isNightMode;
        
        const colors = this.isNightMode ? this.nightColors : this.dayColors;
        const duration = 1000; 
        const steps = 60;
        const interval = duration / steps;
        
        // Get starting colors
        const startBg = this.scene.background.clone();
        const startFog = this.scene.fog.color.clone();
        const startAmbient = this.ambientLight.color.clone();
        const startDirectional = this.directionalLight.color.clone();
        const startHemiTop = new THREE.Color(this.hemisphereLight.color);
        const startHemiBottom = new THREE.Color(this.hemisphereLight.groundColor);
        
        // Target colors
        const targetBg = new THREE.Color(colors.background);
        const targetFog = new THREE.Color(colors.fog);
        const targetAmbient = new THREE.Color(colors.ambientLight);
        const targetDirectional = new THREE.Color(colors.directionalLight);
        const targetHemiTop = new THREE.Color(colors.hemisphereTop);
        const targetHemiBottom = new THREE.Color(colors.hemisphereBottom);
        
        let step = 0;
        const animate = () => {
            step++;
            const progress = step / steps;
            
            this.scene.background.lerpColors(startBg, targetBg, progress);
            this.scene.fog.color.lerpColors(startFog, targetFog, progress);
            this.ambientLight.color.lerpColors(startAmbient, targetAmbient, progress);
            this.directionalLight.color.lerpColors(startDirectional, targetDirectional, progress);
            this.hemisphereLight.color.lerpColors(startHemiTop, targetHemiTop, progress);
            this.hemisphereLight.groundColor.lerpColors(startHemiBottom, targetHemiBottom, progress);
            
            // Adjust light intensity
            if (this.isNightMode) {
                this.ambientLight.intensity = 0.6 - (progress * 0.2);
                this.directionalLight.intensity = 0.8 - (progress * 0.7); 
                
                this.lamps.forEach(lamp => {
                    lamp.light.intensity = progress * 10;
                    lamp.bulb.material.emissiveIntensity = progress * 10; 
                });
            } else {
                this.ambientLight.intensity = 0.2 + (progress * 0.4); 
                this.directionalLight.intensity = 0.1 + (progress * 0.7); 
                
                this.lamps.forEach(lamp => {
                    lamp.light.intensity = (1 - progress) * 10; 
                    lamp.bulb.material.emissiveIntensity = (1 - progress) * 10;
                });
            }          

            if (step < steps) {
                setTimeout(animate, interval);
            } else {
                const modeIcon = document.getElementById('modeIcon');
                const modeText = document.getElementById('modeText');
                if (this.isNightMode) {
                    modeIcon.textContent = '☀️';
                    modeText.textContent = 'Mode Siang';
                    this.createStars();
                } else {
                    modeIcon.textContent = '🌙';
                    modeText.textContent = 'Mode Malam';
                    if (this.stars) {
                        this.scene.remove(this.stars);
                    }
                }
            }
        };
        
        animate();
    }

    createStars() {
        if (this.stars) {
            this.scene.remove(this.stars);
        }
        
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1,
            transparent: true,
            opacity: 0.8
        });
        
        const starsVertices = [];
        for (let i = 0; i < 1000; i++) {
            const x = (Math.random() - 0.5) * 100;
            const y = Math.random() * 50 + 10;
            const z = (Math.random() - 0.5) * 100;
            starsVertices.push(x, y, z);
        }
        
        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
        this.stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(this.stars);
    }

    createBubble(position) {
        let bubble;
        
        if (this.bubblePool.length > 0) {
            bubble = this.bubblePool.pop();
            bubble.visible = true;
        } else {
            const bubbleGeometry = new THREE.SphereGeometry(0.05 + Math.random() * 0.08, 8, 8);
            const bubbleMaterial = new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.6,
                metalness: 0,
                roughness: 0.1,
                transmission: 0.95,
                thickness: 0.5
            });
            bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
            this.scene.add(bubble);
        }
        
        bubble.position.copy(position);
        
        bubble.userData = {
            velocity: 0.015 + Math.random() * 0.025,
            wobbleSpeed: 0.5 + Math.random() * 1.5,
            wobbleAmount: 0.03 + Math.random() * 0.07,
            lifeTime: 0,
            maxLifeTime: 4 + Math.random() * 3
        };
        
        this.bubbles.push(bubble);
    }

    spawnBubblesFromObject() {
        if (!this.currentObject || !this.water) return;
        
        const box = new THREE.Box3().setFromObject(this.currentObject);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const waterY = this.water.position.y;
        const objectBottomY = box.min.y;
        
        let submergedRatio = 0;
        if (objectBottomY < waterY) {
            const submergedDepth = Math.min(size.y, waterY - objectBottomY);
            submergedRatio = Math.max(0, Math.min(1, submergedDepth / size.y));
        }
        
        const isMoving = Math.abs(this.objectVelocity) > 0.001;
        const shouldSpawnBubbles = submergedRatio > 0.2 && isMoving;
        
        if (shouldSpawnBubbles && this.bubbles.length < this.maxBubbles) {
            const velocityFactor = Math.min(Math.abs(this.objectVelocity) * 10, 1);
            const spawnChance = this.bubbleSpawnRate * submergedRatio * velocityFactor * 0.05;
            
            if (Math.random() < spawnChance) {
                if (this.currentObjectType === 'duck') {
                    const ringRadius = size.x * 0.3; 
                    const angle = Math.random() * Math.PI * 2;
                    
                    const bubblePosition = new THREE.Vector3(
                        center.x + Math.cos(angle) * ringRadius,
                        objectBottomY + Math.random() * 0.2,
                        center.z + Math.sin(angle) * ringRadius
                    );
                    
                    this.createBubble(bubblePosition);
                } 
                else {
                    const bubblePosition = new THREE.Vector3(
                        box.min.x + Math.random() * size.x,
                        objectBottomY + Math.random() * 0.2,
                        box.min.z + Math.random() * size.z
                    );
                    
                    this.createBubble(bubblePosition);
                }
            }
        }
    }
    updateBubbles(time) {
        if (!this.water) return;
        
        const waterSurfaceY = this.water.position.y;
        
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const bubble = this.bubbles[i];
            const userData = bubble.userData;
            
            bubble.position.y += userData.velocity;
            
            bubble.position.x += Math.sin(time * userData.wobbleSpeed) * userData.wobbleAmount * 0.1;
            bubble.position.z += Math.cos(time * userData.wobbleSpeed * 0.7) * userData.wobbleAmount * 0.1;
            
            bubble.rotation.x += 0.02;
            bubble.rotation.y += 0.03;
            
            userData.lifeTime += 0.016;
            
            const distanceToSurface = waterSurfaceY - bubble.position.y;
            if (distanceToSurface < 0.3) {
                bubble.material.opacity = Math.max(0, distanceToSurface / 0.3) * 0.4;
            }
            
            if (bubble.position.y >= waterSurfaceY || userData.lifeTime >= userData.maxLifeTime) {
                bubble.visible = false;
                this.bubblePool.push(bubble);
                this.bubbles.splice(i, 1);
            }
        }
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
            // console.log("dari slider before", this.waterLevel);
            this.water.position.y = (this.waterLevel - 1.0625) * 4;
            // console.log("dari slider", this.water.position.y);
            document.getElementById('waterLevelValue').textContent = this.waterLevel.toFixed(2);
        });

        const densitySlider = document.getElementById('objectDensity');
        densitySlider.addEventListener('input', (e) => {
            this.objectDensity = parseFloat(e.target.value);
            document.getElementById('densityValue').textContent = this.objectDensity.toFixed(2);
            this.updatePhysics();
        });

        const bubbleIntensitySlider = document.getElementById('bubbleIntensity');
        if (bubbleIntensitySlider) {
            bubbleIntensitySlider.addEventListener('input', (e) => {
                this.bubbleSpawnRate = parseFloat(e.target.value);
                document.getElementById('bubbleIntensityValue').textContent = this.bubbleSpawnRate.toFixed(2);
            });
        }


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

            this.bubbleSpawnRate = 0.1;
            if (bubbleIntensitySlider) {
                bubbleIntensitySlider.value = 0.1;
                document.getElementById('bubbleIntensityValue').textContent = '0.10';
            }

        });

        const dayNightBtn = document.getElementById('dayNightBtn');
        dayNightBtn.addEventListener('click', () => {
            this.toggleDayNight();
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const time = Date.now() * 0.001;

        this.controls.update();

        this.animateWater(time);

        this.spawnBubblesFromObject();
        this.updateBubbles(time);


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