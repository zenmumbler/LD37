// Callisto, a Ludum Dare 37 Entry
// (c) 2016 by Arthur Langereis (@zenmumbler)

/// <reference path="../../stardazed-tx/dist/stardazed-tx.d.ts" />
/// <reference path="flycam.ts" />
/// <reference path="assets.ts" />
/// <reference path="levelgen.ts" />
/// <reference path="sfx.ts" />

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


class MainScene implements sd.SceneController {
	private scene_: world.Scene;
	private assets_: Assets;
	private sfx_: Sound;
	private level_: Level;

	private skyBox_: world.Skybox;
	private glowLight_: world.EntityInfo;

	private player_: PlayerController;
	private mode_ = GameMode.None;


	constructor(private rc: render.RenderContext, private ac: audio.AudioContext) {
		this.scene_ = new world.Scene(rc);
		this.sfx_ = new Sound(ac);

		this.setMode(GameMode.Loading);

		const progress = (ratio: number) => {
			dom.$1(".progress").style.width = (ratio * 100) + "%";
		};

		loadAllAssets(rc, ac, this.scene_.meshMgr, progress).then(assets => {
			this.assets_ = assets;
			this.sfx_.setAssets(assets.sound);
			console.info("ASSETS", assets);

			this.makeSkybox();

			this.level_ = new Level(rc, ac, assets, this.scene_);
			this.level_.generate().then(() => {
				const sun = this.scene_.makeEntity({
					transform: { position: [0, 1, .3] },
					light: {
						name: "sun",
						colour: [.7, .9, .8],
						type: asset.LightType.Directional,
						intensity: .2,
					}
				});
				this.scene_.lightMgr.setDirection(sun.light!, [0, 1, .1]);

				this.setMode(GameMode.Main);
			});
		});

	}

	makeSkybox() {
		const sb = this.scene_.makeEntity();
		this.skyBox_ = new world.Skybox(this.rc, this.scene_.transformMgr, this.scene_.meshMgr, this.assets_.tex.envCubeSpace);
		this.skyBox_.setEntity(sb.entity);
	}


	resume() {
		if (this.mode_ >= GameMode.Title) {
			if (! this.player_.endGame) {
				this.sfx_.startMusic();
			}
		}
	}


	suspend() {
		if (this.mode_ >= GameMode.Title) {
			this.sfx_.stopMusic();
		}
	}


	setMode(newMode: GameMode) {
		dom.hide(".loading");
		dom.hide(".titles");
		if (newMode == GameMode.Loading) {
			dom.show(".loading");
		}
		else if (newMode == GameMode.Title) {
			dom.show(".titles");
		}

		if (newMode !== GameMode.Loading) {
			dom.show("#stage");
			this.sfx_.startMusic();
			this.player_ = new PlayerController(this.rc.gl.canvas, [0, 1.5, 5], this.scene_, this.level_, this.sfx_);
		}

		this.mode_ = newMode;
	}


	renderFrame(timeStep: number) {
		if (this.mode_ < GameMode.Title) {
			return;
		}

		// -- shadow pass
		let spotShadow: world.ShadowView | null = null;
		const shadowCaster = this.scene_.pbrModelMgr.shadowCaster();
		const SHADOWS_ENABLED = true; // navigator.userAgent.indexOf("Safari") > -1 && navigator.userAgent.indexOf("Chrome") == -1 ; // still not working in other browsers

		if (SHADOWS_ENABLED && shadowCaster && render.canUseShadowMaps(this.rc)) {
			let rpdShadow = render.makeRenderPassDescriptor();
			rpdShadow.clearMask = render.ClearMask.ColourDepth;

			spotShadow = this.scene_.lightMgr.shadowViewForLight(this.rc, shadowCaster, .1);
			if (spotShadow) {
				render.runRenderPass(this.rc, this.scene_.meshMgr, rpdShadow, spotShadow.shadowFBO, (renderPass) => {
					this.scene_.pbrModelMgr.drawShadows(this.scene_.pbrModelMgr.all(), renderPass, spotShadow!.lightProjection);
				});
			}
		}

		// -- main forward pass
		let rpdMain = render.makeRenderPassDescriptor();
		vec4.set(rpdMain.clearColour, 0, 0, 0, 1);
		rpdMain.clearMask = render.ClearMask.ColourDepth;

		render.runRenderPass(this.rc, this.scene_.meshMgr, rpdMain, null, (renderPass) => {
			let camera: world.ProjectionSetup = {
				projectionMatrix: mat4.perspective([], math.deg2rad(50), this.rc.gl.drawingBufferWidth / this.rc.gl.drawingBufferHeight, 0.1, 100),
				viewMatrix: this.player_.view.viewMatrix
			};

			this.scene_.lightMgr.prepareLightsForRender(this.scene_.lightMgr.allEnabled(), camera, renderPass.viewport()!);

			renderPass.setDepthTest(render.DepthTest.Less);
			renderPass.setFaceCulling(render.FaceCulling.Back);

			this.scene_.pbrModelMgr.draw(this.scene_.pbrModelMgr.all(), renderPass, camera, spotShadow, world.PBRLightingQuality.CookTorrance, this.assets_.tex.reflectCubeSpace);

			this.skyBox_.draw(renderPass, camera);
		});
	}


	simulationStep(timeStep: number) {
		const txm = this.scene_.transformMgr;
		if (this.mode_ >= GameMode.Main) {
			this.player_.step(timeStep);

			if (this.skyBox_) {
				this.skyBox_.setCenter(this.player_.view.pos);
			}
		}
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
