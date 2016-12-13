// Callisto, a Ludum Dare 37 Entry
// (c) 2016 by Arthur Langereis (@zenmumbler)

/// <reference path="levelgen.ts" />

type ContactPoints = number[][];

function intersectCircleLineSeg(C: sd.ConstFloat2, r: number, line: LineSeg): ContactPoints | null {
	const E = [line[0], line[1]];
	const L = [line[2], line[3]];
	const d = vec2.sub([], L, E);
	const f = vec2.sub([], E, C);
	const a = vec2.dot(d, d);
	const b = 2 * vec2.dot(f, d);
	const c = vec2.dot(f, f) - r * r;

	let discriminant = b * b - 4 * a * c;
	if (discriminant < 0) {
		// no intersection
		return null;
	}
	else {
		const result: ContactPoints = [];
		// ray didn't totally miss sphere,
		// so there is a solution to
		// the equation.
		discriminant = Math.sqrt(discriminant);

		// either solution may be on or off the ray so need to test both
		// t1 is always the smaller value, because BOTH discriminant and
		// a are nonnegative.
		const t1 = (-b - discriminant) / (2 * a);
		const t2 = (-b + discriminant) / (2 * a);

		// 3x HIT cases:
		//          -o->             --|-->  |            |  --|->
		// Impale(t1 hit,t2 hit), Poke(t1 hit,t2>1), ExitWound(t1<0, t2 hit), 

		// 3x MISS cases:
		//       ->  o                     o ->              | -> |
		// FallShort (t1>1,t2>1), Past (t1<0,t2<0), CompletelyInside(t1<0, t2>1)

		if (t1 >= 0 && t1 <= 1) {
			// t1 is the intersection, and it's closer than t2
			// (since t1 uses -b - discriminant)
			// Impale, Poke

			result.push(vec2.scaleAndAdd([], E, d, t1));
		}

		// here t1 didn't intersect so we are either started
		// inside the sphere or completely past it
		if (t2 >= 0 && t2 <= 1) {
			// ExitWound
			result.push(vec2.scaleAndAdd([], E, d, t2));
		}

		// no intn: FallShort, Past, CompletelyInside
		return result.length === 0 ? null : result;
	}
}


class PlayerView {
	private pos_ = [0, 0, 0];
	private angleX_ = 0;
	private angleY_ = Math.PI;
	private rot_: sd.Float4;
	private dir_ = [0, 0, -1];
	private up_ = [0, 1, 0];
	private velocity_ = [0, 0, 0];
	private effectiveSpeed_ = 0;

	constructor(initialPos: sd.Float3, private clipLines: LineSeg[]) {
		vec3.copy(this.pos_, initialPos);
		this.rotate([0, 0]);
	}

	private clipMovement(a: sd.Float3, b: sd.Float3): sd.Float3 {
		const posXZ = [b[0], b[2]];
		for (const cl of this.clipLines) {
			const ip = intersectCircleLineSeg(posXZ, .25, cl);
			if (ip) {
				if (ip.length == 2) {
					const center = vec2.lerp([], ip[0], ip[1], .5);
					const pdir = vec2.sub([], posXZ, center);
					const pen = .25 / vec2.length(pdir);
					vec2.scaleAndAdd(posXZ, posXZ, pdir, pen - 1);
				}
			}
		}

		// reconstruct 3d pos
		return [posXZ[0], b[1], posXZ[1]];
	}

	update(timeStep: number, acceleration: number, sideAccel: number) {
		const fwdXZ = vec3.normalize([], [this.dir_[0], 0, this.dir_[2]]);
		const rightXZ = vec3.cross([], fwdXZ, [0, 1, 0]);

		vec3.scaleAndAdd(this.velocity_, this.velocity_, fwdXZ, acceleration * timeStep);
		vec3.scaleAndAdd(this.velocity_, this.velocity_, rightXZ, sideAccel * timeStep);

		if (vec3.length(this.velocity_) >= 0.001) {
			const targetPos = vec3.add([], this.pos_, this.velocity_);
			const clippedPos = this.clipMovement(this.pos, targetPos);
			vec3.sub(this.velocity_, clippedPos, this.pos_);
			vec3.copy(this.pos_, clippedPos);

			this.effectiveSpeed_ = vec3.length(this.velocity_);
		}

		vec3.scale(this.velocity_, this.velocity_, 0.85);
		if (vec3.length(this.velocity_) < 0.001) {
			vec3.set(this.velocity_, 0, 0, 0);
			this.effectiveSpeed_ = 0;
		}
	}

