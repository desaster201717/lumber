import * as THREE from 'three';

class Joystick {
    constructor() {
        this.base = document.getElementById('joystick-base');
        this.knob = document.getElementById('joystick-knob');
        this.active = false;
        this.vector = new THREE.Vector2(0, 0);
        this.maxRadius = 40;

        this.base.addEventListener('touchstart', (e) => this.start(e), { passive: false });
        this.base.addEventListener('mousedown', (e) => this.start(e));

        window.addEventListener('touchmove', (e) => this.move(e), { passive: false });
        window.addEventListener('mousemove', (e) => this.move(e));

        window.addEventListener('touchend', () => this.end());
        window.addEventListener('mouseup', () => this.end());
    }

    start(e) {
        this.active = true;
        this.move(e);
    }

    move(e) {
        if (!this.active) return;

        let clientX, clientY;
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const rect = this.base.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = clientX - centerX;
        const dy = clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const angle = Math.atan2(dy, dx);
        const limitedDist = Math.min(dist, this.maxRadius);

        const x = Math.cos(angle) * limitedDist;
        const y = Math.sin(angle) * limitedDist;

        this.knob.style.transform = `translate(${x}px, ${y}px)`;

        this.vector.set(x / this.maxRadius, -y / this.maxRadius); // Invert Y for 3D world
    }

    end() {
        this.active = false;
        this.knob.style.transform = `translate(0px, 0px)`;
        this.vector.set(0, 0);
    }
}

const RESOURCE_TYPES = {
    LOG: { color: 0x8b4513, size: [0.6, 0.3, 0.3], name: 'Log' },
    PLANK: { color: 0xdeb887, size: [0.7, 0.1, 0.4], name: 'Plank' },
    BOARD: { color: 0xf5deb3, size: [0.5, 0.05, 0.5], name: 'Board' },
    BARREL: { color: 0x654321, size: [0.4, 0.5, 0.4], name: 'Barrel' },
    TABLE: { color: 0x5c4033, size: [0.8, 0.4, 0.6], name: 'Table' }
};

class Resource {
    static createMesh(type) {
        const config = RESOURCE_TYPES[type];
        const geo = new THREE.BoxGeometry(...config.size);
        const mat = new THREE.MeshStandardMaterial({ color: config.color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.userData.type = type;
        return mesh;
    }
}

class Player {
    constructor(scene) {
        this.scene = scene;
        this.speed = 0.15;
        this.mesh = this.createMesh();
        this.scene.add(this.mesh);
        this.stack = [];
        this.carryCapacity = 10;
        this.stackGroup = new THREE.Group();
        this.mesh.add(this.stackGroup);
        this.stackGroup.position.set(0, 1.2, -0.4); // Position on back

        this.lastTransferTime = 0;
        this.transferCooldown = 150; // ms between transfers
    }

    createMesh() {
        const group = new THREE.Group();

        // Body
        const bodyGeo = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3366ff });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.9;
        body.castShadow = true;
        group.add(body);

        // Arms (Visual only)
        const armGeo = new THREE.CapsuleGeometry(0.1, 0.5, 4, 8);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x3366ff });

        const leftArm = new THREE.Mesh(armGeo, armMat);
        leftArm.position.set(-0.5, 1, 0);
        group.add(leftArm);

        const rightArm = new THREE.Mesh(armGeo, armMat);
        rightArm.position.set(0.5, 1, 0);
        group.add(rightArm);

        // Head
        const headGeo = new THREE.SphereGeometry(0.3, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.7;
        head.castShadow = true;
        group.add(head);

        // Front indicator (Nose)
        const noseGeo = new THREE.BoxGeometry(0.1, 0.1, 0.2);
        const noseMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 1.7, 0.3);
        group.add(nose);

        return group;
    }

    update(joystickVector) {
        if (joystickVector.length() > 0.1) {
            const moveX = joystickVector.x * this.speed;
            const moveZ = -joystickVector.y * this.speed;

            this.mesh.position.x += moveX;
            this.mesh.position.z += moveZ;

            // Rotation
            const angle = Math.atan2(moveX, moveZ);
            this.mesh.rotation.y = angle;
        }
    }

    addItem(type) {
        if (this.stack.length >= this.carryCapacity) return false;

        const mesh = Resource.createMesh(type);
        const config = RESOURCE_TYPES[type];

        // Calculate Y position based on current stack height
        let currentHeight = 0;
        this.stack.forEach(item => {
            currentHeight += RESOURCE_TYPES[item.userData.type].size[1] + 0.05;
        });

        mesh.position.y = currentHeight;
        this.stackGroup.add(mesh);
        this.stack.push(mesh);
        return true;
    }

    removeItem() {
        if (this.stack.length === 0) return null;
        const mesh = this.stack.pop();
        this.stackGroup.remove(mesh);
        return mesh.userData.type;
    }

    hasItem(type) {
        return this.stack.some(item => item.userData.type === type);
    }

    removeSpecificItem(type) {
        const index = this.stack.findLastIndex(item => item.userData.type === type);
        if (index === -1) return null;

        const mesh = this.stack.splice(index, 1)[0];
        this.stackGroup.remove(mesh);

        // Re-align stack
        let currentHeight = 0;
        this.stack.forEach(item => {
            item.position.y = currentHeight;
            currentHeight += RESOURCE_TYPES[item.userData.type].size[1] + 0.05;
        });

        return mesh.userData.type;
    }
}

