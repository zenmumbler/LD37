// Callisto, a Ludum Dare 37 Entry
// (c) 2016 by Arthur Langereis (@zenmumbler)

type PillarYGen = (xz: sd.Float2, tileXZ: sd.Float2, baseY: number) => number;

function srgb8Color(r: number, g: number, b: number) {
	return [Math.pow(r / 255, 2.2), Math.pow(g / 255, 2.2), Math.pow(b / 255, 2.2)];
}

const TheColors: number[][] = [
	srgb8Color(69, 204, 255),
	srgb8Color(255, 212, 49),
	srgb8Color(232, 75, 48),
	srgb8Color(178, 67, 255)
];

type LineSeg = sd.Float4;

const enum Quadrant {
	Left,
	Top,
	Right,
	Bottom
}

interface Orb {
	index: number;
	quadrant: Quadrant;
	transform: entity.TransformInstance;
	worldPos: sd.Float3;
	renderer: entity.MeshRendererInstance;
	material: render.effect.StandardEffectData;
}

interface EntityCreateOptions {
	parent?: entity.TransformInstance;
	transform?: entity.Transform;
	rigidBody?: physics.RigidBodyDescriptor;
	geom?: {
		geometry: geometry.Geometry;
	};
	renderer?: entity.MeshRendererDescriptor;
	light?: entity.Light;
}

const geomsToAllocate: geometry.Geometry[] = [];

interface EntityInfo {
	entity: entity.Entity;
	transform: entity.TransformInstance;
	collider: entity.ColliderInstance;
	mesh: entity.MeshInstance;
	renderer: entity.MeshRendererInstance;
	light: entity.LightInstance;
}

function makeEntity(scene: sd.Scene, options: EntityCreateOptions): EntityInfo {
	const entity = scene.entities.create();
	const info: EntityInfo = {
		entity,
		transform: scene.transforms.create(entity, options.transform, options.parent),
		collider: 0,
		mesh: 0,
		renderer: 0,
		light: 0
	};

	if (options.geom) {
		const mesh = scene.meshes.create(options.geom.geometry);
		scene.meshes.linkToEntity(mesh, entity);
		info.mesh = mesh;
		geomsToAllocate.push(options.geom.geometry);
	}
	if (options.renderer) {
		info.renderer = scene.renderers.create(entity, options.renderer);
	}
	if (options.rigidBody) {
		info.collider = scene.colliders.create(entity, {
			rigidBody: options.rigidBody
		});
	}
	if (options.light) {
		info.light = scene.lights.create(entity, options.light);
	}

	return info;
}


class Level {
	private assets: Assets;

	theColorMatsBack: render.effect.StandardEffectData[] = [];
	theColorMatsLeft: render.effect.StandardEffectData[] = [];
	theColorMatsRight: render.effect.StandardEffectData[] = [];

	clipLines: LineSeg[] = [];

	spotLeft: entity.LightInstance;
	spotRight: entity.LightInstance;
	spotBack: entity.LightInstance;
	spotExit: EntityInfo;

	orbs: Orb[][];
	glowers: { light: entity.LightInstance; }[] = [];

	finalDoor: EntityInfo;

	orderLeft: number[];
	orderRight: number[];

	checkOrderLeft: number[];
	checkOrderRight: number[];

	constructor(private scene: sd.Scene, assets: Assets) {
		this.assets = assets;

		// gen random permutations
		const ZL = this.orderLeft = this.genRandomPuzzleOrder();
		const ZR = this.orderRight = this.genRandomPuzzleOrder();

		// place permutations in checking order
		this.checkOrderLeft  = [ZL[0], ZL[1], ZL[2], ZL[3], ZL[7], ZL[6], ZL[5], ZL[4]];
		this.checkOrderRight = [ZR[4], ZR[0], ZR[1], ZR[5], ZR[6], ZR[2], ZR[3], ZR[7]];

		for (let c = 0; c < TheColors.length; ++c) {
			this.theColorMatsBack[c] = assets.mat.orbs[c];
			this.theColorMatsLeft[c] = assets.mat.orbsLeft[c];
			this.theColorMatsRight[c] = assets.mat.orbsRight[c];
		}

		this.orbs = [];
		this.orbs[Quadrant.Left] = [];
		this.orbs[Quadrant.Right] = [];
		this.orbs[Quadrant.Top] = [];
	}


