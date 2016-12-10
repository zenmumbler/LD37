// Unknown, a Ludum Dare 37 Entry
// (c) 2016 by Arthur Langereis (@zenmumbler)

interface MaterialAssets {
	chipmetal: asset.Material;
	medmetal: asset.Material;
}

interface MeshAssets {
}

interface TextureAssets {
	envCubeSpace: render.Texture;
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

	function loadLocalMTL<K extends keyof MaterialAssets>(path: string, k: K) {
		return asset.loadMTLFile(localURL(path)).then(ag => {
			a.mat[k] = <any>ag.materials[0];
			totalAssets += ag.textures.length;
			return asset.resolveTextures(rc, ag.textures).then(tex => {
				assetsLoaded += tex.length;
			});
		});
	}

	function loadEnvCubeTex<K extends keyof TextureAssets>(dirPath: string, k: K) {
		render.loadCubeTexture(rc, render.makeCubeMapPaths(dirPath, ".jpg")).then(texture => {
			const envTexture = render.prefilteredEnvMap(rc, meshMgr, texture, 256);
			a.tex[k] = <any>envTexture;
		});
	}

	const stuff = [
		loadLocalMTL("data/mat/chipmetal/chipmetal.mtl", "chipmetal"),
		loadLocalMTL("data/mat/medmetal/medmetal.mtl", "medmetal"),
		loadEnvCubeTex("data/mat/galaxy/galaxy-", "envCubeSpace"),
	];
	totalAssets = stuff.length;

	return Promise.all(stuff).then(() => {
		return a;
	});
}