class Machine {
    constructor(scene, options) {
        this.scene = scene;
        this.name = options.name;
        this.position = options.position;
        this.inputType = options.inputType;
        this.outputType = options.outputType;
        this.processTime = options.processTime || 2000;
        this.inputCapacity = options.inputCapacity || 5;
        this.outputCapacity = options.outputCapacity || 5;

        this.inputCount = 0;
        this.outputCount = 0;
        this.isProcessing = false;

        this.mesh = this.createMesh(options.color);
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        this.initLabels();
    }

    createMesh(color) {
        const group = new THREE.Group();

        // Main Body
        const bodyGeo = new THREE.BoxGeometry(2, 1.5, 2);
        const bodyMat = new THREE.MeshStandardMaterial({ color: color || 0x777777 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.75;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // Chimney (Visual Detail)
        const chimneyGeo = new THREE.CylinderGeometry(0.2, 0.2, 1);
        const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
        chimney.position.set(0.6, 1.5, 0.6);
        group.add(chimney);

        // Progress Bar (Floating)
        const barGeo = new THREE.BoxGeometry(1.5, 0.1, 0.1);
        const barMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.set(0, 2, 0);
        group.add(bar);

        this.progressFillGeo = new THREE.BoxGeometry(1.5, 0.1, 0.1);
        const progressMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        this.progressFill = new THREE.Mesh(this.progressFillGeo, progressMat);
        this.progressFill.position.set(0, 2, 0);
        this.progressFill.scale.x = 0.001;
        group.add(this.progressFill);

        // Input Zone (Blue)
        const inGeo = new THREE.BoxGeometry(1.2, 0.05, 1.2);
        const inMat = new THREE.MeshStandardMaterial({ color: 0x0000ff, transparent: true, opacity: 0.3 });
        const inZone = new THREE.Mesh(inGeo, inMat);
        inZone.position.set(-1.5, 0.025, 0);
        group.add(inZone);

        // Output Zone (Green)
        const outGeo = new THREE.BoxGeometry(1.2, 0.05, 1.2);
        const outMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3 });
        const outZone = new THREE.Mesh(outGeo, outMat);
        outZone.position.set(1.5, 0.025, 0);
        group.add(outZone);

        return group;
    }

    initLabels() {
        // We'll use simple console logs or future UI for labels
    }

    update() {
        if (!this.isProcessing && this.inputCount > 0 && this.outputCount < this.outputCapacity) {
            this.startProcessing();
        }
    }

    startProcessing() {
        this.isProcessing = true;
        this.inputCount--;

        const startTime = Date.now();
        const updateProgress = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / this.processTime, 1);
            this.progressFill.scale.x = Math.max(progress, 0.001);
            this.progressFill.position.x = -0.75 + (progress * 0.75);