	makeGlower(position: sd.Float3, radius: number, range = 3 * radius) {
		const g = makeEntity(this.scene, {
			transform: {
				position: position
			},
			geom: {
				geometry: geometry.gen.generate(new geometry.gen.Sphere({ radius: radius, rows: 16, segs: 24 }))
			},
			renderer: {
				materials: [this.assets.mat.whiteness],
				castsShadows: false
			},
			light: {
				type: entity.LightType.Point,
				intensity: 7,
				range: range,
				colour: [1, 0.96, 0.94]
			}
		});
		this.glowers.push({
			light: g.light!
		});
	}


	generateColumnBlock(origin: sd.Float3, pillarDim: number, pillarHeight: number, width: number, depth: number, uvRange: sd.Float2, yGen: PillarYGen) {
		const tiles: geometry.gen.TransformedMeshGen[] = [];
		const halfWidth = width * pillarDim / 2;
		const halfDepth = depth * pillarDim / 2;
		const oX = origin[0] - halfWidth;
		const oY = origin[1];
		const oZ = origin[2] - halfDepth;

		let pZ = oZ;
		for (let tileZ = 0; tileZ < depth; ++tileZ) {
			let pX = oX;
			for (let tileX = 0; tileX < width; ++tileX) {
				const pY = yGen([pX, pZ], [tileX, tileZ], oY);
				tiles.push({
					translation: [pX, pY, pZ],
					generator: new geometry.gen.Box({
						width: pillarDim, depth: pillarDim, height: pillarHeight,
						inward: false,
						uvRange: uvRange, uvOffset: vec2.multiply([], uvRange, [tileX, tileZ])
					})
				});
				pX += pillarDim;
			}
			pZ += pillarDim;
		}

		return geometry.gen.generate(tiles, geometry.AttrList.Pos3Norm3UV2());
	}


	makeInnerWalls(scene: sd.Scene, assets: Assets) {
		const walls: geometry.gen.TransformedMeshGen[] = [];
		const hwalls: number[][] = [[-10, -10.5], [5, -10.5], [-10, 10], [5, 10]];
		const vwalls: number[][] = [[-10.5, -10], [10, -10], [-10.5, 5], [10, 5]];
		const cwalls: number[][] = [[-.25, -10.5], [-10.5, -0.25], [-.25, 10], [10, -.25]];
		for (let cwx = 0; cwx < 4; ++cwx) {
			walls.push({
				translation: [hwalls[cwx][0] + 2.25, 7.5, hwalls[cwx][1]],
				generator: new geometry.gen.Box({ width: 5, depth: 0.5, height: 15, inward: false, uvRange: [5, 15] })
			});
			walls.push({
				translation: [vwalls[cwx][0], 7.5, vwalls[cwx][1] + 2.25],
				generator: new geometry.gen.Box({ width: 0.5, depth: 5, height: 15, inward: false, uvRange: [5, 15] })
			});
			if ((cwx & 1) == 0) {
				walls.push({
					translation: [cwalls[cwx][0], 9, cwalls[cwx][1]],
					generator: new geometry.gen.Box({ width: 10, depth: 0.5, height: 12, inward: false, uvRange: [11, 12], uvOffset: [1, 0] })
				});
			}
			else {
				walls.push({
					translation: [cwalls[cwx][0], 9, cwalls[cwx][1]],
					generator: new geometry.gen.Box({ width: 0.5, depth: 10, height: 12, inward: false, uvRange: [11, 12], uvOffset: [1, 0] })
				});
			}
		}
		const innerWalls = makeEntity(scene, {
			geom: {
				geometry: geometry.gen.generate(walls)
			},
			renderer: {
				materials: [assets.mat.chipmetal]
			}
		});
	}


