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
	private ambienceGain: GainNode;

	private musicSource: AudioBufferSourceNode | null = null;
	private effectSource: AudioBufferSourceNode | null = null;

	private stepToggle = 0;

	constructor(private ac: audio.AudioContext) {
		var ctx = this.ctx = ac.ctx;

		this.stepGain = ctx.createGain();
		this.musicGain = ctx.createGain();
		this.effectGain = ctx.createGain();

		this.stepGain.connect(ac.ctx.destination);
		this.musicGain.connect(ac.ctx.destination);
		this.effectGain.connect(ac.ctx.destination);
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
		var volume = 0;

		switch (what) {
			case SFX.FootStep: buffer = assets.steps[this.stepToggle]; source = this.effectSource; volume = 1; this.stepToggle ^= 1; break;
			case SFX.LightOn: buffer = assets.lightOn; source = this.effectSource; volume = 1; break;
			case SFX.LightOff: buffer = assets.lightOff; source = this.effectSource; volume = 1; break;
			case SFX.DoorOpen: buffer = assets.doorOpen; source = this.effectSource; volume = 1; break;
			case SFX.Swoosh: buffer = assets.swoosh; source = this.effectSource; volume = 1; break;

			case SFX.ToneA:
			case SFX.ToneB:
			case SFX.ToneC:
			case SFX.ToneD:

			default: buffer = null;
		}

		if (! buffer) {
			return;
		}
		if (source) {
			source.stop();
		}

		var bufferSource: AudioBufferSourceNode | null = this.ac.ctx.createBufferSource();
		bufferSource.buffer = buffer;
		bufferSource.connect(this.effectGain);
		bufferSource.start(0);
		this.effectGain.gain.value = volume;

		this.effectSource = bufferSource;

		bufferSource.onended = () => {
			if (this.effectSource == bufferSource) {
				this.effectSource = null;
			}

			bufferSource!.disconnect();
			bufferSource = null;
		};

	}
}
