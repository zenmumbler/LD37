// Callisto, a Ludum Dare 37 Entry
// (c) 2016 by Arthur Langereis (@zenmumbler)

/// <reference path="../../stardazed/dist/stardazed.d.ts" />
/// <reference path="assets.ts" />
/// <reference path="levelgen.ts" />
/// <reference path="sfx.ts" />

interface Element {
	mozRequestFullScreen(): void;
}

interface Document {
	mozFullScreenElement: HTMLElement;
}

import entity = sd.entity;
import io = sd.io;
import math = sd.math;
import render = sd.render;
import geometry = sd.geometry;
import dom = sd.dom;
import asset = sd.asset;
import container = sd.container;
import audio = sd.audio;
import physics = sd.physics;
import control = sd.control;

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

function makeFSQPipeline(rc: render.gl1.GL1RenderDevice) {
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
	pld.vertexShader = render.makeShader(rc, rc.gl.VERTEX_SHADER, vertexSource);
	pld.fragmentShader = render.makeShader(rc, rc.gl.FRAGMENT_SHADER, fragmentSource);
	pld.attributeNames.set(geometry.VertexAttributeRole.Position, "vertexPos_model");

	pfp.pipeline = new render.Pipeline(rc, pld);
	pfp.texUniform = rc.gl.getUniformLocation(pfp.pipeline.program, "texSampler")!;

	// -- invariant uniform
	pfp.pipeline.bind();
	rc.gl.uniform1i(pfp.texUniform, 0);
	pfp.pipeline.unbind();

	return pfp;
}

function drawFSQ(rc: render.RenderContext, meshes: world.MeshManager, tex: render.Texture, p: FSQPipeline, m: world.MeshInstance) {
	const rpd = render.makeRenderPassDescriptor();
	rpd.clearMask = render.ClearMask.Colour;

	render.runRenderPass(rc, meshes, rpd, null, (rp) => {
		rp.setPipeline(p.pipeline);
		rp.setTexture(tex, 0);
		rp.setMesh(m);
		rp.setDepthTest(render.DepthTest.Disabled);

		// render quad without any transforms, filling full FB
		const primGroup0 = meshes.primitiveGroups(m)[0];
		rp.drawIndexedPrimitives(primGroup0.type, meshes.indexBufferElementType(m), 0, primGroup0.elementCount);
	});
}



class MainScene implements sd.SceneDelegate {
	scene: sd.Scene;
	private sfx_: Sound;
	private level_: Level;

	// private skyBox_: world.Skybox;
	// private glowLight_: world.EntityInfo;

	private player_: PlayerController;
	private mode_ = GameMode.None;

	willLoadAssets() {
		dom.show(".overlay.loading");
	}

	assetLoadProgress(ratio: number) {
		dom.$1(".bar .progress").style.width = Math.round(ratio * 100) + "%";
	}

	finishedLoadingAssets() {
		dom.hide(".overlay.loading");
	}

	setup() {
		const assets = this.scene.assets;
		this.sfx_ = new Sound(this.scene.ad);

		this.setMode(GameMode.Loading);

		this.sfx_.setAssets(assets.sound);

		// this.makeSkybox();

		this.level_ = new Level(this.scene);
		this.level_.generate().then(() => {
			const sun = makeEntity(this.scene, {
				light: {
					colour: [.5, .5, .9],
					type: entity.LightType.Directional,
					intensity: .16,
				}
			});
			this.scene.lights.setDirection(sun.light!, [0, 1, .1]);

			this.setMode(GameMode.Main);

			/*
			dom.on(dom.$(`input[type="radio"]`), "click", evt => {
				const radio = evt.target as HTMLInputElement;
				if (radio.checked) {
					const vpsSize = radio.dataset["vps"];
					const holder = dom.$1(".stageholder");
					holder.className = `stageholder ${vpsSize}`;
					const canvas = rc.gl.canvas;
					canvas.width = ({ small: 960, hdready: 1280, fullhd: 1920 } as any)[vpsSize];
					canvas.height = ({ small: 540, hdready: 720, fullhd: 1080 } as any)[vpsSize];

					if (this.mainFBO) {
						rc.gl.deleteFramebuffer(this.mainFBO.resource);
						this.mainFBO = undefined;
					}
				}
			});
			*/
		});
	}

	makeSkybox() {
		const sb = makeEntity(this.scene, {});
		// this.skyBox_ = new world.Skybox(this.rc, this.scene.transformMgr, this.scene.meshes, this.assets_.tex.envCubeSpace);
		// this.skyBox_.setEntity(sb.entity);
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
			this.player_ = new PlayerController(this.rc.gl.canvas, [0, 1.5, 5], this.scene, this.level_, this.sfx_);
		}

