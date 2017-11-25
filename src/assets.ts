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
	chipmetal: render.EffectData;
	medmetal: render.EffectData;
	bronzepatina: render.EffectData;
	zodiac: render.EffectData;
	signs: render.EffectData;
	whiteness: render.EffectData;
	blackness: render.EffectData;
	orbs: render.EffectData[];
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
