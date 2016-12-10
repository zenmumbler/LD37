"use strict";
var FlyCam = (function () {
    function FlyCam(initialPos) {
        this.pos_ = [0, 0, 0];
        this.angleX_ = 0;
        this.angleY_ = Math.PI;
        this.dir_ = [0, 0, -1];
        this.up_ = [0, 1, 0];
        this.speed_ = 0;
        this.sideSpeed_ = 0;
        vec3.copy(this.pos_, initialPos);
        this.rotate([0, 0]);
    }
    FlyCam.prototype.update = function (timeStep, acceleration, sideAccel) {
        this.speed_ += timeStep * acceleration;
        this.sideSpeed_ += timeStep * sideAccel;
        vec3.scaleAndAdd(this.pos_, this.pos_, this.dir_, this.speed_);
        var right = vec3.cross([], this.dir_, this.up_);
        vec3.scaleAndAdd(this.pos_, this.pos_, right, this.sideSpeed_);
        this.speed_ *= 0.9;
        if (Math.abs(this.speed_) < 0.001) {
            this.speed_ = 0;
        }
        this.sideSpeed_ *= 0.9;
        if (Math.abs(this.sideSpeed_) < 0.001) {
            this.sideSpeed_ = 0;
        }
    };
    FlyCam.prototype.rotate = function (localRelXY) {
        this.angleX_ -= Math.PI * 1.5 * localRelXY[1];
        this.angleY_ += Math.PI * 2 * localRelXY[0];
        this.rot_ = quat.fromEuler(0, this.angleY_, this.angleX_);
        vec3.transformQuat(this.dir_, [0, 0, 1], this.rot_);
        vec3.normalize(this.dir_, this.dir_);
        vec3.transformQuat(this.up_, [0, 1, 0], this.rot_);
        vec3.normalize(this.up_, this.up_);
    };
    Object.defineProperty(FlyCam.prototype, "pos", {
        get: function () { return this.pos_; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(FlyCam.prototype, "dir", {
        get: function () { return this.dir_; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(FlyCam.prototype, "rotation", {
        get: function () { return this.rot_; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(FlyCam.prototype, "focusPos", {
        get: function () { return vec3.add([], this.pos_, this.dir_); },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(FlyCam.prototype, "viewMatrix", {
        get: function () { return mat4.lookAt([], this.pos_, this.focusPos, this.up_); },
        enumerable: true,
        configurable: true
    });
    return FlyCam;
}());
var FlyCamController = (function () {
    function FlyCamController(sensingElem, initialPos) {
        var _this = this;
        this.tracking_ = false;
        this.lastPos_ = [0, 0];
        this.cam = new FlyCam(initialPos);
        this.vpWidth_ = sensingElem.offsetWidth;
        this.vpHeight_ = sensingElem.offsetHeight;
        dom.on(sensingElem, "mousedown", function (evt) {
            _this.tracking_ = true;
            _this.lastPos_ = [evt.clientX, evt.clientY];
        });
        dom.on(window, "mousemove", function (evt) {
            if (!_this.tracking_) {
                return;
            }
            var newPos = [evt.clientX, evt.clientY];
            var delta = vec2.sub([], newPos, _this.lastPos_);
            vec2.divide(delta, delta, [-_this.vpWidth_, -_this.vpHeight_]);
            _this.lastPos_ = newPos;
            _this.cam.rotate(delta);
        });
        dom.on(window, "mouseup", function (evt) {
            _this.tracking_ = false;
        });
    }
    FlyCamController.prototype.step = function (timeStep) {
        var maxAccel = 0.8;
        var accel = 0, sideAccel = 0;
        if (io.keyboard.down(io.Key.UP) || io.keyboard.down(io.Key.W)) {
            accel = maxAccel;
        }
        else if (io.keyboard.down(io.Key.DOWN) || io.keyboard.down(io.Key.S)) {
            accel = -maxAccel;
        }
        if (io.keyboard.down(io.Key.LEFT) || io.keyboard.down(io.Key.A)) {
            sideAccel = -maxAccel;
        }
        else if (io.keyboard.down(io.Key.RIGHT) || io.keyboard.down(io.Key.D)) {
            sideAccel = maxAccel;
        }
        this.cam.update(timeStep, accel, sideAccel);
    };
    return FlyCamController;
}());
"use strict";
var io = sd.io;
var math = sd.math;
var world = sd.world;
var render = sd.render;
var meshdata = sd.meshdata;
var dom = sd.dom;
var asset = sd.asset;
var container = sd.container;
var audio = sd.audio;
var vec2 = veclib.vec2;
var vec3 = veclib.vec3;
var vec4 = veclib.vec4;
var quat = veclib.quat;
var mat2 = veclib.mat2;
var mat3 = veclib.mat3;
var mat4 = veclib.mat4;
var MainScene = (function () {
    function MainScene(rc, ac) {
        this.rc = rc;
        this.ac = ac;
        this.mode_ = 0;
        this.scene_ = new world.Scene(rc);
        this.flyCam_ = new FlyCamController(rc.gl.canvas, [0, 2, 5]);
        this.setMode(1);
        this.createScene();
    }
    MainScene.prototype.createScene = function () {
        var scene = this.scene_;
        var modm = scene.stdModelMgr;
        var ltm = scene.lightMgr;
        var clm = scene.colliderMgr;
        var rc = this.rc;
        var ac = this.ac;
        var mat = asset.makeMaterial("floor");
        scene.makeEntity({
            mesh: {
                name: "floor",
                meshData: meshdata.gen.generate(new meshdata.gen.Box({ width: 2, depth: 2, height: 2, inward: false }))
            },
            stdModel: {
                materials: [mat]
            }
        });
        scene.makeEntity({
            transform: {
                position: [2, 3, 2]
            },
            light: {
                name: "point",
                type: 2,
                intensity: 1,
                range: 7,
                colour: [1, 1, 1],
            }
        });
    };
    MainScene.prototype.resume = function () {
        if (this.mode_ >= 2) {
        }
    };
    MainScene.prototype.suspend = function () {
        if (this.mode_ >= 2) {
        }
    };
    MainScene.prototype.setMode = function (newMode) {
        dom.hide(".loading");
        dom.hide(".titles");
        dom.show("#stage");
        this.mode_ = newMode;
    };
    MainScene.prototype.renderFrame = function (timeStep) {
        var _this = this;
        var rpdMain = render.makeRenderPassDescriptor();
        vec4.set(rpdMain.clearColour, 0, 0, 0, 1);
        rpdMain.clearMask = 3;
        render.runRenderPass(this.rc, this.scene_.meshMgr, rpdMain, null, function (renderPass) {
            var camera = {
                projectionMatrix: mat4.perspective([], math.deg2rad(50), _this.rc.gl.drawingBufferWidth / _this.rc.gl.drawingBufferHeight, 0.1, 100),
                viewMatrix: _this.flyCam_.cam.viewMatrix
            };
            _this.scene_.lightMgr.prepareLightsForRender(_this.scene_.lightMgr.all(), camera, renderPass.viewport());
            renderPass.setDepthTest(3);
            renderPass.setFaceCulling(2);
            _this.scene_.stdModelMgr.draw(_this.scene_.stdModelMgr.all(), renderPass, camera, null, null, 0);
        });
    };
    MainScene.prototype.simulationStep = function (timeStep) {
        var txm = this.scene_.transformMgr;
        this.flyCam_.step(timeStep);
    };
    return MainScene;
}());
dom.on(window, "load", function () {
    var canvas = document.getElementById("stage");
    var rctx = render.makeRenderContext(canvas);
    var actx = audio.makeAudioContext();
    var mainCtl = new MainScene(rctx, actx);
    sd.defaultRunLoop.sceneController = mainCtl;
    sd.defaultRunLoop.start();
});