	makeInfoWalls(scene: sd.Scene, assets: Assets) {
		const signA = geometry.gen.generate(new geometry.gen.Box({
			width: 1, height: 1, depth: 0.1, inward: false,
			uvRange: [0.5, 0.5], uvOffset: [0, 0.5]
		}));
		const signB = geometry.gen.generate(new geometry.gen.Box({
			width: 1, height: 1, depth: 0.1, inward: false,
			uvRange: [0.5, 0.5], uvOffset: [0.5, 0.5]
		}));
		const dirA = geometry.gen.generate(new geometry.gen.Box({
			width: 1, height: 1, depth: 0.1, inward: false,
			uvRange: [0.5, 0.5], uvOffset: [0, 0]
		}));
		const dirB = geometry.gen.generate(new geometry.gen.Box({
			width: 1, height: 1, depth: 0.1, inward: false,
			uvRange: [0.5, 0.5], uvOffset: [0.5, 0]
		}));

		const iwLeft = makeEntity(scene, {
			transform: { position: [-3.75, 1.5, 10.001] },
			geom: {
				geometry: geometry.gen.generate(new geometry.gen.Box({
					width: 3, height: 3, depth: .5, inward: false,
					uvRange: [3.25, 3], uvOffset: [.75, 0]
				}))
			},
			renderer: {
				materials: [assets.mat.chipmetal]
			}
		});
		makeEntity(scene, {
			parent: iwLeft.transform,
			transform: { position: [0, .7, -0.3] },
			geom: { geometry: signA },
			renderer: { materials: [assets.mat.signs] }
		});
		makeEntity(scene, {
			parent: iwLeft.transform,
			transform: { position: [0, -.6, -0.3] },
			geom: { geometry: dirA },
			renderer: { materials: [assets.mat.signs] }
		});

		const iwRight = makeEntity(scene, {
			transform: { position: [3.25, 1.5, 10.001] },
			geom: {
				geometry: geometry.gen.generate(new geometry.gen.Box({
					width: 3, height: 3, depth: .5, inward: false,
					uvRange: [3.25, 3], uvOffset: [1, 0]
				}))
			},
			renderer: {
				materials: [assets.mat.chipmetal]
			}
		});
		makeEntity(scene, {
			parent: iwRight.transform,
			transform: { position: [0, .7, -0.3] },
			geom: { geometry: signB },
			renderer: { materials: [assets.mat.signs] }
		});
		makeEntity(scene, {
			parent: iwRight.transform,
			transform: { position: [0, -.6, -0.3] },
			geom: { geometry: dirB },
			renderer: { materials: [assets.mat.signs] }
		});

		// -- signs above the puzzle rooms

		makeEntity(scene, {
			transform: { position: [-10.2, 3.6, 0], rotation: quat.fromEuler(0, Math.PI / 2, 0) },
			geom: { geometry: signA },
			renderer: { materials: [assets.mat.signs] }
		});
		makeEntity(scene, {
			transform: { position: [9.7, 3.6, 0], rotation: quat.fromEuler(0, Math.PI / 2, 0) },
			geom: { geometry: signB },
			renderer: { materials: [assets.mat.signs] }
		});
	}


	makeBigHonkingDoor(scene: sd.Scene, assets: Assets) {
		this.finalDoor = makeEntity(scene, {
			transform: { position: [-0.25, 1.5, 10.001] },
			geom: {
				geometry: geometry.gen.generate(new geometry.gen.Box({
					width: 4, height: 3, depth: 0.5, inward: false,
					uvRange: [2, 1.5], uvOffset: [0, 0]
				}))
			},
			renderer: { materials: [assets.mat.blackness] }
		});
	}


	makeExit(scene: sd.Scene, assets: Assets) {
		makeEntity(scene, {
			transform: { position: [-0.251, 1.52, 10.26 + 1.5] },
			geom: {
				geometry: geometry.gen.generate(new geometry.gen.Box({ width: 4, height: 3, depth: 3, inward: true }))
			},
			renderer: { materials: [assets.mat.whiteness], castsShadows: false }
		});
		this.spotExit = makeEntity(scene, {
			transform: { position: [-0.4, 3, 14.3] },
			light: {
				colour: [1, 1, 1],
				intensity: 8,
				type: entity.LightType.Spot,
				range: 12,
				cutoff: math.deg2rad(50),
				shadowBias: 0.05
			}
		});
		scene.lights.setDirection(this.spotExit.light!, [0, -.7, -1]);
		scene.lights.setEnabled(this.spotExit.light!, false);
	}