		this.mode_ = newMode;
	}

	fullQuad: entity.MeshInstance = 0;
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
			this.downsample128 = render.resamplePass(this.rc, this.scene.meshes, 512);
			this.downsample64 = render.resamplePass(this.rc, this.scene.meshes, 256);
			this.boxFilter = render.boxFilterPass(this.rc, this.scene.meshes, 256);
		}

		let mainPassFBO: render.FrameBuffer | null = null;
		if (this.antialias) {
			if (! this.fxaaPass) {
				this.fxaaPass = new render.FXAAPass(this.rc, this.scene.meshes);
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
		const shadowCaster = this.scene.pbrModelMgr.shadowCaster();

		if (this.SHADOW && shadowCaster && render.canUseShadowMaps(this.rc)) {
			let rpdShadow = render.makeRenderPassDescriptor();
			rpdShadow.clearMask = render.ClearMask.ColourDepth;
			vec4.set(rpdShadow.clearColour, 1, 1, 1, 1);

			spotShadow = this.scene.lights.shadowViewForLight(this.rc, shadowCaster, .1);
			if (spotShadow) {
				render.runRenderPass(this.rc, this.scene.meshes, rpdShadow, spotShadow.shadowFBO, (renderPass) => {
					renderPass.setDepthTest(render.DepthTest.Less);
					this.scene.pbrModelMgr.drawShadows(this.scene.pbrModelMgr.all(), renderPass, spotShadow!.lightProjection);
				});

				//  filter shadow tex and set as source for shadow calcs
				this.downsample128.apply(this.rc, this.scene.meshes, spotShadow.shadowFBO.colourAttachmentTexture(0)!);
				this.downsample64.apply(this.rc, this.scene.meshes, this.downsample128.output);
				this.boxFilter.apply(this.rc, this.scene.meshes, this.downsample64.output);
				spotShadow.filteredTexture = this.boxFilter.output;

				if (this.fullQuad === 0) {
					const quad = geometry.gen.generate(new geometry.gen.Quad(2, 2), [geometry.attrPosition2(), geometry.attrUV2()]);
					this.fullQuad = this.scene.meshes.create({ name: "squareQuad", meshData: quad });
					this.quadPipeline = makeFSQPipeline(this.rc);
				}

				if (this.SHADQUAD) {
					drawFSQ(this.rc, this.scene.meshes, this.boxFilter.output, this.quadPipeline!, this.fullQuad);
				}
			}
		}

		if (! this.SHADQUAD) {
			// -- main forward pass
			let rpdMain = render.makeRenderPassDescriptor();
			vec4.set(rpdMain.clearColour, 0, 0, 0, 1);
			rpdMain.clearMask = render.ClearMask.ColourDepth;

			render.runRenderPass(this.rc, this.scene.meshes, rpdMain, mainPassFBO, (renderPass) => {
				const viewport = renderPass.viewport()!;
				let camera: world.ProjectionSetup = {
					projectionMatrix: mat4.perspective([], math.deg2rad(60), viewport.width / viewport.height, 0.1, 100),
					viewMatrix: this.player_.view.viewMatrix
				};

				this.scene.lights.prepareLightsForRender(this.scene.lights.allEnabled(), camera, viewport);

				renderPass.setDepthTest(render.DepthTest.Less);
				renderPass.setFaceCulling(render.FaceCulling.Back);

				this.scene.pbrModelMgr.draw(this.scene.pbrModelMgr.all(), renderPass, camera, spotShadow, world.PBRLightingQuality.CookTorrance, this.assets_.tex.reflectCubeSpace);

				this.skyBox_.draw(renderPass, camera);
			});

			if (this.antialias) {
				this.fxaaPass.apply(this.rc, this.scene.meshes, mainPassFBO!.colourAttachmentTexture(0)!);
			}
		}
	}


	simulationStep(timeStep: number) {
		const txm = this.scene.transforms;
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

			if (control.keyboard.pressed(control.Key.X)) {
				this.antialias = !this.antialias;
			}

			// if (this.skyBox_) {
			// 	this.skyBox_.setCenter(this.player_.view.pos);
			// 	this.scene.transformMgr.rotateByAngles(this.skyBox_.transform, [0, Math.PI * .002 * timeStep, Math.PI * -.001 * timeStep]);
			// }
		}
	}
}


sd.App.messages.listenOnce("AppStart", undefined, () => {
	const stageHolder = dom.$1(".stageholder");
	const rw = new render.RenderWorld(stageHolder, 1280, 720);
	const adev = audio.makeAudioDevice()!;

	if (! (rw.rd.extDerivatives && rw.rd.extFragmentLOD)) {
		alert("Sorry, this game is not compatible with this browser.\n\nTry one of the following:\n- Firefox 50 or newer\n- Safari 9 or newer\n- Chrome 40 or newer\n\nApologies for the trouble.");
		return;
	}
	if (! document.body.requestPointerLock) {
		dom.hide("#fullscreen");
	}
	if (screen.width < 1920 || screen.height < 1080) {
		dom.disable("#vps-fullhd");
		dom.$1("#vps-fullhd").title = "Your display does not support this resolution.";
		dom.$1("#vps-fullhd+label").title = "Your display does not support this resolution.";
	}

	io.loadFile("base-scene.json", { tryBreakCache: true, responseType: io.FileLoadType.JSON })
		.then((sceneJSON: any) => {
			const scene = new sd.Scene(rw, adev, {
				physicsConfig: physics.makeDefaultPhysicsConfig(),
				assets: sceneJSON.assets,
				delegate: new MainScene()
			});
			sd.App.scene = scene;
		});
});
