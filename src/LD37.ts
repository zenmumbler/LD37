// Unknown, a Ludum Dare 37 Entry
// (c) 2016 by Arthur Langereis (@zenmumbler) and Brian J. Miller (@mokumgames)

/// <reference path="../../stardazed-tx/dist/stardazed-tx.d.ts" />
/// <reference path="flycam.ts" />

import io = sd.io;
import math = sd.math;
import world = sd.world;
import render = sd.render;
import meshdata = sd.meshdata;
import dom = sd.dom;
import asset = sd.asset;
import container = sd.container;
import audio = sd.audio;

import vec2 = veclib.vec2;
import vec3 = veclib.vec3;
import vec4 = veclib.vec4;
import quat = veclib.quat;
import mat2 = veclib.mat2;
import mat3 = veclib.mat3;
import mat4 = veclib.mat4;

const enum GameMode {
	None,
	Loading,
	Title,
	Start,
	Main,
	Shift,
	End
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
	Use
}


class MainScene implements sd.SceneController {
	private scene_: world.Scene;

	private flyCam_: FlyCamController;

	private mousePosRel_ = [0.5, 0.5];
	private mode_ = GameMode.None;
	private keyboardType_ = KeyboardType.QWERTY;


	constructor(private rc: render.RenderContext, private ac: audio.AudioContext) {
		this.scene_ = new world.Scene(rc);
		// this.sfx_ = new Sound(ac);

		this.flyCam_ = new FlyCamController(rc.gl.canvas, [9, 1.3, 17]);

		this.setMode(GameMode.Loading);
		this.createScene();
	}


	createScene() {
		const scene = this.scene_;
		const modm = scene.stdModelMgr;
		const ltm = scene.lightMgr;
		const clm = scene.colliderMgr;
		const rc = this.rc;
		const ac = this.ac;

	}


	resume() {
		if (this.mode_ >= GameMode.Title) {
			// this.sfx_.startMusic();
		}
	}


	suspend() {
		if (this.mode_ >= GameMode.Title) {
			// this.sfx_.stopMusic();
		}
	}


	setMode(newMode: GameMode) {
		dom.hide(".loading");
		dom.hide(".titles");


		this.mode_ = newMode;
	}


	renderFrame(timeStep: number) {
		/*
		// -- shadow pass
		let spotShadow: world.ShadowView | null = null;

		if (render.canUseShadowMaps(this.rc)) {
			let rpdShadow = render.makeRenderPassDescriptor();
			rpdShadow.clearMask = render.ClearMask.Depth;

			spotShadow = this.scene_.lightMgr.shadowViewForLight(this.rc, this.spotLight_.light, .1);

			render.runRenderPass(this.rc, this.scene_.meshMgr, rpdShadow, spotShadow.shadowFBO, (renderPass) => {
				this.scene_.stdModelMgr.draw(this.scene_.stdModelMgr.all(), renderPass, spotShadow.lightProjection, null, null, world.RenderMode.Shadow);
			});
		}
		*/

		// -- main forward pass
		let rpdMain = render.makeRenderPassDescriptor();
		vec4.set(rpdMain.clearColour, 0, 0, 0, 1);
		rpdMain.clearMask = render.ClearMask.ColourDepth;

		false && render.runRenderPass(this.rc, this.scene_.meshMgr, rpdMain, null, (renderPass) => {
			let camera: world.ProjectionSetup = {
				projectionMatrix: mat4.perspective([], math.deg2rad(50), this.rc.gl.drawingBufferWidth / this.rc.gl.drawingBufferHeight, 0.1, 100),
				viewMatrix: [] // this.playerController_.viewMatrix
			};

			this.scene_.lightMgr.prepareLightsForRender(this.scene_.lightMgr.all(), camera, renderPass.viewport()!);

			renderPass.setDepthTest(render.DepthTest.Less);
			renderPass.setFaceCulling(render.FaceCulling.Back);

		});

	}


	simulationStep(timeStep: number) {
		const txm = this.scene_.transformMgr;
	}
}


dom.on(window, "load", () => {
	// -- create managers
	const canvas = <HTMLCanvasElement>document.getElementById("stage");
	const rctx = render.makeRenderContext(canvas)!;
	const actx = audio.makeAudioContext()!;

	var testCtl = new MainScene(rctx, actx);
	sd.defaultRunLoop.sceneController = testCtl;
	sd.defaultRunLoop.start();
});
