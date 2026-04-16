import * as THREE from 'three';

// ─── SPRITE LABEL UTILITY ─────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

/**
 * Creates a canvas-based THREE.Sprite label that can be redrawn at runtime.
 * @param {string|string[]} lines  - One or more lines of text
 * @param {object}          opts   - width, height, bg, fg, titleColor
 */
function makeSprite(lines, opts = {}) {
    const W = opts.width  ?? 256;
    const H = opts.height ?? 64;
    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
    );
    sprite.scale.set(W / 80, H / 80, 1);

    sprite.redraw = (newLines, overrideBg) => {
        const arr = Array.isArray(newLines) ? newLines : [newLines];
        ctx.clearRect(0, 0, W, H);

        // Background
        ctx.fillStyle = overrideBg ?? (opts.bg ?? 'rgba(8,8,16,0.82)');
        roundRect(ctx, 2, 2, W - 4, H - 4, 8);
        ctx.fill();

        // Subtle border
        ctx.strokeStyle = 'rgba(255,255,255,0.13)';
        ctx.lineWidth = 1;
        roundRect(ctx, 2, 2, W - 4, H - 4, 8);
        ctx.stroke();

        const lineH = (H - 4) / arr.length;
        arr.forEach((line, i) => {
            ctx.fillStyle = i === 0 ? (opts.titleColor ?? '#ffd700') : (opts.fg ?? '#dddddd');
            ctx.font       = i === 0 ? (opts.titleFont ?? 'bold 18px Arial') : (opts.bodyFont ?? '14px Arial');
            ctx.textAlign     = 'center';
            ctx.textBaseline  = 'middle';
            ctx.fillText(String(line), W / 2, 2 + lineH * i + lineH / 2);
        });
        tex.needsUpdate = true;
    };

    sprite.redraw(lines);
    return sprite;
}

// ─── JOYSTICK ─────────────────────────────────────────────────────────────────

class Joystick {
    constructor() {
        this.base      = document.getElementById('joystick-base');
        this.knob      = document.getElementById('joystick-knob');
        this.active    = false;
        this.vector    = new THREE.Vector2(0, 0);
        this.maxRadius = 40;

        this.base.addEventListener('touchstart', e => this.start(e), { passive: false });
        this.base.addEventListener('mousedown',  e => this.start(e));
        window.addEventListener('touchmove', e => this.move(e), { passive: false });
        window.addEventListener('mousemove',  e => this.move(e));
        window.addEventListener('touchend', () => this.end());
        window.addEventListener('mouseup',   () => this.end());
    }

    start(e) { this.active = true; this.move(e); }

    move(e) {
        if (!this.active) return;
        const { clientX, clientY } = e.touches ? e.touches[0] : e;
        const rect   = this.base.getBoundingClientRect();
        const dx     = clientX - (rect.left + rect.width  / 2);
        const dy     = clientY - (rect.top  + rect.height / 2);
        const angle  = Math.atan2(dy, dx);
        const dist   = Math.min(Math.hypot(dx, dy), this.maxRadius);
        const x      = Math.cos(angle) * dist;
        const y      = Math.sin(angle) * dist;
        this.knob.style.transform = `translate(${x}px, ${y}px)`;
        this.vector.set(x / this.maxRadius, -y / this.maxRadius);
    }

    end() {
        this.active = false;
        this.knob.style.transform = 'translate(0px, 0px)';
        this.vector.set(0, 0);
    }
}

// ─── RESOURCES ────────────────────────────────────────────────────────────────

const RESOURCE_TYPES = {
    LOG:    { color: 0x8b4513, size: [0.6, 0.3,  0.3 ], name: 'Holzstamm' },
    PLANK:  { color: 0xdeb887, size: [0.7, 0.1,  0.4 ], name: 'Planke'    },
    BOARD:  { color: 0xf5deb3, size: [0.5, 0.05, 0.5 ], name: 'Brett'     },
    BARREL: { color: 0x654321, size: [0.4, 0.5,  0.4 ], name: 'Fass'      },
    TABLE:  { color: 0x5c4033, size: [0.8, 0.4,  0.6 ], name: 'Tisch'     },
};

