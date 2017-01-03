// Callisto, a Ludum Dare 37 Entry
// (c) 2016 by Arthur Langereis (@zenmumbler)

/// <reference path="../../stardazed-tx/dist/stardazed-tx.d.ts" />
/// <reference path="assets.ts" />
/// <reference path="levelgen.ts" />
/// <reference path="sfx.ts" />

interface Element {
	mozRequestFullScreen(): void;
}

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


interface FSQPipeline {
	pipeline: render.Pipeline;
	texUniform: WebGLUniformLocation;
}

function makeFSQPipeline(rc: render.RenderContext) {
	const pfp = {} as FSQPipeline;

	const vertexSource = `
		attribute vec2 vertexPos_model;
		varying vec2 vertexUV_intp;
		void main() {
			gl_Position = vec4(vertexPos_model, 0.5, 1.0);
			vertexUV_intp = vertexPos_model * 0.5 + 0.5;
		}
	`.trim();

	const fragmentSource = `
		precision highp float;
		varying vec2 vertexUV_intp;
		uniform sampler2D texSampler;
		void main() {
			vec3 texColor = texture2D(texSampler, vertexUV_intp).xyz;
			gl_FragColor = vec4(texColor, 1.0);
		}
	`.trim();

	// -- pipeline
	const pld = render.makePipelineDescriptor();
	pld.colourPixelFormats[0] = render.PixelFormat.RGBA32F;
	pld.vertexShader = render.makeShader(rc, rc.gl.VERTEX_SHADER, vertexSource);
	pld.fragmentShader = render.makeShader(rc, rc.gl.FRAGMENT_SHADER, fragmentSource);
	pld.attributeNames.set(meshdata.VertexAttributeRole.Position, "vertexPos_model");

	pfp.pipeline = new render.Pipeline(rc, pld);
	pfp.texUniform = rc.gl.getUniformLocation(pfp.pipeline.program, "texSampler")!;

	// -- invariant uniform
	pfp.pipeline.bind();
	rc.gl.uniform1i(pfp.texUniform, 0);
	pfp.pipeline.unbind();

	return pfp;
}

