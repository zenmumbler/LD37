// Callisto, a Ludum Dare 37 Entry
// (c) 2016 by Arthur Langereis (@zenmumbler)

/// <reference path="levelgen.ts" />

class PlayerView {
	private pos_ = [0, 0, 0];
	private angleX_ = 0;
	private angleY_ = Math.PI;
	private rot_: sd.Float4;
	private dir_ = [0, 0, -1];
	private up_ = [0, 1, 0];
	private speed_ = 0;
	private sideSpeed_ = 0;
	private effectiveSpeed_ = 0;

	constructor(initialPos: sd.Float3, private clipLines: ClipLine[]) {
		vec3.copy(this.pos_, initialPos);
		this.rotate([0, 0]);
	}

	private clipMovement(a: sd.Float3, b: sd.Float3): sd.Float3 {
		return b;
	}

	update(timeStep: number, acceleration: number, sideAccel: number) {
		this.speed_ += timeStep * acceleration;
		this.sideSpeed_ += timeStep * sideAccel;

		const dirXZ = vec3.normalize([], [this.dir_[0], 0, this.dir_[2]]);

		const fwdVel = vec3.scale([], dirXZ, this.speed_);
		const right = vec3.cross([], dirXZ, [0, 1, 0]);
		const sideVel = vec3.scale([], right, this.sideSpeed_);

		const sumVel = vec3.add([], fwdVel, sideVel);
		if (vec3.length(sumVel) > 0.001) {
			const effectiveVel = vec3.scale([], vec3.normalize([], sumVel), Math.max(Math.abs(this.speed_), Math.abs(this.sideSpeed_)));
			const targetPos = vec3.add([], this.pos_, effectiveVel);
			const clippedPos = this.clipMovement(this.pos, targetPos);
			const clippedVel = vec3.sub([], clippedPos, this.pos_);
			vec3.copy(this.pos_, clippedPos);

			this.effectiveSpeed_ = vec3.length(clippedVel);
		}
		else {
			this.effectiveSpeed_ = 0;
		}

		this.speed_ *= 0.85;
		if (Math.abs(this.speed_) < 0.001) {
			this.speed_ = 0;
		}
		this.sideSpeed_ *= 0.85;
		if (Math.abs(this.sideSpeed_) < 0.001) {
			this.sideSpeed_ = 0;
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
	get dir() { return this.dir_; }
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
	private keyboardType_ = KeyboardType.QWERTY;


	constructor(sensingElem: HTMLElement, initialPos: sd.Float3, private level: Level, private sfx: Sound) {
		this.view = new PlayerView(initialPos, level.clipLines);

		this.vpWidth_ = sensingElem.offsetWidth;
		this.vpHeight_ = sensingElem.offsetHeight;

		// -- mouse based rotation
		dom.on(sensingElem, "mousedown", (evt: MouseEvent) => {
			this.tracking_ = true;
			this.lastPos_ = [evt.clientX, evt.clientY];
		});

		dom.on(window, "mousemove", (evt: MouseEvent) => {
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

		this.view.update(timeStep, accel, sideAccel);
		this.handleStepSounds();
	}
}
