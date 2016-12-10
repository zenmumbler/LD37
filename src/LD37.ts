// Unknown, a Ludum Dare 37 Entry
// (c) 2016 by Arthur Langereis (@zenmumbler)

/// <reference path="../../stardazed-tx/dist/stardazed-tx.d.ts" />
/// <reference path="flycam.ts" />
/// <reference path="assets.ts" />

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
	End
}


const enum KeyCommand {
	DooEet
}


class MainScene implements sd.SceneController {
	private scene_: world.Scene;
	private assets_: Assets;

	private flyCam_: FlyCamController;

	private mode_ = GameMode.None;


	constructor(private rc: render.RenderContext, private ac: audio.AudioContext) {
		this.scene_ = new world.Scene(rc);
		// this.sfx_ = new Sound(ac);

		this.flyCam_ = new FlyCamController(rc.gl.canvas, [0, 2, 5]);

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

		const progress = (ratio: number) => {
			dom.$1(".progress").style.width = (ratio * 100) + "%";
		};

		loadAllAssets(rc, ac, scene.meshMgr, progress).then(assets => {
			const mat = asset.makeMaterial("floor");
			mat.roughness = 0.4;
			console.info("ASSETS", assets);
			this.assets_ = assets;

			scene.makeEntity({
				transform: {
					position: [1.2, 0, 1.2]
				},
				mesh: {
					name: "cube",
					meshData: meshdata.gen.generate(new meshdata.gen.Box({ width: 2, depth: 2, height: 2, inward: false }))
				},
				pbrModel: {
					materials: [assets.mat.chipmetal]
				}
			});
			scene.makeEntity({
				transform: {
					position: [-1.2, 0, -1.2]
				},
				mesh: {
					name: "sphere",
					meshData: meshdata.gen.generate(new meshdata.gen.Sphere({ radius: 1, rows: 20, segs: 30 }))
				},
				pbrModel: {
					materials: [assets.mat.medmetal]
				}
			});
			scene.makeEntity({
				transform: {
					position: [0, -1, 0],
					// rotation: quat.fromEuler(0, 0, Math.PI / 2)
				},
				mesh: {
					name: "floor2",
					meshData: meshdata.gen.generate(new meshdata.gen.Plane({ width: 8, depth: 8, rows: 2, segs: 2 }))
				},
				pbrModel: {
					materials: [mat]
				}
			});

			const l1 = scene.makeEntity({
				transform: { position: [2, 3, 2] },
				light: {
					name: "point",
					type: asset.LightType.Point,
					intensity: 2,
					range: 8,
					colour: [0, 1, 1],
				}
			});
			const l2 = scene.makeEntity({
				transform: { position: [-2, 3, 2] },
				light: {
					name: "point",
					type: asset.LightType.Point,
					intensity: 2,
					range: 8,
					colour: [1, 0, 1],
				}
			});
			const l3 = scene.makeEntity({
				transform: { position: [2, 3, -2] },
				light: {
					name: "point",
					type: asset.LightType.Point,
					intensity: 2,
					range: 8,
					colour: [1, 1, 0],
				}
			});
			scene.pbrModelMgr.setActiveLights([l1.light!, l2.light!, l3.light!], -1);

			this.setMode(GameMode.Title);
		});
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
		if (newMode != GameMode.Loading) {
			dom.hide(".loading");
		}
		dom.hide(".titles");
		dom.show("#stage");

		this.mode_ = newMode;
	}


	renderFrame(timeStep: number) {
		if (this.mode_ < GameMode.Title) {
			return;
		}

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

		render.runRenderPass(this.rc, this.scene_.meshMgr, rpdMain, null, (renderPass) => {
			let camera: world.ProjectionSetup = {
				projectionMatrix: mat4.perspective([], math.deg2rad(50), this.rc.gl.drawingBufferWidth / this.rc.gl.drawingBufferHeight, 0.1, 100),
				viewMatrix: this.flyCam_.cam.viewMatrix // this.playerController_.viewMatrix
			};

			this.scene_.lightMgr.prepareLightsForRender(this.scene_.lightMgr.all(), camera, renderPass.viewport()!);
			this.scene_.pbrModelMgr.updateLightData(this.scene_.lightMgr);

			renderPass.setDepthTest(render.DepthTest.Less);
			renderPass.setFaceCulling(render.FaceCulling.Back);

			// this.scene_.stdModelMgr.draw(this.scene_.stdModelMgr.all(), renderPass, camera, null, null, world.RenderMode.Forward);
			this.scene_.pbrModelMgr.draw(this.scene_.pbrModelMgr.all(), renderPass, camera, world.PBRLightingQuality.CookTorrance, this.assets_.tex.envCubeSpace);
		});

	}


	simulationStep(timeStep: number) {
		const txm = this.scene_.transformMgr;
		this.flyCam_.step(timeStep);
	}
}


dom.on(window, "load", () => {
	// -- create managers
	const canvas = <HTMLCanvasElement>document.getElementById("stage");
	const rctx = render.makeRenderContext(canvas)!;
	const actx = audio.makeAudioContext()!;

	const mainCtl = new MainScene(rctx, actx);
	sd.defaultRunLoop.sceneController = mainCtl;
	sd.defaultRunLoop.start();
});
