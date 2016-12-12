// sfx.ts - part of Callisto, a Ludum Dare 37 Entry
// (c) 2016 by Arthur Langereis — @zenmumbler

const enum SFX {
	FootStep,
	LightOn,
	LightOff,
	DoorOpen,
	Swoosh,
	ToneA,
	ToneB,
	ToneC,
	ToneD
}


const enum Music {
	None,
	Main,
	End
}


class Sound {
	private assets_: SoundAssets;
	private ctx: NativeAudioContext;

	private endMusic_ = false;

	private stepGain: GainNode;
	private musicGain: GainNode;
	private effectGain: GainNode;
	private toneGain: GainNode;

	private stepSource: AudioBufferSourceNode | null = null;
	private musicSource: AudioBufferSourceNode | null = null;
	private effectSource: AudioBufferSourceNode | null = null;
	private toneSources: (AudioBufferSourceNode | null)[] = [];

	private stepToggle = 0;

	constructor(private ac: audio.AudioContext) {
		const ctx = this.ctx = ac.ctx;

		this.stepGain = ctx.createGain();
		this.musicGain = ctx.createGain();
		this.effectGain = ctx.createGain();
		this.toneGain = ctx.createGain();

		this.stepGain.connect(ac.ctx.destination);
		this.musicGain.connect(ac.ctx.destination);
		this.effectGain.connect(ac.ctx.destination);
		this.toneGain.connect(ac.ctx.destination);
	}


	setAssets(assets: SoundAssets) {
		this.assets_ = assets;
	}


	startMusic() {
		if (! this.musicSource) {
			this.musicSource = this.ac.ctx.createBufferSource();
			this.musicSource.buffer = this.endMusic_ ? this.assets_.endMusic : this.assets_.mainMusic;
			this.musicSource.loop = !this.endMusic_;
			this.musicSource.connect(this.musicGain);
			this.musicGain.gain.value = 0.7;

			this.musicSource.start(0);
		}
	}

	stopMusic() {
		if (this.endMusic_) {
			return;
		}
		if (this.musicSource) {
			this.musicSource.stop();
			this.musicSource = null;
		}
	}


	setEndMusic() {
		this.endMusic_ = true;
	}


	play(what: SFX) {
		var assets = this.assets_;
		if (! this.ac) {
			return;
		}

		var buffer: AudioBuffer | null = null;
		var source: AudioBufferSourceNode | null = null;
		var gain: GainNode | null = null;
		var volume = 0;
		var rate: number | null = null;

		switch (what) {
			case SFX.FootStep: buffer = assets.steps[this.stepToggle]; source = this.stepSource; gain = this.stepGain; volume = .65; this.stepToggle ^= 1; break;
			case SFX.LightOn: buffer = assets.lightOn; source = this.effectSource; gain = this.effectGain; volume = .5; break;
			case SFX.LightOff: buffer = assets.lightOff; source = this.effectSource; gain = this.effectGain; volume = .7; break;
			case SFX.DoorOpen: buffer = assets.doorOpen; source = this.effectSource; gain = this.effectGain; volume = 1; break;
			case SFX.Swoosh: buffer = assets.swoosh; source = this.effectSource; gain = this.effectGain; volume = 1; break;

			case SFX.ToneA: buffer = null; source = this.toneSources[0]; gain = this.toneGain; volume = 1; rate = 1; break;
			case SFX.ToneB: buffer = null; source = this.toneSources[1]; gain = this.toneGain; volume = 1; rate = 1; break;
			case SFX.ToneC: buffer = null; source = this.toneSources[2]; gain = this.toneGain; volume = 1; rate = 1; break;
			case SFX.ToneD: buffer = null; source = this.toneSources[3]; gain = this.toneGain; volume = 1; rate = 1; break;

			default: buffer = null;
		}

		if (! buffer || ! gain) {
			return;
		}
		if (source) {
			source.stop();
		}

		var bufferSource: AudioBufferSourceNode | null = this.ac.ctx.createBufferSource();
		bufferSource.buffer = buffer;
		bufferSource.connect(gain);
		if (rate !== null) {
			bufferSource.playbackRate.value = rate;
		}
		bufferSource.start(0);
		gain.gain.value = volume;

		if (what === SFX.FootStep) {
			this.stepSource = bufferSource;
		}
		else if (what >= SFX.ToneA) {
			this.toneSources[what - SFX.ToneA] = bufferSource;
		}
		else {
			this.effectSource = bufferSource;
		}

		bufferSource.onended = () => {
			if (this.effectSource == bufferSource) {
				this.effectSource = null;
			}
			else if (this.stepSource == bufferSource) {
				this.stepSource = null;
			}
			else if (this.toneSources[0] == bufferSource) { this.toneSources[0] = null; }
			else if (this.toneSources[1] == bufferSource) { this.toneSources[1] = null; }
			else if (this.toneSources[2] == bufferSource) { this.toneSources[2] = null; }
			else if (this.toneSources[3] == bufferSource) { this.toneSources[3] = null; }

			bufferSource!.disconnect();
			bufferSource = null;
		};

	}
}