	rotate(localRelXY: sd.Float2) {
		this.angleX_ -= Math.PI * 1.3 * localRelXY[1];
		this.angleX_ = math.clamp(this.angleX_, -Math.PI * 0.27, Math.PI * 0.21);
		this.angleY_ += Math.PI * 1.8 * localRelXY[0];
		this.rot_ = quat.fromEuler(0, this.angleY_, this.angleX_);
		vec3.transformQuat(this.dir_, [0, 0, 1], this.rot_);
		vec3.normalize(this.dir_, this.dir_);
		vec3.transformQuat(this.up_, [0, 1, 0], this.rot_);
		vec3.normalize(this.up_, this.up_);
	}

	get pos() { return this.pos_; }
	get posXZ() { return [this.pos_[0], this.pos_[2]]; }
	get dir() { return this.dir_; }
	get dirXZ() { return [this.dir_[0], this.dir_[2]]; }
	get rotation() { return this.rot_; }
	get effectiveSpeed() { return this.effectiveSpeed_; }
	get focusPos() { return vec3.add([], this.pos_, this.dir_); }
	get viewMatrix() { return mat4.lookAt([], this.pos_, this.focusPos, this.up_); }
}


const enum KeyboardType {
	QWERTY,
	QWERTZ,
	AZERTY
}


const enum KeyCommand {
	Forward,
	Backward,
	Left,
	Right,
	Interact
}


class PlayerController {
	view: PlayerView;
	private vpWidth_: number;
	private vpHeight_: number;
	private tracking_ = false;
	private lastPos_ = [0, 0];
	private curQuad = Quadrant.Bottom;
	private keyboardType_ = KeyboardType.QWERTY;

	constructor(sensingElem: HTMLElement, initialPos: sd.Float3, private scene: world.Scene, private level: Level, private sfx: Sound) {
		this.view = new PlayerView(initialPos, level.clipLines);

		this.vpWidth_ = sensingElem.offsetWidth;
		this.vpHeight_ = sensingElem.offsetHeight;

		// -- mouse based rotation
		dom.on(sensingElem, "mousedown", (evt: MouseEvent) => {
			this.tracking_ = true;
			this.lastPos_ = [evt.clientX, evt.clientY];
		});

		dom.on(window, "mousemove", (evt: MouseEvent) => {
			if (this.restrictMovement) {
				return;
			}
			if (!this.tracking_) {
				return;
			}
			var newPos = [evt.clientX, evt.clientY];
			var delta = vec2.sub([], newPos, this.lastPos_);
			vec2.divide(delta, delta, [-this.vpWidth_, -this.vpHeight_]);
			this.lastPos_ = newPos;

			this.view.rotate(delta);
		});

		dom.on(window, "mouseup", (evt: MouseEvent) => {
			this.tracking_ = false;
		});
	}


	private keyForKeyCommand(cmd: KeyCommand): io.Key {
		let keys: io.Key[] | undefined;
		switch (cmd) {
			case KeyCommand.Forward:
				keys = [io.Key.W, io.Key.W, io.Key.Z];
				break;
			case KeyCommand.Backward:
				keys = [io.Key.S, io.Key.S, io.Key.S];
				break;
			case KeyCommand.Left:
				keys = [io.Key.A, io.Key.A, io.Key.Q];
				break;
			case KeyCommand.Right:
				keys = [io.Key.D, io.Key.D, io.Key.D];
				break;
			case KeyCommand.Interact:
				keys = [io.Key.E, io.Key.E, io.Key.E];
				break;
		}

		return keys ? keys[this.keyboardType_] : 0;
	}


	private stepSoundTimer_ = -1;

	handleStepSounds() {
		if (this.view.effectiveSpeed > 0.01) {
			if (this.stepSoundTimer_ == -1) {
				this.stepSoundTimer_ = setInterval(() => { this.sfx.play(SFX.FootStep); }, 500);
			}
		}
		else {
			if (this.stepSoundTimer_ > -1) {
				clearInterval(this.stepSoundTimer_);
				this.stepSoundTimer_ = -1;
			}
		}
	}