class Resource {
    static createMesh(type) {
        const cfg  = RESOURCE_TYPES[type];
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(...cfg.size),
            new THREE.MeshStandardMaterial({ color: cfg.color })
        );
        mesh.castShadow    = true;
        mesh.userData.type = type;
        return mesh;
    }
}

// ─── HUD HELPERS ──────────────────────────────────────────────────────────────

function updateInventoryHUD(stack) {
    const el = document.getElementById('inventory-display');
    if (!el) return;
    if (!stack.length) { el.textContent = 'leer'; return; }
    const counts = {};
    stack.forEach(i => { const t = i.userData.type; counts[t] = (counts[t] || 0) + 1; });
    el.textContent = Object.entries(counts)
        .map(([t, c]) => `${RESOURCE_TYPES[t].name} ×${c}`)
        .join('   ');
}

function showGoldPop(amount, worldPos, camera, renderer) {
    const el = document.createElement('div');
    el.className  = 'gold-pop';
    el.textContent = `+${amount}`;
    document.body.appendChild(el);

    const v  = worldPos.clone().project(camera);
    const hw = renderer.domElement.clientWidth  / 2;
    const hh = renderer.domElement.clientHeight / 2;
    el.style.left = `${v.x * hw + hw}px`;
    el.style.top  = `${-v.y * hh + hh}px`;

    setTimeout(() => el.remove(), 900);
}

// ─── PLAYER ───────────────────────────────────────────────────────────────────

class Player {
    constructor(scene) {
        this.scene            = scene;
        this.speed            = 0.15;
        this.mesh             = this._buildMesh();
        this.scene.add(this.mesh);
        this.stack            = [];
        this.carryCapacity    = 20;
        this.stackGroup       = new THREE.Group();
        this.mesh.add(this.stackGroup);
        this.stackGroup.position.set(0, 0.7, -0.45);
        this.lastTransferTime = 0;
        this.transferCooldown = 150;
        this.BOUNDS           = 44;
    }

    _buildMesh() {
        const g = new THREE.Group();

        // Body - more rounded
        const body = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 16, 12),
            new THREE.MeshStandardMaterial({ color: 0x3366ff, roughness: 0.4 })
        );
        body.scale.set(1, 1.2, 0.8);
        body.position.y = 0.6;
        body.castShadow = true;
        g.add(body);

        // Backpack
        const backpack = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.7, 0.4),
            new THREE.MeshStandardMaterial({ color: 0x8b4513 })
        );
        backpack.position.set(0, 0.7, -0.4);
        g.add(backpack);

        // Head
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0xffdbac })
        );
        head.position.y = 1.35;
        head.castShadow = true;
        g.add(head);

        // Eyes
        for (const x of [-0.12, 0.12]) {
            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(0.05, 8, 8),
                new THREE.MeshStandardMaterial({ color: 0x000000 })
            );
            eye.position.set(x, 1.4, 0.3);
            g.add(eye);
        }

        // Hat
        const hat = new THREE.Mesh(
            new THREE.CylinderGeometry(0.36, 0.36, 0.1, 16),
            new THREE.MeshStandardMaterial({ color: 0xee2222 })
        );
        hat.position.y = 1.65;
        g.add(hat);

        return g;
    }

    update(jv) {
        if (jv.length() > 0.1) {
            const dx = jv.x * this.speed;
            const dz = -jv.y * this.speed;
            const B  = this.BOUNDS;
            this.mesh.position.x = Math.max(-B, Math.min(B, this.mesh.position.x + dx));
            this.mesh.position.z = Math.max(-B, Math.min(B, this.mesh.position.z + dz));
            this.mesh.rotation.y = Math.atan2(dx, dz);
        }
    }

    addItem(type) {
        if (this.stack.length >= this.carryCapacity) return false;
        const mesh = Resource.createMesh(type);
        let h = 0;
        this.stack.forEach(item => { h += RESOURCE_TYPES[item.userData.type].size[1] + 0.05; });
        mesh.position.y = h;
        this.stackGroup.add(mesh);
        this.stack.push(mesh);
        updateInventoryHUD(this.stack);

        // Juice: Pop animation for the new item
        const baseScale = mesh.scale.clone();
        mesh.scale.multiplyScalar(0.1);
        const t0 = Date.now();
        const anim = () => {
            const p = Math.min((Date.now() - t0) / 200, 1);
            const s = p < 0.5 ? 1.2 * (p * 2) : 1.2 - 0.2 * ((p - 0.5) * 2);
            mesh.scale.copy(baseScale).multiplyScalar(s);
            if (p < 1) requestAnimationFrame(anim);
            else mesh.scale.copy(baseScale);
        };
        anim();

        return true;
    }

    removeItem() {
        if (!this.stack.length) return null;
        const mesh = this.stack.pop();
        this.stackGroup.remove(mesh);
        updateInventoryHUD(this.stack);
        return mesh.userData.type;
    }

    hasItem(type) {
        return this.stack.some(i => i.userData.type === type);
    }

    removeSpecificItem(type) {
        const idx = this.stack.findLastIndex(i => i.userData.type === type);
        if (idx === -1) return null;
        const [mesh] = this.stack.splice(idx, 1);
        this.stackGroup.remove(mesh);
        // Re-align remaining items
        let h = 0;
        this.stack.forEach(item => {
            item.position.y = h;
            h += RESOURCE_TYPES[item.userData.type].size[1] + 0.05;
        });
        updateInventoryHUD(this.stack);
        return mesh.userData.type;
    }
}