            if (progress < 1) {
                requestAnimationFrame(updateProgress);
            } else {
                this.outputCount++;
                this.isProcessing = false;
                this.progressFill.scale.x = 0.001;
                this.progressFill.position.x = 0;
            }
        };
        requestAnimationFrame(updateProgress);
    }

    checkPlayerInteraction(player) {
        const dist = player.mesh.position.distanceTo(this.mesh.position);
        if (dist < 3) {
            const now = Date.now();
            if (now - player.lastTransferTime < player.transferCooldown) return;

            // Player to Machine (Input)
            if (this.inputType && player.hasItem(this.inputType) && this.inputCount < this.inputCapacity) {
                const playerPos = player.mesh.position;
                const inZoneWorldPos = new THREE.Vector3(-1.5, 0, 0).applyMatrix4(this.mesh.matrixWorld);

                if (playerPos.distanceTo(inZoneWorldPos) < 1) {
                    player.removeSpecificItem(this.inputType);
                    this.inputCount++;
                    player.lastTransferTime = now;
                }
            }

            // Machine to Player (Output)
            if (this.outputCount > 0 && player.stack.length < player.carryCapacity) {
                const outZoneWorldPos = new THREE.Vector3(1.5, 0, 0).applyMatrix4(this.mesh.matrixWorld);
                if (player.mesh.position.distanceTo(outZoneWorldPos) < 1) {
                    if (player.addItem(this.outputType)) {
                        this.outputCount--;
                        player.lastTransferTime = now;
                    }
                }
            }
        }
    }
}

class ConveyorBelt {
    constructor(scene, fromMachine, toMachine) {
        this.scene = scene;
        this.from = fromMachine;
        this.to = toMachine;
        this.active = true;
        this.items = []; // { mesh, progress, type }
        this.speed = 0.01;

        this.path = this.createPath();
        this.mesh = this.createMesh();
        this.scene.add(this.mesh);
    }

    createPath() {
        const start = new THREE.Vector3(1.5, 0.1, 0).applyMatrix4(this.from.mesh.matrixWorld);
        const end = new THREE.Vector3(-1.5, 0.1, 0).applyMatrix4(this.to.mesh.matrixWorld);
        return new THREE.LineCurve3(start, end);
    }

    createMesh() {
        const points = this.path.getPoints(10);
        const geo = new THREE.BoxGeometry(this.path.getLength(), 0.1, 0.8);
        const mat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const mesh = new THREE.Mesh(geo, mat);

        const center = this.path.getPoint(0.5);
        mesh.position.copy(center);
        mesh.lookAt(this.path.getPoint(1));
        mesh.rotateY(Math.PI / 2);

        return mesh;
    }

    update() {
        // Pull from source
        if (this.from.outputCount > 0 && this.items.length < 5) {
            const type = this.from.outputType;
            this.from.outputCount--;
            const mesh = Resource.createMesh(type);
            this.scene.add(mesh);
            this.items.push({ mesh, progress: 0, type });
        }

        // Move items
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            item.progress += this.speed;

            const pos = this.path.getPoint(item.progress);
            item.mesh.position.copy(pos);
            item.mesh.position.y += 0.2;

            if (item.progress >= 1) {
                if (this.to.inputCount < this.to.inputCapacity) {
                    this.to.inputCount++;
                    this.scene.remove(item.mesh);
                    this.items.splice(i, 1);
                } else {
                    item.progress = 1; // Wait at end
                }
            }
        }
    }
}

class BuyZone {
    constructor(scene, options) {
        this.scene = scene;
        this.position = options.position;
        this.cost = options.cost;
        this.paid = 0;
        this.onComplete = options.onComplete;
        this.label = options.label || "Unlock";

        this.active = true;

        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        this.lastPayTime = 0;
    }