	makeZodiacTable(parentTX: entity.TransformInstance, indexes: number[], slabSize: number, spacing: sd.Float2, scene: sd.Scene, assets: Assets) {
		const tgen: geometry.gen.TransformedMeshGen[] = [];

		let pX = 0;
		let pY = spacing[1];

		for (let pos = 0; pos < indexes.length; ++pos) {
			if ((pos % 4) == 0) {
				pX = 0;
				pY -= spacing[1];
			}
			else {
				pX += spacing[0];
			}

			tgen.push({
				translation: [pX, pY, 0],
				generator: new geometry.gen.Box({
					width: slabSize, height: slabSize, depth: 0.05, inward: false,
					uvOffset: [indexes[pos] * .25, 0],
					uvRange: [.28, .29]
				})
			});
		}

		return makeEntity(scene, {
			parent: parentTX,
			geom: { geometry: geometry.gen.generate(tgen) },
			renderer: { materials: [assets.mat.zodiac] }
		});
	}


	makeOrbPillars(quadrant: Quadrant, origin: sd.Float3, spacing: number, zodiacSigns: number[] | null, scene: sd.Scene, assets: Assets) {
		const baseEnt = makeEntity(scene, {
			transform: { position: origin }
		});

		const pgen: geometry.gen.TransformedMeshGen[] = [];
		const pw = .25;
		for (let p = 0; p < 4; ++p) {
			pgen.push({
				translation: [p * spacing, 0, 0],
				generator: new geometry.gen.Box({ width: pw * .9, depth: pw * .9, height: 1.3, inward: false, uvRange: [pw, 1.3] })
			});

			const orbInfo = makeEntity(scene, {
				parent: baseEnt.transform,
				transform: { position: [p * spacing, 1.4, 0] },
				geom: { geometry: geometry.gen.generate(new geometry.gen.Sphere({ radius: pw * .9, rows: 18, segs: 18 })) },
				renderer: { materials: [this.theColorMatsBack[p]] }
			});
			const orb = {
				index: p,
				quadrant: quadrant,
				transform: orbInfo.transform,
				worldPos: scene.transforms.worldPosition(orbInfo.transform),
				renderer: orbInfo.renderer!,
				material: this.theColorMatsBack[p]
			};
			this.orbs[quadrant].push(orb);
			this.theColorMatsBack[p].emissiveFactor[3] = 0;
		}
		makeEntity(scene, {
			parent: baseEnt.transform,
			transform: { position: [0, 1.3 / 2, 0]},
			geom: { geometry: geometry.gen.generate(pgen) },
			renderer: { materials: [assets.mat.medmetal] }
		});

		if (zodiacSigns != null) {
			const zt = this.makeZodiacTable(baseEnt.transform, zodiacSigns, pw, [1, .5], scene, assets);
			scene.transforms.setPosition(zt.transform, [0, .9, pw / 2]);
		}

		return baseEnt;
	}


	makePuzzleTablet(origin: sd.Float3, zodiacSigns: number[], scene: sd.Scene, assets: Assets) {
		const baseEnt = makeEntity(scene, {
			transform: { position: origin }
		});
		makeEntity(scene, {
			parent: baseEnt.transform,
			geom: {
				geometry: geometry.gen.generate(new geometry.gen.Box({ width: 2.25, height: 1.25, depth: 0.1, inward: false }))
			},
			renderer: {
				materials: [assets.mat.medmetal]
			}
		});

		const zt = this.makeZodiacTable(baseEnt.transform, zodiacSigns, .25, [.5, .5], scene, assets);
		scene.transforms.setPosition(zt.transform, [-.75, 0.25, 0.07]);

		return baseEnt;
	}