// ─── MACHINE ──────────────────────────────────────────────────────────────────

class Machine {
    constructor(scene, options) {
        this.scene           = scene;
        this.name            = options.name;
        this.position        = options.position;
        this.inputType       = options.inputType  ?? null;
        this.outputType      = options.outputType;
        this.processTime     = options.processTime     ?? 2000;
        this.inputCapacity   = options.inputCapacity   ?? 5;
        this.outputCapacity  = options.outputCapacity  ?? 5;
        this.inputCount      = 0;
        this.outputCount     = 0;
        this.isProcessing    = false;
        this._lastLabelTick  = 0;

        this.mesh = this._buildMesh(options.color);
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
        this._buildLabels();
    }

    _buildMesh(color) {
        const g = new THREE.Group();

        // Main body with rounded corners effect using multiple boxes or just one styled one
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(2.2, 1.6, 2.2),
            new THREE.MeshStandardMaterial({ color: color ?? 0x777777, roughness: 0.2 })
        );
        body.position.y = 0.8;
        body.castShadow = true;
        body.receiveShadow = true;
        g.add(body);

        // Decorative "bolts" or details
        const detailG = new THREE.Group();
        for (let x of [-0.9, 0.9]) {
            for (let z of [-0.9, 0.9]) {
                const bolt = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8),
                    new THREE.MeshStandardMaterial({ color: 0x333333 })
                );
                bolt.position.set(x, 1.6, z);
                detailG.add(bolt);
            }
        }
        g.add(detailG);

        this.chimney = new THREE.Mesh(
            new THREE.CylinderGeometry(0.25, 0.3, 1.2, 8),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        this.chimney.position.set(0.6, 2.2, 0.6);
        g.add(this.chimney);

        // Funnel at top of chimney
        const funnel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4, 0.25, 0.4, 8),
            new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        funnel.position.y = 0.6;
        this.chimney.add(funnel);

        // Progress bar background
        const barBg = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.2, 0.15),
            new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        barBg.position.set(0, 2.2, 0);
        g.add(barBg);

        this.progressFill = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.14, 0.12),
            new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x006622 })
        );
        this.progressFill.position.set(0, 2.2, 0);
        this.progressFill.scale.x = 0.001;
        g.add(this.progressFill);

        // Base/Feet
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(2.4, 0.2, 2.4),
            new THREE.MeshStandardMaterial({ color: 0x444444 })
        );
        base.position.y = 0.1;
        g.add(base);

        // Input zone (blue)
        g.add(this._makeZone(0x3388ff, -1.8));
        // Output zone (green)
        g.add(this._makeZone(0x33ff88, 1.8));

        return g;
    }

    _makeZone(color, x) {
        const zone = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.05, 1.2),
            new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.4 })
        );
        zone.position.set(x, 0.025, 0);
        return zone;
    }

    _buildLabels() {
        // Machine name – floats above
        this.nameLabel = makeSprite(this.name, { width: 180, height: 38, titleColor: '#ffe566' });
        this.nameLabel.position.set(0, 3.1, 0);
        this.mesh.add(this.nameLabel);

        // Status (input/output counts) – updates periodically
        this.statusLabel = makeSprite(this._statusLines(), { width: 230, height: 52 });
        this.statusLabel.position.set(0, 2.55, 0);
        this.mesh.add(this.statusLabel);
    }

    _statusLines() {
        const inName  = this.inputType ? RESOURCE_TYPES[this.inputType].name : '—';
        const outName = RESOURCE_TYPES[this.outputType].name;
        return [
            `${inName}  →  ${outName}`,
            `In: ${this.inputCount}/${this.inputCapacity}   Out: ${this.outputCount}/${this.outputCapacity}`,
        ];
    }

    _refreshStatusLabel() {
        this.statusLabel.redraw(this._statusLines());
    }

    update() {
        if (!this.isProcessing && this.inputCount > 0 && this.outputCount < this.outputCapacity) {
            this._startProcessing();
        }
        const now = Date.now();
        if (now - this._lastLabelTick > 350) {
            this._refreshStatusLabel();
            this._lastLabelTick = now;
        }
    }

    _startProcessing() {
        this.isProcessing = true;
        this.inputCount--;
        const t0 = Date.now();
        const tick = () => {
            const elapsed = Date.now() - t0;
            const p = Math.min(elapsed / this.processTime, 1);

            this.progressFill.scale.x   = Math.max(p, 0.001);
            this.progressFill.position.x = -0.75 + p * 0.75;

            // Wobble effect
            const wobble = Math.sin(elapsed * 0.02) * 0.03;
            this.mesh.scale.set(1 + wobble, 1 - wobble, 1 + wobble);
            this.chimney.rotation.z = Math.sin(elapsed * 0.03) * 0.1;

            if (p < 1) {
                requestAnimationFrame(tick);
            } else {
                this.outputCount++;
                this.isProcessing          = false;
                this.progressFill.scale.x  = 0.001;
                this.progressFill.position.x = 0;
                this.mesh.scale.set(1, 1, 1);
                this.chimney.rotation.z = 0;
            }
        };
        requestAnimationFrame(tick);
    }

    checkPlayerInteraction(player) {
        if (player.mesh.position.distanceTo(this.mesh.position) >= 3.2) return;
        const now = Date.now();
        if (now - player.lastTransferTime < player.transferCooldown) return;

        // Player → Machine input
        if (this.inputType && player.hasItem(this.inputType) && this.inputCount < this.inputCapacity) {
            const inWorld = new THREE.Vector3(-1.5, 0, 0).applyMatrix4(this.mesh.matrixWorld);
            if (player.mesh.position.distanceTo(inWorld) < 1.1) {
                player.removeSpecificItem(this.inputType);
                this.inputCount++;
                player.lastTransferTime = now;
            }
        }

        // Machine output → Player
        if (this.outputCount > 0 && player.stack.length < player.carryCapacity) {
            const outWorld = new THREE.Vector3(1.5, 0, 0).applyMatrix4(this.mesh.matrixWorld);
            if (player.mesh.position.distanceTo(outWorld) < 1.1) {
                if (player.addItem(this.outputType)) {
                    this.outputCount--;
                    player.lastTransferTime = now;
                }
            }
        }
    }
}

