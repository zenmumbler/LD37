// Callisto, a Ludum Dare 37 Entry
// (c) 2016 by Arthur Langereis (@zenmumbler)

type PillarYGen = (xz: sd.Float2, tileXZ: sd.Float2, baseY: number) => number;

function rgb8Color(r: number, g: number, b: number) {
	return [r / 255, g / 255, b / 255];
}

const TheColors: number[][] = [
	rgb8Color(69, 204, 255),
	rgb8Color(255, 212, 49),
	rgb8Color(232, 75, 48),
	rgb8Color(178, 67, 255)
];

const enum Quadrant {
	Left,
	Top,
	Right,
	Bottom
}

interface Orb {
	worldPos: sd.Float3;
	index: number;
	quadrant: Quadrant;
	pbrModel: world.PBRModelInstance;
	pbrMat: world.PBRMaterialInstance;
}


class Level {
	theColorMatsBack: asset.Material[] = [];
	theColorMatsLeft: asset.Material[] = [];
	theColorMatsRight: asset.Material[] = [];

	spotLeft: world.LightInstance;
	spotRight: world.LightInstance;
	spotBack: world.LightInstance;
	spotDoor: world.LightInstance;
	spotExit: world.LightInstance;

	orbs: Orb[][];

	finalDoor: world.EntityInfo;

	constructor(private rc: render.RenderContext, private ac: audio.AudioContext, private assets: Assets, private scene: world.Scene) {
		for (let c = 0; c < TheColors.length; ++c) {
			const color = TheColors[c];
			const m = asset.makeMaterial(`core_color_${c}`);
			m.emissiveColour = color;
			m.emissiveIntensity = 1;
			m.flags |= asset.MaterialFlags.usesEmissive;

			this.theColorMatsBack[c] = m;
			this.theColorMatsLeft[c] = sd.cloneStruct(m);
			this.theColorMatsRight[c] = sd.cloneStruct(m);
		}

		this.orbs = [];
		this.orbs[Quadrant.Left] = [];
		this.orbs[Quadrant.Right] = [];
		this.orbs[Quadrant.Top] = [];
	}


	makeGlower(position: sd.Float3, radius: number) {
		this.scene.makeEntity({
			transform: {
				position: position
			},
			mesh: {
				name: "sphere",
				meshData: meshdata.gen.generate(new meshdata.gen.Sphere({ radius: radius, rows: 20, segs: 30 }))
			},
			pbrModel: {
				materials: [this.assets.mat.whitemarble]
			},
			light: {
				name: "spherelight1",
				type: asset.LightType.Point,
				intensity: 8,
				range: 3 * radius,
				colour: [1, 0.96, 0.94]
			}
		});
	}