	makeCornerLights(scene: sd.Scene, assets: Assets) {
		for (let corneria = 0; corneria < 4; ++corneria) {
			const mulX = ((corneria > 0) && (corneria < 3)) ? 1 : -1;
			const mulZ = ((corneria & 2) == 0) ? -1 : 1;
			makeEntity(scene, {
				transform: { position: [mulX * 8.5, 2.7, mulZ * 8.5] },
				light: {
					colour: TheColors[corneria],
					type: entity.LightType.Point,
					intensity: 5.0,
					range: 2.6
				}
			});
		}
	}


	makeClipLines() {
		// top
		this.clipLines.push([-10, -10,  -5, -10]);
		this.clipLines.push([ -5, -10,  -5, -11]);
		this.clipLines.push([ -5, -11, 4.5, -11]);
		this.clipLines.push([4.5, -11, 4.5, -10]);
		this.clipLines.push([4.5, -10,   9.5, -10]);

		// right
		this.clipLines.push([  9.5, -10,  9.5,  -5]);
		this.clipLines.push([  9.5,  -5, 10.5,  -5]);
		this.clipLines.push([ 10.5,  -5, 10.5, 4.5]);
		this.clipLines.push([ 10.5, 4.5,  9.5, 4.5]);
		this.clipLines.push([  9.5, 4.5,  9.5, 9.5]);

		// bottom
		this.clipLines.push([ 9.5, 9.5,  1.5, 9.5]);
		this.clipLines.push([ 1.5, 9.5,  1.5, 13]);
		this.clipLines.push([ 1.5, 13, -2.0, 13]);
		this.clipLines.push([-2.0, 13, -2.0, 9.5]);
		this.clipLines.push([-2.0, 9.5, -10.5, 9.5]);

		// left
		this.clipLines.push([-10, 9.5, -10, 4.5]);
		this.clipLines.push([-10, 4.5, -11, 4.5]);
		this.clipLines.push([-11, 4.5, -11, -5]);
		this.clipLines.push([-11,  -5, -10, -5]);
		this.clipLines.push([-10,  -5, -10, -10]);

		// door blocker
		this.clipLines.push([ 1.7, 9.5, -2.2, 9.5]);
	}


	genRandomPuzzleOrder() {
		const signs = [0, 1, 2, 3, 0, 1, 2, 3];
		signs.sort((a, b) => Math.random() > .5 ? -1 : 1);
		return signs;
	}


