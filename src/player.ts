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

	constructor(initialPos: sd.Float3) {
		vec3.copy(this.pos_, initialPos);
		this.rotate([0, 0]);
	}

	update(timeStep: number, acceleration: number, sideAccel: number) {
		this.speed_ += timeStep * acceleration;
		this.sideSpeed_ += timeStep * sideAccel;

		const dirXZ = vec3.normalize([], [this.dir_[0], 0, this.dir_[2]]);

		vec3.scaleAndAdd(this.pos_, this.pos_, dirXZ, this.speed_);
		var right = vec3.cross([], dirXZ, [0, 1, 0]);
		vec3.scaleAndAdd(this.pos_, this.pos_, right, this.sideSpeed_);

		this.speed_ *= 0.9;
		if (Math.abs(this.speed_) < 0.001) {
			this.speed_ = 0;
		}
		this.sideSpeed_ *= 0.9;
		if (Math.abs(this.sideSpeed_) < 0.001) {
			this.sideSpeed_ = 0;
		}
	}

	rotate(localRelXY: sd.Float2) {
		this.angleX_ -= Math.PI * 1.5 * localRelXY[1];
		this.angleX_ = math.clamp(this.angleX_, -Math.PI * 0.27, Math.PI * 0.21);
		this.angleY_ += Math.PI * 2 * localRelXY[0];
		this.rot_ = quat.fromEuler(0, this.angleY_, this.angleX_);
		vec3.transformQuat(this.dir_, [0, 0, 1], this.rot_);
		vec3.normalize(this.dir_, this.dir_);
		vec3.transformQuat(this.up_, [0, 1, 0], this.rot_);
		vec3.normalize(this.up_, this.up_);
	}

	get pos() { return this.pos_; }
	get dir() { return this.dir_; }
	get rotation() { return this.rot_; }
	get focusPos() { return vec3.add([], this.pos_, this.dir_); }
	get viewMatrix() { return mat4.lookAt([], this.pos_, this.focusPos, this.up_); }
}


const enum KeyCommand {
	DooEet
}


class PlayerController {
	view: PlayerView;
	private vpWidth_: number;
	private vpHeight_: number;
	private tracking_ = false;
	private lastPos_ = [0, 0];

	constructor(sensingElem: HTMLElement, initialPos: sd.Float3, private level: Level, private sfx: Sound) {
		this.view = new PlayerView(initialPos);

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

	step(timeStep: number) {
		const maxAccel = 0.8;
		var accel = 0, sideAccel = 0;

		if (io.keyboard.down(io.Key.UP) || io.keyboard.down(io.Key.W)) {
			accel = maxAccel;
		}
		else if (io.keyboard.down(io.Key.DOWN) || io.keyboard.down(io.Key.S)) {
			accel = -maxAccel;
		}
		if (io.keyboard.down(io.Key.LEFT) || io.keyboard.down(io.Key.A)) {
			sideAccel = -maxAccel;
		}
		else if (io.keyboard.down(io.Key.RIGHT) || io.keyboard.down(io.Key.D)) {
			sideAccel = maxAccel;
		}

		this.view.update(timeStep, accel, sideAccel);
	}
}
