class rigctl {

	debug = false;

	_state = { // actual data
		name:     null,
		freq:     null,
		mode:     null,
		strength: null,
		swr:      null,
		ptt:      null,
		mlast:    null
	};

	_socket;  // the actual websocket
	_url;     // url to the websocket
	_update;  // how often to fire the interval
	_timer;   // the interval itself
	_canptt;  // PTT enable
	_showio;  // show rigctld in/out

	/**
	 * rigctl displays frequency in hz.  kind of a PITA here, so
	 * let's change it right in the controller. 
	 */
	_fbase;   // divisor for frequency


	count = {
		current: 0,  // how many we've recieved.
		limit: 4   // how many we're willing to send before throwing a wait
	};
	waiting = false;

	scanning = false;
	_scanint; // interval for scanning


	modes = [
		'USB',  'LSB', 'CW', 'CWR', 'RTTY', 'RTTYR',
		'AM', 'FM', 'WFM', 'AMS', 'PKTLSB', 'PKTUSB',
		'PKTFM', 'ECSSUSB', 'ECSSLSB', 'FA', 'SAM',
		'SAL', 'SAH', 'DSB'
	]; // supported modes;


	// events for ui
	_e_radioFreq  = new CustomEvent("radioFreq", { detail: this });
	_e_radioPTT   = new CustomEvent("radioPTT", { detail: this });
	_e_radioMeter = new CustomEvent("radioMeter", { detail: this });
	_e_radioMode  = new CustomEvent("radioMode", { detail: this });
	_e_radioWait  = new CustomEvent("radioWait", { detail: this });
	_e_radioScan  = new CustomEvent("radioScan", { detail: this });

	_debug(stuff) {
		if (this.debug)
			console.debug("rigctl debug", stuff);
	}

	_parser = {

		// functions called with apply, this set to the rigctl object

		get_freq: function(d) {
			if (d.frequency != this._state.freq) {
				this._state.freq = parseFloat(d.frequency) / this._fbase;
				window.dispatchEvent(this._e_radioFreq);
			}
		},

		get_mode: function(d) {
			// FIXME we ignore passband
			
			if (this._state.mode != d.mode) {
				this._state.mode = d.mode;
				window.dispatchEvent(this._e_radioMode);
			}
		},

		get_ptt: function(d) {
			let v = (d.ptt == "1") ? true : false;
			if (v != this._state.ptt) {
				this._state.ptt = v;
				window.dispatchEvent(this._e_radioPTT);
			}
			if (this._state.ptt == true) {
				this._send("|\\get_level SWR\n");
			} else {
				this._send("|\\get_level STRENGTH\n");
			};
		},

		get_level: function(d) {

			let throw_event = false;

			if (this._state[d.attr] === undefined) {
				this._do_error("get_level got a level it didn't understand");
				console.error("get_level fail", d);
			} else {
				if (this._state[d.attr] != d[0]) {
					this._state[d.attr] = d[0];
					throw_event = true;
				}

				if (this._state.mlast != d.attr) {
					throw_event = true;
					this._state.mlast = d.attr;
				}

				if (throw_event) window.dispatchEvent(this._e_radioMeter);
			}

		},

		set_freq: function(d) {
			this._state.freq = parseFloat(d.attr) / this._fbase;
			window.dispatchEvent(this._e_radioFreq);
		},

		set_mode: function(d) {
			this._state.mode = d.attr.split(" ")[0].toUpperCase();
			window.dispatchEvent(this._e_radioMode);
		},

		set_ptt: function(d) {
			this._state.ptt = (d.attr == 1) ? true : false;
			window.dispatchEvent(this._e_radioPTT);
			
		}
	};

	// basic attributes
	get name() {
		return this._state.name;
	};
	set name(x) { };

	get freq() {
		return this._state.freq;
	};
	set freq(x) {
		this._debug(["freq set", x]);
		if (this.scanning) this.unscan();
		this._setfreq(x);
	};

	get mode() {
		return this._state.mode;
	};
	set mode(x) {
		x = x.toUpperCase();
		if (this.modes.includes(x)) {
			this._debug(["mode set", x]);
			this._send(`|\\set_mode ${x} -1\n`);
		}
	};

	get strength() {
		return this._state.strength;
	};
	set strength(x) { };

	get swr() {
		return this._state.swr;
	};
	set swr(x) { };