    createMesh() {
        const group = new THREE.Group();

        const ringGeo = new THREE.RingGeometry(1, 1.2, 32);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
        group.add(ring);

        // Progress Fill
        const fillGeo = new THREE.CircleGeometry(1, 32);
        const fillMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
        this.fillMesh = new THREE.Mesh(fillGeo, fillMat);
        this.fillMesh.rotation.x = -Math.PI / 2;
        this.fillMesh.position.y = 0.06;
        this.fillMesh.scale.set(0.01, 0.01, 0.01);
        group.add(this.fillMesh);

        return group;
    }

    update(player, game) {
        if (!this.active) return;

        const dist = player.mesh.position.distanceTo(this.position);
        if (dist < 1.2 && game.gold > 0) {
            const now = Date.now();
            if (now - this.lastPayTime > 50) { // Pay every 50ms
                const amount = Math.min(game.gold, 5, this.cost - this.paid);
                if (amount > 0) {
                    game.gold -= amount;
                    this.paid += amount;
                    game.updateGoldUI();
                    this.lastPayTime = now;

                    const progress = this.paid / this.cost;
                    this.fillMesh.scale.set(progress, progress, progress);

                    if (this.paid >= this.cost) {
                        this.complete();
                    }
                }
            }
        }
    }

    complete() {
        this.active = false;
        this.scene.remove(this.mesh);
        if (this.onComplete) this.onComplete();
    }
}

class SourceMachine extends Machine {
    constructor(scene, options) {
        super(scene, options);
        this.outputCount = this.outputCapacity; // Always full at start
    }

    update() {
        if (this.outputCount < this.outputCapacity && !this.isProcessing) {
            this.startProcessing();
        }
    }

    startProcessing() {
        this.isProcessing = true;
        // Source machines don't have input, they just produce

        const startTime = Date.now();
        const updateProgress = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / this.processTime, 1);
            this.progressFill.scale.x = Math.max(progress, 0.001);
            this.progressFill.position.x = -0.75 + (progress * 0.75);

            if (progress < 1) {
                requestAnimationFrame(updateProgress);
            } else {
                this.outputCount++;
                this.isProcessing = false;
                this.progressFill.scale.x = 0.001;
                this.progressFill.position.x = 0;
            }
        };
        requestAnimationFrame(updateProgress);
    }
}

class SellingStation {
    constructor(scene, position, onSale) {
        this.scene = scene;
        this.position = position;
        this.onSale = onSale;

        this.prices = {
            'LOG': 10,
            'PLANK': 25,
            'BOARD': 50,
            'BARREL': 120,
            'TABLE': 250
        };

        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
    }

    createMesh() {
        const group = new THREE.Group();

        const bodyGeo = new THREE.BoxGeometry(4, 0.1, 4);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, transparent: true, opacity: 0.2 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        // A small stall
        const stallGeo = new THREE.BoxGeometry(2, 2, 1);
        const stallMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        const stall = new THREE.Mesh(stallGeo, stallMat);
        stall.position.set(0, 1, -1.5);
        group.add(stall);

        const roofGeo = new THREE.BoxGeometry(2.4, 0.2, 1.4);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, 2.1, -1.5);
        group.add(roof);

        return group;
    }

    checkPlayerInteraction(player) {
        const dist = player.mesh.position.distanceTo(this.position);
        if (dist < 1.5) {
            const now = Date.now();
            if (now - player.lastTransferTime < player.transferCooldown) return;

            const itemType = player.removeItem();
            if (itemType) {
                const price = this.prices[itemType] || 0;
                this.onSale(price);
                player.lastTransferTime = now;
            }
        }
    }
}

class Game {
    constructor() {
        this.gold = 0;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.cameraOffset = new THREE.Vector3(0, 12, 12);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        this.initLights();
        this.initEnvironment();

        this.joystick = new Joystick();
        this.player = new Player(this.scene);

        this.machines = [];
        this.buyZones = [];
        this.conveyors = [];
        this.initMachines();

        this.sellingStation = new SellingStation(
            this.scene,
            new THREE.Vector3(0, 0, 5),
            (amount) => this.addGold(amount)
        );

        this.initBuyZones();

        window.addEventListener('resize', () => this.onWindowResize());
        this.animate();
    }

    initLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(20, 40, 20);
        dirLight.castShadow = true;