	generate() {
		const scene = this.scene;
		const assets = this.assets;
		const pbrm = scene.renderers;
		const ltm = scene.lights;

		// -- floor and ceiling of main room
		const floorResolution = 0.5;
		const floorTexRange = vec2.scale([], [.25, .25], floorResolution);
		const floor = makeEntity(scene, {
			geom: {
				geometry: this.generateColumnBlock([0, 0, 0], floorResolution, .5, 31 / floorResolution, 31 / floorResolution, floorTexRange,
					(pxz, txz, y) => {
						let dist = vec2.len(vec2.sub([], pxz, [0, 0]));
						dist = Math.max(0, dist - 14);
						return y + dist - 0.025 + (Math.random() * 0.05);
					}
				)
			},
			renderer: { materials: [assets.mat.bronzepatina], castsShadows: false }
		});
		const ceiling = makeEntity(scene, {
			geom: {
				geometry: this.generateColumnBlock([0, 10, 0], 1, 4, 20, 20, [.5, .5], (pxz, txz, y) => y - 1.9 + (Math.random() * 3))
			},
			renderer: { materials: [assets.mat.medmetal], castsShadows: false }
		});


		// -- BACK ROOM: zodiac signs associated with colors

		this.makeOrbPillars(Quadrant.Top, [-1.5, 0, -12], 1, [0, 1, 2, 3], scene, assets);

		const spotBack = makeEntity(scene, {
			transform: { position: [0, 4.6, -8] },
			light: {
				colour: [1, .94, .88],
				type: entity.LightType.Spot,
				intensity: 0.25,
				range: 10,
				cutoff: math.deg2rad(35),
				shadowBias: 0.045
			}
		});
		ltm.setDirection(spotBack.light!, [0, -.707, -.707]);
		ltm.setEnabled(spotBack.light!, false);
		this.spotBack = spotBack.light!;


		// -- LEFT ROOM: easy puzzle

		const pilleft = this.makeOrbPillars(Quadrant.Left, [-12, 0, -1], .67, null, scene, assets);
		scene.transforms.rotateByAngles(pilleft.transform, [0, math.deg2rad(80), 0]);
		const tabletLeft = this.makePuzzleTablet([-11.5, 1, 1.5], this.orderLeft, scene, assets);
		scene.transforms.rotateByAngles(tabletLeft.transform, [math.deg2rad(-10), math.deg2rad(100), 0]);

		const spotLeft = makeEntity(scene, {
			transform: { position: [-7.9, 4.3, 0] },
			light: {
				colour: [1, 1, 1],
				type: entity.LightType.Spot,
				intensity: 0.3,
				range: 10,
				cutoff: math.deg2rad(35),
				shadowBias: 0.045
			}
		});
		ltm.setDirection(spotLeft.light!, [-.75, -.707, 0]);
		ltm.setEnabled(spotLeft.light!, false);
		this.spotLeft = spotLeft.light!;


		// -- RIGHT ROOM: hard puzzle

		const pilright = this.makeOrbPillars(Quadrant.Right, [12, 0, 1], .67, null, scene, assets);
		scene.transforms.rotateByAngles(pilright.transform, [0, math.deg2rad(-100), 0]);
		const tabletRight = this.makePuzzleTablet([11.5, 1, -1.5], this.orderRight, scene, assets);
		scene.transforms.rotateByAngles(tabletRight.transform, [math.deg2rad(-10), math.deg2rad(-80), 0]);

		const spotRight = makeEntity(scene, {
			transform: { position: [7.7, 4.3, 0] },
			light: {
				colour: [1, 1, 1],
				type: entity.LightType.Spot,
				intensity: 0.3,
				range: 10,
				cutoff: math.deg2rad(35),
				shadowBias: 0.045
			}
		});
		ltm.setDirection(spotRight.light!, [.75, -.707, 0]);
		ltm.setEnabled(spotRight.light!, false);
		this.spotRight = spotRight.light!;


		// -- walls

		this.makeInnerWalls(scene, assets);
		this.makeInfoWalls(scene, assets);
		this.makeBigHonkingDoor(scene, assets);
		this.makeExit(scene, assets);

		this.makeClipLines();


		// -- lights, so many lights

		this.makeCornerLights(scene, assets);

		// floor illum
		this.makeGlower([-4, 0.3, -4], .05, 1.5);
		this.makeGlower([ 4, 0.3, -4], .05, 1.5);
		this.makeGlower([ 4, 0.3,  4], .05, 1.5);
		this.makeGlower([-4, 0.3,  4], .05, 1.5);

		// back wall sign illumination
		this.makeGlower([3.2, 1.55, 9.5], .05, 1.2);
		this.makeGlower([-3.8, 1.55, 9.5], .05, 1.2);

		for (let qq = 0; qq < 7; ++qq) {
			this.makeGlower([((qq * 16) % 20) - 10, 6.5, ((qq * 34) % 20) - 10], .4, 1.8);
		}

		// sigh
		const rcb = new render.RenderCommandBuffer();
		for (const geom of geomsToAllocate) {
			rcb.allocate(geom);
		}
		scene.rw.rd.dispatch(rcb);

		return Promise.resolve();
	}

	// -----------

	positionQuadrant(pos: sd.Float3): Quadrant {
		const inABC = (pos[2] - pos[0]) < 0; // z - x = 0
		const inBCD = (pos[2] + pos[0]) > 0; // z + x = 0

		if (inABC) {
			if (inBCD) {
				return Quadrant.Right;
			}
			else {
				return Quadrant.Top;
			}
		}
		else {
			if (inBCD) {
				return Quadrant.Bottom;
			}
			else {
				return Quadrant.Left;
			}
		}
	}
}