	generateColumnBlock(origin: sd.Float3, pillarDim: number, pillarHeight: number, width: number, depth: number, uvRange: sd.Float2, yGen: PillarYGen) {
		const tiles: meshdata.gen.TransformedMeshGen[] = [];
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


	makeInnerWalls(scene: world.Scene, assets: Assets) {
		const walls: meshdata.gen.TransformedMeshGen[] = [];
		const hwalls: number[][] = [[-10, -10.5], [5, -10.5], [-10, 10], [5, 10]];
		const vwalls: number[][] = [[-10.5, -10], [10, -10], [-10.5, 5], [10, 5]];
		const cwalls: number[][] = [[-.25, -10.5], [-10.5, -0.25], [-.25, 10], [10, -.25]];
		for (let cwx = 0; cwx < 4; ++cwx) {
			walls.push({
				translation: [hwalls[cwx][0] + 2.25, 7.5, hwalls[cwx][1]],
				generator: new meshdata.gen.Box({ width: 5, depth: 0.5, height: 15, inward: false, uvRange: [5, 15] })
			});
			walls.push({
				translation: [vwalls[cwx][0], 7.5, vwalls[cwx][1] + 2.25],
				generator: new meshdata.gen.Box({ width: 0.5, depth: 5, height: 15, inward: false, uvRange: [5, 15] })
			});
			if ((cwx & 1) == 0) {
				walls.push({
					translation: [cwalls[cwx][0], 9, cwalls[cwx][1]],
					generator: new meshdata.gen.Box({ width: 10, depth: 0.5, height: 12, inward: false, uvRange: [11, 12], uvOffset: [1, 0] })
				});
			}
			else {
				walls.push({
					translation: [cwalls[cwx][0], 9, cwalls[cwx][1]],
					generator: new meshdata.gen.Box({ width: 0.5, depth: 10, height: 12, inward: false, uvRange: [11, 12], uvOffset: [1, 0] })
				});
			}
		}
		const innerWalls = scene.makeEntity({
			mesh: {
				name: "innerwalls",
				meshData: meshdata.gen.generate(walls)
			},
			pbrModel: {
				materials: [assets.mat.chipmetal]
			}
		});
	}


	makeInfoWalls(scene: world.Scene, assets: Assets) {
		const signA = meshdata.gen.generate(new meshdata.gen.Box({
			width: 1, height: 1, depth: 0.1, inward: false,
			uvRange: [0.5, 0.5], uvOffset: [0, 0.5]
		}));
		const signB = meshdata.gen.generate(new meshdata.gen.Box({
			width: 1, height: 1, depth: 0.1, inward: false,
			uvRange: [0.5, 0.5], uvOffset: [0.5, 0.5]
		}));
		const dirA = meshdata.gen.generate(new meshdata.gen.Box({
			width: 1, height: 1, depth: 0.1, inward: false,
			uvRange: [0.5, 0.5], uvOffset: [0, 0]
		}));
		const dirB = meshdata.gen.generate(new meshdata.gen.Box({
			width: 1, height: 1, depth: 0.1, inward: false,
			uvRange: [0.5, 0.5], uvOffset: [0.5, 0]
		}));

		const iwLeft = scene.makeEntity({
			transform: { position: [-3.75, 1.5, 10.001] },
			mesh: {
				name: "infoWallA",
				meshData: meshdata.gen.generate(new meshdata.gen.Box({
					width: 3, height: 3, depth: .5, inward: false,
					uvRange: [3.25, 3], uvOffset: [.75, 0]
				}))
			},
			pbrModel: {
				materials: [assets.mat.chipmetal]
			}
		});
		scene.makeEntity({
			parent: iwLeft.transform,
			transform: { position: [0, .7, -0.3] },
			mesh: { name: "doorSignA", meshData: signA },
			pbrModel: { materials: [assets.mat.signs] }
		});
		scene.makeEntity({
			parent: iwLeft.transform,
			transform: { position: [0, -.6, -0.3] },
			mesh: { name: "doorDirA", meshData: dirA },
			pbrModel: { materials: [assets.mat.signs] }
		});

		const iwRight = scene.makeEntity({
			transform: { position: [3.25, 1.5, 10.001] },
			mesh: {
				name: "infoWallB",
				meshData: meshdata.gen.generate(new meshdata.gen.Box({
					width: 3, height: 3, depth: .5, inward: false,
					uvRange: [3.25, 3], uvOffset: [1, 0]
				}))
			},
			pbrModel: {
				materials: [assets.mat.chipmetal]
			}
		});
		scene.makeEntity({
			parent: iwRight.transform,
			transform: { position: [0, .7, -0.3] },
			mesh: { name: "doorSignB", meshData: signB },
			pbrModel: { materials: [assets.mat.signs] }
		});
		scene.makeEntity({
			parent: iwRight.transform,
			transform: { position: [0, -.6, -0.3] },
			mesh: { name: "doorDirB", meshData: dirB },
			pbrModel: { materials: [assets.mat.signs] }
		});

		// -- signs above the puzzle rooms

		scene.makeEntity({
			transform: { position: [-10.2, 3.6, 0], rotation: quat.fromEuler(0, Math.PI / 2, 0) },
			mesh: { name: "puzzleSignA", meshData: signA },
			pbrModel: { materials: [assets.mat.signs] }
		});
		scene.makeEntity({
			transform: { position: [9.6, 3.6, 0], rotation: quat.fromEuler(0, Math.PI / 2, 0) },
			mesh: { name: "puzzleSignB", meshData: signB },
			pbrModel: { materials: [assets.mat.signs] }
		});
	}


	makeBigHonkingDoor(scene: world.Scene, assets: Assets) {
		this.finalDoor = scene.makeEntity({
			transform: { position: [-0.25, 1.5, 10.001] },
			mesh: {
				name: "bigdoor",
				meshData: meshdata.gen.generate(new meshdata.gen.Box({
					width: 4, height: 3, depth: 0.5, inward: false,
					uvRange: [2, 1.5], uvOffset: [0, 0]
				}))
			},
			pbrModel: { materials: [assets.mat.roughbronze] }
		});
	}


	makeExit(scene: world.Scene, assets: Assets) {
		scene.makeEntity({
			transform: { position: [-0.251, 1.52, 10.26 + 1.5] },
			mesh: {
				name: "exit",
				meshData: meshdata.gen.generate(new meshdata.gen.Box({ width: 4, height: 3, depth: 3, inward: true }))
			},
			pbrModel: { materials: [assets.mat.whiteness], castsShadows: false }
		});
		const spotExit = scene.makeEntity({
			transform: { position: [0, 3, 14] },
			light: {
				name: "exitlight",
				colour: [1, 1, 1],
				intensity: 8,
				type: asset.LightType.Spot,
				range: 12,
				cutoff: math.deg2rad(50)
			}
		});
		this.spotExit = spotExit.light!;
		scene.lightMgr.setDirection(this.spotExit, [0, -.7, -1]);
		scene.lightMgr.setEnabled(this.spotExit, false);
		// scene.pbrModelMgr.setShadowCaster(this.spotExit);
	}


	makeZodiacTable(parentTX: world.TransformInstance, indexes: number[], slabSize: number, spacing: sd.Float2, scene: world.Scene, assets: Assets) {
		const tgen: meshdata.gen.TransformedMeshGen[] = [];

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
				generator: new meshdata.gen.Box({
					width: slabSize, height: slabSize, depth: 0.05, inward: false,
					uvOffset: [indexes[pos] * .25, 0],
					uvRange: [.28, .29]
				})
			});
		}

		return scene.makeEntity({
			parent: parentTX,
			mesh: { name: `zodiac-sheet`, meshData: meshdata.gen.generate(tgen) },
			pbrModel: { materials: [assets.mat.zodiac] }
		});
	}


	makeOrbPillars(quadrant: Quadrant, origin: sd.Float3, spacing: number, zodiacSigns: number[] | null, scene: world.Scene, assets: Assets) {
		const baseEnt = scene.makeEntity({
			transform: { position: origin }
		});

		const pgen: meshdata.gen.TransformedMeshGen[] = [];
		const pw = .25;
		for (let p = 0; p < 4; ++p) {
			pgen.push({
				translation: [p * spacing, 0, 0],
				generator: new meshdata.gen.Box({ width: pw, depth: pw, height: 1.3, inward: false, uvRange: [pw, 1.3] })
			});

			const orb = scene.makeEntity({
				parent: baseEnt.transform,
				transform: { position: [p * spacing, 1.4, 0] },
				mesh: { name: `pillar-sphere-${p}`, meshData: meshdata.gen.generate(new meshdata.gen.Sphere({ radius: pw * .9, rows: 12, segs: 18 })) },
				pbrModel: { materials: [this.theColorMatsBack[p]] }
			});
			this.orbs[quadrant].push({
				index: p,
				quadrant: quadrant,
				worldPos: scene.transformMgr.worldPosition(orb.transform),
				pbrModel: orb.pbrModel!,
				pbrMat: 0
			});
		}
		scene.makeEntity({
			parent: baseEnt.transform,
			transform: { position: [0, 1.3 / 2, 0]},
			mesh: { name: "pillars", meshData: meshdata.gen.generate(pgen) },
			pbrModel: { materials: [assets.mat.medmetal] }
		});

		if (zodiacSigns != null) {
			const zt = this.makeZodiacTable(baseEnt.transform, zodiacSigns, pw, [1, .5], scene, assets);
			scene.transformMgr.setPosition(zt.transform, [0, .9, pw / 2]);
		}

		return baseEnt;
	}


	makePuzzleTablet(origin: sd.Float3, zodiacSigns: number[], scene: world.Scene, assets: Assets) {
		const baseEnt = scene.makeEntity({
			transform: { position: origin }
		});
		scene.makeEntity({
			parent: baseEnt.transform,
			mesh: {
				name: "slab",
				meshData: meshdata.gen.generate(new meshdata.gen.Box({ width: 2.25, height: 1.25, depth: 0.1, inward: false }))
			},
			pbrModel: {
				materials: [assets.mat.medmetal]
			}
		});

		const zt = this.makeZodiacTable(baseEnt.transform, zodiacSigns, .25, [.5, .5], scene, assets);
		scene.transformMgr.setPosition(zt.transform, [-.75, 0.25, 0.07]);

		return baseEnt;
	}


	makeCornerLights(scene: world.Scene, assets: Assets) {
		for (let corneria = 0; corneria < 4; ++corneria) {
			const mulX = ((corneria > 0) && (corneria < 3)) ? 1 : -1;
			const mulZ = ((corneria & 2) == 0) ? -1 : 1;
			scene.makeEntity({
				transform: { position: [mulX * 8.5, 2.7, mulZ * 8.5] },
				light: {
					name: `corner_color_${corneria}`,
					colour: TheColors[corneria],
					type: asset.LightType.Point,
					intensity: 4,
					range: 3.4
				}
			});
		}
	}


	generate() {
		const scene = this.scene;
		const assets = this.assets;
		const pbrm = scene.pbrModelMgr;
		const ltm = scene.lightMgr;
		const rc = this.rc;
		const ac = this.ac;


		// -- floor and ceiling of main room
		const floor = scene.makeEntity({
			mesh: {
				name: "floor",
				meshData: this.generateColumnBlock([0, 0, 0], .5, .5, 62, 62, [0.125, 0.125], 
					(pxz, txz, y) => {
						let dist = vec2.len(vec2.sub([], pxz, [0, 0]));
						dist = Math.max(0, dist - 14);
						return y + dist - 0.025 + (Math.random() * 0.05);
					}
				)
			},
			pbrModel: { materials: [assets.mat.bronzepatina], castsShadows: false }
		});
		const ceiling = scene.makeEntity({
			mesh: {
				name: "ceil",
				meshData: this.generateColumnBlock([0, 10, 0], 1, 4, 20, 20, [.5, .5], (pxz, txz, y) => y - 1.9 + (Math.random() * 3))
			},
			pbrModel: { materials: [assets.mat.medmetal], castsShadows: false }
		});


		// -- BACK ROOM: zodiac signs associated with colors

		this.makeOrbPillars(Quadrant.Top, [-1.5, 0, -12], 1, [0, 1, 2, 3], scene, assets);

		const spotBack = scene.makeEntity({
			transform: { position: [0, 4, -8] },
			light: {
				name: "spot-pillars",
				colour: [1, .94, .88],
				type: asset.LightType.Spot,
				intensity: 2.5,
				range: 10,
				cutoff: math.deg2rad(35)
			}
		});
		ltm.setDirection(spotBack.light!, [0, -.707, -.707]);
		ltm.setEnabled(spotBack.light!, false);
		this.spotBack = spotBack.light!;


		// -- LEFT ROOM: easy puzzle

		const pilleft = this.makeOrbPillars(Quadrant.Left, [-12, 0, -1], .67, null, scene, assets);
		scene.transformMgr.rotateByAngles(pilleft.transform, [0, math.deg2rad(80), 0]);
		const tabletLeft = this.makePuzzleTablet([-11.5, 1, 1.5], [3, 1, 2, 0, 2, 0, 1, 3], scene, assets);
		scene.transformMgr.rotateByAngles(tabletLeft.transform, [math.deg2rad(-10), math.deg2rad(100), 0]);

		const spotLeft = scene.makeEntity({
			transform: { position: [-8, 4, 0] },
			light: {
				name: "spot-left",
				colour: [1, 1, 1],
				type: asset.LightType.Spot,
				intensity: 2.5,
				range: 10,
				cutoff: math.deg2rad(35)
			}
		});
		ltm.setDirection(spotLeft.light!, [-.707, -.707, 0]);
		ltm.setEnabled(spotLeft.light!, false);
		this.spotLeft = spotLeft.light!;


		// -- RIGHT ROOM: hard puzzle

		const pilright = this.makeOrbPillars(Quadrant.Right, [12, 0, 1], .67, null, scene, assets);
		scene.transformMgr.rotateByAngles(pilright.transform, [0, math.deg2rad(-100), 0]);
		const tabletRight = this.makePuzzleTablet([11.5, 1, -1.5], [3, 1, 2, 0, 2, 0, 1, 3], scene, assets);
		scene.transformMgr.rotateByAngles(tabletRight.transform, [math.deg2rad(-10), math.deg2rad(-80), 0]);

		const spotRight = scene.makeEntity({
			transform: { position: [8, 4, 0] },
			light: {
				name: "spot-right",
				colour: [1, 1, 1],
				type: asset.LightType.Spot,
				intensity: 2.5,
				range: 10,
				cutoff: math.deg2rad(35)
			}
		});
		ltm.setDirection(spotRight.light!, [.707, -.707, 0]);
		ltm.setEnabled(spotRight.light!, false);
		this.spotRight = spotRight.light!;


		// -- walls

		this.makeInnerWalls(scene, assets);
		this.makeInfoWalls(scene, assets);
		// this.makeBigHonkingDoor(scene, assets);
		this.makeExit(scene, assets);


		// -- lights, so many lights

		this.makeCornerLights(scene, assets);

		this.makeGlower([0, 1, 0], 1);
		for (let qq = 0; qq < 8; ++qq) {
			this.makeGlower([((qq * 16) % 20) - 10, 6.5, ((qq * 34) % 20) - 10], .6);
		}

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