// ─── SOURCE MACHINE ───────────────────────────────────────────────────────────

class SourceMachine extends Machine {
    constructor(scene, options) {
        super(scene, options);
        this.outputCount = this.outputCapacity; // Pre-filled
    }

    update() {
        // Auto-refill when below capacity
        if (!this.isProcessing && this.outputCount < this.outputCapacity) {
            this._startProcessing();
        }
        const now = Date.now();
        if (now - this._lastLabelTick > 350) {
            this._refreshStatusLabel();
            this._lastLabelTick = now;
        }
    }

    _startProcessing() {
        // Source machines produce without consuming input
        this.isProcessing = true;
        const t0 = Date.now();
        const tick = () => {
            const elapsed = Date.now() - t0;
            const p = Math.min(elapsed / this.processTime, 1);

            this.progressFill.scale.x   = Math.max(p, 0.001);
            this.progressFill.position.x = -0.75 + p * 0.75;

            // Wobble effect
            const wobble = Math.sin(elapsed * 0.02) * 0.03;
            this.mesh.scale.set(1 + wobble, 1 - wobble, 1 + wobble);
            this.chimney.rotation.z = Math.sin(elapsed * 0.03) * 0.1;

            if (p < 1) {
                requestAnimationFrame(tick);
            } else {
                this.outputCount++;
                this.isProcessing          = false;
                this.progressFill.scale.x  = 0.001;
                this.progressFill.position.x = 0;
                this.mesh.scale.set(1, 1, 1);
                this.chimney.rotation.z = 0;
            }
        };
        requestAnimationFrame(tick);
    }

