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
