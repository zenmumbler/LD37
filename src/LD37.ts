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

	private skyBox_: world.Skybox;
	private spotLight_: world.LightInstance;

	private mode_ = GameMode.None;


	constructor(private rc: render.RenderContext, private ac: audio.AudioContext) {
		this.scene_ = new world.Scene(rc);
		// this.sfx_ = new Sound(ac);

		this.flyCam_ = new FlyCamController(rc.gl.canvas, [0, 2, 5]);

		this.setMode(GameMode.Loading);
		this.createScene();
	}


	makeGlower(position: sd.Float3, radius: number) {
		this.scene_.makeEntity({
			transform: {
				position: position
			},
			mesh: {
				name: "sphere",
				meshData: meshdata.gen.generate(new meshdata.gen.Sphere({ radius: radius, rows: 20, segs: 30 }))
			},
			pbrModel: {
				materials: [this.assets_.mat.whitemarble]
			},
			light: {
				name: "spherelight1",
				type: asset.LightType.Point,
				intensity: 8,
				range: radius * 1.5,
				colour: [1, 1, 0.92]
			}
		});
	}

	generatePillarBlock(origin: sd.Float3, pillarDim: number, pillarHeight: number, width: number, depth: number, yVariance: number, uvRange: sd.Float2) {
		const tiles: meshdata.gen.TransformedMeshGen[] = [];
		const halfWidth = width * pillarDim / 2;
		const halfDepth = depth * pillarDim / 2;
		const oX = origin[0] - halfWidth;
		const oY = origin[1] - yVariance;
		const oZ = origin[2] - halfDepth;
		const yRange = yVariance * 2;

		let pZ = oZ;
		for (let tileZ = 0; tileZ < depth; ++tileZ) {
			let pX = oX;
			for (let tileX = 0; tileX < width; ++tileX) {
				const pY = oY + (Math.random() * yRange);
				tiles.push({
					translation: [pX, pY, pZ],
					generator: new meshdata.gen.Box({
						width: pillarDim, depth: pillarDim, height: pillarHeight,
						inward: false,
						uvRange: uvRange, uvOffset: vec2.multiply([], uvRange, [tileX, tileZ])
					})
				});
				pX += pillarDim;
			}
			pZ += pillarDim;
		}

		return meshdata.gen.generate(tiles, meshdata.AttrList.Pos3Norm3UV2());
	}

	makeSkybox() {
		const sb = this.scene_.makeEntity();
		this.skyBox_ = new world.Skybox(this.rc, this.scene_.transformMgr, this.scene_.meshMgr, this.assets_.tex.envCubeSpace);
		this.skyBox_.setEntity(sb.entity);
	}

	createScene() {
		const scene = this.scene_;
		const pbrm = scene.pbrModelMgr;
		const ltm = scene.lightMgr;
		const rc = this.rc;
		const ac = this.ac;

		const progress = (ratio: number) => {
			dom.$1(".progress").style.width = (ratio * 100) + "%";
		};

		loadAllAssets(rc, ac, scene.meshMgr, progress).then(assets => {
			console.info("ASSETS", assets);
			this.assets_ = assets;

			// -- skybox and global lights
			this.makeSkybox();

			const sun = scene.makeEntity({
				light: {
					name: "sun",
					type: asset.LightType.Directional,
					colour: [1, 1, 1],
					intensity: 1
				}
			});
			ltm.setDirection(sun.light!, [-1, -1, -1]);
			const sun2 = scene.makeEntity({
				light: {
					name: "sun2",
					type: asset.LightType.Directional,
					colour: [1, 1, 1],
					intensity: 1
				}
			});
			ltm.setDirection(sun2.light!, [1, -1, 1]);


			// -- floor and ceiling of main room
			const floor = scene.makeEntity({
				mesh: {
					name: "floor",
					meshData: this.generatePillarBlock([0, 0, 0], .5, .5, 40, 40, .05, [0.125, 0.125])
				},
				pbrModel: {
					materials: [assets.mat.bronzepatina]
				}
			});
			const ceiling = scene.makeEntity({
				mesh: {
					name: "ceil",
					meshData: this.generatePillarBlock([0, 10, 0], .5, 5, 40, 40, 3, [.5, 3])
				},
				pbrModel: {
					materials: [assets.mat.medmetal]
				}
			});


			// -- inner walls
			const cornerWalls: meshdata.gen.TransformedMeshGen[] = [];
			const hwalls: number[][] = [[-10, -10.5], [5, -10.5], [-10, 10], [5, 10]];
			const vwalls: number[][] = [[-10.5, -10], [10, -10], [-10.5, 5], [10, 5]];
			const cwalls: number[][] = [[-.25, -10.5], [-10.5, -0.25], [-.25, 10], [10, -.25]];
			for (let cwx = 0; cwx < 4; ++cwx) {
				cornerWalls.push({
					translation: [hwalls[cwx][0] + 2.25, 7.5, hwalls[cwx][1]],
					generator: new meshdata.gen.Box({ width: 5, depth: 0.5, height: 15, inward: false, uvRange: [5, 15] })
				});
				cornerWalls.push({
					translation: [vwalls[cwx][0], 7.5, vwalls[cwx][1] + 2.25],
					generator: new meshdata.gen.Box({ width: 0.5, depth: 5, height: 15, inward: false, uvRange: [5, 15] })
				});
				if ((cwx & 1) == 0) {
					cornerWalls.push({
						translation: [cwalls[cwx][0], 9, cwalls[cwx][1]],
						generator: new meshdata.gen.Box({ width: 10, depth: 0.5, height: 12, inward: false, uvRange: [11, 12], uvOffset: [-1, 0] })
					});
				}
				else {
					cornerWalls.push({
						translation: [cwalls[cwx][0], 9, cwalls[cwx][1]],
						generator: new meshdata.gen.Box({ width: 0.5, depth: 10, height: 12, inward: false, uvRange: [11, 12], uvOffset: [-1, 0] })
					});
				}
			}
			const corners = scene.makeEntity({
				mesh: {
					name: "corners",
					meshData: meshdata.gen.generate(cornerWalls)
				},
				pbrModel: {
					materials: [assets.mat.chipmetal]
				}
			});

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

		// -- shadow pass
		let spotShadow: world.ShadowView | null = null;
		const shadowCaster = this.scene_.pbrModelMgr.shadowCaster();

		if (shadowCaster && render.canUseShadowMaps(this.rc)) {
			let rpdShadow = render.makeRenderPassDescriptor();
			rpdShadow.clearMask = render.ClearMask.Depth;

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
				viewMatrix: this.flyCam_.cam.viewMatrix // this.playerController_.viewMatrix
			};

			this.scene_.lightMgr.prepareLightsForRender(this.scene_.lightMgr.all(), camera, renderPass.viewport()!);

			renderPass.setDepthTest(render.DepthTest.Less);
			renderPass.setFaceCulling(render.FaceCulling.Back);

			this.scene_.pbrModelMgr.draw(this.scene_.pbrModelMgr.all(), renderPass, camera, spotShadow, world.PBRLightingQuality.CookTorrance, this.assets_.tex.reflectCubeSpace);

			this.skyBox_.draw(renderPass, camera);
		});
	}


	simulationStep(timeStep: number) {
		const txm = this.scene_.transformMgr;
		this.flyCam_.step(timeStep);

		if (this.skyBox_) {
			this.skyBox_.setCenter(this.flyCam_.cam.pos);
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
