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
	chipmetal: render.effect.StandardEffectData;
	medmetal: render.effect.StandardEffectData;
	bronzepatina: render.effect.StandardEffectData;
	zodiac: render.effect.StandardEffectData;
	signs: render.effect.StandardEffectData;
	whiteness: render.effect.StandardEffectData;
	blackness: render.effect.StandardEffectData;
	orbs: render.effect.StandardEffectData[];
	orbsLeft: render.effect.StandardEffectData[];
	orbsRight: render.effect.StandardEffectData[];
}

interface TextureAssets {
	envCubeSpace?: render.Texture;
	reflectCubeSpace?: render.Texture;
}

interface Assets {
	sound: SoundAssets;
	mat: MaterialAssets;
	tex: TextureAssets;
}

/*
		{
			"name": "envCubeSpace",
			"kind": "textureCube",
			"dependencies": {
				"negx": { "uri": "data/mat/galaxy/galaxy-negx.jpg" },
				"negy": { "uri": "data/mat/galaxy/galaxy-negy.jpg" },
				"negz": { "uri": "data/mat/galaxy/galaxy-negz.jpg" },
				"posx": { "uri": "data/mat/galaxy/galaxy-posx.jpg" },
				"posy": { "uri": "data/mat/galaxy/galaxy-posy.jpg" },
				"posz": { "uri": "data/mat/galaxy/galaxy-posz.jpg" }
			}
		},
		{
			"name": "reflectCubeSpace",
			"generator": "pbrPrefilteredEnvMap",
			"metadata": {
				"baseDim": 256,
				"levels": 5
			},
			"dependencies": {
				"textureCube": {
					"ref": "envCubeSpace"
				}
			}
		}
*/