function drawFSQ(rc: render.RenderContext, meshMgr: world.MeshManager, tex: render.Texture, p: FSQPipeline, m: world.MeshInstance) {
	const rpd = render.makeRenderPassDescriptor();
	rpd.clearMask = render.ClearMask.Colour;

	render.runRenderPass(rc, meshMgr, rpd, null, (rp) => {
		rp.setPipeline(p.pipeline);
		rp.setTexture(tex, 0);
		rp.setMesh(m);
		rp.setDepthTest(render.DepthTest.Disabled);

		// render quad without any transforms, filling full FB
		const primGroup0 = meshMgr.primitiveGroups(m)[0];
		rp.drawIndexedPrimitives(primGroup0.type, meshMgr.indexBufferElementType(m), 0, primGroup0.elementCount);
	});
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
					light: {
						name: "sun",
						colour: [.5, .9, .5],
						type: asset.LightType.Directional,
						intensity: .03,
					}
				});
				this.scene_.lightMgr.setDirection(sun.light!, [0, 1, .1]);

				this.setMode(GameMode.Main);

				dom.on("#fullscreen", "click", () => {
					if (this.mode_ == GameMode.Main) {
						const canvas = rc.gl.canvas;
						(canvas.requestFullscreen || canvas.webkitRequestFullscreen || canvas.mozRequestFullScreen).call(canvas);
					}
				});

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

	fullQuad: world.MeshInstance = 0;
	quadPipeline?: FSQPipeline;

	SHADOW = true;
	SHADQUAD = false;

	downsample128: render.FilterPass;
	downsample64: render.FilterPass;
	boxFilter: render.FilterPass;
	fxaaPass: render.FXAAPass;
	mainFBO: render.FrameBuffer | undefined;
	antialias = false;

	renderFrame(timeStep: number) {
		if (this.mode_ < GameMode.Title) {
			return;
		}

		if (! this.downsample128) {
			this.downsample128 = render.resamplePass(this.rc, this.scene_.meshMgr, 512);
			this.downsample64 = render.resamplePass(this.rc, this.scene_.meshMgr, 256);
			this.boxFilter = render.boxFilterPass(this.rc, this.scene_.meshMgr, 256);
		}

		let mainPassFBO: render.FrameBuffer | null = null;
		if (this.antialias) {
			if (! this.fxaaPass) {
				this.fxaaPass = new render.FXAAPass(this.rc, this.scene_.meshMgr);
			}
			if (! this.mainFBO) {
				this.mainFBO = render.makeScreenFrameBuffer(this.rc, {
					colourCount: 1,
					useDepth: true,
					pixelComponent: render.FBOPixelComponent.Integer
				});
			}
			mainPassFBO = this.mainFBO;
		}

		// -- shadow pass
		let spotShadow: world.ShadowView | null = null;
		const shadowCaster = this.scene_.pbrModelMgr.shadowCaster();

		if (this.SHADOW && shadowCaster && render.canUseShadowMaps(this.rc)) {
			let rpdShadow = render.makeRenderPassDescriptor();
			rpdShadow.clearMask = render.ClearMask.ColourDepth;
			vec4.set(rpdShadow.clearColour, 1, 1, 1, 1);

			spotShadow = this.scene_.lightMgr.shadowViewForLight(this.rc, shadowCaster, .1);
			if (spotShadow) {
				render.runRenderPass(this.rc, this.scene_.meshMgr, rpdShadow, spotShadow.shadowFBO, (renderPass) => {
					renderPass.setDepthTest(render.DepthTest.Less);
					this.scene_.pbrModelMgr.drawShadows(this.scene_.pbrModelMgr.all(), renderPass, spotShadow!.lightProjection);
				});

				//  filter shadow tex and set as source for shadow calcs
				this.downsample128.apply(this.rc, this.scene_.meshMgr, spotShadow.shadowFBO.colourAttachmentTexture(0)!);
				this.downsample64.apply(this.rc, this.scene_.meshMgr, this.downsample128.output);
				this.boxFilter.apply(this.rc, this.scene_.meshMgr, this.downsample64.output);
				spotShadow.filteredTexture = this.boxFilter.output;

				if (this.fullQuad === 0) {
					const quad = meshdata.gen.generate(new meshdata.gen.Quad(2, 2), [meshdata.attrPosition2(), meshdata.attrUV2()]);
					this.fullQuad = this.scene_.meshMgr.create({ name: "squareQuad", meshData: quad });
					this.quadPipeline = makeFSQPipeline(this.rc);
				}

				if (this.SHADQUAD) {
					drawFSQ(this.rc, this.scene_.meshMgr, this.boxFilter.output, this.quadPipeline!, this.fullQuad);
				}
			}
		}

		if (! this.SHADQUAD) {
			// -- main forward pass
			let rpdMain = render.makeRenderPassDescriptor();
			vec4.set(rpdMain.clearColour, 0, 0, 0, 1);
			rpdMain.clearMask = render.ClearMask.ColourDepth;

			render.runRenderPass(this.rc, this.scene_.meshMgr, rpdMain, mainPassFBO, (renderPass) => {
				const viewport = renderPass.viewport()!;
				let camera: world.ProjectionSetup = {
					projectionMatrix: mat4.perspective([], math.deg2rad(50), viewport.width / viewport.height, 0.1, 100),
					viewMatrix: this.player_.view.viewMatrix
				};

				this.scene_.lightMgr.prepareLightsForRender(this.scene_.lightMgr.allEnabled(), camera, viewport);

				renderPass.setDepthTest(render.DepthTest.Less);
				renderPass.setFaceCulling(render.FaceCulling.Back);

				this.scene_.pbrModelMgr.draw(this.scene_.pbrModelMgr.all(), renderPass, camera, spotShadow, world.PBRLightingQuality.CookTorrance, this.assets_.tex.reflectCubeSpace);

				this.skyBox_.draw(renderPass, camera);
			});

			if (this.antialias) {
				this.fxaaPass.apply(this.rc, this.scene_.meshMgr, mainPassFBO!.colourAttachmentTexture(0)!);
			}
		}
	}


	simulationStep(timeStep: number) {
		const txm = this.scene_.transformMgr;
		if (this.mode_ >= GameMode.Main) {
			this.player_.step(timeStep);

			// if (io.keyboard.pressed(io.Key.U)) {
			// 	this.SHADOW = !this.SHADOW;
			// }
			// if (io.keyboard.pressed(io.Key.O)) {
			// 	this.SHADQUAD = !this.SHADQUAD;
			// }
			// if (io.keyboard.down(io.Key.I)) {
			// 	this.scene_.transformMgr.translate(this.level_.spotExit.transform, [0, 0, -.1]);
			// }
			// else if (io.keyboard.down(io.Key.K)) {
			// 	this.scene_.transformMgr.translate(this.level_.spotExit.transform, [0, 0, .1]);
			// }
			// if (io.keyboard.down(io.Key.J)) {
			// 	this.scene_.transformMgr.translate(this.level_.spotExit.transform, [-.1, 0, 0]);
			// }
			// else if (io.keyboard.down(io.Key.L)) {
			// 	this.scene_.transformMgr.translate(this.level_.spotExit.transform, [.1, 0, 0]);
			// }

			if (io.keyboard.pressed(io.Key.F)) {
				this.antialias = !this.antialias;
			}

			if (this.skyBox_) {
				this.skyBox_.setCenter(this.player_.view.pos);
				this.scene_.transformMgr.rotateByAngles(this.skyBox_.transform, [0, Math.PI * .002 * timeStep, Math.PI * -.001 * timeStep]);
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