    _statusLines() {
        const outName = RESOURCE_TYPES[this.outputType].name;
        return [
            `Produziert ${outName}`,
            `Verfügbar: ${this.outputCount}/${this.outputCapacity}`,
        ];
    }
}

// ─── CONVEYOR BELT ────────────────────────────────────────────────────────────

class ConveyorBelt {
    constructor(scene, from, to) {
        this.scene = scene;
        this.from  = from;
        this.to    = to;
        this.items = [];
        this.speed = 0.008;

        this.path = new THREE.LineCurve3(
            new THREE.Vector3(1.5, 0.1, 0).applyMatrix4(from.mesh.matrixWorld),
            new THREE.Vector3(-1.5, 0.1, 0).applyMatrix4(to.mesh.matrixWorld)
        );
        this._buildVisuals();
    }

    _buildVisuals() {
        const len = this.path.getLength();
        const mid = this.path.getPoint(0.5);
        const end = this.path.getPoint(1.0);

        // Belt body
        const belt = new THREE.Mesh(
            new THREE.BoxGeometry(len, 0.1, 0.85),
            new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
        );
        belt.position.copy(mid);
        belt.lookAt(end);
        belt.rotateY(Math.PI / 2);
        this.scene.add(belt);

        // Stripe markers along belt
        for (let t = 0.07; t < 1; t += 0.13) {
            const stripe = new THREE.Mesh(
                new THREE.BoxGeometry(0.07, 0.12, 0.82),
                new THREE.MeshStandardMaterial({ color: 0xffcc00 })
            );
            stripe.position.copy(this.path.getPoint(t));
            stripe.position.y += 0.01;
            stripe.lookAt(end);
            stripe.rotateY(Math.PI / 2);
            this.scene.add(stripe);
        }
    }

    update() {
        // Pull one item at a time from the source machine's output
        if (this.from.outputCount > 0 && this.items.length < 5) {
            this.from.outputCount--;
            const mesh = Resource.createMesh(this.from.outputType);
            this.scene.add(mesh);
            this.items.push({ mesh, progress: 0 });
        }

        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            item.progress = Math.min(item.progress + this.speed, 1);

            const pos = this.path.getPoint(item.progress);
            item.mesh.position.copy(pos);
            item.mesh.position.y += 0.2;

            if (item.progress >= 1) {
                if (this.to.inputCount < this.to.inputCapacity) {
                    this.to.inputCount++;
                    this.scene.remove(item.mesh);
                    this.items.splice(i, 1);
                }
                // else: item waits at end until destination has space
            }
        }
    }
}

// ─── BUY ZONE ─────────────────────────────────────────────────────────────────

class BuyZone {
    constructor(scene, options) {
        this.scene      = scene;
        this.position   = options.position;
        this.cost       = options.cost;
        this.paid       = 0;
        this.onComplete = options.onComplete;
        this.label      = options.label ?? 'Unlock';
        this.active     = true;
        this.lastPayTime = 0;

        this.mesh = this._buildMesh();
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
        this._buildCostLabel();
    }