        // Shadow optimization
        dirLight.shadow.camera.left = -50;
        dirLight.shadow.camera.right = 50;
        dirLight.shadow.camera.top = 50;
        dirLight.shadow.camera.bottom = -50;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 150;

        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);
    }

    initEnvironment() {
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x3a5a40 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        const grid = new THREE.GridHelper(100, 50, 0x000000, 0x000000);
        grid.material.opacity = 0.2;
        grid.material.transparent = true;
        this.scene.add(grid);
    }

    addGold(amount) {
        this.gold += amount;
        this.updateGoldUI();
    }

    updateGoldUI() {
        document.getElementById('gold-amount').innerText = this.gold;
    }

    initBuyZones() {
        // Unlock Conveyor Forest -> Sawmill
        this.buyZones.push(new BuyZone(this.scene, {
            position: new THREE.Vector3(-4, 0, -8),
            cost: 100,
            label: "Auto-Transport 1",
            onComplete: () => {
                const forest = this.machines.find(m => m.name === "Forest");
                const sawmill = this.machines.find(m => m.name === "Sawmill");
                this.conveyors.push(new ConveyorBelt(this.scene, forest, sawmill));
            }
        }));

        // Unlock Conveyor Sawmill -> Planer
        this.buyZones.push(new BuyZone(this.scene, {
            position: new THREE.Vector3(4, 0, -8),
            cost: 300,
            label: "Auto-Transport 2",
            onComplete: () => {
                const sawmill = this.machines.find(m => m.name === "Sawmill");
                const planer = this.machines.find(m => m.name === "Planer");
                this.conveyors.push(new ConveyorBelt(this.scene, sawmill, planer));
            }
        }));

        // Unlock Workshop
        this.buyZones.push(new BuyZone(this.scene, {
            position: new THREE.Vector3(16, 0, -8),
            cost: 500,
            label: "Workshop",
            onComplete: () => {
                const workshop = new Machine(this.scene, {
                    name: "Workshop",
                    position: new THREE.Vector3(16, 0, -8),
                    inputType: 'BOARD',
                    outputType: 'TABLE',
                    color: 0x5c4033,
                    processTime: 5000
                });
                this.machines.push(workshop);
            }
        }));

        // Upgrade Sawmill Speed
        this.buyZones.push(new BuyZone(this.scene, {
            position: new THREE.Vector3(0, 0, -4),
            cost: 200,
            label: "Sawmill Upgrade",
            onComplete: () => {
                const sawmill = this.machines.find(m => m.name === "Sawmill");
                if (sawmill) sawmill.processTime /= 2;
            }
        }));
    }

    initMachines() {
        // Forest / Source
        this.machines.push(new SourceMachine(this.scene, {
            name: "Forest",
            position: new THREE.Vector3(-8, 0, -8),
            outputType: 'LOG',
            color: 0x228b22,
            processTime: 1000,
            outputCapacity: 10
        }));

        // Sawmill
        this.machines.push(new Machine(this.scene, {
            name: "Sawmill",
            position: new THREE.Vector3(0, 0, -8),
            inputType: 'LOG',
            outputType: 'PLANK',
            color: 0x8b4513,
            processTime: 2000
        }));

        // Planer
        this.machines.push(new Machine(this.scene, {
            name: "Planer",
            position: new THREE.Vector3(8, 0, -8),
            inputType: 'PLANK',
            outputType: 'BOARD',
            color: 0xdeb887,
            processTime: 3000
        }));
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.player.update(this.joystick.vector);

        this.machines.forEach(machine => {
            machine.update();
            machine.checkPlayerInteraction(this.player);
        });

        this.conveyors.forEach(conveyor => {
            conveyor.update();
        });

        this.buyZones.forEach(zone => {
            zone.update(this.player, this);
        });

        this.sellingStation.checkPlayerInteraction(this.player);

        // Camera Follow
        this.camera.position.lerp(
            this.player.mesh.position.clone().add(this.cameraOffset),
            0.1
        );
        this.camera.lookAt(this.player.mesh.position);

        this.renderer.render(this.scene, this.camera);
    }
}

window.gameInstance = new Game();