	openExit() {
		this.scene.lightMgr.setEnabled(this.level.spotExit, true);
		this.scene.pbrModelMgr.setShadowCaster(this.level.spotExit);
		this.sfx.play(SFX.DoorOpen);
		this.doorOpenStart = Date.now();
	}


	private solvedLeft = false;
	private solvedRight = false;
	private endGame = false;
	private doorOpenStart = 0;

	setPoweredQuadrant(q: Quadrant) {
		if (this.endGame) {
			return;
		}

		let orbsOff: Orb[] | undefined = this.level.orbs[this.curQuad];
		let orbsOn: Orb[] | undefined = this.level.orbs[q];
		let spotOff: world.LightInstance | undefined;
		let spotOn: world.LightInstance | undefined;
		switch (this.curQuad) {
			case Quadrant.Bottom: break;
			case Quadrant.Left:
				spotOff = this.level.spotLeft; this.sequenceLeft = [];
				break;
			case Quadrant.Right:
				spotOff = this.level.spotRight; this.sequenceRight = [];
				break;
			case Quadrant.Top:
				spotOff = this.level.spotBack;
				break;
		}
		this.curQuad = q;
		switch (this.curQuad) {
			case Quadrant.Bottom: break;
			case Quadrant.Left: spotOn = this.level.spotLeft; break;
			case Quadrant.Right: spotOn = this.level.spotRight; break;
			case Quadrant.Top: spotOn = this.level.spotBack; break;
		}

		if (this.solvedLeft && this.solvedRight) {
			spotOn = undefined;
			orbsOn = undefined;
			this.endGame = true;
			this.sfx.stopMusic();
			for (const g of this.level.glowers) {
				this.scene.lightMgr.setEnabled(g.light, false);
				this.scene.pbrModelMgr.materialManager.setEmissiveIntensity(g.mat, 0);
			}

			setTimeout(() => { this.openExit(); }, 2500);
		}
		else {
			if (q == Quadrant.Left && this.solvedLeft) {
				spotOn = undefined;
				orbsOn = undefined;
			}
			if (q == Quadrant.Right && this.solvedRight) {
				spotOn = undefined;
				orbsOn = undefined;
			}
		}

		if (spotOff) {
			if (this.scene.lightMgr.enabled(spotOff)) {
				this.scene.lightMgr.setEnabled(spotOff, false);
			}
			else {
				spotOff = undefined;
			}
		}
		if (orbsOff) {
			for (const o of orbsOff) {
				this.scene.pbrModelMgr.materialManager.setEmissiveIntensity(o.pbrMat, 0);
			}
		}
		if (spotOn) {
			this.scene.lightMgr.setEnabled(spotOn, true);
			this.scene.pbrModelMgr.setShadowCaster(spotOn);
			this.sfx.play(SFX.LightOn);
		}
		else {
			this.scene.pbrModelMgr.setShadowCaster(0);
			if (spotOff) {
				this.sfx.play(SFX.LightOff);
			}
		}
		if (orbsOn) {
			for (const o of orbsOn) {
				this.scene.pbrModelMgr.materialManager.setEmissiveIntensity(o.pbrMat, 0.20);
			}
		}
	}

	hoverOrb: Orb | null = null;
	lastInteract = 0;
	sequenceLeft: number[] = [];
	sequenceRight: number[] = [];
	restrictMovement = false;

