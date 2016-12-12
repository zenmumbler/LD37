// Callisto, a Ludum Dare 37 Entry
// (c) 2016 by Arthur Langereis (@zenmumbler)

interface MaterialAssets {
	chipmetal: asset.Material;
	medmetal: asset.Material;
	bronzepatina: asset.Material;
	whitemarble: asset.Material;
	zodiac: asset.Material;
}

interface MeshAssets {
}

interface TextureAssets {
	envCubeSpace: render.Texture;
	reflectCubeSpace: render.Texture;
}

interface Assets {
	// sound: SoundAssets;
	mat: MaterialAssets;
	mesh: MeshAssets;
	tex: TextureAssets;
}

function loadAllAssets(rc: render.RenderContext, ac: audio.AudioContext, meshMgr: world.MeshManager, progress: (ratio: number) => void) {
	const a = { mat: {}, mesh: {}, tex: {} } as Assets;

	var totalAssets = 1, assetsLoaded = 0;
	const loaded = () => {
		assetsLoaded += 1;
		progress(assetsLoaded / totalAssets);
	};

	function localURL(path: string) {
		return new URL(path, document.baseURI!);
	}

	function loadLocalMTL<K extends keyof MaterialAssets>(path: string, ks: K[]) {
		return asset.loadMTLFile(localURL(path)).then(ag => {
			for (const mat of ag.materials) {
				if (ks.indexOf(<any>mat.name) > -1) {
					a.mat[mat.name as K] = <any>mat;
				}
			}
			totalAssets += ag.textures.length;
			return asset.resolveTextures(rc, ag.textures).then(tex => {
				assetsLoaded += tex.length;
			});
		});
	}

	function loadEnvCubeTex<K extends keyof TextureAssets>(dirPath: string, k: K) {
		render.loadCubeTexture(rc, render.makeCubeMapPaths(dirPath, ".jpg")).then(texture => {
			a.tex[k] = <any>texture;
		});
	}

	function makeReflectionMap<K extends keyof TextureAssets>(k1: K, k2: K) {
		const envTexture = render.prefilteredEnvMap(rc, meshMgr, <any>a.tex[k1] as render.Texture, 256);
		a.tex[k2] = <any>envTexture;
	}

	const stuff = [
		loadLocalMTL("data/mat/chipmetal/chipmetal.mtl", ["chipmetal"]),
		loadLocalMTL("data/mat/medmetal/medmetal.mtl", ["medmetal"]),
		loadLocalMTL("data/mat/bronzepatina/bronzepatina.mtl", ["bronzepatina"]),
		loadLocalMTL("data/mat/whitemarble/whitemarble.mtl", ["whitemarble"]),
		loadLocalMTL("data/mat/zodiac/zodiac.mtl", ["zodiac"]),
		loadEnvCubeTex("data/mat/galaxy/galaxy-", "envCubeSpace")
	];
	totalAssets = stuff.length;

	return Promise.all(stuff).then(() => {
		makeReflectionMap("envCubeSpace", "reflectCubeSpace");
		a.mat.whitemarble.emissiveIntensity = 1;
		return a;
	});
}