    _buildMesh() {
        const g = new THREE.Group();

        // Outer gold ring
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(1.1, 1.4, 48),
            new THREE.MeshStandardMaterial({ color: 0xffd700, side: THREE.DoubleSide, emissive: 0x443300 })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;
        g.add(ring);

        // Progress fill circle
        this.fillMesh = new THREE.Mesh(
            new THREE.CircleGeometry(1.05, 48),
            new THREE.MeshStandardMaterial({ color: 0x00ff88, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
        );
        this.fillMesh.rotation.x = -Math.PI / 2;
        this.fillMesh.position.y = 0.03;
        this.fillMesh.scale.set(0.001, 0.001, 0.001);
        g.add(this.fillMesh);

        return g;
    }

    _buildCostLabel() {
        // Floating label above the buy zone showing cost and progress
        this.costLabel = makeSprite(
            [this.label, `Kosten: ${this.cost} 🪙`, `0% bezahlt`],
            { width: 230, height: 78, bg: 'rgba(15,12,0,0.9)', titleColor: '#ffd700', fg: '#ccc' }
        );
        this.costLabel.position.set(0, 2.8, 0);
        this.mesh.add(this.costLabel);
    }

    _updateCostLabel() {
        const remaining = this.cost - this.paid;
        const pct       = Math.round((this.paid / this.cost) * 100);
        const bar       = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
        this.costLabel.redraw([
            this.label,
            `Noch: ${remaining} 🪙  (${pct}%)`,
            bar,
        ]);
    }

    update(player, game) {
        if (!this.active) return;

        const now  = Date.now();
        const dist = player.mesh.position.distanceTo(this.position);

        if (dist < 1.4 && game.gold > 0 && now - this.lastPayTime > 50) {
            const amount = Math.min(game.gold, 5, this.cost - this.paid);
            if (amount > 0) {
                game.gold -= amount;
                this.paid += amount;
                game.updateGoldUI();
                this.lastPayTime = now;

                const p = this.paid / this.cost;
                this.fillMesh.scale.set(p, p, p);
                this._updateCostLabel();

                if (this.paid >= this.cost) this._complete();
            }
        }
    }

    _complete() {
        this.active = false;
        this.scene.remove(this.mesh);
        this.onComplete?.();
    }
}

// ─── SELLING STATION ──────────────────────────────────────────────────────────

class SellingStation {
    constructor(scene, position, onSale) {
        this.scene    = scene;
        this.position = position;
        this.onSale   = onSale;
        this.prices   = { LOG: 10, PLANK: 25, BOARD: 50, BARREL: 120, TABLE: 250 };

        this.mesh = this._buildMesh();
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);
        this._buildLabel();
    }

    _buildMesh() {
        const g = new THREE.Group();

        // Floor zone - more vibrant
        const floor = new THREE.Mesh(
            new THREE.CircleGeometry(2.5, 32),
            new THREE.MeshStandardMaterial({ color: 0x00ff88, transparent: true, opacity: 0.25 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0.02;
        g.add(floor);

        // Stall body
        const stall = new THREE.Mesh(
            new THREE.BoxGeometry(3, 1.8, 1.2),
            new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.7 })
        );
        stall.position.set(0, 0.9, -1.4);
        stall.castShadow = true;
        g.add(stall);

        // Striped Roof
        const roofGroup = new THREE.Group();
        roofGroup.position.set(0, 2.0, -1.0);
        g.add(roofGroup);

        for (let i = 0; i < 5; i++) {
            const stripe = new THREE.Mesh(
                new THREE.BoxGeometry(0.7, 0.15, 1.8),
                new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xee2222 : 0xffffff })
            );
            stripe.position.x = -1.4 + i * 0.7;
            stripe.rotation.x = 0.2;
            roofGroup.add(stripe);
        }

        // Counter
        const counter = new THREE.Mesh(
            new THREE.BoxGeometry(2.8, 0.15, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x5c3a1e })
        );
        counter.position.set(0, 1.0, -0.7);
        g.add(counter);

