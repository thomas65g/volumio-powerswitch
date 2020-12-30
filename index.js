'use strict';

// load external modules
var libQ = require('kew');
var io = require('socket.io-client');
var Gpio = require('onoff').Gpio;

var socket = io.connect('http://localhost:3000');


//declare global status variable
var status = 'na';

// Define the PowerSwitchController class
module.exports = PowerSwitchController;


function PowerSwitchController(context) {
    var self = this;

    // Save a reference to the parent commandRouter
    self.context = context;
    self.commandRouter = self.context.coreCommand;
    self.logger = self.commandRouter.logger;
    this.configManager = this.context.configManager;

    // Setup Debugger
    self.logger.ASdebug = function (data) {
        self.logger.info('[ASDebug] ' + data);
    };

    //define powerswitchA variable
    self.powerswitchA;
    self.powerswitchB;

}

// define behaviour on system start up. In our case just read config file
PowerSwitchController.prototype.onVolumioStart = function () {
    var self = this;
    var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();
}

// Volumio needs this
PowerSwitchController.prototype.getConfigurationFiles = function () {
    return ['config.json'];
}

// define behaviour on plugin activation
PowerSwitchController.prototype.onStart = function () {
    var self = this;
    var defer = libQ.defer();

    // initialize output port
    self.ampGPIOInit();

    // read and parse status once
    socket.emit('getState', '');
    socket.once('pushState', self.parseStatus.bind(self));

    // listen to every subsequent status report from Volumio
    // status is pushed after every playback action, so we will be
    // notified if the status changes
    socket.on('pushState', self.parseStatus.bind(self));

    defer.resolve();
    return defer.promise;
};

// define behaviour on plugin deactivation.
PowerSwitchController.prototype.onStop = function () {
    var self = this;
    var defer = libQ.defer();

    self.logger.ASdebug('PortA: ' + self.config.get('portA'));
    self.logger.ASdebug('PortB: ' + self.config.get('portB'));
    self.logger.ASdebug('Delay: ' + self.config.get('delay'));
    self.logger.ASdebug('Pause: ' + self.config.get('pause'));
    // we don't have to claim GPIOs any more
    self.freeGPIO();

    return defer.promise;
};

// initialize Plugin settings page
PowerSwitchController.prototype.getUIConfig = function () {
    var defer = libQ.defer();
    var self = this;
    self.logger.ASdebug('PortA: ' + self.config.get('portA'));
    self.logger.ASdebug('PortB: ' + self.config.get('portB'));
    self.logger.ASdebug('Delay: ' + self.config.get('delay'));
    self.logger.ASdebug('Pause: ' + self.config.get('pause'));

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function (uiconf) {
            uiconf.sections[0].content[0].value.value = self.config.get('portA');
            uiconf.sections[0].content[0].value.label = self.config.get('portA').toString();
            uiconf.sections[0].content[1].value.value = self.config.get('portB');
            uiconf.sections[0].content[1].value.label = self.config.get('portB').toString();
            uiconf.sections[0].content[3].value = self.config.get('delay');
            uiconf.sections[0].content[2].value = self.config.get('pause');
            defer.resolve(uiconf);
        })
        .fail(function () {
            defer.reject(new Error());
        });

    return defer.promise;
};

// define what happens when the user clicks the 'save' button on the settings page
PowerSwitchController.prototype.saveOptions = function (data) {
    var self = this;
    var successful = true;
    var old_portA = self.config.get('portA');
    var old_portB = self.config.get('portB');

    // save port setting to our config
    self.logger.ASdebug('Saving Settings: PortA: ' + data['portA_setting']['value']);
    self.logger.ASdebug('Saving Settings: PortB: ' + data['portB_setting']['value']);
    self.logger.ASdebug('Saving Settings: Delay: ' + data['delay_setting']);
    self.logger.ASdebug('Saving Settings: Pause: ' + data['pause_setting']);

    self.config.set('portA', data['portA_setting']['value']);
    self.config.set('portB', data['portB_setting']['value']);
    self.config.set('delay', data['delay_setting']);
    self.config.set('pause', data['pause_setting']);

    // unexport GPIOs before constructing new GPIO object
    self.freeGPIO();
    try {
        self.ampGPIOInit()
    } catch (err) {
        successful = false;
    }
    if (successful) {
        // output message about successful saving to the UI
        self.commandRouter.pushToastMessage('success', 'Power Switch Settings', 'Saved');
    } else {
        // save port setting to old config
        self.config.set('portA', old_portA);
        self.config.set('portB', old_portB);
        self.commandRouter.pushToastMessage('error', 'Port not accessible', '');
    }

};

// initialize powerswitchA port to the one that we stored in the config
PowerSwitchController.prototype.ampGPIOInit = function () {
    var self = this;

    self.powerswitchA = new Gpio(self.config.get('portA'), 'out');
    self.powerswitchB = new Gpio(self.config.get('portB'), 'out');
};

// a pushState event has happened. Check whether it differs from the last known status and
// switch output port on or off respectively
PowerSwitchController.prototype.parseStatus = function (state) {
    var self = this;
    var delay = self.config.get('delay');
    self.logger.ASdebug('CurState: ' + state.status + ' PrevState: ' + status);

    clearTimeout(self.OffTimerID);
    if (state.status == 'play' && state.status != status) {
        status = state.status;
        self.on();
    } else if ((state.status == 'pause' || state.status == 'stop') && (status != 'pause' && status != 'stop')) {
        self.logger.ASdebug('InitTimeout - Amp off in: ' + delay + ' ms');
        self.OffTimerID = setTimeout(function () {
            status = state.status;
            self.off();
        }, delay);
    }

};

// switch outport port on
PowerSwitchController.prototype.on = function () {
    var self = this;
    var pause = self.config.get('pause');

    self.logger.ASdebug('Power Switch: ON (A than B)');
    self.powerswitchA.writeSync(1);
    clearTimeout(self.pulseTimerID);
    self.pulseTimerID = setTimeout(function () {
        self.powerswitchB.writeSync(1);
    }, pause);
};

//switch output port off
PowerSwitchController.prototype.off = function () {
    var self = this;
    var pause = self.config.get('pause');

    self.logger.ASdebug('Power Switch: OFF (B than A)');
    self.powerswitchB.writeSync(0);
    clearTimeout(self.pulseTimerID);
    self.pulseTimerID = setTimeout(function () {
        self.powerswitchA.writeSync(0);
    }, pause);
};


// stop claiming output port
PowerSwitchController.prototype.freeGPIO = function () {
    var self = this;

    self.powerswitchA.unexport();
    self.powerswitchB.unexport();
};
