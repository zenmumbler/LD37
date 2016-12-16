// Callisto, a Ludum Dare 37 Entry
// (c) 2016 by Arthur Langereis (@zenmumbler)

interface SoundAssets {
	steps: AudioBuffer[];
	lightOn: AudioBuffer;
	lightOff: AudioBuffer;
	ping: AudioBuffer;
	doorOpen: AudioBuffer;
	swoosh: AudioBuffer;
	mainMusic: AudioBuffer;
	endMusic: AudioBuffer;
}

interface MaterialAssets {
	chipmetal: asset.Material;
	medmetal: asset.Material;
	bronzepatina: asset.Material;
	zodiac: asset.Material;
	signs: asset.Material;
	whiteness: asset.Material;
	blackness: asset.Material;
}

interface TextureAssets {
	envCubeSpace: render.Texture;
	reflectCubeSpace: render.Texture;
}

interface Assets {
	sound: SoundAssets;
	mat: MaterialAssets;
	tex: TextureAssets;
}

function loadAllAssets(rc: render.RenderContext, ac: audio.AudioContext, meshMgr: world.MeshManager, progress: (ratio: number) => void) {
	const a = { mat: {}, sound: {}, tex: {} } as Assets;

	var totalAssets = 1, assetsLoaded = 0;
	const loaded = (n = 1) => {
		assetsLoaded += n;
		progress(assetsLoaded / totalAssets);
	};

	function localURL(path: string) {
		return new URL(path, document.baseURI!);
	}

	function loadLocalMTL<K extends keyof MaterialAssets>(path: string, ks: K[]) {
		return asset.loadMTLFile(localURL(path)).then(ag => {
			loaded();
			for (const mat of ag.materials) {
				if (ks.indexOf(<any>mat.name) > -1) {
					a.mat[mat.name as K] = <any>mat;
				}
			}
			totalAssets += ag.textures.length;
			return asset.resolveTextures(rc, ag.textures).then(tex => {
				loaded(tex.length);
			});
		});
	}

	function loadEnvCubeTex<K extends keyof TextureAssets>(dirPath: string, k: K) {
		render.loadCubeTexture(rc, render.makeCubeMapPaths(dirPath, ".jpg")).then(texture => {
			loaded();
			a.tex[k] = <any>texture;
		});
	}

	function makeReflectionMap<K extends keyof TextureAssets>(k1: K, k2: K) {
		const envTexture = render.prefilteredEnvMap(rc, meshMgr, <any>a.tex[k1] as render.Texture, 256);
		a.tex[k2] = <any>envTexture;
	}

	const stuff = [
		asset.loadSoundFile(ac, "data/sound/34253__ddohler__hard-walking_0.mp3").then(buf => { a.sound.steps = a.sound.steps || []; a.sound.steps[0] = buf; loaded(); }),
		asset.loadSoundFile(ac, "data/sound/34253__ddohler__hard-walking_1.mp3").then(buf => { a.sound.steps = a.sound.steps || []; a.sound.steps[1] = buf; loaded(); }),

		asset.loadSoundFile(ac, "data/sound/131599__alvinwhatup2__kill-switch-large-breaker-switch.mp3").then(buf => { a.sound.lightOn = buf; loaded(); }),
		asset.loadSoundFile(ac, "data/sound/132998__cosmicd__light-switch-of-doom.mp3").then(buf => { a.sound.lightOff = buf; loaded(); }),
		asset.loadSoundFile(ac, "data/sound/215415__unfa__ping.mp3").then(buf => { a.sound.ping = buf; loaded(); }),

		asset.loadSoundFile(ac, "data/sound/232102__thalamus-lab__stone-grind_83631__arithni__heavy-thud.mp3").then(buf => { a.sound.doorOpen = buf; loaded(); }),
		asset.loadSoundFile(ac, "data/sound/264777__shinplaster__swoosh.mp3").then(buf => { a.sound.swoosh = buf; loaded(); }),

		asset.loadSoundFile(ac, "data/sound/274222__limetoe__space-atmosphere.mp3").then(buf => { a.sound.mainMusic = buf; loaded(); }),
		asset.loadSoundFile(ac, "data/sound/Incompetech-Comfortable-Mystery-4.mp3").then(buf => { a.sound.endMusic = buf; loaded(); }),

		loadLocalMTL("data/mat/chipmetal/chipmetal.mtl", ["chipmetal"]),
		loadLocalMTL("data/mat/medmetal/medmetal.mtl", ["medmetal"]),
		loadLocalMTL("data/mat/bronzepatina/bronzepatina.mtl", ["bronzepatina"]),
		loadLocalMTL("data/mat/zodiac/zodiac.mtl", ["zodiac"]),
		loadLocalMTL("data/mat/signs/signs.mtl", ["signs"]),
		loadEnvCubeTex("data/mat/galaxy/galaxy-", "envCubeSpace")
	];
	totalAssets = stuff.length;

	return Promise.all(stuff).then(() => {
		makeReflectionMap("envCubeSpace", "reflectCubeSpace");

		a.mat.whiteness = asset.makeMaterial("whiteness");
		a.mat.whiteness.flags |= asset.MaterialFlags.usesEmissive;
		vec3.set(a.mat.whiteness.emissiveColour, 1, 1, 1);
		a.mat.whiteness.emissiveIntensity = 1;
		a.mat.whiteness.roughness = .5;

		a.mat.blackness = asset.makeMaterial("blackness");
		a.mat.blackness.roughness = .5;
		a.mat.blackness.metallic = 1;
		a.mat.blackness.roughnessTexture = a.mat.medmetal.roughnessTexture;

		return a;
	});
}