        // Decorative coins on counter
        for (let i = 0; i < 3; i++) {
            const coin = new THREE.Mesh(
                new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12),
                new THREE.MeshStandardMaterial({ color: 0xffd700 })
            );
            coin.position.set(-0.8 + i * 0.4, 1.1, -0.7);
            g.add(coin);
        }

        return g;
    }

    _buildLabel() {
        const priceLines = Object.entries(this.prices)
            .map(([t, p]) => `${RESOURCE_TYPES[t].name}: ${p} 🪙`);

        const totalLines = 1 + priceLines.length;
        const H = 28 + totalLines * 20;

        const label = makeSprite(
            ['VERKAUF 💰', ...priceLines],
            {
                width:      210,
                height:     H,
                bg:         'rgba(0,60,10,0.9)',
                titleColor: '#ffd700',
                fg:         '#cceedd',
                bodyFont:   '13px Arial',
            }
        );
        label.position.set(0, 3.4, -1.5);
        this.mesh.add(label);
    }

    checkPlayerInteraction(player) {
        if (player.mesh.position.distanceTo(this.position) >= 2.2) return;
        const now = Date.now();
        if (now - player.lastTransferTime < player.transferCooldown) return;

        const type = player.removeItem();
        if (type) {
            const price = this.prices[type] ?? 0;
            this.onSale(price, player.mesh.position.clone());
            player.lastTransferTime = now;
        }
    }
}

// ─── GAME ─────────────────────────────────────────────────────────────────────

class Game {
    constructor() {
        this.gold = 0;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x7ab8e8);
        this.scene.fog = new THREE.Fog(0x7ab8e8, 45, 95);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
        this.cameraOffset = new THREE.Vector3(0, 12, 13);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        this._initLights();
        this._initEnvironment();

        this.joystick  = new Joystick();
        this.player    = new Player(this.scene);
        this.machines  = [];
        this.buyZones  = [];
        this.conveyors = [];

        this._initMachines();

        this.sellingStation = new SellingStation(
            this.scene,
            new THREE.Vector3(0, 0, 6),
            (amount, pos) => {
                this.addGold(amount);
                showGoldPop(amount, pos, this.camera, this.renderer);
            }
        );

        this._initBuyZones();

