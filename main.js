'use strict';

/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const ipp = require('@sealsystems/ipp');

// Load your modules here, e.g.:
// const fs = require("fs");




class Cups extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'cups',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {

		// Initialize your adapter here
		// Reset the connection indicator during startup
		this.setState('info.connection', false, true);
		if (this.config.interval < 1) {
			this.log.info('Set interval to minimum 1');
			this.config.interval = 1;
		}

		if (!this.config.serverIp) {
			this.log.error('Please set server in the instance settings');
			return;
		}

		this.updateInterval = null;
		this.statusCode = null;
		this.printers = [];
		this.printer_addributes = ['printer-state','printer-state-message','printer-state-reasons','queued-job-count'];

		await this.connect();

		if (this.statusCode === 'successful-ok') {
			await this.getPrintersList();
			await this.addPrinters();
			await this.updatePrinters();
			this.updateInterval = setInterval(async () => {
				await this.updatePrinters();
			}, this.config.interval * 1000);

		}

		//this.log.info(this.printers);

		this.greet(this.printers);

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		this.log.debug('config server: ' + this.config.serverIp);
		this.log.debug('config port: ' + this.config.port);
		this.log.debug('config interval: ' + this.config.interval);



		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		/*
		await this.setObjectNotExistsAsync('testVariable', {
			type: 'state',
			common: {
				name: 'testVariable',
				type: 'boolean',
				role: 'indicator',
				read: true,
				write: true,
			},
			native: {},
		});
		*/


		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		//this.subscribeStates('testVariable');
		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates('lights.*');
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates('*');

		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// the variable testVariable is set to true as command (ack=false)
		//await this.setStateAsync('testVariable', false);

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
		//await this.setStateAsync('testVariable', { val: true, ack: true });

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		//await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

		// examples for the checkPassword/checkGroup functions
		//let result = await this.checkPasswordAsync('admin', 'iobroker');
		//this.log.info('check user admin pw iobroker: ' + result);

		//result = await this.checkGroupAsync('admin', 'admin');
		//this.log.info('check group user admin group admin: ' + result);
	}

	async connect() {
		this.log.debug('connect');
		return new Promise((resolve, reject) => {
			const localThis = this;
			ipp.request(
				'ipp://' + this.config.serverIp + ':' + this.config.port + '/',
				ipp.serialize({
					operation: 'CUPS-Get-Printers',
					'operation-attributes-tag': {
						'attributes-charset': 'utf-8',
						'attributes-natural-language': 'en',
						'requested-attributes': ['']
					}
				}),
				function(err, res) {
					if (err) {
						localThis.log.error(err);
						if (err.response) {
							localThis.log.error(JSON.stringify(err.response.data, null, 2));
							reject(err.response);
						}
					} else {
						localThis.log.debug(JSON.stringify(res));
						if (res.statusCode) {
							localThis.statusCode = res.statusCode;
							localThis.setState('info.connection', true, true);
							localThis.setState('serverInfo.statusCode', res.statusCode, true);
							localThis.setState('serverInfo.version', res.version, true);
							if (res['operation-attributes-tag'] && res['operation-attributes-tag']['status-message']) {
								const statusMessage = res['operation-attributes-tag']['status-message'];
								localThis.log.error(statusMessage);
							}
							resolve(null);
							return;
						}
						localThis.log.error(JSON.stringify(res.data));
					}
				}
			);
		});
	}

	async getPrintersList() {
		this.log.debug('getPrintersList');
		return new Promise((resolve, reject) => {
			const localThis = this;
			ipp.request(
				'http://' + this.config.serverIp + ':' + this.config.port + '/',
				ipp.serialize({
					operation: 'CUPS-Get-Printers',
					'operation-attributes-tag': {
						'attributes-charset': 'utf-8',
						'attributes-natural-language': 'en',
						'requested-attributes': ['printer-name']
					}
				}),
				function(err, res) {
					if (err) {
						localThis.log.error(err);
						if (err.response) {
							localThis.log.error(JSON.stringify(err.response.data, null, 2));
							reject(err.response);
						}
					} else {
						localThis.log.debug(JSON.stringify(res));
						if (res.statusCode) {
							if (Array.isArray(res['printer-attributes-tag'])) {
								res['printer-attributes-tag'].forEach((printer) => {
									// @ts-ignore
									localThis.printers.push(printer['printer-name']);
								});
							} else {
								// @ts-ignore
								localThis.printers.push(res['printer-attributes-tag']['printer-name']);
							}
							resolve(null);
							return;
						}
						localThis.log.error(JSON.stringify(res.data));
					}
				}
			);
		});

	}

	greet(names) {
		for (const name of names) {
			this.log.debug(name);
		}
	}

	async addPrinters() {
		this.log.debug('addPrinters');
		if (this.printers != null) {
			for (const printerIndex in this.printers) {
				//this.createDevice(printer);
				const printer = this.printers[printerIndex];
				//Printers
				await this.setObjectNotExistsAsync(printer, {
					type: 'device',
					common: {
						name: printer
					},
					native: {},
				});

				//printer-state
				await this.setObjectNotExistsAsync(printer + '.printer-state', {
					type: 'state',
					common: {
						name: 'Printer Status',
						type: 'string',
						role: 'info',
						read: true,
						write: false,
					},
					native: {},
				});

				//printer-state-message
				await this.setObjectNotExistsAsync(printer + '.printer-state-message', {
					type: 'state',
					common: {
						name: 'Printer Status Message',
						type: 'string',
						role: 'info',
						read: true,
						write: false,
					},
					native: {},
				});

				//printer-state-reasons
				await this.setObjectNotExistsAsync(printer + '.printer-state-reasons', {
					type: 'state',
					common: {
						name: 'Printer Status',
						type: 'string',
						role: 'info',
						read: true,
						write: false,
					},
					native: {},
				});

				//queued-job-count
				await this.setObjectNotExistsAsync(printer + '.queued-job-count', {
					type: 'state',
					common: {
						name: 'Printer Job Count',
						type: 'number',
						role: 'value',
						read: true,
						write: false,
					},
					native: {},
				});
			}
		}
		this.log.debug('finished addPrinters');
	}


	updatePrinters() {
		this.log.debug('updatePrinters');
		this.printers?.forEach((printer) => {
			const localThis = this;
			ipp.request(
				'http://' + this.config.serverIp + ':' + this.config.port + '/printers/' + printer,
				ipp.serialize({
					operation: 'Get-Printer-Attributes',
					'operation-attributes-tag': {
						'attributes-charset': 'utf-8',
						'attributes-natural-language': 'en',
						'printer-uri': 'http://' + this.config.serverIp + ':' + this.config.port + '/printers/' + printer,
						'requested-attributes': this.printer_addributes
					}
				}),
				function(err, res) {
					if (err) {
						localThis.log.error(err);
						if (err.response) {
							localThis.log.error(JSON.stringify(err.response.data, null, 2));
						}
					} else {
						localThis.log.debug(JSON.stringify(res));
						if (res.statusCode) {

							localThis.printer_addributes?.forEach((item) => {
								localThis.setState(printer + '.' + item, res['printer-attributes-tag'][item], true);
							});

							return;
						}
						localThis.log.error(JSON.stringify(res.data));
					}
				}
			);

		});
	}

	/*

		this.printers?.forEach((item) => {

		});

	*/

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			this.setState('info.connection', false, true);
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			this.updateInterval && clearInterval(this.updateInterval);

			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === 'object' && obj.message) {
	// 		if (obj.command === 'send') {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info('send command');

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }

}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Cups(options);
} else {
	// otherwise start the instance directly
	new Cups();
}