	get ptt() {
		return this._state.ptt;
	};
	set ptt(x) {
		if (this._canptt == false) return;
		this._debug(["ptt set", x]);
		let val = (!!x) ? 1 : 0;
		this._send(`|\\set_ptt ${val}\n`);
	};

	// composite attribute(s)
	get meter() {
		if (this._state.ptt == true) {
			return ["swr", this._state.swr ];
		} else {
			return ["strength", this._state.strength ];
		}
	};
	set meter(x) { };

	// actually set frequency
	_setfreq(x) {
		this._send(
			"|\\set_freq " +
			(parseFloat(x) * this._fbase) +
			"\n"
		);
	};

	// scanning mode
	
	scan(increment, duration = this._update) {

		if (this.scanning) {
			this._do_error("tried to start scan while already scanning");
			return false;
		}

		increment = parseFloat(increment);
		duration = parseInt(duration);
		this.scanning = true;

		this._debug(["beginning scan", increment, duration]);
		this._setfreq(this.freq + increment);
		this._scanint = setInterval(() => {
			this._setfreq(this.freq + increment);
		}, duration);

		window.dispatchEvent(this._e_radioScan);
		return true;
	};

	unscan() {
		this._debug("ending scan");
		clearInterval(this._scanint);
		this.scanning = false;
		window.dispatchEvent(this._e_radioScan);
	};

	_do_socket() {

		this._socket = new WebSocket(this._url);

		this._socket.onmessage = (evt) => {

			this.waiting = false;
			if (this.count.current >= this.count.limit) {
				window.dispatchEvent(this._e_radioWait);
			}
			this.count.current = 0;

			
			if (this._showio) console.debug('[RIGCTLD IN]', evt.data);
			let results = {}, optcnt = 0;

			let output = evt.data.split("|").map((i) => i.trim());
			if (output.length == 0) return;

			/* parse output */
			let report = output.pop().split("RPRT ")[1];
			for (const x in output) {
				let s = output[x].split(":").map((i) => i.trim());

				if (s.length == 1) {
					results[ optcnt++ ] = s[0];
				} else {
					if (Object.keys(results).length == 0) {
						results.command = s[0].toLowerCase();
						results.attr = s[1].toLowerCase();
					} else {
						results[ s[0].toLowerCase() ] = s[1];
					}
				}
			}

			if (report != "0") {

				if (results.command == "get_level") {
					this._debug("get_level failed, do not toss out an error");
				} else {
					this._do_error("Command from rigctld failed, check log");
					console.error("failed command", output, evt.data);
				}
				return;
				
			}
			

			if (!this._parser[results.command]) {
				this._do_error("Command from rigctld has no parser.  Check logs.");
				console.error("unparsed command", results, evt.data);
			} else {
				this._parser[results.command].apply(this, [ results ]);
			}

		}

		this._socket.onopen = (evt) => {
			this._do_update();
			this._timer = setInterval(() => { this._do_update() }, this._update);
			this.waiting = false;
			window.dispatchEvent(this._e_radioWait);
		}

		this._socket.onclose = (evt) => {
			this._debug(`reopening radio connection ${this.name}`);
			this._do_socket();
		}
	};

	_do_update() {
		this._send('|\\get_freq\n|\\get_mode\n|\\get_ptt\n');
	}

	_send(txt) {

		this.count.current++;

		if (this.count.current < this.count.limit) {
			try {
				if (this._showio) console.debug("[RIGCTLD OUT]", txt);
				this._socket.send(txt);
			} catch (error) {
				this._do_error(["error sending via websocket", error]);

			}
		} else if (this.count.current == this.count.limit) {
			this.waiting = true;
			window.dispatchEvent(this._e_radioWait);
		} else {
			this._debug("waiting...");
		}
	};

	constructor(args) {

		let config = Object.assign(
			{
				url: "socket/",
				name: "rigctl",
				update: 500,
				base: 1000000,
				debug: false,
				canptt: false, 
				showio: false
			},
			args
		);
		

		this._state.name = config.name;
		this._url = config.url;
		this._update = config.update;
		this._fbase = config.base;
		this._canptt = config.canptt;
		this._showio = config.showio;
		this.debug = config.debug;




		console.log(`new rigctl "${this._state.name}": ${this._url}`);
		this._do_socket();

	};

	_do_error(str = "Unspecified Error") {

		let evt = new CustomEvent("radioError", { 
			detail: {
				rig: this,
				error: str
			}
		});
		console.error(str);
		window.dispatchEvent(evt);


	};


}