        window.addEventListener('resize', () => this._onResize());
        this._animate();
    }

    _initLights() {
        this.scene.add(new THREE.AmbientLight(0xfff8e8, 0.65));

        const sun = new THREE.DirectionalLight(0xfff4d0, 1.3);
        sun.position.set(25, 45, 20);
        sun.castShadow = true;
        Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 0.5, far: 200 });
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.bias = -0.001;
        this.scene.add(sun);
    }

    _initEnvironment() {
        // Main ground
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100),
            new THREE.MeshStandardMaterial({ color: 0x3a5f3a })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Dirt path between machines and sell station
        const path = new THREE.Mesh(
            new THREE.PlaneGeometry(3, 24),
            new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 1 })
        );
        path.rotation.x = -Math.PI / 2;
        path.position.set(0, 0.005, -4);
        this.scene.add(path);

        // Grid overlay
        const grid = new THREE.GridHelper(100, 50, 0x000000, 0x000000);
        grid.material.opacity = 0.07;
        grid.material.transparent = true;
        this.scene.add(grid);

        // Decorative trees
        const treePositions = [
            [-16, -16], [16, -16], [-16, 4], [16, 4],
            [-22, -6], [22, -6], [-12, 12], [12, 12],
            [-5, 18], [5, 18],
        ];
        treePositions.forEach(([x, z]) => this.scene.add(this._makeTree(x, z)));
    }

    _makeTree(x, z) {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.28, 0.38, 2.2, 6),
            new THREE.MeshStandardMaterial({ color: 0x5c3a1e })
        );
        trunk.position.y = 1.1;
        trunk.castShadow = true;
        g.add(trunk);

        const top = new THREE.Mesh(
            new THREE.ConeGeometry(1.5, 3.2, 7),
            new THREE.MeshStandardMaterial({ color: 0x1a5c1a })
        );
        top.position.y = 3.7;
        top.castShadow = true;
        g.add(top);

        g.position.set(x, 0, z);
        return g;
    }

    addGold(amount) {
        this.gold += amount;
        this.updateGoldUI();
    }

    updateGoldUI() {
        document.getElementById('gold-amount').textContent = this.gold.toLocaleString('de-DE');
    }

    _initMachines() {
        this.machines.push(new SourceMachine(this.scene, {
            name:           'Wald',
            position:       new THREE.Vector3(-8, 0, -8),
            outputType:     'LOG',
            color:          0x228b22,
            processTime:    1000,
            outputCapacity: 10,
        }));

        this.machines.push(new Machine(this.scene, {
            name:        'Sägewerk',
            position:    new THREE.Vector3(0, 0, -8),
            inputType:   'LOG',
            outputType:  'PLANK',
            color:       0x8b4513,
            processTime: 2000,
        }));

        this.machines.push(new Machine(this.scene, {
            name:        'Hobelmaschine',
            position:    new THREE.Vector3(8, 0, -8),
            inputType:   'PLANK',
            outputType:  'BOARD',
            color:       0xc8a060,
            processTime: 3000,
        }));
    }

    _initBuyZones() {
        // Auto-conveyor: Wald → Sägewerk
        this.buyZones.push(new BuyZone(this.scene, {
            position:   new THREE.Vector3(-4, 0, -4),
            cost:       100,
            label:      '⚙ Auto-Transport I',
            onComplete: () => {
                const wald     = this.machines.find(m => m.name === 'Wald');
                const saegewerk = this.machines.find(m => m.name === 'Sägewerk');
                this.conveyors.push(new ConveyorBelt(this.scene, wald, saegewerk));
            },
        }));

        // Auto-conveyor: Sägewerk → Hobelmaschine
        this.buyZones.push(new BuyZone(this.scene, {
            position:   new THREE.Vector3(4, 0, -4),
            cost:       300,
            label:      '⚙ Auto-Transport II',
            onComplete: () => {
                const saegewerk   = this.machines.find(m => m.name === 'Sägewerk');
                const hobelmaschine = this.machines.find(m => m.name === 'Hobelmaschine');
                this.conveyors.push(new ConveyorBelt(this.scene, saegewerk, hobelmaschine));
            },
        }));

        // Upgrade: Sägewerk speed x2
        this.buyZones.push(new BuyZone(this.scene, {
            position:   new THREE.Vector3(0, 0, -12),
            cost:       200,
            label:      '⚡ Sägewerk Upgrade',
            onComplete: () => {
                const s = this.machines.find(m => m.name === 'Sägewerk');
                if (s) s.processTime = Math.max(500, s.processTime / 2);
            },
        }));

        // Unlock Workshop (Board → Table)
        this.buyZones.push(new BuyZone(this.scene, {
            position:   new THREE.Vector3(16, 0, -8),
            cost:       500,
            label:      '🏭 Werkstatt freischalten',
            onComplete: () => {
                const workshop = new Machine(this.scene, {
                    name:        'Werkstatt',
                    position:    new THREE.Vector3(16, 0, -8),
                    inputType:   'BOARD',
                    outputType:  'TABLE',
                    color:       0x5c4033,
                    processTime: 5000,
                });
                this.machines.push(workshop);

                // Add conveyor belt upgrade after workshop is built
                this.buyZones.push(new BuyZone(this.scene, {
                    position:   new THREE.Vector3(12, 0, -4),
                    cost:       750,
                    label:      '⚙ Auto-Transport III',
                    onComplete: () => {
                        const hobelmaschine = this.machines.find(m => m.name === 'Hobelmaschine');
                        this.conveyors.push(new ConveyorBelt(this.scene, hobelmaschine, workshop));
                    },
                }));
            },
        }));
    }

    _onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    _animate() {
        requestAnimationFrame(() => this._animate());

        this.player.update(this.joystick.vector);

        this.machines.forEach(m => {
            m.update();
            m.checkPlayerInteraction(this.player);
        });

        this.conveyors.forEach(c => c.update());
        this.buyZones.forEach(z => z.update(this.player, this));
        this.sellingStation.checkPlayerInteraction(this.player);

        // Smooth camera follow
        this.camera.position.lerp(
            this.player.mesh.position.clone().add(this.cameraOffset),
            0.1
        );
        this.camera.lookAt(this.player.mesh.position);

        this.renderer.render(this.scene, this.camera);
    }
}

window.gameInstance = new Game();