	step(timeStep: number) {
		const maxAccel = 0.66;
		var accel = 0, sideAccel = 0;

		if (io.keyboard.down(io.Key.UP) || io.keyboard.down(this.keyForKeyCommand(KeyCommand.Forward))) {
			accel = maxAccel;
		}
		else if (io.keyboard.down(io.Key.DOWN) || io.keyboard.down(this.keyForKeyCommand(KeyCommand.Backward))) {
			accel = -maxAccel;
		}
		if (io.keyboard.down(io.Key.LEFT) || io.keyboard.down(this.keyForKeyCommand(KeyCommand.Left))) {
			sideAccel = -maxAccel;
		}
		else if (io.keyboard.down(io.Key.RIGHT) || io.keyboard.down(this.keyForKeyCommand(KeyCommand.Right))) {
			sideAccel = maxAccel;
		}

		if (! this.restrictMovement) {
			this.view.update(timeStep, accel, sideAccel);
			this.handleStepSounds();
		}
		else {
			if (this.stepSoundTimer_ > -1) {
				clearInterval(this.stepSoundTimer_);
				this.stepSoundTimer_ = -1;
			}
		}


		if (this.endGame) {
			if (this.doorOpenStart > 0) {
				const lapsed = math.clamp(Date.now() - this.doorOpenStart, 0, 10000);
				const doorY = 1.5 - (3 * (lapsed / 10000));
				this.scene.transformMgr.setPosition(this.level.finalDoor.transform, [-0.25, doorY, 10.001]);

				if (lapsed == 10000) {
					this.doorOpenStart = 0;
					this.level.clipLines.pop(); // open door
				}
			}

			if (this.view.pos[2] > 10.75) {
				if (! this.restrictMovement) {
					this.restrictMovement = true;
					this.sfx.play(SFX.Swoosh);
					setTimeout(() => {
						dom.show(".titles");
						this.sfx.setEndMusic();
						this.sfx.startMusic();
					}, 3050);
				}
			}

			return;
		}

		// positional interaction
		const quadrant = this.level.positionQuadrant(this.view.pos);
		if (quadrant != this.curQuad) {
			this.setPoweredQuadrant(quadrant);
		}

		// physical interaction
		const now = Date.now();
		const posXZ = this.view.posXZ;
		const reachXZ = vec2.scale([], this.view.dirXZ, 2.3);
		const touchXZ = vec2.add([], posXZ, reachXZ);
		const arm: LineSeg = [posXZ[0], posXZ[1], touchXZ[0], touchXZ[1]];

		let anyHover = false;
		for (const orbQ of this.level.orbs) {
			for (const orb of orbQ) {
				const owp = this.scene.transformMgr.worldPosition(orb.transform);
				const cp = intersectCircleLineSeg([owp[0], owp[2]], .3, arm);
				if (cp) {
					if ((orb.quadrant == Quadrant.Left && this.solvedLeft) || (orb.quadrant == Quadrant.Right && this.solvedRight)) {
						this.scene.pbrModelMgr.materialManager.setEmissiveIntensity(orb.pbrMat, 0);
						continue;
					}

					anyHover = true;
					if (this.hoverOrb != orb) {
						if (this.hoverOrb) {
							this.scene.pbrModelMgr.materialManager.setEmissiveIntensity(this.hoverOrb.pbrMat, 0.20);
						}
						this.hoverOrb = orb;
						this.scene.pbrModelMgr.materialManager.setEmissiveIntensity(orb.pbrMat, 0.5);
					}
					else {
							const timeSinceTap = Date.now() - this.lastInteract;
							if (timeSinceTap < 1000) {
								const shine = 1 - (timeSinceTap / 1000) * .5;
								this.scene.pbrModelMgr.materialManager.setEmissiveIntensity(orb.pbrMat, shine);
							}
					}
				}
			}
		}

		if (!anyHover && this.hoverOrb) {
			this.scene.pbrModelMgr.materialManager.setEmissiveIntensity(this.hoverOrb.pbrMat, 0.20);
			this.hoverOrb = null;
		}

		if (io.keyboard.pressed(this.keyForKeyCommand(KeyCommand.Interact)) && this.hoverOrb) {
			this.lastInteract = Date.now();
			this.sfx.play(SFX.ToneA + this.hoverOrb.index);

			if (this.hoverOrb.quadrant == Quadrant.Left) {
				this.sequenceLeft.push(this.hoverOrb.index);
				if (this.sequenceLeft.length > 8) {
					this.sequenceLeft.shift();
				}
				if (this.sequenceLeft.toString() === this.level.checkOrderLeft.toString()) {
					this.solvedLeft = true;
					this.setPoweredQuadrant(this.hoverOrb.quadrant);
				}
			}
			else if (this.hoverOrb.quadrant == Quadrant.Right) {
				this.sequenceRight.push(this.hoverOrb.index);
				if (this.sequenceRight.length > 8) {
					this.sequenceRight.shift();
				}
				if (this.sequenceRight.toString() === this.level.checkOrderRight.toString()) {
					this.solvedRight = true;
					this.setPoweredQuadrant(this.hoverOrb.quadrant);
				}
			}

		}
	}
}
